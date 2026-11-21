# Two-minute demo

Start `apps/web` with `NEXT_PUBLIC_USE_MOCKS=true` and `NEXT_PUBLIC_DEMO_CONTROLS=true`. Use one browser window. Reset between runs with **Reset demo data**.

1. Open `/`. Point at the cobalt hero and the live "people waiting" number.
2. Demo controls → Kebede Alemu. He is at Merkato. Show the demand board.
3. Switch to Hana Bekele. Join Jimma University → Merkato and choose Elderly. The position sits near the front.
4. Switch to Fatuma Ahmed (already at Jimma University). Start loading, then **Driver calls next 3 passengers**. The passenger screen turns green without a reload.
5. Board, depart, arrive.
6. Switch back to the passenger and rate the trip.
7. Switch to Admin. Show average wait, waiting now, and the load-factor bars.
8. Switch to Merkato or University. Remove one passenger; the people behind move up.
9. Switch the language to አማርኛ. Open **Text messages** from the passenger profile for the no-smartphone story.
10. Close on the landing line: one queue, live position, no shouting across the station.

## Switching to the real backend

Set `NEXT_PUBLIC_USE_MOCKS=false`, `NEXT_PUBLIC_API_URL`, and `NEXT_PUBLIC_SOCKET_URL`.

These mock helpers are demo-only and are not in `docs/api.md`: `GET /public/pulse`, `GET /driver/reports`, `GET /dev/sms`, `POST /dev/reset`. The floating demo actions call the mock store directly.
