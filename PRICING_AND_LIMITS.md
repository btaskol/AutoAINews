# Brief pricing and usage limits

**Status:** proposed production plan. This is not live while `PAYMENTS_ENABLED` is `false` in Beta.

This document is the product source of truth for what customers are offered. Stripe is the source of truth for the active price IDs, tax configuration, invoices, and subscription status. The Worker is the source of truth for enforcing usage.

## Current Beta offer

| Plan | Price | Included summaries | Period |
| --- | --- | --- | --- |
| Early-access Beta | Free | 25 | Calendar month |

Beta users can save, delete, search, and share without affecting their summary allowance. Each successful request to generate a summary counts, even if the user later closes the panel or does not save it.

## Proposed production offer — confirm before enabling payments

| Plan | Price | Included summaries | Period | Notes |
| --- | --- | --- | --- | --- |
| Free | €0 | 10 | Calendar month | No payment method required. |
| Pro monthly | €7/month | 250 | Calendar month | Monthly subscription. |
| Pro yearly | €59/year | 250 per month | Calendar month | €25 less than paying monthly for twelve months. |

Prices must be configured and verified in Stripe before they are shown publicly. Confirm tax treatment, payment processing fees, and the final customer-facing wording before launch.

## Cost and abuse guardrails

- A summary credit is reserved atomically before Brief calls the AI provider. Failed requests release the credit; successful requests do not depend on saving the item.
- Source length is bounded before it reaches the model. Quick summaries allow up to 8,000 source characters; other common modes up to 18,000–24,000; the longest chunked flow is capped at 72,000 characters.
- The Worker records input and output token usage per user and billing period in D1. It should be reviewed before changing plan limits or prices.
- The current Pro cap is 250 credits per month. Do not advertise “unlimited” summaries.
- Before paid launch, set an internal alert for unusually high token use and define a token-budget fallback for a single user or period. This protects the business when long multi-call summaries cost more than normal quick summaries.

## Unit-economics review before launch

For each plan, calculate each month:

`net collected revenue − payment fees − AI token cost − Cloudflare/storage cost − support/refunds = contribution margin`

Use actual D1 token records, not only averages. Review the 90th and 99th percentile user, especially for long summaries. If those costs make the €7 Pro plan unsafe, reduce the long-summary allowance, introduce weighted credits, raise the price, or offer a higher tier before launch.

## Where each part is maintained

| Concern | Source |
| --- | --- |
| Customer offer and guardrails | This file: `PRICING_AND_LIMITS.md` |
| Beta free limit | `news-aggregator-worker/wrangler.beta.json` |
| Free and Pro quota enforcement | `news-aggregator-worker/src/index.js` (`freeSummaryLimit`, `summaryLimitFor`, and `reserveSummaryQuota`) |
| Token-usage records | `news-aggregator-worker/migrations/0003_usage_quotas.sql` and the `summary_usage` D1 table |
| Live prices, taxes, payment methods, and subscriptions | Stripe Dashboard and Stripe webhook configuration |

## Change rule

Any change to price, included credits, reset period, source-size cap, or model must update this file, the Worker configuration/code, the Stripe product, and customer-facing pages together.
