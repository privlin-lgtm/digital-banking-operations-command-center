# BankOps Control Center

Digital banking operations command platform: alerts, cases, customers, and payments — with an Express API, Next.js desk UI, PostgreSQL, and a Prometheus/Grafana observability stack.

## Stack

| Layer            | Technology                                     |
| ---------------- | ---------------------------------------------- |
| Frontend         | Next.js 15, React 19, TypeScript, Tailwind CSS |
| Backend          | Express 5, TypeScript, Prisma, PostgreSQL      |
| Shared contracts | `@bankops/shared` workspace package            |
| Observability    | Prometheus, Grafana, `prom-client`             |
| Tooling          | ESLint 9, Prettier, Husky, lint-staged, Vitest |
| Runtime          | Docker Compose, Node.js 22+                    |

## Repository layout

```text
.
├── apps/
│   ├── api/                 Express + Prisma API
│   └── web/                 Next.js App Router UI
├── packages/
│   └── shared/              Cross-app enums and DTOs
├── infra/
│   ├── prometheus/          Scrape config
│   └── grafana/             Provisioned datasource + dashboard
├── docker-compose.yml
├── docker-compose.dev.yml
├── eslint.config.mjs
├── .prettierrc.json
├── tsconfig.base.json
└── package.json             npm workspaces root
```

## Prerequisites

- Node.js 22 or newer (see `.nvmrc`)
- npm 10+
- Docker Desktop (PostgreSQL, Prometheus, Grafana, optional full stack)
- Git

## Exact initialization commands

Run these from the repository root. Git is already initialized in this folder.

### 1. Environment files

**PowerShell**

```powershell
cd "c:\Users\privlin\OneDrive\מסמכים\VSCode\Projects\digital-banking-operations-command-center"

Copy-Item .env.example .env
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\web\.env.example apps\web\.env
```

**bash / zsh**

```bash
cd digital-banking-operations-command-center
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Replace `JWT_SECRET` and `GF_SECURITY_ADMIN_PASSWORD` before any non-local deployment.

### 2. Install workspace dependencies

```bash
npm install
```

This installs root tooling and every workspace (`@bankops/api`, `@bankops/web`, `@bankops/shared`).

### 3. Start PostgreSQL

```bash
docker compose up -d postgres
```

Wait until the container is healthy:

```bash
docker compose ps
```

### 4. Generate the Prisma client and apply schema

If you are creating the first migration on a fresh clone that already includes `prisma/migrations`:

```bash
npm run db:generate
npm run db:migrate
```

If you are bootstrapping migrations yourself:

```bash
npm run db:generate
npx prisma migrate dev --name init --schema apps/api/prisma/schema.prisma
```

### 5. Seed the operator account and sample records

```bash
npm run db:seed
```

Local seed operator (override via `apps/api/.env`):

| Field    | Value                 |
| -------- | --------------------- |
| Email    | `oscar.d@example.net` |
| Password | `ChangeMe!Admin1`     |

### 6. Run the applications

```bash
npm run dev
```

- Web: http://localhost:3000
- API health: http://localhost:4000/api/v1/health
- API metrics: http://localhost:4000/api/v1/metrics

### 7. Observability stack (optional)

```bash
docker compose up -d prometheus grafana
```

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (default admin / `admin` unless overridden)

The **BankOps API** dashboard is provisioned automatically.

### Full stack in Docker

```bash
docker compose up --build
```

Hot-reload development overlay:

```bash
npm run docker:dev
```

## Everyday scripts

| Command               | Purpose                  |
| --------------------- | ------------------------ |
| `npm run dev`         | API + web in parallel    |
| `npm run lint`        | ESLint across workspaces |
| `npm run typecheck`   | `tsc --noEmit`           |
| `npm test`            | API Vitest suite         |
| `npm run format`      | Prettier write           |
| `npm run db:studio`   | Prisma Studio            |
| `npm run docker:down` | Stop compose services    |

## API surface (initial)

| Method | Path                   | Auth                   |
| ------ | ---------------------- | ---------------------- |
| `GET`  | `/api/v1/health`       | public                 |
| `GET`  | `/api/v1/health/ready` | public (DB ping)       |
| `GET`  | `/api/v1/metrics`      | public (scrape target) |
| `POST` | `/api/v1/auth/login`   | public                 |
| `POST` | `/api/v1/auth/logout`  | cookie / bearer        |
| `GET`  | `/api/v1/auth/me`      | cookie / bearer        |
| `GET`  | `/api/v1/users`        | `ADMIN`                |
| `GET`  | `/api/v1/customers`    | authenticated          |
| `GET`  | `/api/v1/transactions` | authenticated          |
| `GET`  | `/api/v1/alerts`       | authenticated          |
| `GET`  | `/api/v1/cases`        | authenticated          |
| `GET`  | `/api/v1/audit-logs`   | authenticated          |

Access tokens are issued as the `bankops_access` httpOnly cookie and are also returned in the login JSON for non-browser clients.

## Engineering standards

- Strict TypeScript (`strict`, `noUncheckedIndexedAccess`)
- Workspace-shared contracts instead of duplicated enums
- Request IDs on every response (`x-request-id`)
- Structured logging (Pino) with secret redaction
- Helmet, CORS allowlist, JSON body limit, rate limiting
- Central `AppError` + Zod validation mapping
- Graceful shutdown and container health checks
- Multi-stage Dockerfiles, non-root runtime users
- CI: format, lint, typecheck, test

## Security notes

- Never commit `.env` files
- Rotate `JWT_SECRET` and Grafana credentials before shared environments
- Metrics are unauthenticated on the local compose network; restrict them in production
- Seed credentials are for local development only
