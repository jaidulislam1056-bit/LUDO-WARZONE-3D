import { create } from 'zustand';
import {
  AIDifficulty,
  BoardLootBox,
  CameraViewMode,
  DailyMission,
  FloatingDamageText,
  GameMode,
  InventoryItem,
  ItemType,
  KillFeedEntry,
  MatchHistoryItem,
  MultiplayerRoomState,
  PlayerProfileData,
  ProjectileEffect,
  QualityPreset,
  SkySquadSize,
  Soldier,
  SoldierAnimation,
  TeamColor,
  TurnPhase,
  Vec3,
  WeaponType,
  ZombieUnit,
} from '../types/game';
import {
  BOARD_Y,
  checkLineOfSight,
  computeSoldierBoardLocation,
  getCellDistance,
  getSkyCoverForPosition,
  INITIAL_DAILY_MISSIONS,
  ITEM_CATALOG,
  MAIN_TRACK_GRID,
  SAFE_TRACK_INDICES,
  SKY_WARZONE_COVERS,
  SKY_WARZONE_DROP_ZONES,
  TEAM_COLORS,
  TEAM_ORDER,
  TILE_SIZE,
  WEAPONS,
} from '../constants/boardData';
import { soundManager } from '../services/audio';
import {
  syncLoadoutToFirestore,
  syncMatchOutcomeToFirestore,
} from '../services/firebase';
import { multiplayerClient } from '../services/multiplayer';

export type ActiveModal =
  | 'none'
  | 'modes'
  | 'characters'
  | 'inventory'
  | 'shop'
  | 'profile'
  | 'multiplayer'
  | 'settings';

export type ScreenState = 'menu' | 'playing' | 'paused' | 'victory' | 'gameover';

function buildInitialSoldiers(
  mode: GameMode,
  skySquadSize: SkySquadSize = 'squad',
): Soldier[] {
  const list: Soldier[] = [];
  const teamsToSpawn: TeamColor[] =
    mode === 'tdm' ? ['red', 'blue'] : ['red', 'blue', 'green', 'yellow'];

  const maxSoldiersPerTeam =
    mode === 'sky_warzone'
      ? skySquadSize === 'solo'
        ? 1
        : skySquadSize === 'duo'
          ? 2
          : 4
      : 4;

  for (const team of teamsToSpawn) {
    for (let i = 0; i < maxSoldiersPerTeam; i++) {
      const isSky = mode === 'sky_warzone';
      const startDeployed = (mode === 'battle_royale' || mode === 'tdm' || isSky) && i === 0;
      const initialSteps = isSky ? i * 4 : startDeployed ? 0 : -1;
      const loc = computeSoldierBoardLocation(team, i, initialSteps);
      const spec = WEAPONS.ak47;

      let baseWorldPos = { ...loc.worldPos };
      if (isSky) {
        // Deploy across the dedicated open Sky Combat Field (Drop Zones)
        const dropPoints = SKY_WARZONE_DROP_ZONES[team] || SKY_WARZONE_DROP_ZONES.red;
        const pt = dropPoints[i % dropPoints.length];
        baseWorldPos = { x: pt.x, y: 3.2, z: pt.z };
      }

      list.push({
        id: `${team}_${i}`,
        team,
        index: i,
        name:
          isSky && skySquadSize === 'solo'
            ? `${TEAM_COLORS[team].name} Ace`
            : `${TEAM_COLORS[team].name.split(' ')[0]} #${i + 1}`,
        state: isSky ? 'track' : loc.state,
        stepsMoved: initialSteps,
        trackTileIndex: loc.trackTileIndex >= 0 ? loc.trackTileIndex : 0,
        worldPos: { ...baseWorldPos },
        targetWorldPos: { ...baseWorldPos },
        waypoints: [],
        rotationY:
          team === 'red'
            ? Math.PI
            : team === 'blue'
              ? Math.PI / 2
              : team === 'green'
                ? 0
                : -Math.PI / 2,
        hp: 100,
        maxHp: 100,
        armor: mode === 'battle_royale' || isSky ? 25 : 0,
        maxArmor: 100,
        shieldTurns: 0,
        weapon: 'ak47',
        ammo: spec.magazineSize,
        maxAmmo: spec.magazineSize,
        reserveAmmo: spec.maxReserve,
        damageBoost: 1.0,
        speedBoostTurns: 0,
        hasJumpPad: false,
        animState: 'idle',
        animTimer: 0,
        kills: 0,
        deaths: 0,
        isFlying: isSky,
        flightAltitude: isSky ? 3.2 : 0,
      });
    }
  }
  return list;
}

function generateInitialLootBoxes(): BoardLootBox[] {
  const lootIndices = [4, 11, 17, 24, 30, 37, 43, 50];
  const pool: (ItemType | WeaponType)[] = [
    'health_kit',
    'armor',
    'grenade',
    'shotgun',
    'sniper',
    'shield',
    'ammo',
    'weapon_upgrade',
  ];
  return lootIndices.map((tileIdx, i) => {
    const [col, row] = MAIN_TRACK_GRID[tileIdx];
    const item = pool[i % pool.length];
    const isWeapon = item === 'shotgun' || item === 'sniper' || item === 'pistol' || item === 'ak47';
    return {
      id: `loot_${tileIdx}_${i}`,
      tileIndex: tileIdx,
      worldPos: {
        x: (col - 7) * TILE_SIZE,
        y: BOARD_Y + 0.25,
        z: (row - 7) * TILE_SIZE,
      },
      itemType: item,
      isWeapon,
      isSupplyDrop: i % 3 === 0,
      collected: false,
    };
  });
}

function buildInitialInventory(): Record<ItemType, InventoryItem> {
  return {
    health_kit: { ...ITEM_CATALOG.health_kit, count: 2 },
    armor: { ...ITEM_CATALOG.armor, count: 1 },
    shield: { ...ITEM_CATALOG.shield, count: 1 },
    grenade: { ...ITEM_CATALOG.grenade, count: 2 },
    ammo: { ...ITEM_CATALOG.ammo, count: 2 },
    weapon_upgrade: { ...ITEM_CATALOG.weapon_upgrade, count: 1 },
    speed_boost: { ...ITEM_CATALOG.speed_boost, count: 1 },
    jump_pad: { ...ITEM_CATALOG.jump_pad, count: 1 },
  };
}

const DEFAULT_PROFILE: PlayerProfileData = {
  uid: 'guest_commander',
  displayName: 'Commander Red',
  xp: 250,
  level: 2,
  coins: 750,
  kills: 0,
  deaths: 0,
  wins: 0,
  matchesPlayed: 0,
  selectedTeam: 'red',
  selectedSkin: 'skin_standard',
  selectedWeaponSkin: 'weapon_classic_wood',
  unlockedSkins: ['skin_standard', 'weapon_classic_wood'],
  achievements: ['First Deployment'],
};

interface GameStoreState {
  screen: ScreenState;
  activeModal: ActiveModal;
  gameMode: GameMode;
  skySquadSize: SkySquadSize;
  aiDifficulty: AIDifficulty;
  qualityPreset: QualityPreset;
  cameraMode: CameraViewMode;
  cameraMenuOpen: boolean;
  isAimingMode: boolean;
  hudCollapsed: boolean;
  hasCompletedOnboarding: boolean;
  isLoadingScreenActive: boolean;

  // Player Profile & Persistence
  isAuthenticated: boolean;
  profile: PlayerProfileData;
  dailyMissions: DailyMission[];
  matchHistory: MatchHistoryItem[];

  // Multiplayer State
  isOnlineMatch: boolean;
  mpConnected: boolean;
  mpRoom: MultiplayerRoomState | null;
  mpError: string | null;

  // Match State
  playerTeam: TeamColor;
  humanTeams: TeamColor[];
  currentTurnTeam: TeamColor;
  turnPhase: TurnPhase;
  roundNumber: number;
  diceValue: number | null;
  isRollingDice: boolean;
  consecutiveSixes: number;
  bonusRollEarned: boolean;
  combatActionUsed: boolean;
  bannerMessage: string;

  // Entities
  soldiers: Soldier[];
  selectedSoldierId: string | null;
  validMoveSoldierIds: string[];
  targetableEnemyIds: string[];
  selectedTargetId: string | null;
  lootBoxes: BoardLootBox[];
  zombies: ZombieUnit[];
  zombieWave: number;
  inventory: Record<ItemType, InventoryItem>;

  // Battle Royale & Match Metrics
  safeZoneRadius: number; // in cells from center (max 11, shrinks in BR/Survival)
  dangerZoneWarning: string | null;
  teamScores: Record<TeamColor, number>;
  matchElapsedSec: number;
  winnerTeam: TeamColor | null;

  // Visual & Combat Effects
  projectiles: ProjectileEffect[];
  floatingTexts: FloatingDamageText[];
  killFeed: KillFeedEntry[];
  screenShake: number;
  hitMarkerActive: boolean;

  // Preview character animation in Character Select modal
  previewTeam: TeamColor;
  previewAnimation: SoldierAnimation;
  previewWeapon: WeaponType;

  // Actions
  setScreen: (screen: ScreenState) => void;
  setActiveModal: (modal: ActiveModal) => void;
  setGameMode: (mode: GameMode) => void;
  setSkySquadSize: (size: SkySquadSize) => void;
  setAIDifficulty: (diff: AIDifficulty) => void;
  setQualityPreset: (preset: QualityPreset) => void;
  setCameraMode: (mode: CameraViewMode) => void;
  setCameraMenuOpen: (open: boolean) => void;
  setHudCollapsed: (collapsed: boolean) => void;
  setHasCompletedOnboarding: (val: boolean) => void;
  setIsLoadingScreenActive: (val: boolean) => void;
  setPreviewTeam: (team: TeamColor) => void;
  setPreviewAnimation: (anim: SoldierAnimation) => void;
  setPreviewWeapon: (weapon: WeaponType) => void;

  // Profile & Shop Actions
  setAuthenticatedProfile: (profile: PlayerProfileData, isAuth: boolean) => void;
  setMatchHistory: (history: MatchHistoryItem[]) => void;
  updateDisplayName: (name: string) => void;
  selectTeamColor: (team: TeamColor) => void;
  buyOrEquipSkin: (skinId: string, category: 'character' | 'weapon', price: number) => void;
  claimDailyMission: (missionId: string) => void;
  hasUnclaimedMatchBonus: boolean;
  claimMatchDeploymentBonus: () => void;

  // Match Lifecycle & Core Gameplay
  startNewMatch: (options?: {
    mode?: GameMode;
    skySquadSize?: SkySquadSize;
    playerTeam?: TeamColor;
    humanTeams?: TeamColor[];
    isOnline?: boolean;
  }) => void;
  rollDice: (forcedValue?: number) => void;
  selectSoldier: (soldierId: string) => void;
  moveSelectedSoldier: (soldierId?: string) => void;
  selectTargetEnemy: (enemyId: string) => void;
  toggleAimMode: () => void;
  fireWeaponAtTarget: (targetId?: string) => void;
  reloadWeapon: () => void;
  throwGrenadeAtTarget: (targetId?: string) => void;
  useInventoryItem: (itemType: ItemType) => void;
  switchSoldierWeapon: (weapon: WeaponType) => void;
  triggerJumpAnimation: () => void;
  triggerInspectAnimation: () => void;
  nudgeSelectedSoldierFreeMove: (dx: number, dz: number) => void;
  endTurn: () => void;
  tickMatchTimer: () => void;

  // Multiplayer Room Sync
  setMpRoom: (room: MultiplayerRoomState | null) => void;
  setMpError: (err: string | null) => void;
  setMpConnected: (connected: boolean) => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  screen: 'menu',
  activeModal: 'none',
  gameMode: 'classic',
  skySquadSize: 'squad',
  aiDifficulty: 'normal',
  qualityPreset: 'high',
  cameraMode: 'isometric',
  cameraMenuOpen: false,
  isAimingMode: false,
  hudCollapsed: false,
  hasCompletedOnboarding: (() => {
    try {
      return localStorage.getItem('ludo_warzone_onboarded') === 'true';
    } catch {
      return false;
    }
  })(),
  isLoadingScreenActive: true,

  isAuthenticated: false,
  profile: DEFAULT_PROFILE,
  dailyMissions: INITIAL_DAILY_MISSIONS,
  matchHistory: [],

  isOnlineMatch: false,
  mpConnected: false,
  mpRoom: null,
  mpError: null,

  playerTeam: 'red',
  humanTeams: ['red'],
  currentTurnTeam: 'red',
  turnPhase: 'DICE_PHASE',
  roundNumber: 1,
  diceValue: null,
  isRollingDice: false,
  consecutiveSixes: 0,
  bonusRollEarned: false,
  combatActionUsed: false,
  hasUnclaimedMatchBonus: true,
  bannerMessage: 'Your Turn — Roll the Dice!',

  soldiers: buildInitialSoldiers('classic'),
  selectedSoldierId: 'red_0',
  validMoveSoldierIds: [],
  targetableEnemyIds: [],
  selectedTargetId: null,
  lootBoxes: generateInitialLootBoxes(),
  zombies: [],
  zombieWave: 1,
  inventory: buildInitialInventory(),

  safeZoneRadius: 11.5,
  dangerZoneWarning: null,
  teamScores: { red: 0, blue: 0, green: 0, yellow: 0 },
  matchElapsedSec: 0,
  winnerTeam: null,

  projectiles: [],
  floatingTexts: [],
  killFeed: [],
  screenShake: 0,
  hitMarkerActive: false,

  previewTeam: 'red',
  previewAnimation: 'idle',
  previewWeapon: 'ak47',

  setScreen: (screen) => {
    soundManager.play('click');
    set({ screen });
  },

  setActiveModal: (activeModal) => {
    soundManager.play('click');
    set({ activeModal });
  },

  setGameMode: (gameMode) => {
    soundManager.play('click');
    set({ gameMode });
  },

  setSkySquadSize: (skySquadSize) => {
    soundManager.play('click');
    set({ skySquadSize });
  },

  setAIDifficulty: (aiDifficulty) => {
    soundManager.play('click');
    set({ aiDifficulty });
  },

  setQualityPreset: (qualityPreset) => {
    soundManager.play('click');
    set({ qualityPreset });
  },

  setCameraMode: (cameraMode) => {
    soundManager.play('click');
    set({ cameraMode });
  },

  setCameraMenuOpen: (cameraMenuOpen) => set({ cameraMenuOpen }),

  setHudCollapsed: (hudCollapsed) => set({ hudCollapsed }),

  setHasCompletedOnboarding: (hasCompletedOnboarding) => {
    try {
      localStorage.setItem('ludo_warzone_onboarded', String(hasCompletedOnboarding));
    } catch {}
    set({ hasCompletedOnboarding });
  },

  setIsLoadingScreenActive: (isLoadingScreenActive) => set({ isLoadingScreenActive }),

  setPreviewTeam: (previewTeam) => {
    soundManager.play('click');
    set({ previewTeam });
  },

  setPreviewAnimation: (previewAnimation) => {
    soundManager.play('click');
    set({ previewAnimation });
  },

  setPreviewWeapon: (previewWeapon) => {
    soundManager.play('click');
    set({ previewWeapon });
  },

  setAuthenticatedProfile: (profile, isAuthenticated) => {
    set({
      profile,
      isAuthenticated,
      playerTeam: profile.selectedTeam,
      previewTeam: profile.selectedTeam,
    });
  },

  setMatchHistory: (matchHistory) => set({ matchHistory }),

  updateDisplayName: (name) => {
    const clean = name.trim().slice(0, 40) || 'Commander';
    const nextProfile = { ...get().profile, displayName: clean };
    set({ profile: nextProfile });
    if (get().isAuthenticated) {
      syncLoadoutToFirestore(nextProfile).catch(() => {});
    }
  },

  selectTeamColor: (team) => {
    soundManager.play('click');
    const nextProfile = { ...get().profile, selectedTeam: team };
    set({
      playerTeam: team,
      previewTeam: team,
      profile: nextProfile,
    });
    if (get().isAuthenticated) {
      syncLoadoutToFirestore(nextProfile).catch(() => {});
    }
  },

  buyOrEquipSkin: (skinId, category, price) => {
    const { profile, isAuthenticated } = get();
    const isUnlocked = profile.unlockedSkins.includes(skinId);
    if (!isUnlocked && profile.coins < price) return;

    soundManager.play('pickup');
    const unlockedSkins = isUnlocked
      ? profile.unlockedSkins
      : [...profile.unlockedSkins, skinId].slice(0, 20);
    const coins = isUnlocked ? profile.coins : profile.coins - price;

    const nextProfile: PlayerProfileData = {
      ...profile,
      coins,
      unlockedSkins,
      selectedSkin: category === 'character' ? skinId : profile.selectedSkin,
      selectedWeaponSkin: category === 'weapon' ? skinId : profile.selectedWeaponSkin,
    };

    set({ profile: nextProfile });
    if (isAuthenticated) {
      syncLoadoutToFirestore(nextProfile).catch(() => {});
    }
  },

  claimDailyMission: (missionId) => {
    const { dailyMissions, profile, isAuthenticated } = get();
    const targetMission = dailyMissions.find((m) => m.id === missionId);
    if (!targetMission || targetMission.claimed || targetMission.progress < targetMission.target) {
      return;
    }

    soundManager.play('pickup');
    const updatedMissions = dailyMissions.map((m) =>
      m.id === missionId ? { ...m, claimed: true } : m,
    );
    const nextXp = profile.xp + targetMission.rewardXp;
    const nextLevel = Math.max(1, Math.floor(nextXp / 500) + 1);
    const nextProfile: PlayerProfileData = {
      ...profile,
      coins: profile.coins + targetMission.rewardCoins,
      xp: nextXp,
      level: nextLevel,
    };

    set({ dailyMissions: updatedMissions, profile: nextProfile });
    if (isAuthenticated) {
      syncLoadoutToFirestore(nextProfile).catch(() => {});
    }
  },

  claimMatchDeploymentBonus: () => {
    const { dailyMissions, profile, isAuthenticated } = get();
    const deployMission = dailyMissions.find(
      (m) => m.id === 'mission_match_deployment' && !m.claimed,
    );
    if (!deployMission) return;

    soundManager.play('pickup');
    const updatedMissions = dailyMissions.map((m) =>
      m.id === 'mission_match_deployment' ? { ...m, claimed: true } : m,
    );
    const nextCoins = profile.coins + deployMission.rewardCoins;
    const nextXp = profile.xp + deployMission.rewardXp;
    const nextLevel = Math.max(1, Math.floor(nextXp / 500) + 1);
    const nextProfile: PlayerProfileData = {
      ...profile,
      coins: nextCoins,
      xp: nextXp,
      level: nextLevel,
    };

    set({
      dailyMissions: updatedMissions,
      profile: nextProfile,
      hasUnclaimedMatchBonus: false,
      floatingTexts: [
        ...get().floatingTexts,
        {
          id: `bonus_claim_${Date.now()}`,
          worldPos: { x: 0, y: 5.5, z: 0 },
          text: `+${deployMission.rewardCoins} MATCH BONUS COINS!`,
          color: '#FACC15',
          createdAt: Date.now(),
        },
      ],
      bannerMessage: `Claimed +${deployMission.rewardCoins} Match Combat Coins!`,
    });

    if (isAuthenticated) {
      syncLoadoutToFirestore(nextProfile).catch(() => {});
    }
  },

  startNewMatch: (options) => {
    const state = get();
    const mode = options?.mode ?? state.gameMode;
    const skySquadSize = options?.skySquadSize ?? state.skySquadSize;
    const playerTeam = options?.playerTeam ?? state.playerTeam;
    const humanTeams = options?.humanTeams ?? [playerTeam];
    const isOnline = options?.isOnline ?? false;

    soundManager.play('click');
    const initialSoldiers = buildInitialSoldiers(mode, skySquadSize);
    const firstTurn: TeamColor = humanTeams.includes(playerTeam) ? playerTeam : 'red';
    const initialZombies: ZombieUnit[] =
      mode === 'zombie'
        ? [0, 13, 26, 39].map((tileIdx, idx) => {
            const [col, row] = MAIN_TRACK_GRID[tileIdx];
            const pos = {
              x: (col - 7) * TILE_SIZE,
              y: BOARD_Y + 0.08,
              z: (row - 7) * TILE_SIZE,
            };
            return {
              id: `zombie_w1_${idx}`,
              name: `Infected #${idx + 1}`,
              trackTileIndex: tileIdx,
              worldPos: { ...pos },
              targetWorldPos: { ...pos },
              rotationY: 0,
              hp: 60,
              maxHp: 60,
              damage: 15,
              animState: 'walk',
            };
          })
        : [];

    // Ensure Match Deployment Mission is active and ready to claim every match
    const existingMissions = state.dailyMissions;
    const hasDeployMission = existingMissions.some((m) => m.id === 'mission_match_deployment');
    const refreshedMissions = hasDeployMission
      ? existingMissions.map((m) =>
          m.id === 'mission_match_deployment'
            ? { ...m, progress: 1, target: 1, claimed: false }
            : m,
        )
      : [
          {
            id: 'mission_match_deployment',
            title: 'Match Combat Air-Drop Supply (ম্যাচ ডিপ্লয়মেন্ট মিশন বোনাস)',
            target: 1,
            progress: 1,
            rewardCoins: 250,
            rewardXp: 150,
            claimed: false,
          },
          ...existingMissions,
        ];

    set({
      screen: 'playing',
      activeModal: 'none',
      gameMode: mode,
      playerTeam,
      humanTeams,
      isOnlineMatch: isOnline,
      currentTurnTeam: firstTurn,
      turnPhase: 'DICE_PHASE',
      roundNumber: 1,
      diceValue: null,
      isRollingDice: false,
      consecutiveSixes: 0,
      bonusRollEarned: false,
      combatActionUsed: false,
      hasUnclaimedMatchBonus: true,
      dailyMissions: refreshedMissions,
      bannerMessage:
        firstTurn === playerTeam
          ? 'Your Turn — Roll the Dice!'
          : `${TEAM_COLORS[firstTurn].name} Turn`,
      soldiers: initialSoldiers,
      selectedSoldierId: `${playerTeam}_0`,
      validMoveSoldierIds: [],
      targetableEnemyIds: [],
      selectedTargetId: null,
      lootBoxes: generateInitialLootBoxes(),
      zombies: initialZombies,
      zombieWave: 1,
      inventory: buildInitialInventory(),
      safeZoneRadius: 11.5,
      dangerZoneWarning: null,
      teamScores: { red: 0, blue: 0, green: 0, yellow: 0 },
      matchElapsedSec: 0,
      winnerTeam: null,
      projectiles: [],
      floatingTexts: [],
      killFeed: [],
      isAimingMode: false,
    });
  },

  rollDice: (forcedValue) => {
    const state = get();
    if (state.screen !== 'playing') return;
    if (state.turnPhase !== 'DICE_PHASE' || state.isRollingDice) return;

    // If online match and not forced from server, ask server for authoritative roll
    if (state.isOnlineMatch && forcedValue === undefined) {
      multiplayerClient.requestAuthoritativeRoll();
      return;
    }

    soundManager.play('dice');
    set({ isRollingDice: true, bannerMessage: 'Rolling Tactical Dice...' });

    const rolled = forcedValue ?? Math.floor(Math.random() * 6) + 1;

    // Increment daily mission for dice rolls if human player's turn
    if (state.humanTeams.includes(state.currentTurnTeam)) {
      const updatedMissions = state.dailyMissions.map((m) =>
        m.id === 'mission_rolls' ? { ...m, progress: Math.min(m.target, m.progress + 1) } : m,
      );
      set({ dailyMissions: updatedMissions });
    }

    setTimeout(() => {
      const current = get();
      if (current.screen !== 'playing') return;

      const activeTeam = current.currentTurnTeam;
      const newConsecutiveSixes = rolled === 6 ? current.consecutiveSixes + 1 : 0;

      // Three consecutive 6s forfeits movement per traditional Ludo rules
      if (newConsecutiveSixes >= 3) {
        set({
          diceValue: rolled,
          isRollingDice: false,
          consecutiveSixes: 0,
          bonusRollEarned: false,
          turnPhase: 'ACTION_PHASE',
          bannerMessage: 'Triple 6 Rolled! Movement forfeited — Combat Action Phase!',
        });
        recomputeCombatTargets();
        scheduleAIIfNeeded();
        return;
      }

      // Find all eligible soldiers of activeTeam that can legally move `rolled` steps
      const teamSoldiers = current.soldiers.filter(
        (s) => s.team === activeTeam && s.state !== 'dead' && s.state !== 'finished',
      );

      const validIds: string[] = [];
      for (const s of teamSoldiers) {
        const bonusSteps = s.speedBoostTurns > 0 ? 2 : 0;
        if (s.state === 'base') {
          // Rule 2: A soldier can leave home base when the dice shows 6
          // (Also allow leaving on 1 or 6 in fast Battle Royale / TDM modes if no soldier is on the track yet)
          const hasActiveOnTrack = teamSoldiers.some(
            (ally) => ally.state === 'track' || ally.state === 'stretch',
          );
          if (
            rolled === 6 ||
            ((current.gameMode === 'battle_royale' || current.gameMode === 'tdm') &&
              !hasActiveOnTrack &&
              rolled >= 4)
          ) {
            validIds.push(s.id);
          }
        } else {
          // On track or stretch: check exact finishing bound (stepsMoved + rolled <= 56)
          if (s.stepsMoved + rolled + bonusSteps <= 56) {
            validIds.push(s.id);
          } else if (s.stepsMoved + rolled <= 56) {
            validIds.push(s.id);
          }
        }
      }

      if (validIds.length === 0) {
        // No legal Ludo move available -> go directly to Action Phase so deployed soldiers can still fight or use items!
        set({
          diceValue: rolled,
          isRollingDice: false,
          consecutiveSixes: newConsecutiveSixes,
          bonusRollEarned: false,
          validMoveSoldierIds: [],
          turnPhase: 'ACTION_PHASE',
          bannerMessage: `Rolled ${rolled} — No eligible move. Combat Action Phase!`,
        });
        recomputeCombatTargets();
        scheduleAIIfNeeded();
        return;
      }

      const preferredSelection = validIds.includes(current.selectedSoldierId || '')
        ? current.selectedSoldierId
        : validIds[0];

      set({
        diceValue: rolled,
        isRollingDice: false,
        consecutiveSixes: newConsecutiveSixes,
        bonusRollEarned: rolled === 6,
        validMoveSoldierIds: validIds,
        selectedSoldierId: preferredSelection,
        turnPhase: 'MOVE_PHASE',
        bannerMessage:
          validIds.length === 1
            ? `Rolled ${rolled}! Moving ${preferredSelection?.toUpperCase()}...`
            : `Rolled ${rolled}! Select a highlighted soldier to move.`,
      });

      // Auto-move if only 1 eligible soldier for snappier gameplay, or if AI
      if (validIds.length === 1 && current.humanTeams.includes(activeTeam)) {
        setTimeout(() => {
          const st = get();
          if (st.turnPhase === 'MOVE_PHASE' && st.validMoveSoldierIds.length === 1) {
            st.moveSelectedSoldier(validIds[0]);
          }
        }, 420);
      } else {
        scheduleAIIfNeeded();
      }
    }, 650);
  },

  selectSoldier: (soldierId) => {
    const state = get();
    const soldier = state.soldiers.find((s) => s.id === soldierId);
    if (!soldier || soldier.state === 'dead') return;

    soundManager.play('click');
    set({ selectedSoldierId: soldierId });

    if (
      state.turnPhase === 'MOVE_PHASE' &&
      soldier.team === state.currentTurnTeam &&
      state.validMoveSoldierIds.includes(soldierId) &&
      state.humanTeams.includes(state.currentTurnTeam)
    ) {
      state.moveSelectedSoldier(soldierId);
    } else if (state.turnPhase === 'ACTION_PHASE' && soldier.team === state.currentTurnTeam) {
      recomputeCombatTargets(soldierId);
    }
  },

  moveSelectedSoldier: (explicitSoldierId) => {
    const state = get();
    if (state.turnPhase !== 'MOVE_PHASE' || state.diceValue === null) return;

    const targetId = explicitSoldierId || state.selectedSoldierId || state.validMoveSoldierIds[0];
    if (!targetId || !state.validMoveSoldierIds.includes(targetId)) return;

    const soldier = state.soldiers.find((s) => s.id === targetId);
    if (!soldier) return;

    const rolled = state.diceValue;
    let nextSteps = soldier.stepsMoved;
    const waypoints: Vec3[] = [];

    if (soldier.state === 'base') {
      // Enter starting cell (stepsMoved = 0)
      nextSteps = 0;
      const loc = computeSoldierBoardLocation(soldier.team, soldier.index, 0);
      waypoints.push(loc.worldPos);
    } else {
      const extraBoost =
        soldier.speedBoostTurns > 0 && soldier.stepsMoved + rolled + 2 <= 56 ? 2 : 0;
      const totalDelta = rolled + extraBoost;
      for (let step = 1; step <= totalDelta; step++) {
        const sVal = Math.min(56, soldier.stepsMoved + step);
        const wpLoc = computeSoldierBoardLocation(soldier.team, soldier.index, sVal);
        waypoints.push(wpLoc.worldPos);
      }
      nextSteps = Math.min(56, soldier.stepsMoved + totalDelta);
    }

    const finalLoc = computeSoldierBoardLocation(soldier.team, soldier.index, nextSteps);
    soundManager.play('footstep');

    // Check Ludo capture on non-safe main track tile
    let capturedEnemyName: string | null = null;
    let bonusCaptureRoll = false;

    const updatedSoldiers = state.soldiers.map((s) => {
      if (s.id === soldier.id) {
        const dx = finalLoc.worldPos.x - s.worldPos.x;
        const dz = finalLoc.worldPos.z - s.worldPos.z;
        const rot = Math.hypot(dx, dz) > 0.01 ? Math.atan2(dx, dz) : s.rotationY;
        const targetPos = s.isFlying ? { ...finalLoc.worldPos, y: 3.2 } : finalLoc.worldPos;
        const flyingWaypoints = s.isFlying
          ? waypoints.map((w) => ({ ...w, y: 3.2 }))
          : waypoints;
        return {
          ...s,
          state: finalLoc.state,
          stepsMoved: nextSteps,
          trackTileIndex: finalLoc.trackTileIndex,
          targetWorldPos: targetPos,
          waypoints: flyingWaypoints,
          rotationY: rot,
          speedBoostTurns: Math.max(0, s.speedBoostTurns - 1),
          animState: (s.isFlying ? 'run' : rolled >= 4 ? 'run' : 'walk') as SoldierAnimation,
          animTimer: 0.7,
        };
      }
      return s;
    });

    // Apply traditional Ludo capture / melee takedown if landing on an enemy on a non-safe cell
    if (
      finalLoc.state === 'track' &&
      finalLoc.trackTileIndex >= 0 &&
      !SAFE_TRACK_INDICES.has(finalLoc.trackTileIndex)
    ) {
      const enemiesOnTile = updatedSoldiers.filter(
        (e) =>
          e.team !== soldier.team &&
          e.state === 'track' &&
          e.trackTileIndex === finalLoc.trackTileIndex,
      );
      if (enemiesOnTile.length === 1) {
        const victim = enemiesOnTile[0];
        capturedEnemyName = victim.name;
        bonusCaptureRoll = true;
        soundManager.play('impact');

        for (let i = 0; i < updatedSoldiers.length; i++) {
          if (updatedSoldiers[i].id === victim.id) {
            if (state.gameMode === 'battle_royale') {
              updatedSoldiers[i] = {
                ...victim,
                hp: 0,
                state: 'dead',
                animState: 'death',
                deaths: victim.deaths + 1,
              };
            } else {
              const baseLoc = computeSoldierBoardLocation(victim.team, victim.index, -1);
              updatedSoldiers[i] = {
                ...victim,
                hp: 100,
                state: 'base',
                stepsMoved: -1,
                trackTileIndex: -1,
                worldPos: { ...baseLoc.worldPos },
                targetWorldPos: { ...baseLoc.worldPos },
                waypoints: [],
                animState: 'hit',
                deaths: victim.deaths + 1,
              };
            }
          }
          if (updatedSoldiers[i].id === soldier.id) {
            updatedSoldiers[i] = {
              ...updatedSoldiers[i],
              kills: updatedSoldiers[i].kills + 1,
            };
          }
        }
      }
    }

    // Check Loot Box Pickup on the destination tile
    let pickedUpLabel: string | null = null;
    const nextInventory = { ...state.inventory };
    const nextLootBoxes = state.lootBoxes.map((box) => {
      if (!box.collected && finalLoc.trackTileIndex === box.tileIndex) {
        soundManager.play('pickup');
        pickedUpLabel = box.itemType.toUpperCase().replace('_', ' ');
        if (box.isWeapon) {
          const wType = box.itemType as WeaponType;
          const wSpec = WEAPONS[wType];
          for (let i = 0; i < updatedSoldiers.length; i++) {
            if (updatedSoldiers[i].id === soldier.id) {
              updatedSoldiers[i] = {
                ...updatedSoldiers[i],
                weapon: wType,
                ammo: wSpec.magazineSize,
                maxAmmo: wSpec.magazineSize,
                reserveAmmo: wSpec.maxReserve,
              };
            }
          }
        } else {
          const iType = box.itemType as ItemType;
          if (nextInventory[iType]) {
            nextInventory[iType] = {
              ...nextInventory[iType],
              count: nextInventory[iType].count + 1,
            };
          }
        }
        return { ...box, collected: true };
      }
      return box;
    });

    const newFloating: FloatingDamageText[] = [...state.floatingTexts];
    if (capturedEnemyName) {
      newFloating.push({
        id: `cap_${Date.now()}`,
        worldPos: { ...finalLoc.worldPos, y: finalLoc.worldPos.y + 1.8 },
        text: `CAPTURED ${capturedEnemyName}!`,
        color: '#FACC15',
        createdAt: Date.now(),
      });
    }
    if (pickedUpLabel) {
      newFloating.push({
        id: `loot_${Date.now()}`,
        worldPos: { ...finalLoc.worldPos, y: finalLoc.worldPos.y + 1.4 },
        text: `+ ${pickedUpLabel}`,
        color: '#4ADE80',
        createdAt: Date.now(),
      });
    }

    if (state.isOnlineMatch) {
      multiplayerClient.send({
        type: 'game:move_soldier',
        soldierId: soldier.id,
        diceValue: rolled,
      });
    }

    set({
      soldiers: updatedSoldiers,
      selectedSoldierId: soldier.id,
      validMoveSoldierIds: [],
      lootBoxes: nextLootBoxes,
      inventory: nextInventory,
      floatingTexts: newFloating,
      bonusRollEarned: state.bonusRollEarned || bonusCaptureRoll || finalLoc.state === 'finished',
      turnPhase: 'ACTION_PHASE',
      bannerMessage: 'Phase 2: Combat Action — Aim & Fire, Use Item, or End Turn!',
    });

    checkVictoryConditions();
    recomputeCombatTargets(soldier.id);
    scheduleAIIfNeeded();
  },

  selectTargetEnemy: (enemyId) => {
    soundManager.play('click');
    set({ selectedTargetId: enemyId });
  },

  toggleAimMode: () => {
    const state = get();
    const nextAim = !state.isAimingMode;
    soundManager.play('click');
    set({
      isAimingMode: nextAim,
      cameraMode: nextAim ? 'shoulder' : 'isometric',
    });
  },

  fireWeaponAtTarget: (explicitTargetId) => {
    const state = get();
    if (state.screen !== 'playing' || state.turnPhase !== 'ACTION_PHASE' || state.combatActionUsed) {
      return;
    }

    const shooter = state.soldiers.find((s) => s.id === state.selectedSoldierId);
    if (!shooter || shooter.team !== state.currentTurnTeam || shooter.state === 'dead') return;

    const weaponSpec = WEAPONS[shooter.weapon];
    if (shooter.ammo <= 0) {
      set({ bannerMessage: 'Out of Ammo! Press Reload (R)!' });
      return;
    }

    const targetId = explicitTargetId || state.selectedTargetId || state.targetableEnemyIds[0];
    if (!targetId) {
      set({ bannerMessage: 'No enemy in weapon range / line of sight!' });
      return;
    }

    // Check if target is a Zombie (in Zombie mode) or an enemy Soldier
    const zombieTarget = state.zombies.find((z) => z.id === targetId);
    const enemySoldier = state.soldiers.find((s) => s.id === targetId && s.state !== 'dead');

    if (!zombieTarget && !enemySoldier) return;

    const targetPos = zombieTarget ? zombieTarget.targetWorldPos : enemySoldier!.targetWorldPos;
    const distCells = getCellDistance(shooter.targetWorldPos, targetPos);
    if (distCells > weaponSpec.rangeCells + 0.4) {
      set({ bannerMessage: `Target out of range (${distCells.toFixed(1)} / ${weaponSpec.rangeCells} cells)!` });
      return;
    }

    const los = checkLineOfSight(shooter.targetWorldPos, targetPos);
    if (!los.clear) {
      set({ bannerMessage: 'Line of Sight blocked by tactical cover obstacle!' });
      return;
    }

    // Play weapon sound
    soundManager.play(shooter.weapon);
    setTimeout(() => soundManager.play('impact'), 140);

    const shotsFired = Math.min(shooter.ammo, weaponSpec.shotsPerAction);
    const rawDamage = Math.round(weaponSpec.damage * shotsFired * shooter.damageBoost);

    const dx = targetPos.x - shooter.targetWorldPos.x;
    const dz = targetPos.z - shooter.targetWorldPos.z;
    const aimRotation = Math.atan2(dx, dz);

    const proj: ProjectileEffect = {
      id: `proj_${Date.now()}`,
      from: {
        x: shooter.targetWorldPos.x,
        y: shooter.targetWorldPos.y + 0.85,
        z: shooter.targetWorldPos.z,
      },
      to: {
        x: targetPos.x,
        y: targetPos.y + 0.75,
        z: targetPos.z,
      },
      color: '#FACC15',
      createdAt: Date.now(),
    };

    if (zombieTarget) {
      const nextHp = Math.max(0, zombieTarget.hp - rawDamage);
      const killed = nextHp === 0;
      const nextZombies = state.zombies
        .map((z) =>
          z.id === zombieTarget.id
            ? { ...z, hp: nextHp, animState: (killed ? 'death' : 'walk') as 'walk' | 'death' }
            : z,
        )
        .filter((z) => z.hp > 0);

      const nextSoldiers = state.soldiers.map((s) =>
        s.id === shooter.id
          ? {
              ...s,
              ammo: s.ammo - shotsFired,
              rotationY: aimRotation,
              animState: 'shoot' as SoldierAnimation,
              animTimer: 0.6,
              kills: killed ? s.kills + 1 : s.kills,
            }
          : s,
      );

      set({
        soldiers: nextSoldiers,
        zombies: nextZombies,
        combatActionUsed: true,
        projectiles: [...state.projectiles, proj],
        floatingTexts: [
          ...state.floatingTexts,
          {
            id: `dmg_${Date.now()}`,
            worldPos: { ...targetPos, y: targetPos.y + 1.5 },
            text: killed ? `-${rawDamage} HP (ELIMINATED!)` : `-${rawDamage} HP`,
            color: killed ? '#EF4444' : '#FACC15',
            createdAt: Date.now(),
          },
        ],
        hitMarkerActive: true,
        screenShake: 0.35,
        bannerMessage: killed
          ? `Eliminated ${zombieTarget.name} with ${weaponSpec.name}!`
          : `Hit ${zombieTarget.name} for ${rawDamage} DMG!`,
      });

      setTimeout(() => set({ hitMarkerActive: false }), 250);
      setTimeout(() => {
        if (get().turnPhase === 'ACTION_PHASE') get().endTurn();
      }, 950);
      return;
    }

    // Enemy Soldier Damage Calculation (Safe Zone cover, Energy Shield, Armor, HP)
    const target = enemySoldier!;
    const onSafeTile =
      target.state === 'track' &&
      target.trackTileIndex >= 0 &&
      SAFE_TRACK_INDICES.has(target.trackTileIndex);
    let effectiveDamage = onSafeTile ? Math.ceil(rawDamage * 0.5) : rawDamage;

    // Check tactical cover spots in Sky Warzone
    const skyCover = state.gameMode === 'sky_warzone' ? getSkyCoverForPosition(target.targetWorldPos) : null;
    if (skyCover) {
      effectiveDamage = Math.ceil(effectiveDamage * (1 - skyCover.damageReduction));
    }

    if (target.shieldTurns > 0) {
      effectiveDamage = Math.ceil(effectiveDamage * 0.25);
    }

    const armorAbsorbed = Math.min(target.armor, effectiveDamage);
    const hpDamage = effectiveDamage - armorAbsorbed;
    const nextArmor = target.armor - armorAbsorbed;
    const nextHp = Math.max(0, target.hp - hpDamage);
    const eliminated = nextHp === 0;

    const nextTeamScores = { ...state.teamScores };
    const nextKillFeed = [...state.killFeed];

    if (eliminated) {
      nextTeamScores[shooter.team] = (nextTeamScores[shooter.team] || 0) + 1;
      nextKillFeed.unshift({
        id: `kf_${Date.now()}`,
        killerName: shooter.name,
        killerTeam: shooter.team,
        victimName: target.name,
        victimTeam: target.team,
        weaponName: weaponSpec.name,
        timestamp: Date.now(),
      });

      if (state.humanTeams.includes(shooter.team)) {
        const updatedMissions = state.dailyMissions.map((m) =>
          m.id === 'mission_kills' ? { ...m, progress: Math.min(m.target, m.progress + 1) } : m,
        );
        set({ dailyMissions: updatedMissions });
      }
    }

    const nextSoldiers = state.soldiers.map((s) => {
      if (s.id === shooter.id) {
        return {
          ...s,
          ammo: s.ammo - shotsFired,
          rotationY: aimRotation,
          animState: 'shoot' as SoldierAnimation,
          animTimer: 0.65,
          kills: eliminated ? s.kills + 1 : s.kills,
        };
      }
      if (s.id === target.id) {
        if (!eliminated) {
          return {
            ...s,
            hp: nextHp,
            armor: nextArmor,
            animState: 'hit' as SoldierAnimation,
            animTimer: 0.5,
          };
        }
        // Eliminated! Apply Game Mode respawn rules:
        if (state.gameMode === 'battle_royale' || state.gameMode === 'survival') {
          return {
            ...s,
            hp: 0,
            armor: 0,
            state: 'dead' as const,
            animState: 'death' as SoldierAnimation,
            animTimer: 2.0,
            deaths: s.deaths + 1,
          };
        } else {
          // Classic / TDM / Zombie: Soldier respawns at Home Base with 100 HP
          const baseLoc = computeSoldierBoardLocation(s.team, s.index, -1);
          return {
            ...s,
            hp: 100,
            armor: 0,
            state: 'base' as const,
            stepsMoved: -1,
            trackTileIndex: -1,
            worldPos: { ...baseLoc.worldPos },
            targetWorldPos: { ...baseLoc.worldPos },
            waypoints: [],
            animState: 'hit' as SoldierAnimation,
            animTimer: 0.8,
            deaths: s.deaths + 1,
          };
        }
      }
      return s;
    });

    set({
      soldiers: nextSoldiers,
      teamScores: nextTeamScores,
      killFeed: nextKillFeed.slice(0, 6),
      combatActionUsed: true,
      projectiles: [...state.projectiles, proj],
      floatingTexts: [
        ...state.floatingTexts,
        {
          id: `dmg_${Date.now()}`,
          worldPos: { ...targetPos, y: targetPos.y + 1.55 },
          text: eliminated ? `ELIMINATED! (-${effectiveDamage})` : `-${effectiveDamage} HP`,
          color: eliminated ? '#EF4444' : '#FACC15',
          createdAt: Date.now(),
        },
      ],
      hitMarkerActive: true,
      screenShake: eliminated ? 0.55 : 0.3,
      bannerMessage: eliminated
        ? `${shooter.name} eliminated ${target.name} with ${weaponSpec.name}!`
        : `${shooter.name} hit ${target.name} for ${effectiveDamage} damage!`,
    });

    setTimeout(() => set({ hitMarkerActive: false }), 260);
    checkVictoryConditions();

    setTimeout(() => {
      if (get().screen === 'playing' && get().turnPhase === 'ACTION_PHASE') {
        get().endTurn();
      }
    }, 950);
  },

  reloadWeapon: () => {
    const state = get();
    if (state.screen !== 'playing') return;
    const soldier = state.soldiers.find((s) => s.id === state.selectedSoldierId);
    if (!soldier || soldier.team !== state.currentTurnTeam) return;

    const spec = WEAPONS[soldier.weapon];
    if (soldier.ammo >= spec.magazineSize || soldier.reserveAmmo <= 0) return;

    soundManager.play('reload');
    const needed = spec.magazineSize - soldier.ammo;
    const loaded = Math.min(needed, soldier.reserveAmmo);

    const nextSoldiers = state.soldiers.map((s) =>
      s.id === soldier.id
        ? {
            ...s,
            ammo: s.ammo + loaded,
            reserveAmmo: s.reserveAmmo - loaded,
            animState: 'reload' as SoldierAnimation,
            animTimer: 1.1,
          }
        : s,
    );

    set({
      soldiers: nextSoldiers,
      floatingTexts: [
        ...state.floatingTexts,
        {
          id: `rel_${Date.now()}`,
          worldPos: { ...soldier.targetWorldPos, y: soldier.targetWorldPos.y + 1.5 },
          text: `RELOADED +${loaded}`,
          color: '#60A5FA',
          createdAt: Date.now(),
        },
      ],
      bannerMessage: `${soldier.name} reloaded ${spec.name} (${soldier.ammo + loaded}/${spec.magazineSize})`,
    });
  },

  throwGrenadeAtTarget: (explicitTargetId) => {
    const state = get();
    if (state.screen !== 'playing' || state.turnPhase !== 'ACTION_PHASE' || state.combatActionUsed) {
      return;
    }
    if (state.inventory.grenade.count <= 0) {
      set({ bannerMessage: 'No Frag Grenades remaining in inventory!' });
      return;
    }

    const thrower = state.soldiers.find((s) => s.id === state.selectedSoldierId);
    if (!thrower || thrower.team !== state.currentTurnTeam) return;

    const targetId = explicitTargetId || state.selectedTargetId || state.targetableEnemyIds[0];
    const targetEnemy =
      state.soldiers.find((s) => s.id === targetId && s.state !== 'dead') ||
      state.soldiers.find(
        (s) =>
          s.team !== thrower.team &&
          s.state !== 'dead' &&
          s.state !== 'base' &&
          getCellDistance(thrower.targetWorldPos, s.targetWorldPos) <= 4.5,
      );

    if (!targetEnemy) {
      set({ bannerMessage: 'No enemy within Grenade throwing range (4.5 cells)!' });
      return;
    }

    soundManager.play('grenade');
    const blastCenter = { ...targetEnemy.targetWorldPos };
    const grenadeDamage = 45;

    const nextSoldiers = state.soldiers.map((s) => {
      if (s.id === thrower.id) {
        return {
          ...s,
          animState: 'grenade' as SoldierAnimation,
          animTimer: 0.85,
        };
      }
      if (s.team !== thrower.team && s.state !== 'dead' && s.state !== 'base') {
        const d = getCellDistance(blastCenter, s.targetWorldPos);
        if (d <= 1.8) {
          const nextHp = Math.max(0, s.hp - grenadeDamage);
          if (nextHp === 0) {
            if (state.gameMode === 'battle_royale' || state.gameMode === 'survival') {
              return { ...s, hp: 0, state: 'dead' as const, animState: 'death' as SoldierAnimation };
            }
            const baseLoc = computeSoldierBoardLocation(s.team, s.index, -1);
            return {
              ...s,
              hp: 100,
              state: 'base' as const,
              stepsMoved: -1,
              trackTileIndex: -1,
              worldPos: { ...baseLoc.worldPos },
              targetWorldPos: { ...baseLoc.worldPos },
              waypoints: [],
              animState: 'hit' as SoldierAnimation,
            };
          }
          return { ...s, hp: nextHp, animState: 'hit' as SoldierAnimation, animTimer: 0.6 };
        }
      }
      return s;
    });

    set({
      soldiers: nextSoldiers,
      combatActionUsed: true,
      inventory: {
        ...state.inventory,
        grenade: { ...state.inventory.grenade, count: state.inventory.grenade.count - 1 },
      },
      projectiles: [
        ...state.projectiles,
        {
          id: `gren_${Date.now()}`,
          from: { ...thrower.targetWorldPos, y: thrower.targetWorldPos.y + 1.1 },
          to: blastCenter,
          color: '#F97316',
          isGrenade: true,
          createdAt: Date.now(),
        },
      ],
      floatingTexts: [
        ...state.floatingTexts,
        {
          id: `boom_${Date.now()}`,
          worldPos: { ...blastCenter, y: blastCenter.y + 1.7 },
          text: `BOOM! -${grenadeDamage} HP`,
          color: '#F97316',
          createdAt: Date.now(),
        },
      ],
      screenShake: 0.7,
      bannerMessage: `${thrower.name}Detonated Frag Grenade on ${targetEnemy.name}!`,
    });

    checkVictoryConditions();
    setTimeout(() => {
      if (get().screen === 'playing' && get().turnPhase === 'ACTION_PHASE') {
        get().endTurn();
      }
    }, 950);
  },

  useInventoryItem: (itemType) => {
    const state = get();
    if (state.screen !== 'playing') return;
    const item = state.inventory[itemType];
    if (!item || item.count <= 0) return;

    if (itemType === 'grenade') {
      state.throwGrenadeAtTarget();
      return;
    }

    const soldier = state.soldiers.find((s) => s.id === state.selectedSoldierId);
    if (!soldier || soldier.team !== state.currentTurnTeam || soldier.state === 'dead') return;

    soundManager.play('pickup');
    let floatLabel = `+ ${item.name}`;

    const nextSoldiers = state.soldiers.map((s) => {
      if (s.id !== soldier.id) return s;
      switch (itemType) {
        case 'health_kit':
          floatLabel = '+45 HP';
          return { ...s, hp: Math.min(s.maxHp, s.hp + 45) };
        case 'armor':
          floatLabel = '+50 ARMOR';
          return { ...s, armor: Math.min(s.maxArmor, s.armor + 50) };
        case 'shield':
          floatLabel = 'SHIELD DOME ACTIVE';
          return { ...s, shieldTurns: 2 };
        case 'ammo': {
          const spec = WEAPONS[s.weapon];
          floatLabel = 'MAX AMMO REFILLED';
          return {
            ...s,
            ammo: spec.magazineSize,
            reserveAmmo: Math.min(spec.maxReserve, s.reserveAmmo + 60),
          };
        }
        case 'weapon_upgrade':
          floatLabel = '+25% WEAPON DMG';
          return { ...s, damageBoost: Number((s.damageBoost + 0.25).toFixed(2)) };
        case 'speed_boost':
          floatLabel = 'SPEED BOOST READY';
          return { ...s, speedBoostTurns: 2 };
        case 'jump_pad': {
          if (s.state === 'track' && s.stepsMoved + 3 <= 55) {
            const nextSteps = s.stepsMoved + 3;
            const loc = computeSoldierBoardLocation(s.team, s.index, nextSteps);
            floatLabel = 'JUMP PAD +3 CELLS!';
            return {
              ...s,
              state: loc.state,
              stepsMoved: nextSteps,
              trackTileIndex: loc.trackTileIndex,
              targetWorldPos: loc.worldPos,
              waypoints: [loc.worldPos],
              animState: 'jump' as SoldierAnimation,
              animTimer: 0.75,
            };
          }
          floatLabel = 'JUMP BOOST ARMED';
          return { ...s, speedBoostTurns: 2, animState: 'jump' as SoldierAnimation, animTimer: 0.7 };
        }
        default:
          return s;
      }
    });

    set({
      soldiers: nextSoldiers,
      inventory: {
        ...state.inventory,
        [itemType]: { ...item, count: item.count - 1 },
      },
      floatingTexts: [
        ...state.floatingTexts,
        {
          id: `itm_${Date.now()}`,
          worldPos: { ...soldier.targetWorldPos, y: soldier.targetWorldPos.y + 1.6 },
          text: floatLabel,
          color: item.color,
          createdAt: Date.now(),
        },
      ],
      bannerMessage: `${soldier.name} used ${item.name}!`,
    });

    recomputeCombatTargets(soldier.id);
  },

  switchSoldierWeapon: (weapon) => {
    const state = get();
    const soldier = state.soldiers.find((s) => s.id === state.selectedSoldierId);
    if (!soldier || soldier.team !== state.currentTurnTeam) return;

    soundManager.play('reload');
    const spec = WEAPONS[weapon];
    const nextSoldiers = state.soldiers.map((s) =>
      s.id === soldier.id
        ? {
            ...s,
            weapon,
            ammo: spec.magazineSize,
            maxAmmo: spec.magazineSize,
            reserveAmmo: spec.maxReserve,
            animState: 'inspect' as SoldierAnimation,
            animTimer: 0.8,
          }
        : s,
    );
    set({
      soldiers: nextSoldiers,
      bannerMessage: `${soldier.name} equipped ${spec.name}`,
    });
    recomputeCombatTargets(soldier.id);
  },

  triggerJumpAnimation: () => {
    const state = get();
    const soldier = state.soldiers.find((s) => s.id === state.selectedSoldierId);
    if (!soldier) return;
    soundManager.play('footstep');
    set({
      soldiers: state.soldiers.map((s) =>
        s.id === soldier.id ? { ...s, animState: 'jump', animTimer: 0.75 } : s,
      ),
    });
  },

  triggerInspectAnimation: () => {
    const state = get();
    const soldier = state.soldiers.find((s) => s.id === state.selectedSoldierId);
    if (!soldier) return;
    soundManager.play('click');
    set({
      soldiers: state.soldiers.map((s) =>
        s.id === soldier.id ? { ...s, animState: 'inspect', animTimer: 1.0 } : s,
      ),
    });
  },

  nudgeSelectedSoldierFreeMove: (dx, dz) => {
    const state = get();
    if (state.screen !== 'playing') return;
    // In Ludo modes, board movement is strictly dice-based; joystick/WASD rotates & tactical-steps within the tile or free-moves in TDM/Survival
    const soldier = state.soldiers.find((s) => s.id === state.selectedSoldierId);
    if (!soldier || soldier.team !== state.currentTurnTeam || soldier.state === 'dead') return;

    const rot = Math.atan2(dx, dz);
    const allowMicroStep = state.gameMode === 'tdm' || state.gameMode === 'survival';
    const stepScale = allowMicroStep ? 0.14 : 0.0;
    const limit = 7.2 * TILE_SIZE;

    set({
      soldiers: state.soldiers.map((s) =>
        s.id === soldier.id
          ? {
              ...s,
              rotationY: rot,
              targetWorldPos: {
                x: Math.max(-limit, Math.min(limit, s.targetWorldPos.x + dx * stepScale)),
                y: s.targetWorldPos.y,
                z: Math.max(-limit, Math.min(limit, s.targetWorldPos.z + dz * stepScale)),
              },
              animState: 'walk',
              animTimer: 0.25,
            }
          : s,
      ),
    });
  },

  endTurn: () => {
    const state = get();
    if (state.screen !== 'playing') return;

    // If the player earned a 6-roll or capture bonus roll, give them another Dice Phase!
    if (state.bonusRollEarned) {
      set({
        turnPhase: 'DICE_PHASE',
        diceValue: null,
        bonusRollEarned: false,
        combatActionUsed: false,
        validMoveSoldierIds: [],
        targetableEnemyIds: [],
        selectedTargetId: null,
        bannerMessage: `${TEAM_COLORS[state.currentTurnTeam].name} Bonus Roll! Roll the Dice!`,
      });
      scheduleAIIfNeeded();
      return;
    }

    const activeTeams: TeamColor[] =
      state.gameMode === 'tdm'
        ? ['red', 'blue']
        : TEAM_ORDER.filter((t) =>
            state.soldiers.some((s) => s.team === t && s.state !== 'dead' && s.state !== 'finished'),
          );

    if (activeTeams.length === 0) return;

    const curIdx = activeTeams.indexOf(state.currentTurnTeam);
    const nextIdx = (curIdx + 1) % activeTeams.length;
    const nextTeam = activeTeams[nextIdx];
    const completedFullRound = nextIdx === 0;
    const nextRound = completedFullRound ? state.roundNumber + 1 : state.roundNumber;

    // Battle Royale / Survival Shrinking Safe Zone & Storm Damage
    let nextSafeRadius = state.safeZoneRadius;
    let nextWarning = state.dangerZoneWarning;
    let updatedSoldiers = state.soldiers.map((s) =>
      s.team === nextTeam ? { ...s, shieldTurns: Math.max(0, s.shieldTurns - 1) } : s,
    );

    if (
      completedFullRound &&
      (state.gameMode === 'battle_royale' || state.gameMode === 'survival')
    ) {
      if (nextRound % 2 === 0 && nextSafeRadius > 3.5) {
        nextSafeRadius = Math.max(3.5, Number((nextSafeRadius - 1.25).toFixed(2)));
        nextWarning = `ALERT: Safe Zone shrinking to ${nextSafeRadius.toFixed(1)} cells!`;
      } else {
        nextWarning = `Danger Zone Active outside ${nextSafeRadius.toFixed(1)}m radius (-15 HP/round)`;
      }

      // Apply storm damage to deployed soldiers outside safeZoneRadius
      updatedSoldiers = updatedSoldiers.map((s) => {
        if (s.state === 'dead' || s.state === 'base' || s.state === 'finished') return s;
        const distFromCenter = Math.hypot(s.targetWorldPos.x, s.targetWorldPos.z) / TILE_SIZE;
        if (distFromCenter > nextSafeRadius) {
          const hp = Math.max(0, s.hp - 15);
          return {
            ...s,
            hp,
            state: hp === 0 ? ('dead' as const) : s.state,
            animState: hp === 0 ? ('death' as SoldierAnimation) : ('hit' as SoldierAnimation),
          };
        }
        return s;
      });
    }

    // Zombie Survival wave advance
    let nextZombies = [...state.zombies];
    let nextWave = state.zombieWave;
    if (completedFullRound && state.gameMode === 'zombie') {
      nextZombies = nextZombies.map((z) => {
        const nextTile = (z.trackTileIndex + 2) % 52;
        const [col, row] = MAIN_TRACK_GRID[nextTile];
        return {
          ...z,
          trackTileIndex: nextTile,
          targetWorldPos: {
            x: (col - 7) * TILE_SIZE,
            y: BOARD_Y + 0.08,
            z: (row - 7) * TILE_SIZE,
          },
        };
      });

      if (nextZombies.length === 0) {
        nextWave += 1;
        nextZombies = [0, 13, 26, 39].map((tileIdx, idx) => {
          const [col, row] = MAIN_TRACK_GRID[tileIdx];
          const pos = {
            x: (col - 7) * TILE_SIZE,
            y: BOARD_Y + 0.08,
            z: (row - 7) * TILE_SIZE,
          };
          return {
            id: `zombie_w${nextWave}_${idx}`,
            name: `Mutant W${nextWave} #${idx + 1}`,
            trackTileIndex: tileIdx,
            worldPos: { ...pos },
            targetWorldPos: { ...pos },
            rotationY: 0,
            hp: 60 + nextWave * 20,
            maxHp: 60 + nextWave * 20,
            damage: 15 + nextWave * 5,
            animState: 'walk',
          };
        });
      }
    }

    // Pick default selected soldier for nextTeam
    const nextTeamSoldiers = updatedSoldiers.filter(
      (s) => s.team === nextTeam && s.state !== 'dead',
    );
    const preferredSoldier =
      nextTeamSoldiers.find((s) => s.state === 'track' || s.state === 'stretch') ||
      nextTeamSoldiers[0];

    if (state.isOnlineMatch) {
      multiplayerClient.send({
        type: 'game:end_turn',
        nextTeam,
      });
    }

    set({
      currentTurnTeam: nextTeam,
      turnPhase: 'DICE_PHASE',
      roundNumber: nextRound,
      diceValue: null,
      isRollingDice: false,
      consecutiveSixes: 0,
      bonusRollEarned: false,
      combatActionUsed: false,
      soldiers: updatedSoldiers,
      selectedSoldierId: preferredSoldier ? preferredSoldier.id : state.selectedSoldierId,
      validMoveSoldierIds: [],
      targetableEnemyIds: [],
      selectedTargetId: null,
      safeZoneRadius: nextSafeRadius,
      dangerZoneWarning: nextWarning,
      zombies: nextZombies,
      zombieWave: nextWave,
      bannerMessage: state.humanTeams.includes(nextTeam)
        ? 'Your Turn — Roll the Dice!'
        : `${TEAM_COLORS[nextTeam].name} (AI) Turn`,
    });

    checkVictoryConditions();
    scheduleAIIfNeeded();
  },

  tickMatchTimer: () => {
    const state = get();
    if (state.screen !== 'playing') return;
    const nextSec = state.matchElapsedSec + 1;
    // Clean up old projectiles & floating damage texts
    const now = Date.now();
    const projectiles = state.projectiles.filter((p) => now - p.createdAt < 450);
    const floatingTexts = state.floatingTexts.filter((f) => now - f.createdAt < 1400);

    set({
      matchElapsedSec: nextSec,
      projectiles,
      floatingTexts,
    });

    // In Team Deathmatch, 5-minute time limit checks highest score
    if (state.gameMode === 'tdm' && nextSec >= 300) {
      checkVictoryConditions(true);
    }
  },

  setMpRoom: (mpRoom) => set({ mpRoom }),
  setMpError: (mpError) => set({ mpError }),
  setMpConnected: (mpConnected) => set({ mpConnected }),
}));

/**
 * Recomputes which enemy soldiers or zombies are within weapon range and line-of-sight
 * of the currently selected soldier during ACTION_PHASE.
 */
function recomputeCombatTargets(explicitSoldierId?: string) {
  const state = useGameStore.getState();
  const activeTeam = state.currentTurnTeam;
  const teamSoldiers = state.soldiers.filter((s) => s.team === activeTeam && s.state !== 'dead');

  // Prefer a soldier on the track/stretch that has enemies in range
  let chosen =
    teamSoldiers.find((s) => s.id === (explicitSoldierId || state.selectedSoldierId)) ||
    teamSoldiers[0];

  if (!chosen) return;

  const findTargetsFor = (shooter: Soldier): string[] => {
    if (shooter.state === 'base' || shooter.state === 'dead') return [];
    const range = WEAPONS[shooter.weapon].rangeCells + 0.4;
    const ids: string[] = [];

    for (const enemy of state.soldiers) {
      if (enemy.team === shooter.team || enemy.state === 'dead' || enemy.state === 'base') continue;
      const dist = getCellDistance(shooter.targetWorldPos, enemy.targetWorldPos);
      if (dist <= range && checkLineOfSight(shooter.targetWorldPos, enemy.targetWorldPos).clear) {
        ids.push(enemy.id);
      }
    }

    for (const z of state.zombies) {
      if (z.hp <= 0) continue;
      const dist = getCellDistance(shooter.targetWorldPos, z.targetWorldPos);
      if (dist <= range) {
        ids.push(z.id);
      }
    }
    return ids;
  };

  let targetIds = findTargetsFor(chosen);
  if (targetIds.length === 0 && !explicitSoldierId) {
    for (const ally of teamSoldiers) {
      const altTargets = findTargetsFor(ally);
      if (altTargets.length > 0) {
        chosen = ally;
        targetIds = altTargets;
        break;
      }
    }
  }

  useGameStore.setState({
    selectedSoldierId: chosen.id,
    targetableEnemyIds: targetIds,
    selectedTargetId: targetIds[0] || null,
  });
}

/**
 * Checks if any team has met the Victory conditions for the active gameMode.
 */
function checkVictoryConditions(forceTimeUp = false) {
  const state = useGameStore.getState();
  if (state.screen !== 'playing') return;

  let winningTeam: TeamColor | null = null;

  // 1. Traditional Ludo Victory: all 4 soldiers of a team reach 'finished'
  for (const team of TEAM_ORDER) {
    const teamSoldiers = state.soldiers.filter((s) => s.team === team);
    if (teamSoldiers.length > 0 && teamSoldiers.every((s) => s.state === 'finished')) {
      winningTeam = team;
      break;
    }
  }

  // 2. Battle Royale / Survival: Last surviving team with alive soldiers wins
  if (!winningTeam && (state.gameMode === 'battle_royale' || state.gameMode === 'survival')) {
    const survivingTeams = TEAM_ORDER.filter((t) =>
      state.soldiers.some((s) => s.team === t && s.state !== 'dead'),
    );
    if (survivingTeams.length === 1) {
      winningTeam = survivingTeams[0];
    }
  }

  // 3. Team Deathmatch: First team to 10 kills or leader at time expiry
  if (!winningTeam && state.gameMode === 'tdm') {
    if (state.teamScores.red >= 10) winningTeam = 'red';
    else if (state.teamScores.blue >= 10) winningTeam = 'blue';
    else if (forceTimeUp) {
      winningTeam = state.teamScores.red >= state.teamScores.blue ? 'red' : 'blue';
    }
  }

  if (!winningTeam) return;

  const isPlayerWinner = winningTeam === state.playerTeam;
  soundManager.play(isPlayerWinner ? 'victory' : 'defeat');

  const playerSoldiers = state.soldiers.filter((s) => s.team === state.playerTeam);
  const matchKills = playerSoldiers.reduce((acc, s) => acc + s.kills, 0);
  const matchDeaths = playerSoldiers.reduce((acc, s) => acc + s.deaths, 0);
  const coinsEarned = (isPlayerWinner ? 250 : 75) + matchKills * 35;
  const xpEarned = (isPlayerWinner ? 300 : 100) + matchKills * 45;

  const nextXp = state.profile.xp + xpEarned;
  const nextLevel = Math.max(1, Math.floor(nextXp / 500) + 1);
  const nextProfile: PlayerProfileData = {
    ...state.profile,
    xp: nextXp,
    level: nextLevel,
    coins: state.profile.coins + coinsEarned,
    kills: state.profile.kills + matchKills,
    deaths: state.profile.deaths + matchDeaths,
    wins: isPlayerWinner ? state.profile.wins + 1 : state.profile.wins,
    matchesPlayed: state.profile.matchesPlayed + 1,
  };

  const newHistoryEntry: MatchHistoryItem = {
    id: `mh_${Date.now()}`,
    mode: state.gameMode,
    team: state.playerTeam,
    result: isPlayerWinner ? 'victory' : 'defeat',
    kills: matchKills,
    deaths: matchDeaths,
    coinsEarned,
    xpEarned,
    createdAt: 'Just now',
  };

  const nextMissions = state.dailyMissions.map((m) =>
    m.id === 'mission_win' && isPlayerWinner
      ? { ...m, progress: Math.min(m.target, m.progress + 1) }
      : m,
  );

  // Set victory pose on winning soldiers
  const celebratedSoldiers = state.soldiers.map((s) =>
    s.team === winningTeam && s.state !== 'dead'
      ? { ...s, animState: 'victory' as SoldierAnimation, animTimer: 10 }
      : s,
  );

  useGameStore.setState({
    screen: isPlayerWinner ? 'victory' : 'gameover',
    winnerTeam: winningTeam,
    cameraMode: 'victory',
    soldiers: celebratedSoldiers,
    profile: nextProfile,
    dailyMissions: nextMissions,
    matchHistory: [newHistoryEntry, ...state.matchHistory].slice(0, 10),
  });

  if (state.isAuthenticated) {
    syncMatchOutcomeToFirestore(nextProfile, {
      mode: state.gameMode,
      team: state.playerTeam,
      result: isPlayerWinner ? 'victory' : 'defeat',
      kills: matchKills,
      deaths: matchDeaths,
      coinsEarned,
      xpEarned,
    }).catch(() => {});
  }
}

/**
 * Intelligent Offline AI Opponent Controller
 * Executes DICE_PHASE -> MOVE_PHASE -> ACTION_PHASE for non-human teams.
 */
let aiTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAIIfNeeded() {
  if (aiTimer) clearTimeout(aiTimer);
  const state = useGameStore.getState();
  if (state.screen !== 'playing' || state.isOnlineMatch) return;
  if (state.humanTeams.includes(state.currentTurnTeam)) return;

  const delay = state.aiDifficulty === 'expert' ? 550 : state.aiDifficulty === 'hard' ? 680 : 820;

  aiTimer = setTimeout(() => {
    const current = useGameStore.getState();
    if (current.screen !== 'playing' || current.humanTeams.includes(current.currentTurnTeam)) {
      return;
    }

    if (current.turnPhase === 'DICE_PHASE' && !current.isRollingDice) {
      current.rollDice();
      return;
    }

    if (current.turnPhase === 'MOVE_PHASE') {
      const validIds = current.validMoveSoldierIds;
      if (validIds.length === 0) {
        current.endTurn();
        return;
      }

      // Tactical AI evaluation of candidate moves
      let bestId = validIds[0];
      let bestScore = -999;
      const rolled = current.diceValue || 1;

      for (const id of validIds) {
        const s = current.soldiers.find((sol) => sol.id === id);
        if (!s) continue;
        let score = 0;

        if (s.state === 'base') {
          score += 55; // Deploying a new soldier out of base is high priority
        } else {
          const nextSteps = Math.min(56, s.stepsMoved + rolled);
          const dest = computeSoldierBoardLocation(s.team, s.index, nextSteps);
          if (dest.state === 'finished') score += 100;
          if (dest.state === 'stretch') score += 45;
          if (dest.state === 'track' && SAFE_TRACK_INDICES.has(dest.trackTileIndex)) {
            score += 35;
          }
          // Check if move captures an enemy soldier
          const capturesEnemy = current.soldiers.some(
            (e) =>
              e.team !== s.team &&
              e.state === 'track' &&
              e.trackTileIndex === dest.trackTileIndex &&
              !SAFE_TRACK_INDICES.has(dest.trackTileIndex),
          );
          if (capturesEnemy) score += 90;
          score += nextSteps * 0.4;
        }

        if (current.aiDifficulty === 'easy') {
          score += Math.random() * 60;
        }

        if (score > bestScore) {
          bestScore = score;
          bestId = id;
        }
      }

      current.moveSelectedSoldier(bestId);
      return;
    }

    if (current.turnPhase === 'ACTION_PHASE') {
      if (current.combatActionUsed) {
        current.endTurn();
        return;
      }

      const activeSoldier = current.soldiers.find((s) => s.id === current.selectedSoldierId);
      if (activeSoldier && activeSoldier.ammo <= 0 && activeSoldier.reserveAmmo > 0) {
        current.reloadWeapon();
      }

      if (current.targetableEnemyIds.length > 0) {
        // Pick lowest HP target in range
        let chosenTargetId = current.targetableEnemyIds[0];
        let lowestHp = 999;
        for (const tid of current.targetableEnemyIds) {
          const enemy = current.soldiers.find((e) => e.id === tid);
          if (enemy && enemy.hp < lowestHp) {
            lowestHp = enemy.hp;
            chosenTargetId = tid;
          }
        }
        current.fireWeaponAtTarget(chosenTargetId);
      } else {
        current.endTurn();
      }
    }
  }, delay);
}
