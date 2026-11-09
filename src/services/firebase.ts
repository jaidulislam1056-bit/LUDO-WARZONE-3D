import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { PlayerProfileData, MatchHistoryItem, TeamColor, GameMode } from '../types/game';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection to Firestore on boot as required by firebase-integration-rpc skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Sanitize and clamp PlayerProfileData to strictly match firebase-blueprint.json & firestore.rules
function sanitizeProfilePayload(profile: PlayerProfileData) {
  const validTeams: TeamColor[] = ['red', 'blue', 'green', 'yellow'];
  return {
    uid: String(profile.uid).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128),
    displayName: String(profile.displayName || 'Commander').trim().slice(0, 40) || 'Commander',
    xp: Math.max(0, Math.min(100000000, Math.floor(profile.xp))),
    level: Math.max(1, Math.min(500, Math.floor(profile.level))),
    coins: Math.max(0, Math.min(100000000, Math.floor(profile.coins))),
    kills: Math.max(0, Math.min(1000000, Math.floor(profile.kills))),
    deaths: Math.max(0, Math.min(1000000, Math.floor(profile.deaths))),
    wins: Math.max(0, Math.min(1000000, Math.floor(profile.wins))),
    matchesPlayed: Math.max(0, Math.min(1000000, Math.floor(profile.matchesPlayed))),
    selectedTeam: validTeams.includes(profile.selectedTeam) ? profile.selectedTeam : 'red',
    selectedSkin: String(profile.selectedSkin || 'skin_standard').slice(0, 32),
    selectedWeaponSkin: String(profile.selectedWeaponSkin || 'weapon_classic_wood').slice(0, 32),
    unlockedSkins: (profile.unlockedSkins || ['skin_standard', 'weapon_classic_wood'])
      .slice(0, 20)
      .map((s) => String(s).slice(0, 64)),
    achievements: (profile.achievements || []).slice(0, 20).map((a) => String(a).slice(0, 64)),
  };
}

export async function signInWithGooglePopup(): Promise<User | null> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export function subscribeToAuthChanges(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export async function loadOrCreatePlayerProfile(
  user: User,
  fallbackProfile: PlayerProfileData,
): Promise<PlayerProfileData> {
  const path = `players/${user.uid}`;
  const ref = doc(db, 'players', user.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return {
        uid: user.uid,
        displayName: data.displayName || user.displayName || 'Commander',
        xp: Number(data.xp ?? 0),
        level: Number(data.level ?? 1),
        coins: Number(data.coins ?? 500),
        kills: Number(data.kills ?? 0),
        deaths: Number(data.deaths ?? 0),
        wins: Number(data.wins ?? 0),
        matchesPlayed: Number(data.matchesPlayed ?? 0),
        selectedTeam: (data.selectedTeam as TeamColor) || 'red',
        selectedSkin: data.selectedSkin || 'skin_standard',
        selectedWeaponSkin: data.selectedWeaponSkin || 'weapon_classic_wood',
        unlockedSkins: Array.isArray(data.unlockedSkins)
          ? data.unlockedSkins
          : ['skin_standard', 'weapon_classic_wood'],
        achievements: Array.isArray(data.achievements) ? data.achievements : [],
      };
    } else {
      const initial = sanitizeProfilePayload({
        ...fallbackProfile,
        uid: user.uid,
        displayName: (user.displayName || fallbackProfile.displayName || 'Commander').slice(0, 40),
      });
      await setDoc(ref, {
        ...initial,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return initial;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function syncLoadoutToFirestore(profile: PlayerProfileData): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== profile.uid) return;
  const path = `players/${profile.uid}`;
  const clean = sanitizeProfilePayload(profile);
  try {
    await updateDoc(doc(db, 'players', profile.uid), {
      displayName: clean.displayName,
      coins: clean.coins,
      selectedTeam: clean.selectedTeam,
      selectedSkin: clean.selectedSkin,
      selectedWeaponSkin: clean.selectedWeaponSkin,
      unlockedSkins: clean.unlockedSkins,
      achievements: clean.achievements,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncMatchOutcomeToFirestore(
  profile: PlayerProfileData,
  match: {
    mode: GameMode;
    team: TeamColor;
    result: 'victory' | 'defeat';
    kills: number;
    deaths: number;
    coinsEarned: number;
    xpEarned: number;
  },
): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== profile.uid) return;
  const profilePath = `players/${profile.uid}`;
  const clean = sanitizeProfilePayload(profile);
  try {
    await updateDoc(doc(db, 'players', profile.uid), {
      xp: clean.xp,
      level: clean.level,
      coins: clean.coins,
      kills: clean.kills,
      deaths: clean.deaths,
      wins: clean.wins,
      matchesPlayed: clean.matchesPlayed,
      achievements: clean.achievements,
      updatedAt: serverTimestamp(),
    });

    const matchId = `match_${Date.now()}`;
    const matchPath = `players/${profile.uid}/matches/${matchId}`;
    try {
      await setDoc(doc(db, 'players', profile.uid, 'matches', matchId), {
        uid: clean.uid,
        mode: match.mode,
        team: match.team,
        result: match.result,
        kills: Math.max(0, Math.min(500, Math.floor(match.kills))),
        deaths: Math.max(0, Math.min(500, Math.floor(match.deaths))),
        coinsEarned: Math.max(0, Math.min(100000, Math.floor(match.coinsEarned))),
        xpEarned: Math.max(0, Math.min(100000, Math.floor(match.xpEarned))),
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, matchPath);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, profilePath);
  }
}

export async function fetchMatchHistoryFromFirestore(uid: string): Promise<MatchHistoryItem[]> {
  if (!auth.currentUser || auth.currentUser.uid !== uid) return [];
  const path = `players/${uid}/matches`;
  try {
    const q = query(collection(db, 'players', uid, 'matches'), orderBy('createdAt', 'desc'), limit(10));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        mode: (data.mode as GameMode) || 'classic',
        team: (data.team as TeamColor) || 'red',
        result: data.result === 'victory' ? 'victory' : 'defeat',
        kills: Number(data.kills ?? 0),
        deaths: Number(data.deaths ?? 0),
        coinsEarned: Number(data.coinsEarned ?? 0),
        xpEarned: Number(data.xpEarned ?? 0),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : 'Recent',
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
