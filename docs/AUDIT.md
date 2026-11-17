# Code review and audit — 2026-11-17

Scope: everything in `src/`, `test/`, `tools/`, `build.py` at this commit. Method: read-through of the new modules
(race, editor, bbl, bbreplay, recap), targeted greps for secrets / injection / storage, syntax check of every file,
the full test suite, three stress seeds and the benchmark.

## Results at a glance
- `npm test`: all suites pass. Benchmark 96.6% (no real pilot-labelled data in the repo yet, so that number mostly
  measures agreement with the bot and the demos).
- Secrets: the GitHub token is only ever read into the `Authorization` header (`ghFetch`). It is not in any export,
  upload payload, feedback payload, the build or the repo. No e-mail addresses or tokens are committed.
- Third-party material: three.js r160 (MIT) is vendored. No Tricktionary GIFs/frames are committed (derived numbers
  only). WebFPV (GPL-3.0) was looked at for ideas; no code or track files were taken from it.

## Fixed in this pass
1. **HTML injection from file names and log headers.** Video file names, Blackbox file names and log headers
   (firmware string), the flight controller's craft name, and imported track names on the race results screen were
   written into the page unescaped. All go through `esc()` now. (Self-inflicted only: it needed a hostile file name
   or track file, but testers will swap track files.)
2. **Beginner Matty rules** were looser than the trick (no upright / backward checks on one path). Tightened.
3. **Review labels** of "not a trick" were read by the benchmark as a trick called "not a trick". Fixed in `tools/unify.js`.

## Open findings (not fixed)
| # | Severity | Finding |
|---|---|---|
| 1 | High (accuracy) | Almost all tuning rests on scripted bot flights and written descriptions. There are no pilot-labelled real flights in the repo. The run review, flag keys and Blackbox Replay labels exist now; until that data arrives, accuracy claims are about the bot. |
| 2 | Medium | The bot's loop timing table (`sweep()` in `src/maneuvers.js`) is stepped every 2 ms and the stress tester samples at exactly that step. Interpolating it (the correct behaviour) makes two slowed-down flights fail (a Reversed Power Flip and a Maverick Loop whose first half-loop turns slower than ~95°/s). So big, slow loops are weaker than the suites show. |
| 3 | Medium | Pole Dance (two whiplashes) is recognised on fewer than half of scripted flights after Whiplash was tightened. Side-Lock Rewind and Cradle drop to 7–9 of 10 with drifting flights. Marked draft; needs real reps. |
| 4 | Medium | The Review / flag-key recording was verified with scripted flights pushed through the recorder, not by hand-flying. Replaying a saved review file through the benchmark was only spot-checked. |
| 5 | Medium | The track editor's manipulators, magnet and Define-gate were exercised on small cases in a headless browser (one gate, two pipes). Not tried on a full 20-pipe structure or on a touch screen. Rotation rings overlap where they cross, so a click there can grab the wrong axis. |
| 6 | Low | `localStorage` writes fail silently (`store.set`). Race ghosts are stored there; a very long best-3 ghost on many tracks could hit the browser's quota and quietly not save. |
| 7 | Low | Blackbox Replay's path is a reconstruction (thrust from eRPM, drag guessed, drift filtered out). Good for watching attitude and sticks; not evidence of where the quad was. Obstacle tricks there depend on the pilot's U/O marks. |
| 8 | Low | `src/sim.js` (≈2,300 lines) and `src/game.js` (≈1,800) are dense single files with many long lines. Fine for a single-file build, harder for a second developer. Splitting the detector, the Watcher and the map into modules would help. |
| 9 | Low | Dive and Perch are written around the starter map's building; over/under tricks need hand-tagged objects (see docs/RECOGNITION-ROADMAP.md item 10). |
| 10 | Low | A short real `.bbl` (the pilot's own flight 13, 13 KB) is committed as a decoder test fixture. It contains the quad's tune and rates, nothing personal. Remove it if that's not wanted in a public repo. |
| 11 | Info | The feedback form's "Open a GitHub issue" button puts the comment in the URL of github.com/…/issues/new; that is the tester's own text and only happens when they press it. |

## Suggested order
1 → collect real labels (already possible), then 2 and 3 with that data; 5 with one real RaceGOW build; 8 when a
second developer joins.
