# Trick recognition roadmap

Where recognition stands: the rules are tuned mostly against scripted bot flights and the pilot's descriptions. The
biggest gain now is real labelled flights, then letting the detector adapt to them. Ideas, in the agreed order.
Status: ✅ built · 🔨 in progress · ⬜ not started.

## Getting real data with almost no effort
1. ✅ **"That was wrong" keys while flying.** `F` flags the last call as wrong, `Q` flags "I just did a trick and got
   nothing". The flight is kept; the label can be fixed later in the review (or never: unlabelled flags still show
   where to look).
2. ✅ **Post-run review.** After a run (pause menu or the results screen) every call is listed with a replay of the
   moment, ✓ / ✗ / "it was actually…", plus the flagged misses. Saved as `pro-whooper-session/2` (`via: "review"`),
   which the benchmark already reads; uploaded to `calibration/review/` when uploads are on.
3. ✅ (first version) **Low-confidence prompts.** The review sorts flagged calls and calls where the Watcher's witnesses
   disagreed (confidence < 70%) to the top and marks them, so a quick review covers the calls worth asking about.

## Making the detector learn
4. ✅ (first version) **Per-pilot calibration.** A short warm-up (flip, roll, yaw spin, flip-then-roll) measures the
   pilot's rotation speeds and natural gap between segments. Saved as the pilot profile and applied to the detector:
   how slow a rotation can be and still be deliberate, how much air is allowed between segments, and the Watcher's
   timing witness. The Watcher's learned speeds now also survive respawns.
5. ⬜ **Auto-tuning thresholds.** Search the hand-set numbers (tumble 230°, whip 135°, holds…) for the values that
   maximise `npm run bench`, and show before/after. Needs a few hundred labelled reps (1–3 feed it).
6. ⬜ **A small learned second opinion.** A lightweight classifier trained on labelled reps, voting as another Watcher
   witness. After 5; needs a few hundred real reps per trick family.

## Understanding failures faster
7. ⬜ **Trick X-ray.** Optional debug card in the sim for any call or miss: path round the object, each rotation
   segment, which rule passed or failed ("needed 135° of turn, got 110°"). Not part of the DVR/Video Review mode.
8. ⬜ **"Why not?" for near misses** on every trick (today only a few say "SO CLOSE"); doubles as a teaching tool.
9. ⬜ **Confusion heatmap** page built from the benchmark: which tricks get mistaken for which.

## Better raw signals
10. ⬜ **Auto-tagging objects on any map** (bars, posts, walls, gaps from geometry instead of hand-placed tags).
11. ⬜ **Trick intent from stick shape** (snap, hold, release) to cut false calls after bumps and recoveries.
12. ⬜ **Matched real and sim reps** (Blackbox + DVR of a trick, then the same trick in the sim) to see where the sim's
    physics makes tricks look different.

## Community
13. ⬜ **Shared trick clips**: testers upload labelled clips; the best become each trick's reference (and Tricktionary demos).
14. ⬜ **Pilot voting on disputed calls**: a "was this a Matty?" queue to settle borderline definitions.

## Also built
- **Feedback button** on every screen (category + comment + optional context), saved in the browser and uploaded to `feedback/` when uploads are on.
