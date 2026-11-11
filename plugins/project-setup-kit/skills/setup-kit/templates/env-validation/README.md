# Startup env validation (item 20)

Write the schema in the project's language, in the module that already loads config. Every variable used anywhere must be in the schema and in `.env.example` (with a placeholder value). The app must exit with a message that lists every missing or invalid variable, not only the first one.

## TypeScript (zod)

```ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid environment:\n${problems.join('\n')}`);
  }
  return parsed.data;
}
```

## Next.js

Next.js inlines `NEXT_PUBLIC_*` variables only when each one is read by its full name, and the browser has no full `process.env`. Pass every variable explicitly and keep server and client schemas apart (or use `@t3-oss/env-nextjs`, which does exactly this):

```ts
const clientSchema = z.object({ NEXT_PUBLIC_API_URL: z.string().url() });
const serverSchema = z.object({ DATABASE_URL: z.string().url(), API_SECRET: z.string().min(1) });

export const clientEnv = clientSchema.parse({ NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL });
export const serverEnv = typeof window === 'undefined' ? serverSchema.parse({ DATABASE_URL: process.env.DATABASE_URL, API_SECRET: process.env.API_SECRET }) : null;
```

Import the module from `next.config.*` so `next build` fails on a missing variable, and run the parse only for production builds (`process.env.NODE_ENV === 'production'`) if the app shows its own help screen for missing variables in `next dev`. CI builds then need placeholder values (see `ci/github/README.md`).

## Backend-as-a-service (Convex, Supabase functions, Firebase)

Variables for server functions live on the deployment, not in the local env file (Convex: `npx convex env set/list`). Validate them inside the functions with a small helper that reads each variable by name and throws a clear error, and list every name in the env example file (keep the file's existing comment style). The local `.env*` only holds the deployment URL and keys for the frontend.

## Python (pydantic-settings)

```python
from pydantic import PostgresDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str
    port: int = 8000
    database_url: PostgresDsn


settings = Settings()
```

## PHP / Laravel

Validate in a service provider's `boot()` with `Validator::make(config('...'), [...])` and throw on failure, or with `vlucas/phpdotenv`: `$dotenv->required(['APP_KEY', 'DB_HOST'])->notEmpty();`.

## Go (caarlos0/env)

```go
type Config struct {
	Port        int    `env:"PORT" envDefault:"8080"`
	DatabaseURL string `env:"DATABASE_URL,required"`
}

func LoadConfig() (Config, error) {
	var cfg Config
	return cfg, env.Parse(&cfg)
}
```

## Java (Spring) / C# (.NET)

Spring: `@ConfigurationProperties` + `@Validated` with `@NotBlank` fields. .NET: `services.AddOptions<T>().Bind(...).ValidateDataAnnotations().ValidateOnStart();`.
