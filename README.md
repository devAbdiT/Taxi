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
cp apps/api/.env.example apps/api/.env       # then set JWT_SECRET (and DATABASE_URL if not using Docker)
npm run db:up                                # start PostgreSQL in Docker
npm run db:deploy -w @taxiflow/api           # apply migrations
npm run seed -w @taxiflow/api -- --reset     # wipe and load the demo data
npm run dev                                  # build shared, start the API on http://localhost:4000
curl http://localhost:4000/health            # {"ok":true,...}
```

Every demo account uses the password `demo1234`: admin `0911000099`, station reps `0911000011` (Area A) and `0911000012` (Area B), drivers `0911000001` to `0911000003`, demo passenger `0911000100`, and passengers `0911000101` to `0911000120`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Builds `packages/shared`, then starts the API with reload on change |
| `npm run build` | Builds `packages/shared` and the API |
| `npm run build:shared` | Builds only `packages/shared` (run after pulling contract changes) |
| `npm run typecheck` | Type-checks every workspace |
| `npm run db:up` / `npm run db:down` | Starts or stops the local PostgreSQL |
| `npm run db:migrate -w @taxiflow/api` | Creates and applies a new migration after a schema change |
| `npm run db:deploy -w @taxiflow/api` | Applies pending migrations (use this on hosted databases) |
| `npm run seed -w @taxiflow/api -- --reset` | Wipes the database and loads the demo data |

## Environment variables (apps/api)

See `apps/api/.env.example`. `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `PORT`, `DEMO_MODE`, `PRIORITY_ENABLED`. Never commit `.env`.
