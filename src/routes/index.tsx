import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — TopAgents" },
      { name: "description", content: "Sign in to your TopAgents account." },
      { property: "og:title", content: "Sign in — TopAgents" },
      { property: "og:description", content: "Sign in to your TopAgents account." },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { configured, error: sessionError, loading, session } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/home", replace: true });
  }, [loading, navigate, session]);

  if (loading || session) {
    return (
      <main className="flex min-h-screen items-center justify-center p-5">
        <div className="glass w-full max-w-sm rounded-[2rem] p-8 text-center" aria-live="polite">
          <h1 className="font-display text-3xl font-bold">TopAgents</h1>
          <p className="mt-2 text-sm text-muted-foreground">Restoring your secure session…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setSubmitting(true);

          try {
            const client = getSupabaseClient();
            const { data, error: loginError } = await client.functions.invoke("account-login", {
              body: { username: username.trim().toLowerCase(), password },
            });
            if (loginError) throw new Error("Invalid username or password.");

            const loginData = data as {
              session?: { access_token: string; refresh_token: string };
            } | null;
            if (!loginData?.session) throw new Error("Sign-in is temporarily unavailable.");

            const { error: sessionSetError } = await client.auth.setSession(loginData.session);
            if (sessionSetError) throw new Error("Sign-in is temporarily unavailable.");
            navigate({ to: "/home", replace: true });
          } catch (submitError) {
            setError(
              submitError instanceof Error ? submitError.message : "Unable to sign in right now.",
            );
          } finally {
            setSubmitting(false);
          }
        }}
        className="glass w-full max-w-sm rounded-[2rem] p-8"
      >
        <h1 className="font-display text-4xl font-bold tracking-tight">TopAgents</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to continue</p>

        <div className="mt-8 space-y-4">
          <label className="block space-y-2 text-sm font-medium">
            <span>Username</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              type="text"
              name="username"
              placeholder="Your username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              required
              className="glass w-full rounded-2xl px-4 py-3 outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </label>
          <label className="block space-y-2 text-sm font-medium">
            <span>Password</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              name="password"
              placeholder="Your password"
              autoComplete="current-password"
              required
              className="glass w-full rounded-2xl px-4 py-3 outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </label>
        </div>

        {!configured && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            Cloud sign-in is not configured. Add the Supabase URL and publishable key to this
            environment.
          </p>
        )}
        {sessionError && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            Could not restore your session: {sessionError}
          </p>
        )}
        {error && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!configured || submitting}
          className="mt-6 w-full rounded-2xl bg-primary py-3 font-display font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Please wait…" : "Sign in"}
        </button>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Use the username and password for your Worker, Support, or Client account.
        </p>
      </form>
    </main>
  );
}
