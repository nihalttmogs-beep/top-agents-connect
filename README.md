# TopAgents

A standalone glass-style agent portal. The project is maintained in this repository and uses Supabase for email/password authentication and cloud-synced chat history.

## What it does

- Authenticates users with Supabase Auth. New accounts must confirm their email before signing in.
- Shows the daily task status and quick links to separate client and support chat rooms.
- Stores chat messages in Supabase Postgres and syncs inserts in real time.
- Keeps each user's messages private with row-level security. The browser uses only the public Supabase publishable key; it never receives a service-role key.

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

The migrations in `supabase/migrations` create `public.chat_messages`, enable row-level security, limit client inserts to the authenticated user's own messages, and add the table to the Realtime publication. The schema migrations have been applied to the new `topagents-cloud` project. After linking the Supabase CLI to a target project, apply schema changes with `supabase db push`. The chat UI does not generate automatic replies; messages from the other participant require a real operator or a separately reviewed integration.

Email confirmation is enabled. Supabase's default email sender is rate-limited; configure a custom SMTP provider in Supabase Auth before inviting or supporting a broader user base. Add your local, preview, and production origins to Supabase Auth's redirect URL allow-list.

## Security notes

- Do not put a Supabase `service_role` or `sb_secret_` key in Vite variables or commit it to Git. The browser uses only the public publishable key; no service-role key is used by browser code.
- RLS scopes every chat row to `auth.uid()`. Clients can only read their own rows and insert their own `me` messages; this app does not automatically create `them` messages.
- Messages from a client or support operator require a real operator or a separately reviewed, trusted server-side integration.
