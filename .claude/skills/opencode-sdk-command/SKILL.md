---
name: opencode-sdk-command
description: Guide to invoking OpenCode commands programmatically via SDK - runAgentCommand, session.command, and tunnel-based command execution
---

# OpenCode Command Invocation via SDK

This guide covers how to invoke OpenCode commands programmatically from external systems (Convex, backend services, etc.).

## SDK Methods Overview

### Method 1: Session Command (Direct SDK)

```typescript
import { OpenCode } from "@opencode/sdk-js";

const agent = new OpenCode({
  baseUrl: "http://opencode-server:4096"
});

const response = await agent.session.command({
  sessionID: "session-123",
  command: "/plan"
});
```

### Method 2: Command via Prompt

```typescript
const result = await agent.session.prompt({
  sessionID: "session-123",
  parts: [{ type: "text", text: "/plan args" }]
});
```

### Method 3: TUI Execute Command

```typescript
const result = await agent.tui.executeCommand({
  command: "agent_cycle"
});
```

## Convex Integration

### Creating the SDK Wrapper

`convex/missions/agent.ts`:

```typescript
import { internalAction } from "@gen/server";
import { v } from "convex/values";
import { api } from "@gen/api";

export const createOpenCodeClient = internalAction({
  args: { tunnelUrl: v.string() },
  handler: async (ctx, args) => {
    // Returns configured OpenCode SDK client
    return new OpenCode({
      baseUrl: args.tunnelUrl
    });
  }
});

export const runAgentCommand = internalAction({
  args: {
    tunnelUrl: v.string(),
    command: v.string(),
    args: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const agent = await ctx.runAction(api.missions.agent.createOpenCodeClient, {
      tunnelUrl: args.tunnelUrl
    });
    
    // Send command with optional arguments
    const result = await agent.session.prompt({
      sessionID: "primary",
      parts: [{ 
        type: "text", 
        text: args.args 
          ? `/${args.command} ${args.args}`
          : `/${args.command}`
      }]
    });
    
    return result;
  }
});
```

## Command Execution Flow

```
External System (Convex)
         │
         ▼
┌─────────────────────┐
│  runAgentCommand    │  ← Internal action
│  (tunnelUrl, cmd)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  OpenCode SDK       │  ← session.prompt()
│  (baseUrl: tunnel)  │
└──────────┬──────────┘
           │
           ▼
    ┌──────┴──────┐
    │  TUI Input  │
    └──────┬──────┘
           │
           ▼
    ┌──────┴──────┐
    │  Command    │  ← Matches /command in command/ dir
    │  Resolver   │
    └──────┬──────┘
           │
           ▼
    ┌──────┴──────┐
    │  Agent      │  ← Executes with specified agent
    │  Execution  │
    └──────┬──────┘
           │
           ▼
    ┌──────┴──────┐
    │  Response   │  ← Returns to external system
    └─────────────┘
```

## Example: Complete Command Invocation

### Step 1: Define Command

`.opencode/command/plan.md`:
```yaml
---
description: Generate execution plan
agent: plan
---
$ARGUMENTS
```

### Step 2: Invoke from Convex

`convex/orchestrator/workflow.ts`:

```typescript
import { ZopuFunctions } from "~/lib/workflow";

export const runMission = ZopuFunctions.define({
  args: { missionId: v.id("missions") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    // 1. Get session with tunnel URL
    const session = await ctx.runQuery(api.orchestrator.queries.getSession, {
      missionId: args.missionId
    });
    
    // 2. Invoke /plan command
    const planResult = await ctx.runAction(
      api.missions.agent.runAgentCommand,
      {
        tunnelUrl: session.tunnelUrl,
        command: "plan",
        args: session.missionDescription
      }
    );
    
    // 3. Wait for completion
    await ctx.waitForEvent("plan_completed", { missionId: args.missionId });
    
    return { success: true };
  }
});
```

### Step 3: Handle Response

The command response includes:

```typescript
interface CommandResponse {
  type: "text" | "tool-call" | "tool-result";
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
  metadata?: {
    command: string;
    agent: string;
    model: string;
    duration: number;
  };
}
```

## Event Streaming

For long-running commands, stream events:

```typescript
export const streamCommandEvents = internalAction({
  args: {
    tunnelUrl: v.string(),
    command: v.string()
  },
  handler: async (ctx, args) => {
    const agent = new OpenCode({ baseUrl: args.tunnelUrl });
    
    // Start command
    const stream = agent.session.stream({
      sessionID: "primary",
      parts: [{ type: "text", text: `/${args.command}` }]
    });
    
    // Process events
    for await (const event of stream) {
      // Log or forward events
      await ctx.runMutation(api.orchestrator.events.log, {
        type: event.type,
        data: event
      });
      
      // Handle specific event types
      if (event.type === "tool-call") {
        // Forward to UI
      }
    }
    
    return stream.finalResult;
  }
});
```

## Error Handling

```typescript
export const safeRunCommand = internalAction({
  args: {
    tunnelUrl: v.string(),
    command: v.string()
  },
  handler: async (ctx, args) => {
    try {
      const agent = new OpenCode({ baseUrl: args.tunnelUrl });
      
      const result = await agent.session.prompt({
        sessionID: "primary",
        parts: [{ type: "text", text: `/${args.command}` }]
      });
      
      return { success: true, result };
    } catch (error) {
      console.error("Command failed:", error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
});
```

## Command Arguments Handling

### Simple Arguments

```typescript
// /plan description
await agent.session.prompt({
  sessionID: "primary",
  parts: [{ type: "text", text: "/plan Implement user authentication" }]
});
```

### Multiple Arguments

```typescript
// /implement owner repo issueNumber
await agent.session.prompt({
  sessionID: "primary",
  parts: [{ 
    type: "text", 
    text: "/implementputer123 my-repo 42" 
  }]
});
```

### Complex Arguments (JSON)

```typescript
// For complex data, embed as JSON
const args = JSON.stringify({ owner: "user", repo: "test", issue: 42 });
await agent.session.prompt({
  sessionID: "primary",
  parts: [{ type: "text", text: `/implement ${args}` }]
});
```

## Available Command SDK Methods

### Session Methods

| Method | Purpose |
|--------|---------|
| `session.prompt()` | Send prompt/command |
| `session.command()` | Send raw command |
| `session.list()` | List available commands |
| `session.abort()` | Stop current execution |
| `session.stream()` | Stream events |

### TUI Methods

| Method | Purpose |
|--------|---------|
| `tui.executeCommand()` | Execute TUI command |
| `tui.listCommands()` | List available TUI commands |

### Command Methods

| Method | Purpose |
|--------|---------|
| `command.list()` | List all defined commands |
| `command.get(name)` | Get command definition |

## Complete Example: Multi-Command Workflow

```typescript
export const executeMission = internalAction({
  args: {
    tunnelUrl: v.string(),
    missionDescription: v.string()
  },
  handler: async (ctx, args) => {
    const agent = new OpenCode({ baseUrl: args.tunnelUrl });
    
    // Step 1: Generate plan
    const planResult = await agent.session.prompt({
      sessionID: "primary",
      parts: [{ 
        type: "text", 
        text: `/plan ${args.missionDescription}` 
      }]
    });
    
    // Step 2: Wait for user approval (via webhook)
    await ctx.waitForEvent("user_approved", { timeout: 3600000 });
    
    // Step 3: Execute plan
    const executeResult = await agent.session.prompt({
      sessionID: "primary",
      parts: [{ 
        type: "text", 
        text: `/execute ${args.missionDescription}` 
      }]
    });
    
    return {
      plan: planResult,
      execution: executeResult
    };
  }
});
```

## Environment Configuration

```typescript
// Configure OpenCode client
const agent = new OpenCode({
  baseUrl: process.env.OPENCODE_URL || "http://localhost:4096",
  auth: {
    type: "bearer",
    token: process.env.OPENCODE_TOKEN
  },
  timeout: 300000,  // 5 minutes
  retries: 3
});
```

## Best Practices

1. **Always use internal actions** - Never expose SDK directly
2. **Handle timeouts** - Commands may run long
3. **Stream events** - For real-time updates
4. **Log responses** - For debugging and audit
5. **Validate inputs** - Before sending commands
6. **Use typed arguments** - For complex workflows
7. **Handle errors gracefully** - Provide fallback options
