# Tech stack, reasons, and the questions a panel will ask

## The stack and why

| Layer | Choice | Why this and not something else |
|---|---|---|
| Server | Node.js 24 with Express 4 | One process serves the API, the websocket and the built client, so there is one URL, no CORS and one deploy. The server's work per question is about 50 small messages; the delay players feel is the network, which no faster language changes. |
| Real time | Socket.IO 4 | Rooms, acknowledgements with timeouts, automatic reconnection and a long-polling fallback for college Wi-Fi that blocks websockets. Raw WebSockets would have cost us a day of plumbing for the same result. |
| Timing | Server monotonic clock (`performance.now`) | Phones never decide anything. The countdown on a phone is cosmetic; the server's clock decides every verdict. |
| Game state | In memory, one object per room | The game loop never waits on a database, so a round closes and scores in under a millisecond. |
| Persistence | JSON files behind one module (`store.js`) | Only question sets and finished games need to survive a restart. One module knows where data lives; swapping in Postgres means changing that one module. Render's free disk is wiped on redeploy, which the README says plainly. |
| Client | React 18 with Vite 5 | The host screen, the projector view and the phone share the same components at different sizes. Builds in nine seconds, ships 137 KB gzipped. |
| Styling | Tailwind CSS 4 | Every colour, radius, shadow and animation is a token in one block, so the whole app changes from one place. The stylesheet is 8 KB gzipped. |
| Motion | Framer Motion plus CSS keyframes | Leaderboard rows reorder with a spring, the verdict pops, the podium rises. Everything else is a 150 ms transition. Reduced-motion users get none of it. |
| Fonts | Inter for text and numbers, Bricolage Grotesque for headings | Inter has tabular figures so timers and scores do not jitter. The display face gives the product a face of its own. |
| Tests | Node's built-in test runner, 21 engine tests | No test framework to install. Shuffling, scoring, compensation, rejection, early close, reconnection, tie-breaks, late joiners, spectator payloads and the answer-key lock are all covered. |
| Load test | A bot script on socket.io-client | 50 simulated players join, play a full game, deliberately send duplicate and late answers, and one drops and resumes. It prints latency percentiles and checks the final board. |
| Hosting | Render free web service, blueprint in `render.yaml` | Websockets supported, auto-deploy on push, zero cost. The server pings its own health endpoint every ten minutes so the free instance stays awake. |
| AI | None in the product | Problem statement 3 needs none. We used an AI coding assistant during development, which the README states, and the footer of every page says every player is a real person. |

Why not C++ or Go: a 50-player room produces about 50 answers per question. Node handles that in well under a millisecond. The 270 ms round trip from a phone to the data centre is the whole story, and we spent the time on compensating for it instead.

## Questions a panel will ask, and the answers

**1. How is the server the referee?**
The server starts every question on its own clock, timestamps every answer on arrival, decides accept or reject, scores, ranks and reveals. A phone sends only "position 2". Nothing a phone says about time is trusted.

**2. How is it fair on slow Wi-Fi?**
A question takes one trip to reach the phone and the tap takes one trip back, so a raw answer time includes a full round trip of network delay. The server measures each player's round trip itself every four seconds, keeps the smallest recent sample, and subtracts it from the answer time, capped at 400 ms. Two people who tap at the same instant get the same time.

**3. Why subtract the whole round trip and not half?**
Because both legs are inside the measured interval: the question travelling down and the tap travelling up. Half would under-compensate.

**4. Why the 400 ms cap, and can someone fake a slow connection?**
A player could delay their replies to the probe to look slow. The cap means that buys at most 400 ms, which is about 10 points on a 20-second question, and the host's fairness panel shows every player's measured delay.

**5. What stops cheating?**
Options are shuffled per player per question on the server, so a neighbour's "B" means nothing. The correct answer is never sent before the reveal; the live counter only says how many answered. The first answer is final; duplicates, stale and late answers are dropped and counted. Each connection is rate-limited, payloads are capped, one connection holds one seat, and a kicked player cannot rejoin under the same name or address. Hiding the tab during a question is flagged to the host. The answer key of any set that is being played is hidden from the editor until the game ends.

**6. What if a phone refreshes or loses signal?**
A seat token saved on the phone brings the player back to the same seat: same score, current question with the remaining time. If the request times out the token is kept and retried. Nobody else notices.

**7. What if the host's laptop dies?**
Auto-advance runs on the server, so the game continues on its own. The host can reopen the room from the same browser, and the projector view at `/watch/CODE` follows the game without host controls.

**8. How did you test 50 players?**
`npm run loadtest` against the live URL: 50 bots join, play five questions, five send duplicate answers and five send late answers on purpose, one drops and resumes. Live result: every bot received every question and reveal, duplicates and late answers rejected, join latency p95 701 ms, answer acknowledgement p95 around 500 ms, round trip 270 ms measured and compensated, final board complete and sorted.

**9. Why Node instead of something faster?**
See above: the server's work is trivial, the network is the bottleneck, and Socket.IO gives us reconnection, acknowledgements and a Wi-Fi fallback for free. One language across the stack also let three people move fast.

**10. Why no database?**
The game loop must never wait on one. Finished games and question sets are the only durable data, and they go through one module that can be swapped for Postgres without touching the engine. We say honestly that the free tier's disk resets on redeploy.

**11. How does scoring work?**
Correct: 500 plus up to 500 for speed, scaled by the fraction of time left on the compensated clock. Wrong or skipped: 0. Exam mode, chosen by the host, charges 250 for a wrong answer like real negative marking. Ties go to the faster total time, and a skipped question counts as the full duration so skipping never beats attempting.

**12. What is the Pressure Profile?**
Every answer keeps its timestamp, so at the end we split the points a player did not earn into three: lost to speed (correct but slow), lost to errors, lost to skipping. We also compare accuracy when answering in the last quarter of the timer with accuracy earlier, and accuracy on the question right after a mistake. The verdict sentence tells the student whether the clock or the content is beating them.

**13. How does the league work, and can it be gamed?**
Every finished room adds its players' points to the college the host named. Practice rooms, like the load test, are never counted. In open mode anyone can host, which is right for a demo; a college that cares switches on faculty mode with one environment variable, which locks the editor, and we rank by total and show average per player.

**14. Can a student read the answers in the editor?**
Not for a set that is being played: its answer key is withheld until the game ends. Before a game, in open mode, a built-in set's answers are readable, which is why serious hosts use their own sets or faculty mode. The README states this limit rather than hiding it.

**15. Accessibility?**
Body text contrast at least 4.5:1 on every surface, including white on the blue gradient and the amber tile. Correct and wrong are shown with icons and labels as well as colour. Every control has a label, answering works with keys 1 to 6 or A to F, the reveal is announced to screen readers, and reduced-motion users get no animation.

**16. How much AI did you use?**
An AI coding assistant helped write and review code and documentation, as the brief allows and the README states. The design choices, the trade-offs and every line were reviewed by the team. The product itself has no AI.

**17. What was the hardest bug?**
Three found in our own review pass: a timed-out resume request wiped the player's seat token; two quick presses of Next closed a brand-new question instantly; and the early-close timer survived a player returning mid-question. All three have tests now.

**18. How would it scale beyond one server?**
Socket.IO's Redis adapter for rooms across processes, Postgres behind the store module, and sticky sessions at the load balancer. Nothing in the engine assumes a single process except the in-memory room map, which is the one thing the adapter replaces.

**19. What data do you store?**
Display names and scores. No accounts, no emails, no phone numbers. Seat and host tokens are random and live only in the browser that created them.

**20. What would you build next?**
Postgres so the league survives redeploys, team battles, a daily challenge with streaks, power-ups with limits, and a recorded highlights reel of each game for the college's notice board.
