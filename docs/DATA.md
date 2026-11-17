# Data: where labelled flights come from, how they're unified, and how much each one counts

The goal is the most accurate judging of whoop tricks. Every source of "this is what happened" ends up in one
benchmark (`npm run bench`, `test/benchmark.js`) and is turned into the same shape by `tools/unify.js`:

    episode = { source, trust, kind, <the recorded motion>, marks, labels: [{ t0, t1, actual, verdict, detected }] }

`actual` is the trick that really happened (null = no trick), `detected` is what the game said at the time.
`unify.run(episode)` runs the **current** detector (with the Watcher) on the motion, so every rule change is
measured against all of it at once.

## Sources

| Source | Format on disk | Motion | Labels | Trust |
|---|---|---|---|---|
| Blackbox Replay (real flight) | `pro-whooper-labelled/1` (`labelled/blackbox/…`) | gyro rates + real sticks/throttle at 250 Hz | pilot ✓ / ✗ / fix / add, U/O marks | 1.0 |
| Video Review (real DVR) | `pro-whooper-video/1` (`calibration/video/…`) | camera rotation measured from the video | pilot ✓ / ✗ / fix / add, U/O marks | 1.0 |
| Sim calibration | `pro-whooper-training/3`, `pro-whooper-session/2` (`calibration/round-N/…`) | full sim state (position, attitude, rates, sticks, contacts) | pilot yes/no per rep, Pause & Ask answers | 0.9 |
| Demo GIFs | `pro-whooper-demo/1` + `calibration/demos/cases.json` | per-frame camera rotation measured from prowhooper.com demos | the demo's trick | 0.8 |
| Judge the Bot | `pro-whooper-judge/1` (`calibration/judge/…`) | the bot flight, regenerated from trick + seed (+ humanize) | clean / sloppy / not this trick (+ "looked like") | 0.7 |
| The bot itself | generated (`src/maneuvers.js`) | scripted flights, seeded, optionally humanized | the scripted trick | 0.4 |

Why these weights: a real flight the pilot labelled is ground truth for both the motion and the call. Sim calibration
is ground truth for the call but the motion comes from our physics. Demos are real motion but measured from blurry
GIFs, with no position. Judge verdicts say whether the bot's flight *looks like* the trick to a pilot — that validates the
bot more than the detector. The bot's own flights are only as good as our understanding of each trick.

## What each source can and can't tell the detector

- **Position and obstacles**: only sim calibration has real positions relative to objects. Video Review and Blackbox
  Replay get obstacle context from the pilot's U/O marks (passed under / over, Shift = flying backward, L = sideways).
  Blackbox Replay reconstructs a plausible path from thrust (eRPM) and gravity, high-passed so it stays local —
  good enough for loops vs flips, not for which object.
- **Sticks and throttle**: exact in Blackbox Replay and sim calibration (trace format 2+). The Watcher's sticks witness
  uses them (deliberate stick on the rotating axis, throttle punches and cuts). Video Review estimates sticks from the
  rotation through the pilot's rates (shown on screen; not fed to the detector — the Watcher is off there).
- **Camera tilt**: recorded with every file; it changes how rolls and yaws look on video and how "in view" is judged.
- **Rates**: Blackbox headers carry the craft's real rates (rates_type 3 = ACTUAL); "Use these rates" copies them in.

## Live sources the Watcher triangulates while you fly (src/sim.js, `Watcher`)

path (passes, loops, rise, travel direction) · view (object in view, inverted, sky/ground, with camera tilt) ·
sticks (commanded rotation, throttle) · timing (phase lengths vs the demo GIFs, scaled to the pilot's own speed, which
it learns live from tricks every witness agreed on) · the rotation pattern itself. Hard checks from the TPW
descriptions veto a call; otherwise the witnesses vote (one vote per source) into a confidence that settles ties and
drops calls most witnesses contradict. Each event carries `watch: { conf, votes, fails }`, and session uploads keep it,
so the Watcher's own accuracy can be checked against the pilot's labels later.

## Workflow when new data arrives

1. `git pull` — uploads land in `calibration/round-N/`, `calibration/video/`, `calibration/judge/`, `labelled/blackbox/`.
2. `npm run bench` — the weighted score, per-trick recall/precision, and the most common misses/confusions.
3. Dig into a trick: `node test/replay.js <file>` / `node test/calibrate.js <file> "<trick>"` (sim data), or open the
   file in Video Review / Blackbox Replay.
4. Change the rule (or the Watcher's checks), re-run `npm run bench` and `npm test`, copy a representative file into
   `test/fixtures/` so it stays fixed.

## Raw Blackbox logs

`src/bbl.js` decodes Betaflight `.bbl/.bfl` in the browser and in Node; `test/bbl.js` checks it value-for-value against
orangebox on a real flight (`test/fixtures/bbl/flight13.bbl`). On the pilot's 16 MB flash dump all 33 flights orangebox
can read decode identically (3.3 M values in the longest), and the one it can't read (flight 16) is skipped cleanly.
