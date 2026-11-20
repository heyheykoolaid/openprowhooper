# To do (owner's list, newest decisions first)

Kept in order of priority and feasibility. When one is done, move it to CLAUDE.md (what was built) and drop it here.

## Done
- Train in the Tricktionary (2026-11-20): see CLAUDE.md "Train a trick". Next for it: pole, wall and gap tricks (steps by hand), and judging "upright" / "flying backward" in the steps.

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

## Review hub (owner, 2026-11-20: "a more unified way of reviewing all of the flights and labelled tricks under one hub")
Today the same work is spread over the Flight desk (shared flights, Labels, Review queue, Feedback), Judge the community
(board runs), Judge the Bot, Quick check and SKITTLES mode (one's own runs). One screen with sections instead:
- **Sections** down the side: My runs · Review queue · All shared flights · Board runs (Judge the community) · Bot flights
  (Judge the Bot) · Labels (what has been said, by whom) · Feedback. Each a list with its own scrollbar, the header and
  filters staying put while it scrolls.
- **Filters and search** on every list: map, pilot, trick, date range, state (not reviewed / reviewed by me / disputed /
  waiting for a second opinion), and a search box.
- **One player** for everything: open any item in the same review player, with Next / Previous through the list it came
  from (keyboard too) so a run of moments can be judged without going back to the list each time.
- **Progress and counts**: how many waiting per section, "you judged 12 today", a badge on the main menu when the queue
  has something new.
- **Disagreements view**: moments where pilots' labels disagree with each other or with the game, side by side.
- **Per-trick view**: every example of a trick (confirmed, rejected, waiting), to watch them one after another, the trick
  library's demo first.
- **Undo** for the last verdicts sent in a session, and a clear "sent ✓" on each item.
- **Remember place**: the section, filters and scroll position come back when the hub is reopened.
- Works for every pilot for their own runs and reviews; the owner's sections (all shared flights, feedback) only with the
  owner key.
