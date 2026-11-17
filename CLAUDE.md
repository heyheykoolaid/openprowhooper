# Notes for Claude (and any developer) working on the Open Pro Whooper Project

## What this is
Browser tiny-whoop FPV sim with Tony Hawk-style trick scoring based on Tyrantt's Pro Whooper (TPW) trick library.
No framework: `src/sim.js` (pure JS, runs in Node for tests) + `src/game.js` (Three.js, browser). `python3 build.py`
inlines them into `dist/index.html` and a single-file `dist/standalone.html`.

## Golden rules
- Keep `npm test` green. Every behaviour change to trick detection must keep all suites passing and should add a
  regression case (a synthetic flight in `test/*.js` or a real recording in `test/fixtures/`).
- Scoring must stay faithful to the TPW calculator (see `ScoreKeeper` in `src/sim.js`). Presentation (combo display) may differ.
- Never commit secrets. The game's GitHub token lives only in the player's browser (localStorage); it must never be
  written into exports, uploads, the build, or the repo.
- Don't delete pilot data in `calibration/` or `blackbox/`.

## When asked to "analyze the calibration data" / "improve trick detection"
1. `git pull` to get new uploads under `calibration/round-*/`.
   - `calibration/round-N/<trick-slug>/*.json` — one file per trick that reached 5 confirmed reps (format `pro-whooper-training/2`).
   - `calibration/round-N/sessions/*.json` — whole runs (format `pro-whooper-session/1`), including Pause & Ask answers (`via: "pause-ask"`).
2. Score the current detector against everything:
   `for f in calibration/round-*/**/*.json; do node test/replay.js "$f"; done` (or pass files one by one).
   The per-trick table lists the worst tricks first.
3. For a weak trick, look at what was actually measured: `node test/calibrate.js <file> "<trick name>"`.
   It prints, per rep: raw rotations (axis, degrees, duration, rate, inverted), obstacle passes (kind, direction,
   speed, forward/lateral flight, upright), taps, stalls, rewinds, orbits, and what the detector decided.
4. Change the rule in `src/sim.js` (pattern tables `OPEN_TRICKS`, `OBSTACLE_TRICKS`, `CONTEXT_TRICKS`, special cases
   in `matchObstacle` / `eventCands`). Prefer adjusting tolerances to what the pilot actually flies.
5. Re-run replay on all data (watch for tricks that *start* failing) and `npm test`. Copy a representative failing
   file into `test/fixtures/` so it stays fixed. Promote a trick from draft (remove `draft: true` / its entry in
   `EVENT_TRICKS_DRAFT`) once real reps confirm it.
6. Summarise for the user: per-trick agreement before → after, what changed, which drafts are now confirmed, and
   which tricks need more reps.

## Tricktionary demo data (calibration/demos/)
Per-frame camera rotation measured from the prowhooper.com demo GIFs (format `pro-whooper-demo/1`; derived numbers
only — the GIFs are Tyrantt's and other pilots' footage and are not in the repo). `index.json` lists them with real
ms/frame (from the goggle OSD clock), estimated camera uptilt and the object the demo used.
- `docs/tricktionary-reference.md`: what each demo shows, timings, and every rule change made from them.
- `test/demo-replay.js`: replays the measured motion of the clearest open-air demos straight into the detector.
- `test/demos.js`: flights shaped and timed like the obstacle demos (floaty loops, trees, the pilot's legs).
- `tools/gif_rotation.py`: how the rotation was measured (SIFT, rotation-only, fisheye). Fast flips blur out; motion near
  objects biases the yaw/roll split (parallax), so the replay assigns each frame to its dominant axis.
When new demo GIFs arrive: extract frames, read the OSD clock for real timing, measure, compare against the rule, and
add a regression case (replay if open-air and well tracked, otherwise a demo-shaped flight).

## Stress testing (test/stress.js) and the bot (src/maneuvers.js)
`src/maneuvers.js` scripts trick flights (open-air, powerloop family, mavericks, Mattys, Split-S family, Blindflip) on
any over/under object — bars, trees from any angle, the pilot — with seeded random speed, loop size, floaty tops,
rates, approach angle and wobble. The same flights drive the game's Judge the Bot mode, so pilot verdicts there
validate them. `node test/stress.js 40 --seed=N` flies each trick N times plus near-miss flights and prints detection
rate and confusions (worst first); `npm test` runs a quick version. When a rule changes, run a few seeds.

## When asked to look at Blackbox logs
`blackbox/<date>-<craft>/` holds the raw `.bbl` (Betaflight onboard flash dump), `diff-all.txt`, and `build.json`
(FC info, the game's craft/tune at upload, and the optional pilot build sheet: parts, all-up weight, prop condition,
notes on how the sim felt). Decode the `.bbl` with Betaflight's `blackbox_decode` (or the blackbox-tools/orangebox
parsers) to CSV, then compare logged gyro/motor/vbat response to the sim driven by the same stick inputs, and fit
`PARTS` numbers (motor Rm/KV, prop Ct/Cq, drag, inertia) in `src/sim.js`. Use the build sheet's weight and parts
first; they are the cheapest calibration.

## Architecture pointers (src/sim.js)
- `buildDrone(spec)` → physical params from parts. `Drone.step()` 1 kHz physics. `FlightController` = Betaflight-like.
- `buildPlayground()` → map objects with collision prims + tags (`obstacle` for over/under passes, `gap`, `pole`, `wall`).
- `StreamDetector` (exported as `TrickDetector`) — live recognition: per-axis rotation tokens, obstacle passes, taps,
  stalls, rewinds, pole passes/orbits, tracking; pending/hold/commit with time-slice claims. `LegacyTrickDetector`
  is the old window-based one, kept for comparison.
- `ScoreKeeper` — TPW calculator rules.

## Confirmed by the pilot
- Matty Flip: over the object → ~360° forward flip → finish upright, facing the object, flying backward under it.
- Powerloops go inverted over the top; Maverick loops stay upright and forward-looking the whole way.
