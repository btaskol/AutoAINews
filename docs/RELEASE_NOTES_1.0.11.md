# Brief 1.0.11 — prepared release notes

**Status:** prepared for a future Chrome Web Store submission; **do not upload yet**.

**Current public version:** 1.0.10.

This document describes the changes in the prepared 1.0.11 package relative to the public 1.0.10 extension. It is intentionally a small quality-and-learning release, not a change to pricing, permissions, account access, or saved-library behavior.

## Why the release is being held

Brief 1.0.10 is approved and public, and its core Beta summary flow is working. The only material new user-facing feature in 1.0.11 is sampled summary feedback. The team should first gather initial adoption and support signals from 1.0.10, then decide whether to release the sampling prompt and with what cadence.

Keeping 1.0.11 prepared but unpublished avoids introducing a new prompt while the priority is acquiring and activating early users.

## User-facing changes

### Sampled summary-quality question

After a successful generated summary, Brief can show:

> Was this summary helpful? Yes / No

The prompt does **not** require the summary to be saved to the library. A successful generation counts even when the user closes the panel without saving.

The prepared implementation currently follows this local browser schedule:

1. Do not show on the first or second successful summary.
2. Show on the third successful summary.
3. After it has shown, wait until ten additional successful summaries have been made.
4. Never show more often than once every 14 days.

The schedule is stored in Chrome extension storage for that browser profile. It survives normal sign-out/sign-in, but it is not shared across browsers or devices and is cleared if the extension itself is removed. This is a deliberately lightweight Beta implementation; before broad public rollout, consider moving the cadence to the signed-in account and adopting a less frequent policy (for example, 90 days after an answer and 30 days after a dismissal).

Choosing **Yes** or **No** records optional product feedback. Choosing **No** offers an optional short comment. This uses the existing feedback endpoint and does not send the source page text or title as part of the feedback record.

### Clearer recovery from stalled requests

The extension now has a visible request timeout. A summary panel will no longer remain indefinitely on “Generating summary…”. If the background response is lost or the request takes too long, the panel tells the user to close it and try again.

The matching Worker source limits each Groq model attempt to 25 seconds and returns a safe retry message when the provider takes too long. The extension waits up to 65 seconds for the complete request, allowing a second model attempt while still preventing a permanent loading state.

### Sign-out preserves feedback scheduling

Signing out now removes only authentication state. It retains harmless local preferences, including summary-language settings and the feedback-sampling schedule. This prevents a user from being asked repeatedly simply because they signed out.

## Technical corrections included

The feedback prompt is rendered in a script Chrome injects into the active page. Chrome serializes that script and does not carry variables from the extension’s background worker into it. Version 1.0.11 keeps the prompt helper and its timing values inside the injected script, so the summary request is actually sent and a hidden JavaScript reference error cannot leave the panel on “Generating summary…”.

## What does not change

- No new Chrome permissions or host permissions.
- No changes to Google sign-in scope or account access.
- No pricing, quota, or payment change.
- No new D1 migration is required for 1.0.11.
- No saved summary is created unless the user explicitly chooses **Save to library**.
- No changes to the published Privacy Policy are required: optional helpful/not-helpful feedback and safe product events are already disclosed.

## Release prerequisites when we decide to publish

1. Test the unpacked `extension-demo-dev/` build with three successful summaries. Confirm the prompt appears on the third success and that signing out does not reset its schedule.
2. Run the automated checks:

   ```bash
   cd news-aggregator-worker
   npm run test:auth-page
   npm run test:feedback-schedule
   ```

3. Deploy the matching Beta Worker source before Store submission, preserving configured secrets:

   ```bash
   npx wrangler deploy --config wrangler.beta.json --keep-vars
   ```

4. Confirm normal capture, saving, direct dashboard sign-in, extension sign-in, sign-out, and one intentionally slow/failed summary on `beta.brieflykeep.com`.
5. Upload the validated 1.0.11 zip, whose `manifest.json` is at the archive root, then test the Store version in a clean Chrome profile.

## Prepared artifact

The validated package is maintained outside the repository in the Codex output directory:

`brief-beta-1.0.11-ready.zip`

Its `manifest.json` version is `1.0.11`; archive integrity and JavaScript parsing tests passed when the artifact was prepared.

## Decision record

**Decision on 13 September 2026:** keep 1.0.11 prepared but unpublished while Brief focuses on acquiring early users with the stable public 1.0.10 release. Revisit this release after initial user feedback and usage patterns are available.
