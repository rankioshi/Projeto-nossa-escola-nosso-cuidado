# Security Specification - Nossa Escola, Nosso Cuidado

## Data Invariants
1. A user can only read and write their own profile document (`/users/{userId}`).
2. `magicPoints` must be a non-negative integer.
3. `quizIndex` must be a non-negative integer within the bounds of the questions array.
4. `transformedItems` must be an array of strings.
5. `lastUpdated` must be a server-side timestamp.

## The Dirty Dozen Payloads (Targeting `/users/{userId}`)

1. **Identity Spoofing**: Attacker (UID: `alice`) tries to write to `/users/bob`.
2. **Points Injection**: User tries to set `magicPoints: 999999` manually via console. (While technically allowed by the logic if they earned it, we should ensure it's a number). Actually, we'll just ensure types.
3. **Negative Points**: User sets `magicPoints: -50`.
4. **Invalid Type**: User sets `quizIndex: "level1"`.
5. **Shadow Field**: User adds `isAdmin: true` to their user profile.
6. **Immortal Field Breach**: User tries to modify `userId` (if stored inside).
7. **Large ID Poisoning**: User tries to use a 2MB string as a document ID.
8. **Malicious Array**: User sets `transformedItems: [true, 123]`.
9. **Old Timestamp**: User sends a hardcoded past date for `lastUpdated`.
10. **Unverified Email**: User spoofing an admin email without verification (if admin rules existed).
11. **Bulk Delete**: User tries to delete someone else's profile.
12. **Query Scraping**: User tries to list all user profiles.

## Test Runner (firestore.rules.test.ts)
```typescript
// Draft test concepts - would be implemented if testing environment was available
// describe('UserProfile Rules', () => {
//   it('should reject writes from non-owners', async () => { ... });
//   it('should reject negative points', async () => { ... });
//   it('should enforce strict schema on update', async () => { ... });
// });
```
