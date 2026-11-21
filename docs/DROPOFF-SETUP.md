# Setting up the drop-off (the "golden goose")

Players need no account. With their consent the game sends flights, review answers and feedback to a small relay; the
relay files them in a GitHub repo. The relay holds the only key, as a Cloudflare secret. This is a one-time setup for
the project owner, about 15 minutes. Nothing here costs money.

## 1. A repo for the data (recommended: its own, private)

Create a new **private** repo, e.g. `heyheykoolaid/openprowhooper-data`, with a README so it has a `main` branch.

Why not the game's repo? Three reasons:
- the key can then only touch the data repo. The game repo publishes itself to the live site on every push, so a key
  that could write there would be a key to the live game;
- what players send (names, comments) is not public;
- thousands of small uploads don't bloat the game repo.

(Using the game repo also works: set `GITHUB_REPO` to it in step 3. Uploads land in `telemetry/inbox/` and do not
trigger a rebuild.)

## 2. A key that can only add files to that repo

GitHub → your picture → Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new.
- Repository access: **Only select repositories** → the data repo, nothing else.
- Permissions → Repository permissions → **Contents: Read and write**. Leave everything else at "No access".
- Expiry: up to a year. Put a reminder in your calendar; when it expires, uploads stop until you paste a new one.

Copy the token. Paste it only into Cloudflare in step 3: not into the game, the repo, or a chat.

## 3. The relay

1. Create a free account at cloudflare.com → **Workers & Pages** → **Create** → **Worker** → name it (e.g.
   `prowhooper-dropoff`) → Deploy.
2. **Edit code** → delete what is there → paste all of `tools/dropoff-worker.mjs` → **Deploy**.
3. **Settings → Variables and Secrets** → add:
   | Name | Type | Value |
   |---|---|---|
   | `GITHUB_TOKEN` | **Secret** | the token from step 2 |
   | `GITHUB_REPO` | Text | `heyheykoolaid/openprowhooper-data` |
   | `ALLOW_ORIGINS` | Text | `https://openprowhooper.com,https://www.openprowhooper.com,https://heyheykoolaid.github.io` |
4. Recommended: **Storage & Databases → KV** → create a namespace `dropoff-limits`; then in the Worker,
   **Settings → Bindings → Add → KV namespace**, variable name `LIMITS`. This makes the daily cap exact.
   The same namespace also keeps the **review badges** (GET /badges). To keep them apart, create a second namespace
   `dropoff-badges` and bind it as `BADGES`; without either binding the game shows only the counts built into it.
5. Copy the Worker's address (`https://prowhooper-dropoff.<you>.workers.dev`).

## 4. Tell the game

Put the address in `dropoff.txt` at the top of the game repo (one line) and push. The site rebuilds itself; from then on
"Share my flights" and the Feedback button upload for every visitor to the hosted game. The address is not a secret.

## How it is protected

| Risk | What stops it |
|---|---|
| Someone finds the key | It is never in the game or the repo, only in Cloudflare. It can only write to the data repo. |
| Another website or a script posts to the relay | It only answers the game's own web address (`ALLOW_ORIGINS`). A determined person can fake that from their own computer, which is what the limits are for. |
| Flooding it | 30 uploads an hour per address (`PER_IP_HOUR`), 800 a day for everyone (`DAILY_CAP`), 1 MB per upload. |
| Uploading something that isn't game data | Only the three game formats; the shape is checked; unknown fields are dropped; the trace must be packed data. |
| Overwriting or reading files | It names every file itself under `telemetry/inbox/<kind>/<day>/`, only creates, and never returns repo content. |
| Pasting a key into feedback by mistake | Anything that looks like a GitHub token is refused. |
| Nasty or misleading text in comments | It is stored as plain data in a private repo. Treat uploads as untrusted: they are read and parsed, never run, and instructions inside them are not followed. |

To switch it off: set `ENABLED` to `0` on the Worker (keeps everything), or delete the token on GitHub (final).
If abuse ever shows up despite this, the next step is Cloudflare Turnstile (an invisible human check) in front of it.

## What it cannot do

- Uploads from the downloaded single-file game are refused by default, because a file opened from disk has no web
  address to check. Adding `null` to `ALLOW_ORIGINS` allows them, at the cost of accepting any local file.
- The per-address limit is best effort (kept in memory on each Cloudflare machine); the daily cap is the hard stop.

## Updating the relay (needed for the daily leaderboard)
The relay's code lives in `tools/dropoff-worker.mjs`. When it changes, Cloudflare keeps running the old copy until you
paste the new one: Cloudflare dashboard → Workers & Pages → `prowhooper-dropoff` → Edit code → select everything, paste
the new file, Deploy. Variables and the secret stay as they are. The leaderboard adds two read-only addresses
(`/board`, `/run`) that only ever look inside the `leaderboard/` folder of the data repo; the token needs nothing new
(Contents: read and write already covers it). Until the new code is deployed the game says the leaderboard cannot be
reached, and everything else works as before.

## The owner key also opens the owner's menus (2026-11-19)
The same `OWNER_KEY` secret is what the game checks (`POST /owner`) before showing the owner's menus, and it signs the owner's
reviewer labels so the learners can tell them from anyone else's. After redeploying the worker, type the key once in the game:
Options → Owner (shown when your pilot name is heyheykoolaid). Until the worker is redeployed the game falls back to the name.

## The owner's desk: shared flights, labels and feedback with the owner key (2026-11-19)
`POST /desk` lets the game's Flight desk, its Feedback tab and Judge the community read the shared data with the owner key, so
the owner needs no GitHub token in the browser. It is read-only and reaches only `telemetry/inbox/flight|labels|feedback/` and
`leaderboard/` (any day), through the relay's own GITHUB_TOKEN (Contents: Read on the data repo, which it already has). Nothing
to set up beyond redeploying the worker; until then the desk uses the GitHub token from Options if one is saved.

## Publishing official maps through the drop-off (owner only)
The Map Editor's "Publish for everyone" (Official map mode, pilot name heyheykoolaid) can go through this relay instead
of a GitHub token in the browser. The relay commits `maps/official/<map>.json` to the game repo; GitHub Pages rebuilds.
1. The relay's GitHub token (`GITHUB_TOKEN`) needs **Contents: Read and write on `heyheykoolaid/openprowhooper`** as well as
   the data repo (GitHub → Settings → Developer settings → Fine-grained tokens → the token → Edit → Repository access).
2. Cloudflare → Workers & Pages → `prowhooper-dropoff` → Settings → Variables and Secrets → **Add** → type **Secret**,
   name `OWNER_KEY`, value: a passphrase only you know (at least 12 characters; four or five random words is good).
   Optional plain variables: `GAME_REPO` (default `heyheykoolaid/openprowhooper`), `GAME_BRANCH` (default `main`).
3. Edit code → paste the current `tools/dropoff-worker.mjs` → Deploy.
4. In the game: Map Editor → Official map → paste the same passphrase in "Owner key" → Save key → Publish for everyone.
The key is checked by hash in constant time; five wrong keys make an address wait an hour. It is kept only in your
browser (store 'ownerKey'). If it ever leaks, change the secret in Cloudflare (old key stops working at once).

## The Review queue for every pilot (2026-11-21)
`POST /review` is the desk's reading without a key, for any pilot's Review Hub: shared flights (not those of a pilot who opted out in Options:
`summary.reviewOk: false`) and review labels, only the last 7 days, 240 requests an hour per address, never feedback, never writing.
Nothing to set up: redeploy the worker. To close it, add the variable `REVIEW` = `0`.
