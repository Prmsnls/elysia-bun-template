---
name: convex-components
description: Convex components for building and using reusable sandboxed modules with their own schema, functions, and isolated data
---

# Convex Components - Reusable Sandboxed Backend Modules

## ⛔ CRITICAL RESTRICTIONS (Read First!)

Components run in a **sandboxed environment** with these hard limits:

| Restriction | What Fails | Workaround |
|-------------|------------|------------|
| **NO `"use node"` directive** | `"use node";` at top of file | Use only V8-compatible APIs (fetch, btoa, atob, crypto.subtle) |
| **NO Node.js APIs** | `Buffer`, `fs`, `path`, `crypto` (Node) | Use `btoa()`/`atob()` for base64, Web Crypto API |
| **NO `process.env`** | `process.env.API_KEY` | Pass env vars as function arguments from parent app |
| **NO `ctx.auth`** | `ctx.auth.getUserIdentity()` | Pass user ID explicitly from parent app |
| **NO HTTP routes** | `httpAction` in component | Export handler, mount in app's http.ts |
| **NO `.paginate()`** | Built-in pagination | Use `convex-helpers/server/pagination` |
| **`internal*` NOT exposed** | `internalMutation`, `internalAction`, `internalQuery` | Use public `mutation`/`action`/`query` for parent-callable functions |

### Function Visibility (CRITICAL)

```typescript
// ❌ WRONG - Parent app CANNOT call internal functions
export const _sync = internalMutation({ ... }); // NOT accessible via components.myComponent._sync

// ✅ CORRECT - Parent app CAN call public functions  
export const sync = mutation({ ... }); // Accessible via components.myComponent.sync
```

**Only `query`, `mutation`, `action` are exposed at component boundaries.** Internal functions are only callable within the component itself.

---

## What are Convex Components?

Convex Components are **self-contained backend modules** that bundle:
- **Functions** (queries, mutations, actions)
- **Schema** (their own database tables)
- **Data** (isolated storage and state)
- **Scheduled functions** (their own background jobs)

They provide:
- **Isolation** - Cannot access your app's data unless explicitly provided
- **Encapsulation** - Clean API boundaries with validation
- **Transactional guarantees** - Data changes commit atomically across component calls
- **Reusability** - Share functionality between apps predictably

## Using Components

### Installation

```bash
# Install from npm
npm i @convex-dev/agent
```

### Configure in convex.config.ts

```typescript
// convex/convex.config.ts
import { defineApp } from "convex/server";
import agent from "@convex-dev/agent/convex.config.js";
import ratelimiter from "@convex-dev/ratelimiter/convex.config.js";

const app = defineApp();

// Install components
app.use(agent);
app.use(ratelimiter);

// Multiple instances with different names
app.use(agent, { name: "agent2" });

export default app;
```

### Run convex dev to generate code

```bash
# IMPORTANT: Run after adding/modifying component to regenerate types
npx convex dev --once --typecheck=enable

# Or for continuous development
npx convex dev
```

**After adding a component to `convex.config.ts`, you MUST run codegen to generate `_generated/` files.**

### Access Component API

```typescript
import { components } from "./_generated/api.js";
import { internalAction } from "./_generated/server";

export const myAction = internalAction({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    // Call component's API directly
    const { status } = await ctx.runQuery(
      components.agent.threads.getThread,
      { threadId: args.threadId }
    );
    
    // Or use component's wrapper class
    const agent = new Agent(components.agent, { /* options */ });
    await agent.someMethod(ctx, args);
  },
});
```

## Authoring Components

### Component Structure

```
my-component/
├── _generated/           # Generated code (don't edit)
│   ├── api.d.ts
│   ├── component.ts      # ComponentApi type
│   ├── dataModel.d.ts
│   └── server.d.ts
├── convex.config.ts      # Component configuration
├── schema.ts             # Component's private schema
└── myFunctions.ts        # Queries, mutations, actions
```

### Define Component Config

```typescript
// my-component/convex.config.ts
import { defineComponent } from "convex/server";

const component = defineComponent("myComponent");

// Optionally use child components
// import workpool from "@convex-dev/workpool/convex.config.js";
// component.use(workpool);

export default component;
```

### Define Component Schema

```typescript
// my-component/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Component's private tables
  items: defineTable({
    name: v.string(),
    value: v.number(),
    ownerId: v.string(), // Note: use string, not v.id() for external IDs
  }).index("by_owner", ["ownerId"]),
  
  // Globals table for configuration
  globals: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),
});
```

### Define Component Functions

```typescript
// my-component/items.ts
import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server.js";

// ✅ PUBLIC function - accessible by parent app via components.myComponent.items.list
export const list = query({
  args: { ownerId: v.string() },
  returns: v.array(v.object({
    _id: v.string(), // IDs become strings at component boundary
    name: v.string(),
    value: v.number(),
  })),
  handler: async (ctx, { ownerId }) => {
    const items = await ctx.db
      .query("items")
      .withIndex("by_owner", q => q.eq("ownerId", ownerId))
      .collect();
    
    // Convert IDs to strings for external use
    return items.map(item => ({
      _id: item._id.toString(),
      name: item.name,
      value: item.value,
    }));
  },
});

// ✅ PUBLIC mutation - parent can call components.myComponent.items.create
export const create = mutation({
  args: { 
    ownerId: v.string(),
    name: v.string(), 
    value: v.number() 
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("items", args);
    return id.toString();
  },
});

// ✅ PUBLIC action for external API calls (NO "use node" allowed!)
export const fetchExternal = action({
  args: { url: v.string(), token: v.string() },
  handler: async (ctx, { url, token }) => {
    // Use fetch (works in components) - NOT axios or Node.js http
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return await response.json();
  },
});
```

**Remember: Only `query`, `mutation`, `action` are exposed. Do NOT use `internalMutation` etc. for functions the parent needs to call.**

### Install Local Component in App

```typescript
// convex/convex.config.ts
import { defineApp } from "convex/server";
import myComponent from "../my-component/convex.config.js";

const app = defineApp();
app.use(myComponent);

export default app;
```

## Key Differences from Regular Development

### ⛔ NO Node.js Runtime

```typescript
// ❌ WRONG - Components cannot use Node.js runtime
"use node";
import { Buffer } from "buffer";

export const myAction = action({
  handler: async (ctx, args) => {
    const encoded = Buffer.from(str).toString("base64"); // FAILS
  },
});

// ✅ CORRECT - Use V8-compatible Web APIs
export const myAction = action({
  handler: async (ctx, args) => {
    const encoded = btoa(str); // Works!
    const decoded = atob(encoded); // Works!
    
    // For binary data, use Uint8Array + manual conversion
    const bytes = new TextEncoder().encode(str);
    const base64 = btoa(String.fromCharCode(...bytes));
  },
});
```

### No ctx.auth Access

```typescript
// Components cannot access ctx.auth
// Pass authentication info explicitly

// In your app:
export const appMutation = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    
    // Pass userId to component
    await ctx.runMutation(components.myComponent.items.create, {
      ownerId: userId, // Explicit user ID
      name: "Item",
      value: 42,
    });
  },
});
```

### No process.env Access

```typescript
// Components cannot access environment variables
// Pass them explicitly from the app

export const appAction = action({
  args: {},
  handler: async (ctx) => {
    await ctx.runAction(components.myComponent.external.call, {
      apiKey: process.env.API_KEY, // Pass env var
      data: { /* ... */ },
    });
  },
});
```

### ID Types Become Strings

```typescript
// Inside component: use v.id("tableName")
// At component boundary: becomes v.string()

// Component function
export const getItem = query({
  args: { itemId: v.string() }, // String at boundary
  returns: v.object({ 
    _id: v.string(),            // String at boundary
    name: v.string() 
  }),
  handler: async (ctx, { itemId }) => {
    const item = await ctx.db.get(itemId as any); // Cast inside
    return { _id: item._id.toString(), name: item.name };
  },
});
```

### No HTTP Actions

```typescript
// Components cannot define HTTP routes directly
// Export handlers for app to mount

// Component: export handler
export const webhookHandler = httpAction(async (ctx, request) => {
  // Handle webhook
  return new Response("OK");
});

// App's convex/http.ts: mount handler
import { components } from "./_generated/api";

http.route({
  path: "/webhook/myComponent",
  method: "POST",
  handler: components.myComponent.webhookHandler,
});
```

### Use convex-helpers for Pagination

```typescript
// Built-in .paginate() doesn't work in components
// Use paginator from convex-helpers

import { paginator } from "convex-helpers/server/pagination";

export const listPaginated = query({
  args: { 
    cursor: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, { cursor, limit }) => {
    return await paginator(ctx.db, "items", { cursor, limit });
  },
});
```

## Function Handles

For callbacks from component to app functions:

```typescript
import { createFunctionHandle, FunctionHandle } from "convex/server";

// In app: create handle and pass to component
export const setupCallback = mutation({
  args: {},
  handler: async (ctx) => {
    const handle = await createFunctionHandle(api.myCallbacks.onComplete);
    
    await ctx.runMutation(components.workflow.start, {
      callbackHandle: handle, // Pass as string
    });
  },
});

// In component: use handle to call back
export const complete = mutation({
  args: { callbackHandle: v.string() },
  handler: async (ctx, { callbackHandle }) => {
    const handle = callbackHandle as FunctionHandle<"mutation">;
    await ctx.runMutation(handle, { result: "done" });
  },
});
```

## Client Wrapper Patterns

### Simple Function Wrapper

```typescript
// src/client/index.ts
import type { ComponentApi } from "../component/_generated/component.js";

export async function createItem(
  ctx: MutationCtx,
  component: ComponentApi,
  args: { name: string; value: number }
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  
  return await ctx.runMutation(component.items.create, {
    ownerId: userId,
    ...args,
  });
}
```

### Class-Based Client

```typescript
// src/client/index.ts
export class MyComponent {
  constructor(
    public component: ComponentApi,
    private options?: { apiKey?: string }
  ) {}
  
  async create(ctx: MutationCtx, args: { name: string }) {
    const userId = await getAuthUserId(ctx);
    return await ctx.runMutation(this.component.items.create, {
      ownerId: userId,
      apiKey: this.options?.apiKey ?? process.env.API_KEY,
      ...args,
    });
  }
  
  async list(ctx: QueryCtx) {
    const userId = await getAuthUserId(ctx);
    return await ctx.runQuery(this.component.items.list, {
      ownerId: userId,
    });
  }
}

// Usage in app:
const myComponent = new MyComponent(components.myComponent, {
  apiKey: process.env.MY_API_KEY,
});

export const listItems = query({
  args: {},
  handler: async (ctx) => {
    return await myComponent.list(ctx);
  },
});
```

## Publishing NPM Components

### Create from Template

```bash
npm create convex@latest -- --component
```

### Package.json Exports

```json
{
  "name": "@your/component",
  "exports": {
    ".": "./dist/client/index.js",
    "./convex.config.js": "./dist/component/convex.config.js",
    "./_generated/component.js": "./dist/component/_generated/component.js",
    "./test": "./src/test.ts"
  }
}
```

### Build Process

```bash
# 1. Generate component code
npx convex codegen --component-dir ./src/component

# 2. Build package
npm run build

# 3. Run example app with type checking
npx convex dev --typecheck-components
```

## Testing Components

### Register Component in Tests

```typescript
// tests/myComponent.test.ts
import { test, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../my-component/schema";

const modules = import.meta.glob("../my-component/**/*.ts");

function initConvexTest() {
  const t = convexTest();
  t.registerComponent("myComponent", schema, modules);
  return t;
}

test("create and list items", async () => {
  const t = initConvexTest();
  
  await t.run(async (ctx) => {
    // Create item
    const itemId = await ctx.runMutation(
      components.myComponent.items.create,
      { ownerId: "user1", name: "Test", value: 42 }
    );
    
    // List items
    const items = await ctx.runQuery(
      components.myComponent.items.list,
      { ownerId: "user1" }
    );
    
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Test");
  });
});
```

### Export Test Helpers

```typescript
// src/test.ts
import type { TestConvex } from "convex-test";
import schema from "./component/schema.js";

const modules = import.meta.glob("./component/**/*.ts");

export function register(t: TestConvex, name = "myComponent") {
  t.registerComponent(name, schema, modules);
}

export default { register, schema, modules };
```

## Transaction Behavior

### Sub-transactions for Component Calls

```typescript
// Each component mutation call is a sub-transaction
// If component throws, only its writes are rolled back

export const appMutation = mutation({
  args: {},
  handler: async (ctx) => {
    // Write to app's database
    await ctx.db.insert("logs", { action: "start" });
    
    try {
      // Component mutation - its own sub-transaction
      await ctx.runMutation(components.rateLimiter.limit, {
        key: "user123",
        throws: true, // Throws if rate limited
      });
      
      // Continue if not rate limited
      await ctx.db.insert("logs", { action: "allowed" });
    } catch (e) {
      // Component's writes rolled back
      // App can continue with different path
      await ctx.db.insert("logs", { action: "rate_limited" });
    }
  },
});
```

## Best Practices

1. **Always validate arguments and returns** in public functions
2. **Pass auth info explicitly** instead of relying on ctx.auth
3. **Pass env vars explicitly** through function arguments
4. **Use strings for IDs** at component boundaries
5. **Use function handles** for callbacks from component to app
6. **Export test helpers** for users of your component
7. **Wrap with client classes** for better developer experience
8. **Use globals table** for static configuration
9. **Mount HTTP handlers** in app's http.ts
10. **Use convex-helpers** for pagination in components

## Common Mistakes (Avoid These!)

| Mistake | Error You'll See | Fix |
|---------|------------------|-----|
| Adding `"use node";` | "Components cannot use Node.js runtime" | Remove directive, use Web APIs |
| Using `Buffer` | "Buffer is not defined" | Use `btoa()`/`atob()` |
| Using `internalMutation` for parent-callable fn | Function not found in `components.x` | Use `mutation` instead |
| Using `internalAction` for parent-callable fn | Function not found in `components.x` | Use `action` instead |
| Accessing `process.env` | "process is not defined" | Pass env vars as args |
| Accessing `ctx.auth` | Auth undefined or missing | Pass userId as arg |
| Forgetting to run codegen | Import errors for `_generated` | Run `convex dev --once` |
| Using `.paginate()` | Pagination not supported | Use `convex-helpers` paginator |

## Popular Convex Components

| Component | Purpose |
|-----------|---------|
| **@convex-dev/agent** | AI agents and threads |
| **@convex-dev/ratelimiter** | Rate limiting |
| **@convex-dev/workflow** | Durable workflows |
| **@convex-dev/workpool** | Background job queues |
| **@convex-dev/aggregate** | Data aggregation |
| **@convex-dev/migrations** | Database migrations |
| **@convex-dev/crons** | Runtime cron jobs |
| **@convex-dev/auth** | Authentication |

Browse all components at [convex.dev/components](https://convex.dev/components)