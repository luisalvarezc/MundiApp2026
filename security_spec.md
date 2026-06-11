# Security Specification & Test-Driven Design (TDD)
## Data Invariants

1. **User Identity Invariant**: A user can only create, update or delete a public or private profile document that belongs to their verified authentication UID (`request.auth.uid`).
2. **Scoring State Sanctity**: Only the Admin user (`luisalvarezc@gmail.com`) can modify participant scoring/rollups (`points`, `exactHits`, `outcomeHits`). Standard users are strictly blocked from self-reporting points.
3. **Prediction Ownership Invariant**: A user can only write predictions (`predictions/{predictionId}`) where the `userId` matches their authenticated UID.
4. **Chat Identity Invariant**: Messages posted in the chat must have a `userId` that matches the authenticated UID, and standard users can only write new messages (no deletions or editing other people's chats).
5. **Timeline Locking Invariant**: Matches can only be modified, scheduled, updated or marked finished by the verified Admin user (`luisalvarezc@gmail.com`).

---

## The "Dirty Dozen" Malicious Payloads
The following payloads describe malicious operations designed to break security bounds, all of which must return `PERMISSION_DENIED`.

### Pillar 1: Identity Spoofing (Users and Profiles)
1. **Ghost Admin Elevation**: Standard user tries to write a user profile setting their own score points to 999.
2. **Identity Takeover**: Authenticated User `A` tries to update Nickname or favorite team on User `B`'s profile (`users/UserB`).
3. **Unverified Account Creation**: A user with an unverified email (`email_verified == false`) tries to register a profile.

### Pillar 2: Prediction Tampering
4. **Prediction Theft**: User `A` tries to submit or edit a predictive forecast document belonging to User `B` (`predictions/UserB_wc01`).
5. **Score Injection**: Standard user tries to mark their prediction as already calculated (`calculated = true`) with `pointsEarned = 3` artificially.
6. **Mismatched Forecast UID**: User `A` tries to submit forecast where `userId` is `UserB` inside the document fields.

### Pillar 3: Admin Score Spoofing
7. **Scoreboard Defacement**: Standard user attempts to overwrite official scorelines on a Match directly (`matches/wc04-arg-esp` setting `homeScore` or status).
8. **Live Game Lockout**: Standard user attempts to change match status to `finished` or `scheduled` during a live tournament.

### Pillar 4: Chat Room Exploitation
9. **Impersonator Message**: User `A` tries to write a message with `userId` set to `UserB` in `/messages/msg123`.
10. **Troll Moderator Deletion**: Standard user tries to delete structural chat messages posted by another family member.

### Pillar 5: Path & Resource Poisoning
11. **DDoS String Overload**: Standard user tries to submit a message with a text payload exceeding 500 characters, or an invalid ID with 500 characters.
12. **Foreign Reference Invalidation**: Registering prediction pointing to a non-existent Match ID.

---

## Test Verification Runner
Our Firestore security rules compile with `rules_version = '2'`. Below is a spec template of our logic controls to verify validation coverage:

```typescript
// firestore.rules.test.ts
// Secure validation matching rules are deployed in firestore.rules
```
