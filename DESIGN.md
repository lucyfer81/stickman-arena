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
- #6 difficulty select / adaptive ramp
- #7 combo timer UI + reward tiers
- #8 meta-progression (unlocks, daily challenge)
- #10 audio volume control (mute-only today)
- #5 depth: a ranged/jumping enemy to punish pure jump-spam

