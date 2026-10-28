import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Dashboard — TopAgents" },
      { name: "description", content: "Your TopAgents task dashboard." },
      { property: "og:title", content: "Dashboard — TopAgents" },
      { property: "og:description", content: "Your TopAgents task dashboard." },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const { loading, user } = useAuth();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/", replace: true });
      return;
    }

    setDate(
      new Date().toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    );
    setReady(true);
  }, [loading, navigate, user]);

  if (!ready) return null;

  return (
    <main className="mx-auto min-h-screen max-w-2xl p-5 pt-8">
      <div className="fixed right-5 top-5 z-20">
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => setOpen((current) => !current)}
          className="glass-strong flex h-14 w-14 items-center justify-center rounded-full transition hover:scale-105"
        >
          <div className="space-y-1.5" aria-hidden="true">
            <span className="block h-0.5 w-6 rounded bg-foreground" />
            <span className="block h-0.5 w-6 rounded bg-foreground" />
            <span className="block h-0.5 w-6 rounded bg-foreground" />
          </div>
        </button>
        {open && (
          <div className="glass-strong menu-enter absolute right-0 mt-3 w-60 overflow-hidden rounded-2xl p-2">
            <p className="truncate px-4 py-2 text-xs text-muted-foreground">{user?.email}</p>
            <Link
              to="/chat/$room"
              params={{ room: "client" }}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 hover:bg-glass"
            >
              Message Client
            </Link>
            <Link
              to="/chat/$room"
              params={{ room: "support" }}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-4 py-3 hover:bg-glass"
            >
              Message us
            </Link>
            <button
              type="button"
              onClick={async () => {
                setSignOutError("");
                const { error } = await getSupabaseClient().auth.signOut();
                if (error) setSignOutError(error.message);
                else navigate({ to: "/", replace: true });
              }}
              className="mt-1 block w-full rounded-xl px-4 py-3 text-left text-muted-foreground hover:bg-glass hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      <p className="font-display text-sm uppercase tracking-widest text-muted-foreground">
        TopAgents
      </p>
      <h1 className="mt-2 pr-16 font-display text-3xl font-bold">{date}</h1>

      <div className="glass mt-8 rounded-3xl border-destructive/50 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/25 font-bold text-destructive">
            !
          </div>
          <p className="text-lg leading-snug">
            No task assigned for you yet. Contact your client for inquiry
          </p>
        </div>
      </div>

      {signOutError && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          Could not sign out: {signOutError}
        </p>
      )}
    </main>
  );
}
