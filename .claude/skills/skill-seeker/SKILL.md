---
name: Skill Seeker
description: Analyze sessions → discover patterns → generate skills for recurring workflows.
---

## 1. When to Use

Invoke when you need to:

- **Discover patterns**: Find how you approach tasks across sessions
- **Generate skills**: Create custom skills from established workflows
- **Identify gaps**: Find areas where new skills would help
- **Standardize workflows**: Convert repeated patterns into reusable skills
- **Onboard contexts**: Use session patterns to understand conventions

## 2. Workflow

| Step | Tool | Purpose |
|------|------|---------|
| 1 | `session_list` | List sessions with metadata (dates, messages, agents) |
| 2 | `session_info` | Get session stats (duration, todos, agents) |
| 3 | `session_read` | Extract full content, interactions, workflows |
| 4 | `session_search` | Find patterns, tools, recurring workflows |
| 5 | Analyze | Identify common sequences, approaches |
| 6 | Generate | Create skill definitions from patterns |

## 3. Input Parameters

| Param | Req | Description |
|-------|-----|-------------|
| `query` | No | Specific pattern/topic to search |
| `from_date` | No | Start date (ISO 8601) |
| `to_date` | No | End date (ISO 8601) |
| `limit` | No | Max sessions (default: 20) |
| `project_path` | No | Project to focus on |
| `skill_type` | No | Type: "workflow", "pattern", "convention" |

## 4. Analysis Steps

### 4.1 Session Discovery

```typescript
sessions = await session_list({
    from_date?: "2025-01-01",
    to_date?: "2025-12-31",
    limit?: 20,
    project_path?: "/path/to/project"
});
```

**Extract**: Session IDs, date ranges, message counts, agents used, project associations.

### 4.2 Session Deep Dive

```typescript
info = await session_info({ session_id });

messages = await session_read({
    session_id,
    limit?: 100,
    include_todos?: true,
    include_transcript?: true
});
```

**Extract**: Workflow steps, tool/agent patterns, decisions, success/failure rates, todo completion.

### 4.3 Pattern Search

```typescript
results = await session_search({
    query: "workflow pattern",
    session_id?: "specific-session-id",
    case_sensitive?: false,
    limit?: 20
});
```

**Extract**: Recurring phrases, common tool sequences, conventions, terminology.

### 4.4 Pattern Classification

| Pattern Type | Indicators | Skill Output |
|--------------|------------|--------------|
| **Workflow** | Same tool/agent sequence | "Code Review Workflow" |
| **Convention** | Consistent naming/structure | "Project Naming Conventions" |
| **Tool** | Specific tool combination | "Git Workflow Tools" |
| **Decision** | Similar decisions made | "Architecture Review Criteria" |
| **Domain** | Repeated work in domain | "Database Migration Patterns" |

## 5. Output Format

```markdown
---
name: <skill-name-kebab-case>
description: "<1-sentence summary>"
---

## 1. Purpose

Why this skill exists (from session patterns).

## 2. When to Use

Specific scenarios where this applies.

## 3. Workflow

Step-by-step process from analysis.

## 4. Examples

Concrete examples from actual sessions.

## 5. Conventions

Project-specific rules discovered.
```

## 6. Example

**Request**: "Analyze my code review patterns and generate a skill."

**Analysis**:
1. `session_list`: Find sessions with "review", "pr"
2. `session_read`: Extract review sequences
3. `session_search`: Search "linter", "test", "typecheck"
4. **Synthesize**: linter → tests → typecheck → review → PR

**Generated Skill**:

```markdown
---
name: Code Review Workflow
description: Your personal code review workflow.
---

## 1. Purpose

Standardize review process from recurring patterns.

## 2. When to Use

Before PRs, after implementation.

## 3. Workflow

1. `lsp_diagnostics` → catch errors
2. `bunx convex dev --once --typecheck=enable` → validate types
3. Project lint/format checks
4. `lsp_goto_definition` → review context
5. `lsp_find_references` → check impact
6. `gh pr create` → create PR

## 4. Conventions

- Always typecheck before PR
- Review affected files, not just changed
- Check regressions in related code

## 5. Examples

Sessions: 2025-12-15, 2025-12-20, 2025-12-28
```

## 7. Best Practices

### Do

- Focus on **3+ occurrences** = skill candidate
- Use **actual session content** as examples
- Include **project-specific conventions**
- Reference **specific files, commands, tools**
- Match **your communication style**

### Don't

- Generate from single-session observations
- Create skills for obvious patterns
- Over-generalize (keep project-specific)
- Include sensitive info (credentials, tokens)
- Skip pattern validation

## 8. Advanced Analysis

### Multi-Session Patterns

```typescript
sessions = await session_list({
    query: "implement feature X",
    limit: 50
});
// Correlate sessions, extract common sequences
```

### Agent Specialization

```typescript
results = await session_search({
    query: "agent_used",
    limit: 100
});
// Synthesize: frontend → frontend-ui-ux-engineer
// Synthesize: debugging → oracle
// Synthesize: research → librarian
```

### Tool Frequency

```typescript
sessions = await session_list({ limit: 100 });
// Extract tool calls, count frequency
// Rank by usage → create skills for top tools
```

## 9. Skill Registry

| Location | Use Case |
|----------|----------|
| `.claude/skills/<name>/SKILL.md` | Project-specific |
| `~/.claude/skills/<name>/SKILL.md` | Cross-project |
| `.opencode/skill/<name>/SKILL.md` | OpenCode-specific |

**After generating**:
1. Present skill for review
2. Ask location preference
3. Offer to create file
4. Suggest test approach

## 10. Edge Cases

| Situation | Handling |
|-----------|----------|
| No sessions | Return helpful message about session history |
| Sparse data | Suggest manual documentation |
| Contradictory patterns | Present all, mark conflicts |
| Sensitive content | Filter credentials, tokens, keys |
| Overlapping skills | Suggest consolidation/differentiation |
