# Stickman Arena — Lead Designer Review (Pre-Release Audit)

Method: automated 4-persona playthroughs (Playwright) + visual analysis (ASCII/imgstat)
since the runtime has no display. Telemetry via `window.__stickman`.

## Raw telemetry summary

| Persona | Duration | Wave | Score | Best combo | End HP | Damage taken |
|---|---|---|---|---|---|---|
| First-time (AFK) | 30s | 1 | 0 | 0 | 64 | 36 |
| Casual (slow sporadic) | 60s | 3 | 1415 | 10 | **100** | **0** |
| Hardcore (aggressive) | 90s | 3 | 4225 | 21 | **100** | **0** |
| Mobile (touch) | 45s | 2 | 450 | 4 | 91 | 9 |

## Persona reviews

### Casual player
"Fun for two minutes, then it gets samey. I mashed J/K and never really felt in
danger — I ended a full minute of play at FULL health. The combo pops are
satisfying and the hit-stop feels great, but there are long dead stretches where
nothing happens (waiting between waves, enemies slowly walking over). I'd play it
again on a bus ride, but there's nothing pulling me back tomorrow."
Enjoyment: 6/10 · Retention forecast: weak (2-3 sessions)

### Hardcore player
"Technically polished, but there's no game here. In 90 seconds of optimal play I
took ZERO damage and only reached wave 3 — too slow, too safe. The auto-face
attack + generous invuln frames + stunlock knockback means I can't lose. Combos
are fun to build but there's no skill ceiling to chase, no parry/dodge depth, no
enemy that forces me to adapt. I respect the juice (hit-stop, slow-mo, screen
shake) but juice without threat is a tech demo."
Enjoyment: 5/10 · Retention forecast: very weak (1 session)

### Mobile player
"The on-screen buttons work but combat feels mushy — I scored 10x less than on
keyboard. Tapping PUNCH then KICK is slow with thumbs, and the buttons are small
circles I have to look at. The joystick is fine for movement but I never know if
my tap registered. Also: in portrait I just get told to rotate — fine — but in
landscape the action buttons sit right where my palm rests. Decent for a few
waves, not something I'd open daily."
Enjoyment: 5/10 · Retention forecast: weak

### First-time player
"I pressed Start and... then what? Two red guys walked up and started hitting me.
I didn't attack because I didn't connect 'J=punch' from the title screen (it was
gone by the time I needed it). I bled out slowly with no idea what I was supposed
to do. Looks cool though. I'd bounce."
Enjoyment: 3/10 · Retention forecast: terrible (churn at first session)

## Top 10 problems (ranked by impact)

| # | Problem | Severity | Retention impact | Enjoyment impact |
|---|---|---|---|---|
| 1 | **No threat: skilled players never take damage** (auto-face + 0.6s invuln + stunlock + passive enemy AI). Hardcore survived 90s at 100% HP. | CRITICAL | Critical (no reason to return) | Critical (no tension) |
| 2 | **No onboarding** — controls vanish after title; AFK first-timers just die confused. | CRITICAL | Critical (D1 churn) | High |
| 3 | **Wave pacing too slow** — 90s of aggressive play → only wave 3; long dead time between/within waves. | High | High (boredom churn) | High |
| 4 | **Mobile combat 10x weaker than KB** — discrete tap buttons, small hit areas, no chained-input feel. | High | High (largest market) | High |
| 5 | **No depth/skill ceiling** — punch strictly worse than kick, no dodge/parry, no reason to vary tactics. | High | High (hardcore churn) | Medium |
| 6 | **Difficulty never scales to skill** — one starting curve for all; no ramp that punishes turtling. | High | High | Medium |
| 7 | **Combo system fragile & unread** — 2.2s window breaks constantly for casuals; no timer UI; no reward tiers. | Medium | Medium | Medium |
| 8 | **No meta-progression** — only a localStorage high score; no unlocks, streaks, daily challenge, variety. | Medium | High (long-term retention) | Low |
| 9 | **Restart UX fragile** — tap/click instantly restarts Game Over; no "menu"/confirm; easy misclick. | Low-Med | Low | Low-Med |
| 10 | **Audio resume / polish** — audio needs gesture; tab-away can desync; no volume, only mute. | Low | Low | Low |

## Fix order
1 (difficulty/threat) → 2 (onboarding) → 3 (pacing) → 5 (depth) → 4 (mobile) → iterate.

## Results after fixes (same 4-persona playthroughs)

| Persona | Metric | Before | After |
|---|---|---|---|
| First-time (AFK 30s) | onboarding hints | none | progressive chips shown |
| Casual (60s) | damage taken | 0 (100 HP) | 3 hits (75 HP) |
| Hardcore (90s) | damage taken | 0 (100 HP) | 6 hits, +50 healed (93 HP) |
| Hardcore (150s) | damage taken | n/a | 7 hits, reaches wave 5 |
| All | dead time between waves | 1.6–1.8s breaks | 1.0–1.1s breaks |
| Hardcore (90s) | wave reached | 3 | 4 |
| Mobile | action buttons | r50–64, tight zones | r58–74, 2.5× forgiving zones |

Core test suite: 5/5 passing (desktop ×3, mobile-landscape, mobile-portrait).

### What changed (commits on `agent-dev`)
1. **Combat threat** — flanking AI, hyper-armor through committed swings, a
   recover-phase punish window, firstStrike commit-on-arrival, attack lunge,
   taller hitbox, windup telegraph, steeper wave scaling.
2. **Onboarding** — progressive control-hint chips that dim per action.
3. **Pacing** — tighter wave breaks + faster spawns.
4. **Mobile** — bigger buttons + forgiving touch zones.
5. **UX** — brief input lockout on Game Over.

### Remaining (post-launch backlog)
- #6 difficulty select / adaptive ramp — **DONE** (Easy/Normal/Hard select)
- #7 combo timer UI + reward tiers — **DONE** (timer bar + x5/x10/x15/x20/x30 tiers)
- #8 meta-progression (unlocks, daily challenge) — **DONE** (stats + 4 skins + daily modifier)
- #10 audio volume control (mute-only today) — **DONE** (3-level volume cycle)
- #5 depth: a ranged/jumping enemy to punish pure jump-spam — **DONE** (leaper variant)

## Round 2 — remaining iterable items (all complete)

All five remaining audit items shipped on `agent-dev`:

| # | Item | Outcome |
|---|---|---|
| 5 | Leaper enemy (anti-air dive) | jump-spam at wave 6 takes real damage (5 hits -> 55 HP); no longer a safe exploit |
| 7 | Combo timer bar + reward tiers | visible 2.2s drain bar; x5/x10/x15/x20/x30 milestones (NICE!..GODLIKE!) grant bonus + banner |
| 6 | Difficulty select | Easy/Normal/Hard on title (player HP 120/100/90, enemy scaling), persists |
| 10 | Volume control | 3-level cycle (loud/soft/muted) replaces mute-only, persists |
| 8 | Meta-progression | career stats, 4 unlockable skins, date-keyed daily challenge w/ separate best |

Test suite: official 5/5 green (desktop×3, mobile-landscape, mobile-portrait),
plus focused suites for combat-exploit, onboarding, combo, difficulty, volume,
and meta-progression.

The game now offers: a real difficulty curve with a depth ceiling (armor
model + leaper), onboarding, readable combos, player-chosen challenge,
persistent goals + cosmetics, and a daily hook — the full arcade retention
loop.

## Round 3 — fun-first pass: Boss waves (climactic encounters)

The audit items were all shipped, so the next pass was pure **fun**, not
stability. Designer review found the #1 fun-killer was *structural*: every
wave had the same shape (wave 7 was just "wave 1 with bigger numbers"), no
peaks, no climax, no stories. The fix: punctuate the loop with boss duels.

### What shipped
- **Boss enemy** every 5th wave — a big (1.6×) elite with boss-tier HP, a
  top-spanning HP bar, and a unique **ground-slam**: a 0.7s telegraphed
  charge → leap → twin **shockwaves** race outward along the floor. The
  shockwaves only hit a grounded player, so the counter is to **jump** — a
  new moment-to-moment decision the kick-spam optimum never demanded.
- **Enrage phase** at ≤50% HP: faster + summons 2 grunts once (drama spike
  mid-fight).
- **Climactic payoff** on boss death: 0.5s slow-mo + hit-pause + heavy
  shake + 100-particle burst + "BOSS DOWN! +1500" banner + guaranteed heal
  drop — the single strongest feedback peak in the game.
- Slam has full super-armor once committed; the *counter is jumping*, not
  staggering — a clean rock/paper/scissors beat.

### Verification
- Official CI suite: 5/5 green (desktop ×3, mobile-landscape, mobile-portrait).
- New `tests/boss.spec.js`: 3/3 — boss spawns on wave 5 with HP bar; real-
  pipeline kill fires the +1500 payoff + heal drop + wave clear; slam emits
  shockwaves that clip a grounded player; jumping clears them.
- Hardcore 90s playthrough: clean (no errors), boss telemetry flowing.

### Fun-axis deltas (structural/mechanical proxies)
| Axis | Before | After |
|---|---|---|
| Climactic peaks | none (flat curve) | boss duel + slow-mo every 5 waves |
| Story potential | "reached wave N" | "beat the wave-5 boss at low HP" |
| Per-moment decisions | kick-spam optimal | must jump shockwaves on boss waves |
| Structural variety | every wave identical | boss waves break the pattern |
| Quit-point risk | "samey" after 3–4 waves | a wave-5 goal to push toward |

Honest caveats: fun is measured via proxies here, not human feel; one boss
visual may repeat past wave 15 (add boss variety later). The two other
proposals from this pass (punch/kick role split, low-HP berserk comeback)
remain for the next iteration.

### Round 3b — fun-first pass: punch/kick role split (combat depth)

Bosses fixed the peaks, but the *bulk* of playtime (normal waves) was still
monotonous: kick strictly dominated punch (16 vs 9 dmg, higher DPS too), so
the optimal loop was kick-spam — the hardcore persona's "no game here" fix
the leaper/boss only partly addressed. This pass gives every second of combat
a real decision.

### What shipped
- **Punch damage 9 → 11**: punch DPS (≈35.5) now matches kick (≈34.8), so
  punching is viable — lower per-hit/knockback but safe and fast.
- **Punch → kick cancel**: pressing kick during a punch flows seamlessly into
  a kick (combo rhythm). Turns button-mashing into a readable chain. Kick is
  the committed move and cannot itself be cancelled.
- **Kick whiff endlag**: a kick that reaches the end of its active window
  *without connecting* switches to a longer recover (0.26 → 0.42s). Blind
  kick-spam is now punishable by dodging runners; a connecting kick recovers
  fast. (`attack.connected` is set by the combat resolver on hit and drives
  the whiff branch.)

### Verification
- Official CI suite: 5/5 green. Boss suite: 3/3 green (unaffected).
- New `tests/depth.spec.js`: 3/3 — punch deals exactly 11 dmg; a whiffed
  kick's resolved `total` (0.62) is materially longer than a connecting
  kick's (0.46); a punch cancels into a kick within the swing window (input
  not dropped, as it was pre-change).

### Fun-axis deltas
| Axis | Before | After |
|---|---|---|
| Per-second decision variety | kick-spam optimal | punch / kick / cancel each have a role |
| Risk/reward | kick strictly best | kick now whiff-punishable; punch is the safe option |
| Skill expression | none (mash K) | mixing punch→kick is rewarded; whiffing kick is punished |
| Applies to | n/a | every wave + boss waves |

Resulting rock/paper/scissors: punch = safe combo-starter (vs fast runners),
kick = committed finisher/spacing tool (vs brutes, boss recover windows),
cancel = the skill-expression glue. Still proxy-measured; the remaining
proposal (low-HP berserk comeback) is queued for a future pass.

## Round 10 — Lead-designer audit (fresh 4-persona playthrough)

Re-ran the original audit (Playwright personas + `window.__stickman` telemetry)
on the post-9-rounds build to find what's *still* hurting players today.

### Raw telemetry (this round, NORMAL difficulty)

| Persona | Duration | Wave | Score | Best combo | End HP | Hits taken | Healed | Kills |
|---|---|---|---|---|---|---|---|---|
| First-time (AFK) | 30s | 1 | 0 | 0 | 55 | 5 (45 dmg) | **0** | 0 |
| Casual (slow) | 60s | 4 | 2915 | 9 | **18** | 8 (82 dmg) | **0** | 9 |
| Hardcore (aggro) | 90s | 5 (boss) | 6765 | 19 | 74 | 2 (26 dmg) | **0** | 12 |
| Mobile (touch) | 45s | 2 | 860 | 4 | 53 | 5 (47 dmg) | **0** | 4 |

### Persona reviews

**Casual** — "I was *loving* it until I realised I was about to die. The bombsquad
wave was chaos in a good way, combos popped, the FIRST BLOOD banner made me grin.
But I ended at 18 HP and I never saw a single health pickup — I killed 9 guys and
got NOTHING back. When I die next hit it's going to feel cheap, like the game
didn't give me a chance. Make health come to me." Enjoyment 6/10 · Retention: weak.

**Hardcore** — "Normal waves are still a warm-up I can't lose — 2 hits in 90s.
The boss is the only thing that respects me, and even then I walked in at near
full. The juice is incredible (that punch-zoom on every connect!) but I never
once had to interact with health, rage, or Second Wind, because I was never in
danger on the way up. Give me a reason to sweat before wave 5." 6/10 · weak.

**Mobile** — "I scored 8x less than keyboard and only saw 2 waves. The buttons
are bigger now but tapping PUNCH then KICK with one thumb is still slow and I
keep taking hits I can't answer. I never even saw a heal. It's fine for a bus
ride but keyboard players are playing a different, better game." 4/10 · weak.

**First-time** — "I pressed Start and froze. Two guys walked up and hit me. Some
text flashed 'PRESS J TO FIGHT' but by then I was already confused and just
watched myself bleed for 30 seconds. 0 kills, 0 score, still wave 1. I'd close
the tab." 3/10 · terrible (D1 churn).

### Top 10 problems (ranked by impact)

| # | Problem | Sev | Retention | Enjoyment |
|---|---|---|---|---|
| 1 | **Resource loop broken — nobody collects health pickups (healed:0 for ALL personas).** Drops spawn at the corpse, 42px collect radius, no magnet, 9s life. Casual died at 18HP with 0 recovery; Second Wind's reform path (needs a heal) is effectively unreachable in real play. Wastes the pickup feature + gates the flagship comeback. | CRIT | High | High |
| 2 | **First-time D1 churn** — 0 kills/0 score, stuck wave 1 for 30s, bleeds to 55HP. Text hints ("PRESS J") don't rescue a frozen player. | CRIT | Critical | High |
| 3 | **Mobile combat 8x weaker than KB** (860 vs 6765 score; wave 2 in 45s). Bigger buttons helped but discrete thumb-taps still can't chain. | HIGH | High | High |
| 4 | **Normal-wave threat too low for skilled play** — hardcore took 2 hits/90s; all real danger back-loaded to the wave-5 boss. | HIGH | High | Med |
| 5 | **Dead time persists** — opening 0-score stretches + between-wave flat plateaus (hardcore score flat ~2.5s across wave 4). | MED-HI | Med | Med |
| 6 | **Casual combo ceiling low (best 9)** — 2.2s window + slow reactions; can't reach higher tiers/rewards. | MED | Med | Med |
| 7 | **Casual near-death with no recovery path** — 18HP/0heal, next hit lethal, reads as unfair. (symptom of #1) | MED | Med | Med |
| 8 | **First-time has no active assist** — AFK lifeline is passive text only; no auto-demo/safe-first-hit. | MED | Med | Med |
| 9 | **Game's best content (boss/Second Wind) gated behind wave 5** — casual/mobile never reach it in a typical session. | MED | Med | Low |
| 10 | **Meta-goals invisible mid-run** — unlocks/stats only surface at Game Over; nothing pulls through flat stretches. | LOW-MED | Low | Low |

### Fix order
1 (resource loop / pickup magnet) → 2 (first-time assist) → 4 (early threat) →
3 (mobile chaining) → iterate.

### Fix #1 — resource loop (pickup magnet) — SHIPPED

**Root cause (source-verified):** health/rage pickups spawn on the corpse with a
42px collect radius, no magnet, 9s life. Telemetry proved nobody ever collected
one (healed:0 for all four personas), so the resource loop never engaged and
Second Wind's reform path was effectively unreachable in real play.

**Fix (`Pickup.js` + `config.js`):** a sticky **magnet** — once the player is
within `MAGNET_RANGE` (150px) the pickup locks on and steers its velocity
straight toward the player (`MAGNET_SPEED` 760, `MAGNET_STEER` 22/s), killing the
spawn-pop instantly so it zips in. Steering (not additive accel) is what makes
the lock-on feel snappy. The homing flag is sticky so it never flickers at the
range edge, and it lifts a grounded drop back off the floor. Latent telemetry
bug also fixed: `_reform()` now sets `player.reformed = true` (the flag was read
but never written).

**Verification:**
- New `tests/magnet.spec.js` 3/3 — in-range drop is collected (+HP, healed>0);
  out-of-range drop stays put (no arena-wide vacuum); broken player collects →
  reforms.
- Official CI 5/5 green; `laststand` 4/4 green (touched `_reform`).
- **Real-play proof (casual persona, same script, before → after):**

| Metric | Before | After |
|---|---|---|
| End HP | 18 (near death) | **74** (healthy) |
| Healed | **0** | **25** |
| Score | 2915 | **4135** (+42%) |
| Best combo | 9 | **13** |
| Kills | 9 | **12** |
| Rage collected | 0s | **7.3s** (magnet hits all pickup types) |

The casual player no longer bleeds out unfairly — they heal, survive, and engage
with more of the game. #7 (unfair near-death) is resolved as a symptom of #1.

### Fix #2 — first-time assist (training dummy) — SHIPPED

**Root cause (telemetry):** the AFK first-timer finished 30s still in wave 1,
0 kills / 0 score, bleeding to 55HP confused. The "PRESS J" text pointer can't
rescue a player who hasn't connected J=punch by the time enemies arrive — they
get hit before they understand what to do, and never earn the FIRST BLOOD win
that would teach the loop.

**Fix (`Enemy.js` + `GameScene.js` + `config.js`):** wave 1's **opening enemy is a
passive "training dummy"** — it approaches (tension) but holds its swing until the
player provokes it (any landed hit) OR `FIRST_ENEMY_PASSIVE_GRACE` (5s, ticked from
spawn) expires. So a fumbling player gets a real window to see the J-pointer, land
a punch on the enemy that's right in front of them, and trigger the FIRST BLOOD
celebration — the dopamine beat that teaches the core loop. Only the *first* wave-1
enemy is a dummy (the rest apply normal pressure), and the truce is one-shot.

**Verification:**
- New `tests/onboarding-assist.spec.js` 4/4 — wave-1 opener is passive and deals 0
  damage while in range; a hit provokes it (passive→false); the grace timer expires
  passive (deterministic, driven to threshold); **integration: a fumbling player
  (freeze 2.5s then mash J) lands a kill + FIRST BLOOD at 0 damage.**
- Official CI 5/5 green; `retention` 5/5 + `onboard` 1/1 green (spawnOne unchanged
  shape).
- Honest limitation: the *AFK* persona (presses nothing, ever) can't be rescued by
  a mechanic that rewards engaging — its numbers are unchanged. The assist targets
  the far larger group of players who *will* try J but need a moment. #8 (no active
  assist) is resolved; the passive-text gap is closed with a mechanical safe window.

### Fix #3 — mobile hold-to-repeat (touch combat parity) — SHIPPED

**Root cause (telemetry):** mobile scored 860 vs keyboard 6765 and only reached
wave 2 in 45s. Round 1's bigger buttons helped aim but not throughput: one tap =
one swing, and tap-lift-tap with a thumb is intrinsically slow. Keyboard players
mash J freely; touch players couldn't match that cadence.

**Fix (`UIScene.js`):** **hold-to-repeat** for PUNCH/KICK on touch only. Holding
the button re-arms the attack edge every frame, so the next swing fires the
instant the attack cycle allows — a thumb resting on PUNCH now chains attacks
fluidly. `tryAttack()` no-ops mid-swing, so the auto-repeat self-syncs to the
player's attack timing (no runaway). Keyboard stays edge-triggered (no change for
desktop). JUMP is unchanged (it uses variable-height hold semantics already).

**Verification:**
- New `tests/mobile-autofire.spec.js` 2/2 — a held PUNCH starts ≥3 swings (many),
  while a single discrete edge starts exactly 1 (no runaway without a hold).
- Official CI 5/5 green incl. mobile-landscape touch.
- **Real-play proof (30s, realistic slow-thumb mobile):**

| Mode | Score | Kills | Best combo |
|---|---|---|---|
| Discrete tap (400ms cadence) | 380 | 2 | 3 |
| **Hold (thumb rests on button)** | **1440** (3.8×) | **4** (2×) | **9** (3×) |

A realistic mobile player now chains attacks like a keyboard masher. #3 (mobile
8× weaker) substantially closed at the throughput layer.


