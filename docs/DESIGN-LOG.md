# Design log (rolling)

A running record of what the owner and Claude decide and why, newest first. One entry per discussion: what was asked, what was
decided, what was left open. docs/TODO.md is the ordered list of what to do; CLAUDE.md says how things are built; this file keeps
the reasoning so it is not lost between sessions. **Add an entry whenever a design question is discussed, even when nothing is built.**

## 2026-11-27

### Clappy grows east: East Campus and a 60 m walkway (owner, 2026-11-27: "Grow map east!", "Make sure everything works for our tricks too")
Asked how to lengthen the footbridge, Claude offered four ways; the owner picked growing the map east. **Built**: the walk now runs from
the plaza over the street (the footbridge, unchanged), down the alley between two shop blocks on a skywalk, over a new street (East
Lane) on a second cable-stayed bridge, and through a campus hall by a breezeway (an arcade under it) onto a terrace and stairs into a
quad: about 60 m. A lecture hall and a library beside the hall, the quad with trees, a bell tower, a colonnade, an arch and a flagpole.
Every new piece that can be flown round or through is tagged (over/unders, poles, gaps with place names, buildings for wall tricks);
the bot's Powerloop, Matty Flip and Split S are called on each. **Known limits**: in the 3 m alley and the breezeway a loop across the
deck has no room (only out of an end, as in real life). **Open**: add campus objects to the daily K.W.A.D. (it reshuffles the sets);
old flights that flew east of the shops (x 46-65, open air before) now meet buildings there when re-flown.
**Lined up (owner, same day: "The walkway is not lined up")**: the skywalk followed the alley, 1.5 m off the footbridge's line. The
alley between East Shops 2 and 3 moved 1.5 m south instead of the footbridge (moving the bridge would have broken the labelled
Rollbacks and the K.W.A.D. spot on it); the skywalk, the Campus Bridge and the breezeway now run on the footbridge's line. Old flights
through that alley re-fly against walls 1.5 m away from where they were.
**Floating lights (owner, same day)**: the skywalk's two light strips hung in mid-air over the alley; they now sit under the deck in housings, like the footbridge's.
**A spiral sculpture and a truss (owner, same day, with a video from another sim: "the big spiral structure would look cool as a big
public sculpture, and the cool truss/over under structure would look better than the covered pathway")**: built our own versions, not
copies. The colonnade is gone; in its place a white truss arcade: 13 portal frames 3 m apart with a braced girder on top, open at the
sides so you can weave between the posts, every frame an over/under and a gap, the whole run an over/under across it. The spiral is a
16.6 m sculpture in the north of the quad: a mast with 96 slats 5 m long winding 2.4 turns round it; the mast is the pole for trippies
and orbits (both called in a test), the slats are solid but not over/unders. Open: whether the spiral's turns should count as gaps.
**Trippy Training Towers, and the green slide (owner, same day)**: the spiral is named the Trippy Training Tower; a second one, mirrored
(turning the other way), stands at the south end of the quad. The Twister Tower's top slide (green), which ran off the plaza into the
street, is removed; a rail closes that side of the top deck.
**IGOW flag, and K.W.A.D. boxes fade (owner, same day)**: the East Campus flag carries the IGOW logo. The glowing box round a K.W.A.D.
object now fades out between 22 and 40 m from the quad, on every map; the floating letter always shows, so the object can still be found.
Open: the distances are a first guess.
**Maverick Loop by its top (owner, same day: "maverick loop detection is iffy")**: two problems, both in the rule. A real Maverick
dives steeply down the far side, which broke "stayed upright"; and the over pass was never checked, so the game called Mavericks on moves
that went over forward or nearly upside-down. Now: over the object upright and flying backward, never on its back. Labelled flights:
real ones 1 -> 2 of 2, rejected calls 8 -> 0. Open: the owner's two wire Mavericks from today (their flight had not uploaded yet).
**A pagoda on Lecture Hall (owner, same day: a video of a dark open-frame pavilion with green-lit edges; of three places offered, "I like
2" = on Lecture Hall's roof; then "i don't like it neon … a wooden beam structure, kinda pagoda style")**: a neon version was built and
dropped before it shipped. What stands is a two-storey timber pagoda: red posts, wooden eave beams with brackets, a flared lower roof all
round, an upper storey set in, a hipped roof with upswept corners and a finial. Flown in through the lower bays, up the open well and out
the upper bays; every bay and the well are gaps, the posts poles, both eaves and the roof over/unders. Then (owner: "the roofs look weird, can we just make it out of the red"): the
tile roof panels are gone; both roofs are open frames of the same red beams (rings, rafters, hips, ridge), so the whole pagoda is see-through.
Then: the eave brackets, corner spikes and finial came off, and a rail round the lower storey gives every bay the frame's double-stacked windows (each window its own gap).

### Clappy's footbridge after JD's "The Bridge" (owner, 2026-11-27)
RodFPV pointed at fpvwithjd's reel "THE BRIDGE PART 10" (a campus footbridge); the owner asked to make Clappy's walking bridge look like it.
Decided: keep the deck, rails and pillars exactly (the K.W.A.D. Footbridge, Rod's Rollback labels, the shared flights all depend on them) and
dress it: dark steel portal frames at both ends, a two-mast tower beside the street with two crossbeams and pointed finials, stays down to
the deck edges, pale deck panels with dark joints, fascia and railing posts. Every new piece is a trick object: portal and tower beams
over/unders, masts poles, portals and the tower openings gaps ("Through the Bridge Portal / Tower"). Open: the reel's glass section with
yellow trim and the brick abutments were left out; say if they should go in.

### Inverted Yaw Tracking: the owner's tutorial link (2026-11-27; nothing built)
Owner sent headmazta's "How To: Inverted Yaw Track" (YouTube, 4:56): "see how it's focused on tracking an object as you pass by it while
inverted?" **The video could not be watched from here** (YouTube is blocked for downloads and the cloud browser showed "Video
unavailable"); only the page text was read: the description ("an inverted yaw spin with an object at the side … which direction your yaw
input should be depending on which side of the obstacle you're going") and two comments (slow and focused on the object; a small pitch
before the roll so the quad ends level). Against our rule (half roll in, inverted yaw of ~180 / 270 / 360, pitch or roll out, some pole or
tagged obstacle within 8 m and 40 deg of the camera centre for 70 % of the yaw): **proposed** (a) judge the PASS: the quad travels past one
object and its bearing sweeps, the yaw following that sweep in direction and amount (so any amount from ~90 deg, not only 180+), which
also tells it from an Inverted Yaw Spin beside a pole; (b) yaw direction must fit the side the object is on; (c) track any solid thing
(buildings, cars, the fountain), not only poles and tagged bars; (d) allow the small pitch with the roll in; (e) grade clean by how
centred the object stays. Only two labelled moments exist (one pilot). Open: the owner's go, and ideally a few labelled flights of his own.
**Built (owner, same day: "Build it.")**: all five. Inverted Yaw Tracking is now a tracked pass: on its back, flying past one solid thing
(poles, and now cars, benches, the fountain and the like), the yaw following it so it stays centred; any yaw amount, slow tracks included;
graded by how centred the object stays. A spin on the spot, the same pass with no yaw, yawing the wrong way, a Barani's yaw over its
object and a barrel roll round a pole are not one. The two labelled moments turned out to be corrections (the old rule's calls were really
Inverted Yaw Spins): the game now calls both Inverted Yaw Spin. Numbers (1.2 m of travel, 45 deg of sweep, 35 deg off centre, 60 % of the
time) are first guesses with no confirmed real flight behind them. Open: the owner flies some and labels them.

### What else WebFPV can teach, for RaceGOW mode (owner asked, 2026-11-27; nothing built)
Read its racing code (race.js, ghost.js, raceline.js, guide.js), its RaceGOW spec file (racegow.js, which quotes RaceGOW's own published
rules), its track builder (warnings.js, passes.js, path.js) and its freestyle scoring (closecall.js, trickdetect.js). GPL-3.0: ideas only;
RaceGOW's rules are RaceGOW's public documents, read from there. Already ours: gates in order, wrong-way, laps, sectors, deltas, 30 Hz
ghosts, repeated / both-way passes, a lap estimate, the 25 real layouts; timing runs on the 1 kHz physics step, so a crossing needs no
interpolation. **Ours does not have, best first**: (1) RaceGOW's actual metric, the **fastest three consecutive laps** from the one start
gate (we keep the best single lap); (2) a **racing line to follow**: an optimised line through each opening (knots slide inside the hole,
lean off square, cost = lap time at a cornering load, a wall for touching pipe or crossing an opening out of turn), drawn as breadcrumbs;
our flow line is a straight polyline and the older layouts' own flight lines (`guide`) sit unused in the repo; (3) **RaceGOW's build
rules as "Make raceable" checks**: gates enclosed (a pipe on the floor), all gates one size, adjacent centres 27-33 in apart, ground gate
centres at 20 in or lower, a second stacked gate 42 in up, a third 69 in, 14 in from a gate centre to a pole, 36 in between poles, and
rule 7 (no flying a gate backward to shortcut); (4) **close calls** for the trick side: skims along walls and roofs, threading between two
things, under a deck, low passes, scored by clearance like a manual (a freestyle idea, not racing). **A question for the owner**: RaceGOW's
rules cut the pipe at 26.5-27.25 in (a 28 in opening); 24 in is their minimum gate size, with the whole track scaled to it. Our layouts are
built at 24 in sections (owner, 2026-11-25): so every track is at the smallest allowed scale, about 12 % smaller than the organiser's own.
**Decided (owner, same day)**: none of it; "we're doing our own thing well enough with tricks". Tracks stay at 24 in.

### Clappy Park: room round the corner trees, and no more clipping (owner, 2026-11-27)
"on the corners of clappy park, there's a light post and a cherry tree, can we space these out more? they make it hard to trippy. there's
also a lot of objects and textures clipping now creating odd visual errors." **Done**: the four lamps moved off the deck's corners onto the
inner sidewalk's corners, 4.5 m from the sakura (1.7 m before). A new check (tools/clipcheck.js) found 80 places where two faces shared a
plane in different colours, 39 thin layers with nothing to keep them on top, and 26 pieces cut by a solid; a sphere check found the six
sidewalk sakura's crowns through awnings, walls, shop windows and utility poles. All fixed for Clappy: the sidewalk sakura are a little
smaller and stand between the awnings; paint, paving, petals, shop windows and signs are drawn as decals (a depth offset that holds at any
distance: the FPV camera's 4 mm near plane made a few mm of separation flicker from ~20 m); windows that ran into balconies, the other
corner block or the HeyHey / Clappy graffiti are not drawn; the overlapping corner blocks no longer share faces. Only what is drawn changed,
except the moved lamps and sakura (colliders, poles and over/unders, so trippies there now have room). **Open**: the same check lists
flicker on Slackvegan (36), the ship (25) and others: a pass per map when wanted.

### Prop thrust in moving air, and how hard the props are to turn (owner: "Okay, now 2 and 3", 2026-11-27)
From WebFPV's plant (ideas only). **(2) Inflow, on in the game**: thrust is worked out from the rotor's own inflow (blade element and
momentum theory together) instead of a straight line in advance ratio plus an 8 % translational-lift bump. Hover is exactly as before; a
full-throttle climb is ~6 % faster, forward flight at 8 m/s gets ~10 % more lift. The logs cannot check the lift (no position), and the
roll / pitch / yaw step responses against them do not move. "Straight line (old)" stays in Advanced physics → Feel. **(3) Figure of merit,
a finding and a question**: the game's props sit at a figure of merit of 0.38 (a real whoop prop: 0.3-0.4), so as a number it looked
right. But flown with the logs' own sticks, the sim's motors spin 33 % faster than the owner's Air65s at the same throttle (50 %: 53k
against 37k rpm), the gap growing with throttle: the props are far too easy to turn. Prop grip 1.7 with a figure of merit of 0.15 (that
is the props plus the motors' own losses, about 6.8 times the prop load on an Air65) matches the rpm at every throttle within 7 %, hovers
at 29k rpm and 32 % (real 29-31k, 30-34 %), and draws 3.9 A (real 3-4 A: the battery drain factor of 2.4 would no longer be needed). The
catch: thrust to weight falls from about 5 to about 3. The one held punch in the logs reads ~2.8 on a sagging pack, but the whoop spec
the owner collected says 4.5-7. **Open, the owner's call**: make the logged load the default, or keep the punchier props? It is the
"Logged Air65 load" button in Advanced physics → Feel to fly first. The 2S presets would fall to ~2.2 with it (their motors are guesses).

### Inertia measured from the Blackbox logs (owner: "let's do 1", 2026-11-27)
**Result: the sim's roll / pitch inertia is right for the owner's quad; nothing changed in the game.** Two ways tried. (1) WebFPV's
open-loop fit (angular acceleration against the left-right / front-back difference in rpm squared, scaled by the hover): it recovers the
sim's own inertia from the sim's flights (r² 0.8-0.99), but on the real whoop logs it explains under a third of the acceleration (r²
0.03-0.27) and gives numbers 5-35x too big: noise, not inertia (ducts, the D-term fighting gyro noise, eRPM rounding; a five inch's clean
snaps are a much easier case). Dropped. (2) The closed loop: each flight flown again with the log's own sticks, rates, PIDs and
feedforward, inertia scaled 0.7-1.4 (2.5 for bum-darts), and the step response and lag compared: the owner's Air65 (choppoop 2026-11-19,
the closest match by far) fits best at x1; the other 30000KV whoop is flat from x1 to x1.4; bum-darts leans to ~x2 but the sim matches
that quad four times worse overall, which points at its EVO motor / prop numbers, not its inertia. Left in: a `tune.inertiaFeel` knob
(unused by default) and `node tools/inertiafit.js`. Next of WebFPV's list if wanted: (2) the inflow solve with (3) yaw from thrust.
A test-card log with roll and pitch snaps would sharpen this read.

### What WebFPV's physics could teach ours (owner asked, 2026-11-27; nothing built)
Read Mathew-Harvey/WebFPVSimulator's plant (src/native/plant.c). It is GPL-3.0: ideas only, no code copied. Already in ours: the DC motor
model, thrust loss with climb, a little translational lift, vortex ring state faded by edgewise speed, a wake trail the quad can fly
back into, Cheeseman-Bennett ground effect, quadratic body drag plus rotor H-drag, the gyroscopic term, pack sag, a wobble term.
**What they have that we do not, best first**: (1) **inertia fitted from Blackbox logs** (inertia over mass and arm read off full-rate
snaps; theirs came out well under their hand table) and motor lag read as rpm following its command: we have three whoop logs and
fit only delay and shake; (2) **thrust from a momentum-theory inflow solve** (one constant from the prop's pitch speed) instead of our
straight line in advance ratio: climb costs about half as much near hover, and heave damping grows with forward speed;
(3) **yaw torque tied to thrust by a figure of merit** (kq from kt; 0.30-0.40 for a 31 mm whoop prop): yaw authority stops being a free
number (ours was hand-scaled x1.8); (4) **rear rotors in the front rotors' wake** at speed, 10-25 % less thrust behind, so the
controller holds the nose with more rear motor; (5) **two-band prop-wash buffet** (30 Hz and 3 Hz, normalised so the setting is a
thrust fraction); (6) a fixed small **per-motor inflow asymmetry**; (7) **dynamic inflow** lag (a few ms, small); (8) a **slow second pack
resistance** (punch fades over a second and recovers; moot with battery life off by default); (9) "gates" scripts holding every
number inside a band with its source. Proposed order: (1), then (2)+(3) together, then (4)-(5), each checked in Feel Lab against the
logs. Open: the owner's pick.

### Clappy's street trees thinned (owner, 2026-11-27)
"a bit too crowded around the lightpoles and gives you no space to trippy with the green trees". **Done**: of the 15 new street trees,
the 8 at the plaza's corners (beside the sakura and the park lamps) and the one by the Twister slide's end are gone; six stay, mid-side,
each with room to circle. **Not changed**: the four park lamps still stand under the corner sakura's crowns (1.7 m from the trunks; the
original layout). Open: move them out to the plaza's edge if that corner still feels tight.

### Real Betaflight on one secret test whoop? (owner asked, 2026-11-27; nothing built)
Owner, after reading pilots' feel settings ("Not our game" on a full switch): could the firmware be tried on one hidden whoop? Answer:
yes: Betaflight's SITL build compiled to WebAssembly, stepped by our 1 kHz loop (our physics feed it gyro / accel and the sticks, it
hands back motor outputs) in place of `FlightController`, for one preset only, shown to the owner like Train; its flights tagged so the
tools know which controller flew them; then the same Blackbox-log comparison as Feel Lab against our controller. **The catch to decide
first**: Betaflight is GPL-3.0 and the repo has no licence, so serving the compiled firmware in the public build (even hidden) would
make the game a GPL work. Way round it: the owner builds or downloads the .wasm himself and loads it from his own disk (never in the
repo or the build). Open: which way, and whether to try it at all.

### WebFPV runs real Betaflight in WebAssembly: does ours? (owner asked, 2026-11-27; nothing built)
No: ours is a Betaflight-style flight controller written in JS (`FlightController` in sim.js): Actual and Betaflight rates, PID with
feedforward, airmode, I-term relax, gyro / D-term lowpass filters (types and dynamic cutoffs as Betaflight's), TPA, anti-gravity, thrust
linear, throttle boost, simplified-tuning sliders, angle and 3D modes, RC smoothing, and `diff all` / Blackbox-header import. Missing from
the real thing: the dynamic notch and RPM filters (the sim has no motor noise for them to remove), and every firmware detail not copied.
What we have that a firmware port does not give by itself: the physics fitted to real whoops' Blackbox logs (Feel Lab, step response).
Open: whether to try Betaflight SITL compiled to WebAssembly in place of `FlightController` (a big job: the 1 kHz loop, the detector
worker and the tests all call the JS one; it would need the same hooks and the Node tests would have to load the WASM).

### Today's K.W.A.D. Powerloop on Clappy's Footbridge never lit (owner asked, 2026-11-27)
"is today's powerloop kwad objective on clappy map working for you?" The bot's Powerloop on the Footbridge was called right (6 / 6),
but re-flying the shared Clappy flights showed pilots' Powerloops round the bridge are called on the **Footbridge Rail** 97 times and on
the Footbridge 15 (the rail's line sits over the deck, so it wins), and the letter wanted the name exactly. Not caused by the facelift
(the same before it). **Fixed**: a call on a part of the named object counts for the letter (`kwadOn`: "Footbridge Rail" and "Footbridge
Stairs" are the Footbridge). Today's set: K Yaw Spin, W Juicy Flick, A Powerloop on the Footbridge, D Maverick Loop on the Overhead Wires.

### Clappy Park: all seven refinements built, every new thing counts (owner, 2026-11-27)
"Get it all done, but make sure all of the helpers are added for the changes. we still want all the tricks/gaps to count." **Built**:
the shade lifted (sky fill 0.9 -> 1.2, warmer ground bounce, a clear blue haze instead of the tan one); kerbs, the inner sidewalk, a
broken centre line and zebra crossings at the four stairs, manholes; pavers with a border over the plaza, rubber pads and sand under
the play pieces, a fountain with four flower planters round it; three pinks in the sakura, fallen petals under each and petals drifting
down; lit shop windows with a glass door, eight shop signs (not over the murals), white valances on the awnings; clouds and a city of
low blocks and towers round the block (outside the map's edge walls); street trees, benches with backs and bins, two more bike racks, a
bus stop, five parked cars. **Helpers**: street trees, the fountain column and the bus-stop sign are poles; tree crowns, the fountain bowl,
bike rails and the shelter roof are over/unders; the shelter is a gap; benches and cars get low gaps from the Surveyor (legs at the ends
on purpose). The bot's Powerloop / Matty / Split S are called on all of them, a straight flight through the shelter, under a car and
under a bench is logged as a gap. **Nothing old changed**: every over/under line, gap and pole on the map is identical (compared object
by object with the previous build), the new gaps are all clear (tools/gapcheck.js), nothing new floats, K.W.A.D. objects unchanged.
Paint on the plaza deck has to be a thin drawn box: ground paint (zones) never showed on the deck.

### Clappy Park: 5 % brighter, and refinements proposed (owner, 2026-11-27)
"clappy park is a little dark, can we brighten it by about 5%? what visual refinements could we make to the map?" **Done**: the sky
fill and sun 5 % brighter on Clappy only. **Proposed, not built** (from four check views): lift the shadows themselves (the shade is
near-black because the sky fill is low), road paint and crosswalks, a paved plaza with planters, petals and variety in the sakura,
storefronts and more facade detail, clouds and a distant skyline. Open: which of these to do.

### The owner's answers on the waiting list, and Power Roll vs Rubik's Cube (2026-11-27)
"Ready to build, 1, 2 and 6. waiting: 1: 2s is good. pay more the longer it lasts, yes. yes to glow option. box truck, yup!"
- **Decided / built**: a knock between tricks now waits 2 s before it ends the streak; INVERTED pays more the longer it lasts (200, then
  50 more each second, capped at 1000 a second: Claude's numbers, say if wrong); an Options switch for the K.W.A.D. glow; gap call-outs
  read as places on every map.
- **Read as**: "box truck, yup" = the box truck and trailer stay over/unders (nothing changed); "yes" on INVERTED = pay more, not the
  streak on it (left off). Say if either was meant the other way. Back-to-back tricks still build the streak (not answered).
- **Power Roll vs Rubik's Cube** (owner: "the difference … is an over under object, and a power roll is more of a loop motion, with a roll
  at the top. can we help our helpers better distinguish?"). Built both ways: the detector reads a Power Roll from one pitch loop with
  the roll at the top round an object (his 4 labelled ones were called Immelmann + Split S or Rubik's Cube; now all 4 are Power Rolls),
  and the people judging calls get a short "how to tell them apart" note for that pair and five other look-alike pairs.
- **Settled**: the one Immelmann he confirmed with the same shape was a slip (owner: "due to how the labeling works, segments of
  tricks can kinda join together. Disregard that example."). Power Roll stays as built. The hint wording for the other pairs is Claude's from the book: edit freely.
- **Looked at, not changed**: Flip vs Powerloop on bars: the remaining Powerloop labels read as Flip are a bump, a crash and a loop through
  a race gate that never crossed its top bar; the Flips read as Powerloop are open-air 315-340 deg backward flips while moving, which the
  open-loop rule takes for small loops. Telling those apart needs a study of loop size and climb on confirmed open loops: next round.

### K.W.A.D. marker and list (owner, 2026-11-27)
"remove the column from the sky on kwad, and make the marker about 10% more transparent"; the list under the K W A D letters should
show in game "like it did before" (not clickable). **Done**: no beam; outline, fill and letter 10 % fainter; the list stays up for the
whole flight instead of fading after 9 s (and 4.5 s after each letter), still hidden while racing.

### Review queue rows: who labelled it, not how many labelled the trick elsewhere
The owner: the row should not say "6 other pilots have labelled this trick", "as that's kinda irrelevant to the person clicking on it,
what it should show, is if someone else labelled it, and what they labelled it as." **Done**: that sentence is gone (the count still
moves such rows up the queue, unseen); each label at the moment reads "RodFPV labelled it Trippy Spin" or "RodFPV said it was not a
trick"; with none, "nobody has labelled this moment yet".

## 2026-11-26

- **K.W.A.D. objects glow** (mistawintaz: "had too much trouble finding the cable tray"; owner: "Yup!"). Only the A / D objects of the
  day, only while their letter is open: an outline box, a light beam and the letter over it, gone once taken. Decided: shown through walls
  faintly (finding it is the point). Open: an Options switch to turn it off, if pilots find it too much.

### Battery life off means no battery; brownouts on a full pack; the water tower; clickable K.W.A.D. tricks
- **Battery** (mistawintaz: "on the mob 7 75mm, I was getting brown outs from just pushing the throttle to 100"; owner: "ensure battery
  sim is removed, as well as the UI elements when disabled"). Found: the brownout check ran even with battery life off, and the sag was
  unstable at full throttle (it was fed the current x the 2.4 drain factor, raw every step). **Decided / built**: off = a full pack that
  never sags, drains or browns out, and no battery on the OSD (RaceGOW shows only BUMP; B does nothing). On = the sag follows the motor
  model's own current, smoothed over 5 ms; no brownout on a full pack at full throttle on any preset tried.
- **Consequence**: with battery life off, full throttle no longer sags, so punch-outs are a little stronger than before for everyone.
- **Water tower** (owner: "invisible collision"): the tank's collider stuck out 1.6 m above the roof and under the floor; now it matches
  what is drawn.
- **K.W.A.D. tricks** (Toasty: click a trick in "Today's KWAD" for a definition or the Tricktionary): built on the pause menu and the daily
  board; the in-flight list stays as it is (it fades on its own and the mouse is not used while flying).
- **Open**: mistawintaz also asked (screenshot, not yet decided by the owner) to make the day's K.W.A.D. objects glow: he could not find
  the "Cable Tray" in the warehouse.

## 2026-11-25

### INVERTED: a 3D-mode-only trick (owner, 2026-11-25)
"I want to add in a 3d mode only trick, it's for time spent inverted, every 1 second spent inverted while 3d is called INVERTED, and
ticks 200 per second inverted without bumps or crash. no repeat penalty."
- **Built**: in 3D mode, every full second upside-down in the air scores 200, counting up in one combo entry, its own line on the score
  sheet like gaps (so no streak, no repeat or back-to-back penalty, and the TPW trick score is unchanged).
- **Claude's calls, say if wrong**: "inverted" = within about 45 deg of flat on its back; ANY touch ends the stretch, not only a hard
  bump (so sitting upside-down on the ground earns nothing); the seconds already scored are kept when it ends; the streak multiplier
  does not apply; it is not sent as a call for review (the tools would have nothing to re-fly it against).
- **Open**: should a long stretch pay more per second (it is flat 200 now)? Should the streak apply to it?

### Scoring follows the official rules text (owner, 2026-11-25: "1. yes. 2, 2x. 3. it should not. 4. sounds good! put that under training!")
- **Decided**: bring the six differences in line with the text. The streak cap is x2. A repeat that pays 0 % does not build the streak.
  A "How scoring works" page goes under Training.
- **Built**: streak grows by base value / 10000 up to x2; a bump (during a trick, just after it, or between tricks), a failed trick
  and a crash end it; a bumped trick also banks the combo; Trick of the Week 200 / 200 / 150 / 100 / 0 %. The page is in the game's
  own words, credited to Tyrantt, linking to his rules page.
- **Claude's calls, say if wrong**: back-to-back tricks DO build the streak (the text says base value; only the 0 % repeat was ruled
  out); a bumped trick is still paid at the streak it had; a knock "between tricks" waits 1.5 s so that taps, wall rides, slides,
  perches and wall sticks (tricks that are a touch) do not end the streak; soft touches (under the bump threshold) never do.
- **Left as it was**: the same-obstacle reduction and the obstacle-switch bonus from the spreadsheet (not in the pasted text).
- **Consequence**: board scores posted before today were made under the old rules; today's board mixes both until UTC midnight.
- **Not flown by hand**: the between-tricks bump was checked in the score keeper's tests and by loading the game, not by flying into things.

### The official scoring rules against the game's ScoreKeeper (owner, 2026-11-25; nothing changed yet)
The owner pasted the official Pro Whooper rules text (streak bonus, K.W.A.D., repeat reduction, back-to-back, subpar execution, bumps,
failing) and said Tyrantt agreed to the game using them. Compared with `ScoreKeeper` (built from the calculator spreadsheet):
- **Same**: K.W.A.D. 250 a letter + 2000; repeats 100 / 75 / 50 / 0 %; back-to-back halving, compounding; sloppy -35 %; a bump's 50 %;
  a failed trick scores nothing and does not count as a repeat.
- **Different**: (1) Trick of the Week: rules 200 / 200 / 150 / 100 / 0 %, game 200 / 150 / 100 / 0 (one 200 short). (2) Streak cap:
  rules "maxes out at 200 %", game has none. (3) A bump: rules end the streak (and the combo), game halves the streak bonus (the
  spreadsheet's way) and the combo runs on. (4) A bump between tricks: rules end the streak, game does nothing. (5) A failed trick:
  rules break the streak, game leaves it. (6) Streak growth: rules add the trick's BASE value / 10000, game adds the value after
  execution, repeat and back-to-back reductions (and nothing for a back-to-back or 0 % repeat).
- **In the game, not in the pasted text**: the same-obstacle reduction and the obstacle-switch bonus (from the spreadsheet); and our
  own extra lines (gaps, INFINITY LOOPS / BIG BEN, community tricks), kept apart from the trick score.
- **Open (owner)**: bring the six in line with the text (it changes board scores from that day)? Is the cap +200 % (x3) or x2? Does a
  0 % repeat still build the streak? Also show the rules text in the game (a "How scoring works" page, credited)?

### Tyrantt's blessing, and links to prowhooper.com (owner, 2026-11-25)
Tyrantt (Discord, today): "totally cool with the idea, especially since it's free for everyone". For credit he suggested a link in the
menu to the Tricktionary, and offered to tag the tricks the game uses on his site, linking to a page of the tricks available in the game.
**Built**: a credit line with the link on the main menu; in the Tricktionary a link in the note, on each category heading, and
"↗ prowhooper.com" by every trick that is on the site (93 of 105; our own extras have none).
**Done the same day**: every trick links to its own page (all 93 addresses read from the site's All Tricks page; the names match
the game's one for one). **Open**: (2) Tyrantt's side: a page on our end that
lists every trick the game detects, for his tags to link to (the Tricktionary screen has no address of its own yet: a
`#tricks` / `#trick=<name>` link into the game would do it).

### Review queue: say who labelled what; a search box in the Tricktionary
The owner, looking at a queue row ("the game was very unsure (35 %); 2 other pilots have labelled Double Rolling Trippy Spin"): "can we
make it so that we can see what other people have labelled the trick as? the text is confusing, cos i know that person didn't label it".
The line meant "two other pilots have labelled that trick somewhere, on other flights" (the reason the row ranks higher), not at this
moment. **Decided / built**: every queue row now says what the game called, what was labelled AT that moment and by whom
("labelled here: RodFPV: Trippy Spin", or "nobody has labelled this moment yet"), and the ranking note reads "N other pilots have
labelled this trick on other flights" (`saidAt` / `hereTxt` in `deskQueue`, dropoff.js; `q.said`, `q.isVote`). Votes read "counts in
full once three people agree" (the rule since 2026-11-20; the row still said "a second pilot").
"can we make the tricktionary searchable? just a lil search box in the corner that narrows down as you type": **built** (`#tSearch`,
`trickFilter` in menus.js): matches name, category or difficulty, every word typed; empty categories hide; Esc clears.
**Open**: showing the other pilots' labels inside the review player itself (on the timeline) for moments the game DID call; today
only moments with no game call show them there ("PILOTS SAY").

### Double Rolling Trippy Spin: the owner's video against the rule (2026-11-25; nothing changed)
The owner sent a 14 s FPV clip of his own a Double Rolling Trippy Spin round a big conifer, camera at 30 deg: "see how it rolls while
within a trippy spin while still keeping the object at the top of the screen?" Measured from the video (tools/gif_rotation.py, 30 fps,
the 4:3 picture, 150 deg lens assumed): the camera looks up the trunk the whole time and the picture turns round the view of the tree
steadily one way, ~3180 deg in 13.8 s (~8.8 turns, ~230 deg/s, no pauses); all axes together ~265 deg/s, close to the Tricktionary demo
(~1540 deg in ~5.5 s). The ground shows only about three times (the start, ~3.5-4 s, ~9.6-10.2 s). Orbit laps cannot be counted from
the camera alone (the clip has no position).
- **The game's rule** (`orbitKind` in sim.js): a trippy round a pole whose body roll is 300 deg or more a lap AND that passes upright <->
  upside-down at least 0.75 times a lap ("barrel-rolls through upright every lap"). His flight rolls round the line to the tree, which
  barely brings the quad upright (3 times in 14 s), so the game would most likely call it a plain Trippy Spin.
- **The game's DRT calls in the shared data**: of 9 decided labels, 2 confirm a call; the owner rejected 5 calls on 2026-11-24/25 (they
  were a Split S, a Flip, a Matty Flip and two non-tricks): the "through upright" test catches other tricks that flip over near a pole.
- **Proposed (not built, the owner's call)**: read DRT as a trippy (pose, object at the top) whose picture spins round the line to the
  object faster than the orbit alone would turn it: extra turn about that line per lap, measured from attitude and position, with no
  need to pass upright. Open: how much extra counts ("double": one extra turn a lap?), and a sim flight or Blackbox log of it to set it.

### Double Rolling Trippy Spin: built (owner, 2026-11-25: "Do it up!")
- **Built**: DRT = a trippy whose body roll is at least 1.8x its sweep round the pole; no upright test. The lap is kept alive while
  rolling (longer before "stopped", up to 150 deg back). A trippy that turns into rolling is banked as a Trippy Spin and the rolling
  is called on its own, even when it barely goes round; its laps then count its rolling at two rolls a lap.
- **Result on his run**: the 10 s DRT and the trippy-then-DRT are called right, the Flip near the Cedar is no longer a DRT, the plain
  trippies stay Trippy Spins, the false Roll inside the DRT is gone. Over all 30 shared flights with trippy labels: DRT 1 -> 3 of 7,
  rejected DRT calls 2 -> 0, Trippy Spin 31 -> 32 of 34. Not caught: his two short ones that ended in a bump / crash.
- **Open**: 1.8x is set from one pilot; the laps of a rolling-in-place DRT (roll / 2) are a guess at "double". Watch other pilots' calls.

### Double Rolling Trippy Spin: the owner's labelled run (2026-11-25; nothing changed yet)
The owner flew a run on Moose (camera 30 deg) and labelled 4 Double Rolling Trippy Spins (two with bumps, one a crash) next to 3 plain
Trippy Spins, round the Hemlock and Cedar by the playground. Re-flown through the detector (the orbit state of the pole, every 0.5 s):
- **Body roll per degree of orbit separates them**: plain trippies 0.6-0.9 (about one roll a lap, which any trippy has); the labelled
  DRTs 2.6-3.4 (the rolling outruns the orbit about three times). One DRT stretch rolled ~195 deg while the orbit moved 26 deg.
- **The quad never goes upside-down in a DRT** (up.y stays above -0.11), so the rule's "passes upright <-> inverted every lap" never
  fires: the game called them Trippy Spin, Roll, Stall 360 Rewind, Half Matty. The one DRT the game called in this run was on a Flip.
- **The orbit tracker loses the lap while the quad rolls**: the swept angle resets (or jumps to the Cedar next door) every 2-3 s inside a
  DRT, so laps there come out short.
- Agrees with the video measured the same morning: the rolling is round the line to the tree, not a barrel roll through upright.
- **Proposed**: DRT = a trippy (pose, wonky nips) round a pole with body roll at least ~2x the orbit's sweep, no upright test; keep
  the orbit alive through the rolling (do not reset it while the pole stays the one in view). The owner's call.

### RaceGOW track cards: fewer buttons (owner, 2026-11-25)
"Can we remove Race/Edit/Copy Code/Export from the layout menu in racegow?", then, asked whether Race should go too: "Keep race, remove
edit." **Done**: the track cards show Race, Leaderboard, Share and Delete (Save a copy on other pilots' tracks). Edit, Copy code and
Export are gone from the cards; the editor itself and its own export are unchanged. **Open**: with Edit gone a built-in track can only
be changed from inside the editor (New track, or a track already open there): say if a track should open in the editor some other way.

### RaceGOW: the importer and routes as steps (owner, 2026-11-25: "24 inches. Correct, that's fine. Yup, full credit. Let's do 1 and 2.")
- **Decided**: every layout is in 24 in sections (the file's 30 in mark on four RaceGOW 6 tracks is wrong); the 21 laps the owner has not
  clicked through ship as the file has them; designers are credited by name on the track.
- **Built**: all 25 are built-in tracks (26 with Track 8), each in an empty room sized round it. A route is now a list of passes: the
  same opening can be in a lap any number of times, and either way; an opening can be several rectangles (an L round a frame). The
  editor's route list works per pass (other way, again, take out, up, down).
- **How it was checked**: each of the 25 is flown pass by pass by a test that works out where every pass is from the file by its own
  arithmetic; pipes are checked against the file end by end; the track list and the editor's route list were tried in a browser. Not
  raced by hand.
- **Open**: the picker's tools in the editor (3), the flight lines (4), design norms (5). The track cards still say "gates" for passes.
  Track 8's ids are random per pilot, so its board key differs between pilots (the 25 do not have this): fix when boards matter.

### RaceGOW: what the 25 real layouts and the Route Picker teach (owner asked, 2026-11-25; nothing built)
The owner sent a file of 25 real RaceGOW layouts (RaceGOW 1 #1-10, 2 #1-4 and #6, 3 #1-5, 6 #1-5: pipes on a section grid, the lap as
ordered passes, a flight line for the older ones) and the Route Picker page he used to correct laps by clicking openings.
- **Measured**: 502 passes over 426 different openings; 9-31 passes a lap (about 20); about 20 sections of pipe a track; footprints up
  to 4 x 3 sections, mostly 2-3 tall. A third of the passes are above the first row; 74 are bigger than one square; 10 are shaped
  (6 of them L-shapes round a frame); 51 openings are flown both ways in one lap; 76 passes re-use an opening.
- **What the game's mode cannot do today**: a route lists each element once, so an opening flown twice needs a duplicate checkpoint
  (the Track 8 sample does that by hand); checkpoints are one rectangle (the race code already takes several polygons, the editor
  cannot make them); a lap is built by placing checkpoint blocks, not by clicking the openings the pipes make; one sample track.
- **Proposed, in order**: (1) an importer from this format, all 25 as built-in tracks; (2) routes as steps (opening + way), repeats
  allowed; (3) the picker's Pipes / Lap / Squares modes inside the track editor; (4) the flight lines as the racing line (guide,
  ghost, a check on the lap-time estimate); (5) design norms from the 25 for "Make raceable" and a random-track maker.
- **Open (owner)**: which to build first; the file says 24 in sections overall but 30 in on four RaceGOW 6 tracks: which is right;
  only the four RaceGOW 6 laps in the picker are hand-checked, the other 21 need his eye; whether the designers' names may be shown.

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

### Owner's answers on the trippy questions, and the Training menu (2026-11-23)
- **"A one lap trippy counts."** It already does: one whole lap scores half the two-lap points. Nothing changed. A part lap (the one
  confirmed label of 239 deg) still does not count: the owner said one lap.
- **The building-corner climb "is its own trick."** Built as **Corner Climb** (draft, 300 points: name and points are placeholders for
  the owner): three swings round an upright corner of a wall or building in the trippy's look, each way in turn, never a whole lap,
  climbing a metre. Written from the video's description; there is no labelled flight of one yet, so the numbers (3 swings, 45 deg,
  1 m) are first guesses. Open: its real name and points; whether a climb is required or swinging at one height counts; a Train stage
  for it on the Dive Tower.
- **"Move the Tricktionary and trick challenges under a nested training menu option."** Done: main menu → Training ▸ holds both, like
  Settings ▸. Open: whether Pilot Warm-up belongs there too (it is under Tools & labs today).
- **"An eject roll has to be through a horizontal gap."** Built: Eject Roll (and Stellar Eject Roll, which starts with one) is only
  called when the climb goes through a gap whose opening lies flat (a skylight, a hole in a deck). **Assumed**: "horizontal gap" = an
  opening that lies flat, flown up through; if the owner meant a gap that is wider than it is tall, the check is one line to change.
  **Consequence, open**: only More Warehouse and Ship Drugs have such gaps today; the other maps and the Training Room need one (a hatch
  frame in each Trick Park) before the trick can be flown or trained there.
- **"Ensure the Mavvelmann meets this description"** (the book's text). The rule had the rotations and the under-then-over but not the
  rest; added: upright and forward-looking from the under pass to the flick, over the top travelling backward, the flick while above
  the object and quick (0.8 s at most), upside-down after it, the roll within 0.7 s, level at the end. The times are first guesses.

### Audit of every prowhooper.com trick page against the game (owner asked, 2026-11-23)
All 93 pages read (as close paraphrases, not verbatim) and compared with the rule tables. The report is a Claude Doc:
https://claude.ai/artifact/RtyBUdYHF5FcxfpPE5wacs. Nothing was changed from it. **Open, the owner's calls:**
- **Eject Roll**: the site's text has no gap (climb in front of an object; Outdoors 200, Cube 575, Dive Gate 500); today's rule
  requires a horizontal gap, so the game is stricter than the site.
- **Inverted Yaw Tracking**: the site ends with a 180 pitch down; the game's rule and text end with a 180 roll.
- **Barani -> Power Swap**: the site downgrades a Barani whose yaw starts before the horizon (indoors: the back wall) is in view.
- **Trippy Switch**: the site wants a full orbit each way; the game calls it at half a lap the second way.
- **Ninja Star** (site: gap 2-3 whoops; game: any gap), **Knife Edge** (site 2-4; game 2.75), **Segmented** (site: 0.5 s stall; game
  0.18 s from the demo), **Building Dive** (site: at a building; game: also open air), **Beginner Matty** (site: three passes; game
  also two), **Cinnamon Roll** (site: object in view all the way; game: no view check).
- **Missing tricks**: Inverted Uh-uh (125), Loop to Matty (cube only, 550), Gaps by size (150 / 125 / 100; the game's gap points are
  25-75), Indoor Rubik's Cube.
- **Points**: Barani 750 (game 700), Cubik's Rube 350 (325), Beginner Matty 125 (100); Trippy Spin and Trippy Switch are
  Intermediate on the site (Advanced in the game). The site also scores by object (Under/Over, gate, cube, dive gate, triple stack,
  indoors); the game uses the outdoor value everywhere.
- **Names**: 14 differ (Immelmann, Inverted Rewind, Splitback, Stall Flip Rewind and the other stall rewinds, Building Dive, Face
  Punch, Blind Loop, Orbits, Trippy Spin).

### Decisions from the audit, and Rollback (owner, 2026-11-23)
- **"Update eject rolls, so that they can be performed without a gate. A Cube Eject is an Eject Roll out of a square gap."** Done: Eject
  Roll and Stellar Eject Roll need no gap; Cube Eject is new (575 points, the site's Cube value; placeholder).
- **"Update the 10 differing rules"**, then row by row: "a trippy switch should require a full lap … add the downgrade … ninja star
  should also be tight gaps … widen to 4 … open air dive counts … the climb over back is not required … add an in view check". Done:
  Trippy Switch (a whole lap back), Barani (an early yaw is a Power Swap), Ninja Star (gaps up to 3 whoops), Knife Edge (up to 4),
  Cinnamon Roll (the object in view), Inverted Yaw Tracking (pitch-down exit), Stellar Eject Roll (no gap). **Kept as they were, by
  the owner's word**: an open-air dive counts as a Building Dive; a Beginner Matty needs no climb back over. **Segmented Flips/Rolls was left**: the site's
  text says a 0.5 s stall, its own demo shows 0.23-0.27 s, and the standing rule is that the demos define the tricks; raising it to 0.5 s
  would also stop calling the demo itself. Open: the owner says if he wants the text's 0.5 s anyway.
- **"Add the three tricks (come up with a scoring system for how big the gap is)."** Inverted Uh-uh (125), Loop to Matty (550, on the
  new Cube in every Trick Park), Gaps. Gap scoring: 150 through 6 in or less, 25 less for each 6 in more (so the site's 125 at 12 in and
  100 at 18 in), never under 25. The site's points: Barani 750, Cubik's Rube 350, Beginner Matty 125.
- **"Update the names to match."** The 14 names are the site's; old data is read through an alias. Docs older than today keep the old
  names. Open: the Tricktionary lists the site's three stick-on "x2" tricks without the "x2" (laps show as "×2" in the call-out).
- **"Rod labelled some tricks as rollbacks … make sure our understanding of rollback is based on these attempts."** Rollback and Juicy
  Rollback are written from his 9 labels (what was measured is in CLAUDE.md); all 9 are now called by the name he gave. 300 / 350
  points are placeholders. Open: points; whether another pilot flies them the same way.
- **Consequences to know**: a Snapback or Juicy Flick made right after passing under something waits a moment longer only when the
  quad is already coming back toward the object (it may be a Rollback). On a sample of 60 other shared flights the new rule called 6
  Rollbacks and 4 Juicy Rollbacks nobody has labelled: worth a look in review.

### Matty Twister tightened to the description (owner, 2026-11-24)
- **Reported**: "i was just awarded a matty twister, despite not trying and not being over an object."
- **Decided**: it must match the book: over the object, the 360 roll while over it, the Matty flip at once, out under the object.
- **Built**: the roll has to start within about a second of the over pass and above the object's top, the flip within half a second
  of the roll, the pass under within 2.5 s. Before, any roll and flip near an over-then-under of one object counted.
- **Open**: which object gave it to him (the flight is not in the shared data). If it was a power line or a roof edge high above, say so:
  those are over/unders the Surveyor makes, and other tricks could be given on them the same way.

### Burrito Roll against the site's description (2026-11-23, open)
The owner asked whether the game's Burrito Roll matches prowhooper.com ("begin with one Jump Rope, then, as you initiate … another
Jump Rope, but before you cross over the object, do a roll in the opposite direction and rewind back down the same side and finish
by going under"). It matches the roll-and-rewind half; it does not require the opening Jump Rope, and "opposite" is only checked
against another roll. He said yes to requiring the Jump Rope first.
- **Not changed yet.** Re-flown, only 1 of the 3 confirmed Burrito Roll labels has a jump rope over the same object before the
  roll. The other two (the owner's on the playground's Sign Gantry, and one on Clappy's Footbridge) go under, roll, and come back
  under with no pass over that object at all. Requiring the Jump Rope would lose two confirmed labels to drop four rejected ones.
  Claude had said both of the owner's would be kept; that was read off pass strings without checking which object, and was wrong.
- **Open, the owner's call**: (a) the book's rule, and the two confirmed labels become "not a Burrito Roll"; (b) keep today's rule;
  (c) keep both, with the no-jump-rope version under another name or as a variant.
- **Decided (owner, same day: "#1")**: go by the book. A Burrito Roll needs the Jump Rope first (over the object sideways and upright,
  back under, within 4 s before the roll) and the roll must go against the way the jump rope went round the object. Of the three
  confirmed labels, the Swing Set one is still called; the Sign Gantry and Footbridge ones (under, roll, under) are no longer Burrito
  Rolls and are called nothing. A Double Dutch now needs a pass over the object too (without it the Footbridge one fell through to
  Double Dutch). **Decided (owner, same day)**: the under-roll-under move gets no name: "it's just a roll through a gap". It scores
  as whatever it is: a Roll if the roll is a full one, plus gap points if it went through a gap.

### Quick check: the "No, it was…" list looked as if it lost the choice (owner, 2026-11-23)
The owner: "whenever i press to select another trick in the trick review, it won't let me select it or keep the option." The answer
was being kept (the line above the buttons said so) but the list snapped back to "No, it was…". Now the list keeps showing what was
picked. Open: if it still fails for him after this, it is something else (it could not be reproduced as a lost answer here).

