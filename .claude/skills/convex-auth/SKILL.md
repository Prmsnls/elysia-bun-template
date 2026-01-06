---
name: convex-auth
description: Convex authentication patterns - user identity, authorization, protected functions, and third-party auth integration
---

# Convex Authentication - Authentication and Authorization Patterns

## Authentication Fundamentals

Convex uses OpenID Connect (OAuth) ID tokens in the form of JWTs to authenticate connections. Supported providers:
- **Clerk** - Great Next.js and React Native support
- **Auth0** - Established with many features
- **WorkOS AuthKit** - B2B apps, free for 1M users
- **Custom Auth** - Any OpenID Connect provider

## Checking Authentication

### Basic Authentication Check
```typescript
import { query } from "./_generated/server";

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    
    return await ctx.db
      .query("users")
      .withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
  },
});
```

### Get or Create User Pattern
```typescript
export const ensureUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    // Check if user exists
    let user = await ctx.db
      .query("users")
      .withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    
    // Create if not exists
    if (!user) {
      const userId = await ctx.db.insert("users", {
        name: identity.name || "Anonymous",
        email: identity.email,
        tokenIdentifier: identity.tokenIdentifier,
        createdAt: Date.now(),
      });
      user = await ctx.db.get(userId);
    }
    
    return user;
  },
});
```

## Authorization Patterns

### Resource Ownership Check
```typescript
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
    if (!post) throw new Error("Post not found");
    
    // Check ownership
    if (post.author !== user._id) {
      throw new Error("Not authorized to delete this post");
    }
    
    await ctx.db.delete(postId);
  },
});
```

### Role-Based Access
```typescript
export const adminDeleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    
    const admin = await ctx.db
      .query("users")
      .withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .unique();
    
    if (!admin || admin.role !== "admin") {
      throw new Error("Admin access required");
    }
    
    await ctx.db.delete(userId);
  },
});
```

## Authentication Wrapper Pattern

```typescript
// Reusable authentication wrapper
async function getAuthenticatedUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  
  const user = await ctx.db
    .query("users")
    .withIndex("by_token", q => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
  
  if (!user) throw new Error("User not found");
  
  return user;
}

// Usage in functions
export const createPost = mutation({
  args: { title: v.string(), content: v.string() },
  handler: async (ctx, { title, content }) => {
    const user = await getAuthenticatedUser(ctx);
    
    return await ctx.db.insert("posts", {
      title,
      content,
      author: user._id,
      createdAt: Date.now(),
    });
  },
});
```

## User Identity Properties

```typescript
// Available properties from identity
const identity = await ctx.auth.getUserIdentity();

identity.tokenIdentifier  // Unique identifier (required)
identity.subject          // Subject claim from JWT
identity.issuer           // Token issuer
identity.email            // User's email (if available)
identity.emailVerified    // Email verification status
identity.name             // User's name
identity.pictureUrl       // Profile picture URL
identity.nickname         // User's nickname
identity.givenName        // First name
identity.familyName       // Last name
```

## Internal Functions for Sensitive Operations

```typescript
// Use internal mutations for operations that bypass auth
import { internalMutation } from "./_generated/server";

export const systemUpdateUser = internalMutation({
  args: { userId: v.id("users"), updates: v.any() },
  handler: async (ctx, { userId, updates }) => {
    // No auth check - only callable from other Convex functions
    await ctx.db.patch(userId, updates);
  },
});

// Call from action
export const processWebhook = action({
  args: { data: v.any() },
  handler: async (ctx, { data }) => {
    await ctx.runMutation(internal.users.systemUpdateUser, {
      userId: data.userId,
      updates: data.updates,
    });
  },
});
```

## Best Practices

1. **Always check authentication** in protected functions
2. **Verify resource ownership** before modifications
3. **Use internal functions** for system operations
4. **Store user references** instead of copying data
5. **Index by tokenIdentifier** for fast user lookups
6. **Handle missing users gracefully** with get-or-create pattern