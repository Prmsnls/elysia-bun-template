---
name: gemini-cli
description: Gemini CLI sub-agent - code gen, file ops, web research, codebase analysis
---

# Gemini CLI

1M token context | Google Search grounding | Free: 60 req/min, 1k/day | MCP extensible

## Invoke

```bash
gemini -y "prompt"                    # headless auto-approve
gemini -y -m gemini-2.5-flash "..."   # faster model
gemini -y --output-format json "..."  # structured
```

`-y`=yolo | `--output-format`=[text|json|stream-json] | `--include-directories`=path,path

## Patterns

```bash
# Code gen
gemini -y "Create 'path/File.tsx': TS component, props X/Y, Tailwind"

# File mod
gemini -y "Read 'schema.ts', add table 'notifications': userId(ref), msg(str), read(bool)"

# Web research
gemini -y "Search latest Convex file storage practices, summarize upload/download/security"

# Codebase analysis
gemini -y "Analyze auth: read 'auth.ts'+'auth-client.ts', trace login, find gaps"

# Multi-file refactor
gemini -y "Refactor 'wallet/': extract types, add error handling, fix imports"

# Test gen
gemini -y "Read 'mutations.ts', create 'mutations.test.ts': unit tests + edge cases"
```

## When

**USE:** large context, web lookup, multi-file ops, bootstrap, self-contained
**SKIP:** single-line, interactive, already have context, speed-critical

## Advanced

```bash
gemini -y --include-directories ../lib,../docs "..."  # expand scope
gemini --resume latest "continue..."                   # resume
gemini -y --output-format json "..." | jq '...'       # pipe
```

## Prompting

Exact paths | "Read X first" | One task/prompt | Specify output | State constraints
