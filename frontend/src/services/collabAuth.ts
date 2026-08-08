import { getApiBase } from '../config';
import { useSettingsStore } from '../stores/settingsStore';
import type { CollabAuth, CollabUser } from '../stores/settingsStore';
import { platformFetch } from './platform';
import { authedFetch } from './authedFetch';
import { getDeviceInfo, getDeviceId } from './deviceId';

// ── HTTP helpers ──

/** Convert `TypeError: Failed to fetch` (network / CORS) into an actionable
 *  message. Browsers give the same opaque error regardless of the root cause;
 *  a generic "cannot reach server" is more useful than "Failed to fetch". */
function wrapNetworkError(err: unknown, where: string): Error {
  if (err instanceof TypeError) {
    return new Error(`Cannot reach ${where}. Check that the server is running and reachable.`);
  }
  return err instanceof Error ? err : new Error(String(err));
}

async function parseError(res: Response, fallbackLabel: string): Promise<Error> {
  try {
    const body = await res.json();
    const msg = body?.error || body?.detail?.error || body?.detail?.message
      || body?.detail || body?.message;
    if (typeof msg === 'string') return new Error(msg);
    return new Error(`${fallbackLabel} error ${res.status}`);
  } catch {
    return new Error(`${fallbackLabel} error ${res.status}`);
  }
}

/**
 * Auth HTTP — routes through the Python backend at /api/auth/*, which proxies
 * to the collab server. The frontend only needs to reach its own backend;
 * network/CORS issues with the collab host are surfaced as a clean 502 by the
 * backend rather than a raw browser "Failed to fetch".
 */
async function backendAuthRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getApiBase();
  if (!base) {
    throw new Error('ScriptCraft Cloud is not configured for this app. Open Settings → System Settings to set the ScriptCraft server URL.');
  }
  const url = `${base}/auth${path}`;
  let res: Response;
  try {
    // platformFetch tunnels through Tauri's http_fetch invoke when running
    // inside a WebView, sidestepping the WKWebView/Android-WebView mixed-
    // content block on plain HTTP backends.
    res = await platformFetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': getDeviceId(),
        ...options?.headers,
      },
    });
  } catch (err) {
    throw wrapNetworkError(err, 'the ScriptCraft backend');
  }
  if (!res.ok) throw await parseError(res, 'Auth');
  return res.json();
}

async function backendAuthRequestRaw(path: string, options?: RequestInit): Promise<Response> {
  const base = getApiBase();
  if (!base) {
    throw new Error('ScriptCraft Cloud is not configured for this app. Open Settings → System Settings to set the ScriptCraft server URL.');
  }
  const url = `${base}/auth${path}`;
  try {
    return await platformFetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': getDeviceId(),
        ...options?.headers,
      },
    });
  } catch (err) {
    throw wrapNetworkError(err, 'the ScriptCraft backend');
  }
}

/** Same as backendAuthRequest but attaches the bearer token and refreshes on 401. */
async function backendAuthedRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getApiBase();
  if (!base) {
    throw new Error('ScriptCraft Cloud is not configured for this app. Open Settings → System Settings to set the ScriptCraft server URL.');
  }
  const url = `${base}/auth${path}`;
  let res: Response;
  try {
    res = await authedFetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': getDeviceId(),
        ...options?.headers,
      },
    });
  } catch (err) {
    throw wrapNetworkError(err, 'the ScriptCraft backend');
  }
  if (!res.ok) throw await parseError(res, 'Auth');
  return res.json();
}

// ── API types ──

export interface AuthResponse {
  user: CollabUser;
  accessToken: string;
  refreshToken: string;
}

/** Returned by /login when 2FA is on and the device is new — instead of
 *  tokens, the server gives us a challengeId and emails the user a code. */
export interface DeviceChallengeResponse {
  deviceVerificationRequired: true;
  challengeId: string;
  message?: string;
}

export type LoginResponse = AuthResponse | DeviceChallengeResponse;

export function isDeviceChallenge(r: LoginResponse): r is DeviceChallengeResponse {
  return (r as DeviceChallengeResponse).deviceVerificationRequired === true;
}

export interface CollabServerConfig {
  googleEnabled: boolean;
  emailVerificationRequired: boolean;
  /** Whether outbound SMTP is configured. When false, 2FA cannot be enabled. */
  smtpConfigured?: boolean;
}

export interface DeviceRecord {
  deviceId: string;
  deviceName: string;
  platform: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  trusted: boolean;
  firstSeenAt: string;
  lastSeenAt: string;
  current: boolean;
}

// ── API methods ──

export const collabAuthApi = {
  register: (email: string, password: string, displayName: string) =>
    backendAuthRequest<AuthResponse>('/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName, device: getDeviceInfo() }),
    }),

  login: (email: string, password: string) =>
    backendAuthRequest<LoginResponse>('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, device: getDeviceInfo() }),
    }),

  /** Confirm a new-device 2FA challenge with the emailed 6-digit code. */
  verifyDevice: (challengeId: string, code: string) =>
    backendAuthRequest<AuthResponse>('/verify-device', {
      method: 'POST',
      body: JSON.stringify({ challengeId, code }),
    }),

  /** Ask the server to send a fresh new-device verification code. Returns the
   *  new challengeId — old codes are invalidated server-side. */
  resendDeviceChallenge: (challengeId: string) =>
    backendAuthRequest<{ challengeId: string; message?: string }>('/resend-device-challenge', {
      method: 'POST',
      body: JSON.stringify({ challengeId }),
    }),

  refresh: (refreshToken: string) =>
    backendAuthRequest<{ accessToken: string; refreshToken: string }>('/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  logout: (refreshToken: string) =>
    backendAuthRequest<{ message: string }>('/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }),

  verifyEmail: (code: string) =>
    backendAuthedRequest<{ message: string }>('/verify-email', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  /** Unauthenticated magic-link verification: used by the /verify route and
   * by the OTP dialog when the user has no session token yet. Returns a fresh
   * token pair so the frontend can log the user in on link-click. */
  verifyEmailLink: (email: string, code: string) =>
    backendAuthRequest<AuthResponse>('/verify-email-link', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),

  resendVerification: () =>
    backendAuthedRequest<{ message: string }>('/resend-verification', {
      method: 'POST',
    }),

  loginWithGoogle: (idToken: string) =>
    backendAuthRequest<AuthResponse>('/google', {
      method: 'POST',
      body: JSON.stringify({ idToken, device: getDeviceInfo() }),
    }),

  /** Change the password for the authenticated user. Server also revokes
   *  every refresh token, so the client must re-login afterwards. */
  changePassword: (currentPassword: string, newPassword: string) =>
    backendAuthedRequest<{ message: string }>('/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  /** Request a password-reset email. The server replies with a generic
   *  "if an account exists, an email was sent" message regardless of whether
   *  the address is registered — do not surface differently in the UI. */
  forgotPassword: (email: string) =>
    backendAuthRequest<{ message: string }>('/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  /** Consume a reset token from the emailed link and set a new password.
   *  All refresh tokens are revoked server-side, so other devices will need
   *  to sign in again. */
  resetPassword: (token: string, newPassword: string) =>
    backendAuthRequest<{ message: string }>('/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),

  setTwoFactorEnabled: (enabled: boolean) =>
    backendAuthedRequest<{ user: CollabUser }>('/two-factor', {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),

  listDevices: () =>
    backendAuthedRequest<{ devices: DeviceRecord[] }>('/devices')
      .then((r) => r.devices),

  revokeDevice: (deviceId: string) =>
    backendAuthedRequest<{ message: string }>(
      `/devices/${encodeURIComponent(deviceId)}`,
      { method: 'DELETE' },
    ),

  /** Permanently delete the authenticated user's account (Apple Guideline 5.1.1(v)).
   *  For password accounts, supply the current password; for Google-only
   *  accounts, supply confirmation: 'DELETE'. After this returns 200 the
   *  caller MUST clear local auth state — the access token still references
   *  a user that no longer exists. */
  deleteAccount: async (opts: { password?: string; confirmation?: string }) => {
    const res = await backendAuthRequestRaw('/account', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${useSettingsStore.getState().collabAuth.accessToken ?? ''}` },
      body: JSON.stringify(opts),
    });
    if (!res.ok) throw await parseError(res, 'Auth');
    return res.json() as Promise<{ message: string }>;
  },

  getMe: () =>
    backendAuthedRequest<CollabUser>('/me'),

  getServerConfig: () =>
    backendAuthRequest<CollabServerConfig>('/config'),
};

// ── Helper: handle auth response and store tokens ──

export function handleAuthResponse(response: AuthResponse): CollabAuth {
  const auth: CollabAuth = {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    user: response.user,
  };
  console.log('[collabAuth] Authenticated as', auth.user?.displayName);
  useSettingsStore.getState().setCollabAuth(auth);
  return auth;
}

/**
 * Callback set by ScreenplayEditor to flush pending saves for a cloud file
 * and close the editor back to a blank document. Called by performLogout
 * *before* the access token is revoked so the final save still authenticates.
 * Without this, the editor's auto-save loop keeps firing after signout and
 * every PUT returns 401.
 */
let _onLogoutEditorReset: (() => Promise<void>) | null = null;

export function setLogoutEditorReset(fn: (() => Promise<void>) | null): void {
  _onLogoutEditorReset = fn;
}

export async function performLogout(): Promise<void> {
  const { collabAuth, clearCollabAuth } = useSettingsStore.getState();

  // 1. Flush any pending cloud save and reset the editor to a blank file.
  //    Runs while the access token is still valid.
  if (_onLogoutEditorReset) {
    try { await _onLogoutEditorReset(); } catch { /* best-effort */ }
  }

  // 2. Revoke the refresh token on the server
  if (collabAuth.refreshToken) {
    try { await collabAuthApi.logout(collabAuth.refreshToken); } catch { /* best-effort */ }
  }

  // 3. Clear local auth state
  clearCollabAuth();
}
