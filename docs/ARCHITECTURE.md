# Brief architecture and session policy

This document is the technical source of truth for Brief's current Beta architecture. It describes the product as it is deployed today and distinguishes it from planned production work.

## High-level architecture

```text
Chrome extension ── authenticated HTTPS API ─┐
                                              │
Web dashboard ── Google sign-in / cookie ────┼── Cloudflare Worker
                                              │        │
                                              │        ├── D1: users, sessions, summaries, usage, events
                                              │        ├── R2: saved snapshot assets
                                              │        ├── Groq: summary generation
                                              │        └── Google: identity-token verification
                                              │
                                              └── Stripe (planned production billing only)
```

The Worker is both the API and the dashboard server. It renders the dashboard HTML, verifies identity, protects private routes, applies usage limits, and coordinates summary generation. The extension does not receive database credentials or model-provider secrets.

## Environments

| Environment | Purpose | Worker | Dashboard | Database | Extension |
| --- | --- | --- | --- | --- | --- |
| Development | Internal testing of unreleased changes. | `brief-dev-tag-filters` | `dev.brieflykeep.com` | `brief-dev-tag-filters-db` | `extension-demo-dev/`, loaded unpacked. |
| Public Beta | Early-user testing on the public extension. | `brief-beta` | `beta.brieflykeep.com` | `brief-beta-db` | `extension-demo-beta/`, Chrome Web Store package. |
| Production | Future paid service. | Separate production deployment before payments are enabled. | Production domain. | Separate production database. | Store package with a production release version. |

Development and Beta deliberately use separate Workers, databases, extensions, and domains. They share the same application code, but Beta has its own configuration and receives database migrations and Worker deployments separately.

## Authentication flows

### Direct dashboard sign-in

1. A visitor opens `/dashboard` without a valid Brief session.
2. The Worker renders a sign-in page and sends the visitor to Google.
3. Google returns an identity token in the browser callback.
4. Browser code posts the token to `/auth/callback`.
5. The Worker verifies the Google identity token, creates a `user_sessions` record, sets a secure cookie, and redirects to the requested dashboard page.
6. All protected dashboard/API requests verify that session on the server.

Dashboard HTML is served with `Cache-Control: no-store, max-age=0`. This is important: caching an older authentication page can break the callback script and leave the page on “Signing in…”.

### Extension sign-in

1. The extension uses Chrome's identity flow to obtain a Google identity token.
2. The extension sends it to `/api/auth/google`.
3. The Worker verifies it and returns Brief authentication data used by the extension.
4. The extension can open the dashboard with an authenticated handoff; the dashboard still establishes and validates its own browser session.

The extension and dashboard use the same user account but are separate browser contexts. A valid sign-in in one must not revoke sessions on another device.

## Session policy

Session security must balance normal use with the extra sensitivity of admin pages. The current policy is the same in Development and Public Beta.

| Session type | Inactivity timeout | Absolute lifetime | Activity refresh | Scope |
| --- | ---: | ---: | --- | --- |
| Normal user | 7 days | 30 days | At most once every 15 minutes | One browser profile/device session |
| Admin | 24 hours | 30 days | At most once every 15 minutes | One browser profile/device session |

- An inactive session is rejected even if its 30-day absolute expiry has not passed.
- Signing in on a second device does not log out the first device.
- Signing out invalidates the current session. Tabs in the same browser profile should synchronize sign-in/sign-out state.
- Session cookies are `HttpOnly`, `Secure`, and `SameSite=Lax`.
- Session data is stored in D1's `user_sessions` table, including `expires_at` and `last_seen_at`.

The 7-day normal-user timeout is intentional. A 24-hour timeout for every user would create unnecessary repeated sign-ins; 24 hours is applied to admin access because those pages expose private user and operational data.

## Summary and save flow

1. The extension submits page or selected-text capture details to the Worker.
2. The Worker authenticates the request and atomically reserves one summary credit before contacting the model provider.
3. Input size is bounded by the selected summary mode; long pages may use controlled chunking.
4. The Worker calls Groq to create a summary in the user's selected **summary language**. This is independent from the future interface-language preference.
5. The Worker returns the result. The user can copy it, share it, add a tag/note, or save it to the library.
6. If the request fails, the Worker records a safe failure category and releases the reserved credit. A release does not guarantee that the provider used no tokens; the provider may have begun processing before a failure occurred.

## Data model

The detailed D1 schema lives in `news-aggregator-worker/migrations/`. At a high level:

| Data | Why it exists |
| --- | --- |
| `users` | Account identity, role, and subscription state. |
| `user_sessions` | Per-browser session tokens, absolute expiry, and recent activity. |
| Summaries, tags, collections, notes | A user's saved library and organization. |
| `summary_usage` | Server-side quota and model-token usage by period. |
| Product events and feedback | Aggregate product learning: requests, successful/failed summaries, saves, shares, copies, and helpful/not-helpful feedback. |
| Public share links | Unlisted, controlled links to a shared saved Brief. |
| Roles, reports, pilot access | Admin/reviewer access and operational workflows. |

R2 holds saved snapshot assets. D1 holds the application records and does not rely on the extension for quota enforcement.

## Privacy and security boundaries

- Raw page content, URLs, search queries, age, gender, and location are not written to product analytics.
- Cloudflare technical request logs may process approximate IP-derived location for security, reliability, and abuse prevention. It is not used for profiling or product analytics.
- Product analytics are aggregate product events. Summary failure diagnostics retain safe categories rather than raw provider errors or saved content.
- Private dashboard and API routes require a verified Brief session or verified identity handoff.
- Roles are checked server-side. Admin and reviewer capabilities must never be hidden only in the interface; authorization is enforced by the Worker.
- Usage limits are enforced before model work begins. Client-side counters are informational only.
- Shared Brief pages are served with `noindex, nofollow, noarchive` and should be treated as unlisted links, not public search pages.
- Provider keys, database bindings, and session secrets remain in Cloudflare configuration/secrets, never in the extension package or repository.

## Change rule

Any change to sign-in, sessions, pricing, limits, analytics, stored data, or sharing must update the relevant code, migrations/configuration, customer-facing policy text, and the release checklist together. Authentication changes additionally require `npm run test:auth-page` before deployment.
