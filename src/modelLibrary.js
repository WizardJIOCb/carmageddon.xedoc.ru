import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const CAR_MODELS = {
  razor: 'sedan-sports',
  marauder: 'hatchback-sports',
  brutus: 'truck-flat',
  mantis: 'race-future',
  hearse: 'delivery-flat',
  phantom: 'race-future',
};

const GLB_ASSETS = {
  'car:sedan-sports': '/assets/cars/sedan-sports.glb',
  'car:hatchback-sports': '/assets/cars/hatchback-sports.glb',
  'car:suv': '/assets/cars/suv.glb',
  'car:truck-flat': '/assets/cars/truck-flat.glb',
  'car:delivery-flat': '/assets/cars/delivery-flat.glb',
  'car:race-future': '/assets/cars/race-future.glb',
  'wheel:racing': '/assets/cars/wheel-racing.glb',
  'wheel:dark': '/assets/cars/wheel-dark.glb',
  'wheel:truck': '/assets/cars/wheel-truck.glb',
  'debris:bumper': '/assets/debris/debris-bumper.glb',
  'debris:door': '/assets/debris/debris-door.glb',
  'debris:plate': '/assets/debris/debris-plate-a.glb',
  'debris:spoiler': '/assets/debris/debris-spoiler-a.glb',
  'debris:tire': '/assets/debris/debris-tire.glb',
  'prop:cone': '/assets/environment/cone.glb',
  'prop:box': '/assets/environment/box.glb',
  'ind:a': '/assets/environment/industrial/building-a.glb',
  'ind:c': '/assets/environment/industrial/building-c.glb',
  'ind:f': '/assets/environment/industrial/building-f.glb',
  'ind:l': '/assets/environment/industrial/building-l.glb',
  'ind:q': '/assets/environment/industrial/building-q.glb',
  'ind:t': '/assets/environment/industrial/building-t.glb',
  'ind:chimney': '/assets/environment/industrial/chimney-large.glb',
  'ind:tank': '/assets/environment/industrial/detail-tank.glb',
  'com:a': '/assets/environment/commercial/building-a.glb',
  'com:c': '/assets/environment/commercial/building-c.glb',
  'com:f': '/assets/environment/commercial/building-f.glb',
  'com:i': '/assets/environment/commercial/building-i.glb',
  'com:j': '/assets/environment/commercial/building-j.glb',
  'com:sky-a': '/assets/environment/commercial/building-skyscraper-a.glb',
  'com:sky-b': '/assets/environment/commercial/building-skyscraper-b.glb',
  'com:sky-c': '/assets/environment/commercial/building-skyscraper-c.glb',
};

const PERSON_SKINS = [
  '/assets/people/survivorFemaleA.png',
  '/assets/people/survivorMaleB.png',
  '/assets/people/zombieA.png',
  '/assets/people/zombieC.png',
];

export class ModelLibrary {
  constructor(renderer, enhancements = {}) {
    this.renderer = renderer;
    this.enhancements = enhancements;
    this.models = new Map();
    this.textures = [];
    this.gltf = new GLTFLoader();
    this.fbx = new FBXLoader();
    this.textureLoader = new THREE.TextureLoader();
    this.surfaceTextures = {};
  }

  async preload(onProgress = () => {}) {
    const entries = Object.entries(GLB_ASSETS);
    let done = 0;
    await Promise.all(entries.map(async ([key, path]) => {
      const asset = await this.gltf.loadAsync(path);
      this.models.set(key, asset.scene);
      onProgress(++done / (entries.length + 3));
    }));

    const [person, idle, run, ...skins] = await Promise.all([
      this.fbx.loadAsync('/assets/people/characterMedium.fbx'),
      this.fbx.loadAsync('/assets/people/idle.fbx'),
      this.fbx.loadAsync('/assets/people/run.fbx'),
      ...PERSON_SKINS.map(path => this.textureLoader.loadAsync(path)),
    ]);
    this.person = person;
    this.personAnimations = {
      idle: idle.animations.find(clip => /idle/i.test(clip.name)) || idle.animations[0],
      run: run.animations.find(clip => /run/i.test(clip.name)) || run.animations[0],
    };
    this.textures = skins;
    this.textures.forEach(texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    });
    if (this.enhancements.ground) {
      const [map, normalMap, roughnessMap] = await Promise.all([
        this.textureLoader.loadAsync('/assets/textures/worn-asphalt/diffuse.jpg'),
        this.textureLoader.loadAsync('/assets/textures/worn-asphalt/normal-gl.jpg'),
        this.textureLoader.loadAsync('/assets/textures/worn-asphalt/roughness.jpg'),
      ]);
      for (const texture of [map, normalMap, roughnessMap]) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(38, 38);
        texture.anisotropy = Math.min(12, this.renderer.capabilities.getMaxAnisotropy());
      }
      map.colorSpace = THREE.SRGBColorSpace;
      this.surfaceTextures = { map, normalMap, roughnessMap };
    }
    onProgress(1);
  }

  enhancedSurfaceMaterial(color, road = false) {
    if (!this.enhancements.ground || !this.surfaceTextures.map) return null;
    const material = new THREE.MeshStandardMaterial({color, ...this.surfaceTextures, roughness:.92, metalness:.02});
    material.normalScale.set(road ? .42 : .7, road ? .42 : .7);
    return material;
  }

  cloneAsset(key) {
    const source = this.models.get(key);
    if (!source) return new THREE.Group();
    const clone = SkeletonUtils.clone(source);
    clone.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      object.material = Array.isArray(object.material)
        ? object.material.map(material => material.clone())
        : object.material.clone();
    });
    return clone;
  }

  createCarVisual(carId, color, dimensions) {
    const group = new THREE.Group();
    const modelName = CAR_MODELS[carId] || 'sedan-sports';
    const body = this.cloneAsset(`car:${modelName}`);
    body.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(body);
    const size = bounds.getSize(new THREE.Vector3());
    const modelLength = Math.max(size.x, size.z) || 4;
    const scale = dimensions.length / modelLength;
    body.scale.setScalar(scale);
    body.rotation.y = size.x > size.z ? Math.PI / 2 : 0;
    body.position.y = -.48;
    const wheelNames = ['wheel-back-left', 'wheel-back-right', 'wheel-front-left', 'wheel-front-right'];
    const wheels = wheelNames.map(name => {
      const wheel = body.getObjectByName(name);
      if (!wheel) return null;
      const parent = wheel.parent;
      const pivot = new THREE.Group();
      pivot.name = `${name}-suspension`;
      pivot.position.copy(wheel.position);
      parent.add(pivot);
      parent.remove(wheel);
      wheel.position.set(0, 0, 0);
      pivot.add(wheel);
      pivot.userData.rollingMesh = wheel;
      pivot.userData.baseY = pivot.position.y;
      pivot.userData.baseRotationY = pivot.rotation.y;
      pivot.userData.baseRollX = wheel.rotation.x;
      pivot.userData.modelScale = scale;
      return pivot;
    }).filter(Boolean);
    body.traverse(object => {
      if (!object.isMesh) return;
      object.geometry = object.geometry.clone();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => {
        material.color?.lerp(new THREE.Color(color), .46);
        material.roughness = Math.min(.72, material.roughness ?? .55);
        material.metalness = Math.max(.18, material.metalness ?? .1);
        if (this.enhancements.cars) {
          material.roughness = Math.min(.42, material.roughness);
          material.metalness = Math.max(.32, material.metalness);
          if ('clearcoat' in material) { material.clearcoat=.72; material.clearcoatRoughness=.2; }
        }
      });
      const position = object.geometry.attributes.position;
      if (position && !object.name.startsWith('wheel-')) object.userData.pristinePositions = new Float32Array(position.array);
    });
    group.add(body);

    return { group, body, wheels };
  }

  createPerson(index) {
    const model = SkeletonUtils.clone(this.person);
    const texture = this.textures[index % this.textures.length];
    // Kenney's FBX is authored in centimetres. At .012 the character was over
    // three metres tall and its animated bounds regularly fell outside the
    // camera frustum. A human scale plus explicit skinned-mesh visibility keeps
    // the render pass and the shadow pass in agreement.
    model.scale.setScalar(.0059);
    model.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
      object.frustumCulled = false;
      object.material = object.material.clone();
      object.material.map = texture;
      object.material.color?.set(0xffffff);
      object.material.transparent = false;
      object.material.opacity = 1;
      object.material.depthWrite = true;
      if ('roughness' in object.material) object.material.roughness = .86;
      if ('metalness' in object.material) object.material.metalness = 0;
      if ('shininess' in object.material) object.material.shininess = 4;
      object.material.specular?.set(0x151515);
      if ('clearcoat' in object.material) object.material.clearcoat = 0;
      if (this.enhancements.people) {
        if ('roughness' in object.material) object.material.roughness=.68;
        object.material.emissive?.set(0x120907);
        if ('emissiveIntensity' in object.material) object.material.emissiveIntensity=.12;
      }
      object.material.needsUpdate = true;
    });
    let hips = null;
    model.traverse(object => { if (object.isBone && object.name === 'Hips') hips = object; });
    const hipsBasePosition = hips?.position.clone() || null;
    const mixer = new THREE.AnimationMixer(model);
    const idle = mixer.clipAction(this.personAnimations.idle);
    const run = mixer.clipAction(this.personAnimations.run);
    idle.setLoop(THREE.LoopRepeat, Infinity);
    run.setLoop(THREE.LoopRepeat, Infinity);
    idle.enabled = true;
    run.enabled = true;
    idle.time = Math.random() * Math.max(.01, this.personAnimations.idle.duration);
    run.timeScale = .92 + Math.random() * .2;
    idle.play();
    return { model, mixer, idle, run, hips, hipsBasePosition };
  }

  createEnvironment(levelId, index) {
    const industrial = ['ind:a', 'ind:c', 'ind:f', 'ind:l', 'ind:q', 'ind:t'];
    const commercial = ['com:a', 'com:c', 'com:f', 'com:i', 'com:j', 'com:sky-a', 'com:sky-b', 'com:sky-c'];
    const pool = levelId === 0 || levelId === 2 ? industrial : commercial;
    const model=this.cloneAsset(pool[index % pool.length]);
    if(this.enhancements.buildings)model.traverse(object=>{if(!object.isMesh)return;const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>{material.roughness=Math.min(.78,material.roughness??.8);material.metalness=Math.max(.08,material.metalness??0);if('envMapIntensity'in material)material.envMapIntensity=1.35;});});
    return model;
  }

  createDebris(index) {
    return this.cloneAsset(['debris:bumper', 'debris:door', 'debris:plate', 'debris:spoiler', 'debris:tire'][index % 5]);
  }
}
