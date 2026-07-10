/**
 * oauthPkce — shared PKCE (Proof Key for Code Exchange) OAuth flow for the
 * Save Locations integrations (Google Drive, OneDrive).
 *
 * Flow: open the provider's auth URL in a popup with a code challenge; the
 * popup lands on our /oauth-callback route, which posts the code back via
 * postMessage; we exchange it for tokens directly from the browser (both
 * Google and Microsoft support CORS token exchange for public PKCE clients).
 * Tokens are cached in localStorage and refreshed when expired.
 */

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  /** epoch ms when the access token expires */
  expiresAt: number;
}

function b64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function pkcePair(): Promise<{ verifier: string; challenge: string }> {
  const raw = new Uint8Array(48);
  crypto.getRandomValues(raw);
  const verifier = b64url(raw.buffer);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(digest) };
}

export function redirectUri(): string {
  return `${window.location.origin}/oauth-callback`;
}

/** Open the auth popup and resolve with the authorization code. */
function waitForCode(authUrl: string, expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const popup = window.open(authUrl, 'oauth', 'width=520,height=680');
    if (!popup) { reject(new Error('Popup blocked — allow popups for this site and try again')); return; }
    let settled = false;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || d.type !== 'oauth-callback') return;
      settled = true;
      window.removeEventListener('message', onMessage);
      clearInterval(closedTimer);
      if (d.error) reject(new Error(String(d.error)));
      else if (d.state !== expectedState) reject(new Error('OAuth state mismatch'));
      else resolve(String(d.code));
    };
    window.addEventListener('message', onMessage);
    const closedTimer = setInterval(() => {
      if (popup.closed && !settled) {
        settled = true;
        window.removeEventListener('message', onMessage);
        clearInterval(closedTimer);
        reject(new Error('Sign-in window was closed'));
      }
    }, 500);
  });
}

export interface ProviderConfig {
  /** localStorage key for the cached token set */
  storageKey: string;
  authEndpoint: string;
  tokenEndpoint: string;
  clientId: string;
  scope: string;
  /** extra auth-URL params (e.g. Google's access_type=offline) */
  extraAuthParams?: Record<string, string>;
}

export function loadTokens(storageKey: string): TokenSet | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const t = JSON.parse(raw) as TokenSet;
    return t && t.accessToken ? t : null;
  } catch { return null; }
}

export function clearTokens(storageKey: string): void {
  try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
}

function saveTokens(storageKey: string, t: TokenSet): void {
  try { localStorage.setItem(storageKey, JSON.stringify(t)); } catch { /* ignore */ }
}

async function tokenRequest(cfg: ProviderConfig, body: Record<string, string>): Promise<TokenSet> {
  const res = await fetch(cfg.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = await res.json();
  const prev = loadTokens(cfg.storageKey);
  const tokens: TokenSet = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || prev?.refreshToken,
    expiresAt: Date.now() + Math.max(60, (json.expires_in ?? 3600) - 60) * 1000,
  };
  saveTokens(cfg.storageKey, tokens);
  return tokens;
}

/** Interactive sign-in via popup. */
export async function connect(cfg: ProviderConfig): Promise<TokenSet> {
  if (!cfg.clientId.trim()) throw new Error('No client ID configured — paste one in Settings first');
  const { verifier, challenge } = await pkcePair();
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const params = new URLSearchParams({
    client_id: cfg.clientId.trim(),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: cfg.scope,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    ...(cfg.extraAuthParams || {}),
  });
  const code = await waitForCode(`${cfg.authEndpoint}?${params.toString()}`, state);
  return tokenRequest(cfg, {
    client_id: cfg.clientId.trim(),
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  });
}

/** Returns a valid access token, refreshing silently when possible.
 *  Throws when not connected — callers surface that as a save-location error. */
export async function getAccessToken(cfg: ProviderConfig): Promise<string> {
  const t = loadTokens(cfg.storageKey);
  if (!t) throw new Error('Not connected — open Settings → Save Locations and connect');
  if (Date.now() < t.expiresAt) return t.accessToken;
  if (!t.refreshToken) throw new Error('Session expired — reconnect in Settings → Save Locations');
  const fresh = await tokenRequest(cfg, {
    client_id: cfg.clientId.trim(),
    grant_type: 'refresh_token',
    refresh_token: t.refreshToken,
  });
  return fresh.accessToken;
}
