# Round 15 — Mercy: 「The Coward's End」(surprising mechanic)

## Mandate (creative director)
The game works and is polished. Invent ONE unusual mechanic players would talk
about. Avoid generic features. Make it memorable.

## Why this
Audit of existing signature moments: Second Wind (reactive climax at 0 HP),
OVERDRIVE (player-chosen burst), Boss duels (scripted peaks). The missing
axis is **genre subversion**: every brawler's core verb is "kill everything",
and the game never breaks that verb. Nothing in the kit asks the player to
*feel* something other than dominance. That's the lever.

Mercy / surrender is unusual because **almost no arcade brawler permits it**.
When it triggers the first time the player experiences a genuine 2-second
"wait — what do I do?" pause. That pause is the memory.

## Candidates considered (rejected)
- Corpse-as-weapon (ragdal golf): funny & shareable but the bit is known
  (Goat Simulator etc.) — not unusual enough.
- Persistent Nemesis (rival across runs): very talkable but needs
  cross-session persistence + naming + HUD — too large for one round.
- Self-portrait mirror enemy: surreal but one-note.

## Mechanic — 「The Coward's End」
When the **last living enemy** of a non-boss wave is reduced below 30% HP, it
may **surrender**: drop its weapon, fall to its knees, raise its hands, wave
a white flag. A soft spotlight pools beneath it. Combat music ducks. Banner:
**"MERCY?"**.

The player then has a ~2.8s window with a real choice:

- **SPARE** (new `H` key / on-screen SPARE button):
  - Enemy stands, **bows**, turns and walks off-screen.
  - Reward: score bonus `150 × wave × scoreMul` (strictly > the normal
    `100 × wave` clear bonus, so mercy is the *generous* read), + a
    **guaranteed pickup** (50% heal / 25% rage / 25% score gem) — magnet
    delivers.
  - Banner **"MERCY  +N"**, slow-mo chime, gold particles.

- **KILL** (just attack as normal — punch/kick/overdrive all connect):
  - Normal death + normal reward. NO punishment — killing is the default,
    not a sin.
  - But a brief dark beat acknowledges the act: the white flag flutters to
    the ground, a `…` floats up, a short desaturate pulse. The game *sees*
    what you did.

- **IGNORE** (window expires):
  - Enemy "loses hope", stands, and **flees** off-screen at speed. No
    reward, no penalty. Tiny comedic `…coward` beat. Wave clears when it
    leaves.

## Eligibility & gating (one beat per wave, never trivializes a fight)
A surrender may trigger only when ALL hold:
- Exactly ONE living enemy remains.
- Its HP ≤ 30% of max (the fight is already decided — mercy is a denouement,
  not a difficulty break).
- Wave ≥ 2 (wave 1 = the teaching truce; don't stack climaxes).
- Non-boss, non-vanguard, non-special: eligible variants are `grunt`,
  `runner`, `brute`, `leaper`, `shielder`, `bomber`, `ranger`, `charger`,
  `medic`, `splitter`, `spawnling`. (Excluded: anything that's already a
  scripted climax — bosses / mini-elite.)
- Not during Second Wind "broken" state (don't stack two signature beats).
- RNG 45%, rolled once the instant conditions are first met.
- At most one surrender per wave (`this.mercyDone`).

## Wave-clear interaction
A spared / fleeing enemy is marked `departed = true` and walks/runs off the
world. The wave's `alive` count excludes `departed` so the clear fires the
moment the player acts (spare) or the enemy flees — the enemy's exit animation
plays during the between-wave break, not before. This is the only wave-clear
rule change (filter `!e.dead && !e.departed`).

## Why it's "surprising / memorable" not generic
1. **Subverts the genre's core verb** (kill everything). First time it fires
   you genuinely don't know what to do.
2. **Stickman-native**: kneeling + bowing + hands-up is fully readable on a
   skeletal rig — the art style carries the emotion other styles can't.
3. **Each wave can end differently**: brutal clear vs quiet mercy vs dark
   kill vs comedic flee. Replay variety without new content.
4. **Creates stories**: "I spared every enemy in wave 7", "I killed the
   surrendering guy, felt bad", "the last one ran away from me".
5. **One-per-wave + 45% + low-HP + non-boss gating** keeps it scarce ⇒ it's
   always a story, never a routine.

## Scope (reuses existing systems)
- `config.js`: `MERCY` block.
- `Stickman.js`: `surrenderPose(t, p)` + `computePose` case.
- `Enemy.js`: `surrender` state object + `_startSurrender` +
  `_progressSurrender` + `_render` branch + flag/spotlight overlay + takeHit
  kill-marking + `departed` flag.
- `GameScene.js`: `_maybeStartMercy()` per-frame check, `_spareEnemy()`,
  kill-of-surrendered-enemy "…" beat in `_onPlayerHit`, wave-clear filter
  gains `&& !e.departed`, `__test` hooks, telemetry, H-key consumption.
- `UIScene.js`: SPARE touch button (shown only during an active surrender
  window) + keyboard `H` listener → `controls.sparePressed`.

## Tests
- `tests/mercy.spec.js` — deterministic: trigger gating (1-enemy/low-HP/
  wave≥2/non-boss/RNG), spare path (departed + bonus + pickup), kill path
  (…beat + normal reward), flee path (window expiry), one-per-wave,
  boss/excluded-variant/broken-state suppression, real-play persona that
  reaches a wave and either spares or kills.
- Regression: all existing suites unchanged in behavior (wave-clear filter
  only adds a conjunct that's false for non-mercied enemies).

## Honest caveats
- Fun is measured via structural proxies + Playwright telemetry, not human
  feel. The "ethical pause" claim is a design inference from genre norms,
  not measured.
- RNG-gated + one-per-wave ⇒ a short session may never see it; the first
  time it fires is the point. Could raise chance later if telemetry shows
  it never appears.
