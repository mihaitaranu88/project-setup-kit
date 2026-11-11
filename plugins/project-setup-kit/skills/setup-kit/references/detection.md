# Detection

Read files; do not run install scripts, builds or anything that needs the network. Never open real `.env` files.

## Parts and languages

A part is a folder with its own manifest. Look at the root and up to three levels down (skip `node_modules`, `vendor`, `.venv`, `dist`, `build`, `target`).

| Manifest | Language / ecosystem | Package manager hint |
|---|---|---|
| `package.json` | JavaScript / TypeScript (`tsconfig.json` → TS) | `package-lock.json` npm, `pnpm-lock.yaml` pnpm, `yarn.lock` yarn, `bun.lock(b)` bun |
| `pyproject.toml`, `requirements*.txt`, `setup.py` | Python | `uv.lock` uv, `poetry.lock` poetry, `Pipfile.lock` pipenv |
| `composer.json` | PHP | composer |
| `go.mod` | Go | go modules |
| `pom.xml`, `build.gradle(.kts)` | Java / Kotlin | maven / gradle |
| `*.csproj`, `*.sln` | C# / .NET | dotnet |
| `Gemfile` | Ruby | bundler |
| `Cargo.toml` | Rust | cargo |

Workspaces (`workspaces` in package.json, a `pnpm-workspace.yaml` that has a `packages:` list, `go.work`, Cargo workspace, Gradle multi-project) mean a monorepo: treat each package as a part. A `pnpm-workspace.yaml` with only settings (`onlyBuiltDependencies`, catalogs) is not a monorepo.

## Frameworks and capabilities

- **Frontend**: react, vue, svelte, angular, solid, next, nuxt, astro, vite in dependencies; `.tsx`/`.vue`/`.svelte` files.
- **HTTP API**: express, fastify, nestjs, hono, koa; django, flask, fastapi; laravel, symfony, slim; gin, echo, chi, net/http handlers; spring-web; asp.net; rails.
- **Backend-as-a-service**: convex (`convex/schema.ts`), supabase (`supabase/`), firebase (`firebase.json`), appwrite, pocketbase. They have a database without migration files and client-callable functions instead of HTTP routes: items 42–43 usually do not apply, item 44 does (public vs internal functions, security rules).
- **Hosting with preview integration**: `vercel.json`, `.vercel/`, `netlify.toml`, `wrangler.toml`, `@vercel/*` dependencies, deploy docs mentioning previews.
- **DB + migrations**: typeorm, prisma, drizzle, knex, sequelize, mikro-orm; alembic, django migrations; laravel/doctrine migrations; goose, golang-migrate, atlas; flyway, liquibase; EF Core; `migrations/` folders.
- **Several services**: several deployable parts (several Dockerfiles, `docker-compose` with several app services, k8s manifests, `services/` or `apps/` folders).
- **Message broker**: amqplib, kafkajs, @azure/service-bus, sqs, nats, celery, laravel queues.
- **Versioned releases**: library publish config (`"private": false` with `publishConfig`, PyPI build backend, packagist type library), mobile app manifests, existing tags `v*`, `CHANGELOG.md`.
- **i18n**: i18next, react-intl, vue-i18n, gettext, Laravel `lang/`.

## New project generators

Offered in Phase 0b only, and run only after the user approves the exact command. Prefer the generator the framework documents:

| Stack | Command |
|---|---|
| Next.js | `pnpm create next-app@latest . --ts --eslint --app --use-pnpm` (or `npx create-next-app@latest .`) |
| Vite (React/Vue/Svelte) | `pnpm create vite@latest . --template react-ts` |
| Node library | `pnpm init` + `tsc --init` |
| Python | `uv init --app` (or `uv init --lib`) |
| Laravel | `composer create-project laravel/laravel .` |
| Symfony | `composer create-project symfony/skeleton .` |
| Go | `go mod init <module path>` |
| Spring Boot | `curl https://start.spring.io/starter.zip -d dependencies=web -d type=maven-project -o starter.zip` then unzip (ask before downloading) |
| .NET | `dotnet new webapi` (or `classlib`, `console`) |
| Rails | `rails new . --minimal` |

Generators that refuse a non-empty folder: run them in a temporary sub-folder and move the files up only after showing the user the list.

## Git platform

`git remote -v`: `github.com` → GitHub; `gitlab` → GitLab; `bitbucket.org` → Bitbucket; `dev.azure.com`/`visualstudio.com` → Azure DevOps. Also `.github/workflows/`, `.gitlab-ci.yml`, `bitbucket-pipelines.yml`, `azure-pipelines.yml`.

## AI tools

- Claude Code: `.claude/`, `CLAUDE.md`, `.mcp.json`
- GitHub Copilot: `.github/copilot-instructions.md`, `.github/instructions/`, `.github/agents/`, `.github/prompts/`, `.github/hooks/`
- Cursor: `.cursor/`, `.cursorrules`
- Others that read `AGENTS.md`: Codex, opencode (`.opencode/`), Gemini CLI (`GEMINI.md`)
- Shared agent skills: `.agents/skills/`, `skills-lock.json` (skills installed for several tools at once); count them as existing skills for item 34 and as roster entries for item 4

## Already configured — per item

Use the `detect` field of each catalog item. Rules for deciding the state:

- **configured**: the mechanism exists and runs (e.g. a workflow file with the job, a hook wired into the manager, the setting in the config).
- **partial**: some parts exist (e.g. Sonar without a coverage report; pre-commit with format but no lint; Dependabot only for one ecosystem of two). Record what is missing; ask only that.
- **missing**: nothing found.

Configured items are listed in the analysis report and recorded in `.ai-kit.json` as `existing` so `update` does not offer them again.

## Commands

Find the real commands the team uses, in this order: `package.json` scripts, `Makefile`/`justfile`/`Taskfile.yml`, `composer.json` scripts, `pyproject.toml` (`[tool.poe]`, `[tool.hatch]`, `[tool.pdm.scripts]`), CI workflow steps, README. Use them everywhere the kit needs a command (hooks, CI, commands, roles). Do not invent commands the project does not have; propose adding them instead.
