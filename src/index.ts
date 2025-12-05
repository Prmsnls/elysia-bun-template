import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { db } from "./db";
import { users } from "./db/schema";

const app = new Elysia()
  .use(swagger())
  .get("/", () => "Hello Elysia")
  .get("/users", async () => {
    return await db.select().from(users).all();
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
