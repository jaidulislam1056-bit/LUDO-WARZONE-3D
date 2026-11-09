# Security Specification: LUDO WARZONE 3D

## 1. Data Invariants
1. **Master Gate & Ownership**: Every `/players/{playerId}` document belongs exclusively to `request.auth.uid == playerId`. Every `/players/{playerId}/matches/{matchId}` subcollection document requires that the parent `/players/{playerId}` document exists (`exists(...)`) and belongs to `request.auth.uid == playerId`.
2. **Email Verification**: All authenticated reads and writes require `request.auth != null && request.auth.token.email_verified == true`.
3. **Strict Schema & Volumetric Bounds**:
   - `PlayerProfile`: `keys().hasAll(...)` and `keys().hasOnly(...)` enforced on create; `affectedKeys().hasOnly(...)` enforced on update.
   - `displayName`: string, 1..40 chars.
   - `xp`, `level`, `coins`, `kills`, `deaths`, `wins`, `matchesPlayed`: integer, non-negative, bounded.
   - `unlockedSkins` and `achievements`: bounded lists (`size() <= 20`).
   - `createdAt` and `updatedAt`: server timestamps (`request.time`), with `createdAt` and `uid` immutable across updates.
4. **MatchRecord Immutability**: Match history records under `/players/{playerId}/matches/{matchId}` are append-only (`create`, `get`, `list` by owner) and cannot be updated or deleted once recorded.

## 2. The "Dirty Dozen" Payloads
1. **Unauthenticated Profile Creation**: `auth = null` attempting `create` on `/players/user_1`.
2. **Unverified Email Spoof**: `auth = { uid: 'user_1', token: { email_verified: false } }` attempting `create` on `/players/user_1`.
3. **Cross-User Profile Hijack**: `auth.uid = 'attacker'` attempting `create` or `update` on `/players/victim`.
4. **Shadow Field Injection on Profile**: Payload includes undeclared field `"isAdmin": true` on `/players/user_1`.
5. **UID Mutation on Update**: Updating `uid` field in `/players/user_1` to `'other_uid'`.
6. **CreatedAt Tampering on Update**: Modifying `createdAt` timestamp during profile update.
7. **Forged Client Timestamp on Create**: Setting `createdAt` to a past/future timestamp (`!= request.time`).
8. **Oversized DisplayName Resource Exhaustion**: Setting `displayName` to a 5,000-character string (`size() > 40`).
9. **Unbounded Array Injection**: Setting `unlockedSkins` to an array of 50 items (`size() > 20`).
10. **Orphaned Match Record Write**: Creating `/players/user_1/matches/match_1` when `/players/user_1` does not exist.
11. **Match History Tampering**: Attempting `update` or `delete` on `/players/user_1/matches/match_1`.
12. **Unauthorized Match List Scraping**: `auth.uid = 'attacker'` attempting `list` on `/players/victim/matches`.
