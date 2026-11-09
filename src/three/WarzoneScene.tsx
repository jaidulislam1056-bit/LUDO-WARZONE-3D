import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  BOARD_Y,
  gridToWorld,
  HOME_BASE_SLOTS_GRID,
  HOME_STRETCH_GRID,
  MAIN_TRACK_GRID,
  SAFE_TRACK_INDICES,
  SKY_WARZONE_COVERS,
  SKY_WARZONE_DROP_ZONES,
  TACTICAL_OBSTACLES,
  TEAM_COLORS,
  TEAM_ORDER,
  TILE_SIZE,
} from '../constants/boardData';
import { useGameStore } from '../store/useGameStore';
import { createSoldierRig, SoldierRig, updateSoldierRig } from './SoldierModel';

// Pre-allocated scratch vectors to avoid GC in render loop
const _camTarget = new THREE.Vector3();
const _desiredCamPos = new THREE.Vector3();
const _dummy = new THREE.Object3D();

/**
 * Create a 3D Dice with authentic recessed 3D black pips on all 6 faces:
 * Face +Y = 1, -Y = 6, +Z = 2, -Z = 5, +X = 3, -X = 4
 */
function create3DDiceGroup(): THREE.Group {
  const diceGroup = new THREE.Group();
  const size = 1.55;
  const bodyGeo = new THREE.BoxGeometry(size, size, size);
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.18,
    metalness: 0.05,
    clearcoat: 0.6,
  });
  const cube = new THREE.Mesh(bodyGeo, bodyMat);
  cube.castShadow = true;
  cube.receiveShadow = true;
  cube.userData = { isCenterDice: true };
  diceGroup.add(cube);

  const pipGeo = new THREE.SphereGeometry(0.125, 12, 12);
  const pipMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.3,
    metalness: 0.2,
  });
  const redPipMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.3,
    metalness: 0.2,
  });

  const half = size / 2 + 0.01;
  const s = 0.38;

  const addPip = (x: number, y: number, z: number, isRed = false) => {
    const pip = new THREE.Mesh(pipGeo, isRed ? redPipMat : pipMat);
    pip.position.set(x, y, z);
    diceGroup.add(pip);
  };

  // +Y Face (Value 1)
  addPip(0, half, 0, true);

  // -Y Face (Value 6)
  [-s, s].forEach((px) => {
    [-s, 0, s].forEach((pz) => addPip(px, -half, pz));
  });

  // +Z Face (Value 2)
  addPip(-s, s, half);
  addPip(s, -s, half);

  // -Z Face (Value 5)
  addPip(-s, s, -half);
  addPip(s, s, -half);
  addPip(0, 0, -half);
  addPip(-s, -s, -half);
  addPip(s, -s, -half);

  // +X Face (Value 3)
  addPip(half, s, -s);
  addPip(half, 0, 0);
  addPip(half, -s, s);

  // -X Face (Value 4)
  addPip(-half, s, s);
  addPip(-half, s, -s);
  addPip(-half, -s, s);
  addPip(-half, -s, -s);

  return diceGroup;
}

// Target Euler rotations so the rolled value face points straight up (+Y)
const DICE_TOP_ROTATIONS: Record<number, [number, number, number]> = {
  1: [0, 0, 0],
  6: [Math.PI, 0, 0],
  2: [-Math.PI / 2, 0, 0],
  5: [Math.PI / 2, 0, 0],
  3: [0, 0, Math.PI / 2],
  4: [0, 0, -Math.PI / 2],
};

function createTreeGroup(scale = 1): THREE.Group {
  const tree = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.85 });
  const leafMat1 = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.65 });
  const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.6 });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 0.9, 8), trunkMat);
  trunk.position.y = 0.45;
  trunk.castShadow = true;
  tree.add(trunk);

  const canopy1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 1), leafMat1);
  canopy1.position.set(0, 1.15, 0);
  canopy1.castShadow = true;
  tree.add(canopy1);

  const canopy2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 1), leafMat2);
  canopy2.position.set(0.32, 1.4, 0.2);
  canopy2.castShadow = true;
  tree.add(canopy2);

  const canopy3 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 1), leafMat2);
  canopy3.position.set(-0.3, 1.3, -0.2);
  canopy3.castShadow = true;
  tree.add(canopy3);

  tree.scale.setScalar(scale);
  return tree;
}

function createFloatingCastleIsland(accentColor: number): THREE.Group {
  const island = new THREE.Group();
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.88,
    metalness: 0.1,
  });
  const grassMat = new THREE.MeshStandardMaterial({
    color: 0x16a34a,
    roughness: 0.7,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.6,
  });
  const roofMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.4,
    metalness: 0.25,
  });

  // Inverted rocky cone base
  const rockBase = new THREE.Mesh(new THREE.ConeGeometry(5.5, 7.5, 9), rockMat);
  rockBase.rotation.x = Math.PI;
  rockBase.position.y = -3.75;
  island.add(rockBase);

  const topCap = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.2, 0.9, 9), grassMat);
  topCap.position.y = 0.2;
  island.add(topCap);

  // Keep & 3 Turret Towers
  const keep = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.8, 3.2), wallMat);
  keep.position.y = 1.8;
  island.add(keep);

  const towerPositions: [number, number][] = [
    [-1.6, -1.6],
    [1.6, -1.6],
    [0, 1.6],
  ];
  for (const [tx, tz] of towerPositions) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.85, 4.2, 10), wallMat);
    tower.position.set(tx, 2.4, tz);
    island.add(tower);

    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.8, 10), roofMat);
    spire.position.set(tx, 5.3, tz);
    island.add(spire);
  }

  const tree = createTreeGroup(1.1);
  tree.position.set(2.8, 0.6, 1.2);
  island.add(tree);

  return island;
}

/**
 * Dedicated Open Sky Combat Battlefield for Sky Warzone (আকাশে উড়ার লড়াই)
 * Features an open aerial floating plateau, 4 team aerial drop zones, and 16 tactical cover spots:
 * - 4 Hexagonal Energy Barrier Shields
 * - 4 Heavy Steel & Armor Blast Barricades
 * - 4 Fortified Sky Pillboxes / Bunkers
 * - 4 Monolith Crystal Cover Spires
 */
function createSkyWarzoneArenaGroup(): {
  group: THREE.Group;
  update: (elapsed: number) => void;
} {
  const group = new THREE.Group();
  group.name = 'SkyWarzoneArena';

  // 1. Massive Open Aerial Floating Plateau
  const arenaWidth = 32;
  const mainPlatform = new THREE.Mesh(
    new THREE.CylinderGeometry(arenaWidth * 0.5, arenaWidth * 0.44, 1.4, 24),
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.65,
      metalness: 0.25,
    }),
  );
  mainPlatform.position.y = -0.55;
  mainPlatform.receiveShadow = true;
  group.add(mainPlatform);

  // Inverted Floating Cliff Mountain underneath
  const underMountain = new THREE.Mesh(
    new THREE.ConeGeometry(arenaWidth * 0.44, 15, 16),
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.92,
      metalness: 0.1,
    }),
  );
  underMountain.rotation.x = Math.PI;
  underMountain.position.y = -8.5;
  group.add(underMountain);

  // Arena Surface Paved Battleground Pattern
  const battlegroundFloor = new THREE.Mesh(
    new THREE.RingGeometry(0.1, arenaWidth * 0.48, 24),
    new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.52,
      metalness: 0.2,
      side: THREE.DoubleSide,
    }),
  );
  battlegroundFloor.rotation.x = -Math.PI / 2;
  battlegroundFloor.position.y = 0.16;
  battlegroundFloor.receiveShadow = true;
  group.add(battlegroundFloor);

  // Central Flight Matrix Ring
  const centerCoreRing = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 4.2, 20),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.65,
    }),
  );
  centerCoreRing.rotation.x = -Math.PI / 2;
  centerCoreRing.position.y = 0.22;
  group.add(centerCoreRing);

  // 4 Team Drop Zone Landing Pads
  const teamPadPositions: Record<TeamColor, [number, number]> = {
    red: [0, 11],
    blue: [-11, 0],
    green: [0, -11],
    yellow: [11, 0],
  };

  for (const t of TEAM_ORDER) {
    const padGroup = new THREE.Group();
    const [px, pz] = teamPadPositions[t];
    padGroup.position.set(px, 0.2, pz);

    // Glowing Team Ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3.4, 20),
      new THREE.MeshBasicMaterial({
        color: TEAM_COLORS[t].threeColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    padGroup.add(ring);

    // Landing Pad Base
    const padDisk = new THREE.Mesh(
      new THREE.CylinderGeometry(3.2, 3.5, 0.25, 16),
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.4,
        metalness: 0.6,
      }),
    );
    padDisk.position.y = -0.12;
    padGroup.add(padDisk);

    // Vertical Team Light Beacon
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.55, 7.5, 10),
      new THREE.MeshBasicMaterial({
        color: TEAM_COLORS[t].threeColor,
        transparent: true,
        opacity: 0.28,
      }),
    );
    beacon.position.y = 3.75;
    padGroup.add(beacon);

    group.add(padGroup);
  }

  // 16 Tactical Cover Structures based on SKY_WARZONE_COVERS
  const shieldMeshes: THREE.Mesh[] = [];
  const spireMeshes: THREE.Mesh[] = [];

  for (const cov of SKY_WARZONE_COVERS) {
    const covGroup = new THREE.Group();
    covGroup.position.set(cov.worldPos.x, 0.2, cov.worldPos.z);

    if (cov.kind === 'energy_shield') {
      // Hexagonal Glowing Energy Barrier
      const shieldMat = new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.6,
        roughness: 0.1,
        transmission: 0.85,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
      });
      const shieldMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(1.5, 1.5, 2.8, 6, 1, true),
        shieldMat,
      );
      shieldMesh.position.y = 1.4;
      covGroup.add(shieldMesh);
      shieldMeshes.push(shieldMesh);

      // Tech Emitter Base
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 1.1, 0.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.2 }),
      );
      base.position.y = 0.2;
      covGroup.add(base);
    } else if (cov.kind === 'blast_wall') {
      // Heavy Concrete & Steel Blast Barricade
      const wallMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.8,
        metalness: 0.3,
      });
      const wall = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.2, 0.7), wallMat);
      wall.position.y = 1.1;
      wall.castShadow = true;
      wall.receiveShadow = true;
      covGroup.add(wall);

      // Yellow hazard stripe trim
      const hazardStripe = new THREE.Mesh(
        new THREE.BoxGeometry(2.82, 0.22, 0.72),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
      );
      hazardStripe.position.y = 1.95;
      covGroup.add(hazardStripe);
    } else if (cov.kind === 'sky_bunker') {
      // Fortified Sky Pillbox Bunker
      const bunkerBody = new THREE.Mesh(
        new THREE.CylinderGeometry(1.8, 2.1, 2.4, 8),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7, metalness: 0.4 }),
      );
      bunkerBody.position.y = 1.2;
      bunkerBody.castShadow = true;
      covGroup.add(bunkerBody);

      // Roof with Observation Antenna
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 0.8, 8),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.4 }),
      );
      roof.position.y = 2.8;
      covGroup.add(roof);

      const antenna = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
      );
      antenna.position.y = 3.9;
      covGroup.add(antenna);
    } else if (cov.kind === 'crystal_spire') {
      // Indestructible Monolith Crystal Spire
      const spireMat = new THREE.MeshStandardMaterial({
        color: 0x818cf8,
        emissive: 0x4338ca,
        emissiveIntensity: 0.45,
        roughness: 0.2,
        metalness: 0.5,
      });
      const spire = new THREE.Mesh(new THREE.OctahedronGeometry(1.2, 0), spireMat);
      spire.scale.set(1.1, 3.4, 1.1);
      spire.position.y = 2.2;
      spire.castShadow = true;
      covGroup.add(spire);
      spireMeshes.push(spire);
    }

    group.add(covGroup);
  }

  return {
    group,
    update: (elapsed: number) => {
      // Animate energy shields pulsating
      for (let i = 0; i < shieldMeshes.length; i++) {
        const sm = shieldMeshes[i];
        sm.rotation.y = elapsed * 0.4 + i;
        const mat = sm.material as THREE.MeshPhysicalMaterial;
        mat.emissiveIntensity = 0.5 + Math.sin(elapsed * 2.5 + i) * 0.35;
      }
      // Animate crystal spires slow float/rotation
      for (let i = 0; i < spireMeshes.length; i++) {
        const sp = spireMeshes[i];
        sp.rotation.y = elapsed * 0.25 + i;
      }
      centerCoreRing.rotation.z = elapsed * 0.2;
    },
  };
}

export function WarzoneScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL detection per Three.js skill
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x38bdf8);
    scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0085);

    // Studio PBR Environment Map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const initialAspect = container.clientWidth / container.clientHeight;
    const isMobileAspect = container.clientWidth < container.clientHeight || container.clientWidth < 768;
    const initialFov = initialAspect < 1
      ? Math.max(52, Math.min(84, 2 * Math.atan(Math.tan((44 * Math.PI) / 360) / initialAspect) * (180 / Math.PI)))
      : 45;

    const camera = new THREE.PerspectiveCamera(
      initialFov,
      initialAspect,
      0.1,
      260,
    );
    // On mobile portrait, position slightly further and higher so the whole arena fits comfortably
    if (isMobileAspect) {
      camera.position.set(0, 32, 30);
    } else {
      camera.position.set(0, 22, 24);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.46;
    controls.minPolarAngle = 0.2;
    controls.minDistance = isMobileAspect ? 10 : 8;
    controls.maxDistance = 50;
    controls.target.set(0, 0.5, 0);

    // 2. Balanced 3-Point Outdoor Sky Lighting
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 0.85);
    hemiLight.position.set(0, 40, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.65);
    sunLight.position.set(18, 32, 20);
    sunLight.castShadow = !isSoftwareGl;
    const d = 16;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.camera.near = 2;
    sunLight.shadow.camera.far = 70;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
    rimLight.position.set(-20, 15, -18);
    scene.add(rimLight);

    // 3. Build the Floating 3D Sky Fortress Ludo Board (Traditional Modes)
    const boardGroup = new THREE.Group();
    scene.add(boardGroup);

    // 3b. Build the Dedicated Open Sky Combat Arena with 16 Covers (Sky Warzone Mode)
    const skyArenaObj = createSkyWarzoneArenaGroup();
    scene.add(skyArenaObj.group);

    const boardWidth = 15 * TILE_SIZE + 2.2;
    const stoneSlabMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.75,
      metalness: 0.15,
    });
    const cliffRockMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.9,
      metalness: 0.08,
    });

    // Main Fortress Stone Platform
    const mainSlab = new THREE.Mesh(
      new THREE.BoxGeometry(boardWidth, 1.2, boardWidth),
      stoneSlabMat,
    );
    mainSlab.position.y = -0.45;
    mainSlab.receiveShadow = true;
    boardGroup.add(mainSlab);

    // Floating Island Rocky Underside
    const underRock = new THREE.Mesh(
      new THREE.CylinderGeometry(boardWidth * 0.65, 4.5, 11, 12),
      cliffRockMat,
    );
    underRock.position.y = -6.5;
    boardGroup.add(underRock);

    // 4 Colored Home Base Courtyards + 4 Circular Spawn Pads per Team
    const baseConfigs: { team: 'red' | 'blue' | 'green' | 'yellow'; colCenter: number; rowCenter: number }[] = [
      { team: 'red', colCenter: 2.5, rowCenter: 11.5 },
      { team: 'blue', colCenter: 2.5, rowCenter: 2.5 },
      { team: 'green', colCenter: 11.5, rowCenter: 2.5 },
      { team: 'yellow', colCenter: 11.5, rowCenter: 11.5 },
    ];

    const baseSize = 6 * TILE_SIZE - 0.18;
    for (const cfg of baseConfigs) {
      const palette = TEAM_COLORS[cfg.team];
      const worldCenter = gridToWorld(cfg.colCenter, cfg.rowCenter, 0);

      const basePlate = new THREE.Mesh(
        new THREE.BoxGeometry(baseSize, 0.32, baseSize),
        new THREE.MeshStandardMaterial({
          color: palette.threeColor,
          roughness: 0.42,
          metalness: 0.18,
        }),
      );
      basePlate.position.set(worldCenter.x, 0.1, worldCenter.z);
      basePlate.receiveShadow = true;
      boardGroup.add(basePlate);

      // Inner courtyard recess
      const innerPlate = new THREE.Mesh(
        new THREE.BoxGeometry(baseSize * 0.76, 0.35, baseSize * 0.76),
        new THREE.MeshStandardMaterial({
          color: palette.threeColor,
          roughness: 0.32,
          metalness: 0.25,
        }),
      );
      innerPlate.position.set(worldCenter.x, 0.12, worldCenter.z);
      innerPlate.receiveShadow = true;
      boardGroup.add(innerPlate);

      // 4 Circular Soldier Spawn Rings inside each Home Base
      for (const [scol, srow] of HOME_BASE_SLOTS_GRID[cfg.team]) {
        const spPos = gridToWorld(scol, srow, 0);
        const pad = new THREE.Mesh(
          new THREE.CylinderGeometry(0.68, 0.76, 0.18, 24),
          new THREE.MeshStandardMaterial({
            color: 0xf8fafc,
            roughness: 0.3,
            metalness: 0.2,
          }),
        );
        pad.position.set(spPos.x, 0.28, spPos.z);
        pad.receiveShadow = true;
        boardGroup.add(pad);

        const innerPad = new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.5, 0.2, 24),
          new THREE.MeshStandardMaterial({
            color: palette.threeColor,
            roughness: 0.35,
          }),
        );
        innerPad.position.set(spPos.x, 0.29, spPos.z);
        boardGroup.add(innerPad);
      }
    }

    // 52 Main Perimeter Path Tiles
    const tileGeo = new THREE.BoxGeometry(TILE_SIZE * 0.94, 0.22, TILE_SIZE * 0.94);
    const whiteTileMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.45,
      metalness: 0.08,
    });
    const safeGoldMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      roughness: 0.32,
      metalness: 0.35,
    });

    MAIN_TRACK_GRID.forEach(([col, row], idx) => {
      const pos = gridToWorld(col, row, 0);
      let mat = whiteTileMat;

      // Color starting tiles by team
      if (idx === 0) mat = new THREE.MeshStandardMaterial({ color: TEAM_COLORS.red.threeColor, roughness: 0.4 });
      else if (idx === 13) mat = new THREE.MeshStandardMaterial({ color: TEAM_COLORS.blue.threeColor, roughness: 0.4 });
      else if (idx === 26) mat = new THREE.MeshStandardMaterial({ color: TEAM_COLORS.green.threeColor, roughness: 0.4 });
      else if (idx === 39) mat = new THREE.MeshStandardMaterial({ color: TEAM_COLORS.yellow.threeColor, roughness: 0.4 });
      else if (SAFE_TRACK_INDICES.has(idx)) mat = safeGoldMat;

      const tile = new THREE.Mesh(tileGeo, mat);
      tile.position.set(pos.x, 0.14, pos.z);
      tile.receiveShadow = true;
      boardGroup.add(tile);

      // Safe zone star emblem
      if (SAFE_TRACK_INDICES.has(idx)) {
        const starRing = new THREE.Mesh(
          new THREE.RingGeometry(0.28, 0.46, 6),
          new THREE.MeshBasicMaterial({
            color: 0xf59e0b,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -1,
          }),
        );
        starRing.rotation.x = -Math.PI / 2;
        starRing.position.set(pos.x, 0.26, pos.z);
        boardGroup.add(starRing);
      }
    });

    // 20 Colored Home Stretch Tiles (5 per team)
    for (const team of TEAM_ORDER) {
      const mat = new THREE.MeshStandardMaterial({
        color: TEAM_COLORS[team].threeColor,
        roughness: 0.38,
        metalness: 0.15,
      });
      for (const [col, row] of HOME_STRETCH_GRID[team]) {
        const pos = gridToWorld(col, row, 0);
        const tile = new THREE.Mesh(tileGeo, mat);
        tile.position.set(pos.x, 0.16, pos.z);
        tile.receiveShadow = true;
        boardGroup.add(tile);
      }
    }

    // Central 3x3 Finishing Area Pedestal (Cols 6..8, Rows 6..8)
    const centerSize = 3 * TILE_SIZE;
    const centerPedestal = new THREE.Mesh(
      new THREE.BoxGeometry(centerSize, 0.34, centerSize),
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.35,
        metalness: 0.5,
      }),
    );
    centerPedestal.position.set(0, 0.17, 0);
    centerPedestal.receiveShadow = true;
    boardGroup.add(centerPedestal);

    // 4 Colored Triangles in Center Pedestal
    const triAngles: { team: 'red' | 'blue' | 'green' | 'yellow'; rotY: number }[] = [
      { team: 'red', rotY: 0 },
      { team: 'blue', rotY: Math.PI / 2 },
      { team: 'green', rotY: Math.PI },
      { team: 'yellow', rotY: -Math.PI / 2 },
    ];
    for (const { team, rotY } of triAngles) {
      const shape = new THREE.Shape();
      const hs = centerSize * 0.47;
      shape.moveTo(0, 0);
      shape.lineTo(-hs, hs);
      shape.lineTo(hs, hs);
      shape.closePath();
      const triGeo = new THREE.ShapeGeometry(shape);
      const triMesh = new THREE.Mesh(
        triGeo,
        new THREE.MeshStandardMaterial({
          color: TEAM_COLORS[team].threeColor,
          roughness: 0.35,
          side: THREE.DoubleSide,
        }),
      );
      triMesh.rotation.x = -Math.PI / 2;
      triMesh.rotation.z = rotY;
      triMesh.position.y = 0.35;
      boardGroup.add(triMesh);
    }

    // 4. Center 3D Animated Dice
    const centerDice = create3DDiceGroup();
    centerDice.position.set(0, 1.15, 0);
    scene.add(centerDice);

    // 5. Tactical Cover Obstacles (Crates & Barrels) & Corner Trees/Pillars
    const crateMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.75,
    });
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      roughness: 0.4,
      metalness: 0.5,
    });

    for (const obs of TACTICAL_OBSTACLES) {
      if (obs.kind === 'crate') {
        const crate = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.95, 0.95), crateMat);
        crate.position.set(obs.worldPos.x, BOARD_Y + 0.48, obs.worldPos.z);
        crate.castShadow = true;
        crate.receiveShadow = true;
        boardGroup.add(crate);
      } else {
        const barrel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.42, 0.42, 1.05, 16),
          barrelMat,
        );
        barrel.position.set(obs.worldPos.x, BOARD_Y + 0.52, obs.worldPos.z);
        barrel.castShadow = true;
        boardGroup.add(barrel);
      }
    }

    // Corner Trees & Banner Pillars matching the reference artwork
    const cornerOffsets: [number, number][] = [
      [-11.4, 11.4],
      [-11.4, -11.4],
      [11.4, -11.4],
      [11.4, 11.4],
    ];
    for (const [cx, cz] of cornerOffsets) {
      const tree = createTreeGroup(1.15);
      tree.position.set(cx, 0.15, cz);
      boardGroup.add(tree);
    }

    // 6. Distant Floating Sky Islands & Instanced Clouds
    const skyIslands: THREE.Group[] = [];
    const islandSpecs: { pos: [number, number, number]; color: number }[] = [
      { pos: [-26, 2, -26], color: 0x2563eb },
      { pos: [26, 4, -26], color: 0xdc2626 },
      { pos: [-28, -2, 22], color: 0x16a34a },
      { pos: [28, 1, 22], color: 0xeab308 },
    ];
    for (const spec of islandSpecs) {
      const isl = createFloatingCastleIsland(spec.color);
      isl.position.set(...spec.pos);
      scene.add(isl);
      skyIslands.push(isl);
    }

    // InstancedMesh for 48 Drifting Sky Clouds
    const cloudCount = 48;
    const cloudGeo = new THREE.DodecahedronGeometry(2.6, 1);
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.0,
      transparent: true,
      opacity: 0.88,
    });
    const cloudInstanced = new THREE.InstancedMesh(cloudGeo, cloudMat, cloudCount);
    const cloudData: { x: number; y: number; z: number; scale: number; speed: number }[] = [];

    for (let i = 0; i < cloudCount; i++) {
      const angle = (i / cloudCount) * Math.PI * 2;
      const radius = 22 + (i % 5) * 9;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = -5 - (i % 4) * 2.5;
      const scale = 0.8 + (i % 4) * 0.45;
      cloudData.push({ x, y, z, scale, speed: 0.3 + (i % 3) * 0.15 });

      _dummy.position.set(x, y, z);
      _dummy.scale.set(scale * 1.6, scale * 0.65, scale);
      _dummy.updateMatrix();
      cloudInstanced.setMatrixAt(i, _dummy.matrix);
    }
    cloudInstanced.instanceMatrix.needsUpdate = true;
    cloudInstanced.computeBoundingSphere();
    scene.add(cloudInstanced);

    // Procedural 3D Flying Birds Flock soaring in the sky (akase pakhi urbe)
    const birdGroup = new THREE.Group();
    scene.add(birdGroup);

    interface ProceduralBird {
      group: THREE.Group;
      wingL: THREE.Mesh;
      wingR: THREE.Mesh;
      orbitRadius: number;
      altitude: number;
      speed: number;
      phaseOffset: number;
    }

    const birdBodyMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.7,
      metalness: 0.1,
    });
    const birdBeakMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const birdWingMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.6,
      side: THREE.DoubleSide,
    });

    const flyingBirds: ProceduralBird[] = [];
    const birdCount = 12;

    for (let b = 0; b < birdCount; b++) {
      const bGrp = new THREE.Group();

      // Slender aerodynamic bird body
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.48, 6), birdBodyMat);
      body.rotation.x = Math.PI / 2;
      bGrp.add(body);

      // Beak
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 4), birdBeakMat);
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0, 0.28);
      bGrp.add(beak);

      // Tail
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.22), birdWingMat);
      tail.position.set(0, 0.02, -0.3);
      bGrp.add(tail);

      // Left Wing with pivot
      const wingLGrp = new THREE.Group();
      wingLGrp.position.set(-0.08, 0.04, 0);
      const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.015, 0.16), birdWingMat);
      wingL.position.x = -0.21;
      wingLGrp.add(wingL);
      bGrp.add(wingLGrp);

      // Right Wing with pivot
      const wingRGrp = new THREE.Group();
      wingRGrp.position.set(0.08, 0.04, 0);
      const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.015, 0.16), birdWingMat);
      wingR.position.x = 0.21;
      wingRGrp.add(wingR);
      bGrp.add(wingRGrp);

      const orbitRadius = 18 + (b % 4) * 6;
      const altitude = 10 + (b % 3) * 4.5;
      const speed = 0.28 + (b % 3) * 0.08;
      const phaseOffset = (b / birdCount) * Math.PI * 2;

      birdGroup.add(bGrp);
      flyingBirds.push({
        group: bGrp,
        wingL,
        wingR,
        orbitRadius,
        altitude,
        speed,
        phaseOffset,
      });
    }

    // 7. Battle Royale Safe Zone Ring
    const safeZoneGeo = new THREE.CylinderGeometry(1, 1, 3.5, 48, 1, true);
    const safeZoneMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const safeZoneMesh = new THREE.Mesh(safeZoneGeo, safeZoneMat);
    safeZoneMesh.position.y = 1.75;
    safeZoneMesh.visible = false;
    scene.add(safeZoneMesh);

    // 8. Create the 16 3D Soldier Rigs
    const soldierRigs = new Map<string, SoldierRig>();
    const initialSoldiers = useGameStore.getState().soldiers;
    for (const s of initialSoldiers) {
      const rig = createSoldierRig(s.id, s.team);
      rig.root.position.set(s.worldPos.x, s.worldPos.y, s.worldPos.z);
      rig.root.rotation.y = s.rotationY;
      scene.add(rig.root);
      soldierRigs.set(s.id, rig);
    }

    // 9. Loot Boxes & Supply Drops Meshes
    const lootGroup = new THREE.Group();
    scene.add(lootGroup);
    const lootMeshes = new Map<string, THREE.Mesh>();

    // 10. Zombie Meshes Group
    const zombieGroup = new THREE.Group();
    scene.add(zombieGroup);
    const zombieMeshes = new Map<string, THREE.Group>();

    // 11. Bullet Projectile Trails Group
    const projectileGroup = new THREE.Group();
    scene.add(projectileGroup);

    // 12. Raycasting for Clicking Soldiers & Central Dice
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      // Ignore camera drags
      if (Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y) > 8) {
        return;
      }

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(scene.children, true);

      const store = useGameStore.getState();
      if (store.screen !== 'playing') return;

      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          if (obj.userData?.isCenterDice) {
            if (
              store.turnPhase === 'DICE_PHASE' &&
              store.humanTeams.includes(store.currentTurnTeam)
            ) {
              store.rollDice();
            }
            return;
          }
          if (obj.userData?.soldierId) {
            const clickedId = obj.userData.soldierId as string;
            const clickedTeam = obj.userData.team as string;
            if (clickedTeam === store.currentTurnTeam) {
              store.selectSoldier(clickedId);
            } else if (
              store.turnPhase === 'ACTION_PHASE' &&
              store.targetableEnemyIds.includes(clickedId)
            ) {
              store.selectTargetEnemy(clickedId);
              store.fireWeaponAtTarget(clickedId);
            }
            return;
          }
          obj = obj.parent;
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // Resize Handler with Dynamic Responsive FOV
    const onResize = () => {
      if (!container) return;
      const aspect = container.clientWidth / container.clientHeight;
      camera.fov = aspect < 1
        ? Math.max(52, Math.min(84, 2 * Math.atan(Math.tan((44 * Math.PI) / 360) / aspect) * (180 / Math.PI)))
        : 45;
      camera.aspect = aspect;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    // 13. Main Animation Loop with Software-WebGL Pacing Guard
    const clock = new THREE.Clock();
    let frameId = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.getElapsedTime();
      const state = useGameStore.getState();

      // Update Center 3D Dice Animation
      if (state.isRollingDice) {
        centerDice.position.y = 2.4 + Math.abs(Math.sin(elapsed * 16)) * 1.2;
        centerDice.rotation.x += dt * 18;
        centerDice.rotation.y += dt * 22;
        centerDice.rotation.z += dt * 14;
      } else {
        centerDice.position.y = THREE.MathUtils.damp(centerDice.position.y, 1.12, 10, dt);
        const faceVal = state.diceValue || 6;
        const [rx, ry, rz] = DICE_TOP_ROTATIONS[faceVal] || [0, 0, 0];
        centerDice.rotation.x = THREE.MathUtils.damp(centerDice.rotation.x, rx, 10, dt);
        centerDice.rotation.y = THREE.MathUtils.damp(centerDice.rotation.y, ry, 10, dt);
        centerDice.rotation.z = THREE.MathUtils.damp(centerDice.rotation.z, rz, 10, dt);
      }

      // Ensure rigs match current soldiers list (e.g. if match restarted with different mode)
      const currentIds = new Set(state.soldiers.map((s) => s.id));
      for (const [id, rig] of soldierRigs.entries()) {
        if (!currentIds.has(id)) {
          scene.remove(rig.root);
          soldierRigs.delete(id);
        }
      }
      for (const s of state.soldiers) {
        let rig = soldierRigs.get(s.id);
        if (!rig) {
          rig = createSoldierRig(s.id, s.team);
          scene.add(rig.root);
          soldierRigs.set(s.id, rig);
        }
        const isSelected = state.selectedSoldierId === s.id;
        const isValidMove = state.validMoveSoldierIds.includes(s.id);
        const isTargetable = state.targetableEnemyIds.includes(s.id);

        // If Character Select modal is open, animate the preview soldier in the center!
        const isPreviewSubject =
          state.activeModal === 'characters' && s.id === `${state.previewTeam}_0`;

        updateSoldierRig(
          rig,
          s,
          elapsed,
          dt,
          isSelected,
          isValidMove,
          isTargetable,
          camera.position,
          isPreviewSubject
            ? { anim: state.previewAnimation, weapon: state.previewWeapon }
            : undefined,
        );
      }

      // Sync Loot Boxes
      for (const box of state.lootBoxes) {
        let mesh = lootMeshes.get(box.id);
        if (!mesh) {
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.62, 0.52, 0.62),
            new THREE.MeshStandardMaterial({
              color: box.isWeapon ? 0xf59e0b : 0x22c55e,
              metalness: 0.45,
              roughness: 0.3,
            }),
          );
          mesh.castShadow = true;
          lootGroup.add(mesh);
          lootMeshes.set(box.id, mesh);
        }
        mesh.visible = !box.collected;
        if (!box.collected) {
          mesh.position.set(
            box.worldPos.x,
            box.worldPos.y + Math.sin(elapsed * 3 + box.tileIndex) * 0.1,
            box.worldPos.z,
          );
          mesh.rotation.y = elapsed * 1.4;
        }
      }

      // Sync Zombies (for Zombie Survival mode)
      const activeZombieIds = new Set(state.zombies.map((z) => z.id));
      for (const [zid, zmesh] of zombieMeshes.entries()) {
        if (!activeZombieIds.has(zid)) {
          zombieGroup.remove(zmesh);
          zombieMeshes.delete(zid);
        }
      }
      for (const z of state.zombies) {
        let zmesh = zombieMeshes.get(z.id);
        if (!zmesh) {
          zmesh = new THREE.Group();
          const body = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.24, 0.65, 6, 10),
            new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.8 }),
          );
          body.position.y = 0.65;
          zmesh.add(body);
          const eyes = new THREE.Mesh(
            new THREE.BoxGeometry(0.24, 0.08, 0.1),
            new THREE.MeshBasicMaterial({ color: 0xef4444 }),
          );
          eyes.position.set(0, 1.05, 0.2);
          zmesh.add(eyes);
          zombieGroup.add(zmesh);
          zombieMeshes.set(z.id, zmesh);
        }
        zmesh.position.lerp(
          new THREE.Vector3(z.targetWorldPos.x, z.targetWorldPos.y, z.targetWorldPos.z),
          Math.min(1, dt * 5),
        );
      }

      // Render Bullet Trails & Grenade Arcs
      while (projectileGroup.children.length > 0) {
        projectileGroup.remove(projectileGroup.children[0]);
      }
      for (const p of state.projectiles) {
        const points = [
          new THREE.Vector3(p.from.x, p.from.y, p.from.z),
          new THREE.Vector3(p.to.x, p.to.y, p.to.z),
        ];
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({ color: p.color });
        projectileGroup.add(new THREE.Line(lineGeo, lineMat));
      }

      // Battle Royale Safe Zone cylinder
      if (state.gameMode === 'battle_royale' || state.gameMode === 'survival') {
        safeZoneMesh.visible = true;
        const rWorld = state.safeZoneRadius * TILE_SIZE;
        safeZoneMesh.scale.set(rWorld, 1, rWorld);
      } else {
        safeZoneMesh.visible = false;
      }

      // Toggle Environment Layout based on Game Mode (Traditional Ludo Board vs Dedicated Sky Warzone Arena)
      const isSkyWarzone = state.gameMode === 'sky_warzone';
      boardGroup.visible = !isSkyWarzone;
      skyArenaObj.group.visible = isSkyWarzone;
      if (isSkyWarzone) {
        skyArenaObj.update(elapsed);
        centerDice.position.y = 4.2;
      } else {
        centerDice.position.y = 1.15;
      }

      // Gentle float for distant sky islands & clouds
      skyIslands.forEach((isl, idx) => {
        isl.position.y =
          islandSpecs[idx].pos[1] + Math.sin(elapsed * 0.8 + idx * 1.5) * 0.45;
      });

      // Animate 3D Flying Birds in Sky (akase pakhi urbe)
      for (const bird of flyingBirds) {
        const angle = elapsed * bird.speed + bird.phaseOffset;
        const x = Math.cos(angle) * bird.orbitRadius;
        const z = Math.sin(angle) * bird.orbitRadius;
        const y = bird.altitude + Math.sin(elapsed * 2.2 + bird.phaseOffset) * 1.8;
        bird.group.position.set(x, y, z);
        bird.group.rotation.y = -angle + Math.PI;
        bird.group.rotation.z = Math.sin(angle) * 0.22;
        const flap = Math.sin(elapsed * 12 + bird.phaseOffset) * 0.6;
        bird.wingL.rotation.z = flap;
        bird.wingR.rotation.z = -flap;
      }

      // Camera Choreography (Menu Orbit, Isometric, Shoulder TPS, Follow, Top-Down, Front, Orbit, Victory)
      const activeSoldier = state.soldiers.find((s) => s.id === state.selectedSoldierId);

      if (state.activeModal === 'characters') {
        const previewSol = state.soldiers.find((s) => s.id === `${state.previewTeam}_0`);
        if (previewSol) {
          _camTarget.set(previewSol.worldPos.x, previewSol.worldPos.y + 0.85, previewSol.worldPos.z);
          _desiredCamPos.set(
            previewSol.worldPos.x + Math.sin(elapsed * 0.5) * 3.4,
            previewSol.worldPos.y + 1.5,
            previewSol.worldPos.z + Math.cos(elapsed * 0.5) * 3.4,
          );
          camera.position.lerp(_desiredCamPos, Math.min(1, dt * 6));
          controls.target.lerp(_camTarget, Math.min(1, dt * 8));
        }
      } else if (state.screen === 'menu') {
        // Atmospheric live-world title screen camera pan around the floating Ludo fortress
        const angle = elapsed * 0.16;
        camera.position.set(Math.sin(angle) * 24, 16, Math.cos(angle) * 24);
        controls.target.set(0, 0.8, 0);
      } else if (state.cameraMode === 'shoulder' && activeSoldier) {
        // Third-Person Over-The-Shoulder Shooter View
        const dirX = Math.sin(activeSoldier.rotationY);
        const dirZ = Math.cos(activeSoldier.rotationY);
        _desiredCamPos.set(
          activeSoldier.worldPos.x - dirX * 4.8 + dirZ * 1.1,
          activeSoldier.worldPos.y + 2.8,
          activeSoldier.worldPos.z - dirZ * 4.8 - dirX * 1.1,
        );
        _camTarget.set(0, 1.1, 0);
        camera.position.lerp(_desiredCamPos, Math.min(1, dt * 6));
        controls.target.lerp(_camTarget, Math.min(1, dt * 7));
      } else if (state.cameraMode === 'follow' && activeSoldier) {
        _camTarget.set(
          activeSoldier.worldPos.x,
          activeSoldier.worldPos.y + 0.8,
          activeSoldier.worldPos.z,
        );
        _desiredCamPos.set(
          activeSoldier.worldPos.x,
          activeSoldier.worldPos.y + 11,
          activeSoldier.worldPos.z + 11,
        );
        camera.position.lerp(_desiredCamPos, Math.min(1, dt * 5));
        controls.target.lerp(_camTarget, Math.min(1, dt * 6));
      } else if (state.cameraMode === 'front' && activeSoldier) {
        // Front View facing active soldier
        const dirX = Math.sin(activeSoldier.rotationY);
        const dirZ = Math.cos(activeSoldier.rotationY);
        _desiredCamPos.set(
          activeSoldier.worldPos.x + dirX * 4.6,
          activeSoldier.worldPos.y + 2.2,
          activeSoldier.worldPos.z + dirZ * 4.6,
        );
        _camTarget.set(
          activeSoldier.worldPos.x,
          activeSoldier.worldPos.y + 1.1,
          activeSoldier.worldPos.z,
        );
        camera.position.lerp(_desiredCamPos, Math.min(1, dt * 6));
        controls.target.lerp(_camTarget, Math.min(1, dt * 7));
      } else if (state.cameraMode === 'top') {
        _desiredCamPos.set(0, 29, 0.1);
        _camTarget.set(0, 0, 0);
        camera.position.lerp(_desiredCamPos, Math.min(1, dt * 5));
        controls.target.lerp(_camTarget, Math.min(1, dt * 6));
      } else if (state.cameraMode === 'isometric') {
        const isMobile = window.innerWidth < window.innerHeight || window.innerWidth < 768;
        if (isMobile) {
          _desiredCamPos.set(0, 30, 28);
        } else {
          _desiredCamPos.set(0, 22, 24);
        }
        _camTarget.set(0, 0.5, 0);
        camera.position.lerp(_desiredCamPos, Math.min(1, dt * 4));
        controls.target.lerp(_camTarget, Math.min(1, dt * 5));
      } else if (state.cameraMode === 'orbit') {
        // 360° Free Orbit Mode
        if (activeSoldier) {
          _camTarget.set(activeSoldier.worldPos.x, activeSoldier.worldPos.y + 0.8, activeSoldier.worldPos.z);
        } else {
          _camTarget.set(0, 0.5, 0);
        }
        controls.target.lerp(_camTarget, Math.min(1, dt * 4));
      } else if (state.cameraMode === 'victory') {
        const angle = elapsed * 0.6;
        camera.position.set(Math.sin(angle) * 14, 9, Math.cos(angle) * 14);
        controls.target.set(0, 0.8, 0);
      }

      // Decaying Screen Shake on Shots / Explosions
      if (state.screenShake > 0.01) {
        camera.position.x += (Math.random() - 0.5) * state.screenShake;
        camera.position.y += (Math.random() - 0.5) * state.screenShake;
        useGameStore.setState({ screenShake: Math.max(0, state.screenShake - dt * 2.4) });
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 w-screen h-screen overflow-hidden select-none bg-sky-900"
    />
  );
}
