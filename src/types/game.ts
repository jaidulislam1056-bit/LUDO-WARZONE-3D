export type TeamColor = 'red' | 'blue' | 'green' | 'yellow';

export type GameMode =
  | 'classic'
  | 'battle_royale'
  | 'tdm'
  | 'zombie'
  | 'survival'
  | 'sky_warzone';

export type SkySquadSize = 'solo' | 'duo' | 'squad';

export type AIDifficulty = 'easy' | 'normal' | 'hard' | 'expert';

export type TurnPhase = 'DICE_PHASE' | 'MOVE_PHASE' | 'ACTION_PHASE' | 'TURN_END';

export type SoldierState = 'base' | 'track' | 'stretch' | 'finished' | 'dead';

export type SoldierAnimation =
  | 'idle'
  | 'walk'
  | 'run'
  | 'aim'
  | 'shoot'
  | 'reload'
  | 'jump'
  | 'hit'
  | 'death'
  | 'victory'
  | 'inspect'
  | 'grenade';

export type WeaponType = 'ak47' | 'pistol' | 'shotgun' | 'sniper';

export type ItemType =
  | 'health_kit'
  | 'armor'
  | 'shield'
  | 'grenade'
  | 'ammo'
  | 'weapon_upgrade'
  | 'speed_boost'
  | 'jump_pad';

export type CameraViewMode =
  | 'isometric'
  | 'shoulder'
  | 'follow'
  | 'top'
  | 'front'
  | 'orbit'
  | 'victory';

export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra';

export interface WeaponSpec {
  id: WeaponType;
  name: string;
  damage: number;
  shotsPerAction: number;
  magazineSize: number;
  maxReserve: number;
  rangeCells: number;
  reloadSeconds: number;
  description: string;
}

export interface InventoryItem {
  id: ItemType;
  name: string;
  count: number;
  description: string;
  color: string;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Soldier {
  id: string;
  team: TeamColor;
  index: number; // 0..3
  name: string;
  state: SoldierState;
  stepsMoved: number; // -1 = base, 0..50 = main track, 51..55 = stretch, 56 = finished
  trackTileIndex: number; // 0..51 when on main track, -1 otherwise
  worldPos: Vec3;
  targetWorldPos: Vec3;
  waypoints: Vec3[];
  rotationY: number;
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  shieldTurns: number;
  weapon: WeaponType;
  ammo: number;
  maxAmmo: number;
  reserveAmmo: number;
  damageBoost: number; // multiplier e.g. 1.0, 1.25
  speedBoostTurns: number;
  hasJumpPad: boolean;
  animState: SoldierAnimation;
  animTimer: number;
  kills: number;
  deaths: number;
  isFlying?: boolean;
  flightAltitude?: number;
}

export interface BoardLootBox {
  id: string;
  tileIndex: number;
  worldPos: Vec3;
  itemType: ItemType | WeaponType;
  isWeapon: boolean;
  isSupplyDrop: boolean;
  collected: boolean;
}

export interface ZombieUnit {
  id: string;
  name: string;
  trackTileIndex: number;
  worldPos: Vec3;
  targetWorldPos: Vec3;
  rotationY: number;
  hp: number;
  maxHp: number;
  damage: number;
  animState: 'walk' | 'attack' | 'death';
}

export interface ProjectileEffect {
  id: string;
  from: Vec3;
  to: Vec3;
  color: string;
  isGrenade?: boolean;
  createdAt: number;
}

export interface FloatingDamageText {
  id: string;
  worldPos: Vec3;
  text: string;
  color: string;
  createdAt: number;
}

export interface KillFeedEntry {
  id: string;
  killerName: string;
  killerTeam: TeamColor;
  victimName: string;
  victimTeam: TeamColor | 'zombie';
  weaponName: string;
  timestamp: number;
}

export interface DailyMission {
  id: string;
  title: string;
  target: number;
  progress: number;
  rewardCoins: number;
  rewardXp: number;
  claimed: boolean;
}

export interface SkinItem {
  id: string;
  name: string;
  category: 'character' | 'weapon';
  priceCoins: number;
  accentHex: string;
  description: string;
}

export interface PlayerProfileData {
  uid: string;
  displayName: string;
  xp: number;
  level: number;
  coins: number;
  kills: number;
  deaths: number;
  wins: number;
  matchesPlayed: number;
  selectedTeam: TeamColor;
  selectedSkin: string;
  selectedWeaponSkin: string;
  unlockedSkins: string[];
  achievements: string[];
}

export interface MatchHistoryItem {
  id: string;
  mode: GameMode;
  team: TeamColor;
  result: 'victory' | 'defeat';
  kills: number;
  deaths: number;
  coinsEarned: number;
  xpEarned: number;
  createdAt: string;
}

export interface MultiplayerRoomPlayer {
  id: string;
  name: string;
  team: TeamColor;
  ready: boolean;
  connected: boolean;
}

export interface MultiplayerRoomState {
  code: string;
  hostId: string;
  isPublic: boolean;
  mode: string;
  status: 'lobby' | 'playing' | 'finished';
  currentTurnTeam: TeamColor;
  turnPhase: string;
  lastDiceValue: number | null;
  players: MultiplayerRoomPlayer[];
}
