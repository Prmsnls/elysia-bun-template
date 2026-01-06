---
name: convex-workflows
description: Convex Workflows - durable execution for reliable, long-running sequences of functions with retries, cancellation, and reactive status observation
---

# Convex Workflows - Durable Execution Component

> **Package**: `@convex-dev/workflow`  
> **Repository**: https://github.com/get-convex/workflow

## Overview

Convex Workflows is a durable execution system that allows you to run reliable, long-running sequences of functions that can:
- **Survive server restarts** - Workflows persist across deployments and restarts
- **Handle retries** - Built-in exponential backoff with configurable retry policies
- **Span months** - Long-running workflows with delays and scheduled steps
- **Be observed** - Reactive status observation for UI updates
- **Be canceled** - Graceful cancellation support

### When to Use Workflows

**Use workflows when:**
- You need reliability guarantees for multi-step processes
- Operations may take hours, days, or months
- You need to wait for external events (user approval, webhooks)
- Steps depend on previous step results
- You want automatic retry with exponential backoff

**Use regular actions when:**
- Single-step operations
- Short-lived tasks (< 10 minutes)
- Simple API calls without complex error handling

## Installation and Setup

### 1. Install the Package
```bash
npm install @convex-dev/workflow
# or
bun install @convex-dev/workflow
```

### 2. Configure the App
```typescript
// convex/convex.config.ts
import workflow from "@convex-dev/workflow/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
app.use(workflow);
export default app;
```

### 3. Create WorkflowManager
```typescript
// convex/workflow.ts
import { WorkflowManager } from "@convex-dev/workflow";
import { components } from "./_generated/api";

export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    maxParallelism: 10,
    retryActionsByDefault: true,
    defaultRetryBehavior: {
      maxAttempts: 3,
      initialBackoffMs: 100,
      base: 2,  // Exponential backoff: 100ms, 200ms, 400ms
    },
  },
});
```

## Defining Workflows

### Basic Workflow Structure
```typescript
import { WorkflowManager } from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";

const workflow = new WorkflowManager(components.workflow);

export const exampleWorkflow = workflow.define({
  args: {
    location: v.string(),
  },
  returns: v.object({
    name: v.string(),
    temperature: v.number(),
  }),
  handler: async (step, args): Promise<{
    name: string;
    temperature: number;
  }> => {
    // Step 1: Run an action to get geocoding data
    const { latitude, longitude, name } = await step.runAction(
      internal.example.getGeocoding,
      { location: args.location },
      { retry: true }  // Enable retry with default policy
    );

    // Step 2: Use results from step 1 in the next action
    const weather = await step.runAction(
      internal.example.getWeather,
      { latitude, longitude }
    );

    // Step 3: Store results in database
    await step.runMutation(internal.example.updateFlow, {
      workflowId: step.workflowId,
      out: { name, temperature: weather.temperature },
    });

    return { name, temperature: weather.temperature };
  },
});
```

### Step Functions

The `step` (or `ctx`) object provides these methods:

| Method | Purpose | Notes |
|--------|---------|-------|
| `step.runQuery(fn, args, opts?)` | Run a query | Consistent reads |
| `step.runMutation(fn, args, opts?)` | Run a mutation | Transactional writes |
| `step.runAction(fn, args, opts?)` | Run an action | External APIs |
| `step.runWorkflow(fn, args)` | Run nested workflow | Entire workflow as one step |
| `step.awaitEvent(event)` | Wait for external event | Blocks until event received |
| `step.workflowId` | Current workflow ID | For tracking and callbacks |

### Step Options

All `run*` methods accept optional step options:

```typescript
interface StepOptions {
  // Retry configuration
  retry?: boolean | {
    maxAttempts: number;
    initialBackoffMs: number;
    base: number;  // Exponential multiplier
  };
  
  // Delay execution
  runAfter?: number;  // Milliseconds from now
  runAt?: number;     // Unix timestamp
}
```

## Starting and Managing Workflows

### Start a Workflow
```typescript
import { vWorkflowId, WorkflowId } from "@convex-dev/workflow";
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { workflow } from "./workflow";

export const startWorkflow = mutation({
  args: { location: v.optional(v.string()) },
  returns: v.string(),
  handler: async (ctx, args) => {
    const location = args.location ?? "San Francisco";
    
    const workflowId: WorkflowId = await workflow.start(
      ctx,
      internal.example.exampleWorkflow,
      { location },
      {
        onComplete: internal.example.flowCompleted,  // Callback on completion
        context: { location },                        // Context passed to callback
        startAsync: true,                             // Don't wait for completion
      }
    );
    
    // Optionally track the workflow
    await ctx.db.insert("flows", {
      workflowId,
      input: location,
      output: null
    });
    
    return workflowId;
  },
});
```

### Check Workflow Status
```typescript
import { vWorkflowId } from "@convex-dev/workflow";
import { action } from "./_generated/server";
import { workflow } from "./workflow";

export const checkStatus = action({
  args: { workflowId: vWorkflowId },
  handler: async (ctx, args) => {
    const status = await workflow.status(ctx, args.workflowId);

    if (status.type === "inProgress") {
      console.log("Running steps:", status.running);
    } else if (status.type === "completed") {
      console.log("Result:", status.result);
    } else if (status.type === "failed") {
      console.error("Error:", status.error);
    } else if (status.type === "canceled") {
      console.log("Workflow was canceled");
    }

    return status;
  },
});
```

### Cancel a Workflow
```typescript
export const cancelWorkflow = mutation({
  args: { workflowId: vWorkflowId },
  handler: async (ctx, args) => {
    await workflow.cancel(ctx, args.workflowId);
  },
});
```

### Cleanup Completed Workflow
```typescript
export const cleanupWorkflow = mutation({
  args: { workflowId: vWorkflowId },
  handler: async (ctx, args) => {
    const cleaned = await workflow.cleanup(ctx, args.workflowId);
    return cleaned;
  },
});
```

## Completion Callbacks

Handle workflow completion, failure, or cancellation:

```typescript
import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { workflow } from "./workflow";

export const flowCompleted = mutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.any(),  // Context passed when starting
  },
  handler: async (ctx, args) => {
    const { location, startTime, userId } = args.context;
    const duration = Date.now() - startTime;

    if (args.result.kind === "success") {
      console.log(`Workflow succeeded for ${location} in ${duration}ms`);
      console.log("Return value:", args.result.returnValue);

      await ctx.db.insert("workflowResults", {
        workflowId: args.workflowId,
        status: "success",
        result: args.result.returnValue,
      });

    } else if (args.result.kind === "error") {
      console.error(`Workflow failed:`, args.result.error);

      await ctx.db.insert("workflowResults", {
        workflowId: args.workflowId,
        status: "failed",
        error: args.result.error,
      });

    } else if (args.result.kind === "canceled") {
      console.log(`Workflow canceled`);

      await ctx.db.insert("workflowResults", {
        workflowId: args.workflowId,
        status: "canceled",
      });
    }

    // Optional: cleanup workflow data after processing
    await workflow.cleanup(ctx, args.workflowId);
  },
});
```

## Event Signaling

Workflows can wait for external events, enabling human-in-the-loop processes:

### Define and Await Events
```typescript
import {
  defineEvent,
  WorkflowManager,
  vWorkflowId,
} from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";

// Define a typed event specification
export const approvalEvent = defineEvent({
  name: "approval" as const,
  validator: v.union(
    v.object({ approved: v.literal(true), choice: v.number() }),
    v.object({ approved: v.literal(false), reason: v.string() })
  ),
});

const workflow = new WorkflowManager(components.workflow);

// Workflow that waits for user approval
export const confirmationWorkflow = workflow.define({
  args: { prompt: v.string() },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    // Generate proposals
    const proposals = await ctx.runAction(
      internal.userConfirmation.generateProposals,
      { prompt: args.prompt },
      { retry: true }
    );

    // Wait for user to approve - BLOCKS until sendEvent is called
    const approval = await ctx.awaitEvent(approvalEvent);

    if (!approval.approved) {
      return "rejected: " + approval.reason;
    }

    return proposals[approval.choice];
  },
});
```

### Send Events to Unblock Workflows
```typescript
import { vWorkflowId } from "@convex-dev/workflow";
import { mutation } from "./_generated/server";
import { workflow } from "./workflow";
import { approvalEvent } from "./confirmationWorkflow";

// User approves a proposal
export const approveProposal = mutation({
  args: {
    workflowId: vWorkflowId,
    choice: v.number(),
  },
  handler: async (ctx, args) => {
    await workflow.sendEvent(ctx, {
      ...approvalEvent,
      workflowId: args.workflowId,
      value: { approved: true, choice: args.choice },
    });
  },
});

// User rejects
export const rejectProposal = mutation({
  args: {
    workflowId: vWorkflowId,
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await workflow.sendEvent(ctx, {
      ...approvalEvent,
      workflowId: args.workflowId,
      value: { approved: false, reason: args.reason },
    });
  },
});

// Send event with error to fail the workflow step
export const failWorkflow = mutation({
  args: {
    workflowId: vWorkflowId,
    errorMessage: v.string(),
  },
  handler: async (ctx, args) => {
    await workflow.sendEvent(ctx, {
      name: "approval",
      workflowId: args.workflowId,
      error: args.errorMessage,  // This will throw in the workflow
    });
  },
});
```

## Nested Workflows

Run entire workflows as single steps:

```typescript
// Child workflow
export const childWorkflow = workflow.define({
  args: { data: v.string() },
  returns: v.number(),
  handler: async (ctx, args): Promise<number> => {
    await ctx.runMutation(internal.processing.process, { data: args.data });
    return args.data.length;
  },
});

// Parent workflow that calls child
export const parentWorkflow = workflow.define({
  args: { input: v.string() },
  handler: async (ctx, args): Promise<void> => {
    // Run entire child workflow as a single step
    const length = await ctx.runWorkflow(
      internal.workflows.childWorkflow,
      { data: args.input }
    );

    console.log("Child returned:", length);

    // Continue with parent logic
    await ctx.runMutation(internal.processing.complete, { length });
  },
});
```

## Scheduled Steps

Schedule steps to run at specific times or after delays:

```typescript
export const scheduledWorkflow = workflow.define({
  args: { userId: v.string() },
  handler: async (step, args): Promise<void> => {
    // Send immediate welcome email
    await step.runMutation(
      internal.emails.sendWelcomeEmail,
      { userId: args.userId }
    );

    // Wait 1 hour before next step
    await step.runMutation(
      internal.emails.sendFollowUp1,
      { userId: args.userId },
      { runAfter: 60 * 60 * 1000 }  // 1 hour in ms
    );

    // Wait 1 day before next step
    await step.runMutation(
      internal.emails.sendFollowUp2,
      { userId: args.userId },
      { runAfter: 24 * 60 * 60 * 1000 }  // 1 day in ms
    );

    // Wait 7 days before final step
    await step.runMutation(
      internal.emails.sendWeeklyDigest,
      { userId: args.userId },
      { runAfter: 7 * 24 * 60 * 60 * 1000 }  // 7 days in ms
    );

    // Run at specific timestamp
    const targetTime = new Date("2025-12-31T23:59:59Z").getTime();
    await step.runMutation(
      internal.emails.sendNewYearEmail,
      { userId: args.userId },
      { runAt: targetTime }
    );
  },
});
```

## Retry Configuration

### Manager-Level Defaults
```typescript
const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    maxParallelism: 10,
    retryActionsByDefault: true,  // All actions retry by default
    defaultRetryBehavior: {
      maxAttempts: 5,
      initialBackoffMs: 200,
      base: 2,  // Exponential: 200ms, 400ms, 800ms, 1600ms, 3200ms
    },
  },
});
```

### Per-Workflow Override
```typescript
export const myWorkflow = workflow.define({
  args: { data: v.string() },
  handler: async (step, args): Promise<void> => {
    // ...
  },
  workpoolOptions: {
    retryActionsByDefault: false,  // Override manager default
  },
});
```

### Per-Step Override
```typescript
// Uses manager's default retry behavior
await step.runAction(internal.example.reliableAction, args);

// Disable retry for this specific step
await step.runAction(
  internal.example.idempotentAction,
  args,
  { retry: false }
);

// Custom retry behavior for this step only
await step.runAction(
  internal.example.unreliableAction,
  args,
  {
    retry: {
      maxAttempts: 10,
      initialBackoffMs: 500,
      base: 1.5,
    },
  }
);

// Explicitly use default retry policy
await step.runAction(
  internal.example.anotherAction,
  args,
  { retry: true }
);
```

## User Onboarding Example

A complete real-world example combining multiple patterns:

```typescript
import { WorkflowManager, defineEvent } from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";

export const workflow = new WorkflowManager(components.workflow);

// Event for email verification
const verificationEvent = defineEvent({
  name: "verificationEmail" as const,
  validator: v.object({ verified: v.boolean() }),
});

export const userOnboarding = workflow.define({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args): Promise<void> => {
    // Step 1: Send verification email
    const status = await ctx.runMutation(
      internal.emails.sendVerificationEmail,
      { userId: args.userId },
    );

    // Step 2: Wait for verification if needed
    if (status === "needsVerification") {
      const result = await ctx.awaitEvent(verificationEvent);
      if (!result.verified) {
        throw new Error("Email verification failed");
      }
    }

    // Step 3: Generate custom content with retries
    const result = await ctx.runAction(
      internal.llm.generateCustomContent,
      { userId: args.userId },
      { retry: true },  // Retry on transient errors
    );

    // Step 4: Handle human input if needed
    if (result.needsHumanInput) {
      await ctx.runWorkflow(internal.llm.refineContentWorkflow, {
        userId: args.userId,
      });
    }

    // Step 5: Send follow-up email after 1 day
    await ctx.runMutation(
      internal.emails.sendFollowUpEmail,
      { userId: args.userId },
      { runAfter: 24 * 60 * 60 * 1000 },  // 1 day delay
    );
  },
});
```

## API Reference

### WorkflowManager

```typescript
class WorkflowManager {
  constructor(
    component: WorkflowComponent,
    options?: {
      workpoolOptions?: {
        maxParallelism?: number;
        retryActionsByDefault?: boolean;
        defaultRetryBehavior?: RetryBehavior;
      };
    }
  );

  // Define a workflow
  define<Args, Returns>(config: WorkflowConfig<Args, Returns>): WorkflowDefinition;

  // Start a workflow
  start(
    ctx: MutationCtx,
    workflow: WorkflowReference,
    args: WorkflowArgs,
    options?: {
      onComplete?: FunctionReference;
      context?: any;
      startAsync?: boolean;
    }
  ): Promise<WorkflowId>;

  // Get workflow status
  status(ctx: ActionCtx, workflowId: WorkflowId): Promise<WorkflowStatus>;

  // Cancel a running workflow
  cancel(ctx: MutationCtx, workflowId: WorkflowId): Promise<void>;

  // Cleanup completed workflow data
  cleanup(ctx: MutationCtx, workflowId: WorkflowId): Promise<boolean>;

  // Send event to workflow
  sendEvent(
    ctx: MutationCtx,
    event: EventSpec & { workflowId: WorkflowId; value?: any; error?: string }
  ): Promise<string>;

  // Create event ahead of time
  createEvent(
    ctx: MutationCtx,
    event: { name: string; workflowId: WorkflowId }
  ): Promise<string>;
}
```

### WorkflowStatus Types

```typescript
type WorkflowStatus =
  | { type: "inProgress"; running: string[] }
  | { type: "completed"; result: any }
  | { type: "failed"; error: string }
  | { type: "canceled" };
```

### RetryBehavior

```typescript
interface RetryBehavior {
  maxAttempts: number;      // Max retry attempts
  initialBackoffMs: number; // Initial delay before first retry
  base: number;             // Exponential multiplier
}
```

### Validators

```typescript
import { vWorkflowId } from "@convex-dev/workflow";
import { vResultValidator } from "@convex-dev/workpool";

// Use in function args
args: {
  workflowId: vWorkflowId,
  result: vResultValidator,
}
```

## Best Practices

### 1. Use Internal Functions for Steps
```typescript
// ✅ GOOD - Internal functions for workflow steps
await step.runAction(internal.myModule.myAction, args);
await step.runMutation(internal.myModule.myMutation, args);

// ❌ BAD - Public functions (security concerns)
await step.runAction(api.myModule.myAction, args);
```

### 2. Keep Steps Idempotent
```typescript
// ✅ GOOD - Idempotent mutation
export const processPayment = internalMutation({
  handler: async (ctx, { orderId, amount }) => {
    const existing = await ctx.db
      .query("payments")
      .withIndex("by_order", q => q.eq("orderId", orderId))
      .first();
    
    if (existing) return existing;  // Already processed
    
    return await ctx.db.insert("payments", { orderId, amount });
  },
});
```

### 3. Track Progress for Long Workflows
```typescript
export const longWorkflow = workflow.define({
  args: { jobId: v.id("jobs") },
  handler: async (step, args): Promise<void> => {
    for (let i = 0; i < 100; i++) {
      await step.runMutation(internal.jobs.processChunk, {
        jobId: args.jobId,
        chunkIndex: i,
      });
      
      // Update progress for UI
      await step.runMutation(internal.jobs.updateProgress, {
        jobId: args.jobId,
        progress: (i + 1) / 100,
      });
    }
  },
});
```

### 4. Handle Cancellation Gracefully
```typescript
export const cancelableWorkflow = workflow.define({
  handler: async (step, args): Promise<void> => {
    try {
      await step.runAction(internal.process.longOperation, args);
    } catch (e) {
      if (e.message?.includes("canceled")) {
        await step.runMutation(internal.process.cleanup, args);
      }
      throw e;
    }
  },
});
```

### 5. Cleanup After Completion
```typescript
// In completion callback
export const onComplete = mutation({
  args: { workflowId: vWorkflowId, result: vResultValidator },
  handler: async (ctx, args) => {
    // Process result...
    
    // Cleanup workflow journal data
    await workflow.cleanup(ctx, args.workflowId);
  },
});
```

## Limitations and Caveats

1. **Workflow handlers must be deterministic** - Same inputs should produce same sequence of steps
2. **Cannot use random values directly** - Use mutations/actions for randomness
3. **Step results must be serializable** - JSON-compatible values only
4. **Event waiting can block indefinitely** - Implement timeouts if needed
5. **Cleanup is manual** - Call `workflow.cleanup()` after completion to free resources
6. **Status checks require action context** - `workflow.status()` needs ActionCtx

## Debugging Tips

1. **Use the Convex Dashboard** - View workflow logs and status
2. **Add logging in steps** - `console.log` in mutations/actions
3. **Track workflow IDs** - Store in database for debugging
4. **Monitor completion callbacks** - Log success/failure details
5. **Use meaningful step names** - Makes logs easier to follow