import { useEffect } from 'react';
import { WarzoneScene } from './three/WarzoneScene';
import { MainMenuAndModals } from './components/MainMenuAndModals';
import { GameHUD } from './components/GameHUD';
import { LoadingScreen } from './components/LoadingScreen';
import { FirstTimeAuthModal } from './components/FirstTimeAuthModal';
import { useGameStore } from './store/useGameStore';
import {
  subscribeToAuthChanges,
  loadOrCreatePlayerProfile,
  fetchMatchHistoryFromFirestore,
} from './services/firebase';
import { multiplayerClient } from './services/multiplayer';
import { TeamColor } from './types/game';

export default function App() {
  useEffect(() => {
    // 1. Firebase Auth & Firestore Cloud Profile Listener
    const unsubAuth = subscribeToAuthChanges(async (user) => {
      if (user) {
        try {
          const currentProfile = useGameStore.getState().profile;
          const cloudProfile = await loadOrCreatePlayerProfile(user, currentProfile);
          useGameStore.getState().setAuthenticatedProfile(cloudProfile, true);
          const history = await fetchMatchHistoryFromFirestore(user.uid);
          useGameStore.getState().setMatchHistory(history);
        } catch (err) {
          console.error('Failed to load cloud profile:', err);
        }
      }
    });

    // 2. Authoritative WebSocket Multiplayer Event Listener
    const unsubWs = multiplayerClient.subscribe((msg) => {
      const store = useGameStore.getState();

      if (msg.type === 'ws:status') {
        store.setMpConnected(Boolean(msg.connected));
      } else if (msg.type === 'room:joined' || msg.type === 'room:updated') {
        store.setMpRoom(msg.room);
        store.setMpError(null);
      } else if (msg.type === 'room:error') {
        store.setMpError(String(msg.message || 'Multiplayer error'));
      } else if (msg.type === 'match:started') {
        const room = msg.room;
        store.setMpRoom(room);
        const me = room.players.find((p: { id: string }) => p.id === multiplayerClient.playerId);
        const humanTeams: TeamColor[] = room.players.map((p: { team: TeamColor }) => p.team);
        store.startNewMatch({
          mode: room.mode as any,
          playerTeam: me ? me.team : store.playerTeam,
          humanTeams,
          isOnline: true,
        });
      } else if (msg.type === 'game:dice_rolled') {
        store.rollDice(Number(msg.diceValue));
      } else if (msg.type === 'game:move_soldier') {
        store.moveSelectedSoldier(String(msg.soldierId));
      } else if (msg.type === 'game:end_turn') {
        store.endTurn();
      }
    });

    return () => {
      unsubAuth();
      unsubWs();
    };
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans antialiased">
      {/* Initial Military Loading Screen with Tip Feed & Asset Calibration */}
      <LoadingScreen />

      {/* First-Time Welcome Modal: Continue as Guest or Sign In with Google */}
      <FirstTimeAuthModal />

      {/* Persistent Full-Viewport 3D Floating Ludo Warzone Scene */}
      <WarzoneScene />

      {/* Title Screen & Modal Overlay System */}
      <MainMenuAndModals />

      {/* Low-Occlusion In-Game HUD & Responsive Mobile/Desktop Controls */}
      <GameHUD />
    </main>
  );
}
