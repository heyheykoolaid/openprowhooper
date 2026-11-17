# Calibration data

Uploaded by the game (Options → "Upload calibration data to GitHub", off by default) while flying **Trick Calibration**.
Nothing here contains the uploader's token or personal details.

```
calibration/round-<N>/<trick-slug>/<timestamp>-<run>.json   # a trick that reached 5 confirmed reps
calibration/round-<N>/sessions/<timestamp>-<run>.json       # a whole calibration run (incl. Pause & Ask answers)
```

## Formats

`pro-whooper-training/3` (per trick; `/2` = same without stick columns): `{ trick, round, agreed, craft, tune, camTilt, examples: [ { target, verdict, rep,
repStart, t, detected[], toks, cross, near, hz, cols, trace[[...]] } ] }` — each example's trace covers the rep from 2 s
before it started to 1 s after the pilot confirmed it.

`pro-whooper-session/2` (whole run; `/1` = same without stick columns): `{ craft, tune, camTilt, calib, run: { id, started, round, hz, cols, trace[[...]],
events[ {t, name, exec, clean, obstacle, near, draft} ], labels[ {t, repStart, target, verdict, rep, prompted, via,
detected[] } ] } }`

Trace columns (100 Hz): `t, x, y, z, qw, qx, qy, qz, rollRate, pitchRate, yawRate, thr, contact, armed, crashed,
cnx, cny, cnz, cObj, cImpact, cGround, vx, vy, vz, rollStick, pitchStick, yawStick` — world metres (Y up), body
orientation quaternion, pilot-axis rates in °/s (roll right +, pitch back +, yaw right +), contact normal/object/impact
speed, velocity, and the pilot's sticks (-1..1 as moved; `thr` 0..1). Traces from before v2 stop at `vz`.

Labels: `verdict: "yes"` = the pilot confirmed this rep was `target`; `"no"` = it wasn't. `via: "pause-ask"` marks
answers from Pause & Ask mode (`prompted` is what the detector claimed, or `(unrecognised)`).

Analyse with `node test/replay.js <file>` and `node test/calibrate.js <file> [trick]`.

`pro-whooper-judge/1` (calibration/judge/, from Judge the Bot): `{ camTilt, verdicts: [ { trick, seed, object, params,
verdict: "clean"|"sloppy"|"wrong", lookedLike, detected[ {name, exec, clean} ], detectorRight, agree } ] }`. Each verdict
is reproducible: `Maneuvers.make(trick, world, seed)` rebuilds the exact flight the pilot watched. "wrong" means the
scripted flight doesn't look like the trick (fix `src/maneuvers.js`); a pass the detector missed is a detector problem.

`pro-whooper-video/1` (calibration/video/, from Video Review): `{ file, duration, video: {w, h}, analysis: { hfov, camTilt,
rate, axisCleanup }, frames: [[t, roll, pitch, yaw], ...] (camera rotation in degrees per sample, measured in the
browser by src/vision.js), marks: [{ t, kind: "U"|"O", back, side }], detected: [{ name, exec, t0, t }],
labels: [{ verdict: "yes"|"no"|"added", det, actual, t0, t1 }] }`. The video itself is never stored or uploaded.
Replay: `Vision.detectClip(Sim, frames→{t, rpy}, marks, { camTilt, axisCleanup })`.

