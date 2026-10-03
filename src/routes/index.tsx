import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { isLoggedIn, login } from "@/lib/auth";

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
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) navigate({ to: "/home", replace: true });
    else setReady(true);
  }, [navigate]);

  if (!ready) return null;

  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (login(u, p)) navigate({ to: "/home", replace: true });
          else setErr("Incorrect username or password");
        }}
        className="glass w-full max-w-sm rounded-[2rem] p-8"
      >
        <h1 className="font-display text-4xl font-bold tracking-tight">TopAgents</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to continue</p>
        <div className="mt-8 space-y-3">
          <input value={u} onChange={(e) => setU(e.target.value)} placeholder="Username" autoComplete="username"
            className="glass w-full rounded-2xl px-4 py-3 outline-none placeholder:text-muted-foreground focus:border-primary" />
          <input value={p} onChange={(e) => setP(e.target.value)} type="password" placeholder="Password" autoComplete="current-password"
            className="glass w-full rounded-2xl px-4 py-3 outline-none placeholder:text-muted-foreground focus:border-primary" />
        </div>
        {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
        <button className="mt-6 w-full rounded-2xl bg-primary py-3 font-display font-semibold text-primary-foreground transition hover:opacity-90">
          Log in
        </button>
      </form>
    </main>
  );
}
