import * as THREE from 'three';
import { RAPIER } from './physics.js';

export const AIR_BONUS_DEFINITIONS = Object.freeze({
  scrap: Object.freeze({ color:0xffd62e, accent:0xffffbc, label:'ВОЗДУШНАЯ ДОБЫЧА' }),
  nitro: Object.freeze({ color:0x18dfff, accent:0xc9fbff, label:'НИТРО-КАПСУЛА' }),
});

const _bonusOuterGeometry = new THREE.TorusGeometry(.78,.085,8,28);
const _bonusInnerGeometry = new THREE.TorusGeometry(.52,.035,6,22);
const _scrapGeometry = new THREE.IcosahedronGeometry(.34,0);
const _nitroGeometry = new THREE.OctahedronGeometry(.4,0);
const _bonusMaterials = new Map();

function bonusMaterials(type) {
  if (_bonusMaterials.has(type)) return _bonusMaterials.get(type);
  const definition=AIR_BONUS_DEFINITIONS[type]||AIR_BONUS_DEFINITIONS.scrap,materials={
    outer:new THREE.MeshBasicMaterial({color:definition.color,transparent:true,opacity:.86,depthWrite:false,blending:THREE.AdditiveBlending}),
    inner:new THREE.MeshBasicMaterial({color:definition.accent,transparent:true,opacity:.62,depthWrite:false,blending:THREE.AdditiveBlending}),
    core:new THREE.MeshStandardMaterial({color:definition.accent,emissive:definition.color,emissiveIntensity:3.2,roughness:.2,metalness:.58}),
  };
  _bonusMaterials.set(type,materials);return materials;
}

export function createAirBonusVisual(type='scrap') {
  const materials=bonusMaterials(type),root=new THREE.Group(),outer=new THREE.Mesh(_bonusOuterGeometry,materials.outer),inner=new THREE.Mesh(_bonusInnerGeometry,materials.inner),core=new THREE.Mesh(type==='nitro'?_nitroGeometry:_scrapGeometry,materials.core);
  if(type==='nitro')core.scale.set(.62,1.18,.52);
  inner.rotation.z=Math.PI*.25;root.add(outer,inner,core);root.userData={outer,inner,core,color:(AIR_BONUS_DEFINITIONS[type]||AIR_BONUS_DEFINITIONS.scrap).color};return root;
}

function rampVertices(width,length,height) {
  const x=width*.5,z=length*.5,bottom=-.11,frontTop=.075,backTop=frontTop+height;
  return new Float32Array([
    -x,bottom,-z, x,bottom,-z, -x,bottom,z, x,bottom,z,
    -x,frontTop,-z, x,frontTop,-z, -x,backTop,z, x,backTop,z,
  ]);
}

function rampGeometry(vertices) {
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(vertices.slice(),3));geometry.setIndex([
    0,1,2,1,3,2,
    4,6,5,5,6,7,
    0,4,1,1,4,5,
    2,3,6,3,7,6,
    0,2,4,4,2,6,
    1,5,3,5,7,3,
  ]);geometry.computeVertexNormals();return geometry;
}

export function createStuntRamp(world,scene,{position,direction,width=6,length=8.5,angle=.25,accent=0xffa126,major=false}) {
  const heading=direction.clone().setY(0).normalize(),yaw=Math.atan2(heading.x,heading.z),height=Math.tan(angle)*length,topHeight=.075+height,vertices=rampVertices(width,length,height),root=new THREE.Group();root.position.set(position.x,0,position.z);root.rotation.y=yaw;
  const deckMaterial=new THREE.MeshStandardMaterial({color:major?0x32251d:0x252a28,roughness:.48,metalness:.74,flatShading:true}),accentMaterial=new THREE.MeshStandardMaterial({color:accent,emissive:accent,emissiveIntensity:major?2.5:1.5,roughness:.3,metalness:.68}),darkMaterial=new THREE.MeshStandardMaterial({color:0x101312,roughness:.66,metalness:.72}),deck=new THREE.Mesh(rampGeometry(vertices),deckMaterial);deck.castShadow=true;deck.receiveShadow=true;root.add(deck);
  const slopeLength=Math.hypot(length,height),slopeAngle=Math.atan2(height,length),slopeCenterY=.075+height*.5;
  for(let i=0;i<5;i++){const t=.12+i*.19,stripe=new THREE.Mesh(new THREE.BoxGeometry(width*.82,.028,.34),i%2?darkMaterial:accentMaterial);stripe.position.set(0,.075+height*t+.026,THREE.MathUtils.lerp(-length*.5,length*.5,t));stripe.rotation.x=-slopeAngle;root.add(stripe);}
  for(const side of[-1,1]){const rail=new THREE.Mesh(new THREE.BoxGeometry(.16,.22,slopeLength),accentMaterial);rail.position.set(side*(width*.5-.11),slopeCenterY+.13,0);rail.rotation.x=-slopeAngle;rail.castShadow=true;root.add(rail);const brace=new THREE.Mesh(new THREE.BoxGeometry(.18,Math.max(.3,topHeight*.72),.18),darkMaterial);brace.position.set(side*(width*.5-.16),topHeight*.36,length*.42);brace.castShadow=true;root.add(brace);}
  const lip=new THREE.Mesh(new THREE.BoxGeometry(width+.18,.16,.22),accentMaterial);lip.position.set(0,topHeight+.02,length*.5-.04);lip.rotation.x=-slopeAngle;lip.castShadow=true;root.add(lip);
  if(major){const radius=width*.46,arch=new THREE.Mesh(new THREE.TorusGeometry(radius,.075,7,30,Math.PI),accentMaterial);arch.position.set(0,topHeight+.55,length*.5+.08);arch.castShadow=true;root.add(arch);for(const side of[-1,1]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.075,.11,.95,8),accentMaterial);post.position.set(side*radius,topHeight+.08,length*.5+.08);post.castShadow=true;root.add(post);}}
  else for(const side of[-1,1]){const beacon=new THREE.Mesh(new THREE.SphereGeometry(.13,9,7),accentMaterial);beacon.position.set(side*(width*.5-.15),topHeight+.24,length*.5-.1);root.add(beacon);}
  scene.add(root);
  const bodyRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),body=world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x,0,position.z).setRotation(bodyRotation)),colliderDesc=RAPIER.ColliderDesc.convexHull(vertices);if(!colliderDesc)throw new Error('Не удалось создать коллайдер трамплина');const collider=world.createCollider(colliderDesc.setFriction(1.35).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Max).setRestitution(.01),body);collider.userData={type:'ramp'};
  const takeoff=position.clone().addScaledVector(heading,length*.5);takeoff.y=topHeight;return{visual:root,body,collider,position:position.clone(),direction:heading,width,length,angle,height,topHeight,takeoff,major,yaw};
}
