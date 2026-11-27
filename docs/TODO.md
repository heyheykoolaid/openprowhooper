# To do (one ordered list; audited 2026-11-21, brought up to date 2026-11-27)

How this file works: one list, in the order to do things. When an item is done, its story goes to CLAUDE.md (what was built) and the
line is dropped here. Decisions and the reasons behind them go in docs/DESIGN-LOG.md (the rolling design doc) on the day they are made.

## Now
1. ~~**Train mode, presentation pass**~~ (owner, 2026-11-21). All nine built 2026-11-21: the intro (full speed twice, one slow pass,
   then **examples**), a cue per step, arrows only on the moving stick, the sticks-big view, a scrubbable player, **"connect it"** as
   try 5, the **stick view in Mode 1-4**, and the **ladder** (walked / landed / learned) in the Tricktionary. Left: the owner's edit of
   the cue wording (`COACH_CUES` in src/coach.js), and Train is still shown to three pilots only.
2. ~~**Daily K.W.A.D.**~~ built 2026-11-21 (test/kwad.js). Open: a K.W.A.D. mark on the board (needs the posted run to carry its
   letters and a relay change); the owner's look at the pools.
3. ~~More Warehouse: moving conveyor and the detail pass~~ done 2026-11-21 (gapcheck 25/25, floatcheck 0). Open: parcels riding the belt.
4. **Community learner re-run**: done 2026-11-23 (PR community-2026-11-22: 7 confidence floors, the Rubik's Cube fix). Next from its
   to-do list: Rubik's Cubes whose roll is split between roll and yaw (an attitude witness), missed open Rolls and Trippy Spins, Split-S
   still missed in open air, Mavvy Roll read as Mavvelmann (3, RodFPV), Flip vs Powerloop on bars. Treat the custom name "Rubiks Cube"
   as Rubik's Cube.

## Next
4b. **RaceGOW from the real layouts** (owner, 2026-11-25): the importer and routes-as-steps are built (all 25 layouts ship;
   test/racegow.js). Next, in order: the Route Picker's click-the-opening tools (Pipes / Lap / Squares) inside the track editor; the
   flight lines of the older layouts as a guide line and first ghost; design norms from the 25 for "Make raceable" and a random-track
   maker. The owner's eye on the 21 laps he has not clicked through.
4c. **prowhooper.com links** (owner, 2026-11-25, Tyrantt's blessing): home-screen link and a link from every trick to its own page
   on the site are in. Next: a linkable page of the game's tricks for Tyrantt's tags (`#tricks`, `#trick=<name>`).
5. **Train mode, older asks**: step-by-step for pole, wall and gap tricks (steps by hand); judging "upright" and "flying backward" in
   the steps; flow ideas never done (slow-mo instead of full stops, tries that adapt to the pilot, a ghost in the live tries, a sound
   per step, no reload into the Training Room). Show me now flies the Big Square for the loop tricks (2026-11-21): check it by eye.
6. ~~Disarm tricks~~ built 2026-11-21 (Disarm Flip / Roll / Spin, Dead Pirate Spin, Disarm Loop; test/disarm.js). Still to do: the bot
   flying them (Judge the Bot, Show me), Train steps, doubles.
7. **3D mode scoring**: decide with 3D pilots which tricks count and what they are worth, and whether 3D gets its own board.
8. ~~**Trick challenges and the trick board**~~ built 2026-11-23 (owner: 2 other pilots confirm, live at 200 points, a word list + the
   owner hides / renames / prices). **Redeploy the relay** for it to work. Confirmed ones go into the trick library (2026-11-23; 2 stays the number). Open: re-checking tries on
   the relay or in the weekly run; the knowledge bot flying them (it needs their motion and a family it knows).
   **Trippy Spin** (2026-11-23): the stick witness ("wonky nips"), the locked-in grade and the five-stage Train ladder are built.
   Decided 2026-11-23: one lap counts (it did), the corner climb is its own trick (**Corner Climb**, draft). Open, the owner's calls:
   Corner Climb's real name and points, the cue wording. Corner Climb needs a real flight and labels to set its numbers. To build: Show me
   for the trippy (a bot script or a library replay on the Big Pole), the stall / Matty / perch-drop entries as stages.
   **Tricktionary audit** (2026-11-23): rules, names, points and the three tricks brought in line with prowhooper.com; Rollback and
   Juicy Rollback from RodFPV's labels. Open: Segmented's stall (0.18 s from the demo vs the text's 0.5 s); points for Cube Eject,
   Rollback, Juicy Rollback, Corner Climb; the 16 demo clips not on file; per-object point tiers (gate, cube, indoors).
9. ~~Proper gap names per map~~ done 2026-11-27 (`GAP_NAMES`).
10. **Known wrong calls still open** (from reviews; Power Roll read as Immelmann + Split S / Rubik's Cube fixed 2026-11-27; next: open-air
    Flips read as Powerloop (loop size / climb study), Stall Flip Rewind where pilots said Flip (5 labels)): Cradle vs Juicy Flick on the swing set; Barani read as Split-S + Matty; Flip + Matty
    double call on a slow two-part Matty; Split-S into a wall dive called Dive; two Split-S read as Double Dutch (under, over, under);
    Double Flip that was a Half Matty; a 794 deg Double Roll over the tolerance.

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
- **Official scoring rules** (2026-11-25): the streak by base value to x2, bumps between tricks ending it. Watch the board and pilots'
  comments; scores from before 2026-11-25 were made under the old rules.
- **Double Rolling Trippy Spin** (2026-11-25): the 1.8x roll-per-lap rule is from one pilot's flights. Watch other pilots' DRT calls.
- **Rollback / Juicy Rollback** (2026-11-23): written from RodFPV's labels; 10 unlabelled calls on other pilots' flights to look at.
- **Open-air Split-S** and the **late-bump grade** (both 2026-11-21): no real-flight review yet. Look mid-week at what the Review queue says.
- 12 new **Burrito Roll** calls where Jump Rope / Double Dutch used to be, and the extra slow-sweep Rolls / Flips / Powerloops: unreviewed.
- **Bump / crash line**: tune from `node tools/grades.js` once crash grades come in.
- **The learned witness**: off. Owner, 2026-11-21: hold another week or so. After 2026-11-28 bring a like-for-like comparison against
  the trick library on call windows; add tools/witness-data.js + witness.py to the weekly run.
- **Feel**: the real Air65 measured quicker and springier than the sim (its feedforward). Fit it once a test-card log is in.

## Waiting on the owner
- RaceGOW from WebFPV (2026-11-27): best 3 consecutive laps, a racing line, RaceGOW's build rules as checks, close-call scoring: which?
  And: 24 in sections (the minimum gate) or the rules' 27 in pipe?
- Prop load (2026-11-27): fly "Logged Air65 load" (Advanced physics → Feel). Default or not? It matches the logs' rpm, hover and current, but
  thrust to weight drops from ~5 to ~3. Momentum-theory inflow is on by default ("Straight line (old)" brings back the old thrust).
- Scoring: should back-to-back tricks build the streak (they do now)? (The wait is 2 s: answered 2026-11-27.)
- INVERTED: 200 + 50 a second up to 1000 (built 2026-11-27): right numbers? Should the streak apply to it?
- Tyrantt's tags: build a linkable page of the game's tricks (`#tricks`, `#trick=<name>`)? (4c above)
- Burrito Roll: the under-roll-under move has no name and scores as a Roll (decided 2026-11-23); say if that changes.
- Disarm tricks: fly them and say whether the spin carries right (Advanced physics → Disarmed spin drag, 10 %); set the points
  (placeholders 200 / 200 / 200 / 350 / 400) and how much of the turn must be with the motors off.
- More Warehouse: look over the detail pass (the box truck and trailer stay over/unders: "yup", 2026-11-27).
- Clappy clean-up (2026-11-27): lamps off the corners, sidewalk sakura moved, the clipping fixed. Fly it; say if other maps should get the
  same pass (tools/clipcheck.js lists flicker on Slackvegan 36, Ship 25, Warehouse 7, School 4, Murderdome 3, Playground 3).
- Clappy Park's new look (2026-11-27): the shade, the haze, the eight shop names (Clappy Cafe, Ramen, Boba Tea, Books, Flowers,
  Arcade, Whoop Shop, Laundry), the fountain, the bus stop, the parked cars. Shop names and the cloud count are easy to change.
- Confirm the Review queue fills for a second pilot after the last relay deploy (and that a verdict arrives as a vote).
- Fly the trainer: rolling starts, instant retry, and today's intro / cues / sticks-big view.
- Fly the Feel Lab test card on the Fractal 65 / 75 and send the logs.
- Decide whether to retire the old review screens (Flight desk, Judge the community) now that the Hub covers them.
- Set real points for Half Matty Pendulum (1050), Juicy Tornado (350) and Wall Stick (200): placeholders today.
- Daily K.W.A.D.: are the four pools right (K basics, W a step up, A the three classics, D harder), and should Free Fly count letters?
- Edit the coaching cues' wording.
- Train's new parts: is three examples the right number, should "connect it" need the two tricks in one combo by a tighter gap than
  3 s, and should the ladder's order follow the book's difficulty or an order of your own?
