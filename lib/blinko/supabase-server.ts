type RpcOptions = {
  signal?: AbortSignal;
};

function getSupabaseServerConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error("supabase_not_configured");
  }

  return { url, secretKey };
}

/**
 * Uso exclusivo do servidor.
 * Nunca importar este módulo em Client Components.
 */
export async function supabaseRpc<T>(
  functionName: string,
  body: Record<string, unknown>,
  options: RpcOptions = {},
): Promise<T> {
  const { url, secretKey } = getSupabaseServerConfig();

  const response = await fetch(`${url}/rest/v1/rpc/${encodeURIComponent(functionName)}`, {
    method: "POST",
    headers: {
      apikey: secretKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: options.signal,
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 1000);
    throw new Error(`supabase_rpc_failed:${response.status}:${detail}`);
  }

  const text = await response.text();
  if (!text) return undefined as T;

  return JSON.parse(text) as T;
}

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}
