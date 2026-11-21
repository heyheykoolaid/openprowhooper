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
- The learned witness (2026-11-21, tools/witness.py): built and tested, not voting. Next: train it on call-window signatures (bot flights + shared flights' calls re-flown), check a clean roll scores high, mark it live, add it to the weekly run.
- Feel: the first step-response read says the real Air65 is quicker and springier than the sim (feedforward): fit it once a test-card log is in.
