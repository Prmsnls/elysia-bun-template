import { defineConfig } from "drizzle-kit";

let url: string = "file:local.db";
if (Bun.env.TURSO_DATABASE_URL) {
  url = Bun.env.TURSO_DATABASE_URL;
  if (Bun.env.TURSO_AUTH_TOKEN) {
    url += `?authToken=${Bun.env.TURSO_AUTH_TOKEN}`;
  }
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url,
  },
});
