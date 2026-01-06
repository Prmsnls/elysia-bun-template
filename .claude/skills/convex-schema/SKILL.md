---
name: convex-schema
description: Convex schema definition and data modeling patterns - validators, indexes, TypeScript types, and migration strategies
---

# Convex Schema - Database Schema and Data Modeling

## Schema Fundamentals

A Convex schema describes:
1. **Tables** in your Convex project
2. **Document types** within each table
3. **Indexes** for query performance
4. **Validation rules** for data integrity

### Basic Schema Structure

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    body: v.string(),
    author: v.string(),
    createdAt: v.number(),
  })
  .index("by_author", ["author"])
  .index("by_creation_time", ["createdAt"]),
  
  users: defineTable({
    name: v.string(),
    email: v.string(),
    avatarUrl: v.optional(v.string()),
  })
  .index("by_email", ["email"]),
});
```

## Data Types and Validators

### Basic Types
```typescript
defineTable({
  string: v.string(),
  number: v.number(),
  boolean: v.boolean(),
  null: v.null(),
  any: v.any(),
})
```

### Complex Types

#### Optional Fields
```typescript
defineTable({
  bio: v.optional(v.string()),
  age: v.optional(v.number()),
})
```

#### Union Types
```typescript
defineTable({
  status: v.union(v.literal("success"), v.literal("error"), v.literal("pending")),
})
```

#### Nested Objects
```typescript
defineTable({
  address: v.object({
    street: v.string(),
    city: v.string(),
    zip: v.string(),
  }),
})
```

#### Arrays
```typescript
defineTable({
  tags: v.array(v.string()),
  scores: v.array(v.number()),
})
```

#### Document References
```typescript
defineTable({
  author: v.id("users"),           // Reference to users table
  thread: v.optional(v.id("threads")),
})
```

#### Record Types
```typescript
defineTable({
  settings: v.record(v.string(), v.boolean()),
})
```

## Indexes for Performance

### Single Field Index
```typescript
defineTable({
  email: v.string(),
})
.index("by_email", ["email"])
```

### Composite Index
```typescript
defineTable({
  author: v.id("users"),
  channel: v.string(),
  createdAt: v.number(),
})
.index("by_author_and_channel", ["author", "channel"])
.index("by_channel_and_time", ["channel", "createdAt"])
```

### Query with Index
```typescript
export const getMessagesByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_author", q => q.eq("author", userId))
      .collect();
  },
});
```

## Common Pitfalls

### Missing Indexes
```typescript
// BAD - Slow filter without index
.filter(q => q.eq(q.field("author"), userId))

// GOOD - Use index
.withIndex("by_author", q => q.eq("author", userId))
```

### Handling Circular References
```typescript
// Make one reference nullable to break circular dependency
defineTable({
  userId: v.union(v.id("users"), v.null()),
})
```

## Best Practices

1. **Start without schema** for rapid prototyping
2. **Add schema early** for type safety in production
3. **Define indexes** for all query patterns
4. **Use specific types** instead of `v.any()`
5. **Make fields optional** when adding new schema fields
6. **Use discriminated unions** for variant document types