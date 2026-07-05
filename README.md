# FinTrack — Backend

Offline-first personal finance & expense tracker. This is the **NestJS + Prisma + PostgreSQL** backend that stores raw records and synchronises them with the mobile app.

> ⚠️ The mobile client is the **calculation authority** (CLAUDE.md, Modification #6). The backend stores raw records and provides sync + cross-check calculations only.

## Tech stack

- **NestJS 11** (TypeScript)
- **PostgreSQL** + **Prisma 7** (via the `prisma-client` generator + `@prisma/adapter-pg` driver adapter)
- **JWT** auth — short-lived access token + long-lived refresh token (offline grace period)
- **class-validator** request validation

## Key conventions

- **Money = integer paisa** (Modification #1). Stored as `BigInt`; serialized to JSON as a number.
- **UUID primary keys**, client-generated where possible (Modification #4).
- **Soft delete** via `isDeleted` / `deletedAt` tombstones (Modification #3).
- **Sync** is Last-Write-Wins on `updatedAt` (push + pull).

## Prerequisites

- Node.js 20+ (developed on 24)
- A PostgreSQL database

## Setup

```bash
npm install                 # also runs `prisma generate` (postinstall)
cp .env.example .env        # then edit values
```

Set `DATABASE_URL` and the JWT secrets in `.env`. Generate strong secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Create the database schema:

```bash
npm run prisma:migrate      # dev: creates + applies a migration
# or, against an existing migrated DB:
npm run prisma:deploy
```

## Run

```bash
npm run start:dev           # watch mode
npm run start:prod          # node dist/main (after `npm run build`)
```

API is served under the `/api` prefix, e.g. `http://localhost:3000/api/health`.

## Useful scripts

| Script | Purpose |
| --- | --- |
| `npm run build` | Compile to `dist/` |
| `npm run prisma:generate` | Regenerate the Prisma client (`src/generated/prisma`) |
| `npm run prisma:migrate` | Create & apply a dev migration |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run lint` / `npm run format` | Lint / format |

## API reference

All routes are prefixed with `/api`. Everything except `Auth` and `health` requires
`Authorization: Bearer <accessToken>`.

### Auth (public)
| Method | Path | Body |
| --- | --- | --- |
| POST | `/auth/register` | `{ email, password, name?, openingSavings? }` |
| POST | `/auth/login` | `{ email, password }` |
| POST | `/auth/refresh` | `{ refreshToken }` |
| POST | `/auth/logout` | `{ refreshToken }` |
| POST | `/auth/forgot-password` | `{ email }` — emails a reset link (always 200) |
| POST | `/auth/reset-password` | `{ token, password }` |

### Users
| Method | Path | Body |
| --- | --- | --- |
| GET | `/users/me` | — |
| PATCH | `/users/me` | `{ name? }` |
| PATCH | `/users/me/settings` | `{ currency?, timezone?, openingSavings? }` |

### Incomes / Expenses (same shape)
| Method | Path | Notes |
| --- | --- | --- |
| POST | `/incomes` `/expenses` | create (optional client `id`) |
| GET | `/incomes` `/expenses` | list (`?from=&to=`, expenses also `?category=`) |
| GET | `/incomes/:id` | one |
| PATCH | `/incomes/:id` | update |
| DELETE | `/incomes/:id` | soft delete |

### Loans
| Method | Path | Notes |
| --- | --- | --- |
| POST | `/loans` | `{ direction: LENT \| BORROWED, personName, amount, date, note? }` |
| GET | `/loans` | list (`?direction=&status=`) |
| GET | `/loans/:id` | one |
| PATCH | `/loans/:id` | update |
| POST | `/loans/:id/settle` | mark Returned/Paid (`{ settledDate? }`) |
| DELETE | `/loans/:id` | soft delete |

### Summary (cross-check)
| Method | Path | Notes |
| --- | --- | --- |
| GET | `/summary/dashboard` | `?year=&month=&practicalBalance=` — balances, outstanding, untracked, saving, net worth |
| GET | `/summary/monthly` | `?year=&month=` — tracked monthly summary |
| GET | `/summary/history` | all-months list: income, expense, untracked, saving, opening/closing per month |
| PUT | `/summary/monthly` | month-close: store a client-computed summary (upsert by year+month) — makes per-month untracked appear in history |

### Sync
| Method | Path | Notes |
| --- | --- | --- |
| POST | `/sync/push` | `{ incomes?, expenses?, loans?, monthlySummaries? }` — LWW upsert |
| GET | `/sync/pull` | `?since=<ISO>` — changes since timestamp (tombstones included) |

### Health (public)
`GET /health` → `{ status: "ok", ... }`

## Project structure

```
src/
  auth/        register / login / refresh, JWT strategy + global guard
  users/       profile & settings
  income/      income CRUD
  expense/     expense CRUD
  loan/        loan CRUD + settle (LENT/BORROWED)
  summary/     dashboard & monthly cross-check calculations
  sync/        push + pull (Last-Write-Wins)
  prisma/      PrismaService (pg driver adapter) + global module
  common/      decorators (@Public, @CurrentUser), shared types
  generated/   Prisma client (gitignored, regenerated on install)
```
