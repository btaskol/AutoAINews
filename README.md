# Brief

Brief is a Chrome extension and web dashboard for saving useful web content, getting grounded AI summaries in a selected language, and finding or sharing the result later.

## Product documentation

- [Architecture and session policy](docs/ARCHITECTURE.md)
- [Release and operations guide](docs/RELEASE_AND_OPERATIONS.md)
- [Prepared 1.0.11 release notes](docs/RELEASE_NOTES_1.0.11.md)
- [Early-user roadmap](docs/EARLY_USER_ROADMAP.md)
- [Pricing, limits, costs, and estimated contribution margin](PRICING_AND_LIMITS.md)
- [Product backlog](PRODUCT_BACKLOG.md)

## Current public beta

- Beta dashboard: `https://beta.brieflykeep.com`
- Early-access offer: 25 summaries per calendar month at no cost.
- Payments are deliberately disabled in Beta. The proposed production plans are documented in `PRICING_AND_LIMITS.md` and must not be shown as live until Stripe, tax, webhooks, and end-to-end payment tests are ready.
- The prepared Chrome Web Store package is Brief 1.0.10. Package upload and store publication are separate from deploying the Worker.

## Repository layout

| Path | Purpose |
| --- | --- |
| `extension-demo-beta/` | Chrome Web Store extension source. |
| `extension-demo-dev/` | Development-only extension source, loaded unpacked. |
| `news-aggregator-worker/src/index.js` | Cloudflare Worker: API, sign-in, dashboard, quota enforcement, and server-rendered pages. |
| `news-aggregator-worker/migrations/` | D1 schema migrations. |
| `news-aggregator-worker/wrangler.dev.json` | Development Worker configuration. |
| `news-aggregator-worker/wrangler.beta.json` | Public Beta Worker configuration. |
| `docs/` | Architecture, release, and operating documentation. |

## Required authentication safety check

The dashboard's direct Google sign-in page includes generated browser JavaScript. Before deploying authentication-page changes, run:

```bash
cd news-aggregator-worker
npm run test:auth-page
```

This verifies that the generated scripts parse, preventing the dashboard from becoming stuck on “Signing in…”. Follow the complete release checklist in [docs/RELEASE_AND_OPERATIONS.md](docs/RELEASE_AND_OPERATIONS.md).

## License

MIT
