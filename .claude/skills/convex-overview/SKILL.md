---
name: convex-overview
description: Comprehensive guide to Convex reactive database platform - architecture, core concepts, function types, and project structure based on the Zen of Convex philosophy
---

# Convex Overview - Reactive Database Platform

## What is Convex?

Convex is an **opinionated reactive database** where queries are TypeScript code running right in the database. Like React components react to state changes, Convex queries react to database changes. This architecture combines:

- **Database** - ACID-compliant storage with automatic indexing
- **Serverless Functions** - Queries, mutations, actions with TypeScript
- **Real-time Sync Engine** - Automatic reactive updates via WebSocket
- **File Storage** - Built-in file management with CDN
- **Authentication** - 80+ OAuth integrations (Clerk, Auth0, etc.)
- **Scheduling** - Cron jobs and background tasks
- **Components** - Sandboxed mini-backends for reusable features

## The Zen of Convex - Core Philosophy

Convex is designed as an **opinionated framework** that pulls developers into "the pit of success." The Zen of Convex represents guidelines that keep projects aligned with Convex's core philosophy.

### Performance Philosophy

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

### Architecture Philosophy

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

## Core Architecture

### The Reactive Model

```typescript
// This query automatically re-runs when messages change
export const listMessages = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("messages").collect();
  },
});
```

**Key Concept**: The sync engine reruns query functions when any input changes (database modifications, auth changes, etc.), then updates every app listening to the query.

### Function Types

| Type | Purpose | Database Access | External APIs | Cached | Real-time | Runtime |
|------|---------|----------------|---------------|--------|-----------|---------|
| **Queries** | Read data | Yes | No | Yes | Yes | Convex |
| **Mutations** | Write data | Yes | No | No | No | Convex |
| **Actions** | External APIs | Via runQuery/runMutation | Yes | No | No | Node.js |
| **HTTP Actions** | Webhooks/APIs | Via runQuery/runMutation | Yes | No | No | Node.js |

#### Function Characteristics

**Queries**:
- Reactive and cached
- Automatic re-execution on data changes
- Fast, consistent reads
- Cannot modify data

**Mutations**:
- ACID transactional writes
- Automatic retries on network failures
- Optimistic updates support
- Trigger query re-runs

**Actions**:
- External API access (fetch, etc.)
- Longer-running operations
- Background processing
- No automatic reactivity

**HTTP Actions**:
- Webhook endpoints
- Public API routes
- External service integrations
- Custom authentication

## Project Structure

```
my-convex-app/
├── convex/
│   ├── schema.ts              # Database schema definition
│   ├── http.ts                # HTTP endpoints (webhooks, API)
│   ├── crons.ts               # Scheduled jobs
│   ├── _generated/            # Auto-generated types
│   │   ├── api.d.ts
│   │   ├── dataModel.d.ts
│   │   └── server.d.ts
│   ├── users.ts               # User-related functions
│   ├── messages.ts            # Message functions
│   └── components/            # Convex components
├── src/
│   ├── App.tsx                # React app with ConvexProvider
│   └── components/            # UI components
└── package.json
```

### Feature-Based Organization

```
convex/
├── schema.ts
├── http.ts
├── crons.ts
├── users/
│   ├── queries.ts
│   ├── mutations.ts
│   └── actions.ts
├── messages/
│   ├── queries.ts
│   ├── mutations.ts
│   └── actions.ts
└── lib/
    ├── auth.ts
    └── validation.ts
```

## Getting Started

### 1. Installation
```bash
npm install convex
# or
bun install convex
```

### 2. Backend Setup
```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    body: v.string(),
    author: v.string(),
  }).index("by_author", ["author"]),
});
```

### 3. Functions
```typescript
// convex/messages.ts
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("messages").collect();
  },
});

export const send = mutation({
  args: { body: v.string(), author: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("messages", args);
  },
});
```

### 4. Frontend Integration
```typescript
// src/App.tsx
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";

const convex = new ConvexReactClient(process.env.REACT_APP_CONVEX_URL!);

function App() {
  return (
    <ConvexProvider client={convex}>
      <Chat />
    </ConvexProvider>
  );
}

function Chat() {
  const messages = useQuery(api.messages.list);
  const sendMessage = useMutation(api.messages.send);

  return (
    <div>
      {messages?.map(msg => (
        <div key={msg._id}>{msg.author}: {msg.body}</div>
      ))}
    </div>
  );
}
```

## Key Concepts

### 1. Reactive Queries
- Queries automatically re-run when data changes
- No manual subscription management needed
- Consistent view across all clients
- Built-in caching and optimization

### 2. Transactional Mutations
- All mutations run in ACID transactions
- Automatic retries on network failures
- Optimistic updates support
- Immediate query invalidation

### 3. Type Safety
- End-to-end TypeScript types
- Generated API objects
- Schema validation at runtime
- Compile-time guarantees

### 4. Real-time Sync
- WebSocket-based synchronization
- Automatic reconnection
- Efficient change propagation
- Multi-client consistency

### 5. Access Control
- Built-in authentication integration
- Per-function authorization
- Internal vs public function separation
- Security-first design

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

## When to Use Convex

**Perfect for:**
- Real-time collaborative apps (chat, documents, games)
- Applications with complex data relationships
- Projects needing automatic real-time updates
- Teams wanting TypeScript throughout the stack
- Rapid prototyping with production-ready features
- Apps requiring strong consistency guarantees

**Not ideal for:**
- Simple static websites
- Applications requiring custom database engines
- Projects with very specific database requirements
- Use cases where eventual consistency is acceptable

## Advanced Features

### Components
- Sandboxed mini-backends
- Reusable feature packages
- Isolated state and functions
- Easy sharing and deployment

### File Storage
- Built-in file management
- CDN integration
- Automatic optimization
- Secure access controls

### Scheduling
- Cron-like job scheduling
- Background task processing
- Workflow orchestration
- Error handling and retries

### HTTP Actions
- Webhook endpoints
- Public API routes
- Custom authentication
- External service integration

## Performance Considerations

### Query Optimization
- Use indexes for efficient queries
- Limit result sets with pagination
- Avoid N+1 query patterns
- Cache frequently accessed data

### Mutation Best Practices
- Keep mutations small and fast
- Use internal functions for complex logic
- Batch operations when possible
- Handle errors gracefully

### Action Patterns
- Use for external API calls
- Implement background workflows
- Process data in batches
- Handle failures and retries

## Related Skills

Use specialized skills for detailed implementation guidance:
- `convex-schema` - Database schema and data modeling
- `convex-queries` - Query function patterns
- `convex-mutations` - Mutation function patterns  
- `convex-actions` - External API integration
- `convex-auth` - Authentication patterns
- `convex-react` - React hooks and client integration
- `convex-scheduling` - Cron jobs and background tasks
- `convex-file-storage` - File upload/download
- `convex-http-actions` - HTTP endpoints and webhooks
- `convex-best-practices` - Advanced patterns and anti-patterns

## Quick Reference

### Function Types
```typescript
// Query - reactive read
export const getData = query({
  args: { id: v.id("table") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Mutation - transactional write
export const updateData = mutation({
  args: { id: v.id("table"), data: v.any() },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.id, args.data);
  },
});

// Action - external API access
export const processData = action({
  args: { input: v.string() },
  handler: async (ctx, args) => {
    const response = await fetch("https://api.example.com");
    return await response.json();
  },
});
```

### Common Patterns
```typescript
// Authentication check
const identity = await ctx.auth.getUserIdentity();
if (!identity) throw new Error("Not authenticated");

// Index usage
const results = await ctx.db
  .query("table")
  .withIndex("by_field", q => q.eq("field", value))
  .collect();

// Internal function usage
await ctx.runMutation(internal.myFunction, { data });
```

This comprehensive overview provides the foundation for understanding Convex's reactive architecture and building applications following the Zen of Convex philosophy.