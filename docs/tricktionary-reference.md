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

## Batch 5: Mattys, Mavani, Donkey Loop

| Trick | What the clip shows | Verdict |
|---|---|---|
| Mavani (draft) | maverick nose-up → pitch down to inverted → inverted yaw 180 (~0.7 s) → Matty backward under the tree | matches draft |
| Donkey Loop (draft) | maverick nose-up → pitch down to inverted → inverted yaw 360 (~1 s) → pitch back to upright, forward under the tree | matches draft |
| Beginner Matty | over a chair, backward under it, almost no rotation | matches |
| Matty Flip | forward flip over the gap between two cars, then backward flight facing the house | matches |
| Matty Twister | pitch down ~45–90° **before** the 360 roll (~0.6 s), then the rest of the Matty, backward under a branch | rule extended |
| Half Matty | roll 180 (~0.25 s) → pitch (~0.6 s) → backward through the pilot's legs | matches |
| 540 Half Matty | roll 540 (~0.6 s, ~900°/s) → pitch → backward under the tree | matches |
| Matty 360 | indoor, white ceiling: too blurred to measure; visible sequence fits the rule | — |

**Changes made from batch 5:** Matty Twister also accepts a lead-in pitch before the roll (`P-~90 Ra360 P-~270`), and a
demo-shaped flight was added to `test/demos.js`.

## Batch 6: Forani, Split-S family, pole dancing

GIF ↔ trick mapping confirmed from each trick page on prowhooper.com.

| Trick | What the clip shows | Verdict |
|---|---|---|
| Forani (screen recording of a YouTube clip) | pitch forward to inverted → inverted yaw → second half of a Matty, ending nose-up flying backward (camera pointing at the canopy; the late "roll" is yaw seen through an up-pointing camera) | matches |
| Split-S | roll 180 (slow, ~0.8 s) → dive → under the tree | matches; demo-timed case added |
| 540 Split S | ~3–4× slow-motion GIF (OSD clock); real roll ≈ 540° in ~0.7 s → dive → under a branch | matches; demo-timed case added |
| Splitback | roll 180 over the gazebo → ~540° of pitch (backflip + Split-S half loop) → out under the gazebo | matches (`Ra180 P+~540`) |
| Split Yaw | roll 180 over the gazebo → look down → yaw 180 while dropping → backward under the gazebo | matches |
| Split Stall Matty Rewind (draft) | roll 180 → small pitch back to look down at the yard → stall → Matty rewind backward under the gazebo | matches the draft's `Ra180 P+~90 P-~270` |
| Orbits | ≈ 2.3 orbits round a tree trunk at ~150°/s (≈ 2.4 s per lap), then exits | consistent with the orbit tracker |
| Cradle | two cradles past the pilot in the garage: pitch back to keep him in view, level out, backward away | matches (P+ then P-, flying backward, in view) |
| Side-Lock Rewind | roll ~90° toward the pilot + pitch back → stall → rewind → roll away | matches |
| Whiplash | pass under/next to the tree → pitch back → roll toward it keeping it in view → pitch forward to level | matches |

No detector changes from batch 6.

## Batch 7: pole dancing, jump roping, rewinds, wall tricks (20 clips)

Mapping checked on the trick pages (Wall Tap's GIF carries a "Blind Flip" caption; Stall Matty Rewind's is captioned
"Custom Trick #1"; both are the files those pages use).

| Trick | What the clip shows | Verdict |
|---|---|---|
| Pole Dance | caption: "Cradle + half roll to half Matty + rewind"; roll, pitch back, long roll, pitch forward, keeping the tree in view | consistent with two whiplashes on one pole |
| Trippy Spin | inverted orbit of a tree, crown at the top of the screen | consistent |
| Trippy Switch | looking up a trunk: ~1 lap → switch → ~1.75 laps → switch → ~1.2 laps (≈ 1.9 s/lap) — **two** direction changes | handled (banks on each reversal) |
| Double Rolling Trippy | ~1540° of combined yaw/roll looking up the trunk over ~5.5 s | consistent |
| Jump Rope | indoor striped pole: small yaw/roll, over, back | consistent |
| Cinnamon Roll | ~310–360° slow yaw (~1.35 s) through the jump | consistent |
| Burrito Roll | gentle jump rope (nothing above 95°/s), then one big roll (≥250°) before crossing, back down, under | **rule changed** |
| Side Loop | play structure: yaw 90 under, inverted over, back under | consistent |
| Double Dutch | cube: roll ≥190° (more blurred) at the peak | consistent |
| Stall Flip Rewind | Tyrantt, indoor staircase: climb, flip at the stall, rewind | consistent |
| Stall 360 Rewind | next to the pilot: through the legs, climb, 360 roll at the stall, rewind | **rule changed** (height) |
| Stall Matty Rewind | climb past a tree, segmented front flip, Matty backward | consistent |
| Stall Half Matty Rewind | next to the pilot: yaw 180 past him, roll ~170, pitch, backward past his legs | consistent |
| Building Dive | big building: pitch down, ~450° spinning yaw on the way down | consistent |
| Wall Ride / Wall Tap / Roll Tap / Loop Tap / Ceiling Tap / Reverse Wall Ride | garage, fence and hallway clips | sequences consistent |

**Changes made from batch 7:**
- Burrito Roll: no longer needs a separate ≥60° roll toward the object first. A big roll (≥150°) with no pass *over*
  the object near/after it, ending under it, is a Burrito; a roll at the peak over the object is a Double Dutch.
- Jump Rope waits up to 2 s (while still near the object) before locking in, so a Burrito that starts with one isn't
  scored twice. Open-air rotation at a jump-rope peak (sideways pass over) waits for the way back down (Double Dutch).
- Flip / 360 Stall Rewind: the object only needs to be ~1.5 m tall (demos use the pilot and a staircase; only the plain
  Stall Rewind asks for 10 ft). To keep loops and jump ropes from being read as stall rewinds, a stall rewind must not
  pass over/under an obstacle.
- New flights in `test/phase2.js`: Burrito Roll, Double Dutch, 360 Stall Rewind beside the pilot.

