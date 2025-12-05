# Project Architecture

## Overview
This is a backend API built with **Bun** and **ElysiaJS**. It uses **Turso (libSQL)** as the database and **Drizzle ORM** for data access.

## Directory Structure
- `src/`: Source code
  - `index.ts`: Entry point and server configuration
  - `db/`: Database configuration and schema
    - `index.ts`: DB connection setup (handles Turso or local fallback)
    - `schema.ts`: Drizzle schema definitions
- `drizzle.config.ts`: Drizzle Kit configuration
- `Dockerfile`: Multi-stage Docker build for Bun

## Database
The project uses Drizzle ORM with libSQL.
- **Production/Remote**: Connects to Turso using `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`.
- **Local/Fallback**: Uses a local SQLite file (`file:local.db`) if credentials are missing.
