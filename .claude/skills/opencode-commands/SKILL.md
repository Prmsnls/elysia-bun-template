---
name: opencode-commands
description: Comprehensive guide to OpenCode custom commands - structure, configuration, placeholders, and effective usage patterns
---

# OpenCode Custom Commands Guide

Custom commands let you define reusable prompts triggered by typing `/command-name` in the TUI. This is essential for automating repetitive workflows.

## Quick Start

### Create a Markdown Command File

`.opencode/command/test.md`:
```yaml
---
description: Run tests with coverage
agent: build
model: anthropic/claude-3-5-sonnet-20241022
---
Run the full test suite with coverage report and show any failures.
Focus on the failing tests and suggest fixes.
```

Use the command:
```
/test
```

### JSON Configuration

`opencode.jsonc`:
```json
{
  "command": {
    "test": {
      "template": "Run the full test suite with coverage report...\nFocus on failing tests.",
      "description": "Run tests with coverage",
      "agent": "build",
      "model": "anthropic/claude-3-5-sonnet-20241022"
    }
  }
}
```

## Command File Locations

| Location | Scope |
|----------|-------|
| `.opencode/command/<name>.md` | Project-specific |
| `~/.config/opencode/command/<name>.md` | Global (all projects) |

**Filename becomes command name**: `test.md` → `/test`

## Frontmatter Options

```yaml
---
description: "Brief description shown in TUI"     # Required
agent: "plan"                                     # Optional: specific agent
model: "opencode/big-pickle"                      # Optional: override default model
subtask: true                                     # Optional: force subagent mode
---
```

### Option Details

| Option | Type | Purpose |
|--------|------|---------|
| `description` | string | Shown in TUI command list |
| `agent` | string | Agent to execute (e.g., "plan", "coder") |
| `model` | string | Override default model |
| `subtask` | boolean | Force subagent invocation (isolated context) |

## Placeholders & Dynamic Content

### Arguments (`$ARGUMENTS`, `$1`, `$2`, ...)

Pass dynamic input to commands:

`.opencode/command/component.md`:
```yaml
---
description: Create a new component
---
Create a new React component named $ARGUMENTS with TypeScript support.
```

Usage:
```
/component Button
```

**Individual arguments**:
- `$1` - First argument
- `$2` - Second argument
- `$3` - Third argument
- etc.

Example:
```yaml
---
description: Create file with content
---
Create a file named $1 in directory $2 with content: $3
```

Usage:
```
/create-file config.json src "{ "key": "value" }"
```

### Shell Output (`!`command``)

Inject bash command output into prompts:

`.opencode/command/coverage.md`:
```yaml
---
description: Analyze test coverage
---
Current test results:
!`npm test`

Based on these results, suggest improvements to increase coverage.
```

**Commands run in project root** - output becomes part of the prompt.

### File References (`@filename`)

Include file content directly:

`.opencode/command/review.md`:
```yaml
---
description: Review component
---
Review the component in @src/components/Button.tsx for issues.
```

## Built-in Commands

| Command | Purpose |
|---------|---------|
| `/init` | Initialize new session |
| `/undo` | Undo last action |
| `/redo` | Redo action |
| `/share` | Share session |
| `/help` | Show help |

**Note**: Custom commands can override built-ins.

## Effective Usage Patterns

### Pattern 1: Parameterized Workflows

```yaml
---
description: Generate execution plan for issue
agent: plan
---
# Plan Generation for $ARGUMENTS

Analyze this requirement and create a detailed implementation plan:

$ARGUMENTS

Include:
1. Summary
2. Technical approach
3. Affected files
4. Step-by-step implementation
5. Risks & considerations
```

### Pattern 2: Context-Aware Commands

```yaml
---
description: Review git changes
---
Recent commits:
!`git log --oneline -10`

Current status:
!`git status --porcelain`

Review these changes and suggest improvements.
```

### Pattern 3: File-Focused Commands

```yaml
---
description: Audit component
---
Audit @src/components/UserProfile.tsx for:
1. Performance issues
2. Memory leaks
3. Accessibility problems
4. Security concerns

Provide specific fixes with code examples.
```

### Pattern 4: Multi-Step Commands

```yaml
---
description: Full test and report
agent: build
---
1. Run tests: !`npm test 2>&1`
2. Run lint: !`npm run lint 2>&1`
3. Run typecheck: !`npm run typecheck 2>&1`

Analyze results and create a report with:
- Tests passed/failed
- Linting errors
- Type errors
- Suggested fixes
```

### Pattern 5: Repository Analysis

```yaml
---
description: Analyze repository structure
---
Repository structure:
!`find . -type f -name "*.ts" -o -name "*.tsx" | head -50`

Package.json dependencies:
!`cat package.json | jq '.dependencies, .devDependencies'`

Analyze this codebase and identify:
1. Main architecture patterns
2. Technology stack
3. Key modules and their purposes
4. Potential refactoring opportunities
```

## Command Authoring Best Practices

### Do

- Use descriptive `description` for TUI discoverability
- Use `$ARGUMENTS` for flexible input
- Use `!`command`` for dynamic context
- Use `@filename` for file-specific reviews
- Specify `agent` for specialized tasks
- Keep templates focused and actionable

### Don't

- Overly generic descriptions ("Run something")
- Hardcode values that should be dynamic
- Include sensitive info in templates
- Create commands that are too complex (use subagents instead)
- Forget to escape special characters in shell commands

### Organization

```
.opencode/command/
├── test.md           # Test commands
├── review.md         # Code review commands
├── plan.md           # Planning commands
├── analyze.md        # Analysis commands
└── github/
    ├── pr.md         # PR-related commands
    └── issue.md      # Issue-related commands
```

## Subagents & Context Isolation

Use `subtask: true` when:

- Command should not pollute primary context
- Need isolated execution environment
- Want to prevent context overflow
- Command is complex with many steps

```yaml
---
description: Deep analysis task
agent: plan
subtask: true
---
Perform deep analysis of the entire codebase...

This runs in isolated context, results returned to main session.
```

## Common Command Templates

### Test Commands
```yaml
---
description: Run tests
agent: build
---
!`npm test`

Analyze test output and report:
- Tests passed/failed
- Failure reasons
- Suggested fixes
```

### Code Review
```yaml
---
description: Review changes
---
!`git diff --stat`

Review these changes for:
1. Logic errors
2. Security issues
3. Performance concerns
4. Code style violations
```

### Build & Deploy
```yaml
---
description: Build and deploy
agent: build
---
1. Build: !`npm run build 2>&1`
2. Test: !`npm test 2>&1`
3. Report results

If build fails, identify issues and suggest fixes.
```

### Documentation
```yaml
---
description: Generate docs
agent: document-writer
---
Analyze @src/components/*.tsx and generate JSDoc comments for all exported functions.

Return the updated file contents.
```

## Error Handling

Commands can include error handling instructions:

```yaml
---
description: Safe refactor operation
---
Refactor the code with these safety rules:

1. NEVER modify more than 3 files in one command
2. ALWAYS run tests after modifications
3. IF tests fail, revert changes and report error
4. ASK for confirmation before destructive operations

Proceed only if these conditions are met.
```

## Debugging Commands

```yaml
---
description: Debug performance issue
---
Current performance metrics:
!`npm run perf-test 2>&1` || echo "No perf test configured"

CPU profile:
!`node --cpu-profile /tmp/cpu.prof 2>&1 || echo "No CPU profile"`

Analyze these metrics and identify bottlenecks.
```

## Integration with Workflows

Commands work seamlessly with Convex workflows:

```typescript
// In Convex action
export const runPlanCommand = internalAction({
  args: { missionId: v.id("missions") },
  handler: async (ctx, args) => {
    const mission = await ctx.runQuery(api.missions.get, { id: args.missionId });
    
    // Invoke /plan command via OpenCode SDK
    await ctx.runAction(api.missions.agent.runAgentCommand, {
      tunnelUrl: mission.tunnelUrl,
      command: "plan",
      args: mission.description
    });
  }
});
```

## Command Discovery

List available commands:

```bash
# Via CLI
opencode command list

# In TUI
Ctrl+P (opens command palette)
```

## Best Practices Summary

1. **Name commands clearly**: `analyze-coverage` not `test2`
2. **Use descriptions**: Help users discover capabilities
3. **Leverage placeholders**: Make commands reusable
4. **Use agents appropriately**: Match task to agent type
5. **Consider subtask**: Isolate complex operations
6. **Test commands**: Verify output before deploying
7. **Document patterns**: Share successful commands with team

## File Structure Example

```
.opencode/
├── command/
│   ├── analyze.md         # Code analysis
│   ├── build.md           # Build operations
│   ├── debug.md           # Debug commands
│   ├── deploy.md          # Deployment commands
│   ├── pr.md              # PR workflows
│   ├── review.md          # Code review
│   ├── test.md            # Testing commands
│   └── plan/
│       ├── issue.md       # Issue planning
│       └── feature.md     # Feature planning
├── config.jsonc
└── skills/
    └── ...
```
