# To do (owner's list, newest decisions first)

Kept in order of priority and feasibility. When one is done, move it to CLAUDE.md (what was built) and drop it here.

## Done
- Review Hub (2026-11-20): see CLAUDE.md "The Review Hub". Next for it: retire the old screens once it has been used a week (owner's call), and a "withdraw a sent verdict" note if wanted.
- Train in the Tricktionary (2026-11-20): see CLAUDE.md "Train a trick". Rolling starts and instant retry are in (2026-11-21). Still to try for its flow: slow-mo instead of full stops, tries that adapt to the pilot, a ghost in the live tries, sound per step, a "learned" mark and next trick, no reload into the Training Room. Next for it: pole, wall and gap tricks (steps by hand), and judging "upright" / "flying backward" in the steps.

## Next, in this order (agreed 2026-11-20)
1. ~~**Knife Edge only through narrow gaps**~~ (done 2026-11-20): the gap's narrow side about two quad widths or less (measured against the
   pilot's own whoop), the quad rolled to match it. Stricter than the Tricktionary ("2-4 times the size of your whoop").
   Add a narrow slot or two where maps have none (Trick Park). Re-fly the labelled flights; add a test.
2. ~~**Gap points in combos**~~ (done 2026-11-20: 25-75, names from the gap objects; proper names per map still to draft): every gap flown through counts as a small trick that keeps the combo alive, worth more the
   tighter it is (about 25-75 next to a Flip's 50), less each time the same gap repeats in one combo. Kept on its own line
   of the score sheet so TPW totals stay comparable.
3. **KWAD**: four daily tricks per map (same for everyone, from the date): K and W easy and anywhere, A and D on a named
   object. Letters light on the HUD, a bonus for all four, shown on the main menu and the board. Only tricks the game
   calls reliably; obstacle letters on objects the bot already flies well on that map.
4. **Disarm tricks** (flip, roll, loop): rotation counted while disarmed in the air, re-arm before landing or crashing;
   the loop accepts a partly ballistic path over the top. Own points (not in TPW). Check the sim's disarmed coasting and
   spin decay first; needs the owner's test flights.
5. **3D mode scoring**: decide with 3D pilots which tricks count and what they are worth, and whether 3D gets its own
   board. After gap points exist.

## Trick challenges and the trick board (owner, 2026-11-20)
A pilot names a trick (new, or one the game doesn't call well), flies it, and posts it: the replay goes to a **trick board**
on the relay. Other pilots watch it and try it; a try passes when its motion matches the original closely enough (the trick
library's signature match: rotation per axis, the up/down curve, the over/under passes in order, with a tolerance). When 3
different pilots pass, the trick is confirmed: their examples go into the trick library (a custom trick with examples from
several pilots already shows up as a "maybe"), and the owner names its points and turns it into a real rule. The replays are
the video reference. Needs: a new relay kind (`challenge`), a board screen, the guest replay viewer, a "this looks like
<existing trick>" check before posting, and the owner's say before anything is scored.
- The learned witness: retrained on call windows (2026-11-21; numbers in CLAUDE.md and community/WITNESS.md). Off until the owner says to turn it on (`live` in community/witness.json, then build). Add tools/witness-data.js + witness.py to the weekly run.
- Feel: the first step-response read says the real Air65 is quicker and springier than the sim (feedforward): fit it once a test-card log is in.
- More Warehouse (owner, 2026-11-21): a moving conveyor belt (it has to carry the quad: a surface that moves what rests on it), and two levels more scatter and visual detail; re-run gapcheck / floatcheck / mapaudit / test/maps.js after.
- Review grades: "crash" is in (2026-11-21); "incomplete" waits. Once crash grades come in, tune the bump / crash line from `node tools/grades.js` (and look at the 11 calls the game graded clean that pilots graded bump).
- Train: Show me on the Big Square (the bot's loops only fly bars up to 3.2 m); the mode "still needs a lot of work" (owner).

## Train mode, presentation pass (owner, 2026-11-21: "I really like these improvements"; from headmazta's no-talking Barani tutorial and other sims' lessons; presentation and flow only, never how a 5 inch flies)
1. **Payoff first**: before try 1, two or three full-speed passes of the trick (a confirmed library example, else the bot), no text; then the steps.
2. **Sticks big, FPV small** for the walkthrough (the radio fills the view, the flight a small picture between the gimbals); then **FPV big, sticks small** for the examples.
3. **One short coaching cue per step**, about hands and eyes ("cut throttle as you go inverted", "catch it before the ground"), hand-written for the common tricks, shown ~0.5 s before the pause; the rule-made text ("flip 180") stays as the fallback.
4. **Arrows only on the stick that moves, only while it moves**; nothing drawn for a stick that stays put.
5. **A slow-motion walkthrough** of the whole trick with the cues, before the pilot's tries; scrubbable (restart, back, pause, slow, a progress bar), like FS One / SeligSIM lessons.
6. **Examples stage** at the end: real confirmed flights of the trick on different maps and objects, with the pilot's name.
7. **"Connect it" as the last try**: land the trick, then chain it into anything; the combo counting is the pass mark.
8. **Stick display in Mode 1 / 3 / 4** for pilots who do not fly Mode 2.
9. **A ladder**: tricks in an order, something earned per rung (RealFlight's lessons with unlockable rewards); a "learned" mark in the Tricktionary.
Order to build: 1, 3, 4 (small), then 2 and 5 (the player), then 6, 7, 9; 8 with the stick view.
- Split-S in open air: 5 confirmed labels have no object under it. Owner to decide: count it (a new open-air variant) or leave it to the book.
- Review queue for every pilot (owner, 2026-11-21: "it makes sense"): needs a public, read-only relay route for a short list of moments (see the plan given in chat), a relay redeploy, and the sharing prompt's wording checked.
