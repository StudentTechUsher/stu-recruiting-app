export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
}

export function getAuthAppUrl() {
  const fromServer = process.env.APP_URL;
  if (fromServer && fromServer.length > 0) return fromServer;

  const fromPublic = process.env.NEXT_PUBLIC_APP_URL;
  if (fromPublic && fromPublic.length > 0) return fromPublic;

  return null;
}
