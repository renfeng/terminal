---
name: "terminal"
displayName: "Terminal"
description: "Execute any command-line tool via a single MCP tool. Runs commands directly via execFile (no shell) to prevent injection. Trust is managed by Kiro's autoApprove."
keywords: ["cli", "mvn", "maven", "git", "gradle", "docker", "kubectl", "npm", "cargo", "command", "shell", "terminal", "build", "deploy"]
---

# Terminal

A single MCP server exposing one tool: `execute`. It runs any CLI command on the user's PATH via `execFile` (no shell, no injection).

Trust and blocking are managed entirely by Kiro's `autoApprove` in `mcp.json`. The server has no allowlist — Kiro is the gatekeeper.

## Tool: `execute`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `command` | `string` | Yes | The CLI to run (e.g. `mvn`, `git`, `gradle`) |
| `args` | `string[]` | Yes | Arguments to pass |
| `cwd` | `string` | No | Working directory (defaults to server's cwd) |
| `timeout` | `number` | No | Timeout in ms (default: 30000) |

### Examples

```json
{ "command": "mvn", "args": ["clean", "install", "-DskipTests"] }
{ "command": "git", "args": ["log", "--oneline", "-10"] }
{ "command": "gradle", "args": ["build", "--info"] }
{ "command": "docker", "args": ["ps"] }
```

## Security

- `execFile` is used (not shell) — prevents command injection via args
- Kiro's `autoApprove` controls whether calls proceed without user confirmation
- Remove `execute` from `autoApprove` to require confirmation for every call
