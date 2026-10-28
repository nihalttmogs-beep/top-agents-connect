# TopAgents

A standalone agent portal with three managed account roles: Worker, Support, and Client (Hal). Supabase provides authentication, shared chat history, and real-time message updates.

## What it does

- Signs in with a username and password; the username selects the account role.
- Gives the Worker conversations with Support and Hal. Support and Hal each see their own conversation with the Worker.
- Stores messages in Supabase Postgres and syncs them in real time.
- Does not generate greetings or automatic replies. Replies must come from the other signed-in account.

## Run locally

Requirements: Node.js 22+ and [Bun](https://bun.sh/).

```sh
bun install
cp .env.example .env.local
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`, then run:

```sh
bun run dev
```

Useful checks:

```sh
bun run test
bun run lint
bun x tsc --noEmit
bun run build
bun run preview
```

## Supabase setup

The migrations in `supabase/migrations` create account profiles and Worker/Support/Client conversations, apply per-conversation RLS, and enable Realtime for chat messages. The `account-login` Edge Function maps the fixed usernames to confirmed Supabase Auth users and assigns their roles. The first valid sign-in provisions all three accounts. Public self-sign-up is disabled; bootstrap passwords are stored only as Supabase Edge Function secrets, never in this repository.

After linking the Supabase CLI to a target project, apply schema changes and deploy the login function with:

```sh
supabase db push
supabase functions deploy account-login
```

For a new project, set `BOOTSTRAP_WORKER_PASSWORD`, `BOOTSTRAP_SUPPORT_PASSWORD`, and `BOOTSTRAP_CLIENT_PASSWORD` as Supabase secrets before first sign-in. The configured TopAgents project already has its database migration, account-login function, and bootstrap secrets.

## Security notes

- The browser uses only the public Supabase publishable key. Do not put a `service_role` or `sb_secret_` key in Vite variables or commit one to Git.
- RLS limits each account to its own profile, assigned conversation(s), and messages in those conversations. Only the account-login function can provision the fixed roles.
- There is no automated reply system; messages appear for both participants through the shared conversation and Realtime.
