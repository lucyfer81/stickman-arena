# Overdrive Burst Meter — Fun-First Design

## Context (designer audit, post-Round-10)

The game is stable and content-rich after 10 rounds. A fun-axis review found:

- **Exciting moments:** Boss kill (wave 5), Second Wind reform, combo milestones,
  FIRST BLOOD, bomb/meteor chaos.
- **Boring moments:** The moment-to-moment `J`/`K` auto-face loop between the
  reactive peaks. Every climax is *reactive* (boss appears, you hit 0 HP) — none
  are *player-initiated*.
- **Quit points:** After seeing both bosses (~wave 10); the flat stretches where
  the player has no proactive decision.
- **Story potential:** Second Wind is the flagship ("nearly died, won anyway").
  But the player never gets to *choose* a "I am the danger now" beat.

**The structural gap:** every great brawler gives the player a self-built,
player-chosen power spike (Streets of Rage star moves, DMC Devil Trigger,
Dynasty Warriors musou, Hades calls). Stickman Arena has none. The Rage pickup
is a passive RNG damage buff, not an active button. This is the single highest
fun leverage point.

## Three proposals considered

1. **Overdrive Burst meter (player-built active super)** — fills the structural
   gap; player *chooses* the climax. Highest agency, lowest risk, reuses all juice.
2. Temp weapon pickups (bat/sword) — RNG variety, overlaps existing pickups.
3. Air juggle system — high risk (physics rework), niche audience.

**Selected: #1 — Overdrive.**

## Design

A meter the player builds by fighting. When full, **press L** (or a touch button)
to unleash a radial **OVERDRIVE** burst: a screen-clearing shockwave that damages
all enemies, vaporizes enemy projectiles, and blows out ground fire — a
player-chosen climax that fills the dead stretches between bosses with
player-made peaks.

### Meter (builds ~1 charge per wave)
- Landed hit: +5  ·  Kill: +12  ·  Hit taken: +9
- Cap 100. Empties fully on use.

### Activation
- Keyboard: **L**.  Touch: a glowing BURST button (bottom-right), interactive
  only when ready.
- Requires full meter + not already bursting + player alive.

### Effect (reuses all existing feedback primitives)
1. **Windup 0.22s** — player poses, gold aura charges, brief slow-mo,
   invuln granted through windup + release.
2. **Release** — a radial wave expands 0 → 520px over 0.3s:
   - Normal enemies: ~45 dmg + heavy knockback (kills most weak enemies).
   - Boss: ~50 dmg (chunks, never skips the fight).
   - Enemy projectiles in radius vaporized; ground fire in radius blown out
     (power fantasy + clears the screen).
   - Score bonus per enemy hit (rewards timing it for a crowd).
3. **Feedback peak** — just below boss-kill: BOSS_KILL-tier zoom + ring,
   dual gold/white particle storm, 0.4s slow-mo, heavy shake, "OVERDRIVE!"
   banner, per-enemy floatText.

### HUD
- Gold meter bar under the HP bar. Pulsing glow + "PRESS L"/"TAP" hint when full.

### Balance guards
- Boss takes flat 50 (220+ HP) — the duel still matters.
- Distinct from Rage (passive buff from RNG pickup vs active button from built meter).
- Second Wind still works during/around Overdrive (great combo potential).

### Why it's the most fun
- Adds the one missing structural beat (player-initiated climax).
- Creates a *decision* (when to pop) and a *story* ("6 on me, popped Overdrive,
  cleared them") on every run, not just wave 5.
- Mobile-parity: one button (vs the J/K chain that throttles touch).
- Engages in the first minute (~25-35s build) — the highest-churn window.
