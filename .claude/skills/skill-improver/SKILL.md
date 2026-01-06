---
name: skill-improver
description: Analyze OpenCode sessions to improve skill effectiveness
---

# Skill Improver

Analyze session history → identify patterns → update skills

## 1. Pull Session Data

```bash
# Sessions location
~/.local/share/opencode/storage/session/{projectHash}/
~/.local/share/opencode/storage/message/{sessionID}/

# Find recent sessions for this project
find ~/.local/share/opencode/storage/session/ -name "*.json" -mtime -7 | xargs grep -l "$(basename $PWD)"
```

## 2. Pattern Extraction

| Pattern | Indicator | Action |
|---------|-----------|--------|
| **Success** | Task completed, no corrections | Extract as example |
| **Failure** | Tool errors, user corrections | Add clarification |
| **Rework** | Multiple attempts same goal | Simplify instruction |
| **Hesitation** | Reads many files before acting | Add file locations |
| **Token Waste** | Large file reads for small info | Add grep patterns |

## 3. Issue Identification

| Issue | Session Signal |
|-------|----------------|
| Unclear instructions | Agent asks clarifying Qs |
| Missing patterns | Uses generic tools vs specialized |
| Wrong paths | File not found errors |
| Bad replace strings | Multiple replace attempts |
| Verbose output | Truncated responses |

## 4. Improvement Workflow

```
1. Read skill: .claude/skills/{name}/SKILL.md
2. Find sessions using that skill (grep session titles/content)
3. Identify failure patterns (see tables above)
4. Update skill with:
   - Clearer instructions
   - Concrete examples
   - Correct paths
   - Better patterns
5. Verify with subsequent sessions
```

## 5. Good vs Bad Patterns

**BAD**: Agent reads entire file for one check
```
read_file('package.json')  # 500 lines
# then checks one dependency
```
**FIX**: Add grep pattern to skill

**BAD**: Agent guesses file locations
```
read_file('src/utils.ts')  # not found
read_file('lib/utils.ts')  # not found
read_file('utils/index.ts') # found
```
**FIX**: Add explicit paths to skill

**GOOD**: Agent uses targeted search
```
grep_file('functionName', '**/*.ts')
# precise results, then edit
```

## 6. Improvement Cycle

```bash
# 1. Identify skill + recent sessions
SKILL=".claude/skills/my-skill/SKILL.md"
SESSIONS=$(find ~/.local/share/opencode/storage/message -name "*.json" -mtime -3)

# 2. Analyze for patterns
for s in $SESSIONS; do cat "$s" | jq '.summary.title'; done

# 3. Read skill, identify gaps
cat $SKILL

# 4. Update skill with improvements
# Use edit tool with specific oldString/newString

# 5. Test in next session
```
