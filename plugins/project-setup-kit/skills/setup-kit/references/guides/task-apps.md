# Guide: connect the task app (item 31)

Credentials are entered by the user into their own environment or the tool's login flow. They never go into a committed file or the chat.

## Jira / Confluence (Atlassian)

- Remote MCP server with OAuth: add to `.mcp.json` an entry of type `http` with URL `https://mcp.atlassian.com/v1/mcp`; each developer authenticates in the browser on first use (`/mcp` in Claude Code).
- Task key format: `PROJ-123`. Record the project key in `.ai-kit/config.json` for items 38 and 39.

## Linear

- Remote MCP server: `https://mcp.linear.app/mcp` (type `http`), OAuth on first use.
- Task key format: `TEAM-123`.

## GitHub Issues

- No extra server is needed when `gh` is installed and logged in (`gh auth status`); commands read issues with `gh issue view <n>`.
- Optionally the GitHub MCP server (`https://api.githubcopilot.com/mcp/`, type `http`).
- Task key format: `#123`. For branch names use `123` (e.g. `fix/123-short-name`).

## Trello and others

Check whether the vendor publishes an MCP server; otherwise commands take the task text pasted by the developer.

## After connecting

1. Ask the user to fetch one real task through the agent to confirm it works.
2. Record `taskApp` and `taskKeyPattern` in `.ai-kit/config.json`.
