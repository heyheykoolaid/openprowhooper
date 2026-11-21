# The learned witness

2026-11-21 13:14 UTC · trained on 877 confirmed examples of 47 tricks (4+ examples each) from the game's own call windows (pilots' confirmed calls, the bot, label spans where it made no call) and the demo GIFs, each with 6-12 noisy copies · tested on 53 calls pilots rejected.

| test | names the trick (top-1) | tells a confirmed call from a rejected one (AUC; 0.5 = a coin, 1 = perfect) |
|---|---|---|
| every pilot in training (5 folds) | 78 % of 877 | 0.75 |
| a pilot it never saw | 57 % of 427 | 0.70 |

As a doubt: a call the witness gives under 10 % is 36 % of the rejected calls and 10 % of the confirmed ones.

It votes in the Watcher (`votes.learned`, weight 1; the library 2) on the tricks marked below (8+ confirmed examples, 70 % of them found), never vetoes and never names a trick.

| trick | confirmed examples | rejected calls | found (5 folds) | votes |
|---|---|---|---|---|
| Roll | 105 | 5 | 87 % | yes |
| Flip | 55 | 12 | 89 % | yes |
| Split-S | 52 | 0 | 98 % | yes |
| Matty Flip | 50 | 1 | 78 % | yes |
| Powerloop | 34 | 6 | 85 % | yes |
| Yaw Spin | 31 | 2 | 90 % | yes |
| Inverted Yaw Spin | 28 | 0 | 96 % | yes |
| Barani | 25 | 0 | 84 % | yes |
| Trippy Spin x2 | 23 | 0 | 100 % | yes |
| Juicy Flick | 22 | 1 | 82 % | yes |
| Power Flip | 22 | 0 | 95 % | yes |
| 540 Split S | 20 | 0 | 85 % | yes |
| Rubik's Cube | 20 | 2 | 90 % | yes |
| Invert Rewind | 19 | 3 | 84 % | yes |
| Cradle | 17 | 0 | 94 % | yes |
| Double Roll | 16 | 0 | 100 % | yes |
| Segmented Flips/Rolls | 16 | 1 | 88 % | yes |
| Blindflip | 15 | 0 | 93 % | yes |
| Immelmann Turn | 15 | 0 | 87 % | yes |
| Inverted 360 Powerloop | 15 | 0 | 93 % | yes |
| Mavvy Roll | 15 | 2 | 80 % | yes |
| Whiplash | 15 | 0 | 80 % | yes |
| Double Flip | 14 | 1 | 86 % | yes |
| Matty Twister | 14 | 0 | 86 % | yes |
| Maverick Loop | 14 | 4 | 93 % | yes |
| Power Roll | 14 | 0 | 93 % | yes |
| Split-Back | 14 | 0 | 93 % | yes |
| Vanny Roll | 14 | 1 | 93 % | yes |
| Cubik's Rube | 13 | 0 | 100 % | yes |
| Half Matty | 13 | 1 | 62 % | not yet |
| Juicy Tornado | 13 | 0 | 100 % | yes |
| Reversed Power Flip | 13 | 0 | 100 % | yes |
| Side-Lock Rewind | 13 | 0 | 92 % | yes |
| Snapback | 13 | 0 | 92 % | yes |
| Anti Matty | 12 | 0 | 100 % | yes |
| Matty 360 | 12 | 0 | 100 % | yes |
| Mavvelmann | 10 | 3 | 100 % | yes |
| Dive | 8 | 0 | 62 % | not yet |
| Double Dutch | 6 | 6 | 17 % | not yet |
| Wall Tap | 6 | 1 | 0 % | not yet |
| Donkey Loop | 5 | 0 | 80 % | not yet |
| Power Switch | 5 | 0 | 80 % | not yet |
| Side Loop | 5 | 0 | 40 % | not yet |
| 540 Half Matty | 4 | 0 | 0 % | not yet |
| Jump Rope | 4 | 0 | 50 % | not yet |
| Mavani | 4 | 1 | 50 % | not yet |
| Orbit x2 | 4 | 0 | 50 % | not yet |
