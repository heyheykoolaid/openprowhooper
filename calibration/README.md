# Calibration data

Uploaded by the game (Options → "Upload calibration data to GitHub", off by default) while flying **Trick Calibration**.
Nothing here contains the uploader's token or personal details.

```
calibration/round-<N>/<trick-slug>/<timestamp>-<run>.json   # a trick that reached 5 confirmed reps
calibration/round-<N>/sessions/<timestamp>-<run>.json       # a whole calibration run (incl. Pause & Ask answers)
```

## Formats

`pro-whooper-training/2` (per trick): `{ trick, round, agreed, craft, tune, camTilt, examples: [ { target, verdict, rep,
repStart, t, detected[], toks, cross, near, hz, cols, trace[[...]] } ] }` — each example's trace covers the rep from 2 s
before it started to 1 s after the pilot confirmed it.

`pro-whooper-session/1` (whole run): `{ craft, tune, camTilt, calib, run: { id, started, round, hz, cols, trace[[...]],
events[ {t, name, exec, clean, obstacle, near, draft} ], labels[ {t, repStart, target, verdict, rep, prompted, via,
detected[] } ] } }`

Trace columns (100 Hz): `t, x, y, z, qw, qx, qy, qz, rollRate, pitchRate, yawRate, thr, contact, armed, crashed,
cnx, cny, cnz, cObj, cImpact, cGround, vx, vy, vz` — world metres (Y up), body orientation quaternion, pilot-axis rates
in °/s (roll right +, pitch back +, yaw right +), contact normal/object/impact speed, velocity.

Labels: `verdict: "yes"` = the pilot confirmed this rep was `target`; `"no"` = it wasn't. `via: "pause-ask"` marks
answers from Pause & Ask mode (`prompted` is what the detector claimed, or `(unrecognised)`).

Analyse with `node test/replay.js <file>` and `node test/calibrate.js <file> [trick]`.
