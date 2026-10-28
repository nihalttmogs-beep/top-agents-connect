import { createClient } from "npm:@supabase/supabase-js@2.118.0";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const replies = {
  client: [
    "Got it, thanks!",
    "I'll get back to you shortly.",
    "Noted. No tasks yet, stay tuned.",
    "Sounds good 👍",
  ],
  support: [
    "Thanks for reaching out! A team member will review this.",
    "We've noted your request.",
    "Is there anything else we can help with?",
  ],
} as const;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Required Supabase function environment is missing.");
    return json({ error: "Chat replies are temporarily unavailable." }, 500);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = authorization.slice("Bearer ".length);
  const {
    data: { user },
    error: authError,
  } = await serviceClient.auth.getUser(token);
  if (authError || !user) return json({ error: "Unauthorized." }, 401);

  let room: unknown;
  try {
    ({ room } = await request.json());
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  if (room !== "client" && room !== "support") {
    return json({ error: "Unknown chat room." }, 400);
  }

  const roomReplies = replies[room];
  const body = roomReplies[Math.floor(Math.random() * roomReplies.length)] ?? "";
  const { data: message, error: insertError } = await serviceClient
    .from("chat_messages")
    .insert({ user_id: user.id, room, sender: "them", body })
    .select("id, user_id, room, sender, body, created_at")
    .single();

  if (insertError) {
    console.error("Failed to save the demo reply:", insertError.message);
    return json({ error: "Chat replies are temporarily unavailable." }, 500);
  }

  return json({ message }, 201);
});
