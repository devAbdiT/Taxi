# Two-minute demo

There are two ways to run it. Both follow the same story (Jimma). Reset between runs either way.

- **Mock mode**: one browser window, no API. `NEXT_PUBLIC_USE_MOCKS=true`, `NEXT_PUBLIC_DEMO_CONTROLS=true`.
- **Real mode**: the real API and Socket.IO, two browser windows. `NEXT_PUBLIC_USE_MOCKS=false`, `NEXT_PUBLIC_DEMO_CONTROLS=true`. This is the one to use on stage.

## Real mode setup

1. API: `DEMO_MODE=true` in `apps/api/.env`, then `npm run dev -w @taxiflow/api` (port 4000).
2. Web: in `apps/web`, set `NEXT_PUBLIC_USE_MOCKS=false`, `NEXT_PUBLIC_DEMO_CONTROLS=true`, `NEXT_PUBLIC_API_URL=http://localhost:4000`, `NEXT_PUBLIC_SOCKET_URL=http://localhost:4000`. Then `npm run dev -- --port 3000 --hostname localhost`. Use `localhost`, not `127.0.0.1` (CORS allows `http://localhost:3000`).
3. Open **two browser windows** side by side, both at `http://localhost:3000`. Each window keeps its own sign-in, so the passenger and the driver do not sign each other out. Use a private window for the second one if you want to be extra safe.
4. Reset: open **Demo controls** and tap **Reset demo** (see "Reset between runs").

Every demo account uses the password `demo1234`. The **Demo controls** panel signs in with one tap, so you never type a password on stage.

| Window | Account (Demo controls) | Phone |
|---|---|---|
| A (passenger, on the left) | Hana Bekele | 0911000100 |
| B (driver and everything else, on the right) | Kebede Alemu, then Fatuma Ahmed, then Admin, then Merkato rep | 0911000001, 0911000003, 0911000099, 0911000011 |

With the API on a hosted Neon database, **Start loading**, **Call**, and the demo logins can take 5 to 10 seconds. Wait for the button to stop spinning before you speak the next line. A local Postgres is much faster.

Window A stays on Hana from step 3 to step 7. Never switch it. That is how the green "Board now" screen shows up without a reload.

## The script (real mode)

1. **Window B, `/`.** Say: "A shared taxi waits until it is full. Nobody knows who is next." Point at the cobalt hero and the live "people waiting" number.
2. **Window B, Demo controls, Kebede Alemu.** Say: "Kebede is at Merkato. This is what he sees." Show the demand board, then pick Merkato to Jimma University and tap **Start loading**. The banner reads **Waiting for your return: 13 passengers**. Say: "He now knows people are waiting at the university for his way back."
3. **Window A, Demo controls, Hana Bekele.** Choose Jimma University to Merkato, choose **Elderly**, tap **Join queue**. Say: "Hana is elderly, so she is placed near the front." Her position is 4.
4. **Window B, Demo controls, Fatuma Ahmed** (already at Jimma University). Pick Jimma University to Merkato, tap **Start loading**, then tap **Call next 13** (the stepper starts at the seat count, so the button calls everyone waiting). Say: "Fatuma calls the queue." **Window A turns green by itself: Board now, taxi OR 3-55012, at Jimma University.** Point at it. Do not touch window A.
5. **Window B.** Board each passenger, **Depart**, **Arrive**.
6. **Window A.** Hana opens Your trips and rates the trip (this is the only thing you do in window A after step 3).
7. **Window B, Demo controls, Admin.** Say: "The association sees real numbers." Show average wait, waiting now, and the load-factor bars (13 of 19 seats on this route).
8. **Window B, Demo controls, Merkato rep.** Open the Merkato to Jimma University line and remove one passenger. Say: "The people behind move up." The positions renumber.
9. **Window A.** Switch the language to አማርኛ. Open **Text messages** from the profile for the no-smartphone story. Amharic is a draft, see `docs/amharic-say-aloud.md`.
10. **Close on the landing line:** "Skip the wait. Know your turn." One queue, live position, no shouting across the station.

Lines to say aloud, in English and Amharic: `docs/amharic-say-aloud.md` (the Amharic needs review by a fluent speaker).

## Reset between runs

Demo controls, **Reset demo**, in either window. In real mode it calls `POST /dev/reset`, signs you out, and takes you back to `/`. Do this in both windows before the next run (the second window signs itself out on its next request). Reset rebuilds every user, so old sign-ins stop working.

From a terminal: `curl -X POST http://localhost:4000/dev/reset` (needs `DEMO_MODE=true`).

## Check it without a browser

`npm run e2e:demo -w @taxiflow/api -- --runs 3` runs steps 2 to 8 over REST and Socket.IO against a running API and prints PASS or FAIL per step. It resets before each run and leaves the database reset. Exit code 1 means a step failed. The API can be slow on a hosted database; each run takes a few minutes.

## Mock mode

In mock mode the same script works in one window: **Demo controls** switches the mock user instantly, **Reset demo data** restores the mock store, and the extra buttons (another passenger joins, priority passenger, driver calls next 3, move my position up, complete trip) are there to speed things up. Those buttons only change the mock store, so they are hidden in real mode.

Use the driver screen's **Call** button in step 4, not **Driver calls next 3 passengers**: Hana is elderly but lands fourth, so "next 3" would skip her.

## Switching to the real backend

Set `NEXT_PUBLIC_USE_MOCKS=false`, `NEXT_PUBLIC_API_URL`, and `NEXT_PUBLIC_SOCKET_URL`.

`GET /public/pulse`, `GET /driver/reports`, `GET /dev/sms`, and `POST /dev/reset` are real API routes. The reset and SMS routes answer only when the API has `DEMO_MODE=true`.
