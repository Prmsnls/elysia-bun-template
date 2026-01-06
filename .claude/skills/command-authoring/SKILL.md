---
name: command-authoring
description: Best practices for authoring OpenCode custom commands - naming, organization, placeholders, and anti-patterns to avoid
---

# Command Authoring Best Practices

## Command Naming Conventions

### Do: Use Descriptive, Action-Oriented Names

| Good | Bad |
|------|-----|
| `analyze-coverage` | `test2` |
| `review-pr` | `pr-stuff` |
| `plan-feature` | `plan` |
| `deploy-staging` | `deploy` |
| `audit-security` | `security-check` |

### Do: Use Hyphens for Multi-Word Names

```
analyze-coverage    ✓
analyzeCoverage     ✗
analyze_coverage    ✗
analyze coverage    ✗
```

### Do: Prefix by Category

| Category | Prefix | Examples |
|----------|--------|----------|
| Analysis | `analyze-*` | `analyze-coverage`, `analyze-performance` |
| Review | `review-*` | `review-pr`, `review-code` |
| Planning | `plan-*` | `plan-feature`, `plan-migration` |
| Testing | `test-*` | `test-unit`, `test-integration` |
| Deployment | `deploy-*` | `deploy-staging`, `deploy-prod` |
| Git | `git-*` | `git-pr`, `git-branch` |

### Don't: Avoid Generic Names

```
run-tests        ✗ (too generic)
build           ✗ (ambiguous)
check           ✗ (what does it check?)
help            ✗ (conflicts with built-in)
```

## Frontmatter Configuration

### Required: Description

```yaml
---
description: "Brief, actionable description shown in TUI"
---
```

**Length**: 20-80 characters
**Style**: Verb-based, action-oriented

| Good | Bad |
|------|-----|
| "Run full test suite with coverage" | "Run tests" |
| "Review pull request for issues" | "Review PR" |
| "Generate feature implementation plan" | "Planning" |

### Optional: Agent Specification

```yaml
---
agent: "plan"       # Use specialized agent
agent: "build"      # Use build agent
agent: "coder"      # Use coding agent
---
```

**When to specify agent**:
- Complex analysis → `plan`
- Code modifications → `coder`
- Testing/deployment → `build`
- Documentation → `document-writer`

### Optional: Model Override

```yaml
---
model: "anthropic/claude-3-5-sonnet-20241022"
---
```

**Use cases**:
- Complex reasoning ( Sonnet)
- Fast responses (Haiku)
- Cost optimization (specific models)

### Optional: Subtask Mode

```yaml
---
subtask: true       # Run in isolated context
---
```

**Use when**:
- Command generates large output
- Need to prevent context pollution
- Command is complex with many steps

## Placeholder Usage

### `$ARGUMENTS` - All Arguments

```yaml
---
description: Create component with args
---
Create a new $ARGUMENTS component with TypeScript.
```

```
/component Button      → Creates "Button" component
/component Modal large → Creates "Modal large" component
```

### `$1`, `$2`, `$3` - Positional Arguments

```yaml
---
description: Create file from template
---
Create file $1 in directory $2 with template $3.
```

```
/create utils.ts src component
→ $1 = "utils.ts"
→ $2 = "src"
→ $3 = "component"
```

### Best Practices for Arguments

| Do | Don't |
|----|-------|
| Use `$ARGUMENTS` for simple cases | Use many positional args |
| Provide examples in comments | Assume user knows format |
| Validate arguments in template | Leave arguments unchecked |

### Shell Output (`!`command``)

```yaml
---
description: Analyze test results
---
Test results:
!`npm test 2>&1`

Suggest improvements based on these results.
```

**Common patterns**:

```yaml
# Git context
!`git status`
!`git diff --stat`
!`git log --oneline -10`

# Build info
!`npm run build 2>&1`
!`docker images`

# System info
!`free -h`
!`df -h`
!`ps aux | grep node`
```

### File References (`@filename`)

```yaml
---
description: Review component
---
Review @src/components/UserProfile.tsx for issues.
```

**Tips**:
- Use relative paths from project root
- Include file extension
- Reference specific files (not directories)

## Template Writing

### Do: Be Specific and Actionable

```yaml
# Good
---
description: Review code for security
---
Review the code for:
1. SQL injection vulnerabilities
2. XSS attack vectors
3. Authentication bypass issues
4. Insecure password handling

Report each finding with:
- File and line number
- Vulnerability type
- Severity (high/medium/low)
- Suggested fix
```

### Don't: Be Vague

```yaml
# Bad
---
description: Review code
---
Review the code and suggest improvements.
```

### Do: Use Structured Output

```yaml
---
description: Generate test report
---
Run tests and generate report:

## Test Results
- Total: !`npm test 2>&1 | grep -E "tests?" | head -1`
- Passed: !`npm test 2>&1 | grep -E "passing" | head -1`
- Failed: !`npm test 2>&1 | grep -E "failing" | head -1`

## Failing Tests
[List each failure with line number and error]
```

### Don't: Ask for Undefined Output

```yaml
# Bad
---
description: Analyze code
---
Analyze the code and tell me what you think.
```

## Anti-Patterns to Avoid

### 1. Hardcoding Values

```yaml
# Bad
---
description: Create user component
---
Create a User component with name "John" in /app directory.
```

```yaml
# Good
---
description: Create component
---
Create a $1 component with name $2 in directory $3.
```

### 2. Including Sensitive Information

```yaml
# Bad
---
description: Deploy with token
---
Deploy using token: sk-1234567890abcdef
```

```yaml
# Good
---
description: Deploy with env var
---
Deploy using environment variable $DEPLOY_TOKEN.
```

### 3. Overly Complex Templates

```yaml
# Bad (too long, does too much)
---
description: Full project setup
---
This command will:
1. Create a new Next.js project
2. Set up TypeScript configuration
3. Install all dependencies
4. Configure ESLint and Prettier
5. Set up CI/CD pipeline
6. Deploy to Vercel
...
```

```yaml
# Good (focused, single purpose)
---
description: Initialize Next.js project
---
Create a new Next.js project with TypeScript:
- npx create-next-app@latest $ARGUMENTS --typescript --eslint --tailwind
```

### 4. Missing Error Handling

```yaml
# Bad
---
description: Run tests
---
Run tests and report results.
```

```yaml
# Good
---
description: Run tests safely
---
1. Run tests: !`npm test 2>&1`
2. If tests fail, report:
   - Number of failures
   - Each failing test
   - Error messages
3. If tests pass, report success
```

## Organization Structure

### Recommended Layout

```
.opencode/
├── command/
│   ├── README.md              # Command documentation
│   │
│   ├── analyze/
│   │   ├── coverage.md
│   │   ├── performance.md
│   │   └── security.md
│   │
│   ├── review/
│   │   ├── pr.md
│   │   ├── code.md
│   │   └── security.md
│   │
│   ├── plan/
│   │   ├── feature.md
│   │   └── migration.md
│   │
│   ├── test/
│   │   ├── unit.md
│   │   ├── integration.md
│   │   └── e2e.md
│   │
│   └── deploy/
│       ├── staging.md
│       └── production.md
│
├── skills/
└── config.jsonc
```

### Command Grouping

| Group | Commands |
|-------|----------|
| Analysis | `analyze-coverage`, `analyze-performance`, `analyze-security` |
| Review | `review-pr`, `review-code` |
| Planning | `plan-feature`, `plan-migration` |
| Testing | `test-unit`, `test-integration` |
| Git | `git-pr-status`, `git-branch-cleanup` |

## Testing Commands

### Test Template Locally

```bash
# Run OpenCode with command
opencode run "/test-component MyButton"
```

### Validate Placeholders

```yaml
---
description: Test with placeholders
---
Args: $ARGUMENTS
$1: $1
$2: $2
$3: $3
```

### Check Shell Commands

```bash
# Verify shell commands work
npm test 2>&1
git log --oneline -10
```

## Documentation

### Include Usage Examples

```yaml
---
description: Create component
---
# Usage
/component Button primary

This creates a Button component:
- Name: $1 (Button)
- Style: $2 (primary)

Includes TypeScript types and basic styles.
```

### Document Requirements

```yaml
---
description: Deploy application
---
Requirements:
- $DEPLOY_TOKEN environment variable
- $ENV environment (staging/production)
- Access to deployment target

If requirements not met, report what's missing.
```

## Versioning Commands

When commands evolve:

1. **Increment version in comment**
2. **Deprecate old versions**
3. **Migrate gradually**

```yaml
---
description: Deploy (v2.0)
---
# Version 2.0 - Updated for new deployment pipeline
...
```

## Checklist Before Publishing

- [ ] Command name follows conventions
- [ ] Description is clear and action-oriented
- [ ] Placeholders are tested
- [ ] Shell commands are verified
- [ ] File references are correct
- [ ] Agent specification is appropriate
- [ ] Error handling is included
- [ ] Template is focused (not too long)
- [ ] Documentation is complete
- [ ] Tested with sample inputs
