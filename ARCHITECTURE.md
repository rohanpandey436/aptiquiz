# AptiQuiz architecture

AptiQuiz is a real-time multiplayer aptitude quiz for up to 50 players per room. This document explains how it is built, why each choice was made, and where the fairness and anti-cheat guarantees come from.

## The one-line version

One Node.js process is the referee. It owns the clock, the question order, every player's option shuffle, every answer timestamp and every score. Browsers only render state and send intentions ("I pick position 2"). Nothing a browser says is trusted.

## Components

```
                         HTTPS / WSS (Render)
   Phone (player) ----\                         +----------------------------+
   Phone (player) -----+---- Socket.IO ---------|  server/index.js           |
   Laptop (host) -----/      (one room per      |   Express + Socket.IO       |
                              game code)        |                            |
   Any browser ------------- REST /api ---------|  routes.js   sockets.js    |
     (league, question                          |      \          /          |
      editor, join page)                        |       store.js  game.js    |
                                                |        |          |        |
                                                |   data/*.json   in-memory  |
                                                |   (sets, games)  rooms     |
                                                +----------------------------+
```

| Layer | File | Responsibility |
|---|---|---|
| Bootstrap | `server/index.js` | Creates the HTTP server, Socket.IO server, security headers, static serving of the built client, SPA fallback. |
| Game engine | `server/game.js` | `GameManager`: rooms, players, question lifecycle, timing, scoring, auto-advance, ranks, reports. It owns all game state and decides what every screen receives; it emits through the injected Socket.IO server rather than knowing about HTTP or payload parsing. |
| Transport | `server/sockets.js` | Maps Socket.IO events to engine calls. Validates every payload, rate-limits every socket, measures round-trip time. Roles: host, player, spectator (read-only projector view). |
| REST | `server/routes.js` | Health, question sets (read, create, edit, duplicate, delete), league, public room lookup. A set that is in play is served without its answer key; in faculty mode the passcode guards every call that exposes answers. |
| Persistence | `server/store.js` | JSON files for question sets and finished games, written atomically. Seeds the built-in sets on first start. |
| Validation | `server/validate.js` | Sanitizers for names, codes, tokens, integers, question sets, plus a token-bucket rate limiter. |
| Access | `server/auth.js` | Optional editor passcode (faculty mode) with digest comparison and a per-address limit on wrong attempts. |
| Seed data | `server/seed/questions.js` | 54 verified questions across quantitative, logical, verbal and data interpretation, grouped into six sets. |
| Client | `client/src` | React + Vite + Tailwind. Pages: Home, HostCreate, HostRoom, Play, League, Sets. Components: Timer, OptionTile, Leaderboard, QuestionBody, Layout, ui. |
| Load test | `scripts/loadtest.js` | Spawns N bot players with socket.io-client, plays a full game, verifies delivery, rejections and leaderboard consistency. |

## Why these choices

**Node.js + Socket.IO, not a lower-level stack.** A 50-player room produces about 50 messages per question. Node handles that in well under a millisecond. The latency players feel is the network (20 to 200 ms), which no server language changes. Socket.IO gives rooms, acknowledgements with timeouts, automatic reconnection and a polling fallback for restrictive college Wi-Fi. That left the build time for the parts that actually affect fairness.

**One process, in-memory game state.** The game loop never waits on a database. A room is a JavaScript object with its own timers. Finished games and question sets are flushed to JSON files through `store.js`, which is the only module that knows where data lives. Swapping JSON for Postgres means changing that one module. On Render's free tier the disk is ephemeral, so the league resets on redeploy; that is documented, not hidden.

**React + Vite + Tailwind.** The host screen and the phone screen share the same components (Timer, OptionTile, Leaderboard) with different sizes. Framer Motion animates leaderboard reordering. Tailwind keeps styling consistent and the bundle small. The design is white, high-contrast, large type, and every status uses an icon or label as well as a colour.

**Same origin for API and websockets.** The server serves the built client from `dist/`, so there is no CORS, no second deployment, and the join link printed on the host screen is simply the live URL plus the room code.

## Life of a round

1. Host sends `host:start`. The engine sets `qIndex = 0` and calls `startQuestion`.
2. `startQuestion` records `startedAt` from a monotonic clock (`performance.now()`), computes `deadline = startedAt + duration`, and arms a close timer for `duration + 400 ms + 60 ms` (round-trip cap plus a small grace).
3. For every player the engine draws a fresh permutation of the options and stores it server-side. Each player receives the question with options in their own order. The correct index is never in the payload. The host receives the options in original order, also without the answer.
4. A player taps position `p`. The server looks up that player's permutation to recover the original option, stamps the arrival with its own clock, and computes `elapsed = (arrival - startedAt) - min(playerRTT, 400 ms)`.
5. The answer is accepted only if it is the player's first for this question, the question is still open, and `elapsed <= duration`. Points are computed immediately but not applied yet, so nothing leaks through the live counter.
6. The question closes when the timer fires or 900 ms after every connected player has answered. Scores are applied, ranks recomputed, the round summary stored, and one reveal is pushed to all screens at the same moment. Each player's reveal is expressed in their own option order.
7. With auto-advance on (the default) the engine schedules the next question 8 seconds after the reveal and tells every screen when; `host:next` skips the wait, `host:auto` pauses or resumes, and `host:close` ends an open round early. After the last question the engine persists the summary (unless the room is a practice room) and sends each player their report.

## Fairness under network delay

The question takes one trip to reach a phone and the tap takes one trip to come back, so a player's raw elapsed time includes a whole round trip of network delay. The server measures each player's round-trip time itself (a probe with an acknowledgement every 4 seconds, timed on the server) and subtracts the smallest recent sample from the elapsed time, capped at 400 ms.

Why the server measures: a client-reported number could be faked. Why the minimum sample: jitter spikes should not inflate the credit. Why the cap: a player could delay their probe replies to look slow, but the most that buys is 400 ms, which is worth about 10 points on a 20-second question and is visible in the host's fairness panel.

Late answers are judged on the compensated time, so two players who tap at the same instant on different connections get the same verdict. The acceptance window stays open for the cap plus a short grace after the visible deadline, invisible to players because their screens already locked at zero.

## Cheating resistance

- Options are shuffled per player per question on the server. Copying a neighbour's "B" does not help.
- The correct answer is not sent to any browser until the round closes. The live counter only reports how many answered, never who was right.
- One answer per player per question. The first accepted answer is final; duplicates and stale question indexes are dropped and counted.
- Late answers are rejected on the compensated clock. Answers that arrive within 250 ms of the question starting, faster than any reader, are rejected as too early and the player may answer again; the phone also ignores taps for the first 350 ms after a question appears so a tap carried over from the previous screen cannot register.
- Every socket is rate-limited with a token bucket (20 events per second). Payload size is capped at 10 KB.
- All host actions require the room's host token, which only the creating browser holds.
- A player who hides the tab during a question is flagged to the host, who sees the count on the reveal and results screens and in the CSV export.
- Rejoining requires the secret seat token issued at join time; a second device with the same token replaces the first, so a seat cannot be shared live.
- The answer key of a set that is in play is withheld from the editor API until the game ends, and a college can lock the editor with `HOST_PASSCODE`. Hosting itself needs no passcode, so a parallel room on the same built-in set remains possible in open mode; that trade-off is documented in the README.

## Reconnection

Each player receives a seat token at join time, stored in the phone's `localStorage` under the room code. On any page load for that room the client calls `player:resume`. The server re-attaches the socket to the existing player object, keeps the score and answer history, and replies with the current state: lobby, the open question with the remaining time and whether they already answered, the reveal, or the final report. Other players see nothing. The host browser does the same with its host token.

## Scoring

Correct: 500 points plus up to 500 more scaled by the fraction of time left (measured on the compensated clock). Wrong or skipped: 0. Exam mode, chosen by the host, applies a 250-point penalty for a wrong answer, mirroring negative marking in real placement tests. Ties are broken by total answering time, then by name. The rule is displayed in the lobby and on the home page.

## The report card

Every timestamp is kept per answer, which makes the end-of-game analysis cheap:

- Points lost to speed: for every correct answer, the bonus not earned.
- Points lost to errors: for every wrong answer, the full question value plus any penalty.
- Points lost to skipping: unanswered questions.
- Accuracy when answering in the last quarter of the timer versus earlier, and accuracy on the question right after a mistake.
- Topic accuracy and average speed.

Hosts get per-question correct rates, the three hardest questions, topic accuracy for the room, every player's summary with tab-switch counts, a fairness panel with measured delays and rejected answers, and a CSV export.

## Deployment

One Render web service runs `npm start` after `npm ci && npm run build`. The same process serves the static client, the REST API and the websocket, so there is one URL and no CORS. Secrets never enter the repository: `.env.example` lists every variable, and the only one with a default that matters is `HOST_PASSCODE`. Free instances sleep when idle, so the server fetches its own `/api/health` every 10 minutes while `RENDER_EXTERNAL_URL` or `KEEPALIVE_URL` is set, which keeps a judge's first load fast.

## Testing at 50 players

`npm run loadtest -- --url=<server> --players=50 --fast` creates a room, joins 50 bots, plays a full game with the host automated, and checks that every bot received every question and reveal, that duplicate and late answers were rejected, that a bot which disconnects and resumes keeps its seat, and that the final leaderboard is sorted and complete. It prints join and answer-acknowledgement latency percentiles. Results are recorded in the README.
