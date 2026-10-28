import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { useAuth } from "@/lib/auth";
import type { AccountRole, ChatMessageRow, ChatRoom } from "@/lib/database.types";
import { getSupabaseClient } from "@/lib/supabase";

type Msg = { id: string; from: "me" | "them"; text: string; time: number };

const ROOMS = {
  client: { workerName: "Hal" },
  support: { workerName: "Support Team" },
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

function parseAccountRole(value: unknown): AccountRole | null {
  return value === "worker" || value === "support" || value === "client" ? value : null;
}

function toMessage(row: ChatMessageRow, viewerIsWorker: boolean): Msg {
  const isMine = viewerIsWorker ? row.sender === "me" : row.sender === "them";
  return {
    id: row.id,
    from: isMine ? "me" : "them",
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
  const navigate = useNavigate();
  const { loading: authLoading, user } = useAuth();
  const userId = user?.id ?? null;
  const accountRole = parseAccountRole(user?.app_metadata?.["role"]);
  const viewerIsWorker = accountRole === "worker";
  const chatName = viewerIsWorker ? ROOMS[roomKey].workerName : "Worker";
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [workerId, setWorkerId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      setLoadingMessages(false);
      navigate({ to: "/", replace: true });
      return;
    }
    if (!accountRole) {
      setLoadingMessages(false);
      setChatError("This account has no chat role assigned. Contact an administrator.");
      return;
    }
    if (accountRole !== "worker" && accountRole !== roomKey) {
      setLoadingMessages(false);
      navigate({ to: "/home", replace: true });
      return;
    }

    let active = true;
    let channel: RealtimeChannel | null = null;
    const client = getSupabaseClient();
    setMsgs([]);
    setChatError("");
    setWorkerId(null);
    setLoadingMessages(true);

    const loadConversation = async () => {
      try {
        const conversationQuery = client
          .from("chat_conversations")
          .select("id, worker_id, participant_id, room")
          .eq("room", roomKey);
        const { data: conversation, error: conversationError } =
          accountRole === "worker"
            ? await conversationQuery.eq("worker_id", userId).maybeSingle()
            : await conversationQuery.eq("participant_id", userId).maybeSingle();

        if (!active) return;
        if (conversationError || !conversation) {
          setChatError("This conversation is not available yet.");
          setLoadingMessages(false);
          return;
        }

        setWorkerId(conversation.worker_id);
        channel = client
          .channel(`chat:${conversation.id}:${userId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "chat_messages",
              filter: `worker_id=eq.${conversation.worker_id}`,
            },
            (payload) => {
              const row = payload.new as ChatMessageRow;
              if (row.worker_id !== conversation.worker_id || row.room !== roomKey) return;
              setMsgs((current) => mergeMessages(current, [toMessage(row, viewerIsWorker)]));
            },
          )
          .subscribe((status) => {
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              setChatError("Live updates are temporarily unavailable. Refresh to reconnect.");
            }
          });

        const { data: messages, error: messagesError } = await client
          .from("chat_messages")
          .select("id, worker_id, room, sender, body, created_at")
          .eq("worker_id", conversation.worker_id)
          .eq("room", roomKey)
          .order("created_at", { ascending: true });

        if (!active) return;
        if (messagesError) {
          setChatError("Could not load saved messages. Check your connection and retry.");
        } else {
          setMsgs((current) =>
            mergeMessages(
              current,
              (messages ?? []).map((message) => toMessage(message, viewerIsWorker)),
            ),
          );
        }
        setLoadingMessages(false);
      } catch {
        if (!active) return;
        setChatError("Could not load this conversation. Check your connection and retry.");
        setLoadingMessages(false);
      }
    };

    void loadConversation();
    return () => {
      active = false;
      if (channel) void client.removeChannel(channel);
    };
  }, [accountRole, authLoading, navigate, roomKey, userId, viewerIsWorker]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const send = async () => {
    const body = text.trim();
    if (!body || !userId || !workerId || !accountRole || sending || body.length > 4000) return;

    setSending(true);
    setChatError("");
    try {
      const { data, error } = await getSupabaseClient()
        .from("chat_messages")
        .insert({
          worker_id: workerId,
          room: roomKey,
          sender: accountRole === "worker" ? "me" : "them",
          body,
        })
        .select("id, worker_id, room, sender, body, created_at")
        .single();

      if (error) {
        setChatError("Your message could not be saved. Please try again.");
        return;
      }

      setText("");
      setMsgs((current) => mergeMessages(current, [toMessage(data, viewerIsWorker)]));
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
          {chatName[0]}
        </div>
        <div>
          <p className="font-display font-semibold">{chatName}</p>
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
          placeholder={`Message ${chatName}…`}
          aria-label={`Message ${chatName}`}
          maxLength={4000}
          disabled={!workerId || loadingMessages || sending}
          className="flex-1 bg-transparent px-3 outline-none placeholder:text-muted-foreground disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!text.trim() || !workerId || loadingMessages || sending}
          className="rounded-2xl bg-primary px-5 py-2 font-semibold text-primary-foreground disabled:opacity-40"
        >
          {sending ? "Saving…" : "Send"}
        </button>
      </form>
    </main>
  );
}
