# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, use GitHub's private vulnerability reporting: go to the repository's
**Security** tab → **Report a vulnerability**, or open
<https://github.com/Cougny/cougny/security/advisories/new> directly. Your
report stays private while it's triaged and fixed.

Include what you can: affected component (web, api, signaling, coturn config),
reproduction steps, and impact. You'll get a response as quickly as possible,
and credit in the advisory if you'd like it.

## Scope

Especially interesting areas, given what Cougny does:

- Session token forgery or cross-session access (`AUTH_JWT_SECRET` handling)
- TURN credential leakage or secret exposure
- Signaling abuse: joining rooms you weren't matched into, spoofing peers
- Report-system abuse (reporting sessions you never talked to)
- Rate-limit or origin-allowlist bypasses

Product-level _safety_ mechanisms (moderation, reporting flow, abuse
mitigation) are documented in
[docs/security-and-moderation.md](./docs/security-and-moderation.md) — design
feedback on those is welcome as regular issues, as long as no exploitable
vulnerability is involved.

## Supported versions

Only the latest code on `main` is supported. There are no maintained release
branches yet.
