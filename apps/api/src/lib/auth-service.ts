import { createClient } from "@supabase/supabase-js";
import type { FastifyRequest } from "fastify";

export type AuthenticatedUser = {
  id: string;
  email?: string;
};

export type AuthContext = {
  user: AuthenticatedUser;
  mode: "supabase";
};

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return { url, serviceRoleKey };
}

function bearerToken(request: FastifyRequest) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

export function isSupabaseAuthEnabled() {
  return Boolean(supabaseConfig());
}

export async function resolveAuthContext(
  request: FastifyRequest,
): Promise<AuthContext> {
  const config = supabaseConfig();

  if (!config) {
    throw new Error("Supabase API credentials are not configured.");
  }

  const token = bearerToken(request);

  if (!token) {
    throw new Error("Missing bearer token.");
  }

  const supabase = createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new Error("Invalid bearer token.");
  }

  return {
    mode: "supabase",
    user: {
      id: data.user.id,
      email: data.user.email,
    },
  };
}
