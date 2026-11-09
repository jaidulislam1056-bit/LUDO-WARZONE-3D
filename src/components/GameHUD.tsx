import { useEffect, useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Dices,
  Flame,
  Home,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Skull,
  Smartphone,
  Sparkles,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { getSkyCoverForPosition, ITEM_CATALOG, TEAM_COLORS, WEAPONS } from '../constants/boardData';
import { CameraViewMode, ItemType, WeaponType } from '../types/game';
import { soundManager } from '../services/audio';

export function GameHUD() {
  const {
    screen,
    gameMode,
    playerTeam,
    humanTeams,
    currentTurnTeam,
    turnPhase,
    roundNumber,
    diceValue,
    isRollingDice,
    combatActionUsed,
    bannerMessage,
    soldiers,
    selectedSoldierId,
    validMoveSoldierIds,
    targetableEnemyIds,
    selectedTargetId,
    inventory,
    dailyMissions,
    hasUnclaimedMatchBonus,
    claimMatchDeploymentBonus,
    safeZoneRadius,
    dangerZoneWarning,
    teamScores,
    matchElapsedSec,
    winnerTeam,
    killFeed,
    hitMarkerActive,
    cameraMode,
    isAimingMode,
    hudCollapsed,
    rollDice,
    selectSoldier,
    moveSelectedSoldier,
    selectTargetEnemy,
    toggleAimMode,
    fireWeaponAtTarget,
    reloadWeapon,
    throwGrenadeAtTarget,
    useInventoryItem,
    switchSoldierWeapon,
    triggerJumpAnimation,
    nudgeSelectedSoldierFreeMove,
    endTurn,
    setScreen,
    setCameraMode,
    cameraMenuOpen,
    setCameraMenuOpen,
    setHudCollapsed,
    startNewMatch,
  } = useGameStore();

  // Auto-detect mobile / coarse pointer device, with optional toggle so any tester can also inspect mobile touch controls
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [muted, setMuted] = useState(soundManager.isMuted);

  useEffect(() => {
    const checkTouch = () => {
      const coarse = window.matchMedia?.('(pointer: coarse)').matches;
      const narrow = window.innerWidth < 820;
      setIsTouchDevice(Boolean(coarse || narrow));
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  // PC Keyboard Shortcuts & Match Timer
  useEffect(() => {
    if (screen !== 'playing') return;

    const timer = setInterval(() => {
      useGameStore.getState().tickMatchTimer();
    }, 1000);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const st = useGameStore.getState();
      if (st.screen !== 'playing') return;

      switch (e.code) {
        case 'Space':
        case 'Enter': {
          e.preventDefault();
          if (st.turnPhase === 'DICE_PHASE' && st.humanTeams.includes(st.currentTurnTeam)) {
            st.rollDice();
          } else if (st.turnPhase === 'MOVE_PHASE' && st.validMoveSoldierIds.length > 0) {
            st.moveSelectedSoldier();
          } else if (st.turnPhase === 'ACTION_PHASE' && !st.combatActionUsed) {
            if (st.targetableEnemyIds.length > 0) st.fireWeaponAtTarget();
            else st.endTurn();
          } else if (st.turnPhase === 'ACTION_PHASE') {
            st.endTurn();
          }
          break;
        }
        case 'KeyR':
          st.reloadWeapon();
          break;
        case 'KeyG':
          st.throwGrenadeAtTarget();
          break;
        case 'KeyW':
          st.nudgeSelectedSoldierFreeMove(0, -1);
          break;
        case 'KeyS':
          st.nudgeSelectedSoldierFreeMove(0, 1);
          break;
        case 'KeyA':
          st.nudgeSelectedSoldierFreeMove(-1, 0);
          break;
        case 'KeyD':
          st.nudgeSelectedSoldierFreeMove(1, 0);
          break;
        case 'KeyC': {
          const modes: CameraViewMode[] = ['isometric', 'shoulder', 'follow', 'top'];
          const next = modes[(modes.indexOf(st.cameraMode) + 1) % modes.length];
          st.setCameraMode(next);
          break;
        }
        case 'KeyH':
          st.setHudCollapsed(!st.hudCollapsed);
          break;
        case 'Escape':
          st.setScreen('paused');
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearInterval(timer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [screen]);

  if (screen === 'menu') return null;

  const activeSoldier =
    soldiers.find((s) => s.id === selectedSoldierId) ||
    soldiers.find((s) => s.team === playerTeam) ||
    soldiers[0];

  const myTeamSoldiers = soldiers.filter((s) => s.team === playerTeam);
  const myTotalKills = myTeamSoldiers.reduce((acc, s) => acc + s.kills, 0);
  const aliveSoldiersCount = soldiers.filter((s) => s.state !== 'dead').length;
  const isMyTurn = humanTeams.includes(currentTurnTeam);
  const weaponSpec = WEAPONS[activeSoldier?.weapon || 'ak47'];

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-2 sm:p-4 select-none">
      {/* Center Reticle & Hit Marker when in Aiming Mode */}
      {(isAimingMode || hitMarkerActive) && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <div
            className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-transform ${
              hitMarkerActive ? 'border-red-500 scale-125' : 'border-amber-400/90'
            }`}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
          </div>
        </div>
      )}

      {/* ================= TOP STATUS BAR (RESPONSIVE: MOBILE & DESKTOP) ================= */}
      <header className="w-full max-w-6xl mx-auto flex flex-col gap-1.5 sm:gap-2">
        {/* Row 1: Player Card (left) & Utility Cluster with Alive count, Camera, Audio, Pause (right) */}
        <div className="flex items-center justify-between gap-1.5 sm:gap-3 w-full">
          {/* Left: Player Card & Health Bar */}
          <div className="pointer-events-auto flex items-center gap-2 sm:gap-3 bg-slate-950/92 border border-slate-800 rounded-xl px-2 sm:px-3.5 py-1 sm:py-1.5 shadow-xl shrink-0">
            <div
              className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg flex flex-col items-center justify-center font-extrabold text-white border border-white/25 shrink-0"
              style={{ backgroundColor: TEAM_COLORS[activeSoldier.team].primaryHex }}
            >
              <span className="text-[7px] sm:text-[8px] uppercase leading-none opacity-80">
                {activeSoldier.team}
              </span>
              <span className="text-xs sm:text-sm leading-tight font-mono">#{activeSoldier.index + 1}</span>
            </div>

            <div className="w-20 sm:w-32">
              <div className="flex items-center justify-between text-[10px] sm:text-xs">
                <span className="font-bold text-white truncate max-w-[55px] sm:max-w-[80px]">
                  {activeSoldier.name}
                </span>
                <span className="font-mono text-amber-400 tabular-nums text-[9px] sm:text-[10px]">
                  {activeSoldier.ammo}/{activeSoldier.reserveAmmo}
                </span>
              </div>

              {/* Health Bar */}
              <div className="mt-0.5 w-full h-2.5 sm:h-3 bg-slate-900 rounded-sm overflow-hidden border border-slate-700 relative">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200"
                  style={{ width: `${(activeSoldier.hp / activeSoldier.maxHp) * 100}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] sm:text-[9px] font-bold text-white tabular-nums drop-shadow">
                  {activeSoldier.hp} HP
                </span>
              </div>
            </div>
          </div>

          {/* Right: Alive / Kills Counter + Camera View + Audio + Pause (100% VISIBLE ON MOBILE) */}
          <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Alive & Kills Counter - GUARANTEED 100% VISIBLE */}
            <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-950/92 border border-slate-800 rounded-xl px-2 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold text-slate-200 tabular-nums shadow-lg shrink-0">
              <span className="flex items-center gap-1 text-sky-400">
                <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="font-extrabold">{aliveSoldiersCount}</span>
                <span className="hidden xs:inline text-[9px] text-slate-400">Alive</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="flex items-center gap-1 text-red-400">
                <Skull className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="font-extrabold">{myTotalKills}</span>
              </span>
            </div>

            {/* SINGLE CAMERA VIEW BUTTON */}
            <button
              onClick={() => setCameraMenuOpen(true)}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-950/92 hover:bg-slate-900 text-sky-400 border border-slate-800 cursor-pointer shadow-lg active:scale-95 transition-all"
              title="Camera View Selection"
            >
              <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Audio Mute/Unmute */}
            <button
              onClick={() => {
                const next = !muted;
                setMuted(next);
                soundManager.setMuted(next);
              }}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-950/92 hover:bg-slate-900 text-slate-200 border border-slate-800 cursor-pointer shadow-lg active:scale-95 transition-all"
              title="Mute / Unmute Audio"
            >
              {muted ? (
                <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-400" />
              )}
            </button>

            {/* Pause */}
            <button
              onClick={() => setScreen('paused')}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-950/92 hover:bg-slate-900 text-slate-200 border border-slate-800 cursor-pointer shadow-lg active:scale-95 transition-all"
              title="Pause Match"
            >
              <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* Row 2: Centered 3D Dice Roll & Turn Status */}
        <div className="pointer-events-auto mx-auto flex items-center gap-2 bg-slate-950/92 border border-slate-700/90 rounded-xl px-3 py-1 sm:py-1.5 shadow-2xl">
          <button
            onClick={() => {
              if (turnPhase === 'DICE_PHASE' && isMyTurn) rollDice();
            }}
            disabled={turnPhase !== 'DICE_PHASE' || !isMyTurn || isRollingDice}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-mono font-extrabold text-sm sm:text-base border transition-transform cursor-pointer shrink-0 ${
              turnPhase === 'DICE_PHASE' && isMyTurn
                ? 'bg-amber-400 text-slate-950 border-amber-300 hover:scale-105 shadow-md animate-pulse'
                : 'bg-slate-800 text-white border-slate-600'
            }`}
            title="Roll 3D Dice"
          >
            {isRollingDice ? '...' : diceValue ?? <Dices className="w-4 h-4 text-slate-900" />}
          </button>

          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-xs"
                style={{ backgroundColor: TEAM_COLORS[currentTurnTeam].primaryHex }}
              />
              <span className="text-[10px] sm:text-[11px] font-extrabold text-amber-400 uppercase tracking-wide">
                {isMyTurn ? 'YOUR TURN' : `${TEAM_COLORS[currentTurnTeam].name.toUpperCase()} TURN`}
              </span>
            </div>
            <div className="text-[9px] sm:text-[10px] text-slate-300 font-medium truncate max-w-[190px] sm:max-w-[240px]">
              {turnPhase === 'DICE_PHASE' && isMyTurn
                ? 'Roll the dice'
                : turnPhase === 'MOVE_PHASE' && isMyTurn
                  ? `Select soldier · Move ${diceValue}`
                  : turnPhase === 'ACTION_PHASE' && isMyTurn
                    ? 'Target & Fire or End Turn'
                    : `Round ${roundNumber}`}
            </div>
          </div>
        </div>

        {/* Match Start Combat Coins Deployment Bonus (Claim from Mission Section) */}
        {hasUnclaimedMatchBonus && (
          <div className="pointer-events-auto mx-auto max-w-md w-full bg-gradient-to-r from-amber-500/25 via-yellow-500/30 to-amber-500/25 border-2 border-amber-400 rounded-xl px-3 py-1.5 shadow-2xl flex items-center justify-between gap-2 animate-bounce">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-left">
                <div className="text-[11px] font-black text-amber-300 uppercase tracking-wide">
                  ম্যাচ শুরুর মিশন বোনাস: +২৫০ কয়েন প্রস্তুত!
                </div>
                <div className="text-[10px] text-slate-200">
                  মিশন সেকশন থেকে এখনই আপনার বোনাস কয়েন সংগ্রহ করুন
                </div>
              </div>
            </div>
            <button
              onClick={() => claimMatchDeploymentBonus()}
              className="px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md cursor-pointer active:scale-95 transition-all shrink-0"
            >
              CLAIM +250
            </button>
          </div>
        )}

        {/* Tactical Cover Indicator for Sky Warzone */}
        {gameMode === 'sky_warzone' && getSkyCoverForPosition(activeSoldier.targetWorldPos) && (
          <div className="pointer-events-auto mx-auto bg-sky-950/90 border border-sky-400/80 rounded-xl px-3 py-1 text-xs font-bold text-sky-200 flex items-center gap-2 shadow-lg animate-pulse">
            <Shield className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[11px]">
              🛡️ IN COVER: {getSkyCoverForPosition(activeSoldier.targetWorldPos)?.name} (-{Math.round((getSkyCoverForPosition(activeSoldier.targetWorldPos)?.damageReduction || 0.4) * 100)}% DAMAGE)
            </span>
          </div>
        )}
      </header>

      {/* ================= SINGLE CAMERA VIEW SELECTOR MODAL ================= */}
      {cameraMenuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 pointer-events-auto">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-sky-400" />
                <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">
                  SELECT CAMERA VIEW (ক্যামেরা ভিউ)
                </h3>
              </div>
              <button
                onClick={() => setCameraMenuOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'isometric', label: 'Isometric 3D', icon: '📐', desc: 'Classic board view' },
                { id: 'shoulder', label: 'Shoulder TPS', icon: '🎯', desc: 'Over-the-shoulder' },
                { id: 'follow', label: 'Follow Cam', icon: '🏃', desc: 'Behind commando' },
                { id: 'top', label: 'Top-Down', icon: '🗺️', desc: 'Overhead satellite' },
                { id: 'front', label: 'Front Enemy', icon: '⚔️', desc: 'Face-to-face combat' },
                { id: 'orbit', label: '360° Free Orbit', icon: '🔄', desc: 'Free drag rotation' },
              ].map((v) => {
                const active = cameraMode === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      setCameraMode(v.id as CameraViewMode);
                      setCameraMenuOpen(false);
                    }}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                      active
                        ? 'bg-sky-500/20 border-sky-400 text-white shadow-lg'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-base">{v.icon}</div>
                    <div className="text-xs font-bold mt-1 text-white">{v.label}</div>
                    <div className="text-[9px] text-slate-400">{v.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone / Kill Feed Notification */}
      {(dangerZoneWarning || killFeed.length > 0) && (
        <div className="flex flex-col items-center sm:items-end gap-1 mt-1 pointer-events-none">
          {dangerZoneWarning && (
            <div className="bg-red-950/90 border border-red-500/50 text-red-200 text-[10px] sm:text-xs font-bold px-2.5 py-0.5 rounded-lg">
              {dangerZoneWarning}
            </div>
          )}
          {killFeed.slice(0, 1).map((kf) => (
            <div
              key={kf.id}
              className="bg-slate-950/85 border border-slate-800 text-[10px] text-slate-200 px-2 py-0.5 rounded-md"
            >
              <span className="font-bold text-amber-400">{kf.killerName}</span> ✕{' '}
              <span className="font-bold text-red-400">{kf.victimName}</span>
            </div>
          ))}
        </div>
      )}

      {/* ================= MOBILE CONTROLS (WHEN TOUCH / MOBILE SCREEN) ================= */}
      {isTouchDevice && (
        <div className="mt-auto w-full max-w-lg mx-auto flex flex-col gap-2 pb-1">
          {/* Top Row: Soldier Selection & Primary Action Prompt */}
          <div className="pointer-events-auto flex items-center justify-between gap-1.5 bg-slate-950/90 border border-slate-800/90 rounded-xl px-2.5 py-1.5 shadow-xl">
            {/* Squad soldiers 1..4 */}
            <div className="flex items-center gap-1">
              {myTeamSoldiers.map((s) => {
                const isSel = selectedSoldierId === s.id;
                const canMove = validMoveSoldierIds.includes(s.id);
                return (
                  <button
                    key={s.id}
                    onClick={() => selectSoldier(s.id)}
                    disabled={s.state === 'dead'}
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs font-mono font-bold flex flex-col items-center justify-center border transition-all ${
                      s.state === 'dead'
                        ? 'bg-slate-900/40 text-slate-600 border-slate-800 cursor-not-allowed'
                        : isSel
                          ? 'bg-amber-400 text-slate-950 border-amber-300 shadow'
                          : canMove
                            ? 'bg-emerald-500 text-slate-950 border-emerald-300 animate-pulse'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    #{s.index + 1}
                  </button>
                );
              })}
            </div>

            {/* Contextual Action Button */}
            <div className="flex items-center gap-1.5">
              {turnPhase === 'DICE_PHASE' && isMyTurn && (
                <button
                  onClick={() => rollDice()}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs shadow cursor-pointer active:scale-95"
                >
                  ROLL DICE
                </button>
              )}
              {turnPhase === 'MOVE_PHASE' && isMyTurn && (
                <button
                  onClick={() => moveSelectedSoldier()}
                  className="px-3 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-xs shadow cursor-pointer active:scale-95"
                >
                  MOVE ({diceValue})
                </button>
              )}
              {turnPhase === 'ACTION_PHASE' && isMyTurn && (
                <button
                  onClick={() => endTurn()}
                  className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs cursor-pointer active:scale-95"
                >
                  END TURN
                </button>
              )}
            </div>
          </div>

          {/* Bottom Dual Thumb Row: Left D-Pad + Right Tactical Combat Cluster */}
          <div className="flex items-end justify-between px-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
            {/* Left Thumb: 4-Way Directional Touch Pad */}
            <div className="pointer-events-auto relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-950/85 border-2 border-slate-700 flex items-center justify-center shadow-2xl shrink-0">
              <button
                onClick={() => nudgeSelectedSoldierFreeMove(0, -1)}
                className="absolute top-1 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center active:bg-amber-400 active:text-slate-950"
              >
                ▲
              </button>
              <button
                onClick={() => nudgeSelectedSoldierFreeMove(0, 1)}
                className="absolute bottom-1 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center active:bg-amber-400 active:text-slate-950"
              >
                ▼
              </button>
              <button
                onClick={() => nudgeSelectedSoldierFreeMove(-1, 0)}
                className="absolute left-1 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center active:bg-amber-400 active:text-slate-950"
              >
                ◀
              </button>
              <button
                onClick={() => nudgeSelectedSoldierFreeMove(1, 0)}
                className="absolute right-1 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center active:bg-amber-400 active:text-slate-950"
              >
                ▶
              </button>
              <div className="w-8 h-8 rounded-full bg-slate-600/60 border border-slate-500 flex items-center justify-center text-[9px] font-bold text-slate-300">
                MOVE
              </div>
            </div>

            {/* Right Thumb: Tactical Combat Cluster (FIRE, AIM, RELOAD, GRENADE, JUMP) */}
            <div className="pointer-events-auto flex items-center gap-2 bg-slate-950/85 border border-slate-800/90 p-2 rounded-2xl shadow-2xl shrink-0">
              {/* Secondary Actions Column */}
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={toggleAimMode}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full border flex flex-col items-center justify-center text-[8px] sm:text-[9px] font-bold ${
                    isAimingMode
                      ? 'bg-sky-500 text-slate-950 border-white'
                      : 'bg-slate-900 text-white border-slate-700'
                  }`}
                  title="Aim"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  AIM
                </button>
                <button
                  onClick={reloadWeapon}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-900 text-white border border-slate-700 flex flex-col items-center justify-center text-[8px] sm:text-[9px] font-bold active:bg-slate-700"
                  title="Reload"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-sky-400" />
                  RELOAD
                </button>
              </div>

              {/* Large Primary FIRE Button */}
              <button
                onClick={() => fireWeaponAtTarget()}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 border-2 border-amber-200 flex flex-col items-center justify-center font-extrabold text-[10px] sm:text-[11px] shadow-lg active:scale-95"
                title="Fire Weapon"
              >
                <Flame className="w-5 h-5 sm:w-6 sm:h-6 fill-slate-950" />
                FIRE
              </button>

              {/* Grenade & Jump Column */}
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => throwGrenadeAtTarget()}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-900 text-white border border-slate-700 flex flex-col items-center justify-center text-[8px] sm:text-[9px] font-bold active:bg-amber-500 tabular-nums"
                  title="Grenade"
                >
                  <span className="text-emerald-400 font-bold">{inventory.grenade.count}</span>
                  GRENADE
                </button>
                <button
                  onClick={triggerJumpAnimation}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-slate-900 text-white border border-slate-700 flex flex-col items-center justify-center text-[8px] sm:text-[9px] font-bold active:bg-slate-700"
                  title="Jump"
                >
                  JUMP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= DESKTOP CONTROLS (WHEN ON PC / WIDESCREEN) ================= */}
      {!isTouchDevice && (
        <div className="mt-auto mx-auto max-w-5xl w-full flex flex-col items-center">
          <button
            onClick={() => setHudCollapsed(!hudCollapsed)}
            className="pointer-events-auto px-3 py-1 rounded-t-lg bg-slate-950/90 border border-b-0 border-slate-800 text-[11px] font-semibold text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            {hudCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" /> Tactical Dock
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" /> Hide Dock
              </>
            )}
          </button>

          {!hudCollapsed && (
            <div className="pointer-events-auto w-full bg-slate-950/95 border border-slate-800 rounded-2xl p-2.5 shadow-2xl flex flex-wrap items-center justify-between gap-2.5">
              {/* 1. Squad Soldiers Selector */}
              <div className="flex items-center gap-1.5">
                {myTeamSoldiers.map((s) => {
                  const isSel = selectedSoldierId === s.id;
                  const canMove = validMoveSoldierIds.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => selectSoldier(s.id)}
                      disabled={s.state === 'dead'}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer tabular-nums ${
                        s.state === 'dead'
                          ? 'bg-slate-900/40 text-slate-600 border-slate-800/50 cursor-not-allowed'
                          : isSel
                            ? 'bg-slate-800 text-white border-amber-400 shadow'
                            : canMove
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-400'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      <div>#{s.index + 1}</div>
                      <div className="text-[10px] text-slate-400">{s.hp} HP</div>
                    </button>
                  );
                })}
              </div>

              {/* 2. Main Turn Actions */}
              <div className="flex items-center gap-2">
                {turnPhase === 'DICE_PHASE' && (
                  <button
                    onClick={() => rollDice()}
                    disabled={!isMyTurn || isRollingDice}
                    className={`px-4 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5 cursor-pointer ${
                      isMyTurn
                        ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-lg'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Dices className="w-4 h-4" />
                    {isRollingDice ? 'ROLLING...' : 'ROLL DICE'}
                  </button>
                )}

                {turnPhase === 'MOVE_PHASE' && isMyTurn && (
                  <button
                    onClick={() => moveSelectedSoldier()}
                    className="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-extrabold text-xs cursor-pointer"
                  >
                    MOVE ({diceValue})
                  </button>
                )}

                {turnPhase === 'ACTION_PHASE' && isMyTurn && (
                  <>
                    <button
                      onClick={() => fireWeaponAtTarget()}
                      disabled={combatActionUsed || targetableEnemyIds.length === 0}
                      className={`px-3.5 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5 cursor-pointer ${
                        !combatActionUsed && targetableEnemyIds.length > 0
                          ? 'bg-red-500 hover:bg-red-400 text-white shadow-lg'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <Crosshair className="w-4 h-4" />
                      FIRE ({targetableEnemyIds.length})
                    </button>

                    {targetableEnemyIds.length > 1 && (
                      <select
                        value={selectedTargetId || ''}
                        onChange={(e) => selectTargetEnemy(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-xs text-white rounded-lg px-2 py-1.5"
                      >
                        {targetableEnemyIds.map((tid) => (
                          <option key={tid} value={tid}>
                            Target: {tid.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    )}

                    <button
                      onClick={reloadWeapon}
                      className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold cursor-pointer"
                    >
                      Reload
                    </button>

                    <button
                      onClick={() => throwGrenadeAtTarget()}
                      disabled={combatActionUsed || inventory.grenade.count <= 0}
                      className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700 text-xs font-bold cursor-pointer tabular-nums"
                    >
                      Grenade ({inventory.grenade.count})
                    </button>

                    <button
                      onClick={() => endTurn()}
                      className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs cursor-pointer"
                    >
                      END TURN
                    </button>
                  </>
                )}
              </div>

              {/* 3. Items, Weapon & Camera View */}
              <div className="flex items-center gap-1.5">
                {(['health_kit', 'armor', 'shield', 'jump_pad'] as ItemType[]).map((iKey) => {
                  const itm = inventory[iKey];
                  return (
                    <button
                      key={iKey}
                      onClick={() => useInventoryItem(iKey)}
                      disabled={!isMyTurn || itm.count <= 0}
                      title={`${itm.name}: ${itm.description}`}
                      className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border tabular-nums cursor-pointer ${
                        isMyTurn && itm.count > 0
                          ? 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                          : 'bg-slate-900/40 text-slate-600 border-slate-800/50 cursor-not-allowed'
                      }`}
                    >
                      {ITEM_CATALOG[iKey].name.split(' ')[0]} x{itm.count}
                    </button>
                  );
                })}

                <select
                  value={activeSoldier.weapon}
                  onChange={(e) => switchSoldierWeapon(e.target.value as WeaponType)}
                  className="bg-slate-900 border border-slate-700 text-xs font-bold text-amber-400 rounded-lg px-2 py-1.5 cursor-pointer"
                >
                  {(Object.keys(WEAPONS) as WeaponType[]).map((wKey) => (
                    <option key={wKey} value={wKey}>
                      {WEAPONS[wKey].name.split(' ')[0]}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    const modes: CameraViewMode[] = ['isometric', 'shoulder', 'follow', 'top'];
                    const next = modes[(modes.indexOf(cameraMode) + 1) % modes.length];
                    setCameraMode(next);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  title="Camera View"
                >
                  <Camera className="w-3.5 h-3.5 text-sky-400" />
                  {cameraMode.toUpperCase()}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= PAUSE / VICTORY / GAMEOVER MODAL ================= */}
      {(screen === 'paused' || screen === 'victory' || screen === 'gameover') && (
        <div className="fixed inset-0 z-40 bg-slate-950/80 flex items-center justify-center p-4 pointer-events-auto">
          <div className="max-w-sm w-full bg-slate-900 border border-slate-700 rounded-2xl p-5 text-center shadow-2xl space-y-4">
            {screen === 'paused' && (
              <>
                <h2
                  className="text-xl font-extrabold text-white"
                  style={{ fontFamily: "'Chakra Petch', sans-serif" }}
                >
                  MISSION PAUSED
                </h2>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setScreen('playing')}
                    className="w-full py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-slate-950" />
                    Resume
                  </button>
                  <button
                    onClick={() => startNewMatch({ mode: gameMode })}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Restart
                  </button>
                  <button
                    onClick={() => setScreen('menu')}
                    className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold text-sm flex items-center justify-center gap-2 border border-slate-800 cursor-pointer"
                  >
                    <Home className="w-4 h-4" />
                    Main Menu
                  </button>
                </div>
              </>
            )}

            {(screen === 'victory' || screen === 'gameover') && (
              <>
                <div
                  className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl mx-auto ${
                    screen === 'victory'
                      ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40'
                      : 'bg-red-500/20 text-red-400 border border-red-500/40'
                  }`}
                >
                  <Shield className="w-7 h-7" />
                </div>
                <h2
                  className="text-2xl font-extrabold text-white"
                  style={{ fontFamily: "'Chakra Petch', sans-serif" }}
                >
                  {screen === 'victory' ? 'VICTORY!' : 'DEFEATED'}
                </h2>
                <p className="text-xs text-slate-300">
                  {winnerTeam ? `${TEAM_COLORS[winnerTeam].name} Wins the Match` : 'Match Complete'}
                </p>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-3 gap-2 text-xs tabular-nums">
                  <div>
                    <div className="text-slate-400 text-[10px]">Kills</div>
                    <div className="text-sm font-extrabold text-emerald-400">{myTotalKills}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">Rounds</div>
                    <div className="text-sm font-extrabold text-white">{roundNumber}</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-[10px]">Coins</div>
                    <div className="text-sm font-extrabold text-amber-400">
                      +{(screen === 'victory' ? 250 : 75) + myTotalKills * 35}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <button
                    onClick={() => startNewMatch({ mode: gameMode })}
                    className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs cursor-pointer"
                  >
                    Play Again
                  </button>
                  <button
                    onClick={() => setScreen('menu')}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
                  >
                    Main Menu
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
