---
name: convex-http-actions
description: Convex HTTP actions for webhooks and custom API endpoints - routing, CORS, authentication, file upload, and webhook processing
---

# Convex HTTP Actions - Webhooks and API Endpoints

## HTTP Router Setup

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/api/users",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const userData = await request.json();
    
    if (!userData.name || !userData.email) {
      return new Response(
        JSON.stringify({ error: "Name and email required" }),
        { status: 400 }
      );
    }
    
    const userId = await ctx.runMutation(api.users.create, userData);
    
    return new Response(
      JSON.stringify({ id: userId }),
      { 
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  }),
});

export default http;
```

## Webhook Processing

### Stripe Webhooks
```typescript
http.route({
  path: "/webhooks/stripe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");
    
    // Verify signature
    const crypto = require('crypto');
    const expectedSig = crypto
      .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET!)
      .update(body)
      .digest('hex');
    
    if (signature !== expectedSig) {
      return new Response("Invalid signature", { status: 401 });
    }
    
    const event = JSON.parse(body);
    
    switch (event.type) {
      case 'payment_intent.succeeded':
        await ctx.runMutation(api.payments.handleSuccess, {
          paymentIntentId: event.data.object.id,
        });
        break;
    }
    
    return new Response("OK", { status: 200 });
  }),
});
```

## CORS Configuration

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.CLIENT_ORIGIN || "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
  "Vary": "Origin",
};

// Pre-flight OPTIONS handler
http.route({
  path: "/api/data",
  method: "OPTIONS",
  handler: httpAction(async () => new Response(null, { headers: corsHeaders })),
});

http.route({
  path: "/api/data",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const data = await ctx.runQuery(api.data.getAll);
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }),
});
```

## File Upload

```typescript
http.route({
  path: "/upload",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return new Response("No file", { status: 400 });
    }
    
    const storageId = await ctx.storage.store(await file.arrayBuffer());
    
    const fileId = await ctx.runMutation(api.files.create, {
      storageId,
      filename: file.name,
      contentType: file.type,
    });
    
    return new Response(JSON.stringify({ fileId }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }),
});
```

## Authentication

```typescript
http.route({
  path: "/api/protected",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401 });
    }
    
    const token = authHeader.substring(7);
    
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      
      const result = await ctx.runMutation(api.protected.process, {
        userId: decoded.userId,
        data: await request.json(),
      });
      
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      return new Response("Invalid token", { status: 401 });
    }
  }),
});
```

## Best Practices

1. **Always include CORS headers** for browser requests
2. **Validate all input data** before processing
3. **Handle errors gracefully** with appropriate status codes
4. **Verify webhook signatures** for security
5. **Return consistent JSON responses** for API endpoints
6. **Test with curl** before integrating with clients