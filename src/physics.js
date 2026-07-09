import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export function createPhysicsWorld() {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  world.timestep = 1 / 60;
  const eventQueue = new RAPIER.EventQueue(true);
  return { world, eventQueue };
}

export function createArenaColliders(world) {
  const ground = world.createCollider(
    RAPIER.ColliderDesc.cuboid(130, .12, 130)
      .setTranslation(0, -.12, 0)
      .setFriction(1.35)
      .setRestitution(.02),
  );
  ground.userData = { type: 'ground' };

  const walls = [
    [0, 2, -69, 84, 2, 1], [0, 2, 69, 84, 2, 1],
    [-84, 2, 0, 1, 2, 69], [84, 2, 0, 1, 2, 69],
  ];
  walls.forEach(([x, y, z, hx, hy, hz]) => {
    const collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setTranslation(x, y, z)
        .setFriction(.8)
        .setRestitution(.08),
    );
    collider.userData = { type: 'barrier' };
  });
}

export function createVehicle(world, visual, options) {
  const yaw = options.yaw || 0;
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(options.position.x, options.position.y, options.position.z)
      .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) })
      .setLinearDamping(.12)
      .setAngularDamping(.62)
      .setCcdEnabled(true)
      .setCanSleep(false),
  );
  body.setEnabledTranslations(true, true, true, true);
  body.setEnabledRotations(true, true, true, true);

  const collider = world.createCollider(
    RAPIER.ColliderDesc.roundCuboid(options.width * .48, options.height * .34, options.length * .47, .1)
      .setTranslation(0, .1, 0)
      .setFriction(.66)
      .setRestitution(.06)
      .setMass(options.mass)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS | RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setContactForceEventThreshold(1800),
    body,
  );

  const controller = world.createVehicleController(body);
  controller.indexUpAxis = 1;
  controller.setIndexForwardAxis = 2;
  const wheelX = options.width * .47;
  const wheelZ = options.wheelBase;
  // Keep the suspension hard-points above the chassis bottom. If these are too low,
  // the springs collapse to zero travel after the first acceleration and traction dies.
  const wheelY = .08;
  const wheelPoints = [
    { x: -wheelX, y: wheelY, z: -wheelZ },
    { x:  wheelX, y: wheelY, z: -wheelZ },
    { x: -wheelX, y: wheelY, z:  wheelZ },
    { x:  wheelX, y: wheelY, z:  wheelZ },
  ];
  wheelPoints.forEach(point => controller.addWheel(point, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, .38, options.wheelRadius));
  for (let i = 0; i < 4; i++) {
    controller.setWheelSuspensionStiffness(i, 46);
    controller.setWheelSuspensionCompression(i, 6.1);
    controller.setWheelSuspensionRelaxation(i, 7.2);
    controller.setWheelMaxSuspensionTravel(i, .5);
    controller.setWheelMaxSuspensionForce(i, options.mass * 18);
    controller.setWheelFrictionSlip(i, 3.35);
    controller.setWheelSideFrictionStiffness(i, 1.45);
  }

  const vehicle = {
    body,
    collider,
    controller,
    visual,
    dimensions: options,
    steer: 0,
    throttle: 0,
    brake: 0,
    maxSpeed: options.maxSpeed,
    engineForce: options.engineForce,
    reverseForce: options.engineForce * .62,
  };
  collider.userData = { type: 'vehicle', vehicle };
  return vehicle;
}

export function driveVehicle(vehicle, input, dt) {
  const { controller, body } = vehicle;
  const speed = controller.currentVehicleSpeed();
  const targetSteer = THREE.MathUtils.clamp(input.steer, -1, 1) * (.52 - Math.min(.25, Math.abs(speed) * .008));
  vehicle.steer = THREE.MathUtils.damp(vehicle.steer, targetSteer, 7.5, dt);
  vehicle.throttle = THREE.MathUtils.damp(vehicle.throttle, input.throttle, 5.5, dt);
  vehicle.brake = THREE.MathUtils.damp(vehicle.brake, input.brake || 0, 10, dt);

  const speedRatio = Math.min(1, Math.abs(speed) / vehicle.maxSpeed);
  let engine = vehicle.throttle >= 0 ? vehicle.engineForce : vehicle.reverseForce;
  engine *= vehicle.throttle * (1 - speedRatio * .72);
  if (input.boost) engine *= 1.62;
  if (Math.abs(speed) > vehicle.maxSpeed * (input.boost ? 1.28 : 1) && Math.sign(engine) === Math.sign(speed)) engine = 0;

  for (let i = 0; i < 4; i++) {
    controller.setWheelEngineForce(i, engine * (i < 2 ? .58 : .42));
    controller.setWheelBrake(i, vehicle.brake * (i < 2 ? 5.5 : 7.5));
  }
  controller.setWheelSteering(2, vehicle.steer);
  controller.setWheelSteering(3, vehicle.steer);
  controller.updateVehicle(dt, undefined, undefined, collider => collider.handle !== vehicle.collider.handle);

  // Aerodynamic stability: downforce grows with speed without cancelling impacts.
  const downforce = Math.min(22000, speed * speed * 20);
  body.applyImpulse({ x: 0, y: -downforce * dt, z: 0 }, true);
}

export function syncVehicle(vehicle) {
  const position = vehicle.body.translation();
  const rotation = vehicle.body.rotation();
  vehicle.visual.group.position.set(position.x, position.y, position.z);
  vehicle.visual.group.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
  vehicle.visual.wheels.forEach((pivot, index) => {
    const length = vehicle.controller.wheelSuspensionLength(index);
    if (length != null) pivot.position.y = pivot.userData.baseY - (length - .38) / (pivot.userData.modelScale || 1);
    pivot.rotation.y = (pivot.userData.baseRotationY || 0) + (index >= 2 ? vehicle.steer : 0);
    const rolling = pivot.userData.rollingMesh;
    if (rolling) rolling.rotation.x = (pivot.userData.baseRollX || 0) + (vehicle.controller.wheelRotation(index) || 0);
  });
}

export function forwardVector(body, target = new THREE.Vector3()) {
  const rotation = body.rotation();
  return target.set(0, 0, 1).applyQuaternion(_quat.set(rotation.x, rotation.y, rotation.z, rotation.w));
}

export function createRagdoll(world, scene, position, impulse, colors) {
  const skin = new THREE.MeshStandardMaterial({ color: colors.skin, roughness: .72 });
  const cloth = new THREE.MeshStandardMaterial({ color: colors.cloth, roughness: .78 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1e2225, roughness: .82 });
  const pieces = [];

  const definitions = [
    { name: 'torso', shape: 'capsule', pos: [0, 1.18, 0], half: .34, radius: .25, material: cloth, mass: 9 },
    { name: 'head', shape: 'ball', pos: [0, 1.88, 0], radius: .22, material: skin, mass: 3 },
    { name: 'pelvis', shape: 'box', pos: [0, .78, 0], halfExtents: [.25, .16, .17], material: cloth, mass: 7 },
    { name: 'armL', shape: 'capsule', pos: [-.36, 1.13, 0], half: .27, radius: .075, material: skin, mass: 2 },
    { name: 'armR', shape: 'capsule', pos: [.36, 1.13, 0], half: .27, radius: .075, material: skin, mass: 2 },
    { name: 'legL', shape: 'capsule', pos: [-.14, .34, 0], half: .36, radius: .09, material: dark, mass: 4 },
    { name: 'legR', shape: 'capsule', pos: [.14, .34, 0], half: .36, radius: .09, material: dark, mass: 4 },
  ];

  const byName = {};
  definitions.forEach((def, index) => {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(def.rot || [0, 0, 0])));
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x + def.pos[0], position.y + def.pos[1], position.z + def.pos[2])
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setLinearDamping(.18)
        .setAngularDamping(.16)
        .setCcdEnabled(true),
    );
    let colliderDesc;
    let geometry;
    if (def.shape === 'ball') {
      colliderDesc = RAPIER.ColliderDesc.ball(def.radius);
      geometry = new THREE.SphereGeometry(def.radius, 14, 10);
    } else if (def.shape === 'box') {
      colliderDesc = RAPIER.ColliderDesc.roundCuboid(...def.halfExtents, .06);
      geometry = new THREE.BoxGeometry(def.halfExtents[0] * 2, def.halfExtents[1] * 2, def.halfExtents[2] * 2, 2, 2, 2);
    } else {
      colliderDesc = RAPIER.ColliderDesc.capsule(def.half, def.radius);
      geometry = new THREE.CapsuleGeometry(def.radius, def.half * 2, 5, 10);
    }
    world.createCollider(colliderDesc.setMass(def.mass).setFriction(.76).setRestitution(.08).setCollisionGroups(0x00020001), body);
    const mesh = new THREE.Mesh(geometry, def.material);
    mesh.castShadow = true;
    scene.add(mesh);
    const piece = { body, mesh, name: def.name, center: new THREE.Vector3(...def.pos), born: performance.now() };
    pieces.push(piece);
    byName[def.name] = piece;
    body.applyImpulse({ x: impulse.x * (1 + index * .025), y: impulse.y + Math.random() * 2, z: impulse.z * (1 + index * .025) }, true);
    body.applyTorqueImpulse({ x: (Math.random() - .5) * 8, y: (Math.random() - .5) * 5, z: (Math.random() - .5) * 8 }, true);
  });

  const joint = (a, b, worldAnchor) => {const anchor=new THREE.Vector3(...worldAnchor),anchorA=anchor.clone().sub(byName[a].center),anchorB=anchor.clone().sub(byName[b].center);world.createImpulseJoint(RAPIER.JointData.spherical(anchorA,anchorB),byName[a].body,byName[b].body,true);};
  joint('torso', 'head', [0, 1.66, 0]);
  joint('torso', 'pelvis', [0, .89, 0]);
  joint('torso', 'armL', [-.27, 1.39, 0]);
  joint('torso', 'armR', [.27, 1.39, 0]);
  joint('pelvis', 'legL', [-.14, .66, 0]);
  joint('pelvis', 'legR', [.14, .66, 0]);
  return pieces;
}

export function syncRagdoll(pieces) {
  pieces.forEach(piece => {
    const p = piece.body.translation();
    const r = piece.body.rotation();
    piece.mesh.position.set(p.x, p.y, p.z);
    piece.mesh.quaternion.set(r.x, r.y, r.z, r.w);
  });
}

const _quat = new THREE.Quaternion();
export { RAPIER };
