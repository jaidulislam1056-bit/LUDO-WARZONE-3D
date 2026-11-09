/**
 * Red Team Security Specification & Dirty Dozen Verification Runner
 * Validates that all 12 adversarial payloads defined in security_spec.md
 * are rejected with PERMISSION_DENIED by firestore.rules.
 */

export interface DirtyDozenScenario {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_SCENARIOS: DirtyDozenScenario[] = [
  {
    id: 1,
    name: 'Unauthenticated Profile Creation',
    operation: 'create',
    path: '/players/user_1',
    auth: null,
    payload: { uid: 'user_1', displayName: 'Recruit' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Spoof',
    operation: 'create',
    path: '/players/user_1',
    auth: { uid: 'user_1', email_verified: false },
    payload: { uid: 'user_1', displayName: 'Spoofer' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-User Profile Hijack',
    operation: 'update',
    path: '/players/victim_user',
    auth: { uid: 'attacker_user', email_verified: true },
    payload: { coins: 999999 },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Shadow Field Injection on Profile',
    operation: 'update',
    path: '/players/user_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: { isAdmin: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'UID Mutation on Update',
    operation: 'update',
    path: '/players/user_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: { uid: 'other_uid' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'CreatedAt Tampering on Update',
    operation: 'update',
    path: '/players/user_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: { createdAt: '1999-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Forged Client Timestamp on Create',
    operation: 'create',
    path: '/players/user_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Oversized DisplayName Resource Exhaustion',
    operation: 'update',
    path: '/players/user_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: { displayName: 'A'.repeat(5000) },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Unbounded Array Injection',
    operation: 'update',
    path: '/players/user_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: { unlockedSkins: Array.from({ length: 50 }, (_, i) => `skin_${i}`) },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Orphaned Match Record Write',
    operation: 'create',
    path: '/players/nonexistent_user/matches/match_1',
    auth: { uid: 'nonexistent_user', email_verified: true },
    payload: { uid: 'nonexistent_user', mode: 'classic', result: 'victory' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Match History Tampering',
    operation: 'update',
    path: '/players/user_1/matches/match_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: { result: 'victory', kills: 99 },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unauthorized Match List Scraping',
    operation: 'list',
    path: '/players/victim_user/matches',
    auth: { uid: 'attacker_user', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
