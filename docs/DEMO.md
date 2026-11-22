# TaxiFlow Demo Script: Core & Advanced Features (3 Minutes)

There are two ways to run it:
- **Mock mode**: one browser window, no API server required. `NEXT_PUBLIC_USE_MOCKS=true`, `NEXT_PUBLIC_DEMO_CONTROLS=true`.
- **Real mode**: real API and Socket.IO, two browser windows. `NEXT_PUBLIC_USE_MOCKS=false`, `NEXT_PUBLIC_DEMO_CONTROLS=true`.

---

## 1. Setup & Pre-flight (1 minute)

1. **Free port 4000** and make sure Docker / Postgres is accessible.
2. In `apps/api/.env`: `PORT=4000`, `DEMO_MODE=true`, `DEMO_SIMULATE_GPS=true`, `AI_PROVIDER=none`.
3. In `apps/web/.env.local`: `NEXT_PUBLIC_USE_MOCKS=false`, `NEXT_PUBLIC_API_URL=http://localhost:4000`, `NEXT_PUBLIC_SOCKET_URL=http://localhost:4000`, `NEXT_PUBLIC_DEMO_CONTROLS=true`.
4. Open **two browser windows** side-by-side at `http://localhost:3000`:
   - **Window A (Left - Passenger):** Login as Hana Bekele (`0911000100` / `demo1234`)
   - **Window B (Right - Controller / Driver / Admin):** Station Rep / Kebede Alemu
5. In Demo Controls, tap **Reset demo**.

---

## 2. The 3-Minute Presentation Script

### Act 1: The Core Queue & Honest AI Wait Estimates (0:00 - 0:45)
- **Window A (Passenger):** Open the passenger queue page.
  - *Say:* "Passengers don't just see a position number. TaxiFlow gives an honest AI wait estimate based on real historical data."
  - *Show:* The **Estimate** badge: *"About 8 min (range 5–12 min) • Based on 15 recent trips"*.
  - *Say:* "Notice the transparency: we explicitly label it as statistical estimate and demo data, not false machine learning."

### Act 2: Conflict Resolution & Append-Only Audit Trail (0:45 - 1:30)
- **Window A (Passenger):** Tap **Report line problem** to file a dispute: *"Passenger jumped in front of the line"*.
- **Window B (Station Rep):** Navigate to `/station` (The Control Desk).
  - *Show:* The Control Desk header with live counts and the **Disputes** tab showing the open dispute.
  - *Action:* Tap **Queue Tab**, find the offending entry, open menu and select **Move Back**.
  - *ActionSheet:* Show the required reason field (10–500 chars), pick the quick chip *"Attempted line jumping"*, confirm.
  - *Show:* The **Audit Log** tab.
  - *Say:* "Every controller action is permanently written to an immutable, append-only database audit log. It cannot be altered or deleted."
  - *Window A:* Passenger sees the reason why their turn was adjusted and has a 48-hour **Appeal this decision** button.

### Act 3: Live GPS Tracking & Privacy-Preserving Pickups (1:30 - 2:20)
- **Window B (Driver):** Switch to Kebede Alemu (`/driver`). Turn on **Share My Location**.
  - *Show:* The green "Sharing" status chip and screen wake-lock protection banner.
- **Window A (Passenger):** Navigate to `/passenger/pickup`.
  - *Show:* Privacy-first consent sheet (*"Location sharing stops the moment your trip ends"*).
  - *Show:* Taxis nearby layer with coordinates rounded to 100 meters.
  - *Action:* Tap **Use my location** and tap **Find nearby taxis**.
- **Window B (Driver):** The **Nearby Requests** list updates immediately with the matching score breakdown (*"0.5 distance + 0.2 seats + 0.15 rating + 0.15 idle"*).
  - *Action:* Driver taps **Accept**.
  - *Say:* "The passenger's exact pin is only revealed to the accepting driver once accepted. And the moment the trip completes, all coordinates are wiped from the database."
  - *Action:* Driver taps **I've Arrived**, then **Complete Pickup**.

### Act 4: Driver Demand Forecasts & Operational Insights (2:20 - 2:45)
- **Window B (Driver):** Show the **Smart Dispatch Suggestion** card on `/driver`:
  - *"About 15 people expected at Merkato around 5 PM"* with the mini inline SVG hourly bar chart for the next 3 hours.
- **Window B (Admin):** Navigate to `/admin/insights`:
  - Show top issues trends, dispute hotspots matrix, and rule-based suggestions.

### Act 5: Amharic Switch & Closing (2:45 - 3:00)
- **Window A:** Switch language to **አማርኛ**.
  - *Show:* Control desk, pickup, and queue flow fully translated into natural Amharic.
  - *Close:* "TaxiFlow: Fair queues, live GPS, and honest AI — with a human queue controller in charge."

---

## 3. Honest Limits & Disclosures (What to state on stage)

1. **Background GPS:** Web browsers throttle or suspend geolocation when tabs are backgrounded. TaxiFlow includes screen wake-lock, but a native app background service would be used in long-term production.
2. **Synthetic Data:** The 14-day history is generated with realistic Jimma peak patterns. All AI endpoints explicitly flag `synthetic: true` until live operation accumulates real data.
3. **AI Methods:** We use robust statistics and rules for queue prediction and dispatch scoring. We do not call simple formulas "deep learning".
4. **Tile Usage:** OpenStreetMap tiles are rendered in client components with required attribution without bulk downloading.
5. **Amharic Microcopy:** Draft translations are natural but should be verified by a native speaker before municipal deployment.
