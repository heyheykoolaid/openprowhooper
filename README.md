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
- **The Watcher** — a second live judge: every call is cross-checked against the path, what the camera saw (with your
  camera tilt), your sticks and throttle, and demo timing scaled to your speed; calls that break a trick's TPW
  description are vetoed. Air between trick segments is allowed (up to 1 s, 1.5 s hanging inverted).
- **RaceGOW tracks** — build tracks from white 24-inch PVC gates (gates, arches, ladders, hurdles, flag gates, cubes,
  pylons, invisible gates) in a living room, garage, warehouse or the playground with Velocidrone-style tools (move /
  rotate / scale, snaps, numeric input, multi-select, clone, undo, gate order, reset points, checks, paint-a-path,
  ortho view, fly test). Race them: **Infinite** (best 3 consecutive clean laps, live ghosts), hot lap, or a fixed-lap
  race from a countdown; export, import and upload tracks, times and ghosts.
- **Blackbox Replay** — load a Betaflight `.bbl` and watch the flight: attitude from the gyro, a plausible path from
  eRPM thrust, the real sticks on screen, trick detection on it, and your labels for training. The decoder (`src/bbl.js`)
  matches orangebox value for value.
- **Video Review** — measure an FPV clip's motion in the browser, confirm/correct the detector's calls; full player
  controls, stop/resume measuring, estimated stick overlay and a ghost quad.
- **Flight telemetry (opt-in)** — share each run (path, sticks, trick calls, F/Q flags; nothing personal) with the
  project through a drop-off: the Claude link, a small relay for testers, or your own GitHub token. See docs/DATA.md.
- **Dev tools** — Trick Calibration checklist (5 reps per trick, rounds), Pause & Ask mode, flight recorder, Judge the
  Bot (orbit/zoom camera, humanized bot flights), Blackbox Lab (USB log download over Web Serial), opt-in uploads of
  calibration data and Blackbox logs to this repo, and one benchmark over every labelled source (`npm run bench`,
  docs/DATA.md).

## Play

Hosted copy (rebuilt from `main` on every push, once Pages is switched on): https://heyheykoolaid.github.io/openprowhooper/

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
npm run bench               # detector benchmark over every labelled source (calibration, demos, judge, video, blackbox, bot)
node test/stress.js 40 --tilt=30 --human=1 --air=0.6 --slow=1.3   # randomised bot flights, pilot-like conditions
```

## Layout

| Path | What |
|---|---|
| `src/sim.js` | Simulation core (no rendering): parts, physics, flight controller, map, trick detector, scoring |
| `src/game.js` | Renderer, HUD, menus, input, music, training/calibration, Blackbox Lab, Video Review, Judge the Bot, GitHub sync |
| `src/racegow.js` | RaceGOW: track format, building blocks, rooms, race rules, ghosts, Make-raceable checks (pure, tested by `test/racegow.js`) |
| `src/raceedit.js` | RaceGOW race editor, racing HUD, ghosts and track sharing (same module as game.js) |
| `src/bbl.js`, `src/bbreplay.js` | Betaflight blackbox decoder; Blackbox Replay mode |
| `src/maneuvers.js`, `src/vision.js` | The bot's scripted trick flights; FPV video motion tracker |
| `tools/unify.js` | Every labelled source as one kind of episode, for the benchmark |
| `src/tricks.js` | Trick list and points from the TPW calculator |
| `src/index.template.html` | Page shell + styles |
| `assets/music/` | Soundtrack (main theme: "Ghostrider" by awesometexture2251) |
| `test/` | Test suites, replay/calibration tools, fixtures |
| `calibration/` | Uploaded calibration data (see `calibration/README.md`) |
| `blackbox/` | Uploaded Blackbox logs, `diff all`, build sheets |
| `docs/` | Design notes |

## Credits

Thanks and credit to Tyrantt, Pro Whooper, IGOW, RaceGOW, Skittles, Infinity Loops, and the Whoop Community.

Trick names, descriptions and point values: Tyrantt's Pro Whooper (prowhooper.com) calculator.

- **Music:** 8BiT_ and the Infinity Loops community. The in-game byTe_me Radio streams their free-to-use collection from archive.org; rights remain with the artists.
- **Whoop model:** the Air65 frame is BetaFPV's design and the "Beast Brain" canopy is by _tcmore; the game draws them from their model files (`assets/meshes/`). They belong to their makers and are used in this game only.
- **The Murderdome:** made in the spirit of the Dirtbag FPV club and Spider Sugar FPV. The start flag is the Dirtbag FPV logo (`assets/flags/dirtbag.webp`), added at the pilot's request, for this game only; it belongs to the club.
- **The Playground's sign gantry** carries the Metal Craft FPV logo (`assets/flags/metalcraft.webp`), added at the owner's request, for this game only; it belongs to Metal Craft FPV.
- **Graffiti:** the MoPenguinz FPV and ByTe_Me logos appear on the walls alongside the pilot's own pieces. They belong to their makers and are used in this game only.

## Art
Graffiti pieces in `assets/graffiti/` — HeyHey KoolAid, Clappy and RWDC — are original drawings by the pilot (heyheykoolaid)
and are used with permission in this game only.
