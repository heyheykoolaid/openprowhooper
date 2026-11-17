# Tricktionary demo GIFs: measured reference

Fourteen demo GIFs from prowhooper.com, supplied by the pilot (batch 1: Flip, Double Flip, Roll, Double Roll, Segmented
Flips/Rolls, Yaw Spin; batch 2: Invert Rewind, Vanny Roll, Rubik's Cube, Cubik's Rube, Juicy Flick, Snapback,
Inverted Yaw Spin, Inverted Yaw Tracking). The GIFs themselves are **not** in this repo (Tyrantt's / other pilots' footage). Only
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
