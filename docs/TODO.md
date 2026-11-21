# To do (one ordered list; audited 2026-11-21)

How this file works: one list, in the order to do things. When an item is done, its story goes to CLAUDE.md (what was built) and the
line is dropped here. Decisions and the reasons behind them go in docs/DESIGN-LOG.md (the rolling design doc) on the day they are made.

## Now
1. **Train mode, presentation pass** (owner, 2026-11-21). Built 2026-11-21: the intro (the trick at full speed twice, then one slow
   pass), a coaching cue per step, arrows only on the moving stick, the sticks-big view, a scrubbable player. Still to do from the nine:
   an **Examples stage** (confirmed flights on other maps and objects), **"connect it"** as the last try (chain it into anything),
   **stick display in Mode 1 / 3 / 4**, and a **ladder** with a "learned" mark in the Tricktionary. The cues are drafts: owner to edit
   the wording (`COACH_CUES` in src/coach.js).
2. **Daily K.W.A.D.** (agreed 2026-11-20): four daily tricks per map, the same for everyone, from the date (the board's UTC day): K and W
   easy and anywhere, A and D on a named object. Letters on the HUD, a bonus for all four, shown on the main menu and the board. Only
   tricks the game calls reliably; obstacle letters on objects the bot already flies well on that map. Keep 250 a letter + 2000.
3. **More Warehouse** (owner, 2026-11-21): a moving conveyor belt (it has to carry the quad: a surface that moves what rests on it), and
   two levels more scatter and visual detail; then gapcheck / floatcheck / mapaudit / test/maps.js.
4. **Community learner re-run** (it did not finish on 2026-11-21, and the detector changed since): run it in the background, bring the
   owner what it wants to change.

## Next
5. **Train mode, older asks**: step-by-step for pole, wall and gap tricks (steps by hand); judging "upright" and "flying backward" in
   the steps; flow ideas never done (slow-mo instead of full stops, tries that adapt to the pilot, a ghost in the live tries, a sound
   per step, no reload into the Training Room). Show me now flies the Big Square for the loop tricks (2026-11-21): check it by eye.
6. **Disarm tricks** (flip, roll, loop): rotation counted while disarmed in the air, re-arm before landing or crashing; the loop accepts
   a partly ballistic path over the top. Own points (not in TPW). Check the sim's disarmed coasting and spin decay first; needs the
   owner's test flights.
7. **3D mode scoring**: decide with 3D pilots which tricks count and what they are worth, and whether 3D gets its own board.
8. **Trick challenges and the trick board** (owner, 2026-11-20): a pilot names a trick, flies it and posts it; others try it; a try
   passes when its motion matches closely enough (the library's signature match); 3 different pilots passing confirms it and the owner
   names its points. Needs a relay kind (`challenge`), a board screen, the guest replay viewer, a "this looks like <existing trick>"
   check before posting, and the owner's say before anything is scored.
9. **Proper gap names per map** for the gap call-outs (they use object names today).
10. **Known wrong calls still open** (from reviews): Cradle vs Juicy Flick on the swing set; Barani read as Split-S + Matty; Flip + Matty
    double call on a slow two-part Matty; Split-S into a wall dive called Dive; two Split-S read as Double Dutch (under, over, under);
    one-lap trippies; Double Flip that was a Half Matty; a 794 deg Double Roll over the tolerance.

## Later
11. **Training Room race modes** from the owner's brief (time attack, gate order randomizer, altitude restriction, precision penalty,
    endurance with no HUD): they need RaceGOW's timing in that room.
12. **Toothpick frame** for Metal Craft's build (71 mm wheelbase, open 45 mm props), and fitting the 1003 motor and 45 mm props from
    his Blackbox log when it arrives.
13. **Auto-tuning the detector's hand-set numbers** against `npm run bench`, with a before / after.
14. **Trick X-ray**: a debug card for any call or miss (path round the object, each rotation, which rule passed or failed).
15. **"Why not?" for near misses** on every trick (today only a few say SO CLOSE).
16. **Confusion heatmap** from the benchmark: which tricks get mistaken for which.
17. **Trick intent from stick shape** (snap, hold, release), to cut false calls after bumps and recoveries.
18. **Review Hub**: a "withdraw a sent verdict" note if wanted. The "incomplete" grade waits (owner chose "crash" first).

## Watching (nothing to build; look at the data)
- **Open-air Split-S** and the **late-bump grade** (both 2026-11-21): no real-flight review yet. Look mid-week at what the Review queue says.
- 12 new **Burrito Roll** calls where Jump Rope / Double Dutch used to be, and the extra slow-sweep Rolls / Flips / Powerloops: unreviewed.
- **Bump / crash line**: tune from `node tools/grades.js` once crash grades come in.
- **The learned witness**: off. Owner, 2026-11-21: hold another week or so. After 2026-11-28 bring a like-for-like comparison against
  the trick library on call windows; add tools/witness-data.js + witness.py to the weekly run.
- **Feel**: the real Air65 measured quicker and springier than the sim (its feedforward). Fit it once a test-card log is in.

## Waiting on the owner
- Confirm the Review queue fills for a second pilot after the last relay deploy (and that a verdict arrives as a vote).
- Fly the trainer: rolling starts, instant retry, and today's intro / cues / sticks-big view.
- Fly the Feel Lab test card on the Fractal 65 / 75 and send the logs.
- Decide whether to retire the old review screens (Flight desk, Judge the community) now that the Hub covers them.
- Set real points for Half Matty Pendulum (1050), Juicy Tornado (350) and Wall Stick (200): placeholders today.
- Edit the coaching cues' wording.
