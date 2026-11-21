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

