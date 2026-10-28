import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/lib/auth";
import type { ChatMessageRow, ChatRoom } from "@/lib/database.types";
import { getSupabaseClient } from "@/lib/supabase";

type Msg = { id: string; from: "me" | "them"; text: string; time: number };

const ROOMS = {
  client: { name: "Hal" },
  support: { name: "Support Team" },
} as const;

export const Route = createFileRoute("/chat/$room")({
  head: ({ params }) => {
    const name = params.room === "support" ? "Support Team" : "Hal";
    return {
      meta: [
        { title: `Chat with ${name} — TopAgents` },
        { name: "description", content: `Message ${name} on TopAgents.` },
        { property: "og:title", content: `Chat with ${name} — TopAgents` },
        { property: "og:description", content: `Message ${name} on TopAgents.` },
      ],
    };
  },
  component: Chat,
});

function toMessage(row: ChatMessageRow): Msg {
  return {
    id: row.id,
    from: row.sender,
    text: row.body,
    time: Date.parse(row.created_at),
  };
}

function mergeMessages(current: Msg[], incoming: Msg[]): Msg[] {
  const messages = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) messages.set(message.id, message);
  return [...messages.values()].sort((left, right) => left.time - right.time);
}

function Chat() {
  const { room } = Route.useParams();
  const roomKey: ChatRoom = room === "support" ? "support" : "client";
  const cfg = ROOMS[roomKey];
  const navigate = useNavigate();
  const { loading: authLoading, user } = useAuth();
  const userId = user?.id ?? null;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setLoadingMessages(false);
      navigate({ to: "/", replace: true });
      return;
    }

    let active = true;
    const client = getSupabaseClient();
    setMsgs([]);
    setChatError("");
    setLoadingMessages(true);

    const channel = client
      .channel(`chat:${userId}:${roomKey}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room=eq.${roomKey}`,
        },
        (payload) => {
          const row = payload.new as ChatMessageRow;
          if (row.user_id !== userId) return;
          setMsgs((current) => mergeMessages(current, [toMessage(row)]));
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setChatError("Live updates are temporarily unavailable. Refresh to reconnect.");
        }
      });

    void client
      .from("chat_messages")
      .select("id, user_id, room, sender, body, created_at")
      .eq("room", roomKey)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setChatError("Could not load saved messages. Check your connection and retry.");
        } else {
          setMsgs((current) => mergeMessages(current, (data ?? []).map(toMessage)));
        }
        setLoadingMessages(false);
      });

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [authLoading, navigate, roomKey, userId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = async () => {
    const body = text.trim();
    if (!body || !userId || sending || body.length > 4000) return;

    setSending(true);
    setChatError("");
    try {
      const { data, error } = await getSupabaseClient()
        .from("chat_messages")
        .insert({ user_id: userId, room: roomKey, sender: "me", body })
        .select("id, user_id, room, sender, body, created_at")
        .single();

      if (error) {
        setChatError("Your message could not be saved. Please try again.");
        return;
      }

      setText("");
      setMsgs((current) => mergeMessages(current, [toMessage(data)]));
    } catch {
      setChatError("Your message could not be saved. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (authLoading || !userId) return null;

  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <main className="mx-auto flex h-screen max-w-2xl flex-col p-3">
      <header className="glass-strong flex items-center gap-3 rounded-3xl p-3">
        <Link
          to="/home"
          aria-label="Back to dashboard"
          className="flex h-10 w-10 items-center justify-center rounded-full text-xl hover:bg-glass"
        >
          ←
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-display font-bold text-primary-foreground">
          {cfg.name[0]}
        </div>
        <div>
          <p className="font-display font-semibold">{cfg.name}</p>
          <p className="text-xs text-muted-foreground">Cloud-synced messages</p>
        </div>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto px-1 py-4" aria-live="polite">
        {loadingMessages ? (
          <p className="py-3 text-center text-sm text-muted-foreground">Loading saved messages…</p>
        ) : msgs.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">
            No messages yet. Send a message to start the conversation.
          </p>
        ) : (
          msgs.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.from === "me" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[78%] rounded-2xl px-4 py-2 ${message.from === "me" ? "rounded-br-md bg-primary text-primary-foreground" : "glass rounded-bl-md"}`}
              >
                <p className="whitespace-pre-wrap break-words">{message.text}</p>
                <p className="mt-1 text-right text-[10px] opacity-60">{formatTime(message.time)}</p>
              </div>
            </div>
          ))
        )}
        {chatError && (
          <p
            className="rounded-xl bg-destructive/20 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {chatError}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={async (event) => {
          event.preventDefault();
          await send();
        }}
        className="glass-strong flex gap-2 rounded-3xl p-2"
      >
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={`Message ${cfg.name}…`}
          aria-label={`Message ${cfg.name}`}
          maxLength={4000}
          disabled={loadingMessages || sending}
          className="flex-1 bg-transparent px-3 outline-none placeholder:text-muted-foreground disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!text.trim() || loadingMessages || sending}
          className="rounded-2xl bg-primary px-5 py-2 font-semibold text-primary-foreground disabled:opacity-40"
        >
          {sending ? "Saving…" : "Send"}
        </button>
      </form>
    </main>
  );
}
