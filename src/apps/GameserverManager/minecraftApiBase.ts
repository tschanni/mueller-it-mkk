export function minecraftApiBase(): string | null {
  const local = process.env.NODE_ENV === 'development' && window.location.hostname === 'localhost';
  const authBase = process.env.REACT_APP_AUTH_API_BASE_URL || (local ? 'http://localhost:3001/api/v1/auth' : 'https://api.mueller-it-mkk.de/games/api/v1/auth');
  const match = /^(https?:\/\/[^?#]+)\/api\/v1\/auth\/?$/.exec(authBase);
  if (!match) return null;
  const url = new URL(match[1]);
  if (url.username || url.password || (url.protocol !== 'https:' && !(local && url.hostname === 'localhost'))) return null;
  return match[1];
}
