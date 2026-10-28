import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { isLoggedIn } from "@/lib/auth";

type Msg = { id: number; from: "me" | "them"; text: string; time: number };

const ROOMS = {
  client: {
    name: "Hal",
    greeting: "Hi! I'll let you know as soon as I have a task for you.",
    replies: [
      "Got it, thanks!",
      "I'll get back to you shortly.",
      "Noted. No tasks yet, stay tuned.",
      "Sounds good 👍",
    ],
  },
  support: {
    name: "Support Team",
    greeting: "Welcome to TopAgents support. How can we help you today?",
    replies: [
      "Thanks for reaching out! A team member will review this.",
      "We've noted your request.",
      "Is there anything else we can help with?",
    ],
  },
} as const;

export const Route = createFileRoute("/chat/$room")({
  head: ({ params }) => {
    const n = params.room === "support" ? "Support Team" : "Hal";
    return {
      meta: [
        { title: `Chat with ${n} — TopAgents` },
        { name: "description", content: `Message ${n} on TopAgents.` },
        { property: "og:title", content: `Chat with ${n} — TopAgents` },
        { property: "og:description", content: `Message ${n} on TopAgents.` },
      ],
    };
  },
  component: Chat,
});

function Chat() {
  const { room } = Route.useParams();
  const cfg = ROOMS[room === "support" ? "support" : "client"];
  const key = `topagents_chat_${room}`;
  const navigate = useNavigate();
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoggedIn()) return void navigate({ to: "/", replace: true });
    const saved = localStorage.getItem(key);
    setMsgs(
      saved ? JSON.parse(saved) : [{ id: 1, from: "them", text: cfg.greeting, time: Date.now() }],
    );
  }, [cfg.greeting, key, navigate]);

  useEffect(() => {
    if (msgs) localStorage.setItem(key, JSON.stringify(msgs));
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [key, msgs, typing]);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    setMsgs((m) => [...(m ?? []), { id: Date.now(), from: "me", text: t, time: Date.now() }]);
    setText("");
    setTyping(true);
    setTimeout(
      () => {
        setTyping(false);
        const r: string = cfg.replies[Math.floor(Math.random() * cfg.replies.length)] ?? "";
        setMsgs((m) => [
          ...(m ?? []),
          { id: Date.now() + 1, from: "them", text: r, time: Date.now() },
        ]);
      },
      1200 + Math.random() * 1000,
    );
  };

  if (!msgs) return null;
  const fmt = (n: number) =>
    new Date(n).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col p-3">
      <header className="glass-strong flex items-center gap-3 rounded-3xl p-3">
        <Link
          to="/home"
          aria-label="Back"
          className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-glass text-xl"
        >
          ←
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-display font-bold text-primary-foreground">
          {cfg.name[0]}
        </div>
        <div>
          <p className="font-display font-semibold">{cfg.name}</p>
          <p className="text-xs text-muted-foreground">{typing ? "typing…" : "online"}</p>
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-1 py-4">
        {msgs.map((m) => (
          <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-2 ${m.from === "me" ? "bg-primary text-primary-foreground rounded-br-md" : "glass rounded-bl-md"}`}
            >
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
              <p className="mt-1 text-right text-[10px] opacity-60">{fmt(m.time)}</p>
            </div>
          </div>
        ))}
        {typing && (
          <div className="glass w-16 rounded-2xl px-4 py-2 text-center animate-pulse">•••</div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="glass-strong flex gap-2 rounded-3xl p-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${cfg.name}…`}
          className="flex-1 bg-transparent px-3 outline-none placeholder:text-muted-foreground"
        />
        <button
          disabled={!text.trim()}
          className="rounded-2xl bg-primary px-5 py-2 font-semibold text-primary-foreground disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </main>
  );
}
