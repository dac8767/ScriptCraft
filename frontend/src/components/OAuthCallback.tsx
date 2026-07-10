/**
 * OAuthCallback — landing page for the Save Locations OAuth popups
 * (/oauth-callback). Posts the authorization code (or error) back to the
 * opener window and closes itself.
 */
import { useEffect } from 'react';

export default function OAuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payload = {
      type: 'oauth-callback',
      code: params.get('code'),
      state: params.get('state'),
      error: params.get('error') ? `${params.get('error')}: ${params.get('error_description') || ''}` : null,
    };
    if (window.opener) {
      window.opener.postMessage(payload, window.location.origin);
      window.close();
    }
  }, []);
  return (
    <div style={{ fontFamily: 'system-ui', padding: 40, textAlign: 'center' }}>
      Completing sign-in… you can close this window.
    </div>
  );
}
