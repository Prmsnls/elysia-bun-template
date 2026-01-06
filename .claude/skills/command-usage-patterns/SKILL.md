---
name: command-usage-patterns
description: Effective OpenCode command patterns - parallel commands, contextual triggers, conditional execution, and workflow automation
---

# Effective Command Usage Patterns

## Parallel Command Execution

### Pattern: Run Multiple Commands Concurrently

```yaml
---
description: Full system analysis
agent: plan
subtask: true
---
Analyze the codebase from multiple angles:

## Code Structure
!`find . -type f -name "*.ts" -o -name "*.tsx" | head -100`

## Dependencies
!`cat package.json | jq '{dependencies, devDependencies}'`

## Git History
!`git log --oneline -20`

## Test Coverage
!`npm test -- --coverage 2>&1 | tail -20`

Provide comprehensive analysis including:
1. Architecture overview
2. Key modules and their relationships
3. Potential refactoring opportunities
4. Performance bottlenecks
5. Security concerns
```

### Pattern: Aggregate Results

```yaml
---
description: Aggregate metrics
agent: plan
---
Collect and aggregate system metrics:

!`echo "=== CPU ===" && free -h`
!`echo "=== Memory ===" && df -h`
!`echo "=== Disk ===" && du -sh ./* | sort -hr | head -10`
!`echo "=== Files ===" && find . -type f | wc -l`

Summarize findings in table format.
```

## Contextual Command Triggers

### Pattern: Conditional Command Execution

```yaml
---
description: Conditional build
agent: build
---
Build information:
!`cat package.json | jq -r '.version'` (version)
!`git rev-parse --short HEAD` (commit)

Last build: !`ls -la dist/ 2>&1 | head -5 || echo "No dist directory"`

Build if:
1. Version changed since last build, OR
2. Git commit differs from last build, OR
3. dist/ directory doesn't exist

Run: !`npm run build 2>&1`
```

### Pattern: Environment-Aware Commands

```yaml
---
description: Deploy to environment
agent: build
---
Environment: $1 (staging/production)

Current config:
!`cat .env | grep -E "^${1^^}_" 2>&1 || echo "No ${1} config"`

Deploy to $1 if:
- Tests pass: !`npm test 2>&1 | grep -E "passing|failing"`
- Build succeeds: !`npm run build 2>&1 | tail -5`

Proceed with deployment? (Y/N)
```

## Workflow Automation

### Pattern: CI/CD Pipeline Commands

```yaml
---
description: Run CI pipeline
agent: build
---
# CI Pipeline - Full Verification

## Step 1: Lint
!`npm run lint 2>&1`

## Step 2: TypeCheck
!`npm run typecheck 2>&1`

## Step 3: Tests
!`npm test 2>&1`

## Step 4: Build
!`npm run build 2>&1`

## Step 5: Security Scan
!`npm audit --audit-level=high 2>&1 | head -20`

Report results for each step with pass/fail status.
```

### Pattern: Release Commands

```yaml
---
description: Create release
agent: build
---
Release Process for $1 (version)

## Pre-release Checks
- Version bump: !`npm version $1 --no-git-tag-version 2>&1`
- Changelog: !`git log --oneline --since="2 weeks ago" 2>&1`
- Tests: !`npm test 2>&1 | tail -10`

## Create Release
If all checks pass:
1. Update CHANGELOG.md
2. Commit changes: "Release v$1"
3. Create tag: v$1
4. Build: !`npm run build 2>&1`
5. Publish: !`npm publish 2>&1`

## Report
- Release created: version $1
- Tag: v$1
- Committed: [YES/NO]
- Published: [YES/NO]
```

## Interactive Commands

### Pattern: Guided Workflow

```yaml
---
description: Guided component creation
agent: coder
---
Component Creation Wizard

## Step 1: Component Details
Name: $1
Type: $2 (component/hook/page)
Directory: $3 (default: src/components)

## Step 2: Generate
Create component at $3/$1.tsx with:
- TypeScript types
- Props interface
- Basic structure
- Export statement

## Step 3: Update Index
Add to $3/index.ts:
- Export { $1 }
- Export type { $1Props }

## Step 4: Test
Verify component compiles: !`npx tsc --noEmit 2>&1`

Component $1 created successfully at $3/$1.tsx
```

### Pattern: Review Workflow

```yaml
---
description: PR review workflow
agent: plan
---
PR Review for $1 (PR number)

## PR Details
!`gh pr view $1 --json title,body,author,state 2>&1`

## Changed Files
!`gh pr diff $1 --name-only 2>&1`

## Review Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No debug code
- [ ] Follows style guide
- [ ] Security considerations addressed

## Detailed Review
Review each changed file for:
1. Logic errors
2. Performance issues
3. Security vulnerabilities
4. Code style violations

## Summary
Provide overall assessment: APPROVE / REQUEST_CHANGES / APPROVE_WITH_SUGGESTIONS
```

## Command Chaining

### Pattern: Sequential Dependencies

```yaml
---
description: Sequential workflow
agent: build
---
# Sequential Command Chain

## Step 1: Database
!`npm run db:migrate 2>&1`

## Step 2: Backend
!`npm run build:api 2>&1`

## Step 3: Frontend
!`npm run build:web 2>&1`

## Step 4: Tests
!`npm run test:e2e 2>&1`

Only proceed to next step if previous succeeds.
```

### Pattern: Error Recovery

```yaml
---
description: Resilient deployment
agent: build
---
Deploy with automatic rollback on failure

## Pre-deploy
!`kubectl config current-context`

## Deploy
if !`kubectl apply -f k8s/ 2>&1`; then
  echo "Deployment failed, initiating rollback..."
  !`kubectl rollout undo deployment/app 2>&1`
  echo "Rollback complete"
  exit 1
fi

## Verify
!`kubectl rollout status deployment/app 2>&1`

## Post-deploy
!`curl -f https://app.example.com/health 2>&1`
```

## Data-Driven Commands

### Pattern: Template with Data Injection

```yaml
---
description: Generate from template
agent: coder
---
Generate $1 (entity) from template

## Entity Data
!`cat data/$1.json`

## Generate Files
Based on entity data, create:
1. Model: src/models/$1.ts
2. Routes: src/routes/$1.ts
3. Tests: tests/$1.test.ts
4. Docs: docs/$1.md

## Validate
!`npm run typecheck 2>&1 | grep -E "$1|error" || echo "No type errors"`

## Output
Created/updated files:
- src/models/$1.ts
- src/routes/$1.ts  
- tests/$1.test.ts
- docs/$1.md
```

### Pattern: Report Generation

```yaml
---
description: Generate status report
agent: document-writer
---
Generate comprehensive status report

## Project Status
!`git status --short`
!`git log --oneline -5`

## Metrics
- Open issues: !`gh issue list --state open | wc -l`
- Open PRs: !`gh pr list --state open | wc -l`
- Last deployment: !`gh run list -L 1 --json status,conclusion 2>&1`

## Dependencies
!`npm outdated 2>&1 | tail -10`

## Report Structure
1. Executive Summary
2. Current Sprint Progress
3. Blockers and Risks
4. Dependency Updates Needed
5. Action Items

Format as Markdown document.
```

## Advanced Patterns

### Pattern: Command with File Generation

```yaml
---
description: Create from specification
agent: coder
---
Create implementation from @specs/$1.json

## Read Specification
!`cat specs/$1.json`

## Parse Requirements
Extract:
- API endpoints
- Data models
- Business logic
- Error handling

## Generate Code
Create implementation matching specification:
- src/api/$1.ts
- src/models/$1.ts
- tests/api/$1.test.ts

## Verify
!`npm run typecheck 2>&1 | grep "$1" || echo "Type check passed"`

## Output
Implementation complete for $1
- API: src/api/$1.ts
- Model: src/models/$1.ts
- Tests: tests/api/$1.test.ts
```

### Pattern: Monitoring Command

```yaml
---
description: System health check
agent: build
---
System Health Check

## Services
!`docker ps --format "table {{.Names}}\t{{.Status}}" | head -20`

## Resources
!`echo "=== CPU ===" && top -bn1 | grep "Cpu(s)"`
!`echo "=== Memory ===" && free -m | grep Mem`
!`echo "=== Disk ===" && df -h | grep -E "^/dev/"`

## Application Health
!`curl -s https://app.example.com/health | jq .`

## Database
!`PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1" 2>&1`

## Summary
Report overall system health: HEALTHY / DEGRADED / CRITICAL
```

## Command Best Practices

### Do

- Use `subtask: true` for complex commands
- Include error handling in templates
- Use shell output for dynamic context
- Chain commands when dependencies exist
- Validate inputs before processing
- Provide clear success/failure indicators

### Don't

- Create commands that run indefinitely
- Hardcode values (use placeholders)
- Include sensitive information
- Skip error handling
- Create overly complex single commands
- Forget to clean up resources

## Optimization Tips

| Scenario | Optimization |
|----------|--------------|
| Large codebase | Use `subtask: true` |
| Multiple outputs | Use file references |
| Long runtime | Stream events |
| Many files | Use `grep` first |
| Complex logic | Split into multiple commands |
