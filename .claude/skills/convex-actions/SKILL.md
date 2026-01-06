---
name: convex-actions
description: Convex actions for external API integration - fetch, third-party services, Node.js runtime, and error handling patterns
---

# Convex Actions - External API Integration

## Action Fundamentals

Actions are **functions that can call external APIs** and:
- Can use `fetch()` and external services
- Interact with database indirectly via `runQuery`/`runMutation`
- Can run in Node.js environment with `"use node"`
- Have **no automatic retries** (handle manually)
- Can perform **long-running operations** (10 minute timeout)

## Basic Action Patterns

### External API Call
```typescript
import { action } from "./_generated/server";
import { v } from "convex/values";

export const callExternalAPI = action({
  args: { url: v.string() },
  handler: async (_, { url }) => {
    const response = await fetch(url);
    return await response.json();
  },
});
```

### Action with Database Access
```typescript
export const sendWelcomeEmail = action({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // Get user data via internal query
    const user = await ctx.runQuery(internal.users.getById, { userId });
    if (!user) throw new Error("User not found");
    
    // Call external email service
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: [{ email: user.email }],
        subject: "Welcome!",
        content: [{ type: "text/plain", value: `Welcome ${user.name}!` }],
      }),
    });
    
    // Record email sent via mutation
    await ctx.runMutation(internal.emails.recordSent, {
      userId,
      type: "welcome",
      status: response.ok ? "sent" : "failed",
    });
    
    return response.ok;
  },
});
```

## Node.js Runtime

```typescript
// convex/processImage.ts
"use node"; // Enable Node.js runtime

import { action } from "./_generated/server";
import sharp from "sharp"; // Use npm packages

export const processImage = action({
  args: { imageStorageId: v.id("_storage") },
  handler: async (ctx, { imageStorageId }) => {
    const imageBuffer = await ctx.storage.get(imageStorageId);
    if (!imageBuffer) throw new Error("Image not found");
    
    // Process with Sharp (requires Node.js)
    const processed = await sharp(imageBuffer)
      .resize(800, 600)
      .jpeg({ quality: 80 })
      .toBuffer();
    
    return await ctx.storage.store(processed);
  },
});
```

## Recommended Pattern: Mutation Schedules Action

```typescript
// Client calls mutation, mutation schedules action
export const createOrder = mutation({
  args: { items: v.array(v.any()) },
  handler: async (ctx, { items }) => {
    const orderId = await ctx.db.insert("orders", { items, status: "pending" });
    
    // Schedule action for payment processing
    await ctx.scheduler.runAfter(0, internal.orders.processPayment, { orderId });
    
    return orderId;
  },
});

export const processPayment = internalAction({
  args: { orderId: v.id("orders") },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.runQuery(internal.orders.getById, { orderId });
    
    // Call payment API
    const payment = await fetch("https://api.stripe.com/charges", {
      method: "POST",
      // ...
    });
    
    // Update order status
    await ctx.runMutation(internal.orders.updateStatus, {
      orderId,
      status: payment.ok ? "paid" : "failed",
    });
  },
});
```

## Error Handling with Retry

```typescript
export const callAPIWithRetry = action({
  args: { url: v.string(), maxRetries: v.optional(v.number()) },
  handler: async (_, { url, maxRetries = 3 }) => {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, { timeout: 10000 });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    
    throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
  },
});
```

## Common Pitfalls

### Excessive runQuery/runMutation Calls
```typescript
// BAD - Multiple separate calls
const user = await ctx.runQuery(internal.users.get, { userId });
const posts = await ctx.runQuery(internal.posts.getByUser, { userId });

// GOOD - Single consolidated query
const userData = await ctx.runQuery(internal.users.getCompleteProfile, { userId });
```

## Best Practices

1. **Use actions for external APIs** - Keep queries/mutations pure
2. **Handle errors manually** - No automatic retries
3. **Batch database operations** - Minimize runQuery/runMutation calls
4. **Use Node.js runtime** when needed for npm packages
5. **Implement retry logic** for unreliable external services
6. **Use internal functions** for sensitive operations