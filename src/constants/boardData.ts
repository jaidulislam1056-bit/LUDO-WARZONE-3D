import {
  TeamColor,
  Vec3,
  WeaponSpec,
  WeaponType,
  ItemType,
  SkinItem,
  DailyMission,
} from '../types/game';

export const TILE_SIZE = 1.65;
export const BOARD_Y = 0.25;

export const TEAM_COLORS: Record<
  TeamColor,
  {
    name: string;
    primaryHex: string;
    secondaryHex: string;
    darkHex: string;
    threeColor: number;
    startTrackIndex: number;
  }
> = {
  red: {
    name: 'Red Team',
    primaryHex: '#EF4444',
    secondaryHex: '#FCA5A5',
    darkHex: '#991B1B',
    threeColor: 0xdc2626,
    startTrackIndex: 0,
  },
  blue: {
    name: 'Blue Team',
    primaryHex: '#2563EB',
    secondaryHex: '#93C5FD',
    darkHex: '#1E3A8A',
    threeColor: 0x2563eb,
    startTrackIndex: 13,
  },
  green: {
    name: 'Green Team',
    primaryHex: '#16A34A',
    secondaryHex: '#86EFAC',
    darkHex: '#14532D',
    threeColor: 0x16a34a,
    startTrackIndex: 26,
  },
  yellow: {
    name: 'Yellow Team',
    primaryHex: '#EAB308',
    secondaryHex: '#FDE047',
    darkHex: '#854D0E',
    threeColor: 0xeab308,
    startTrackIndex: 39,
  },
};

export const TEAM_ORDER: TeamColor[] = ['red', 'blue', 'green', 'yellow'];

// Convert 15x15 Ludo grid col/row (0..14) to 3D world coordinates centered at (0, BOARD_Y, 0)
export function gridToWorld(col: number, row: number, yOffset = 0): Vec3 {
  return {
    x: (col - 7) * TILE_SIZE,
    y: BOARD_Y + yOffset,
    z: (row - 7) * TILE_SIZE,
  };
}

/**
 * Traditional 52-cell Ludo clockwise perimeter path on a 15x15 grid:
 * - Red Base is Bottom-Left (cols 0..5, rows 9..14) -> Red Start at (col 6, row 13) [index 0]
 * - Blue Base is Top-Left (cols 0..5, rows 0..5) -> Blue Start at (col 1, row 6) [index 13]
 * - Green Base is Top-Right (cols 9..14, rows 0..5) -> Green Start at (col 8, row 1) [index 26]
 * - Yellow Base is Bottom-Right (cols 9..14, rows 9..14) -> Yellow Start at (col 13, row 8) [index 39]
 */
export const MAIN_TRACK_GRID: [number, number][] = [
  // Red bottom arm going up (0..4)
  [6, 13],
  [6, 12],
  [6, 11],
  [6, 10],
  [6, 9],
  // Left arm bottom edge going left (5..10)
  [5, 8],
  [4, 8],
  [3, 8],
  [2, 8],
  [1, 8],
  [0, 8],
  // Left turn going up (11..12)
  [0, 7],
  [0, 6],
  // Blue left arm top edge going right (13..17) - 13 is Blue Start
  [1, 6],
  [2, 6],
  [3, 6],
  [4, 6],
  [5, 6],
  // Top arm left edge going up (18..23)
  [6, 5],
  [6, 4],
  [6, 3],
  [6, 2],
  [6, 1],
  [6, 0],
  // Top turn going right (24..25)
  [7, 0],
  [8, 0],
  // Green top arm right edge going down (26..30) - 26 is Green Start
  [8, 1],
  [8, 2],
  [8, 3],
  [8, 4],
  [8, 5],
  // Right arm top edge going right (31..36)
  [9, 6],
  [10, 6],
  [11, 6],
  [12, 6],
  [13, 6],
  [14, 6],
  // Right turn going down (37..38)
  [14, 7],
  [14, 8],
  // Yellow right arm bottom edge going left (39..43) - 39 is Yellow Start
  [13, 8],
  [12, 8],
  [11, 8],
  [10, 8],
  [9, 8],
  // Bottom arm right edge going down (44..49)
  [8, 9],
  [8, 10],
  [8, 11],
  [8, 12],
  [8, 13],
  [8, 14],
  // Bottom turn going left (50..51)
  [7, 14],
  [6, 14],
];

// Safe Zone Indices on the 52-cell main track (4 start cells + 4 star cells)
export const SAFE_TRACK_INDICES = new Set<number>([0, 8, 13, 21, 26, 34, 39, 47]);

// Home Stretch paths (5 colored tiles leading into the center finishing zone for each team)
export const HOME_STRETCH_GRID: Record<TeamColor, [number, number][]> = {
  red: [
    [7, 13],
    [7, 12],
    [7, 11],
    [7, 10],
    [7, 9],
  ],
  blue: [
    [1, 7],
    [2, 7],
    [3, 7],
    [4, 7],
    [5, 7],
  ],
  green: [
    [7, 1],
    [7, 2],
    [7, 3],
    [7, 4],
    [7, 5],
  ],
  yellow: [
    [13, 7],
    [12, 7],
    [11, 7],
    [10, 7],
    [9, 7],
  ],
};

// Central finishing victory positions per team (around the central dice crown)
export const FINISH_ZONE_GRID: Record<TeamColor, [number, number][]> = {
  red: [
    [6.6, 8.2],
    [7.0, 8.2],
    [7.4, 8.2],
    [7.0, 7.9],
  ],
  blue: [
    [5.8, 6.6],
    [5.8, 7.0],
    [5.8, 7.4],
    [6.1, 7.0],
  ],
  green: [
    [6.6, 5.8],
    [7.0, 5.8],
    [7.4, 5.8],
    [7.0, 6.1],
  ],
  yellow: [
    [8.2, 6.6],
    [8.2, 7.0],
    [8.2, 7.4],
    [7.9, 7.0],
  ],
};

// Home Base 4 circular spawn slots per team (matching the reference board layout!)
export const HOME_BASE_SLOTS_GRID: Record<TeamColor, [number, number][]> = {
  red: [
    [1.6, 10.6],
    [3.6, 10.6],
    [1.6, 12.6],
    [3.6, 12.6],
  ],
  blue: [
    [1.6, 1.6],
    [3.6, 1.6],
    [1.6, 3.6],
    [3.6, 3.6],
  ],
  green: [
    [10.4, 1.6],
    [12.4, 1.6],
    [10.4, 3.6],
    [12.4, 3.6],
  ],
  yellow: [
    [10.4, 10.6],
    [12.4, 10.6],
    [10.4, 12.6],
    [12.4, 12.6],
  ],
};

// Tactical Cover Crates / Barricades on the board (used for Line-of-Sight ray/segment checks)
export interface CoverObstacle {
  id: string;
  col: number;
  row: number;
  worldPos: Vec3;
  radius: number;
  kind: 'crate' | 'barrel' | 'sandbag';
}

export const TACTICAL_OBSTACLES: CoverObstacle[] = [
  { id: 'obs_1', col: 5.2, row: 9.2, worldPos: gridToWorld(5.2, 9.2), radius: 0.72, kind: 'crate' },
  { id: 'obs_2', col: 5.2, row: 4.8, worldPos: gridToWorld(5.2, 4.8), radius: 0.72, kind: 'crate' },
  { id: 'obs_3', col: 8.8, row: 4.8, worldPos: gridToWorld(8.8, 4.8), radius: 0.72, kind: 'crate' },
  { id: 'obs_4', col: 8.8, row: 9.2, worldPos: gridToWorld(8.8, 9.2), radius: 0.72, kind: 'barrel' },
];

// Tactical Cover Structures in the Dedicated Sky Flying Combat Arena
export interface SkyCoverSpot {
  id: string;
  name: string;
  kind: 'energy_shield' | 'blast_wall' | 'sky_bunker' | 'crystal_spire';
  worldPos: Vec3;
  radius: number;
  height: number;
  damageReduction: number;
}

export const SKY_WARZONE_COVERS: SkyCoverSpot[] = [
  // 4 Hexagonal Energy Shields (Center Perimeter)
  { id: 'sky_shield_1', name: 'Alpha Energy Shield', kind: 'energy_shield', worldPos: { x: -4.5, y: 3.2, z: 4.5 }, radius: 2.2, height: 2.6, damageReduction: 0.45 },
  { id: 'sky_shield_2', name: 'Bravo Energy Shield', kind: 'energy_shield', worldPos: { x: 4.5, y: 3.2, z: 4.5 }, radius: 2.2, height: 2.6, damageReduction: 0.45 },
  { id: 'sky_shield_3', name: 'Charlie Energy Shield', kind: 'energy_shield', worldPos: { x: -4.5, y: 3.2, z: -4.5 }, radius: 2.2, height: 2.6, damageReduction: 0.45 },
  { id: 'sky_shield_4', name: 'Delta Energy Shield', kind: 'energy_shield', worldPos: { x: 4.5, y: 3.2, z: -4.5 }, radius: 2.2, height: 2.6, damageReduction: 0.45 },

  // 4 Heavy Steel Blast Walls (Cardinal Defense Points)
  { id: 'sky_wall_s', name: 'South Blast Wall', kind: 'blast_wall', worldPos: { x: 0, y: 3.2, z: 6.2 }, radius: 2.4, height: 2.2, damageReduction: 0.40 },
  { id: 'sky_wall_n', name: 'North Blast Wall', kind: 'blast_wall', worldPos: { x: 0, y: 3.2, z: -6.2 }, radius: 2.4, height: 2.2, damageReduction: 0.40 },
  { id: 'sky_wall_w', name: 'West Blast Wall', kind: 'blast_wall', worldPos: { x: -6.2, y: 3.2, z: 0 }, radius: 2.4, height: 2.2, damageReduction: 0.40 },
  { id: 'sky_wall_e', name: 'East Blast Wall', kind: 'blast_wall', worldPos: { x: 6.2, y: 3.2, z: 0 }, radius: 2.4, height: 2.2, damageReduction: 0.40 },

  // 4 Floating Sky Bunkers (Diagonal Fortified Pods)
  { id: 'sky_bunker_sw', name: 'SW Sky Bunker', kind: 'sky_bunker', worldPos: { x: -8.0, y: 3.2, z: 8.0 }, radius: 2.6, height: 3.2, damageReduction: 0.50 },
  { id: 'sky_bunker_se', name: 'SE Sky Bunker', kind: 'sky_bunker', worldPos: { x: 8.0, y: 3.2, z: 8.0 }, radius: 2.6, height: 3.2, damageReduction: 0.50 },
  { id: 'sky_bunker_nw', name: 'NW Sky Bunker', kind: 'sky_bunker', worldPos: { x: -8.0, y: 3.2, z: -8.0 }, radius: 2.6, height: 3.2, damageReduction: 0.50 },
  { id: 'sky_bunker_ne', name: 'NE Sky Bunker', kind: 'sky_bunker', worldPos: { x: 8.0, y: 3.2, z: -8.0 }, radius: 2.6, height: 3.2, damageReduction: 0.50 },

  // 4 Monolith Crystal Spires (Outer High Cover)
  { id: 'sky_spire_s', name: 'South Crystal Spire', kind: 'crystal_spire', worldPos: { x: 0, y: 3.2, z: 12.0 }, radius: 2.0, height: 4.5, damageReduction: 0.35 },
  { id: 'sky_spire_n', name: 'North Crystal Spire', kind: 'crystal_spire', worldPos: { x: 0, y: 3.2, z: -12.0 }, radius: 2.0, height: 4.5, damageReduction: 0.35 },
  { id: 'sky_spire_w', name: 'West Crystal Spire', kind: 'crystal_spire', worldPos: { x: -12.0, y: 3.2, z: 0 }, radius: 2.0, height: 4.5, damageReduction: 0.35 },
  { id: 'sky_spire_e', name: 'East Crystal Spire', kind: 'crystal_spire', worldPos: { x: 12.0, y: 3.2, z: 0 }, radius: 2.0, height: 4.5, damageReduction: 0.35 },
];

// Open Sky Arena Starting Drop Zones per team (Spaced across the open sky field)
export const SKY_WARZONE_DROP_ZONES: Record<TeamColor, Vec3[]> = {
  red: [
    { x: -3.5, y: 3.2, z: 10.5 },
    { x: -1.2, y: 3.2, z: 11.2 },
    { x: 1.2, y: 3.2, z: 11.2 },
    { x: 3.5, y: 3.2, z: 10.5 },
  ],
  blue: [
    { x: -10.5, y: 3.2, z: -3.5 },
    { x: -11.2, y: 3.2, z: -1.2 },
    { x: -11.2, y: 3.2, z: 1.2 },
    { x: -10.5, y: 3.2, z: 3.5 },
  ],
  green: [
    { x: -3.5, y: 3.2, z: -10.5 },
    { x: -1.2, y: 3.2, z: -11.2 },
    { x: 1.2, y: 3.2, z: -11.2 },
    { x: 3.5, y: 3.2, z: -10.5 },
  ],
  yellow: [
    { x: 10.5, y: 3.2, z: -3.5 },
    { x: 11.2, y: 3.2, z: -1.2 },
    { x: 11.2, y: 3.2, z: 1.2 },
    { x: 10.5, y: 3.2, z: 3.5 },
  ],
};

export function getSkyCoverForPosition(pos: Vec3): SkyCoverSpot | null {
  for (const cov of SKY_WARZONE_COVERS) {
    const dist = Math.hypot(pos.x - cov.worldPos.x, pos.z - cov.worldPos.z);
    if (dist <= cov.radius) {
      return cov;
    }
  }
  return null;
}

export const WEAPONS: Record<WeaponType, WeaponSpec> = {
  ak47: {
    id: 'ak47',
    name: 'AK-47 Assault Rifle',
    damage: 10,
    shotsPerAction: 3, // 3-round tactical burst (30 total HP damage or 10 per bullet)
    magazineSize: 30,
    maxReserve: 90,
    rangeCells: 3.5,
    reloadSeconds: 2.0,
    description: 'Standard-issue 7.62mm automatic rifle. Fires 3 rounds per combat action (10 HP/bullet).',
  },
  pistol: {
    id: 'pistol',
    name: 'M9 Tactical Pistol',
    damage: 10,
    shotsPerAction: 2,
    magazineSize: 15,
    maxReserve: 60,
    rangeCells: 2.8,
    reloadSeconds: 1.2,
    description: 'Lightweight sidearm with rapid handling. Fires a double-tap burst.',
  },
  shotgun: {
    id: 'shotgun',
    name: 'M870 Combat Shotgun',
    damage: 45,
    shotsPerAction: 1,
    magazineSize: 8,
    maxReserve: 32,
    rangeCells: 2.2,
    reloadSeconds: 2.4,
    description: 'Devastating close-quarters scattergun dealing 45 HP within 2.2 cells.',
  },
  sniper: {
    id: 'sniper',
    name: 'AWM Sniper Rifle',
    damage: 55,
    shotsPerAction: 1,
    magazineSize: 5,
    maxReserve: 20,
    rangeCells: 6.5,
    reloadSeconds: 2.8,
    description: 'Long-range precision marksman rifle reaching up to 6.5 board cells.',
  },
};

export const ITEM_CATALOG: Record<
  ItemType,
  {
    id: ItemType;
    name: string;
    description: string;
    color: string;
  }
> = {
  health_kit: {
    id: 'health_kit',
    name: 'Health Kit',
    description: 'Restores +45 HP to the selected soldier.',
    color: '#22C55E',
  },
  armor: {
    id: 'armor',
    name: 'Kevlar Armor Plate',
    description: 'Adds +50 Armor that absorbs incoming bullet & blast damage.',
    color: '#3B82F6',
  },
  shield: {
    id: 'shield',
    name: 'Tactical Energy Shield',
    description: 'Projects a protective dome reducing incoming damage by 75% for 2 rounds.',
    color: '#06B6D4',
  },
  grenade: {
    id: 'grenade',
    name: 'M67 Frag Grenade',
    description: 'Deals 45 AoE explosive damage to enemies within 4 cells (ignores cover).',
    color: '#F59E0B',
  },
  ammo: {
    id: 'ammo',
    name: 'Ammunition Crate',
    description: 'Refills full magazine and +60 reserve ammunition.',
    color: '#EAB308',
  },
  weapon_upgrade: {
    id: 'weapon_upgrade',
    name: 'Rifle Mod Kit',
    description: 'Permanently boosts selected soldier weapon damage by +25%.',
    color: '#A855F7',
  },
  speed_boost: {
    id: 'speed_boost',
    name: 'Adrenaline Speed Boost',
    description: 'Adds +2 bonus steps to your next dice movement.',
    color: '#EC4899',
  },
  jump_pad: {
    id: 'jump_pad',
    name: 'Tactical Jump Pad',
    description: 'Launches soldier +3 cells forward over enemy blockades.',
    color: '#14B8A6',
  },
};

export const SHOP_SKINS: SkinItem[] = [
  {
    id: 'skin_standard',
    name: 'Spec-Ops Standard',
    category: 'character',
    priceCoins: 0,
    accentHex: '#EF4444',
    description: 'Default airborne commando uniform with tactical vest and ballistic cap.',
  },
  {
    id: 'skin_night_ops',
    name: 'Obsidian Night-Ops',
    category: 'character',
    priceCoins: 350,
    accentHex: '#38BDF8',
    description: 'Stealth carbon-black armor weave with high-contrast team trim.',
  },
  {
    id: 'skin_desert_storm',
    name: 'Vanguard Gold Trim',
    category: 'character',
    priceCoins: 600,
    accentHex: '#FACC15',
    description: 'Commander-grade tactical rig with gilded shoulder plates.',
  },
  {
    id: 'weapon_classic_wood',
    name: 'Classic Birch AK-47',
    category: 'weapon',
    priceCoins: 0,
    accentHex: '#B45309',
    description: 'Authentic stamped-steel receiver with laminated birchwood furniture.',
  },
  {
    id: 'weapon_gold_dragon',
    name: 'Warlord Gold AK-47',
    category: 'weapon',
    priceCoins: 500,
    accentHex: '#EAB308',
    description: '24-karat gold-plated barrel and receiver for arena champions.',
  },
  {
    id: 'weapon_cyber_crimson',
    name: 'Crimson Strike Camo',
    category: 'weapon',
    priceCoins: 400,
    accentHex: '#F43F5E',
    description: 'Anodized metallic red receiver with carbon-fiber handguard.',
  },
];

export const INITIAL_DAILY_MISSIONS: DailyMission[] = [
  {
    id: 'mission_match_deployment',
    title: 'Match Combat Air-Drop Supply (ম্যাচ ডিপ্লয়মেন্ট মিশন বোনাস)',
    target: 1,
    progress: 1,
    rewardCoins: 250,
    rewardXp: 150,
    claimed: false,
  },
  {
    id: 'mission_rolls',
    title: 'Roll the Dice 10 Times in Any Mode',
    target: 10,
    progress: 0,
    rewardCoins: 150,
    rewardXp: 100,
    claimed: false,
  },
  {
    id: 'mission_kills',
    title: 'Eliminate 3 Enemy Soldiers with Firearms or Grenades',
    target: 3,
    progress: 0,
    rewardCoins: 250,
    rewardXp: 200,
    claimed: false,
  },
  {
    id: 'mission_win',
    title: 'Win 1 Match in Classic or Battle Royale Mode',
    target: 1,
    progress: 0,
    rewardCoins: 400,
    rewardXp: 350,
    claimed: false,
  },
];

/**
 * Compute exact 3D position and global track index for a soldier given its team, index, state, and stepsMoved.
 */
export function computeSoldierBoardLocation(
  team: TeamColor,
  soldierIndex: number,
  stepsMoved: number,
): {
  state: 'base' | 'track' | 'stretch' | 'finished';
  trackTileIndex: number;
  worldPos: Vec3;
} {
  if (stepsMoved < 0) {
    const [col, row] = HOME_BASE_SLOTS_GRID[team][soldierIndex];
    return {
      state: 'base',
      trackTileIndex: -1,
      worldPos: gridToWorld(col, row, 0.12),
    };
  }

  if (stepsMoved >= 0 && stepsMoved <= 50) {
    const startIdx = TEAM_COLORS[team].startTrackIndex;
    const trackTileIndex = (startIdx + stepsMoved) % 52;
    const [col, row] = MAIN_TRACK_GRID[trackTileIndex];
    // Slight micro-offset by soldierIndex so stacked allies remain distinct
    const offsetAngle = (soldierIndex * Math.PI) / 2;
    const microOffset = 0.14;
    return {
      state: 'track',
      trackTileIndex,
      worldPos: {
        x: (col - 7) * TILE_SIZE + Math.cos(offsetAngle) * microOffset,
        y: BOARD_Y + 0.08,
        z: (row - 7) * TILE_SIZE + Math.sin(offsetAngle) * microOffset,
      },
    };
  }

  if (stepsMoved >= 51 && stepsMoved <= 55) {
    const stretchIdx = stepsMoved - 51;
    const [col, row] = HOME_STRETCH_GRID[team][stretchIdx];
    return {
      state: 'stretch',
      trackTileIndex: -1,
      worldPos: gridToWorld(col, row, 0.1),
    };
  }

  // stepsMoved >= 56 -> Finished in central crown area
  const [col, row] = FINISH_ZONE_GRID[team][soldierIndex];
  return {
    state: 'finished',
    trackTileIndex: -1,
    worldPos: gridToWorld(col, row, 0.2),
  };
}

/**
 * Calculate board cell distance between two 3D world positions.
 */
export function getCellDistance(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.hypot(dx, dz) / TILE_SIZE;
}

/**
 * Line of Sight check between shooter and target against tactical cover obstacles.
 */
export function checkLineOfSight(from: Vec3, to: Vec3): { clear: boolean; blockerId?: string } {
  const ax = from.x;
  const az = from.z;
  const bx = to.x;
  const bz = to.z;
  const abx = bx - ax;
  const abz = bz - az;
  const abLenSq = abx * abx + abz * abz;
  if (abLenSq < 0.0001) return { clear: true };

  for (const obs of TACTICAL_OBSTACLES) {
    const cx = obs.worldPos.x;
    const cz = obs.worldPos.z;
    const t = Math.max(0.1, Math.min(0.9, ((cx - ax) * abx + (cz - az) * abz) / abLenSq));
    const px = ax + t * abx;
    const pz = az + t * abz;
    const dist = Math.hypot(cx - px, cz - pz);
    if (dist < obs.radius * 0.65) {
      return { clear: false, blockerId: obs.id };
    }
  }
  return { clear: true };
}
