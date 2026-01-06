---
name: convex-queries
description: Convex query functions for reactive data fetching - patterns, filtering, pagination, joins, and performance optimization
---

# Convex Queries

## Quick Reference

| Pattern | Example |
|---------|---------|
| Import | `import { query } from "./_generated/server";` |
| Single doc | `await ctx.db.get(id)` |
| All docs | `await ctx.db.query("table").collect()` |
| With index | `.withIndex("by_x", q => q.eq("x", val))` |
| Order | `.order("desc")` |
| Limit | `.take(10)` or `.first()` |

## Before You Start

```bash
# MUST run after schema changes to generate types
bunx convex dev --once --typecheck=enable
```

## Imports

```typescript
// Main app queries
import { query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Internal queries (callable only from other functions)
import { internalQuery } from "./_generated/server";

// For helper functions needing context type
import { query, QueryCtx } from "./_generated/server";
```

## Basic Patterns

### Query with Validators
```typescript
export const getTask = query({
  args: { taskId: v.id("tasks") },
  returns: v.union(
    v.object({ _id: v.id("tasks"), text: v.string() }),
    v.null()
  ),
  handler: async (ctx, { taskId }) => {
    return await ctx.db.get(taskId);
  },
});
```

### Query All
```typescript
export const listTasks = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("tasks").collect();
  },
});
```

### Query with Index (ALWAYS prefer over filter)
```typescript
export const getByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    return await ctx.db
      .query("tasks")
      .withIndex("by_project", q => q.eq("projectId", projectId))
      .collect();
  },
});
```

## Index Queries

### Equality
```typescript
.withIndex("by_status", q => q.eq("status", "active"))
```

### Range
```typescript
.withIndex("by_date", q => 
  q.gte("date", startDate).lte("date", endDate)
)
```

### Compound Index
```typescript
// Schema: .index("by_user_status", ["userId", "status"])
.withIndex("by_user_status", q => 
  q.eq("userId", userId).eq("status", "active")
)
```

## Retrieving Results

| Method | Returns | Use When |
|--------|---------|----------|
| `.collect()` | All documents | Need full list |
| `.take(n)` | First n docs | Pagination, limits |
| `.first()` | First doc or null | Expect 0-1 result |
| `.unique()` | Single doc or null | Enforce uniqueness |

```typescript
// Get first 20
const recent = await ctx.db.query("tasks").order("desc").take(20);

// Get single by unique field
const user = await ctx.db
  .query("users")
  .withIndex("by_email", q => q.eq("email", email))
  .unique(); // Throws if >1 result
```

## Authentication

```typescript
export const getMyTasks = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", q => 
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .unique();
    
    if (!user) throw new Error("User not found");
    
    return await ctx.db
      .query("tasks")
      .withIndex("by_user", q => q.eq("userId", user._id))
      .collect();
  },
});
```

## Joins (Batch Fetch)

```typescript
export const tasksWithAuthors = query({
  args: {},
  handler: async (ctx) => {
    const tasks = await ctx.db.query("tasks").collect();
    
    // Deduplicate IDs, batch fetch
    const authorIds = [...new Set(tasks.map(t => t.authorId))];
    const authors = await Promise.all(
      authorIds.map(id => ctx.db.get(id))
    );
    
    const authorMap = new Map(
      authors.filter(Boolean).map(a => [a!._id, a])
    );
    
    return tasks.map(t => ({
      ...t,
      author: authorMap.get(t.authorId) ?? null,
    }));
  },
});
```

## Helper Functions

```typescript
import { QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

async function getUser(ctx: QueryCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");
  return user;
}
```

## Internal Queries

```typescript
import { internalQuery } from "./_generated/server";

// Prefix with _ for clarity (convention, not required)
export const _getTaskInternal = internalQuery({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    return await ctx.db.get(taskId);
  },
});
```

## Common Errors & Fixes

### Error: Property does not exist on type
```typescript
// Cause: Codegen not run after schema change
// Fix:
bunx convex dev --once --typecheck=enable
```

### Error: Cannot use fetch
```typescript
// Cause: Queries cannot call external APIs
// Fix: Use actions for external calls
```

### Slow Query Performance
```typescript
// BAD - full table scan
.filter(q => q.eq(q.field("status"), "active"))

// GOOD - use index
.withIndex("by_status", q => q.eq("status", "active"))
```

### Null vs Undefined
```typescript
// undefined returned → converted to null on client
// Always check for null in client code
const task = useQuery(api.tasks.get, { id }); // null if not found
```

## Components (Different Rules)

In Convex components (`convex/components/**/`):

```typescript
// CORRECT - components use regular mutation/query
import { query, mutation } from "./_generated/server";

// WRONG - no internalQuery in components
import { internalQuery } from "./_generated/server"; // ERROR

// WRONG - no "use node" directive in components
"use node"; // ERROR

// WRONG - no Buffer, use btoa/atob
Buffer.from(str).toString("base64"); // ERROR
btoa(str); // CORRECT
```

## Best Practices

1. **Always use indexes** for queries on large tables
2. **Run codegen** after schema changes: `bunx convex dev --once`
3. **Use `v.id("tableName")`** for document ID args
4. **Batch fetch** related docs to avoid N+1
5. **Add return validators** for type safety
6. **Use internal queries** for server-only logic
