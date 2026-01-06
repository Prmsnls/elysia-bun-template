---
name: convex-best-practices
description: Convex best practices and anti-patterns - code organization, performance, security, testing, and production deployment patterns based on official documentation
---

# Convex Best Practices - Official Patterns and Anti-Patterns

> Based on the official Convex documentation and community best practices. These patterns ensure optimal performance, security, and maintainability.

## The Zen of Convex - Core Philosophy

### Performance Principles

#### Double Down on the Sync Engine
**Core Philosophy**: The deterministic, reactive database is the heart of Convex. Centering apps around its properties ensures:
- Easier understanding and refactoring
- Sustained fast performance
- No consistency or state management problems

#### Use Queries for Nearly Every App Read
**Guideline**: Queries are the reactive, automatically cacheable, consistent, and resilient way to propagate data to applications and jobs.

**Best Practice**: With very few exceptions, every read operation in your app should happen via a query function.

#### Keep Sync Engine Functions Light & Fast
**Performance Targets**:
- Work with less than a few hundred records
- Aim to finish in less than 100ms
- Maintain snappy, responsive applications

**Warning**: It's nearly impossible to maintain responsiveness if synchronous transactions involve more work than these targets.

#### Use Actions Sparingly and Incrementally
**Action Characteristics**:
- Wonderful for batch jobs
- Excellent for integrating with outside services
- Powerful but slower and more expensive
- Fewer guarantees about behavior

**Rule**: Never use an action if a query or mutation will get the job done.

### Client-Side State Management

#### Don't Over-Complicate Client-Side State Management
**Built-in Advantages**: Convex builds in extensive caching and consistency controls into the client library.

#### Let Convex Handle Caching & Consistency
**Anti-Pattern**: Building your own local cache or state aggregation layer between components and Convex functions.

**Best Practice**: Bind components to Convex functions in simple ways and let Convex handle the performance.

#### Be Thoughtful About Mutation Return Values
**Guideline**: Mutation return values can trigger state changes, but it's rarely good to use them to set in-app state for UI updates.

**Recommendation**: Let queries and the sync engine handle UI state updates.

### Architecture Principles

#### Create Server-Side Frameworks Using "Just Code"
**Philosophy**: Convex's built-in primitives are low-level functions. Solve composition and encapsulation problems using the same methods as regular TypeScript codebases.

**Examples**: Authentication frameworks, object-relational mappings, and other server-side patterns can be built with "just code."

#### Don't Misuse Actions

**Don't Invoke Actions Directly From Your App**
**Problem**: Calling actions from the browser is generally an anti-pattern.

**Solution**: Trigger actions by invoking a mutation that both:
1. Writes the dependent record to a Convex table
2. Schedules the subsequent action to run in the background

**Don't Think 'Background Jobs', Think 'Workflow'**
**Pattern**: Write chains of effects and mutations:
```
action code → mutation → more action code → mutation
```

**Benefit**: Apps and other jobs can follow along with queries.

**Record Progress One Step at a Time**
**Best Practice**: Do smaller batches of work and perform individual transformations with outside services.

**Benefits**:
- Easy to debug issues
- Simple to resume partial jobs
- Can report incremental progress in UI

## Critical Best Practices (Official)

### 1. Await All Promises
**Why**: Convex functions use async/await. Not awaiting promises can lead to unexpected behavior or missed error handling.

**How**: Use the `no-floating-promises` ESLint rule with TypeScript.

```typescript
// ❌ BAD - Floating promise (will cause unexpected behavior)
ctx.db.insert("logs", { action: "login" }); // Not awaited!
ctx.scheduler.runAfter(1000, internal.myFunction);

// ✅ GOOD - All promises awaited
await ctx.db.insert("logs", { action: "login" });
await ctx.scheduler.runAfter(1000, internal.myFunction);
```

### 2. Avoid `.filter` on Database Queries
**Why**: Filtering in code is more readable and flexible. `.withIndex` or `.withSearchIndex` conditions are more efficient than `.filter`.

```typescript
// ❌ BAD - Filter without index (slow)
const tomsMessages = ctx.db
  .query("messages")
  .filter((q) => q.eq(q.field("author"), "Tom"))
  .collect();

// ✅ GOOD - Option 1: Use an index (fast)
const tomsMessages = await ctx.db
  .query("messages")
  .withIndex("by_author", (q) => q.eq("author", "Tom"))
  .collect();

// ✅ GOOD - Option 2: Filter in code
const allMessages = await ctx.db.query("messages").collect();
const tomsMessages = allMessages.filter((m) => m.author === "Tom");
```

**Exceptions**: Using `.filter` on paginated queries (`.paginate`) has advantages over filtering in code.

### 3. Only Use `.collect` with Small Number of Results
**Why**: All results from `.collect` count towards database bandwidth and can cause query re-runs or conflicts.

```typescript
// ❌ BAD - Potentially unbounded
const allMovies = await ctx.db.query("movies").collect();
const moviesByDirector = allMovies.filter(
  (m) => m.director === "Steven Spielberg"
);

// ✅ GOOD - Using an index
const moviesByDirector = await ctx.db
  .query("movies")
  .withIndex("by_director", (q) => q.eq("director", "Steven Spielberg"))
  .collect();

// ✅ GOOD - Using pagination
const watchedMovies = await ctx.db
  .query("watchedMovies")
  .withIndex("by_user", (q) => q.eq("user", "Tom"))
  .order("desc")
  .paginate(paginationOptions);

// ✅ GOOD - Using limits
const watchedMovies = await ctx.db
  .query("watchedMovies")
  .withIndex("by_user", (q) => q.eq("user", "Tom"))
  .take(100);
```

### 4. Check for Redundant Indexes
**Why**: Redundant indexes waste storage and increase write overhead.

```typescript
// ❌ BAD - Redundant indexes
schema.index("by_team", ["team"]);
schema.index("by_team_and_user", ["team", "user"]);
// by_team is redundant since by_team_and_user can handle the same queries

// ✅ GOOD - Minimal, efficient indexes
schema.index("by_team_and_user", ["team", "user"]);
// Exception: Keep by_team if you need sorting by _id or frequently query just userId
```

**Exceptions**: If you need sorting by different field combinations, both indexes may be necessary.

### 5. Use Argument Validators for All Public Functions
**Why**: Public functions can be called by anyone, including malicious attackers.

```typescript
// ❌ BAD - No validation (vulnerable to attacks)
export const updateMessage = mutation({
  handler: async (ctx, { id, update }) => {
    await ctx.db.patch(id, update);
  },
});

// ✅ GOOD - Comprehensive validation
export const updateMessage = mutation({
  args: {
    id: v.id("messages"),
    update: v.object({
      body: v.optional(v.string()),
      author: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, update }) => {
    // Additional business logic validation
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Message not found");
    
    await ctx.db.patch(id, update);
  },
});
```

### 6. Use Access Control for All Public Functions
**Why**: Public functions need protection against unauthorized access.

```typescript
// ❌ BAD - No access control
export const deletePost = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    await ctx.db.delete(postId); // Anyone can delete any post!
  },
});

// ❌ BAD - Using spoofable email for access control
export const updateTeam = mutation({
  args: { /* ... */, email: v.string() },
  handler: async (ctx, { id, update, email }) => {
    const teamMembers = /* load team members */;
    if (!teamMembers.some((m) => m.email === email)) {
      throw new Error("Unauthorized");
    }
    await ctx.db.patch("teams", id, update);
  },
});

// ✅ GOOD - Proper authentication and authorization
export const deletePost = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    
    const post = await ctx.db.get(postId);
    if (post?.author !== user?._id) throw new Error("Not authorized");
    
    await ctx.db.delete(postId);
  },
});
```

### 7. Only Schedule and `ctx.run*` Internal Functions
**Why**: Public functions need security auditing; internal functions can relax checks.

```typescript
// ❌ BAD - Scheduling public function (security risk)
await ctx.scheduler.runAfter(0, api.publicFunction, { data });

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  api.messages.sendMessage, // ❌ public function
  { author: "System", body: "Share your daily update!" }
);

// ✅ GOOD - Only schedule internal functions
await ctx.scheduler.runAfter(0, internal.privateFunction, { data });

// crons.ts
crons.daily(
  "send daily reminder",
  { hourUTC: 17, minuteUTC: 30 },
  internal.messages.sendInternalMessage, // ✅ internal function
  { author: "System", body: "Share your daily update!" }
);
```

### 8. Use Helper Functions for Shared Code
**Why**: Most logic should be plain TypeScript functions with thin Convex wrappers.

```typescript
// ❌ BAD - Duplicated logic in functions
export const createUser = mutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    if (args.name.trim().length === 0) throw new Error("Name required");
    if (!args.email.includes("@")) throw new Error("Invalid email");
    return await ctx.db.insert("users", args);
  },
});

export const updateUser = mutation({
  args: { id: v.id("users"), name: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    if (args.name.trim().length === 0) throw new Error("Name required");
    if (!args.email.includes("@")) throw new Error("Invalid email");
    return await ctx.db.patch(args.id, args);
  },
});

// ✅ GOOD - Shared validation logic
function validateUserData(args: { name: string; email: string }) {
  if (args.name.trim().length === 0) throw new Error("Name required");
  if (!args.email.includes("@")) throw new Error("Invalid email");
  return { name: args.name.trim(), email: args.email.toLowerCase() };
}

export const createUser = mutation({
  args: { name: v.string(), email: v.string() },
  handler: async (ctx, args) => {
    const validated = validateUserData(args);
    return await ctx.db.insert("users", validated);
  },
});
```

### 9. Use `runAction` Only When Using Different Runtime
**Why**: `runAction` has overhead; plain TypeScript functions are more efficient.

```typescript
// ❌ BAD - Unnecessary runAction
export const scrapeWebsite = action({
  args: { siteMapUrl: v.string() },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse site map */;
    await Promise.all(
      pages.map((page) =>
        ctx.runAction(internal.scrape.scrapeSinglePage, { url: page })
      )
    );
  },
});

// ✅ GOOD - Plain TypeScript function
export async function scrapeSinglePage(
  ctx: ActionCtx,
  { url }: { url: string }
) {
  const page = await fetch(url);
  const text = /* parse page */;
  await ctx.runMutation(internal.scrape.addPage, { url, text });
}

export const scrapeWebsite = action({
  args: { siteMapUrl: v.string() },
  handler: async (ctx, { siteMapUrl }) => {
    const siteMap = await fetch(siteMapUrl);
    const pages = /* parse site map */;
    await Promise.all(
      pages.map((page) => Scrape.scrapeSinglePage(ctx, { url: page }))
    );
  },
});
```

### 10. Avoid Sequential `ctx.runMutation` / `ctx.runQuery` Calls from Actions
**Why**: Each call runs in its own transaction, potentially causing inconsistency.

```typescript
// ❌ BAD - Separate transactions (potentially inconsistent)
export const badAction = action({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.get, { userId });
    const posts = await ctx.runQuery(internal.posts.getByUser, { userId });
    // user and posts might be inconsistent if another mutation ran between calls
    return { user, posts };
  },
});

// ✅ GOOD - Single call guarantees consistency
export const goodAction = action({
  handler: async (ctx) => {
    const data = await ctx.runQuery(internal.users.getWithPosts, { userId });
    return data; // Consistent snapshot
  },
});

// ❌ BAD - Separate mutations in loop
for (const member of teamMembers) {
  await ctx.runMutation(internal.teams.insertUser, member);
}

// ✅ GOOD - Single mutation
await ctx.runMutation(internal.teams.insertUsers, teamMembers);
```

**Exceptions**: Intentional processing of large data sets, migrations, or external service calls between operations.

### 11. Use `ctx.runQuery` and `ctx.runMutation` Sparingly in Queries and Mutations
**Why**: These have overhead compared to plain TypeScript functions.

```typescript
// ❌ BAD - Unnecessary overhead
export const getUserWithPosts = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.runQuery(internal.users.get, { userId });
    const posts = await ctx.runQuery(internal.posts.getByUser, { userId });
    return { user, posts };
  },
});

// ✅ GOOD - Direct database access
export const getUserWithPosts = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    const posts = await ctx.db
      .query("posts")
      .withIndex("by_author", q => q.eq("author", userId))
      .collect();
    return { user, posts };
  },
});
```

**Exceptions**:
- Using components (require `ctx.runQuery`/`ctx.runMutation`)
- Wanting partial rollback on error

```typescript
// ✅ GOOD - Using ctx.runMutation for partial rollback
export const trySendMessage = mutation({
  args: { body: v.string(), author: v.string() },
  handler: async (ctx, { body, author }) => {
    try {
      await ctx.runMutation(internal.messages.sendMessage, { body, author });
    } catch (e) {
      // Record failure, rollback sendMessage writes
      await ctx.db.insert("failures", {
        kind: "MessageFailed",
        body,
        author,
        error: `Error: ${e}`,
      });
    }
  },
});
```

## Code Organization

### File Structure
```
convex/
├── schema.ts              # Database schema
├── http.ts                # HTTP endpoints
├── crons.ts               # Scheduled jobs
├── _generated/            # Auto-generated (don't edit)
├── users/                 # Feature-based organization
│   ├── queries.ts
│   ├── mutations.ts
│   └── actions.ts
├── messages/
│   ├── queries.ts
│   ├── mutations.ts
│   └── actions.ts
└── lib/                   # Shared utilities
    ├── auth.ts            # Auth helpers
    └── validation.ts      # Validation helpers
```

### Internal Functions for Sensitive Operations
```typescript
// Use internal functions for operations not exposed to clients
import { internalMutation, internalQuery } from "./_generated/server";

export const systemUpdateUser = internalMutation({
  args: { userId: v.id("users"), updates: v.any() },
  handler: async (ctx, { userId, updates }) => {
    await ctx.db.patch(userId, updates);
  },
});
```

## Function Patterns

### Mutation Schedules Action Pattern
```typescript
// ✅ GOOD - Client calls mutation, mutation schedules action
export const createOrder = mutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, { items }) => {
    const orderId = await ctx.db.insert("orders", { items, status: "pending" });
    await ctx.scheduler.runAfter(0, internal.orders.processPayment, { orderId });
    return orderId;
  },
});
```

### Internal Functions for Sensitive Operations
```typescript
// ✅ GOOD - Use internal functions for operations not exposed to clients
import { internalMutation, internalQuery } from "./_generated/server";

export const systemUpdateUser = internalMutation({
  args: { userId: v.id("users"), updates: v.any() },
  handler: async (ctx, { userId, updates }) => {
    await ctx.db.patch(userId, updates);
  },
});
```

## Performance Patterns

### Use Indexes for All Queries
```typescript
// ❌ BAD - Filter without index (slow)
.filter(q => q.eq(q.field("author"), userId))

// ✅ GOOD - Use index (fast)
.withIndex("by_author", q => q.eq("author", userId))
```

### Avoid N+1 Query Patterns
```typescript
// ❌ BAD - N+1 queries
const messages = await ctx.db.query("messages").take(100);
for (const msg of messages) {
  const author = await ctx.db.get(msg.authorId); // 100 queries!
}

// ✅ GOOD - Batch fetch
const messages = await ctx.db.query("messages").take(100);
const authorIds = [...new Set(messages.map(m => m.authorId))];
const authors = await Promise.all(authorIds.map(id => ctx.db.get(id)));
const authorMap = Object.fromEntries(authors.filter(Boolean).map(a => [a._id, a]));
```

## Security Patterns

### Check Authentication
```typescript
// ✅ GOOD - Proper authentication and authorization
export const deletePost = mutation({
  args: { postId: v.id("posts") },
  handler: async (ctx, { postId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    
    const post = await ctx.db.get(postId);
    if (post?.author !== user?._id) throw new Error("Not authorized");
    
    await ctx.db.delete(postId);
  },
});
```

### Validate External Input
```typescript
// ✅ GOOD - Webhook signature verification
http.route({
  path: "/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Verify webhook signature
    const signature = request.headers.get("x-signature");
    const body = await request.text();
    
    if (!verifySignature(body, signature)) {
      return new Response("Invalid signature", { status: 401 });
    }
    
    // Process webhook with validated data
    await ctx.runMutation(internal.webhooks.process, { 
      payload: JSON.parse(body) 
    });
    
    return new Response("OK", { status: 200 });
  }),
});
```

## Anti-Patterns to Avoid

### Don't Use fetch in Queries/Mutations
```typescript
// BAD - Will error
export const badMutation = mutation({
  handler: async () => {
    await fetch("https://api.example.com"); // ERROR!
  },
});

// GOOD - Use actions for external APIs
export const goodAction = action({
  handler: async () => {
    await fetch("https://api.example.com"); // OK
  },
});
```

### Don't Store Sensitive Data Unencrypted
```typescript
// BAD - Plain text secrets
await ctx.db.insert("users", { password: "secret123" });

// GOOD - Hash sensitive data
const hashedPassword = await bcrypt.hash(password, 10);
await ctx.db.insert("users", { passwordHash: hashedPassword });
```

### Don't Ignore Errors
```typescript
// BAD - Silent failure
try {
  await processPayment();
} catch (e) {
  // Nothing - payment might have failed!
}

// GOOD - Handle errors
try {
  await processPayment();
} catch (e) {
  await ctx.db.insert("errorLogs", { error: e.message });
  throw e; // Re-throw or handle appropriately
}
```

## Development Workflow

### Keep the Dashboard by Your Side
**Essential Tool**: Working on Convex projects without the dashboard is like driving with eyes closed.

**Dashboard Capabilities**:
- View logs
- Test mutations/queries/actions
- Verify configuration and codebase
- Inspect tables
- Generate schemas
- Invaluable for rapid development

### Don't Go It Alone
**Community Resources**: Between docs, Stack, and the community, someone has probably encountered your design or architectural issues.

#### Leverage Convex Developer Search
**Resource**: [search.convex.dev](https://search.convex.dev) for quick searches across all Convex resources.

#### Join the Convex Community
**Community Hub**: [Discord](https://convex.dev/community) for:
- Getting help with tricky use cases
- Questions and feature requests
- Sharing apps and helping others learn

## Testing Patterns

### Test All Function Types
```typescript
import { test } from "convex-test";
import { api } from "../convex/_generated/api";

test("create and fetch user", async (t) => {
  const userId = await t.mutation(api.users.create, {
    name: "Test",
    email: "test@example.com",
  });
  
  const user = await t.query(api.users.getById, { userId });
  
  expect(user.name).toBe("Test");
});
```

## Production Checklist

1. **Schema defined** with proper indexes
2. **All functions validated** with argument validators
3. **Authentication implemented** for protected functions
4. **Error handling** in all functions
5. **Logging configured** for debugging
6. **Environment variables** set correctly
7. **CORS configured** for HTTP endpoints
8. **Rate limiting** considered for public endpoints
9. **Backup strategy** in place
10. **Monitoring** set up for errors and performance

## Implementation Checklist

- [ ] All promises are awaited
- [ ] Database queries use indexes or code filtering appropriately
- [ ] `.collect` only used for small result sets
- [ ] No redundant indexes in schema
- [ ] All public functions have argument validators
- [ ] All public functions have access control
- [ ] Internal functions only called via `ctx.run*` and scheduling
- [ ] Shared logic extracted to helper functions
- [ ] `runAction` only used for different runtime needs
- [ ] Actions minimize sequential `ctx.run*` calls
- [ ] Queries/mutations use plain functions when possible

## Anti-Patterns Summary

1. **Floating promises** - Not awaiting async operations
2. **Database filtering** - Using `.filter` instead of indexes or code filtering
3. **Large collects** - Loading unbounded data with `.collect`
4. **Redundant indexes** - Creating unnecessary duplicate indexes
5. **No validation** - Public functions without argument validators
6. **No access control** - Public functions without security checks
7. **Public internal calls** - Using public functions for internal operations
8. **Monolithic functions** - Not using helper functions for shared logic
9. **Unnecessary runAction** - Using runAction when same runtime suffices
10. **Sequential transactions** - Multiple ctx.run* calls causing inconsistency
11. **Overusing ctx.run*** - Using when plain functions would work