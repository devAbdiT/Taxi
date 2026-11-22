# UI status

Contract audit against `packages/shared` and `docs/api.md`. Frontend only. Classifications are from reading the code before this pass.

| Item | Before | After | Evidence |
|---|---|---|---|
| 1. `lib/types.ts` uses `@taxiflow/shared` | MISSING | FIXED | `apps/web/lib/types.ts` only re-exports shared types. `User` is `PublicUser`. |
| 2. Session unwraps `GET /me` `{ user }` | MISSING | FIXED | `RequireRole` reads `data.user`. A full reload kept Admin User (API) and Selam Tadesse (mocks) signed in and left the loading state. |
| 3. Routes `{ routes }` and stations `{ stations }` | MISSING | FIXED | Passenger routes render from `data.routes`. Contract check parsed `GET /routes` and `GET /stations`. |
| 4. Queue route from `entry.route` | MISSING | FIXED | API queue showed "Area B → Area A", position 4. Mock queue showed "Jimma University → Merkato". After a call, the card read "Taxi OR 3-55012 is ready at Jimma University. Board now." |
| 5. Notifications `{ notifications, unread }` | PARTIAL | FIXED | Queue page reads `notifications` and `unread`. Contract check parsed `GET /notifications` and `POST /notifications/read`. |
| 6. Trips `{ trips }` / `tripId` / uppercase tags | MISSING | FIXED | Mock trips showed "Merkato → Jimma University" and the rating tags Punctuality, Cleanliness, Safety, Behavior. `POST /ratings` passed the shared schema. |
| 7. Flat driver demand and return card | MISSING | FIXED | Driver demand lists flat routes (Area B → Area A, 12 waiting, 3 need help on the API; Jimma University → Merkato on mocks). No return card while the taxi has no return suggestion. `GET /driver/demand` passed. |
| 8. Trip actions unwrap `{ trip }` | MISSING | FIXED | Contract check passed start, get, call, board, no-show, depart, arrive, and cancel. Each body parsed as `{ trip }` (call and arrive include their extra fields). |
| 9. Station desk `{ routes, taxis }` | MISSING | FIXED | API desk: Area A, 5 waiting, plate 3-AA-10001, names Nardos through Tigist. Mock desk: Merkato, 18 waiting, plate OR 3-42115, route names on each line. |
| 10. Admin stats and `{ reports }` | MISSING | FIXED | API: average wait "No data yet", load "No data yet · 0 completed". Mocks: "18min", "21% · 1 completed", and "No data yet · 0 completed" where load factor is null. `GET /admin/stats`, `GET /admin/reports`, and `PATCH /admin/reports/:id` passed. |
| 11. Mock returns the real shapes | MISSING | FIXED | With mocks on, the same screens render Jimma names (Merkato, Jimma University, Kebede, OR 3-42115) and do not crash on the new wrappers. |
| 12. `scripts/contract-check.ts` | MISSING | FIXED | `npm run contract:check` against the seeded local API: 46 passed, 0 failed, exit 0. |
