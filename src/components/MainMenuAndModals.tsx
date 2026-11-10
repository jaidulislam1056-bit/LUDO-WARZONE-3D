import { useState } from 'react';
import {
  Crosshair,
  Gamepad2,
  Globe,
  Package,
  Play,
  Settings,
  Shield,
  ShoppingBag,
  Trophy,
  User,
  Users,
  Volume2,
  VolumeX,
  X,
  Check,
  Sparkles,
  LogIn,
  LogOut,
  Copy,
  RefreshCw,
  Wifi,
  Award,
  Radio,
  Terminal,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { GameLogo } from './GameLogo';
import {
  ITEM_CATALOG,
  SHOP_SKINS,
  TEAM_COLORS,
  TEAM_ORDER,
  WEAPONS,
} from '../constants/boardData';
import {
  AIDifficulty,
  GameMode,
  QualityPreset,
  SkySquadSize,
  SoldierAnimation,
  TeamColor,
  WeaponType,
} from '../types/game';
import { soundManager } from '../services/audio';
import {
  signInWithGooglePopup,
  signOutUser,
  loadOrCreatePlayerProfile,
  fetchMatchHistoryFromFirestore,
} from '../services/firebase';
import { multiplayerClient } from '../services/multiplayer';

const MODE_CARDS: {
  id: GameMode;
  name: string;
  subtitle: string;
  rules: string;
  accent: string;
}[] = [
  {
    id: 'classic',
    name: 'Classic Ludo Battle',
    subtitle: '4 Teams · 16 Soldiers · Dice + AK-47 Combat',
    rules:
      'Traditional Ludo path movement paired with tactical shooting. Eliminated soldiers respawn at their Home Base. Reach the center with all 4 soldiers or dominate the board to win.',
    accent: '#EF4444',
  },
  {
    id: 'sky_warzone',
    name: 'Sky Warzone (আকাশে উড়ার লড়াই)',
    subtitle: 'Solo / Duo / Squad · Jetpack Flight · Mid-Air Combat',
    rules:
      'Deploy into the skies above the floating fortress with jetpacks and glider wings! Play Solo (1 commando), Duo (2 commandos), or 4-soldier Squad. Fire AK-47s mid-air and drop aerial grenades while birds soar in the clouds.',
    accent: '#38BDF8',
  },
  {
    id: 'battle_royale',
    name: 'Solo Battle Royale',
    subtitle: 'Shrinking Safe Zone · Permadeath · Supply Drops',
    rules:
      'Safe Zone shrinks every 2 rounds with storm damage outside the perimeter. Eliminated soldiers are out permanently (no respawn). Last surviving squad wins!',
    accent: '#F59E0B',
  },
  {
    id: 'tdm',
    name: 'Team Deathmatch',
    subtitle: 'Red vs Blue · Respawn Enabled · First to 10 Kills',
    rules:
      'High-intensity Red vs Blue firefight across the Ludo fortress. Instant home base respawn and free micro-positioning. First team to 10 eliminations or leader at 5:00 wins.',
    accent: '#3B82F6',
  },
  {
    id: 'zombie',
    name: 'Zombie Survival',
    subtitle: '4 Teams vs AI Zombie Waves · Survival Rewards',
    rules:
      'Infected waves march along the Ludo perimeter. Roll the dice, position your squad, and gun down mutant waves before they overrun your soldiers.',
    accent: '#22C55E',
  },
  {
    id: 'survival',
    name: 'Survival Challenge',
    subtitle: 'Shrinking Arena · High-Stakes Loot · Elite AI',
    rules:
      'Collapsing danger zone combined with high-tier weapon crates and aggressive AI commandos. Manage your reserve ammunition carefully.',
    accent: '#A855F7',
  },
];

const ALL_ANIMATIONS: { id: SoldierAnimation; label: string }[] = [
  { id: 'idle', label: '1. Idle' },
  { id: 'walk', label: '2. Walk' },
  { id: 'run', label: '3. Run' },
  { id: 'aim', label: '4. Aim' },
  { id: 'shoot', label: '5. Shoot' },
  { id: 'reload', label: '6. Reload' },
  { id: 'jump', label: '7. Jump' },
  { id: 'hit', label: '8. Getting Hit' },
  { id: 'death', label: '9. Death' },
  { id: 'victory', label: '10. Victory' },
  { id: 'inspect', label: '11. Inspect Weapon' },
  { id: 'grenade', label: '12. Grenade Throw' },
];

export function MainMenuAndModals() {
  const {
    screen,
    activeModal,
    gameMode,
    aiDifficulty,
    qualityPreset,
    playerTeam,
    profile,
    isAuthenticated,
    dailyMissions,
    matchHistory,
    inventory,
    previewTeam,
    previewAnimation,
    previewWeapon,
    mpRoom,
    mpError,
    skySquadSize,
    setSkySquadSize,
    matchTeamCount,
    setMatchTeamCount,
    isPartnerMode,
    setIsPartnerMode,
    setActiveModal,
    setGameMode,
    setAIDifficulty,
    setQualityPreset,
    selectTeamColor,
    setPreviewTeam,
    setPreviewAnimation,
    setPreviewWeapon,
    buyOrEquipSkin,
    claimDailyMission,
    updateDisplayName,
    startNewMatch,
    setAuthenticatedProfile,
    setMatchHistory,
    setMpError,
  } = useGameStore();

  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [nameInput, setNameInput] = useState(profile.displayName);
  const [sfxVol, setSfxVol] = useState(soundManager.sfxVolume);
  const [musicVol, setMusicVol] = useState(soundManager.musicVolume);
  const [muted, setMuted] = useState(soundManager.isMuted);
  const [musicOn, setMusicOn] = useState(soundManager.isMusicPlaying);
  const [authBusy, setAuthBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [multiplayerTab, setMultiplayerTab] = useState<'online' | 'wifi'>('online');
  const [wifiPinInput, setWifiPinInput] = useState('');
  const [localWifiHost, setLocalWifiHost] = useState<string | null>(null);
  const [itemsCategoryTab, setItemsCategoryTab] = useState<'all' | 'outfit' | 'weapon' | 'emote'>('all');

  if (screen !== 'menu' && activeModal === 'none') return null;

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    try {
      const user = await signInWithGooglePopup();
      if (user) {
        const loaded = await loadOrCreatePlayerProfile(user, profile);
        setAuthenticatedProfile(loaded, true);
        setNameInput(loaded.displayName);
        const hist = await fetchMatchHistoryFromFirestore(user.uid);
        setMatchHistory(hist);
      }
    } catch (err) {
      console.error('Sign-in cancelled or failed:', err);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setAuthenticatedProfile(
      {
        ...profile,
        uid: 'guest_commander',
      },
      false,
    );
  };

  return (
    <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between p-2.5 sm:p-5">
      {/* Top Status Strip on Main Menu */}
      {screen === 'menu' && (
        <header className="pointer-events-auto flex items-center justify-between gap-3 bg-slate-950/90 border border-slate-800 rounded-xl px-3.5 py-2 max-w-5xl w-full mx-auto shadow-xl">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs border border-white/20"
              style={{ backgroundColor: TEAM_COLORS[playerTeam].primaryHex }}
            >
              Lv.{profile.level}
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-white leading-tight">
                {profile.displayName}
              </div>
              <div className="text-[11px] text-slate-400 tabular-nums">
                {profile.xp} XP · {TEAM_COLORS[playerTeam].name}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="text-xs font-mono font-bold text-amber-400 tabular-nums bg-slate-900 border border-amber-500/30 px-2.5 py-1 rounded-lg">
              {profile.coins} COINS
            </div>
            <button
              onClick={() => setActiveModal('profile')}
              className="px-2.5 py-1 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Profile</span>
            </button>
            <button
              onClick={() => setActiveModal('settings')}
              className="p-1.5 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              title="Game Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </header>
      )}

      {/* Center Hero Title Lockup */}
      {screen === 'menu' && activeModal === 'none' && (
        <div className="my-auto flex flex-col items-center text-center pointer-events-none px-2">
          <div className="pointer-events-auto transform scale-90 sm:scale-100 transition-transform">
            <GameLogo />
          </div>

          <div className="mt-4 pointer-events-auto flex flex-col sm:flex-row items-center justify-center gap-2.5 w-full max-w-sm sm:max-w-none">
            <button
              onClick={() => startNewMatch({ isOnline: false })}
              className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-base tracking-wide shadow-2xl border-2 border-amber-200 transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-slate-950" />
              PLAY NOW
            </button>

            <button
              onClick={() => setActiveModal('multiplayer')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm sm:text-base shadow-xl border border-sky-400/40 transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
              MULTIPLAYER
            </button>
          </div>
        </div>
      )}

      {/* Bottom Navigation Dock on Main Menu */}
      {screen === 'menu' && activeModal === 'none' && (
        <nav className="pointer-events-auto max-w-4xl w-full mx-auto bg-slate-950/92 border border-slate-800 rounded-2xl p-2 shadow-2xl grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          <button
            onClick={() => setActiveModal('modes')}
            className="px-2 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-100 text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 border border-slate-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Crosshair className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Modes</span>
          </button>
          <button
            onClick={() => setActiveModal('characters')}
            className="px-2 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-100 text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 border border-slate-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Users className="w-4 h-4 text-red-400 shrink-0" />
            <span>Soldiers</span>
          </button>
          <button
            onClick={() => setActiveModal('inventory')}
            className="px-2 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-100 text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 border border-slate-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Package className="w-4 h-4 text-sky-400 shrink-0" />
            <span>Items</span>
          </button>
          <button
            onClick={() => setActiveModal('shop')}
            className="px-2 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-100 text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 border border-slate-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            <ShoppingBag className="w-4 h-4 text-purple-400 shrink-0" />
            <span>Shop</span>
          </button>
          <button
            onClick={() => setActiveModal('profile')}
            className="px-2 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-100 text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 border border-slate-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Trophy className="w-4 h-4 text-yellow-400 shrink-0" />
            <span>Profile</span>
          </button>
          <button
            onClick={() => setActiveModal('settings')}
            className="px-2 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-100 text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 border border-slate-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Settings</span>
          </button>
        </nav>
      )}

      {/* ================= ACTIVE MODAL WINDOWS ================= */}
      {activeModal !== 'none' && (
        <div className="pointer-events-auto my-auto max-w-4xl w-full mx-auto bg-slate-950/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[86vh]">
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
            <h2
              className="text-lg sm:text-xl font-extrabold text-white tracking-wide"
              style={{ fontFamily: "'Chakra Petch', sans-serif" }}
            >
              {activeModal === 'modes' && 'SELECT GAME MODE & AI DIFFICULTY'}
              {activeModal === 'characters' && '3D SOLDIER SQUAD & ANIMATION INSPECTOR'}
              {activeModal === 'inventory' && 'TACTICAL LOADOUT & ITEM INVENTORY'}
              {activeModal === 'shop' && 'WARZONE ARMORY & SKIN SHOP'}
              {activeModal === 'profile' && 'COMMANDER PROFILE, MISSIONS & CAREER'}
              {activeModal === 'multiplayer' && 'ONLINE MULTIPLAYER COMMAND LOBBY'}
              {activeModal === 'settings' && 'AUDIO, GRAPHICS & CONTROL SETTINGS'}
            </h2>
            <button
              onClick={() => setActiveModal('none')}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 overflow-y-auto space-y-6">
            {/* 1. GAME MODES MODAL */}
            {activeModal === 'modes' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {MODE_CARDS.map((m) => {
                    const selected = gameMode === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => setGameMode(m.id)}
                        className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                          selected
                            ? 'bg-slate-900 border-amber-400 shadow-lg'
                            : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-base font-bold text-white">{m.name}</span>
                          {selected && (
                            <span className="text-xs font-bold text-amber-400">SELECTED</span>
                          )}
                        </div>
                        <div className="text-xs font-medium text-sky-400 mt-1">{m.subtitle}</div>
                        <p className="text-xs text-slate-400 mt-2 leading-relaxed">{m.rules}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Sky Warzone Solo / Duo / Squad Formation Selector */}
                {gameMode === 'sky_warzone' && (
                  <div className="p-4 rounded-xl bg-sky-950/40 border border-sky-500/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-sky-300">
                          SKY SQUADRON FORMATION (আকাশে খেলার দল নির্বাচন)
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Solo (১ জন), Duo (২ জন), অথবা Squad (৪ জন) কমান্ডো নিয়ে আকাশে উড়ুন
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-sky-400/20 text-sky-300 border border-sky-400/30 uppercase font-mono font-bold">
                        Jetpack Active
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5 pt-1">
                      {(['solo', 'duo', 'squad'] as SkySquadSize[]).map((size) => (
                        <button
                          key={size}
                          onClick={() => setSkySquadSize(size)}
                          className={`py-2.5 px-3 rounded-lg text-xs font-extrabold uppercase transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                            skySquadSize === size
                              ? 'bg-sky-400 text-slate-950 shadow-lg scale-[1.02]'
                              : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-xs">
                            {size === 'solo' && 'Solo (একক)'}
                            {size === 'duo' && 'Duo (দ্বৈত)'}
                            {size === 'squad' && 'Squad (দল)'}
                          </span>
                          <span className="text-[10px] opacity-75 font-normal">
                            {size === 'solo' && '1 Commando'}
                            {size === 'duo' && '2 Commandos'}
                            {size === 'squad' && '4 Commandos'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Team Formation & 2v2 Partner Mode Selector */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-amber-400" />
                        TEAMS & ALLIANCE FORMATION (দলের সংখ্যা ও জোড়া খেলা)
                      </div>
                      <div className="text-[11px] text-slate-400">
                        ২ দল (Duo), ৩ দল, ৪ দল অথবা ২v২ জোড়া জোট (Partner Battle) নির্বাচন করুন
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase font-mono font-bold">
                      {isPartnerMode ? '2v2 Duo Alliance' : `${matchTeamCount} Teams Active`}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    <button
                      onClick={() => {
                        setMatchTeamCount(2);
                        setIsPartnerMode(false);
                      }}
                      className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                        matchTeamCount === 2 && !isPartnerMode
                          ? 'bg-amber-400/15 border-amber-400 text-white shadow-md'
                          : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-extrabold text-amber-400">2 Teams (Duo 1v1)</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">বোর্ডে শুধু ২ দল (লাল বনাম হলুদ)</div>
                    </button>

                    <button
                      onClick={() => {
                        setMatchTeamCount(3);
                        setIsPartnerMode(false);
                      }}
                      className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                        matchTeamCount === 3 && !isPartnerMode
                          ? 'bg-sky-400/15 border-sky-400 text-white shadow-md'
                          : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-extrabold text-sky-400">3 Teams (Tri-War)</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">বোর্ডে ৩ দল (৩ জন কমান্ডো গ্রুপ)</div>
                    </button>

                    <button
                      onClick={() => {
                        setMatchTeamCount(4);
                        setIsPartnerMode(false);
                      }}
                      className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                        matchTeamCount === 4 && !isPartnerMode
                          ? 'bg-emerald-400/15 border-emerald-400 text-white shadow-md'
                          : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-extrabold text-emerald-400">4 Teams (Squad 4-Way)</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">সব ৪টি দল যুদ্ধক্ষেত্রে মুখোমুখি</div>
                    </button>

                    <button
                      onClick={() => {
                        setIsPartnerMode(true);
                        setMatchTeamCount(4);
                      }}
                      className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                        isPartnerMode
                          ? 'bg-purple-500/20 border-purple-400 text-white shadow-md'
                          : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-extrabold text-purple-400">2v2 Partner (জোড়া লড়াই)</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Red+Yellow বনাম Blue+Green জোট</div>
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-white">Offline AI Difficulty</div>
                    <div className="text-xs text-slate-400">
                      Controls tactical target selection, cover usage, and capture priority
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(['easy', 'normal', 'hard', 'expert'] as AIDifficulty[]).map((diff) => (
                      <button
                        key={diff}
                        onClick={() => setAIDifficulty(diff)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold uppercase transition-colors cursor-pointer ${
                          aiDifficulty === diff
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {diff}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() =>
                      startNewMatch({
                        mode: gameMode,
                        matchTeamCount,
                        isPartnerMode,
                        isOnline: false,
                      })
                    }
                    className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm flex items-center gap-2 cursor-pointer shadow-lg active:scale-98 transition-all"
                  >
                    <Play className="w-4 h-4 fill-slate-950" />
                    DEPLOY INTO {MODE_CARDS.find((m) => m.id === gameMode)?.name.toUpperCase()} (
                    {isPartnerMode ? '2v2 PARTNER' : `${matchTeamCount} TEAMS`})
                  </button>
                </div>
              </>
            )}

            {/* 2. 3D CHARACTER & ANIMATION SELECT MODAL */}
            {activeModal === 'characters' && (
              <div className="space-y-5">
                <p className="text-xs text-slate-300">
                  The 3D camera is focused live on your squad commander on the board behind this panel. Switch team uniform, weapon, and animation state to inspect the 3D skeletal rig in real time:
                </p>

                {/* Team Selector */}
                <div>
                  <div className="text-xs font-bold text-slate-400 mb-2">
                    SELECT YOUR SQUAD TEAM COLOR (16 TOTAL 3D SOLDIERS — 4 PER TEAM)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {TEAM_ORDER.map((t) => {
                      const info = TEAM_COLORS[t];
                      const active = previewTeam === t;
                      return (
                        <button
                          key={t}
                          onClick={() => {
                            setPreviewTeam(t);
                            selectTeamColor(t);
                          }}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            active
                              ? 'border-white bg-slate-900 shadow-lg'
                              : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-4 h-4 rounded-sm shrink-0"
                              style={{ backgroundColor: info.primaryHex }}
                            />
                            <span className="text-sm font-bold text-white">{info.name}</span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            4 Articulated Commandos · AK-47
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Weapon Preview Switcher */}
                <div>
                  <div className="text-xs font-bold text-slate-400 mb-2">
                    3D WEAPON ATTACHMENT PREVIEW
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {(Object.keys(WEAPONS) as WeaponType[]).map((wKey) => {
                      const w = WEAPONS[wKey];
                      const active = previewWeapon === wKey;
                      return (
                        <button
                          key={wKey}
                          onClick={() => setPreviewWeapon(wKey)}
                          className={`p-2.5 rounded-lg border text-left cursor-pointer ${
                            active
                              ? 'bg-amber-400/15 border-amber-400 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <div className="text-xs font-bold">{w.name}</div>
                          <div className="text-[11px] text-slate-400 tabular-nums">
                            {w.damage} DMG · {w.rangeCells} Cells
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 12 Animation States Preview */}
                <div>
                  <div className="text-xs font-bold text-slate-400 mb-2">
                    TEST ALL 12 SKELETAL ANIMATIONS
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {ALL_ANIMATIONS.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setPreviewAnimation(a.id)}
                        className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          previewAnimation === a.id
                            ? 'bg-sky-500 text-slate-950 border-sky-300 font-bold'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3. INVENTORY & WEAPON CODEX MODAL */}
            {activeModal === 'inventory' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-white mb-3">
                    Primary & Special Weapons Arsenal
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.values(WEAPONS).map((w) => (
                      <div
                        key={w.id}
                        className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-amber-400">{w.name}</span>
                            <span className="text-xs text-slate-400 tabular-nums">
                              Range: {w.rangeCells} Cells
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1">{w.description}</p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 tabular-nums">
                          <span>Damage: {w.damage} HP/round</span>
                          <span>
                            Mag: {w.magazineSize} / {w.maxReserve}
                          </span>
                          <span>Reload: {w.reloadSeconds}s</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white mb-3">
                    Tactical Field Items (Starting Supply & Board Drops)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.values(inventory).map((item) => (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{item.name}</span>
                          <span className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
                            x{item.count}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                          {item.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 4. SHOP & ARMORY MODAL */}
            {activeModal === 'shop' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900 p-3.5 rounded-xl border border-slate-800">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <ShoppingBag className="w-4 h-4 text-amber-400" />
                      WARZONE ARMORY & MILITARY ITEMS
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      ম্যাচ খেলে ও মিশন সম্পন্ন করে অর্জিত XP এবং কয়েন দিয়ে নতুন পোশাক, গান স্কিন ও ইমোট আনলক করুন।
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950/60 border border-sky-500/30 px-2.5 py-1 rounded-lg">
                      {profile.xp} XP (Lv.{profile.level})
                    </span>
                    <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 border border-amber-500/30 px-2.5 py-1 rounded-lg">
                      {profile.coins} COINS
                    </span>
                  </div>
                </div>

                {/* Category Filter Tabs */}
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2.5">
                  {(['all', 'outfit', 'weapon', 'emote'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setItemsCategoryTab(tab)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        itemsCategoryTab === tab
                          ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {tab === 'all' && 'All Items (সব)'}
                      {tab === 'outfit' && 'Outfits (পোশাক)'}
                      {tab === 'weapon' && 'Firearms (অস্ত্র)'}
                      {tab === 'emote' && 'Emotes (ইমোট ও নাচ)'}
                    </button>
                  ))}
                </div>

                {/* Items Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                  {SHOP_SKINS.filter((skin) => {
                    if (itemsCategoryTab === 'all') return true;
                    if (itemsCategoryTab === 'outfit')
                      return skin.category === 'outfit' || skin.category === 'character';
                    return skin.category === itemsCategoryTab;
                  }).map((skin) => {
                    const isOutfit = skin.category === 'outfit' || skin.category === 'character';
                    const isEmote = skin.category === 'emote';

                    const unlocked = isOutfit
                      ? (profile.unlockedOutfits || ['skin_standard']).includes(skin.id) ||
                        profile.unlockedSkins.includes(skin.id)
                      : isEmote
                        ? (profile.unlockedEmotes || ['emote_military_salute']).includes(skin.id)
                        : profile.unlockedSkins.includes(skin.id);

                    const equipped = isOutfit
                      ? (profile.selectedOutfit || profile.selectedSkin) === skin.id
                      : isEmote
                        ? (profile.selectedEmote || 'emote_military_salute') === skin.id
                        : profile.selectedWeaponSkin === skin.id;

                    const reqXp = skin.requiredXp || 0;
                    const meetsXp = profile.xp >= reqXp;

                    return (
                      <div
                        key={skin.id}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                          equipped
                            ? 'bg-emerald-950/20 border-emerald-500/40'
                            : 'bg-slate-900 border-slate-800'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs sm:text-sm font-bold text-white truncate">
                              {skin.name}
                            </span>
                            <span
                              className="w-3.5 h-3.5 rounded-sm shrink-0 shadow"
                              style={{ backgroundColor: skin.accentHex }}
                            />
                          </div>

                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              {skin.category}
                            </span>
                            {reqXp > 0 && (
                              <span
                                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                                  meetsXp
                                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
                                    : 'bg-slate-950 text-slate-400 border-slate-800'
                                }`}
                              >
                                {meetsXp ? '✓ ' : ''}{reqXp} XP Req
                              </span>
                            )}
                            {skin.priceCoins > 0 ? (
                              <span className="text-[10px] font-mono font-bold text-amber-400">
                                {skin.priceCoins} COINS
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-emerald-400">FREE</span>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-300 mt-2 leading-relaxed">
                            {skin.description}
                          </p>
                        </div>

                        <button
                          onClick={() =>
                            buyOrEquipSkin(skin.id, skin.category, skin.priceCoins, reqXp)
                          }
                          disabled={!unlocked && !meetsXp && profile.coins < skin.priceCoins}
                          className={`mt-3.5 w-full py-2 rounded-lg text-xs font-bold transition-all cursor-pointer active:scale-98 ${
                            equipped
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-extrabold'
                              : unlocked
                                ? 'bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md font-extrabold'
                                : meetsXp
                                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold shadow-md'
                                  : profile.coins >= skin.priceCoins
                                    ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold shadow-md'
                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                          }`}
                        >
                          {equipped
                            ? 'EQUIPPED (এক্টিভ)'
                            : unlocked
                              ? 'EQUIP (ব্যবহার করুন)'
                              : meetsXp
                                ? 'CLAIM WITH XP (আনলক)'
                                : profile.coins >= skin.priceCoins
                                  ? `UNLOCK (${skin.priceCoins} COINS)`
                                  : `LOCKED (${reqXp} XP / ${skin.priceCoins} COINS)`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. PROFILE, MISSIONS & CLOUD SYNC MODAL */}
            {activeModal === 'profile' && (
              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="text-xs text-slate-400">COMMANDER CALLSIGN</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={nameInput}
                        maxLength={40}
                        onChange={(e) => setNameInput(e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white font-semibold focus:outline-none focus:border-sky-400"
                      />
                      <button
                        onClick={() => updateDisplayName(nameInput)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  <div>
                    {isAuthenticated ? (
                      <button
                        onClick={handleSignOut}
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center gap-2 cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-red-400" />
                        Sign Out (Google Cloud Synced)
                      </button>
                    ) : (
                      <button
                        onClick={handleGoogleSignIn}
                        disabled={authBusy}
                        className="px-4 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-extrabold flex items-center gap-2 cursor-pointer"
                      >
                        <LogIn className="w-4 h-4" />
                        {authBusy ? 'Connecting...' : 'Sign In with Google to Save Progress'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Career Combat Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-xs text-slate-400">Rank Level</div>
                    <div className="text-xl font-extrabold text-white tabular-nums mt-0.5">
                      Lv.{profile.level}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-xs text-slate-400">Victories</div>
                    <div className="text-xl font-extrabold text-amber-400 tabular-nums mt-0.5">
                      {profile.wins}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-xs text-slate-400">Eliminations</div>
                    <div className="text-xl font-extrabold text-emerald-400 tabular-nums mt-0.5">
                      {profile.kills}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-xs text-slate-400">Deaths</div>
                    <div className="text-xl font-extrabold text-red-400 tabular-nums mt-0.5">
                      {profile.deaths}
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                    <div className="text-xs text-slate-400">Matches</div>
                    <div className="text-xl font-extrabold text-sky-400 tabular-nums mt-0.5">
                      {profile.matchesPlayed}
                    </div>
                  </div>
                </div>

                {/* Daily Missions */}
                <div>
                  <h3 className="text-sm font-bold text-white mb-2.5 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Daily Tactical Missions
                  </h3>
                  <div className="space-y-2.5">
                    {dailyMissions.map((m) => {
                      const ready = m.progress >= m.target && !m.claimed;
                      const isDeployBonus = m.id === 'mission_match_deployment';
                      return (
                        <div
                          key={m.id}
                          className={`p-3 rounded-xl flex items-center justify-between gap-4 transition-all ${
                            isDeployBonus
                              ? 'bg-amber-950/40 border-2 border-amber-400/80 shadow-lg'
                              : 'bg-slate-900 border border-slate-800'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white">{m.title}</span>
                              {isDeployBonus && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 font-mono font-extrabold uppercase">
                                  Match Bonus
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 tabular-nums mt-0.5">
                              Progress: {m.progress} / {m.target} · Reward: +{m.rewardCoins} Coins · +{m.rewardXp} XP
                            </div>
                          </div>
                          <button
                            onClick={() => claimDailyMission(m.id)}
                            disabled={!ready}
                            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer ${
                              m.claimed
                                ? 'bg-slate-800 text-slate-500'
                                : ready
                                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 font-extrabold shadow-md'
                                  : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {m.claimed ? 'Claimed' : ready ? 'Claim Reward' : 'In Progress'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Recent Match History */}
                <div>
                  <h3 className="text-sm font-bold text-white mb-2">Recent Match History</h3>
                  {matchHistory.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
                      Complete a match to record battle telemetry here.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {matchHistory.map((mh) => (
                        <div
                          key={mh.id}
                          className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs tabular-nums"
                        >
                          <div>
                            <span
                              className={`font-bold uppercase ${
                                mh.result === 'victory' ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {mh.result}
                            </span>
                            <span className="text-slate-400">
                              {' '}
                              · {mh.mode.toUpperCase()} · {TEAM_COLORS[mh.team].name}
                            </span>
                          </div>
                          <div className="text-slate-300">
                            {mh.kills} Kills / {mh.deaths} Deaths · +{mh.coinsEarned} Coins
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 6. MULTIPLAYER LOBBY (ONLINE & LOCAL WIFI / HOTSPOT) */}
            {activeModal === 'multiplayer' && (
              <div className="space-y-4">
                {/* Mode Selector Tabs: Online Global vs Local WiFi */}
                <div className="flex items-center gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-xl">
                  <button
                    onClick={() => {
                      setMultiplayerTab('online');
                      setMpError(null);
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      multiplayerTab === 'online'
                        ? 'bg-sky-500 text-slate-950 shadow-md font-extrabold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                    <span>Online Global Arena</span>
                  </button>

                  <button
                    onClick={() => {
                      setMultiplayerTab('wifi');
                      setMpError(null);
                    }}
                    className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      multiplayerTab === 'wifi'
                        ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Wifi className="w-4 h-4" />
                    <span>Local WiFi / Hotspot Play</span>
                  </button>
                </div>

                {mpError && (
                  <div className="p-3 rounded-lg bg-red-950/80 border border-red-500/40 text-xs text-red-200">
                    {mpError}
                  </div>
                )}

                {/* Sub-View: TAB 1 - ONLINE GLOBAL MULTIPLAYER */}
                {multiplayerTab === 'online' && !mpRoom && (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <Globe className="w-4 h-4 text-sky-400" />
                          Authoritative WebSocket Cloud Server
                        </div>
                        <div className="text-slate-400 text-[11px] mt-0.5">
                          Worldwide real-time synchronization, authoritative dice rolls & squad slots.
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Create Online Room */}
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3">
                        <div>
                          <div className="text-sm font-bold text-white">Create Online Squad</div>
                          <p className="text-xs text-slate-400 mt-1">
                            Host an online room and share your code with friends worldwide.
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            setMpError(null);
                            const ok = await multiplayerClient.createRoom(
                              profile.displayName,
                              gameMode,
                              playerTeam,
                              true,
                            );
                            if (!ok) setMpError('Could not connect to WebSocket server.');
                          }}
                          className="w-full py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs cursor-pointer active:scale-95"
                        >
                          Create Online Room
                        </button>
                      </div>

                      {/* Join Online Code */}
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3">
                        <div>
                          <div className="text-sm font-bold text-white">Join by Room Code</div>
                          <input
                            type="text"
                            placeholder="e.g. WZ-4829"
                            value={joinCodeInput}
                            onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                            className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-white uppercase focus:border-sky-400"
                          />
                        </div>
                        <button
                          onClick={async () => {
                            if (!joinCodeInput.trim()) return;
                            setMpError(null);
                            await multiplayerClient.joinRoom(joinCodeInput, profile.displayName);
                          }}
                          className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs cursor-pointer border border-slate-700 active:scale-95"
                        >
                          Join Code
                        </button>
                      </div>

                      {/* Public Matchmaking */}
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3">
                        <div>
                          <div className="text-sm font-bold text-white">Auto Matchmaking</div>
                          <p className="text-xs text-slate-400 mt-1">
                            Instantly find active online commanders and start the match.
                          </p>
                        </div>
                        <button
                          onClick={async () => {
                            setMpError(null);
                            await multiplayerClient.matchmakePublic(profile.displayName, gameMode);
                          }}
                          className="w-full py-2.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Find Match
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-View: TAB 2 - LOCAL WIFI & MOBILE HOTSPOT PLAY */}
                {multiplayerTab === 'wifi' && !mpRoom && (
                  <div className="space-y-4">
                    <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="font-bold text-amber-300 flex items-center gap-2">
                          <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
                          Local WiFi & Hotspot Peer Arena (Zero Lag / Ultra Low Ping)
                        </div>
                        <div className="text-slate-300 text-[11px] mt-0.5">
                          Play with friends in the same room using your home WiFi network or phone mobile hotspot!
                        </div>
                      </div>
                      <div className="px-2.5 py-1 rounded-lg bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-bold uppercase tracking-wide shrink-0">
                        Hotspot Ready
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Host Local WiFi Match */}
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                            <h3 className="text-sm font-bold text-white">Host Local WiFi Match</h3>
                          </div>
                          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                            Start a local match host. Other players connected to your WiFi or phone hotspot can join using the WiFi Room PIN.
                          </p>
                        </div>

                        <button
                          onClick={async () => {
                            setMpError(null);
                            const pin = String(Math.floor(1000 + Math.random() * 9000));
                            const wifiCode = `WIFI-${pin}`;
                            setLocalWifiHost(wifiCode);
                            const ok = await multiplayerClient.createRoom(
                              `${profile.displayName} (WiFi Host)`,
                              gameMode,
                              playerTeam,
                              true,
                              wifiCode,
                            );
                            if (!ok) setMpError('Could not start WiFi session. Make sure server is reachable on this network.');
                          }}
                          className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all"
                        >
                          <Wifi className="w-4 h-4" />
                          Host Local WiFi Room
                        </button>
                      </div>

                      {/* Join Local WiFi Match */}
                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                            <h3 className="text-sm font-bold text-white">Join Local WiFi Host</h3>
                          </div>
                          <p className="text-xs text-slate-400 mt-1.5">
                            Enter the 4-digit PIN (e.g. 7412) or room code displayed on your friend's screen.
                          </p>
                          <input
                            type="text"
                            placeholder="e.g. 7412 or WIFI-7412"
                            value={wifiPinInput}
                            onChange={(e) => setWifiPinInput(e.target.value.toUpperCase())}
                            className="mt-2 w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-amber-400 uppercase tracking-widest focus:border-amber-400"
                          />
                        </div>

                        <button
                          onClick={async () => {
                            if (!wifiPinInput.trim()) return;
                            setMpError(null);
                            const clean = wifiPinInput.trim().toUpperCase();
                            const targetCode = clean.startsWith('WIFI-') ? clean : `WIFI-${clean}`;
                            const ok = await multiplayerClient.joinRoom(targetCode, profile.displayName);
                            if (!ok) setMpError(`WiFi PIN ${wifiPinInput} not found on this local network.`);
                          }}
                          className="w-full py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs cursor-pointer shadow-md active:scale-95 transition-all"
                        >
                          Join WiFi Match
                        </button>
                      </div>
                    </div>

                    {/* Quick 3-Step Hotspot Guide */}
                    <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300 space-y-1.5">
                      <div className="font-bold text-amber-400 uppercase tracking-wider text-[10px]">
                        How to play via Mobile Hotspot / WiFi:
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-400">
                        <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                          <span className="font-bold text-white">Step 1:</span> Turn on Hotspot on one phone, and connect other friends to it.
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                          <span className="font-bold text-white">Step 2:</span> Host taps "Host Local WiFi Room" to get the Room PIN.
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                          <span className="font-bold text-white">Step 3:</span> Friends enter the PIN to join and deploy immediately!
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ACTIVE ROOM LOBBY (SHARED FOR BOTH ONLINE & LOCAL WIFI) */}
                {mpRoom && (
                  <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                      <div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5">
                          {multiplayerTab === 'wifi' ? (
                            <Wifi className="w-3.5 h-3.5 text-amber-400" />
                          ) : (
                            <Globe className="w-3.5 h-3.5 text-sky-400" />
                          )}
                          <span>{multiplayerTab === 'wifi' ? 'LOCAL WIFI ROOM PIN' : 'ONLINE ROOM CODE'}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-2xl font-mono font-extrabold text-amber-400">
                            {mpRoom.code}
                          </span>
                          {mpRoom.code.startsWith('WIFI-') && (
                            <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-mono text-xs font-bold border border-amber-400/40">
                              PIN: {mpRoom.code.replace('WIFI-', '')}
                            </span>
                          )}
                          <button
                            onClick={() => {
                              const textToCopy = mpRoom.code.startsWith('WIFI-')
                                ? mpRoom.code.replace('WIFI-', '')
                                : mpRoom.code;
                              navigator.clipboard?.writeText(textToCopy);
                              setCopiedCode(true);
                              setTimeout(() => setCopiedCode(false), 1500);
                            }}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 flex items-center gap-1 cursor-pointer"
                          >
                            {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            {copiedCode ? 'Copied PIN' : 'Copy PIN'}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {TEAM_ORDER.map((t) => (
                          <button
                            key={t}
                            onClick={() => multiplayerClient.selectTeam(t)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white border border-white/20 cursor-pointer"
                            style={{ backgroundColor: TEAM_COLORS[t].primaryHex }}
                          >
                            {t.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-bold text-slate-400">
                        CONNECTED PLAYERS ({mpRoom.players.length} / 4)
                      </div>
                      {mpRoom.players.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="w-3.5 h-3.5 rounded-sm"
                              style={{ backgroundColor: TEAM_COLORS[p.team].primaryHex }}
                            />
                            <span className="text-sm font-bold text-white">{p.name}</span>
                            <span className="text-xs text-slate-400">
                              ({TEAM_COLORS[p.team].name})
                            </span>
                          </div>
                          <span className="text-xs font-bold text-emerald-400">
                            {p.ready ? 'READY' : 'PREPARING'}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        onClick={() => multiplayerClient.startRoomMatch()}
                        className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs cursor-pointer shadow-lg active:scale-95"
                      >
                        Launch Match Now
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 7. SETTINGS MODAL */}
            {activeModal === 'settings' && (
              <div className="space-y-5">
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">Master Audio</span>
                    <button
                      onClick={() => {
                        const next = !muted;
                        setMuted(next);
                        soundManager.setMuted(next);
                      }}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white flex items-center gap-2 cursor-pointer"
                    >
                      {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
                      {muted ? 'Muted' : 'Audio On'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">Military Background Music</span>
                    <button
                      onClick={() => {
                        const next = !musicOn;
                        setMusicOn(next);
                        soundManager.toggleMusic(next);
                      }}
                      className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white cursor-pointer"
                    >
                      {musicOn ? 'Playing' : 'Start Music'}
                    </button>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Sound Effects (AK-47, Dice, Explosions)</span>
                      <span className="tabular-nums">{Math.round(sfxVol * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={sfxVol}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setSfxVol(v);
                        soundManager.setSfxVolume(v);
                      }}
                      className="w-full accent-amber-400"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-300 mb-1">
                      <span>Music Volume</span>
                      <span className="tabular-nums">{Math.round(musicVol * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={musicVol}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setMusicVol(v);
                        soundManager.setMusicVolume(v);
                      }}
                      className="w-full accent-sky-400"
                    />
                  </div>
                </div>

                {/* Graphics Quality */}
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-white">3D Graphics Preset</div>
                    <div className="text-xs text-slate-400">
                      Optimized for High FPS on Mobile and Desktop WebGL
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(['low', 'medium', 'high', 'ultra'] as QualityPreset[]).map((q) => (
                      <button
                        key={q}
                        onClick={() => setQualityPreset(q)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold uppercase cursor-pointer ${
                          qualityPreset === q
                            ? 'bg-sky-500 text-slate-950'
                            : 'bg-slate-950 text-slate-300 border border-slate-800'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DEVELOPER PROFILE - JAIDUL ISLAM WITH OFFICIAL PHOTO */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border-2 border-amber-500/50 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-44 h-44 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                    <div className="flex items-center gap-3.5 sm:gap-4">
                      {/* Verified Developer Photo */}
                      <div className="relative shrink-0">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.35)] bg-slate-950">
                          <img
                            src="/assets/aistudio/506357918_122126621744833198_3393251155158668934_n_2f004852.jpg"
                            alt="Jaidul Islam - Lead Game Developer"
                            className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-300"
                            loading="eager"
                          />
                        </div>
                        <div
                          className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center shadow-lg"
                          title="Verified Lead Game Developer"
                        >
                          <Award className="w-3.5 h-3.5 text-white" />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                            Jaidul Islam
                          </h3>
                          <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-extrabold uppercase tracking-wider">
                            Lead Game Developer
                          </span>
                        </div>
                        <p className="text-xs text-sky-400 font-semibold mt-0.5">
                          Architect & Creator · LUDO WARZONE 3D
                        </p>
                        <p className="text-[11px] text-slate-300 mt-1 max-w-md leading-relaxed">
                          Developed the complete 3D battlefield engine, procedural humanoid commandos, AK-47 shooting mechanics, Sky Warzone flying combat field with tactical covers, and real-time online & WiFi multiplayer matrix.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-1.5 text-xs text-slate-400 tabular-nums">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-amber-400 font-mono text-[11px] font-bold">
                        Engine: Three.js WebGL
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-sky-400 font-mono text-[11px] font-bold">
                        Netcode: WebSockets Matrix
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-[11px]">
                        Edition: Warzone Master 2026
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
