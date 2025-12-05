# Setup & Commands

## Prerequisites
- [Bun](https://bun.sh) installed
- Docker (optional, for containerization)

## Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
- `TURSO_DATABASE_URL`: URL for Turso DB (optional)
- `TURSO_AUTH_TOKEN`: Auth token for Turso DB (optional)

## Scripts
- `bun dev`: Start development server (watch mode)
- `bun run docker:up`: Build and run Docker container
- `bun run docker:build`: Build Docker image
- `bun run db:generate`: Generate Drizzle migrations
- `bun run db:migrate`: Apply migrations
- `bun run db:push`: Push schema changes directly to DB
- `bun run db:studio`: Open Drizzle Studio
