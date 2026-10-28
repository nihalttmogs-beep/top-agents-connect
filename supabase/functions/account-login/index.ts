import { createClient } from "npm:@supabase/supabase-js@2.118.0";

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): void;
};

type AccountRole = "worker" | "support" | "client";

type Account = {
  username: string;
  role: AccountRole;
  displayName: string;
  email: string;
  bootstrapSecret: string;
};

const accounts: Record<string, Account> = {
  jannahtool: {
    username: "jannahtool",
    role: "worker",
    displayName: "Worker",
    email: "jannahtool@accounts.topagents.invalid",
    bootstrapSecret: "BOOTSTRAP_WORKER_PASSWORD",
  },
  support: {
    username: "support",
    role: "support",
    displayName: "Support",
    email: "support@accounts.topagents.invalid",
    bootstrapSecret: "BOOTSTRAP_SUPPORT_PASSWORD",
  },
  hal: {
    username: "hal",
    role: "client",
    displayName: "Hal",
    email: "hal@accounts.topagents.invalid",
    bootstrapSecret: "BOOTSTRAP_CLIENT_PASSWORD",
  },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function ensureAccounts(admin: ReturnType<typeof createClient>): Promise<string | null> {
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("username, role");
  if (profileError) {
    console.error("Could not load account profiles:", profileError.message);
    return "Account setup is temporarily unavailable.";
  }

  const { data: userData, error: userError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });
  if (userError) {
    console.error("Could not load Supabase users:", userError.message);
    return "Account setup is temporarily unavailable.";
  }

  for (const account of Object.values(accounts)) {
    const profile = profiles.find((candidate) => candidate.username === account.username);
    if (profile) {
      if (profile.role !== account.role) {
        console.error("Account role does not match its configured account:", account.username);
        return "Account setup is temporarily unavailable.";
      }
      continue;
    }

    const existingUser = userData.users.find(
      (candidate) => candidate.email?.toLowerCase() === account.email,
    );
    const bootstrapPassword = Deno.env.get(account.bootstrapSecret);
    if (!bootstrapPassword) {
      console.error("Missing bootstrap password for account:", account.username);
      return "Account setup is temporarily unavailable.";
    }

    if (existingUser) {
      const { error } = await admin.auth.admin.updateUserById(existingUser.id, {
        app_metadata: {
          ...existingUser.app_metadata,
          username: account.username,
          role: account.role,
        },
        user_metadata: {
          ...existingUser.user_metadata,
          username: account.username,
          display_name: account.displayName,
        },
      });
      if (error) {
        console.error("Could not repair account metadata:", error.message);
        return "Account setup is temporarily unavailable.";
      }
      continue;
    }

    const { error } = await admin.auth.admin.createUser({
      email: account.email,
      password: bootstrapPassword,
      email_confirm: true,
      app_metadata: { username: account.username, role: account.role },
      user_metadata: { username: account.username, display_name: account.displayName },
    });
    if (error) {
      console.error("Could not create account:", account.username, error.message);
      return "Account setup is temporarily unavailable.";
    }
  }

  return null;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  if (typeof body !== "object" || body === null) return json({ error: "Invalid request." }, 400);
  const input = body as Record<string, unknown>;
  const username = typeof input.username === "string" ? input.username.trim().toLowerCase() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const account = Object.hasOwn(accounts, username) ? accounts[username] : undefined;
  if (
    !account ||
    !/^[a-z0-9_]{3,32}$/.test(username) ||
    password.length === 0 ||
    password.length > 256
  ) {
    return json({ error: "Invalid username or password." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const publishableKey = request.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !serviceRoleKey || !publishableKey) {
    console.error("Required account-login environment is missing.");
    return json({ error: "Sign-in is temporarily unavailable." }, 500);
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
    email: account.email,
    password,
  });
  if (!signInError && signInData.session) {
    if (
      signInData.session.user.app_metadata.username !== account.username ||
      signInData.session.user.app_metadata.role !== account.role
    ) {
      console.error("Authenticated account metadata does not match the configured username.");
      return json({ error: "Invalid username or password." }, 401);
    }
    return json({ session: signInData.session }, 200);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("username, role")
    .eq("username", account.username)
    .maybeSingle();
  if (profileError) {
    console.error("Could not check account profile:", profileError.message);
    return json({ error: "Sign-in is temporarily unavailable." }, 500);
  }
  if (profile) return json({ error: "Invalid username or password." }, 401);

  const initialPassword = Deno.env.get(account.bootstrapSecret);
  if (!initialPassword || !safeEqual(password, initialPassword)) {
    return json({ error: "Invalid username or password." }, 401);
  }

  const setupError = await ensureAccounts(admin);
  if (setupError) return json({ error: setupError }, 500);

  const { data, error } = await authClient.auth.signInWithPassword({
    email: account.email,
    password,
  });
  if (
    error ||
    !data.session ||
    data.session.user.app_metadata.username !== account.username ||
    data.session.user.app_metadata.role !== account.role
  ) {
    return json({ error: "Invalid username or password." }, 401);
  }

  return json({ session: data.session }, 200);
});
