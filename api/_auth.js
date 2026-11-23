// Server-side Supabase identity verification for authenticated API requests.
// NEVER trust user_id or email submitted by the browser.
export async function getAuthenticatedUser(req) {
  const header = req.headers.authorization || '';
  const match = /^Bearer\s+([^\s]+)$/i.exec(header);
  if (!match) return null;

  const url = process.env.SUPABASE_URL;
  const apiKey = process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_KEY;
  if (!url || !apiKey) throw new Error('Supabase authentication is not configured');

  const response = await fetch(url.replace(/\/$/, '') + '/auth/v1/user', {
    headers: {
      apikey: apiKey,
      Authorization: 'Bearer ' + match[1],
    },
  });
  if (!response.ok) return null;
  const user = await response.json();
  return user && user.id ? user : null;
}
