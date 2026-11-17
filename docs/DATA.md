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

## Flight telemetry (opt-in)

| | |
|---|---|
| Format | `pro-whooper-flight/1` — one finished Free Fly / Session run |
| Made by | `telCapture()` in `src/dropoff.js` when a run ends (restart, menu, session over, review saved) |
| Skipped | runs under 20 s recorded or 10 s armed, RaceGOW, more than 40 runs a day from one browser |
| Contents | `id`, `started`, `pilot` (random, per browser), `name` (the pilot name chosen on first start), `mode`, `camTilt`, `craft`, `tune`, `profile` (Pilot Warm-up), `input`, `score`, `events` (each call: `t`, `t0`, `name`, `exec`, `clean`, `obstacle`, `conf`, `fails`, `flagged`), `missed` (Q presses), `summary`, `trace` |
| Trace | `{ enc: 'cols-delta-varint/1+deflate', hz, cols, rows, data }` — `FlightLog.unpack()` in `src/flightlog.js` gives back the usual rows (positions to 0.1 mm, attitude to 1e-4, velocity to 1 cm/s); about 30–80 KB a minute |
| Never in it | GitHub token, e-mail, device ids, file names |

Related: `pro-whooper-flight-labels/1` (`flight` id + the review labels, sent when a review is saved with telemetry on),
`pro-whooper-telemetry-bundle/1` (`items: [{ kind, name, at, payload }]`, what Options saves as a file).

Where it goes, first one that works:

1. **Artifact database** (the game opened from its Claude link): `telemetry/<viewer id>/<kind>/<stamp>` is the index
   document (format, summary, events, labels, feedback text — everything but the trace), with the whole payload as text in
   `…/parts/p000…`. Rules: each viewer writes only their own folder, only the owner and Editors read. The platform lets
   only the owner and organisation Contributors write, so outside testers cannot use this route.
2. **Relay** (`tools/dropoff-worker.mjs`, setup and safeguards in `docs/DROPOFF-SETUP.md`): a Cloudflare Worker holding a
   repo token as a secret. Accepts only the three formats above from the game's own web address, at most 1 MB, checks
   their shape, names the file itself (`telemetry/inbox/<kind>/<day>/<time>-<random>.json`), rate-limits, and refuses
   anything that looks like a token. Its URL goes in `dropoff.txt`; `build.py` puts it in the game.
3. **GitHub with the player's token**: `telemetry/<kind>/<pilot>/<stamp>.json`.
4. **Nowhere**: kept in the browser (last 40), "Save waiting flights as a file" in Options.

Using it: `node tools/flights.js telemetry/ some-bundle.json` re-flies every flight through the current detector and
prints, per flight and per trick, the calls that are no longer made, new calls, unsure calls (Watcher < 70 %) and flagged
calls. Run it before and after a rule change, next to `npm run bench`. Telemetry has no pilot verdicts of its own, so it
shows what a change does to real flying, not whether the change is right; F/Q flags and review labels are the verdicts.
