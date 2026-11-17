# Blackbox logs

Uploaded from the game's **Blackbox Lab** (Options → "Upload Blackbox logs to GitHub", off by default).

```
blackbox/<date>-<craft>/<date>-<craft>.bbl   # raw Betaflight onboard-flash dump (or files the pilot picked)
blackbox/<date>-<craft>/diff-all.txt          # Betaflight `diff all`
blackbox/<date>-<craft>/build.json            # FC info, the game's craft/tune, optional pilot build sheet
```

`build.json` → `buildSheet` (optional): model, frame, motors, props, prop condition, battery, connector, all-up weight (g),
camera + angle, AIO, where flown, mods, and free-text notes on how the sim felt compared with the real quad.
Decode `.bbl` with Betaflight's `blackbox_decode` to CSV. See `CLAUDE.md` for the tuning workflow.
