# Open Pro Whooper Project — design notes

## Where it is (v0.1)
- Playground map (grimy graffiti style), 1 kHz whoop physics, Betaflight-style FC, Garage parts, radio/gamepad/keyboard input.
- Live trick recognition for all 90 TPW tricks (49 tested rules, 41 drafts). Fast combos lock in ~140 ms after a rotation,
  ~80 ms after an obstacle pass. Sustained tricks (Trippy Spin, Orbit, Double Rolling Trippy, Wall Ride) score live:
  half-lap counter, banked on exit or direction switch (+ Trippy Switch bonus), lost on crash/disarm.
- TPW calculator scoring + Tony Hawk-style combo display.
- Dev tools: Trick Calibration checklist (5 reps × 90 tricks, rounds), Pause & Ask mode, 100 Hz flight recorder,
  IndexedDB storage, session/rep export, opt-in GitHub upload of calibration data and Blackbox logs, Blackbox Lab
  (Web Serial MSP flash dump + `diff all` + optional build sheet).

## Pilot-confirmed rules
- Matty Flip: over → ~360° forward flip → upright, facing the object, flying backward under it.
- Powerloops go inverted over the top; Maverick loops stay upright and forward-looking.
- Trippies and other sustained tricks score live and only fail on crash/bail.

## Roadmap
1. **Gaps from every angle (next detection phase)** — pass-through detection for any opening in any object
   (swing legs, monkey-bar rungs, jungle-gym bays, under benches/tables, between objects), any approach direction,
   gap size vs. whoop size, orientation (knife edge etc.), direction.
2. **RaceGOW mode** — RaceGOW is the international online whoop racing event: everyone builds the same short track
   at home from PVC gates (commonly 24-inch square, centre to centre) and compares lap times on a shared leaderboard;
   no eliminations.
   - Track builder: place RaceGOW-spec gates (and flags/dive gates/hurdles) on a floor plan, snap/rotate, start/finish,
     lap direction, share a track as a short code or file.
   - Racing: timed laps, gate-order validation, missed-gate rules, best lap / 3-lap, ghost of your best run,
     local leaderboard; later online leaderboards.
3. **IGOW challenges** — IGOW (International Game of Whoop) is a weekly challenge series with skill tiers and
   eliminations. Challenge mode: weekly-style tasks (specific trick on a specific obstacle, gap runs, trick lines)
   with Beginner/Advanced tiers, pass/fail judged by the trick detector, a season of challenges.
4. Confirm draft rules with pilot data; trick bot + confusion matrix; measured execution grading.
5. Blackbox fitting: replay logged sticks through the sim, fit motor/prop/drag/inertia per build.
6. Multiplayer, more maps.

## Cube / gate tricks (from the Tricktionary)
- **Loop to Matty** (Advanced, cube: 550): through a cube, half powerloop pitching back to see the back gate, then a Matty
  back through the top and out the back. Needs a cube obstacle with per-face gap crossings; pairs with the RaceGOW gate
  work. Indoor variants (Indoor Rubik's Cube through a gate, etc.) belong here too.
