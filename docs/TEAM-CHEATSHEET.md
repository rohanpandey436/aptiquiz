# What every team member should be able to say

Read this, then play two games as a host and two as a player. Judges ask the person nearest to them.

## The problem in one breath

Aptitude tests are the first filter in placements. Students fail them on speed and pressure, not ability. Practising alone from a PDF has neither. AptiQuiz is a live, 50-player quiz room with a leaderboard, and a report card that tells each student whether speed, mistakes or pressure cost them.

## How a round works

1. Host creates a room from a question set and gets a 6-letter code plus a QR code.
2. Players join with the code and a name. No login.
3. Host presses Start. The server sends the question to everyone at the same moment and starts its own clock.
4. Each phone shows the options in its own shuffled order. A tap sends only the position; the server maps it back.
5. The server stamps the arrival time, subtracts the player's measured network delay, and locks the first answer.
6. When the time ends, or everyone has answered, the server reveals the answer, scores the round and pushes the leaderboard with up and down arrows.
7. After the last question: podium, report cards, league update.

## Scoring

Correct: 500 plus up to 500 for speed. Wrong or skipped: 0. Exam mode (host's choice): wrong answers cost 250, like real negative marking. Ties go to the faster total time. The rule is on the home page and in every lobby.

## "How is it fair on bad Wi-Fi?"

A question takes one trip to reach the phone and the tap takes one trip back, so raw time includes a whole round trip of delay. The server measures each player's round trip itself, every few seconds, and subtracts the smallest recent value from the answer time, capped at 400 milliseconds. Two people who tap at the same instant get the same time. Faking a slow connection buys at most 400 ms, about 10 points, and shows up in the host's fairness panel.

## "How do you stop cheating?"

- Options shuffled per player, server-side.
- Correct answer never sent before the reveal.
- First answer final; duplicates, stale and late answers dropped and counted.
- Rate limit per connection, 10 KB payload cap.
- Host actions need the host token.
- Tab switching during a question is flagged to the host.
- Rejoining needs the secret seat token; a second device replaces the first.
- Question sets with answers are behind the host passcode.

## "What if my phone refreshes?"

The seat token on the phone brings you back to the same player: same score, current question with the remaining time. Nobody else is disturbed.

## "Does it really handle 50 players?"

`npm run loadtest` joins 50 bots, plays a full game, and checks delivery, rejections and the leaderboard. Local numbers: joins p95 51 ms, answer acknowledgements p95 13 ms, all 50 on the final board.

## The stack and why

Node.js with Express and Socket.IO on the server; React, Vite and Tailwind on the client; one process serving both; game state in memory with JSON persistence behind one store module; Render free tier. Node is more than fast enough because the bottleneck is the network, not the CPU, and Socket.IO gives rooms, reconnection and fallbacks for free.

## What we added beyond the brief

Pressure Profile report card, exam mode, faculty insights with CSV export, fairness panel, explanations on every reveal, tab-switch flags.

## What is next

Postgres so the league survives redeploys, spectator mode for projectors, team battles, daily challenge with streaks, power-ups with limits.
