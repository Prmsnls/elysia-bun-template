---
name: opencode-sessions
description: Access and analyze OpenCode chat session history
---

# OpenCode Sessions

Session storage: `~/.local/share/opencode/storage/`

## Structure

| Dir | Content | Key |
|-----|---------|-----|
| `session/{projectHash}/` | Session metadata | `ses_*.json` |
| `message/{sessionID}/` | Messages per session | `msg_*.json` |
| `part/` | Message content parts | Large content |

## Session JSON

| Field | Type |
|-------|------|
| `id` | `ses_*` ID |
| `projectID` | Hash of project path |
| `directory` | Full project path |
| `title` | Auto-generated title |
| `time.created/updated` | Unix ms |
| `summary.additions/deletions/files` | Change stats |

## Message JSON

| Field | Type |
|-------|------|
| `id` | `msg_*` ID |
| `sessionID` | Parent `ses_*` |
| `role` | `user`/`assistant` |
| `summary.title` | Message summary |
| `agent` | Agent name |
| `model.providerID/modelID` | Model info |

## Commands

```bash
# List projects with sessions
ls ~/.local/share/opencode/storage/session/

# Find sessions for current project (get hash from path)
PROJECT_HASH=$(echo -n "$PWD" | shasum | cut -c1-40)
ls ~/.local/share/opencode/storage/session/$PROJECT_HASH/

# Latest sessions across all projects
find ~/.local/share/opencode/storage/session -name "*.json" -mtime -1

# Read session metadata
cat ~/.local/share/opencode/storage/session/{hash}/{ses_id}.json | jq

# List messages for session
ls ~/.local/share/opencode/storage/message/{ses_id}/

# Read message
cat ~/.local/share/opencode/storage/message/{ses_id}/{msg_id}.json | jq

# Search sessions by title
grep -r "search term" ~/.local/share/opencode/storage/session/
```

## Use Cases

- Learn from past interactions
- Find successful/failed patterns
- Analyze agent behavior for skill improvement
- Extract good prompting examples
