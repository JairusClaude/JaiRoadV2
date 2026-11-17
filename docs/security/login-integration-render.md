# JaiROADS login and account recovery — Render deployment

This integration uses the existing Laravel Fortify password, MFA, WebAuthn and reset-token routes. It does not add new authentication tables or change the canonical identity resolver.

## Required deployment configuration

Set these values in the Render service's Environment settings (never commit credentials):

- APP_URL: exact public HTTPS origin, e.g. https://jairoads-dd-review-20261114.onrender.com, without path or trailing slash. When APP_URL is unset the Render-provided RENDER_EXTERNAL_URL is used. An explicitly configured APP_URL takes priority.
- APP_KEY: retain the current stable application key. Do not regenerate it on deploy.
- PASSKEYS_USER_HANDLE_SECRET: if already configured, retain its value. Otherwise the application key is the existing default. Changing the hostname or user-handle secret can invalidate previously enrolled passkeys.
- SESSION_DRIVER: database, with existing session tables and authorized runtime permissions; SESSION_SECURE_COOKIE=true on HTTPS. Remember-me requires the public.users remember_token column and write permission. Do not store passwords in localStorage.
- MAIL_MAILER: smtp or an installed, configured delivery transport. The default log transport is for local development only and is rejected for production reset requests.
- MAIL_HOST, MAIL_PORT, MAIL_SCHEME, MAIL_USERNAME, MAIL_PASSWORD: actual SMTP provider settings if using SMTP. Use the provider's verified sender as MAIL_FROM_ADDRESS and JaiROADS as MAIL_FROM_NAME. The provider must permit outbound delivery from the Render plan; if SMTP is blocked, install/configure an HTTPS mail transport supported by Laravel rather than exposing reset links in logs.
- APP_ENV=production, APP_DEBUG=false.

No mail credentials or production environment access are included in the repository. Confirm delivery to a real mailbox after configuring your provider.

## User flow

1. The slideshow cycles every ten seconds, including when the pointer is over it. Manual controls and reduced-motion opt-out remain. The original external photos are used when available; distinct local illustrations appear if they fail or have not loaded.
2. Keep me signed in is submitted explicitly to Fortify. It applies to password login; the existing remember cookie is revoked on logout/password reset or denied when the canonical account becomes ineligible.
3. For passkeys, sign in with a password, go to Settings → Manage passkeys, confirm your password, and register a supported device. Sign out and use Sign in with a passkey on the same origin. No passkey is registered from an anonymous session; a browser/device must support WebAuthn.
4. Forgot password sends a token link using the configured mail transport. The reset page consumes that token through Fortify, updates both linked password hashes using the existing transaction and rotates remember tokens. Tokens expire after 60 minutes. Existing passkeys and MFA remain enrolled.

## Acceptance checks (disposable or specifically authorized test account)

- On login, wait for all three slides, exercise pause/resume, and block Unsplash to verify distinct fallback artwork.
- Use password sign-in with remember unchecked and checked; verify only checked issues a remember cookie. Remove the session cookie, confirm eligible remember restores the session, then log out and confirm the cookie is cleared.
- Enroll a passkey, sign out, authenticate through the login button, and verify an invalid/revoked account cannot authenticate.
- Request a reset email, follow the emailed link, set a compliant new password, verify the previous password and reused token are rejected. Verify a mail failure displays an error without exposing the reset token.
