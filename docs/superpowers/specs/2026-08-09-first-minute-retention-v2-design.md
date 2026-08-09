# First-Minute Retention — Onboarding, Reward Pacing, Progression

Scope: **retention only**. Assume players play for ~60 seconds. Improve the
first-minute experience so more players stay past wave 1 and return tomorrow.

## First-minute analysis (telemetry + source read)

Telemetry baseline (Round 10/11, NORMAL):

| Persona      | Time | Wave | Score  | Combo | End HP   | Healed |
|--------------|------|------|--------|-------|----------|--------|
| First-time (AFK) | 30s | 1 | 0      | 0     | 55       | 0      |
| Casual       | 60s  | 4   | 4190   | 10    | 100      | 50     |
| Hardcore     | 90s  | 4   | 11660  | 30    | 100      | 25     |
| Mobile       | 45s  | 2   | 860    | 4     | 53       | 0      |

### Why players STAY (60s window)
1. **FIRST BLOOD** at ~3–5s — first dopamine peak (slow-mo + banner + zoom).
2. **Juicy combo loop** — chunky hit-stop, x5/x10/x15/x20/x30 tier bonuses.
3. **Visible score climb** + per-wave clear bonuses.
4. **Goal chip** — "NEXT → reach wave 5 · EMBER skin" surfaces meta mid-run.
5. **Overdrive meter building** — anticipation of the player-chosen climax.
6. **The wave-5 boss promise** — "one more wave" pull.

### Why players LEAVE in 60s
1. **CRITICAL — First-timer bleeds out confused (D1 churn).** AFK = 0 kills, 0
   score, dies in wave 1. The training dummy only protects against the FIRST
   wave-1 enemy; the 2nd/3rd wave-1 enemies attack normally and swarm a frozen
   player. Even a fumbling player who tries J a moment too late gets punished
   by the non-dummy adds.
2. **Overdrive unreachable for casuals in 60s.** ~25–35s of solid combat to
   charge. Casuals/mobile don't reliably get there, so the flagship player-
   initiated climax is invisible to the at-risk segment.
3. **Score is 0 for the opening 3–5s.** Can't score until an enemy is in reach
   AND you hit it. The number reads "0" while the player is still figuring out
   what to do — the single worst moment to look stuck.
4. **Health loop broken for mobile.** 0 healed (magnet requires kills, mobile
   struggles to kill). Casual got 50 HP only because they killed enough.
5. **Game Over shames wave-1 deaths.** "YOU REACHED WAVE 1" with no forward
   guidance; no teaching, no quick-win carrot to pull them into run #2.

## Design — three pillars (retention only)

### Pillar A — Onboarding (fix the first 30s)
**A1. Wave-1 full truce.** Extend the passive-dummy flag to ALL wave-1 enemies
until the player's first landed hit (`onboard.firstHit`). The truce is one-shot
per run and clears globally on first hit. Result: a confused/frozen player
cannot die in wave 1 — they survive long enough to learn. After first hit the
wave fights back normally (still gentle: wave-1 scaling, no swarm gate).

- Files: `GameScene.js` (spawn flag + global gate), `Enemy.js` (clear on
  global signal), `config.js` (rename/extend grace constant).
- Risk: existing `onboarding-assist` test asserts only the first enemy is
  passive — update it to assert all wave-1 enemies are passive until first hit.

**A2. Title control-tag.** Float a "J" glyph next to the punching demo
stickman on the title screen so the keybinding is unmissable at the moment
the demo punch fires (the bottom-text line is 400px away and easy to miss).

- Files: `TitleScene.js`.

### Pillar B — Reward pacing (fix the dopamine curve)
**B1. Seed Overdrive meter.** Start the meter at ~35 (out of 100) and grant
+15 on FIRST BLOOD so the first Overdrive is reachable in ~15–20s instead of
30s+. The flagship player-chosen power lands inside the 60s window for every
player who lands a hit — including casuals and mobile.

- Files: `Player.js` (seed `burst` on init), `GameScene.js` (first-blood
  meter bonus), `config.js` (constants).

**B2. First-action score bonus.** Grant small score bonuses for the very
first observed inputs so the score climbs from second 1, not second 5:
- first MOVE: +5 ("LET'S GO")
- first JUMP: +5 ("UP AND AT IT")
- first landed HIT: +10 (in addition to the hit's own score)

One-shot per run, gated to wave 1. The number stops reading 0 during the most
churn-prone seconds.

- Files: `GameScene.js` (onboard flags already exist; add score awards).

**B3. Guaranteed early heal.** Drop a health pickup on the 3rd wave-1 kill if
`HP < maxHealth`. Engages the health loop for casuals/mobile within the first
30s even if RNG was cold. Magnet (already shipped) delivers it.

- Files: `GameScene.js` (kill path).

### Pillar C — Progression (fix the "why come back")
**C1. ROOKIE skin — first-wave-clear unlock.** A new unlockable skin earned by
clearing wave 1 (achievable in <60s by anyone who survives the opening). This
bootstraps the meta-progression loop within a single short session — every
returning player has at least one cosmetic they're working toward / just earned.
Inserted as the FIRST unlock in `nextUnlock` order so fresh accounts see a
near-term goal instead of "reach wave 5".

- Files: `Meta.js` (new skin + unlock type 'waveclear'), `config.js`/palette.
- The skin palette: a soft warm-white "ROOKIE" — distinct from CYAN default.

**C2. Game-over contextual tip for early deaths.** For deaths on wave 1 or 2,
show a one-line hint above the CTA so the next run is better than the first:
- died on wave 1 → "TIP: hold J to chain punches — the first punch is free."
- died on wave 2 → "TIP: kick (K) shoves enemies back when you're swarmed."
- Replaces nothing; adds a single line. Surfaced for the segment most likely
  to churn and never return.

- Files: `GameOverScene.js`.

## Out of scope (deliberate)
- Mobile combat throughput gap (Round 10 shipped hold-to-repeat; deeper fix is
  beyond first-minute scope).
- Wave-5 boss gating (intentional design per DESIGN.md — the pull, not a wall).
- Combat tuning / difficulty / new enemies (the game is content-rich).

## Verification
- Official CI 5/5 green (desktop ×3, mobile-landscape, mobile-portrait).
- Updated `onboarding-assist`: all wave-1 enemies passive until first hit.
- New `firstminute.spec.js`: A1 (wave-1 truce survives AFK), B1 (overdrive
  seeded + first-blood bonus), B2 (first-action score), B3 (3rd-kill heal),
  C1 (rookie skin unlocks on wave-1 clear), C2 (game-over tip for wave-1 death).
- Smoke: title J-tag renders; no console errors across the loop.

## Honest caveats
- "Fun" is measured via structural/mechanical proxies + Playwright telemetry,
  not human feel.
- The wave-1 truce makes the very first wave safer than the rest of the curve
  on purpose — that's the teachable moment. After first hit it escalates
  normally (wave 2 vanguard, wave 3 swarm gate, etc.).
