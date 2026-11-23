# Design log (rolling)

A running record of what the owner and Claude decide and why, newest first. One entry per discussion: what was asked, what was
decided, what was left open. docs/TODO.md is the ordered list of what to do; CLAUDE.md says how things are built; this file keeps
the reasoning so it is not lost between sessions. **Add an entry whenever a design question is discussed, even when nothing is built.**

## 2026-11-21

### Audit of everything outstanding
The owner asked for an audit so nothing discussed is lost. 27 open items were found across docs/TODO.md, CLAUDE.md, the project's
roadmap doc and the conversation; the one that had dropped out of sight was daily K.W.A.D. They are now one ordered list in
docs/TODO.md (Now / Next / Later / Watching / Waiting on the owner). Decision: keep this design log from now on.

### Train mode: the presentation pass
Source: a no-talking Barani tutorial the owner likes (the trick first at full speed; the radio filling the screen with the flight
small between the gimbals; one short caption per step, a little early; arrows only on the stick that moves; slow motion; then
examples; the last step is "connect it to any trick"), and how other sims teach (FS One / SeligSIM: the aircraft, a moving
transmitter display, narration, slow motion, pause; RealFlight: lessons with rewards). The owner: take the presentation and the
flow, never how a 5 inch flies.
Nine items were listed; the owner asked to start with the three small ones and then the two bigger ones. Built the same day:
- **Intro** before the first try of a trick: the trick twice at full speed with nothing on screen, then once at x0.4 with the sticks
  big and the cues, then "your turn". Only the trick itself is played (from 1.2 s before the first step to 1.4 s after the last).
  Skippable; "Intro" in the panel plays it again, Shift-click turns it off for new tricks. Once per trick while the page is open.
- **Cues**: one short imperative per step. Hand-written for 15 common tricks, made from the rule (and the bot's throttle) for the
  rest. Shown as a caption while that step is the one to fly, as the headline of the pause card, and in the player half a second
  before the step. Wording is a draft for the owner to edit.
- **Arrows**: in Show me an arrow is drawn only for a stick pushed a quarter or more, and the throttle gauge only while the throttle
  is moving.
- **Sticks big / FPV small**: a view of the player (B). The game's own picture is only resized by CSS, nothing is drawn over it.
- **Scrubbable player**: a bar with a mark per step (click or drag), back / on half a second, pause, x0.25 / x0.5 / x1; a click on a
  step jumps to it.
- Show me (and so the intro) now flies the **Big Square** for the loop tricks, where the pilot will fly them.
Left open: the Examples stage, "connect it" as the last try, stick modes 1 / 3 / 4, the ladder. Whether the intro should play before
every trick by default (it does) or only on request is the owner's call after flying it.

### The Review queue for every pilot
The owner: "can we consider moving the review queue for everyone to access? it makes sense." Built with a public, read-only relay
route. First build served only flights whose pilot had opted in (Claude's addition, because pilots had agreed to share "with the
project"); a second pilot then saw an empty queue. The owner: "drop it. the review queue only shows brief moments in flights
anyways." Decision: every shared flight of the last 7 days is reviewable; a pilot can opt out with a checkbox in Options; the
first-start prompt says so. Other pilots' verdicts count as ordinary votes, pooled three deep.

### Open-air Split-S
Five confirmed Split-S labels had no object under them. By the book a Split-S needs one. The owner: it counts. Built as an open-air
reading (half roll, nose-up pull, out forward the other way at least 1 m lower), like open loops and Mattys.

### The learned classifier
Retrained on the game's own call windows; a clean roll now scores 40-47 % (14 % before), the benchmark does not move with it voting.
The owner: hold off another week or so. It stays off; revisit after 2026-11-28 with a like-for-like comparison against the library.

### Bump grades and the crash grade
Pilots graded "bump" where the game said clean. Cause: knocks just after the move or just after the call. Decision: a hard knock on
the way out, up to 0.6 s after the call, makes it a bump. Earlier the same day the owner chose "crash" over "incomplete" as the
fourth grade ("pretty crashy bumps, where you shouldn't get any points"); "incomplete" waits.

### Training Room data, big objects
The owner: nothing from training flights is kept ("that mode still needs a lot of work"); loops and trippy spins are taught on large
objects (a 10 m square, a 12 m pole).

### Show me: calmer sticks, step buttons (2026-11-21)
Owner, after trying the presentation pass: "it looks good, but the sticks look a bit shaky on screen, can we filter that a bit? and
there be next and back buttons arrows for each step?"
- **Why they shook**: the bot's sticks are worked back from its flight sample by sample (its PID chasing a scripted path), so they
  carry jitter no thumb makes. **Decided**: smooth only what is drawn (radio, arrows, small stick view) with a bell-weighted average,
  0.07 s (`DEMO_SMOOTH`); the step text ("the bot used…") and everything the judge reads keep the raw sticks. A real snap still
  reads as a snap. Open: the amount is a guess from screenshots; the owner says more or less after watching it.
- **Step buttons**: ◂ Step / Step ▸ next to the half-second arrows (Shift+← / Shift+→ or , / .). They land where that step's cue
  comes up (half a second before it, or just after the step before has finished when two overlap); Back first returns to the start
  of the step playing, then to the one before. Steps the bot's flight did not show (no time) are skipped.

### Train: the start that would not go, cues in the slow pass, clean examples, wording (2026-11-21)
The owner's first go with the presentation pass:
- "once i hit this point, it would not proceed": the rolling start with the throttle chip ticked. Cause: his radio's arm switch was
  off; the room arms the quad at the start (his rule: "always start in the air armed") but the switch disarmed it again a frame
  later, and the release waited for an armed quad. **Decided**: in the Training Room an arm switch that is off is ignored; only
  flicking it off disarms. Not tested with a real radio here.
- "this text should also show on the first phase, where it demos the trick in slow motion": the cue only came up half a second
  before its step, so a quick trick's slow pass ran mostly bare. Now the slow pass always has a cue up, from its first moment.
- "can we have no trick examples in the tricktionary collide with an object or obstacle in the training room?": shown flights are
  drawn along a path and nothing stopped them passing through things. Now a flight is only shown if it stays 9 cm clear of every
  collider and the floor; otherwise the next candidate (another library example, another seed of the script) is used.
- "don't tell people to let the stick go": cues now say "stop it as the horizon comes level" / "stop it there". Open: the owner may
  want different words for the stop; the 15 hand-written cues are still drafts.

### More Warehouse: the detail pass and the moving conveyor (2026-11-21)
The owner: "lets do the more warehouse pass, don't forget all the checks for gaps and over/unders."
- **The belt has to carry the quad**, so it is physics, not a picture: a surface may have a velocity and contact is worked out against
  it. 1.2 m/s east. Left open: parcels riding the belt (they would need to move and collide; not built).
- **Detail is trim, trick objects are named**: scatter never becomes an over/under by accident (it is marked so the Surveyor skips
  it); what is meant to be flown round was added on purpose and tested with the bot: two hanging signs, a cable tray, the yard gate.
- **The checks found old faults**, fixed in the same pass: the Office Window was painted on a solid wall, four rack bays had crates in
  them, the lights hung from nothing. Gaps 4/22 clear before, 25/25 after; floating groups 19 before, 0 after.
- Left as it is: the box truck and the trailer count as over/unders, but the bot's own loop clips them (a real loop there is bigger);
  the four floor-standing containers have no "under". Say if the vehicles should count only as gaps.

### Disarm tricks (2026-11-21)
The owner: "let's also build out disarm tricks, i forgot another disarm trick, the disarm spin. same thing as a loop with the dead
motion, it's just a flatspin while upright. there's an upside down version, call it, 'dead pirate spin'".
- **Five tricks**: Disarm Flip, Disarm Roll, Disarm Spin (flat, upright), Dead Pirate Spin (flat, upside-down), Disarm Loop (a loop
  whose top is flown with the motors off). All need a re-arm in the air and 0.6 s flown clear; a landing with the motors off is nothing.
- **One call per move**: a rotation carried dead is the disarm trick's, never also a Flip / Roll / Yaw Spin / Powerloop.
- **The sim could not do them**: with the motors off a flip stopped in a quarter turn, because the rotational drag had been set for
  powered flight. Decided: a disarmed quad in the air feels a tenth of it (a slider in Advanced physics). A guess, not a measurement.
- **Open, the owner's to set**: the points (placeholders 200 / 200 / 200 / 350 / 400), how much rotation has to be dead (300 of 360
  for flip, roll and spin; 120 for the loop's top), whether doubles count for more, and the spin drag after trying real ones.
- Found on the way: a hover with the motors cut for a moment was being called a Perch. Fixed.

### Invert Rewind: the example and the definition (2026-11-21)
The owner: "the example for the inverted rewind has a roll in it at the end. it should not. inverted rewind is just a 180 pitch to
inverted, a wait (if that), then a pitch back to upright."
- **Decided**: Train's steps, cues and the shown flight are pitch: half a flip in, an optional short wait, the flip back. A real
  pilot's flight is only used as the example when it holds the trick and nothing else.
- **Open**: the TPW book says "a 180 roll or flip", and the game still calls an Invert Rewind for the roll version. Should the roll
  version stop counting? Not changed without the owner's say (scoring follows the book).

### Train hidden from most pilots (2026-11-21)
The owner: "hide the training mode for anyone but heyheykoolaid, rodfpv and autismo". Done by pilot name, like the Tricktionary's
watch button. It comes back for everyone when the owner says the mode is ready.

### Train: examples, connect it, stick modes, the ladder (2026-11-21)
The owner picked the rest of the presentation pass ("4. for sure. spent extra time getting it right").
- **Examples** come after the slow pass and before the pilot's turn: up to three other flights of the trick, each once at full speed,
  with nothing on screen but who flew it and where. Real pilots' confirmed flights first, a different pilot each where there are
  several, then the bot's on other objects. The intro already showed one flight; the examples are never that one again.
- **What may be shown as an example**: the game calls it in the room, no other trick is called in it, it touches nothing. Unlike THE
  example of the intro it may turn further on the trick's own axes (a real loop comes in pieces); never on another axis. A pilot's
  flight that touches something is tried once more on the next object before it is dropped. Why: with the intro's strict rule almost
  no real flight passed, and the stage would have been the bot three times.
- **Connect it** is a fifth try: the trick and any DIFFERENT trick called within 3 s of each other, either order. The game's own calls
  decide; there is no "was it really one?" here (nothing from the room is kept anyway). Q still says "I did it".
- **The ladder**: three rungs per trick, walked (a step-by-step try), landed (a live try), learned (connected). A rung is never lost.
  The Tricktionary shows the rung by each trick and a box on top: how many are learned and the next four to train, easiest first by
  the book's difficulty, ones already started first. Kept in the browser only: it is progress, not flight data, and nothing from the
  Training Room is shared.
- **Stick modes 1-4** change how sticks are DRAWN everywhere (Train's big radio, the small stick view while flying and in every
  player) and the words "left stick / right stick" in Show me. They do not remap the radio. Set in the sticks-big view or in Controls.
  The yaw cue now says "keep pitch and roll still" instead of naming a stick.
- **Open**: three examples or more; whether 3 s is the right gap for "connected"; the ladder's order; whether learned should need a
  clean grade on the live try.

### Daily K.W.A.D. (built 2026-11-21; agreed 2026-11-20)
The owner: "do 1!" (four daily tricks per map, the same for everyone, K and W easy and anywhere, A and D on a named object, 250 a
letter + 2000 for all four).
- **Decided**: the set comes from the UTC day and the map alone, so nothing has to be served: every pilot's game works out the same
  four, and the board can show any map's set. K is one of four basics, W a step up; A is Powerloop / Matty Flip / Split-S on a named
  object, D a harder obstacle trick on a different object.
- **Only what the game calls reliably**: open-air tricks the bot's flights are called on 100 %; objects are in only when the bot's
  flight of every pool trick is called on that object, three seeds of three (28 objects over 7 maps). Clappy Bars and the Murderdome's
  chain gates fell out (the call names another object there).
- **The book's fixed four** (Half Matty, Wall Tap, Trippy Switch, Barani) no longer give letters on maps with a daily set. They stay
  on the hidden maps and in the tests. The bonus amounts are the calculator's, unchanged.
- **Where it shows**: a list under the letters at the start of a flight and after each letter, the pause menu, each map's slide on
  the board. Not the main menu: it was there in the first build and the owner took it off the same evening ("i don't like kwad
  being on the main screen"). The board cannot mark who got all four (it only reads file names); the run's sheet shows the K.W.A.D. bonus.
- **Open**: whether Free Fly should count letters too (it does, like every score); whether the pools are the right tricks and the
  right difficulty; whether a posted run should carry its letters so the board can show a K.W.A.D. mark (needs a relay change).


### Rubik's Cube vs the stall / eject readings (weekly community run, 2026-11-22)
From the labels: 20 decided Rubik's Cube labels (MoPenguinz most, RodFPV, tcmore, WonkyFPV), only 2 found. Ten were corrections of a
360 Stall Rewind call (MoPenguinz, RodFPV), three of an Eject Roll (RodFPV, tcmore); 360 Stall Rewind has never been confirmed by
anyone. The demo GIF is flip 180, roll 360, flip 180.
- **Decided (by the run, for the owner to approve in the PR)**: a context trick read only from the motion around the rotation (a
  stall, a climb before it: no touch, no pass) never takes part of a longer trick's rotations (`SOFT_CTX`, `coversToks` in `better`):
  the half flip in is what looked like the stall or the climb. Taps keep their priority (a touch is real evidence), and so does
  Stellar Eject Roll (its whole pattern is the climb, the roll and the flip back).
- **Decided**: a second, looser Rubik's pattern `Pa180 R*~360 Pa~180`: pilots' rolls ran 420-440° and the flip out read 105-140°
  (slow ends fall under the token threshold), like the Inverted Yaw Spin's loose half flips.
- **Effect** (66 flights with these tricks re-flown): Rubik's Cube labels found 2 → 8 of 20, rejected 360 Stall Rewind calls still made
  11 → 7 of 12, no confirmed label lost; Rubik's calls 59 → 116, the new ones nearly all in MoPenguinz's Rubik's practice runs where
  the game said 360 Stall Rewind or nothing. Bench 96.7 % and stress unchanged.
- **Open**: the rest of the missed ones have the roll split between roll and yaw (camera tilt) or a yaw in the middle; an attitude
  witness (upright → inverted, a turn while inverted, upright again by pitch) would find them. Whether 360 Stall Rewind / Eject Roll
  should need more than they do (neither has a confirmed real example yet).
- **Knowledge bot**: with five pilots' Powerloops in the library, the round-robin gave motion to a 0.08-weight example (an unconfirmed
  keep) and Judge the Bot re-flew it as an Anti Matty. Motion now goes only to examples at least a quarter as well attested as the
  trick's best one.

### Trick challenges (owner, 2026-11-23)
The owner, on the to-do item "trick challenges and the trick board": build it now.
- **Decided**: a pilot names a new trick in SKITTLES mode, posts that stretch of their run as a challenge; other pilots watch it and
  try it; a try passes when the game's signature match (the trick library's `libDist`) puts their move close to the original. **Two
  pilots other than the creator** passing confirms it ("2 (right now)").
- **Decided**: once confirmed it is **live at default points** (200) straight away: the game recognises it in every flight where no
  book trick was called, and scores it on its own line (like gap points and K.W.A.D.), so the TPW trick score stays the calculator's.
  The owner can change its points later.
- **Decided**: bad names are stopped by a **word list** (catching l33t-speak, spacing and repeated letters) in the game and again on the
  relay, for the trick's name and the pilot's; the owner can **hide or rename** any challenge from the trick board with the owner key.
- **Decided**: before posting, the game checks whether it **looks like an existing trick** (what the rules called in that stretch, the
  library's nearest trick, and the other challenges) and says so; posting anyway is the pilot's choice, the board shows the look-alike.
- **Open**: whether confirmed challenges should also go into the trick library as examples (so the knowledge bot can fly them);
  whether 2 stays the number as more pilots join; whether tries should be checked again on the relay (today the game's own match is
  trusted, like board scores; every try carries its clip, so the tools can re-check).

### Trick challenges: the number, and the library (owner, 2026-11-23)
- **Decided**: confirmation stays at **2** pilots other than the maker.
- **Decided**: confirmed challenges **go into the trick library** ("if they're tricks, they're tricks"): tools/library.js reads the data
  repo's challenge files with the relay's own board rule and adds each confirmed, unhidden one as a custom trick: the maker's move and
  every passing try, one voice each, under the owner's name for it if renamed, pilots as anonymous numbers. So the Watcher's library
  vote and the maybe calls know them too. The live call ignores the trick's own library examples when checking that the move is not
  nearer a trick the game already knows, and no maybe is said for a move a community trick already called. The weekly run picks them up.

### Trippy Spin: what the Infinity Loops masterclass teaches (owner sent the video, 2026-11-23)
"How Do You Trippy Spin? The Masterclass" (Infinity Loops, ~27 min; watched from frames and a rough offline transcript, so wording is
approximate). Nothing built yet: proposals for the owner to pick from.
- **What it says**: a trippy spin is an inverted orbit: nose away from the object, camera looking UP at its top, the object held top-centre
  of the picture. Roll and yaw sticks are pushed OPPOSITE ways (an ordinary orbit: the same way). **Pitch sets height, throttle sets how
  fast and how tight the orbit is** (more throttle does not climb; too much throws the orbit into an oval). Entries, easiest first: the
  Cradle (already the start of the motion), a stall (nose up, roll in as it drops), then a Matty or a perch drop into it. Camera tilt
  does not matter (shown at 15° and 0°). Whoops are fine for it. Variations: the switchback (over-rotate, sling back: the best drill for
  both directions), the rolling trippy, the building-corner climb (quarter turns each way, pitch to climb), the open-air one (round the
  sun, inside a ring). "Locked in" = the object never leaves the top of the screen.
- **For recognition (proposed)**: (1) a stick witness for trippies in the Watcher: roll and yaw opposed for most of the lap (an orbit has
  them together), a soft vote; (2) a "locked in" measure (share of the lap with the object top-centre) to grade clean / sloppy instead of
  only gating; (3) check our 8 missed Trippy Spin labels against his entries (stall and Matty entries, slow low-throttle laps, low camera
  tilt leaning far back) and against the pose gate; (4) the variations we do not call: the corner climb (quarter-turn switchbacks, never
  a full lap) and whether a one-lap trippy / switchback should count (pilots already label "Trippy Spin x1").
- **For Train (proposed)**: teach it as his ladder: Cradle, then Cradle held into one lap, then two laps, then the switchback; cues from
  his words ("sticks apart", "pitch for height, not throttle", "keep it at the top of the screen"); a live top-centre target and a
  stick-pair hint in the pauses; a height drill (hold the lap, climb and sink with pitch only). The Big Pole station is there already.
- **Open**: which of these to build, and in what order.

### Trippy Spin: both built, and the stick position is "wonky nips" (owner, 2026-11-23: "let's do both 1 and 2")
- **Decided**: the community's name for roll and yaw pushed opposite ways is **wonky nips**; the game uses it in Train's cues and HUD.
  Build both the recognition changes and the Train ladder.
- **What the labels said first** (25 confirmed Trippy Spin labels re-flown): every one has roll and yaw opposed for at least 47 % of the
  spin and together for at most 26 %; orbits are the other way round. So the sticks tell the two apart by themselves. Many real trippies
  are flown flatter than the game's "rolled past knife-edge" pose (high camera tilt): the pose was the wrong gate for those. And most
  "missed" trippy labels were not missed: a long spin is called when it ENDS, after the label's window, so the tools counted it as a miss.
- **Built, recognition**: (1) wonky nips held while circling a pole counts as the trippy pose, even flown fairly flat (up to up.y 0.8);
  with no sticks in the data nothing changes. (2) A stick vote on every Trippy Spin / Orbit call (its confidence; a rolled trippy with
  the sticks together still counts, at under 50 %, so it comes up in review: a label is never thrown away by one witness). (3) "Locked
  in" (the pole top-centre for the lap) grades the trick: wandering off the top costs clean %, it never cancels the call. (4) A Cinnamon
  Roll is not called for a yaw made while tripping round a pole. (5) Lap tricks carry how long they lasted, and the tools compare a label
  with the whole spin, and count a spin still going when the label's window ends. Confirmed trippy labels found: 16 -> 22 of 25.
- **Built, Train**: Trippy Spin is taught as five stages at the Training Room's Big Pole (not the step-by-step tries: laps are not
  steps): the Cradle, one lap, two laps locked in, climb with pitch (throttle held), the switchback. A target box at the top centre of the
  picture (KEEP THE POLE HERE / LOCKED IN) and the yaw and roll sticks side by side (WONKY NIPS / SAME WAY = ORBIT). The game's own
  calls and live lap count decide each stage; an orbit says why it was not a trippy. Rungs: one lap = walked, two = landed, the
  switchback = learned. Cues are drafts from the video's words: the owner edits them.
- **Checked on the 192 shared flights with these tricks**: Trippy Spin calls 232 -> 231, Orbit 122 -> 117, Trippy Switch 23 -> 26, Burrito
  Roll 159 -> 153, Cinnamon Roll 24 -> 18. One confirmed label changes: a reviewer's yes on a Cinnamon Roll in the middle of an 18 s,
  9.5-lap trippy round a warehouse column (wonky nips the whole way; the same reviewer said no to the Cinnamon Roll called 6 s earlier in
  the same spin): the game now calls the one long Trippy Spin there. Tests, bench and stress (681/700) unchanged.
- **Not built**: Show me / the intro for Trippy Spin (the bot has no trippy script, and library trippies replay on their own pole);
  the stall, Matty and perch-drop entries as stages; the rolling trippy and the open-air one.
- **Open (owner)**: (a) does a one-lap or part-lap trippy count ("Trippy Spin x1" is already a review variant; one confirmed label is
  239 deg of lap)? (b) the building-corner climb (quarter turns each way, never a lap): a trick of its own? (c) one of the owner's own
  trippy labels is called Double Rolling Trippy Spin by the game, and one pilot's confirmed trippy has the sticks together: single
  labels, left alone.
