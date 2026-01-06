---
name: convex-mutations
description: Convex mutation functions for data modification - CRUD operations, transactions, validation, and error handling patterns
---

# Convex Mutations

## Quick Reference

| Operation | Example |
|-----------|---------|
| Insert | `await ctx.db.insert("table", { field: value })` |
| Get | `await ctx.db.get(id)` |
| Patch | `await ctx.db.patch(id, { field: newValue })` |
| Replace | `await ctx.db.replace(id, { ...newDoc })` |
| Delete | `await ctx.db.delete(id)` |

## Before You Start

```bash
# MUST run after schema changes to generate types
bunx convex dev --once --typecheck=enable
```

## Imports

```typescript
// Main app mutations
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Internal mutations (callable only from other functions)
import { internalMutation } from "./_generated/server";

// For helper functions
import { mutation, MutationCtx } from "./_generated/server";

// For application errors
import { ConvexError } from "convex/values";
```

## CRUD Operations

### Create
```typescript
export const create = mutation({
  args: { text: v.string() },
  returns: v.id("tasks"),
  handler: async (ctx, { text }) => {
    return await ctx.db.insert("tasks", {
      text,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});
```

### Read + Update (Patch)
```typescript
export const update = mutation({
  args: { 
    id: v.id("tasks"), 
    text: v.optional(v.string()),
  },
  handler: async (ctx, { id, text }) => {
    const existing = await ctx.db.get(id);
    if (!existing) throw new ConvexError("Not found");
    
    await ctx.db.patch(id, {
      ...(text !== undefined && { text }),
      updatedAt: Date.now(),
    });
  },
});
```

### Delete
```typescript
export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    const task = await ctx.db.get(id);
    if (!task) throw new ConvexError("Not found");
    await ctx.db.delete(id);
  },
});
```

## Patch vs Replace

| Method | Behavior |
|--------|----------|
| `patch` | Shallow merge - updates specified fields only |
| `replace` | Full replace - removes unspecified fields |

```typescript
// Original: { text: "foo", status: "pending", priority: 1 }

// After patch({ status: "done" })
// Result: { text: "foo", status: "done", priority: 1 }

// After replace({ text: "bar" })
// Result: { text: "bar" } - other fields removed!

// Unset a field with patch
await ctx.db.patch(id, { optionalField: undefined });
```

## Transactions (Automatic)

All operations in a mutation are atomic:

```typescript
export const transfer = mutation({
  args: {
    from: v.id("accounts"),
    to: v.id("accounts"),
    amount: v.number(),
  },
  handler: async (ctx, { from, to, amount }) => {
    const [fromAcc, toAcc] = await Promise.all([
      ctx.db.get(from),
      ctx.db.get(to),
    ]);
    
    if (!fromAcc || !toAcc) throw new ConvexError("Account not found");
    if (fromAcc.balance < amount) throw new ConvexError("Insufficient funds");
    
    // Both happen atomically - if one fails, both rollback
    await Promise.all([
      ctx.db.patch(from, { balance: fromAcc.balance - amount }),
      ctx.db.patch(to, { balance: toAcc.balance + amount }),
    ]);
  },
});
```

## Bulk Operations

Loop in mutations - Convex batches all writes:

```typescript
export const bulkCreate = mutation({
  args: { items: v.array(v.object({ text: v.string() })) },
  handler: async (ctx, { items }) => {
    const ids = [];
    for (const item of items) {
      ids.push(await ctx.db.insert("tasks", item));
    }
    return ids;
  },
});
```

## Scheduling from Mutations

```typescript
import { internal } from "./_generated/api";

export const createOrder = mutation({
  args: { items: v.array(v.id("products")) },
  handler: async (ctx, { items }) => {
    const orderId = await ctx.db.insert("orders", {
      items,
      status: "pending",
    });
    
    // Run action immediately (for external API calls)
    await ctx.scheduler.runAfter(0, internal.orders.processPayment, {
      orderId,
    });
    
    // Run in future
    await ctx.scheduler.runAfter(
      24 * 60 * 60 * 1000, // 24 hours
      internal.orders.sendReminder,
      { orderId }
    );
    
    return orderId;
  },
});
```

## Error Handling

### ConvexError (reaches client with data)
```typescript
import { ConvexError } from "convex/values";

// Simple string
throw new ConvexError("Task not found");

// Structured (accessible on client)
throw new ConvexError({
  code: "NOT_FOUND",
  message: "Task not found",
  taskId: args.id,
});
```

### Client-Side Handling
```typescript
import { ConvexError } from "convex/values";

try {
  await createTask({ text: "" });
} catch (error) {
  if (error instanceof ConvexError) {
    // Application error - show to user
    const { code, message } = error.data as { code: string; message: string };
    alert(message);
  } else {
    // Developer error - generic message
    alert("Something went wrong");
  }
}
```

## Authentication

```typescript
export const createMyTask = mutation({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", q => 
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    
    if (!user) throw new ConvexError("User not found");
    
    return await ctx.db.insert("tasks", {
      text,
      userId: user._id,
    });
  },
});
```

## Internal Mutations

```typescript
import { internalMutation } from "./_generated/server";

// Prefix with _ for clarity
export const _updateInternal = internalMutation({
  args: { id: v.id("tasks"), data: v.any() },
  handler: async (ctx, { id, data }) => {
    await ctx.db.patch(id, data);
  },
});
```

## Helper Functions

```typescript
import { MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

async function ensureUser(ctx: MutationCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user) throw new ConvexError("User not found");
  return user;
}

async function logAction(ctx: MutationCtx, action: string) {
  await ctx.db.insert("auditLog", { action, timestamp: Date.now() });
}
```

## Validation Patterns

```typescript
export const createUser = mutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, { name, email }) => {
    // Validate
    if (name.trim().length === 0) {
      throw new ConvexError("Name required");
    }
    
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ConvexError("Invalid email");
    }
    
    // Check uniqueness
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", q => q.eq("email", email.toLowerCase()))
      .unique();
    
    if (existing) {
      throw new ConvexError({ code: "EMAIL_EXISTS", message: "Email taken" });
    }
    
    return await ctx.db.insert("users", {
      name: name.trim(),
      email: email.toLowerCase(),
    });
  },
});
```

## Common Errors & Fixes

### Error: Cannot use fetch
```typescript
// Cause: Mutations cannot call external APIs
// Fix: Schedule an action
await ctx.scheduler.runAfter(0, internal.api.callExternal, { data });
```

### Floating Promises
```typescript
// BAD - not awaited
ctx.db.insert("tasks", { text });

// GOOD
await ctx.db.insert("tasks", { text });
```

### Property does not exist
```typescript
// Cause: Codegen not run after schema change
// Fix:
bunx convex dev --once --typecheck=enable
```

### Validator null Issues
```typescript
// BAD - v.null() in array options
v.array(v.union(v.string(), v.null())) // Issues with some validators

// GOOD - use v.optional for nullable fields
v.optional(v.array(v.string()))
```

## Components (Different Rules)

In Convex components (`convex/components/**/`):

```typescript
// CORRECT - components use regular mutation/query
import { mutation, query } from "./_generated/server";

// WRONG - no internalMutation in components
import { internalMutation } from "./_generated/server"; // ERROR

// WRONG - no "use node" directive
"use node"; // ERROR

// WRONG - no Buffer
Buffer.from(str).toString("base64"); // ERROR
btoa(str); // CORRECT
```

## Best Practices

1. **Always validate inputs** before database operations
2. **Check existence** before update/delete
3. **Use ConvexError** for expected failures
4. **Await all promises** - floating promises may not complete
5. **Run codegen** after schema changes
6. **Normalize data** - lowercase emails, trim whitespace
7. **Add timestamps** - `createdAt`, `updatedAt`
8. **Use internal mutations** for sensitive operations
9. **Schedule actions** for external API calls
