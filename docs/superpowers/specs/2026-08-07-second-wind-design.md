# Second Wind — "The Broken" (surprising-feature design)

Act as creative director: ship ONE surprising, memorable mechanic. Goal: a
moment players would clip and describe to a friend. Avoid generic features.

## The pitch

When the player's HP reaches 0, the game **does not end** — once per run. The
stickman *shatters*: its right arm detaches and ragdolls to the floor, the
screen desaturates to near-monochrome with a blood-red vignette, and a
heartbeat pulses. A **6-second BROKEN window** opens:

- The player is at **1 HP** (any hit is now lethal).
- Outgoing damage **x2**, move speed **x1.3** — a furious, doomed last stance.
- Each enemy killed during BROKEN **extends the timer +1.2s** and has a
  **55% chance to drop health**.
- Grabbing a health pickup during BROKEN = **REFORM**: the arm snaps back,
  colour floods back in, HP restored to 40%, "REFORMED!" banner, brief slow-mo,
  and the run continues — the survival is the reward.
- If the timer expires, or the player takes any hit during BROKEN → real death.

It fires **at most once per run**, so it is a precious, surprising event, not a
crutch. After a Second Wind, 0 HP is death as normal.

## Why this is surprising / memorable (not generic)

- Subverts the load-bearing expectation of a brawler (0 HP = game over).
- The arm-detach + reattach visual is **only possible with a stick figure** —
  it uses the art style literally (a stickman is sticks; sticks come apart).
- "I beat the wave-5 boss as a one-armed torso at 1 HP" is the kind of moment
  people text a friend about. Each occurrence is personalised (which wave, how
  you reform).
- Once-per-run rarity keeps it from becoming routine; it stays a *story*.
- It is a clean comeback beat that also raises stakes (1 HP = tension), unlike
  a generic "extra life" that trivialises failure.

## Architecture (reuse existing systems — minimal new surface)

| System | Reuse |
|---|---|
| Rage buff (dmg/score mul) | compose a `brokenMul` on top in `_resolveCombat` |
| Pickup entity + collect path | health pickup → REFORM in the existing collect branch |
| Banner / floatText / slowmo / shake | same feedback primitives as Boss/FIRST BLOOD |
| Camera punch-zoom / impact rings | fire on SHATTER and on REFORM |
| Particle emitters | shatter burst (limb shards) on enter, golden burst on reform |

**New surface (small):**
- `Player`: `broken` (bool), `brokenT` (timer), `brokenMax`, `secondWindUsed`.
  `takeHit` routes lethal damage → `_enterBroken()` instead of `die()` when the
  flag is unused. Update ticks the timer and applies speed mul. Render drops the
  right-arm segments + adds crack tint while broken.
- `GameScene`: enter/reform/expire orchestration; kill-extends-timer; dmg/speed
  mul composed with rage; HUD registry field `broken`/`brokenMax`; a shatter
  particle burst + detached-arm prop on enter; `__test.enterSecondWind` /
  `reform` / `fastForwardBroken` hooks; telemetry.
- `UIScene`: a thin red BROKEN timer bar under the HP bar + a screen vignette
  (full-screen dark overlay with red inner glow) while broken.
- `config.js`: `LASTSTAND` block (duration, dmg mul, speed mul, heal on reform,
  kill time bonus, heal drop chance, entry invuln, score bonus on reform).

## Balance

- 1 HP means the buff is high-risk; speed lets you escape, damage lets you
  race for a heal drop. It rewards skilled/attentive play, never handed out.
- 40% HP on reform keeps you alive but still vulnerable — no full reset.
- Boss waves: Second Wind still works (a clutch boss-kill at 1 HP is the peak
  use case). Enrage-summons are a source of heal drops during the window.
- Once-per-run is enforced by `secondWindUsed`; lethal damage afterwards is
  normal death. Difficulty/daily modifiers untouched.

## Testing

`tests/laststand.spec.js` (registered as `laststand` project):
1. Lethal damage enters BROKEN (player not dead, broken flag set, arm prop on
   the ground, telemetry reflects it).
2. REFORM: collecting a health pickup while broken restores HP to ~40%, clears
   broken, fires REFORMED banner.
3. Timer expiry (fast-forward hook) → real death → game over.
4. Once-per-run: a second lethal hit after reform kills normally.
5. Kill during broken extends the timer and can drop health.

## Honest caveats

- Fun is proxy-measured here (no human feel); the arm-detach is cosmetic only
  (no moveset change) to keep scope feasible and balance stable.
- The monochrome/vignette effect is an additive overlay; on rare Displays it
  may read dim — kept short (6s) to avoid fatigue.
