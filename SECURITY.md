# Security Policy

## Reporting a vulnerability

If you discover a security issue, please **do not open a public issue**. Instead,
email the maintainer at the address on the GitHub profile, or open a private
[security advisory](https://github.com/ashfaque-rifaye/carbon-footprint-awareness/security/advisories/new).
We aim to acknowledge reports within a few days.

## Security measures in this project

- **Secrets** are server-side only; the Gemini API key is read from a gitignored
  `.env.local` and never shipped to the browser.
- **Passwords** are hashed with Node's `scrypt` (salted, memory-hard) and compared
  in constant time — plaintext is never stored or logged.
- **Sessions** use an `httpOnly`, `SameSite=Lax`, `Secure`-in-production cookie.
- **Input** on every endpoint is validated and bounded (64 KB body limit); all SQL
  is parameterized (no string interpolation), and queries are owner-scoped.
- **Abuse protection**: the public auth endpoints are rate-limited per IP.
- **HTTP headers**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  and `Permissions-Policy` are set on every response.
- **AI output** is parsed defensively and rendered as text only — never executed
  or injected as HTML.

## Supported versions

This is a hackathon submission; the latest `main` is the only supported version.
