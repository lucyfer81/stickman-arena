# stickman-arena

A polished, browser-based **2D stickman brawler** built with **Phaser 3 + vanilla ES Modules**. No build step, no backend, no runtime network calls — 100% static. Deploy it anywhere (GitHub Pages, Netlify, any static host).

Fight endless waves of stickman enemies, build combos, grab health drops, and chase a high score.

## Play

- **Move:** `A`/`D` or `←`/`→`
- **Jump:** `W` / `Space` (short hop if tapped, full jump if held — with coyote-time + jump-buffering)
- **Punch:** `J` (fast, light)
- **Kick:** `K` (slow, heavy, big knockback)
- **Overdrive:** `L` (when the gold meter under your HP is full — unleash a radial burst that clears crowds, vaporizes projectiles, and chunks bosses)
- **Pause:** `Esc`
- **Options / rebind keys:** gear `OPTIONS` button on the title (or in the pause menu) — rebind any action and toggle screen-shake (full/reduced/off). Arrow keys + `Space` always remain as movement/jump alternates.
- **Mobile:** on-screen **virtual joystick** (bottom-left) + **Jump / Punch / Kick / Burst** buttons (bottom-right). Landscape recommended.

Attacks auto-face the nearest enemy. Chain hits within the combo window to multiply your score. Fight to fill the Overdrive meter, then spend it on a clutch screen-clear.

## Run locally

```bash
npm install            # installs Playwright
npm test               # runs Playwright tests (desktop + mobile viewports)
# or just serve and play:
python3 -m http.server 8080   # open http://localhost:8080
```

## Deploy to GitHub Pages (one-time, ~30 seconds)

The site is fully static with all relative paths + a `.nojekyll` file, so it works as a **project page**:

1. Push `main` (already done).
2. Repo **Settings → Pages → Source: Deploy from a branch** → Branch: **`main`** / **`/ (root)`** → Save.
3. Wait ~1 min → your game is live at `https://<user>.github.io/stickman-arena/`.

## Features

- **Procedural everything** — stickmen drawn from a skeletal rig (no sprites); all animation is math-driven (idle breathe, run cycle, jump tuck, punch/kick extension, hurt, death ragdoll). Audio is synthesized with WebAudio (no audio files). Background is generated (gradient sky, parallax skyline, moon glow, perspective floor grid, drifting embers).
- **3 enemy types** — grunt (balanced), runner (fast/fragile), brute (tank) — with pursuit + attack AI and telegraphs. Later waves add shielders, bombers, rangers, chargers, medics, and splitters, each demanding a different answer.
- **3 bosses** — The Slammer (jump the shockwaves), The Oracle (dodge the barrage), and The Juggernaut (jump the charge) — cycling every 5th wave so every climax is a different duel.
- **Wave progression** with scaling difficulty and between-wave breaks.
- **Game feel** — hit-pause (freeze frames), screen shake, particle bursts, hit sparks, floating combo/score text, kill slow-motion, landing dust, squash feel, enemy hurt-flash + knockback.
- **Full loop** — title screen → gameplay → game over → restart, with persistent high score (`localStorage`). Quick-retry drops straight back into a run; `T` returns to the menu.
- **Meta-progression** — 10 unlockable skins tied to playstyle goals (waves, combos, mercies, overdrives, boss kills, comebacks), career stats, and a daily challenge.
- **Responsive** — Phaser FIT scaling; portrait phones get a friendly "rotate device" hint.

## Project structure

```
index.html              entry (loads local Phaser + main.js module)
css/style.css           layout + rotate-hint
js/
  main.js               Phaser config + scene registration + audio singleton
  config.js             constants & palette
  scenes/               Boot, Title, Game, UI, GameOver
  entities/             Stickman (rig), Player, Enemy, Pickup
  systems/AudioManager  procedural WebAudio sfx
  utils/                math, background
assets/
  lib/phaser.min.js     Phaser 3.80.1 bundled locally (no CDN at runtime)
  svg/favicon.svg
tests/                  Playwright specs (desktop + mobile-landscape + mobile-portrait)
tools/                  QA helpers (imgstat.py, ascii.py) — visual analysis w/o a display
notes.md                dev log
```

## Notes

- All art is generated in-repo; nothing is downloaded from the internet at runtime.
- `notes.md` documents the build journey, decisions, and bugs fixed.
