# TaxiFlow

A digital queue for shared taxis on fixed routes. Passengers join a route queue instead of reserving seats, and drivers see live demand on every route, including the trip back.

## Layout

```
apps/api         Express + TypeScript API and Socket.IO server (backend)
apps/web         Next.js web app (frontend)
packages/shared  Zod schemas, TypeScript types and socket events shared by both
docs/api.md      The API and realtime contract
```

## Requirements

Node.js 22 or newer, npm, Docker (for the local PostgreSQL).

## Run locally

```bash
npm install                                  # install every workspace
cp apps/api/.env.example apps/api/.env       # then set JWT_SECRET
npm run db:up                                # start PostgreSQL in Docker
npm run dev                                  # build shared, start the API on http://localhost:4000
curl http://localhost:4000/health            # {"ok":true,...}
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Builds `packages/shared`, then starts the API with reload on change |
| `npm run build` | Builds `packages/shared` and the API |
| `npm run build:shared` | Builds only `packages/shared` (run after pulling contract changes) |
| `npm run typecheck` | Type-checks every workspace |
| `npm run db:up` / `npm run db:down` | Starts or stops the local PostgreSQL |

## Environment variables (apps/api)

See `apps/api/.env.example`. `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `PORT`, `DEMO_MODE`, `PRIORITY_ENABLED`. Never commit `.env`.
