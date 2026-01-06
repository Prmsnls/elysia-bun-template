---
description: Analyze a Gitea issue and generate an execution plan
agent: plan
model: opencode/big-pickle
---

# Issue Analysis Task

You are analyzing a Gitea issue to create a detailed execution plan for implementation.

## Issue Context

- **Issue Number:** #$1
- **Repository Owner:** $2
- **Repository Name:** $3

## Instructions

First, fetch the issue details and comments using these commands:

1. Get issue details:
   ```bash
   tea issue $1 --repo "$2/$3" --output json
   ```

2. Get issue comments:
   ```bash
   tea comment $1 --repo "$2/$3" --output json
   ```

After fetching, analyze the issue and create a comprehensive execution plan covering:

1. **What needs to be built or changed** - Requirements from the issue and comments
2. **Technical approach** - How should this be implemented?
3. **Files affected** - What files need to be created, modified, or deleted?
4. **Implementation steps** - Break down into ordered, actionable steps
5. **Risks and considerations** - Edge cases, dependencies, or potential issues

## Output Format

Generate a detailed plan report in markdown:

```
# Execution Plan for Issue #$1

## Summary
[1-2 sentence summary]

## Analysis

### Requirements
- [Requirement 1]
- [Requirement 2]

### Technical Approach
[Describe the technical approach]

## Affected Files

| File | Action | Purpose |
|------|--------|---------|
| path/to/file.ts | create/modify/delete | Brief description |

## Implementation Steps

### Step 1: [Step Title]
**Complexity:** low/medium/high
**Files:** file1.ts, file2.ts

[Detailed description]

### Step 2: [Step Title]
...

## Risks & Considerations
- [Risk 1]
- [Risk 2]

## Estimated Effort
**Size:** small/medium/large
**Estimated time:** [rough estimate]

## Questions (if any)
- [Clarifying questions needed before implementation]
```

If the issue lacks sufficient information, state what's missing and what questions need answers.

## Important Notes

- Create a clear, actionable plan a developer can follow
- Be specific about file paths and changes
- Consider existing codebase structure and conventions
- Identify dependencies between steps
- Flag potential breaking changes or risks
