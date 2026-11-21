# TaxiFlow API

Express API and Socket.IO server for the shared-taxi queue. Run these commands from the repository root.

## Install

```bash
npm install
cp apps/api/.env.example apps/api/.env
```

Set `DATABASE_URL` and a `JWT_SECRET` of at least 32 characters in `apps/api/.env`. Do not commit that file.

## Migrate

```bash
npm run db:deploy -w @taxiflow/api
```

Use this for a local database and for the hosted one. `npm run db:migrate -w @taxiflow/api` is only for creating a new migration while developing.

## Seed

```bash
npm run seed -w @taxiflow/api -- --reset
```

This wipes the database and loads the demo accounts. The demo password is `demo1234`.

## Run

```bash
npm run dev -w @taxiflow/api
```

The API and Socket.IO listen on `PORT` (4000 by default). Production:

```bash
npm run build -w @taxiflow/api
npm run start -w @taxiflow/api
```

`POST /dev/reset` and `GET /dev/sms` answer only when `DEMO_MODE=true`. They are off in production unless you turn that flag on for a demo. Nothing in `GET /dev/sms` sends a real text message.

## Tests

Set `TEST_DATABASE_URL` in `apps/api/.env` to a different database from `DATABASE_URL`. Tests wipe it.

```bash
npm test -w @taxiflow/api
```
