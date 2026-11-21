# Feel test card: one pack, about 70 seconds

A short flight that gives the Feel Lab everything it can measure from a Blackbox log. Freestyle logs are fine for lag and wobble,
but they never hold still long enough for hover, motor steps, drag or a clean step response. Fly this once per quad (and again
after a change of motors, props, frame or tune).

## Before
- Blackbox on, 1 kHz or faster, logging from arm. A fresh, full pack. Indoors or a windless spot, 3 m of height if you can.
- Weigh the quad with the pack on (all-up weight, to 0.1 g). Note motors, props (and how worn), pack, frame.
- Save `diff all` from the Betaflight CLI.

## The flight (say each step out loud if you record DVR: it makes the log easy to read)
| # | What | How | It measures |
|---|---|---|---|
| 1 | **Hover** | Still, chest height, hands as quiet as you can, 10 s | hover throttle, wobble, noise |
| 2 | **Throttle blips** | From the hover: punch to about ¾ for half a second, back to hover, wait 2 s. Five times | motor step time, thrust |
| 3 | **Chops** | Climb to ~3 m, throttle to zero for half a second, catch it. Three times | fall, prop wash on the catch |
| 4 | **Roll snaps** | Full stick left, hold a third of a second, let go. Then right. Five each, a second apart | step response, top rate |
| 5 | **Pitch snaps** | The same, forward and back | step response, top rate |
| 6 | **Yaw snaps** | Full yaw left for a second, stop, right for a second. Three each | yaw response |
| 7 | **Coast** | Fly a straight line as fast as the room lets you, then level off and let it coast to a stop at the same height, no braking. Three times. Along a wall of known length, on DVR, is best | drag |
| 8 | **Punch-out** | Full throttle straight up for a second (outdoors or a high ceiling), then come down through your own wash | top thrust, wash bobbing |
| 9 | Land, disarm | | |

## After
- Pack voltage after a minute's rest, and the mAh your charger puts back, if it shows it.
- Send the `.bbl`, the `diff all`, the build sheet with the weight, and a line on how the sim's version of this quad feels next
  to the real one. They go in `blackbox/<date>-<craft>/`.

## Reading it
`node tools/feelfit.js blackbox/<folder>` (or the game's Feel Lab): hover, motor dead time and step, per-axis lag and tracking,
the **average step response** (ms to half way and to 90 %, overshoot, where it settles), unasked wobble, and suggestions.
