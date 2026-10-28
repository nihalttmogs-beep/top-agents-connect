import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { isLoggedIn } from "@/lib/auth";

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
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) navigate({ to: "/", replace: true });
    else {
      setDate(
        new Date().toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      );
      setReady(true);
    }
  }, [navigate]);

  if (!ready) return null;

  return (
    <main className="mx-auto min-h-screen max-w-2xl p-5 pt-8">
      <div className="fixed right-5 top-5 z-20">
        <button
          aria-label="Menu"
          onClick={() => setOpen(!open)}
          className="glass-strong flex h-14 w-14 items-center justify-center rounded-full transition hover:scale-105"
        >
          <div className="space-y-1.5">
            <span className="block h-0.5 w-6 rounded bg-foreground" />
            <span className="block h-0.5 w-6 rounded bg-foreground" />
            <span className="block h-0.5 w-6 rounded bg-foreground" />
          </div>
        </button>
        {open && (
          <div className="glass-strong menu-enter absolute right-0 mt-3 w-52 overflow-hidden rounded-2xl p-2">
            <Link
              to="/chat/$room"
              params={{ room: "client" }}
              className="block rounded-xl px-4 py-3 hover:bg-glass"
            >
              Message Client
            </Link>
            <Link
              to="/chat/$room"
              params={{ room: "support" }}
              className="block rounded-xl px-4 py-3 hover:bg-glass"
            >
              Message us
            </Link>
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
    </main>
  );
}
