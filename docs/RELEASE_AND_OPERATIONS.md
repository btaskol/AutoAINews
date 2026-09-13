# Brief release and operations guide

This guide protects the two deployed environments, especially the direct-dashboard Google sign-in flow. Follow it for every release that changes the Worker, schema, extension, authentication, privacy language, pricing, or limits.

## Release principles

1. Test in Development first; do not use Public Beta as a debugging environment.
2. Apply D1 migrations before deploying Worker code that reads the new schema.
3. Keep Development and Beta deployments separate. A successful Development deploy does not update Beta.
4. Do not publish a Chrome Web Store package until its matching Beta Worker and legal text are ready.
5. Keep secret values out of Git and terminal screenshots. Use Cloudflare secrets and `--keep-vars` during deployments.

## Authentication regression check

Before any Worker deployment that could affect sign-in, run:

```bash
cd news-aggregator-worker
npm run test:auth-page
```

This validates the generated scripts embedded in the direct browser sign-in page. It is required because a JavaScript syntax error in that page prevents the callback from completing and leaves the user on “Signing in…”.

After deployment, test each of these in a private/incognito window:

1. Open the dashboard directly and sign in with Google.
2. Confirm the dashboard loads and the address bar does not remain on a long callback fragment.
3. Open a second dashboard tab and confirm existing sessions do not cause an endless sign-in state.
4. Sign out in one tab and confirm another tab in the same browser profile updates.
5. Confirm an extension sign-in can open the dashboard.

If the dashboard is stuck, open browser DevTools Console first. A JavaScript error on the dashboard callback is a release-blocking issue. Do not keep retrying logins until that error is understood.

## Development deployment

From the repository root:

```bash
cd news-aggregator-worker
npm run test:auth-page
npx wrangler d1 migrations apply brief-dev-tag-filters-db --remote --config wrangler.dev.json
npx wrangler deploy --config wrangler.dev.json --keep-vars
```

Only apply migrations when there are unapplied migrations. Wrangler will show the exact migration list and ask for confirmation.

## Public Beta deployment

After Development has passed the manual checks:

```bash
cd news-aggregator-worker
npm run test:auth-page
npx wrangler d1 migrations apply brief-beta-db --remote --config wrangler.beta.json
npx wrangler deploy --config wrangler.beta.json --keep-vars
```

Then repeat the same browser checks against `https://beta.brieflykeep.com`.

`--keep-vars` is important: it preserves the already configured Cloudflare secrets and variables while code is deployed.

## Wrangler login recovery

If Wrangler reports an invalid/unauthorized access token, re-authenticate before deploying:

```bash
unset CLOUDFLARE_API_TOKEN
unset CF_API_TOKEN
npx wrangler logout
npx wrangler login
npx wrangler whoami
```

Confirm that `whoami` displays the expected Cloudflare account before running migrations or a deploy. Do not share access tokens in chat, Git, or screenshots.

## Chrome Web Store package release

The Worker deployment and Chrome Web Store upload are separate releases.

1. Verify the Beta Worker and `beta.brieflykeep.com` after deployment.
2. Build/use the reviewed zip whose `manifest.json` is at the zip root and whose version is higher than the currently published store version.
3. Upload the zip in the Chrome Web Store Developer Dashboard, review the package/version, and submit/publish it.
4. Install the Store version in a clean Chrome profile and repeat the capture, save, feedback, direct-dashboard sign-in, and sign-out tests.
5. Record the published extension version and Worker deployment version in the release notes or commit message.

For the current release, the prepared package is Brief 1.0.10. It should be uploaded only after Beta's Worker behavior is verified.

## Privacy and data review before a Store submission

Before submitting an extension update, verify that the public Privacy Policy accurately says:

- Google identity is used for sign-in;
- selected/page content is sent only to provide the requested summary and save feature;
- Brief stores saved library data a user chooses to save;
- aggregate product events and safe failure categories may be used to improve reliability;
- Brief does not add raw saved content, URLs, search queries, age, gender, or location to product analytics;
- Cloudflare technical request logs may process approximate IP-derived location for security, reliability, and abuse prevention, but Brief does not use it for profiling or product analytics;
- users can find support and account-deletion information.

If the code, analytics, collected data, or permissions change, update the privacy disclosure, the Worker legal page, and the Chrome Web Store privacy form in the same release.

## Pricing and limits operations

The authoritative plan and unit-economics assumptions are in `PRICING_AND_LIMITS.md`.

- Current Beta: free, 25 successful summaries per calendar month; `PAYMENTS_ENABLED=false`.
- Proposed production: Free 10/month; Pro monthly €7 for 250/month; Pro yearly €59 for 250/month; proposed €3 top-up for 100 paid-subscriber credits.
- Do not enable payments until Stripe products, tax treatment, payment fees, webhook handling, cancellation behavior, and real end-to-end tests have been reviewed.
- Before paid launch, review a 30-day D1 token-usage sample, including high-usage users and failed model calls, then update the contribution-margin table with actual measurements.

## Incident response

### Direct dashboard sign-in fails

1. Stop any planned Beta/Store release.
2. Check browser Console for a dashboard script error.
3. Confirm the deployed source includes the authentication-page test and `Cache-Control: no-store` for HTML.
4. Run `npm run test:auth-page` locally.
5. Fix in Development, deploy Development, validate in an incognito window, then promote to Beta.

### Summary failures rise

1. Review the safe failure categories in the admin analytics page and Cloudflare logs.
2. Check provider status, Worker deployment version, and quota/token patterns.
3. Do not expose raw provider errors or saved content in analytics/logs.
4. If a provider issue may consume credits incorrectly, pause promotion and verify the reserve/release behavior before changing limits.

### Session/security concern

1. Confirm whether it affects a normal user or an admin session.
2. Check the D1 session expiry and `last_seen_at` behavior without exposing tokens.
3. Invalidate the affected session(s) if necessary, and test login/logout in multiple tabs and devices.
4. Update `docs/ARCHITECTURE.md` if the session policy changes.
