import * as THREE from 'three';
import { Soldier, SoldierAnimation, TeamColor, WeaponType } from '../types/game';
import { TEAM_COLORS } from '../constants/boardData';

export interface SoldierRig {
  id: string;
  team: TeamColor;
  root: THREE.Group;
  pelvis: THREE.Group;
  torso: THREE.Group;
  headGroup: THREE.Group;
  leftShoulder: THREE.Group;
  leftForearm: THREE.Group;
  rightShoulder: THREE.Group;
  rightForearm: THREE.Group;
  weaponMount: THREE.Group;
  leftThigh: THREE.Group;
  leftShin: THREE.Group;
  rightThigh: THREE.Group;
  rightShin: THREE.Group;
  muzzleFlash: THREE.Mesh;
  selectionRing: THREE.Mesh;
  targetRing: THREE.Mesh;
  shieldDome: THREE.Mesh;
  hpBarFill: THREE.Mesh;
  armorBarFill: THREE.Mesh;
  weaponMeshes: Record<WeaponType, THREE.Group>;
  activeWeapon: WeaponType;
  jetpackGroup: THREE.Group;
  thrusterFlame1: THREE.Mesh;
  thrusterFlame2: THREE.Mesh;
}

// Shared geometries for high performance across 16 soldiers
const sharedGeos = {
  torso: new THREE.BoxGeometry(0.42, 0.48, 0.24),
  vest: new THREE.BoxGeometry(0.45, 0.38, 0.28),
  pouch: new THREE.BoxGeometry(0.09, 0.13, 0.06),
  backpack: new THREE.BoxGeometry(0.32, 0.38, 0.16),
  head: new THREE.SphereGeometry(0.155, 16, 16),
  mask: new THREE.CylinderGeometry(0.158, 0.145, 0.14, 16),
  goggles: new THREE.BoxGeometry(0.24, 0.065, 0.08),
  capCrown: new THREE.SphereGeometry(0.165, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
  capVisor: new THREE.BoxGeometry(0.24, 0.025, 0.16),
  limbUpper: new THREE.CapsuleGeometry(0.068, 0.22, 6, 10),
  limbLower: new THREE.CapsuleGeometry(0.058, 0.22, 6, 10),
  kneePad: new THREE.BoxGeometry(0.13, 0.11, 0.14),
  boot: new THREE.BoxGeometry(0.13, 0.1, 0.24),
  contactShadow: new THREE.CircleGeometry(0.44, 24),
  ring: new THREE.RingGeometry(0.42, 0.54, 28),
  shieldSphere: new THREE.SphereGeometry(0.75, 20, 16),
  hpBg: new THREE.PlaneGeometry(0.72, 0.09),
  hpFg: new THREE.PlaneGeometry(0.7, 0.065),
};

function buildWeaponGroup(type: WeaponType): THREE.Group {
  const group = new THREE.Group();
  const gunMetal = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.28,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x92400e,
    metalness: 0.15,
    roughness: 0.65,
  });
  const goldAccent = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    metalness: 0.9,
    roughness: 0.2,
  });

  if (type === 'ak47') {
    // Receiver
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.09, 0.34), gunMetal);
    receiver.position.set(0, 0, 0.08);
    group.add(receiver);

    // Wooden Handguard
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.22), woodMat);
    handguard.position.set(0, 0.005, 0.34);
    group.add(handguard);

    // Rifled Barrel & Front Sight
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.016, 0.32, 8),
      gunMetal,
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.54);
    group.add(barrel);

    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.02), gunMetal);
    sight.position.set(0, 0.05, 0.65);
    group.add(sight);

    // Wooden Buttstock
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.11, 0.24), woodMat);
    stock.position.set(0, -0.02, -0.18);
    stock.rotation.x = 0.12;
    group.add(stock);

    // Curved Banana Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.19, 0.075), gunMetal);
    mag.position.set(0, -0.11, 0.18);
    mag.rotation.x = 0.28;
    group.add(mag);
  } else if (type === 'pistol') {
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.22), gunMetal);
    slide.position.set(0, 0.02, 0.12);
    group.add(slide);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.06), gunMetal);
    grip.position.set(0, -0.05, 0.04);
    grip.rotation.x = -0.2;
    group.add(grip);
  } else if (type === 'shotgun') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.09, 0.42), gunMetal);
    body.position.set(0, 0, 0.15);
    group.add(body);
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.22, 10), woodMat);
    pump.rotation.x = Math.PI / 2;
    pump.position.set(0, -0.02, 0.38);
    group.add(pump);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.45, 10), gunMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.025, 0.48);
    group.add(barrel);
  } else {
    // Sniper Rifle
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.085, 0.52), goldAccent);
    chassis.position.set(0, 0, 0.18);
    group.add(chassis);
    const longBarrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.022, 0.56, 10),
      gunMetal,
    );
    longBarrel.rotation.x = Math.PI / 2;
    longBarrel.position.set(0, 0.02, 0.62);
    group.add(longBarrel);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.24, 12), gunMetal);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.08, 0.2);
    group.add(scope);
  }

  return group;
}

export function createSoldierRig(id: string, team: TeamColor): SoldierRig {
  const palette = TEAM_COLORS[team];
  const root = new THREE.Group();
  root.name = `soldier_${id}`;

  const uniformMat = new THREE.MeshStandardMaterial({
    color: palette.threeColor,
    roughness: 0.55,
    metalness: 0.15,
  });

  const vestMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.42,
    metalness: 0.45,
  });

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd6a374,
    roughness: 0.65,
    metalness: 0.05,
  });

  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.15,
    metalness: 0.9,
  });

  // 1. Contact Shadow & Selection Rings on Ground
  const shadowMesh = new THREE.Mesh(
    sharedGeos.contactShadow,
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    }),
  );
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.02;
  root.add(shadowMesh);

  const selectionRing = new THREE.Mesh(
    sharedGeos.ring,
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  );
  selectionRing.rotation.x = -Math.PI / 2;
  selectionRing.position.y = 0.04;
  selectionRing.visible = false;
  root.add(selectionRing);

  const targetRing = new THREE.Mesh(
    sharedGeos.ring,
    new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    }),
  );
  targetRing.rotation.x = -Math.PI / 2;
  targetRing.position.y = 0.05;
  targetRing.scale.setScalar(1.18);
  targetRing.visible = false;
  root.add(targetRing);

  // Energy Shield Dome
  const shieldDome = new THREE.Mesh(
    sharedGeos.shieldSphere,
    new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.28,
      roughness: 0.1,
      metalness: 0.2,
      depthWrite: false,
    }),
  );
  shieldDome.position.y = 0.72;
  shieldDome.visible = false;
  root.add(shieldDome);

  // 2. Pelvis & Articulated Legs
  const pelvis = new THREE.Group();
  pelvis.position.set(0, 0.62, 0);
  root.add(pelvis);

  const createLeg = (isLeft: boolean) => {
    const xSign = isLeft ? -1 : 1;
    const thigh = new THREE.Group();
    thigh.position.set(xSign * 0.115, 0, 0);

    const thighMesh = new THREE.Mesh(sharedGeos.limbUpper, uniformMat);
    thighMesh.position.y = -0.14;
    thighMesh.castShadow = true;
    thigh.add(thighMesh);

    const shin = new THREE.Group();
    shin.position.set(0, -0.28, 0);
    thigh.add(shin);

    const shinMesh = new THREE.Mesh(sharedGeos.limbLower, uniformMat);
    shinMesh.position.y = -0.14;
    shinMesh.castShadow = true;
    shin.add(shinMesh);

    // Tactical Knee Pad
    const kneePad = new THREE.Mesh(sharedGeos.kneePad, vestMat);
    kneePad.position.set(0, -0.02, 0.03);
    shin.add(kneePad);

    // Combat Sneaker / Boot
    const boot = new THREE.Mesh(sharedGeos.boot, vestMat);
    boot.position.set(0, -0.29, 0.04);
    boot.castShadow = true;
    shin.add(boot);

    pelvis.add(thigh);
    return { thigh, shin };
  };

  const leftLeg = createLeg(true);
  const rightLeg = createLeg(false);

  // 3. Torso, Tactical Vest, Pouches & Backpack
  const torso = new THREE.Group();
  torso.position.set(0, 0.04, 0);
  pelvis.add(torso);

  const torsoMesh = new THREE.Mesh(sharedGeos.torso, uniformMat);
  torsoMesh.position.y = 0.24;
  torsoMesh.castShadow = true;
  torso.add(torsoMesh);

  const vestMesh = new THREE.Mesh(sharedGeos.vest, vestMat);
  vestMesh.position.y = 0.25;
  vestMesh.castShadow = true;
  torso.add(vestMesh);

  for (let p = -1; p <= 1; p++) {
    const pouch = new THREE.Mesh(sharedGeos.pouch, uniformMat);
    pouch.position.set(p * 0.12, 0.18, 0.15);
    torso.add(pouch);
  }

  const backpack = new THREE.Mesh(sharedGeos.backpack, vestMat);
  backpack.position.set(0, 0.26, -0.18);
  backpack.castShadow = true;
  torso.add(backpack);

  // 4. Head, Face Mask, Goggles & Team Tactical Cap
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.52, 0);
  torso.add(headGroup);

  const headMesh = new THREE.Mesh(sharedGeos.head, skinMat);
  headMesh.position.y = 0.14;
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  const faceMask = new THREE.Mesh(sharedGeos.mask, vestMat);
  faceMask.position.set(0, 0.09, 0.01);
  headGroup.add(faceMask);

  const goggles = new THREE.Mesh(sharedGeos.goggles, visorMat);
  goggles.position.set(0, 0.17, 0.13);
  headGroup.add(goggles);

  const capCrown = new THREE.Mesh(sharedGeos.capCrown, uniformMat);
  capCrown.position.set(0, 0.15, 0);
  capCrown.castShadow = true;
  headGroup.add(capCrown);

  const capVisor = new THREE.Mesh(sharedGeos.capVisor, uniformMat);
  capVisor.position.set(0, 0.21, 0.15);
  capVisor.rotation.x = 0.12;
  headGroup.add(capVisor);

  // 5. Articulated Arms & Weapon Mount
  const createArm = (isLeft: boolean) => {
    const xSign = isLeft ? -1 : 1;
    const shoulder = new THREE.Group();
    shoulder.position.set(xSign * 0.27, 0.42, 0);

    const upperArm = new THREE.Mesh(sharedGeos.limbUpper, uniformMat);
    upperArm.position.y = -0.12;
    upperArm.castShadow = true;
    shoulder.add(upperArm);

    const forearm = new THREE.Group();
    forearm.position.set(0, -0.24, 0);
    shoulder.add(forearm);

    const lowerArm = new THREE.Mesh(sharedGeos.limbLower, vestMat);
    lowerArm.position.y = -0.12;
    lowerArm.castShadow = true;
    forearm.add(lowerArm);

    torso.add(shoulder);
    return { shoulder, forearm };
  };

  const leftArm = createArm(true);
  const rightArm = createArm(false);

  // Weapon Mount attached to right forearm
  const weaponMount = new THREE.Group();
  weaponMount.position.set(-0.06, -0.22, 0.08);
  rightArm.forearm.add(weaponMount);

  const weaponMeshes: Record<WeaponType, THREE.Group> = {
    ak47: buildWeaponGroup('ak47'),
    pistol: buildWeaponGroup('pistol'),
    shotgun: buildWeaponGroup('shotgun'),
    sniper: buildWeaponGroup('sniper'),
  };

  Object.entries(weaponMeshes).forEach(([k, grp]) => {
    grp.visible = k === 'ak47';
    weaponMount.add(grp);
  });

  // Muzzle Flash Cone
  const muzzleFlash = new THREE.Mesh(
    new THREE.ConeGeometry(0.09, 0.32, 8),
    new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.95,
    }),
  );
  muzzleFlash.rotation.x = Math.PI / 2;
  muzzleFlash.position.set(0, 0.02, 0.78);
  muzzleFlash.visible = false;
  weaponMount.add(muzzleFlash);

  // 6. Floating Overhead HP & Armor Bar
  const hpGroup = new THREE.Group();
  hpGroup.position.set(0, 1.65, 0);
  root.add(hpGroup);

  const hpBg = new THREE.Mesh(
    sharedGeos.hpBg,
    new THREE.MeshBasicMaterial({ color: 0x090d16, side: THREE.DoubleSide }),
  );
  hpGroup.add(hpBg);

  const hpBarFill = new THREE.Mesh(
    sharedGeos.hpFg,
    new THREE.MeshBasicMaterial({ color: 0x22c55e, side: THREE.DoubleSide }),
  );
  hpBarFill.position.z = 0.005;
  hpGroup.add(hpBarFill);

  const armorBarFill = new THREE.Mesh(
    sharedGeos.hpFg,
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide }),
  );
  armorBarFill.position.set(0, 0.06, 0.006);
  armorBarFill.scale.y = 0.55;
  armorBarFill.visible = false;
  hpGroup.add(armorBarFill);

  // Invisible simplified collision box on Layer 1 for fast raycasting
  const hitBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 1.5, 0.65),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  hitBox.position.y = 0.75;
  hitBox.userData = { soldierId: id, team };
  root.add(hitBox);

  // Airborne Jetpack with Glider Wings & Dual Thrusters for Sky Warzone Mode
  const jetpackGroup = new THREE.Group();
  jetpackGroup.position.set(0, 0.28, -0.22);
  torso.add(jetpackGroup);

  const jetEngineMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.9,
    roughness: 0.25,
  });
  const wingMat = new THREE.MeshStandardMaterial({
    color: palette.threeColor,
    metalness: 0.6,
    roughness: 0.3,
  });
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.9,
  });

  const eng1 = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 0.32, 10), jetEngineMat);
  eng1.position.x = -0.13;
  jetpackGroup.add(eng1);

  const eng2 = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.08, 0.32, 10), jetEngineMat);
  eng2.position.x = 0.13;
  jetpackGroup.add(eng2);

  const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.14), wingMat);
  leftWing.position.set(-0.32, 0.05, 0);
  leftWing.rotation.z = -0.15;
  jetpackGroup.add(leftWing);

  const rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.14), wingMat);
  rightWing.position.set(0.32, 0.05, 0);
  rightWing.rotation.z = 0.15;
  jetpackGroup.add(rightWing);

  const thrusterFlame1 = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.22, 8), flameMat);
  thrusterFlame1.rotation.x = Math.PI;
  thrusterFlame1.position.set(-0.13, -0.24, 0);
  jetpackGroup.add(thrusterFlame1);

  const thrusterFlame2 = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.22, 8), flameMat);
  thrusterFlame2.rotation.x = Math.PI;
  thrusterFlame2.position.set(0.13, -0.24, 0);
  jetpackGroup.add(thrusterFlame2);

  jetpackGroup.visible = false;

  return {
    id,
    team,
    root,
    pelvis,
    torso,
    headGroup,
    leftShoulder: leftArm.shoulder,
    leftForearm: leftArm.forearm,
    rightShoulder: rightArm.shoulder,
    rightForearm: rightArm.forearm,
    weaponMount,
    leftThigh: leftLeg.thigh,
    leftShin: leftLeg.shin,
    rightThigh: rightLeg.thigh,
    rightShin: rightLeg.shin,
    muzzleFlash,
    selectionRing,
    targetRing,
    shieldDome,
    hpBarFill,
    armorBarFill,
    weaponMeshes,
    activeWeapon: 'ak47',
    jetpackGroup,
    thrusterFlame1,
    thrusterFlame2,
  };
}

/**
 * Smoothly blends all 12 procedural skeletal animations and interpolates board movement.
 */
export function updateSoldierRig(
  rig: SoldierRig,
  soldier: Soldier,
  elapsed: number,
  dt: number,
  isSelected: boolean,
  isValidMove: boolean,
  isTargetable: boolean,
  cameraPosition: THREE.Vector3,
  previewOverride?: { anim: SoldierAnimation; weapon: WeaponType },
) {
  const damp = (cur: number, target: number, lambda = 12) =>
    THREE.MathUtils.damp(cur, target, lambda, dt);

  // Switch active weapon mesh if changed
  const desiredWeapon = previewOverride ? previewOverride.weapon : soldier.weapon;
  if (rig.activeWeapon !== desiredWeapon) {
    rig.weaponMeshes[rig.activeWeapon].visible = false;
    rig.weaponMeshes[desiredWeapon].visible = true;
    rig.activeWeapon = desiredWeapon;
  }

  // Advance waypoint movement smoothly
  let isMoving = false;
  if (!previewOverride) {
    const nextTarget =
      soldier.waypoints.length > 0 ? soldier.waypoints[0] : soldier.targetWorldPos;
    const dx = nextTarget.x - soldier.worldPos.x;
    const dz = nextTarget.z - soldier.worldPos.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.03) {
      isMoving = true;
      const moveSpeed = 6.8;
      const step = Math.min(dist, moveSpeed * dt);
      soldier.worldPos.x += (dx / dist) * step;
      soldier.worldPos.z += (dz / dist) * step;
      soldier.worldPos.y =
        nextTarget.y + Math.abs(Math.sin(elapsed * 14)) * 0.14;
      soldier.rotationY = Math.atan2(dx, dz);
    } else {
      soldier.worldPos.x = nextTarget.x;
      soldier.worldPos.z = nextTarget.z;
      soldier.worldPos.y = nextTarget.y;
      if (soldier.waypoints.length > 0) {
        soldier.waypoints.shift();
      }
    }

    rig.root.position.set(soldier.worldPos.x, soldier.worldPos.y, soldier.worldPos.z);

    // Smooth yaw rotation
    const rotDiff =
      Math.atan2(
        Math.sin(soldier.rotationY - rig.root.rotation.y),
        Math.cos(soldier.rotationY - rig.root.rotation.y),
      );
    rig.root.rotation.y += rotDiff * Math.min(1, dt * 12);

    // Decrement one-shot animation timer
    if (soldier.animTimer > 0) {
      soldier.animTimer = Math.max(0, soldier.animTimer - dt);
      if (soldier.animTimer === 0 && soldier.state !== 'dead') {
        soldier.animState = 'idle';
      }
    }
  }

  const anim: SoldierAnimation = previewOverride
    ? previewOverride.anim
    : soldier.state === 'dead'
      ? 'death'
      : isMoving
        ? 'run'
        : soldier.animState;

  // Selection & Target Rings
  rig.selectionRing.visible = isSelected || isValidMove;
  if (rig.selectionRing.visible) {
    const mat = rig.selectionRing.material as THREE.MeshBasicMaterial;
    mat.color.setHex(isValidMove ? 0x4ade80 : 0x38bdf8);
    rig.selectionRing.rotation.z = elapsed * 2.2;
  }

  rig.targetRing.visible = isTargetable;
  if (isTargetable) {
    rig.targetRing.rotation.z = -elapsed * 3.0;
  }

  rig.shieldDome.visible = soldier.shieldTurns > 0 && soldier.state !== 'dead';

  // Airborne Jetpack Thrusters & Wings Animation (Sky Warzone)
  const isFlying = Boolean(soldier.isFlying) && soldier.state !== 'dead';
  rig.jetpackGroup.visible = isFlying;
  if (isFlying) {
    const pulse = 1 + Math.sin(elapsed * 22) * 0.28;
    rig.thrusterFlame1.scale.set(1, pulse, 1);
    rig.thrusterFlame2.scale.set(1, pulse, 1);
  }

  // Update HP & Armor bars to face camera
  const hpGroup = rig.hpBarFill.parent;
  if (hpGroup) {
    hpGroup.visible = soldier.state !== 'dead' && !previewOverride;
    hpGroup.lookAt(cameraPosition);
    const hpRatio = Math.max(0.001, soldier.hp / soldier.maxHp);
    rig.hpBarFill.scale.x = hpRatio;
    rig.hpBarFill.position.x = -(1 - hpRatio) * 0.35;
    (rig.hpBarFill.material as THREE.MeshBasicMaterial).color.setHex(
      hpRatio > 0.5 ? 0x22c55e : hpRatio > 0.25 ? 0xfacc15 : 0xef4444,
    );

    if (soldier.armor > 0) {
      rig.armorBarFill.visible = true;
      const armorRatio = Math.max(0.001, soldier.armor / soldier.maxArmor);
      rig.armorBarFill.scale.x = armorRatio;
      rig.armorBarFill.position.x = -(1 - armorRatio) * 0.35;
    } else {
      rig.armorBarFill.visible = false;
    }
  }

  // Target joint angles for the 12 animations
  let pelvisY = 0.62;
  let pelvisRotX = 0;
  let pelvisRotZ = 0;
  let torsoRotX = 0;
  let torsoRotY = 0;
  let headRotX = 0;
  let headRotY = 0;

  // Default tactical rifle ready pose (holding AK-47 across chest)
  let rShoulderX = -0.65;
  let rShoulderY = -0.25;
  let rShoulderZ = 0;
  let rForearmX = -0.85;

  let lShoulderX = -0.75;
  let lShoulderY = 0.45;
  let lShoulderZ = 0;
  let lForearmX = -0.75;

  let lThighX = 0;
  let lShinX = 0;
  let rThighX = 0;
  let rShinX = 0;

  rig.muzzleFlash.visible = false;

  const t = elapsed;

  switch (anim) {
    case 'idle': {
      pelvisY = 0.62 + Math.sin(t * 2.5) * 0.012;
      torsoRotX = Math.sin(t * 2.5) * 0.03;
      headRotY = Math.sin(t * 1.2) * 0.14;
      rShoulderX = -0.62 + Math.sin(t * 2.5) * 0.03;
      lShoulderX = -0.72 + Math.sin(t * 2.5) * 0.03;
      break;
    }
    case 'walk': {
      const w = t * 8;
      pelvisY = 0.62 + Math.abs(Math.sin(w)) * 0.035;
      torsoRotX = 0.08;
      torsoRotY = Math.sin(w) * 0.08;
      lThighX = Math.sin(w) * 0.52;
      rThighX = -Math.sin(w) * 0.52;
      lShinX = Math.max(0, -Math.cos(w) * 0.45);
      rShinX = Math.max(0, Math.cos(w) * 0.45);
      rShoulderX = -0.7 + Math.sin(w) * 0.12;
      lShoulderX = -0.75 - Math.sin(w) * 0.12;
      break;
    }
    case 'run': {
      const r = t * 13;
      pelvisY = 0.63 + Math.abs(Math.sin(r)) * 0.06;
      torsoRotX = 0.22;
      torsoRotY = Math.sin(r) * 0.14;
      lThighX = Math.sin(r) * 0.82;
      rThighX = -Math.sin(r) * 0.82;
      lShinX = Math.max(0, -Math.cos(r) * 0.75);
      rShinX = Math.max(0, Math.cos(r) * 0.75);
      rShoulderX = -0.82 + Math.sin(r) * 0.18;
      lShoulderX = -0.85 - Math.sin(r) * 0.18;
      break;
    }
    case 'aim': {
      torsoRotX = 0.06;
      torsoRotY = -0.22;
      headRotX = 0.08;
      headRotY = 0.2;
      rShoulderX = -1.35;
      rShoulderY = -0.12;
      rForearmX = -0.35;
      lShoulderX = -1.28;
      lShoulderY = 0.52;
      lForearmX = -0.45;
      break;
    }
    case 'shoot': {
      const recoil = Math.sin(t * 42);
      torsoRotX = -0.06 + recoil * 0.05;
      torsoRotY = -0.2;
      rShoulderX = -1.38 + recoil * 0.12;
      rForearmX = -0.35;
      lShoulderX = -1.28 + recoil * 0.1;
      lShoulderY = 0.52;
      lForearmX = -0.45;
      rig.muzzleFlash.visible = recoil > 0;
      rig.muzzleFlash.scale.setScalar(0.8 + Math.random() * 0.5);
      break;
    }
    case 'reload': {
      torsoRotX = 0.15;
      rShoulderX = -0.85;
      rForearmX = -0.65;
      // Left hand reaches down to magazine and back up
      lShoulderX = -0.45 + Math.sin(t * 9) * 0.45;
      lShoulderY = 0.35;
      lForearmX = -0.95 + Math.cos(t * 9) * 0.35;
      headRotX = 0.25;
      break;
    }
    case 'jump': {
      pelvisY = 0.98 + Math.abs(Math.sin(t * 6)) * 0.25;
      lThighX = -0.65;
      lShinX = 0.85;
      rThighX = -0.35;
      rShinX = 0.55;
      // Left arm raised high like reference image JUMP pose!
      lShoulderX = -2.6;
      lShoulderZ = -0.3;
      lForearmX = -0.2;
      rShoulderX = -0.7;
      break;
    }
    case 'hit': {
      torsoRotX = -0.38;
      headRotX = -0.35;
      rShoulderX = -0.3;
      lShoulderX = -0.3;
      break;
    }
    case 'death': {
      // Collapse onto side/back like the reference image DEATH pose!
      pelvisY = 0.16;
      pelvisRotZ = 1.42;
      pelvisRotX = -0.3;
      rShoulderX = -0.3;
      lShoulderX = -1.1;
      lThighX = -0.25;
      rThighX = 0.2;
      break;
    }
    case 'victory': {
      // Both arms raised high in celebration like the reference image VICTORY pose!
      pelvisY = 0.62 + Math.abs(Math.sin(t * 7)) * 0.08;
      lShoulderX = -2.75 + Math.sin(t * 7) * 0.15;
      lShoulderZ = -0.35;
      lForearmX = -0.25;
      rShoulderX = -2.75 - Math.sin(t * 7) * 0.15;
      rShoulderZ = 0.35;
      rForearmX = -0.25;
      headRotX = -0.15;
      break;
    }
    case 'inspect': {
      rShoulderX = -1.05;
      rForearmX = -0.8;
      torsoRotY = Math.sin(t * 3) * 0.2;
      headRotX = 0.22;
      headRotY = Math.sin(t * 3) * 0.18;
      rig.weaponMount.rotation.z = Math.sin(t * 4) * 0.45;
      break;
    }
    case 'grenade': {
      torsoRotY = Math.sin(t * 8) * 0.45;
      lShoulderX = -2.4 * Math.abs(Math.sin(t * 5));
      lForearmX = -0.3;
      break;
    }
  }

  if (anim !== 'inspect') {
    rig.weaponMount.rotation.z = damp(rig.weaponMount.rotation.z, 0);
  }

  rig.pelvis.position.y = damp(rig.pelvis.position.y, pelvisY);
  rig.pelvis.rotation.x = damp(rig.pelvis.rotation.x, pelvisRotX);
  rig.pelvis.rotation.z = damp(rig.pelvis.rotation.z, pelvisRotZ);

  rig.torso.rotation.x = damp(rig.torso.rotation.x, torsoRotX);
  rig.torso.rotation.y = damp(rig.torso.rotation.y, torsoRotY);

  rig.headGroup.rotation.x = damp(rig.headGroup.rotation.x, headRotX);
  rig.headGroup.rotation.y = damp(rig.headGroup.rotation.y, headRotY);

  rig.rightShoulder.rotation.x = damp(rig.rightShoulder.rotation.x, rShoulderX);
  rig.rightShoulder.rotation.y = damp(rig.rightShoulder.rotation.y, rShoulderY);
  rig.rightShoulder.rotation.z = damp(rig.rightShoulder.rotation.z, rShoulderZ);
  rig.rightForearm.rotation.x = damp(rig.rightForearm.rotation.x, rForearmX);

  rig.leftShoulder.rotation.x = damp(rig.leftShoulder.rotation.x, lShoulderX);
  rig.leftShoulder.rotation.y = damp(rig.leftShoulder.rotation.y, lShoulderY);
  rig.leftShoulder.rotation.z = damp(rig.leftShoulder.rotation.z, lShoulderZ);
  rig.leftForearm.rotation.x = damp(rig.leftForearm.rotation.x, lForearmX);

  rig.leftThigh.rotation.x = damp(rig.leftThigh.rotation.x, lThighX);
  rig.leftShin.rotation.x = damp(rig.leftShin.rotation.x, lShinX);
  rig.rightThigh.rotation.x = damp(rig.rightThigh.rotation.x, rThighX);
  rig.rightShin.rotation.x = damp(rig.rightShin.rotation.x, rShinX);
}
