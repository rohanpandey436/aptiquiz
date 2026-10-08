# Three-minute table demo

Goal: the judge plays one round on their own phone and sees the leaderboard move. Nothing else matters as much.

## Before the judges arrive

1. Open the live URL on the laptop five minutes early so the free server is awake. Reload once and confirm the home page appears in under two seconds.
2. Host a game: Host, pick "Lightning Round (demo)", keep 10 seconds, leave exam mode off, Create room.
3. Keep the lobby on screen. Have one teammate already joined from their phone so the room is never empty.
4. Have a second phone ready with the join link typed, in case the judge prefers not to scan.

## The script

**0:00 Open.** "AptiQuiz is aptitude practice as a live game. Students lose placement tests to speed and pressure, not ability. This is where they practise under both." Point at the room code. "Scan this, or type the code. No account, nothing to install."

**0:30 Judge joins.** Their name appears in the lobby in real time. Press Start.

**0:45 Question 1.** Everyone sees the same question at the same moment. Say one sentence while they answer: "Your phone shows the options in a different order from mine, and the right answer is not on your phone until the round closes. The server is the referee."

**1:15 Reveal.** Point at the counts, the explanation, and the leaderboard arrows. "Scores release only when the round closes, so a fast tap never leaks who was right."

**1:30 Question 2 and 3.** Press Next. Let them play. If asked about slow Wi-Fi: "The server measures each phone's round-trip delay and subtracts it, capped at 400 milliseconds, so a slow connection is not a handicap. The host's fairness panel shows the numbers after the game."

**2:15 Refresh test.** Ask the judge to refresh their phone mid-question. They come back on the same question with the same score. "Seat tokens. Nobody else notices."

**2:40 Results.** End the game. Show the podium, then the judge's phone: the report card. "This is the part a score sheet cannot give you: how many points went to slowness, to wrong answers, and whether accuracy drops in the last quarter of the timer. Students see whether the clock or the content is beating them."

**3:00 Close.** "Rooms belong to a college and feed a league. Faculty author sets and export a CSV. Built on Node and Socket.IO, server-authoritative, tested with 50 simulated players. The README has the test script and the fairness explanation."

## If something fails

- No internet: switch the laptop to a phone hotspot. The app only needs the live URL.
- Live URL down: run `npm start` locally and join on the same Wi-Fi via the laptop's IP, or show the recorded demo.
- A phone will not scan: type the room code on the join page.
- A question stalls: press "End round now" on the host screen.
