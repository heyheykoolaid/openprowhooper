# The learned witness

2026-11-21 11:16 UTC · trained on 451 confirmed examples of 30 tricks (4+ examples each) from the trick library, each with 6-12 noisy copies · tested on 112 calls pilots rejected.

| test | names the trick (top-1) | tells a confirmed call from a rejected one (AUC; 0.5 = a coin, 1 = perfect) |
|---|---|---|
| every pilot in training (5 folds) | 63 % of 451 | 0.80 |
| a pilot it never saw | 52 % of 423 | 0.70 |

As a doubt: a call the witness gives under 10 % is 64 % of the rejected calls and 20 % of the confirmed ones.

It votes in the Watcher (`votes.learned`, weight 1; the library 2) on the tricks marked below (8+ confirmed examples, 70 % of them found), never vetoes and never names a trick.

| trick | confirmed examples | rejected calls | found (5 folds) | votes |
|---|---|---|---|---|
| Roll | 96 | 8 | 90 % | yes |
| Flip | 44 | 15 | 86 % | yes |
| Matty Flip | 39 | 10 | 74 % | yes |
| Split-S | 37 | 3 | 95 % | yes |
| Trippy Spin x2 | 27 | 3 | 100 % | yes |
| Yaw Spin | 19 | 7 | 84 % | yes |
| Inverted Yaw Spin | 18 | 1 | 100 % | yes |
| Powerloop | 15 | 15 | 80 % | yes |
| Half Matty | 14 | 4 | 79 % | yes |
| Barani | 13 | 2 | 69 % | not yet |
| 540 Split S | 12 | 0 | 92 % | yes |
| Power Flip | 12 | 0 | 92 % | yes |
| Juicy Flick | 10 | 3 | 60 % | not yet |
| Double Dutch | 9 | 11 | 56 % | not yet |
| Dive | 8 | 6 | 88 % | yes |
| Mavvelmann | 8 | 3 | 50 % | not yet |
| Rubik's Cube | 8 | 2 | 75 % | yes |
| Invert Rewind | 7 | 3 | 43 % | not yet |
| Wall Tap | 7 | 2 | 43 % | not yet |
| Cradle | 5 | 1 | 80 % | not yet |
| Donkey Loop | 5 | 0 | 80 % | not yet |
| Power Switch | 5 | 0 | 60 % | not yet |
| Side Loop | 5 | 0 | 40 % | not yet |
| 540 Half Matty | 4 | 1 | 0 % | not yet |
| Ceiling Tap | 4 | 0 | 75 % | not yet |
| Jump Rope | 4 | 5 | 50 % | not yet |
| Mavani | 4 | 1 | 25 % | not yet |
| Orbit x2 | 4 | 4 | 50 % | not yet |
| Segmented Flips/Rolls | 4 | 2 | 50 % | not yet |
| Whiplash | 4 | 0 | 50 % | not yet |
