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
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
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
          setNotice("");
          setSubmitting(true);

          try {
            const client = getSupabaseClient();
            const normalizedEmail = email.trim();

            if (mode === "sign-in") {
              const { error: signInError } = await client.auth.signInWithPassword({
                email: normalizedEmail,
                password,
              });
              if (signInError) throw signInError;
              navigate({ to: "/home", replace: true });
            } else {
              const { data, error: signUpError } = await client.auth.signUp({
                email: normalizedEmail,
                password,
                options: { emailRedirectTo: window.location.origin },
              });
              if (signUpError) throw signUpError;

              if (data.session) navigate({ to: "/home", replace: true });
              else setNotice("Check your email to confirm your account, then sign in.");
            }
          } catch (submitError) {
            setError(
              submitError instanceof Error
                ? submitError.message
                : "Unable to authenticate right now.",
            );
          } finally {
            setSubmitting(false);
          }
        }}
        className="glass w-full max-w-sm rounded-[2rem] p-8"
      >
        <h1 className="font-display text-4xl font-bold tracking-tight">TopAgents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "sign-in" ? "Sign in to continue" : "Create your agent account"}
        </p>

        <div className="mt-8 space-y-4">
          <label className="block space-y-2 text-sm font-medium">
            <span>Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              name="email"
              placeholder="you@example.com"
              autoComplete="email"
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
              placeholder={mode === "sign-up" ? "At least 8 characters" : "Your password"}
              autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
              minLength={mode === "sign-up" ? 8 : undefined}
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
        {notice && (
          <p className="mt-4 text-sm text-primary" role="status">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={!configured || submitting}
          className="mt-6 w-full rounded-2xl bg-primary py-3 font-display font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"));
            setError("");
            setNotice("");
          }}
          className="mt-4 w-full rounded-2xl px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          {mode === "sign-in" ? "New here? Create an account" : "Already registered? Sign in"}
        </button>
      </form>
    </main>
  );
}
