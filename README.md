# AptiQuiz

Live multiplayer aptitude practice for placement preparation. Problem Statement 3.

Live URL: _added once deployed_

## What it does

AptiQuiz turns aptitude practice into a live game. A host creates a room from a question set and shares a 6-letter code; up to 50 students join from their phones, see each question at the same moment, answer against the clock, and watch a leaderboard move after every round. At the end, every player gets a report card that explains exactly where their points went: speed, wrong answers or pressure, topic by topic. Scores from every room feed a college league.

## Screenshots

| Host lobby | Host during a question |
|---|---|
| ![Host lobby with room code and QR](docs/screenshots/host-lobby.jpg) | ![Host question view](docs/screenshots/host-question.jpg) |

| Player question | Player reveal | Player report card |
|---|---|---|
| ![Player question on a phone](docs/screenshots/player-question.jpg) | ![Player reveal on a phone](docs/screenshots/player-reveal.jpg) | ![Player report card on a phone](docs/screenshots/player-report.jpg) |

## Done / Left / Plan

**Done**
- Question authoring: create, edit, reorder, duplicate and delete sets; questions with topic, difficulty, explanation, optional image and table; JSON import. Six built-in sets with 54 verified questions.
- Rooms with short join codes and a QR code, a live lobby, host start.
- Live play: server-timed countdown, per-player shuffled options, answer lock-in with the measured answer time, live "answered" counter.
- Scoring that rewards speed, with the rule shown to players; optional exam mode with negative marking.
- Animated leaderboard with movement arrows after each question; final results with podium, per-player accuracy, speed and topic strengths.
- Pressure Profile report card: points lost to speed, errors and skipping; accuracy in the last quarter of the timer versus earlier; accuracy right after a mistake.
- Host insights: per-question correct rates, hardest questions, topic accuracy, tab-switch flags, fairness panel, CSV export.
- College league across rooms, by week, month or all time.
- Server as referee, latency compensation, reconnection with the same score, cheating resistance (details below).
- 50-player simulation script, results below.
- Projector view at `/watch/CODE`: a read-only second screen that follows the game, so the host laptop can stay private.
- Optional auto-advance for the host, 8 seconds after each reveal.
- Mobile-first layout, keyboard answering (keys 1 to 4), labelled controls, colour plus icon for every status.

**Left**
- Persist league and question sets in Postgres instead of JSON files, so data survives redeploys.
- Team battles and a daily challenge with streaks.
- Power-ups with per-game limits.
- Sound cues with an on/off toggle.

**Plan for the next 16 hours**
1. Deploy, test on three phones on venue Wi-Fi, fix anything that feels slow.
2. Postgres adapter behind `store.js`, keeping the same interface.
3. Team battles: a team field at join time and a combined-score table.
4. Final pass on accessibility (screen reader labels on the reveal) and a recorded demo as a backup.

## Architecture and why

One Node.js process is the referee. Express serves the built React client and a small REST API; Socket.IO carries the game. Game state lives in memory inside a `GameManager` (one object per room with its own timers), and finished games and question sets are flushed to JSON files through a single persistence module.

Why Node.js and Socket.IO: a 50-player room is about 50 messages per question, which Node handles in well under a millisecond; the delay players feel is the network. Socket.IO brings rooms, acknowledgements, automatic reconnection and a polling fallback for restrictive Wi-Fi, so the build time went into fairness and anti-cheat instead of plumbing.

Why in-memory state with JSON persistence: the game loop never waits on a database, and `store.js` is the only module that knows where data lives, so Postgres is a one-module swap. On Render's free tier the disk is ephemeral, so the league resets on redeploy.

Why React, Vite and Tailwind: the host screen and the phone screen share the same components at different sizes, and Framer Motion animates leaderboard reordering.

**Fairness under network delay, in plain words.** A question takes one trip to reach your phone and your tap takes one trip to come back, so your raw time includes a whole round trip of network delay. The server measures each player's round-trip time itself, with a timed probe every few seconds, and subtracts the smallest recent measurement from the answer time, capped at 400 ms. Two players who tap at the same instant on different connections therefore get the same time. Because the server measures, nobody can report a fake delay; because of the cap, deliberately slowing your probe replies buys at most 400 ms, about 10 points on a 20-second question, and it shows in the host's fairness panel.

**Cheating resistance.** Options are shuffled per player per question on the server, so copying a neighbour's letter does not help. The correct answer is never sent before the reveal; the live counter only says how many answered. The first answer is final; duplicates, stale and late answers are dropped and counted. Every socket is rate-limited and payloads are capped at 10 KB. Host actions need the room's host token. Players who hide the tab during a question are flagged to the host. Rejoining needs the secret seat token issued at join time, and a second device with the same token replaces the first. Question sets with answers sit behind a host passcode.

**Reconnection.** Each player gets a seat token stored on the phone under the room code. On reload the client resumes with it; the server re-attaches the socket to the same player object and replies with the current state: the open question with the remaining time, the reveal, or the final report. Nobody else notices.

The full design, with the life of a round and the reasoning behind each choice, is in [ARCHITECTURE.md](ARCHITECTURE.md).

## What we added

- **Pressure Profile.** The brief says students fail aptitude tests because of speed and pressure, not ability. The report card separates points lost to slowness from points lost to wrong answers, and compares accuracy in the last quarter of the timer with accuracy earlier, plus accuracy on the question right after a mistake. A player learns whether the clock or the content is beating them.
- **Exam mode.** Host-selected negative marking that mirrors real placement tests, with the rule shown to every player before the game.
- **Faculty insights and CSV export.** Per-question correct rates, hardest questions, topic accuracy and a one-click CSV, so a placement cell can run a league and act on the data.
- **Fairness panel.** Measured connection delays and the count of rejected late, duplicate and invalid answers, visible to the host after every game.
- **Explanations on the reveal.** Every built-in question carries a one-line explanation that appears on every screen when the answer is revealed.
- **Tab-switch flags.** The host sees who left the page during a question.
- **Projector view.** `/watch/CODE` mirrors the host screen without controls, for a second display at college events.

## How to run it

Requirements: Node.js 20 or newer.

```bash
git clone https://github.com/rohanpandey436/aptiquiz.git
cd aptiquiz
npm install
npm run build
npm start
```

Open http://localhost:3000. For development with hot reload, `npm run dev` runs the server on 3000 and Vite on 5173.

Environment variables are optional and documented in `.env.example`. `HOST_PASSCODE` protects the question editor and defaults to `faculty`.

Test login: the question editor at `/sets` asks for the host passcode `faculty`. Hosting a game and joining one need no login.

50-player simulation:

```bash
npm run loadtest -- --url=http://localhost:3000 --players=50 --fast
```

Unit tests for the engine (`npm test`) cover shuffling, scoring, exam mode, rejection of duplicate, stale, invalid and late answers, compensation capping, early close, tie-breaks, reconnection and the report maths.

The script creates a room, joins 50 bots, plays a full game, and checks that every bot received every question and reveal, that duplicate and late answers were rejected, that a bot which drops and resumes keeps its seat, and that the final leaderboard is complete and sorted. Latest local run:

| Measure | Result |
|---|---|
| Players joined | 50 of 50 |
| Join latency | p50 30 ms, p95 51 ms |
| Answer acknowledgement latency | p50 4 ms, p95 13 ms, max 22 ms |
| Answers accepted | 245 (5 questions, 49 honest bots) |
| Rejected on purpose | 5 duplicate, 5 late |
| Bot that dropped and resumed mid-game | kept its seat and score |
| Every bot received every question and reveal | yes |
| Final leaderboard | 50 entries, sorted correctly |

Run on 8 October 2026 against a local server (`node scripts/loadtest.js --url=http://localhost:3000 --players=50 --fast`). The same command against the live URL is in the deployment notes below once the service is up.

Deployment: `render.yaml` describes a single free web service (build `npm ci && npm run build`, start `npm start`). Push to `main` and Render redeploys. Free instances sleep after idle time, so the server pings its own health endpoint every 10 minutes while `RENDER_EXTERNAL_URL` (set by Render) or `KEEPALIVE_URL` is present.

## Tools and AI used

- Runtime: Node.js 24, Express 4, Socket.IO 4.
- Client: React 18, Vite 5, Tailwind CSS 4, Framer Motion, react-router, qrcode.react, socket.io-client.
- Testing: the bot simulation in `scripts/loadtest.js` built on socket.io-client.
- Hosting: Render (web service with websockets).
- AI during development: Claude Code was used as a coding assistant for writing and reviewing code and documentation. No AI service runs inside the app.
- Users and AI: there are no AI players, AI chat or AI-generated answers in a game. Every participant is a real person, and the footer of every page says so.

## Who it is for

Students preparing for campus placements, who need to practise aptitude under real time pressure with other people around rather than alone from a PDF. They come back because a game takes ten minutes, the leaderboard makes it social, and the report card tells them something a score sheet cannot: whether to work on speed, on a topic, or on nerves.

Placement cells and faculty, who can author question sets once, run rooms every week, see which questions a batch gets wrong, and keep a college league going across the semester.
