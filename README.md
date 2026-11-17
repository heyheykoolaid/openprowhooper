# Open Pro Whooper Project

A browser-based tiny-whoop FPV freestyle sim where tricks are scored like Tony Hawk's Pro Skater, using
[Tyrantt's Pro Whooper](https://www.prowhooper.com) trick library and competition scoring.

- **Flight model** — 1000 Hz rigid-body sim of a 65/75 mm whoop: per-motor DC motor model, prop thrust/torque,
  1S battery sag, ducts and drag, ground effect, prop wash. Default craft: BetaFPV Air65 Racing.
- **Betaflight-style flight controller** — Actual/Betaflight rates, PID + feedforward, airmode; paste your `diff all`.
- **Garage** — swap frames, motors, props, batteries; see weight, thrust-to-weight, hover throttle, flight time.
- **Live trick recognition** — all 90 tricks in the TPW library have rules (49 tested, 41 draft); combos lock in ~140 ms.
- **TPW scoring** — execution (Clean/Sloppy/Bump/Crash), repeats, back-to-back, obstacle repeats, Trick of the Week,
  streak, obstacle-switch bonus, K.W.A.D. letters.
- **Dev tools** — Trick Calibration checklist (5 reps per trick, rounds), Pause & Ask mode, flight recorder,
  Blackbox Lab (USB log download over Web Serial), opt-in uploads of calibration data and Blackbox logs to this repo.

## Play

```bash
python3 build.py            # → dist/index.html (+ dist/music/) and dist/standalone.html (single file, music embedded)
```

Open `dist/standalone.html` in Chrome or Edge. Plug your radio in as a USB joystick and set it up under
**Controls → Radio**. USB features (Blackbox Lab) and GitHub uploads need Chrome/Edge on desktop and don't work inside
embedded previews.

## Test

```bash
npm test                    # node test/all.js — trick recognition, combos, false-positive sweeps, replay fixtures
node test/replay.js <file>  # replay a calibration session / rep file through the current detector
node test/calibrate.js <file> [trick]   # per-rep measurements and disagreements
```

## Layout

| Path | What |
|---|---|
| `src/sim.js` | Simulation core (no rendering): parts, physics, flight controller, map, trick detector, scoring |
| `src/game.js` | Renderer, HUD, menus, input, music, training/calibration, Blackbox Lab, GitHub sync |
| `src/tricks.js` | Trick list and points from the TPW calculator |
| `src/index.template.html` | Page shell + styles |
| `assets/music/` | Soundtrack (main theme: "Ghostrider" by awesometexture2251) |
| `test/` | Test suites, replay/calibration tools, fixtures |
| `calibration/` | Uploaded calibration data (see `calibration/README.md`) |
| `blackbox/` | Uploaded Blackbox logs, `diff all`, build sheets |
| `docs/` | Design notes |

## Credits

Trick names, descriptions and point values: Tyrantt's Pro Whooper (prowhooper.com) calculator.
