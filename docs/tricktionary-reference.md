# Tricktionary demo GIFs: measured reference

Twenty-one demo GIFs from prowhooper.com, supplied by the pilot (batch 1: Flip, Double Flip, Roll, Double Roll, Segmented
Flips/Rolls, Yaw Spin; batch 2: Invert Rewind, Vanny Roll, Rubik's Cube, Cubik's Rube, Juicy Flick, Snapback,
Inverted Yaw Spin, Inverted Yaw Tracking; batch 3: Immelmann, Power Split, Power Flip, Reversed Power Flip, Power Swap,
Power Switch, Power Roll. The Powerloop file received was a single still frame, the site's resized `-768x576` copy). The GIFs themselves are **not** in this repo (Tyrantt's / other pilots' footage). Only
measurements derived from them are recorded here. Tool: `tools/gif_rotation.py` (SIFT matches → rotation-only fit,
equidistant fisheye, hfov 140° assumed).

**Timing:** the GIFs are slowed down. From the goggle OSD clock: clips stored at 80 ms/frame run ≈ 23–26 real
frames/s (≈ 40 ms/frame, ~2× slow-mo); clips stored at 60–70 ms/frame run ≈ 30 real frames/s (≈ 33 ms/frame).
All numbers below are real time.

| Trick | What the clip shows | Real duration | Rate |
|---|---|---|---|
| Flip | 360° pitch, continuous, indoors | ~0.4 s | ~900°/s |
| Double Flip | 720° pitch, continuous, no pause between | ~0.85 s | ~850°/s |
| Roll | 360° roll toward the pilot | ~0.36 s | ~1000°/s avg, ~1050 peak |
| Double Roll | 720° roll while cruising | ~0.8 s | ~900°/s |
| Segmented | 180° roll · **~0.27 s** pause · 180° roll, later 180° flip · **~0.23 s** pause · 180° flip | each half ~0.2 s | ~900°/s per half |
| Yaw Spin | 360° yaw while passing through an LED cube | ~1.0 s | ~360°/s avg, ~700 peak |

**Batch 2:**

| Trick | What the clip shows | Real timing |
|---|---|---|
| Invert Rewind | 4 reps: roll 180 → roll back 180 (×2), pitch 180 → pitch back 180 (×2); no hold when inverted | ~0.3 s per half (~600°/s) |
| Vanny Roll | yaw 180 → roll 360 → yaw 180 same direction, one continuous motion | yaw ~0.56 s (~320°/s), roll ~0.5 s (~720°/s), yaw ~0.64 s (~280°/s) |
| Rubik's Cube | **flip 180 → roll 360 → flip 180** (site page and GIF 1000036117) | ~0.3 s / 0.53 s / 0.4 s |
| Cubik's Rube | **roll 180 → flip 360 → roll 180** (site page and GIF 1000036115) | ~0.26 s / 0.7 s / 0.42 s |
| Juicy Flick | pitch forward 180 → roll 180 | ~0.27 s / ~0.34 s |
| Snapback | pitch back 180 under a tree → roll 180, finishing upright looking back at it | ~0.3 s / ~0.37 s |
| Inverted Yaw Spin | roll 180 → inverted yaw 360 → roll 180 same direction | ~0.26 s / 0.56 s (~640°/s) / 0.3 s |
| Inverted Yaw Tracking | roll 180 toward a tree → inverted yaw keeping it centred → roll out (blurred) | ~0.25 s / ~0.6 s / — |

**Changes made from this:**
- Rubik's Cube / Cubik's Rube: the spreadsheet has the two definitions swapped relative to prowhooper.com; the
  site's text and demo GIFs agree with each other, so the detector now follows the site. Both are 325 pts, so only
  the name changes.
- Vanny Roll: the demo's yaw halves are slow (~280–320°/s). The detector used to lock in the Roll before the second
  yaw reached 45°, so the demo read as a plain Roll. A rotation that could extend a trick now holds it from 20°.
- Segmented Flips/Rolls: the written rule says a 0.5 s stall; the demo pauses only 0.23–0.27 s. The detector now
  accepts a pause of ≥ 0.18 s (`SEG_GAP` in `src/sim.js`) between two ~180° halves in the same direction. Shorter
  hesitations still read as a Flip/Roll with a "stalled mid-rotation" deduction. Regression cases in `test/t3.js`.
- All other demo timings were already recognised; they're now regression cases too (`demo flip`, `demo roll`, …).

**Camera uptilt (side result):** during a roll, a tilted camera also shows some yaw. The yaw:roll ratio gives about
13° uptilt in the indoor clips and about 35° in the outdoor ones. The sim's default is 20°.

**Not measurable from these clips:** flips blur out completely at this frame rate (feature matching fails), so flip
timing comes from frame counting. GIFs give no obstacle positions or stick inputs.

## Batch 3: powerloop family

| Trick | What the clip shows | Real timing |
|---|---|---|
| Immelmann | through the pilot's legs → pitch back to inverted → roll 180 → fly away level | half loop ~0.6 s, roll ~0.4 s |
| Power Roll | under a tree → half loop → roll 360 at the peak → rest of the loop → back under | ~0.72 s / ~0.65 s / ~0.5 s |
| Power Flip | under a tree → big floaty loop (~1.4 s of plain sky over the top) with a fast backflip at the peak → back under | ≈ 4 s total |
| Reversed Power Flip | indoors over a cube: loop up, **front** flip at the top, down and through | |
| Power Swap | through the legs → pitch back → roll 180 looking at the sky → pitch the other way → backward under the legs | ~0.65 s / ~0.2 s / ~0.5 s |
| Power Switch | under a tree → loop **all the way round to level** on the start side (no pass back under) → **hover ≈ 0.7 s** → Matty back over and backward under | |
| Power Split | loop **all the way round to level** → **hover ≈ 1.3 s** → roll 180 → Split-S half-loop back over and under | |

**Changes made from batch 3:**
- Floaty loops: the demos slow far below the 95°/s token threshold over the top, so only ~283° of a 360° loop was
  counted and loops graded SLOPPY. When a loop is merged across a float over the obstacle, the rotation swept during
  the float is now added from the attitude history, and the float no longer counts as a mid-rotation stall.
- Power Switch (draft): crossings are under → over → over → under (was under → over → under), first part may be a full
  ~360° loop, and a level-out hover of up to 1.6 s is part of the trick (no pause deduction).
- Power Split (draft): first part may be a full ~360° loop; hover up to 2.0 s allowed (it also has to climb back over).
- `test/demos.js`: seven flights shaped and timed like these demos, run by `npm test`.
- Still drafts: Power Switch, Power Split and Power Swap match the demos' rotation order, but the obstacle geometry in
  the tests is an interpretation of the GIFs. Confirm with real calibration reps before promoting.

## Batch 4: loops & mavericks

| Trick | What the clip shows | Notes |
|---|---|---|
| Powerloop (full-size GIF, statue in a fountain) | two loops round a tall statue: pull-up, ~1 s float up, over the top, a long nose-down hang looking straight down at the statue, level out through the ring | the hang pitches at roughly 1–4°/frame, well under 95°/s |
| Inverted 360 Powerloop | half loop → inverted yaw 360 (~0.7 s) → rest of the loop → back under | |
| Barani | half loop → inverted yaw 180 (~0.5 s) → Matty (pitch the other way) backward under the tree | |
| Maverick Loop | under the tree, nose up, upright over the top, nose down, back under | |
| Mavvy Roll | maverick with a slow 360 roll (~1.1 s) nose-down over the tree; back under ~1.6 s after the roll | |
| Half Mavvy (draft) | indoor gate tower: maverick pull-up → roll 180 → pitch → back through the gate | consistent with the draft |
| Mavik's Loop (draft) | indoor, heavily blurred | consistent with the draft as far as visible |
| Loop to Matty | cube trick (not in the spreadsheet): through a cube, half powerloop, Matty back through the top and the back of the cube | needs a cube obstacle; on the roadmap |

**Changes made from batch 4:**
- Slow pitch inside loops: near an obstacle (crossing in the last 4 s), a pitch rotation stays one token through stretches
  as slow as 30°/s for up to 2.5 s, and a slow tail through an obstacle pass still counts (`SLOW_TH`, `SLOW_MAX`).
- The float-over merge no longer joins a loop's two halves across a big yaw/roll at the peak (claimed or not). This
  had turned an Inverted 360 Powerloop into "Yaw Spin + Powerloop".
- Open-air rotation done at the top of a loop (under, then over the same object) waits up to 3 s for the pass back
  under, so a slow Mavvy Roll isn't locked in as a plain Roll.
- Maverick family: the Mavvy Roll's roll is excluded from the stay-upright check, and the over-pass speed check is
  relaxed for it (it nearly stops over the top to roll).

