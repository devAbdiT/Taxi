# TaxiFlow web (apps/web)

Next.js App Router, TypeScript, Tailwind. Mobile first, English and Amharic.

## Run

```bash
cd apps/web
npm install
cp .env.example .env.local   # NEXT_PUBLIC_USE_MOCKS=true runs without the API
npm run dev                  # http://localhost:3000
```

- `/dev/ui` shows every shared component and runs a quick check against the API (or the mocks).
- Mock data lives in `lib/mock.ts` and is saved in localStorage. Clear it with `POST /dev/reset` (or `localStorage.removeItem("taxiflow.mockdb")`).

## Environment

| Variable | Meaning |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | Base URL of the API |
| `NEXT_PUBLIC_SOCKET_URL` | URL for live updates (same server as the API) |
| `NEXT_PUBLIC_USE_MOCKS` | `true` to use `lib/mock.ts` instead of the real API |

## Layout

- `lib/types.ts` — API contract types (switch to `packages/shared` when it exists)
- `lib/api.ts` — API client: token storage, bearer header, redirect to `/login` on 401
- `lib/i18n.ts` + `i18n/{en,am}.json` — `useT()` helper, language saved in localStorage, English fallback
- `lib/time.ts` — relative time ("5 min ago"), never a clock time
- `components/` — Header, LanguageSwitch, Button, States, StatusBadge, RelativeTime, Icon
