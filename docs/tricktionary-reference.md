# Tricktionary demo GIFs: measured reference

Six demo GIFs from prowhooper.com, supplied by the pilot (Flip, Double Flip, Roll, Double Roll, Segmented
Flips/Rolls, Yaw Spin). The GIFs themselves are **not** in this repo (Tyrantt's / other pilots' footage). Only
measurements derived from them are recorded here. Tool: `tools/gif_rotation.py` (SIFT matches → rotation-only fit,
equidistant fisheye, hfov 140° assumed).

**Timing:** the GIFs play at 80 ms/frame but are slowed down. The goggle OSD clock in the Roll and Segmented clips
advances every ~23–26 frames, so real time is ≈ 38–43 ms/frame (≈ 2× slow-motion). All numbers below are real time.

| Trick | What the clip shows | Real duration | Rate |
|---|---|---|---|
| Flip | 360° pitch, continuous, indoors | ~0.4 s | ~900°/s |
| Double Flip | 720° pitch, continuous, no pause between | ~0.85 s | ~850°/s |
| Roll | 360° roll toward the pilot | ~0.36 s | ~1000°/s avg, ~1050 peak |
| Double Roll | 720° roll while cruising | ~0.95 s | ~750°/s |
| Segmented | 180° roll · **~0.27 s** pause · 180° roll, later 180° flip · **~0.23 s** pause · 180° flip | each half ~0.2 s | ~900°/s per half |
| Yaw Spin | 360° yaw while passing through an LED cube | ~1.0 s | ~360°/s avg, ~700 peak |

**Changes made from this:**
- Segmented Flips/Rolls: the written rule says a 0.5 s stall; the demo pauses only 0.23–0.27 s. The detector now
  accepts a pause of ≥ 0.18 s (`SEG_GAP` in `src/sim.js`) between two ~180° halves in the same direction. Shorter
  hesitations still read as a Flip/Roll with a "stalled mid-rotation" deduction. Regression cases in `test/t3.js`.
- All other demo timings were already recognised; they're now regression cases too (`demo flip`, `demo roll`, …).

**Camera uptilt (side result):** during a roll, a tilted camera also shows some yaw. The yaw:roll ratio gives about
13° uptilt in the indoor clips and about 35° in the outdoor ones. The sim's default is 20°.

**Not measurable from these clips:** flips blur out completely at this frame rate (feature matching fails), so flip
timing comes from frame counting. GIFs give no obstacle positions or stick inputs.
