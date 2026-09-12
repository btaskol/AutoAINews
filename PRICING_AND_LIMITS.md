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
| Credit top-up | Proposed: €3 per 100 credits | 100 additional summaries | Never expires while the account is active | Available only after a paid subscriber reaches the included monthly limit. |

Prices must be configured and verified in Stripe before they are shown publicly. Confirm tax treatment, payment processing fees, and the final customer-facing wording before launch.

### How top-up credits should work

- Top-ups are **one-time purchases**, not a subscription. They add credits on top of the plan's monthly allowance.
- A Pro member must use their included 250 credits first; then the product can offer a clear “Buy 100 more summaries for €3” action.
- Purchased credits should be used **after** the monthly allowance and should not expire while the subscription remains active. Decide separately what happens when a subscriber cancels; the recommended rule is that they remain usable until the paid period ends.
- Do not launch this until the Worker has a separate, auditable `purchased_credit_balance`. A monthly quota counter alone is not enough.

## Cost and abuse guardrails

- A summary credit is reserved atomically before Brief calls the AI provider. Failed requests release the credit; successful requests do not depend on saving the item.
- Releasing a credit does **not** necessarily refund Brief's AI cost. If a network failure happens before the request reaches the model, no AI tokens are used. If the provider begins processing and its response is lost, times out, or fails afterward, input and sometimes output tokens may already be billable. Track these failures and alert when their cost is unusual.
- Source length is bounded before it reaches the model. Quick summaries allow up to 8,000 source characters; other common modes up to 18,000–24,000; the longest chunked flow is capped at 72,000 characters.
- The Worker records input and output token usage per user and billing period in D1. It should be reviewed before changing plan limits or prices.
- The current Pro cap is 250 credits per month. Do not advertise “unlimited” summaries.
- Before paid launch, set an internal alert for unusually high token use and define a token-budget fallback for a single user or period. This protects the business when long multi-call summaries cost more than normal quick summaries.

## Unit-economics review before launch

For each plan, calculate each month:

`net collected revenue − payment fees − AI token cost − Cloudflare/storage cost − support/refunds = contribution margin`

Use actual D1 token records, not only averages. Review the 90th and 99th percentile user, especially for long summaries. If those costs make the €7 Pro plan unsafe, reduce the long-summary allowance, introduce weighted credits, raise the price, or offer a higher tier before launch.

### Illustrative contribution margin — not a forecast

These figures make the decision visible; they are **not accounting advice or a guarantee of profit**. They assume Spain's 21% VAT is included in the displayed euro price, a standard EEA Stripe card fee of 1.5% + €0.25, the current Groq GPT-OSS 120B price of $0.15/M input tokens and $0.60/M output tokens, and an illustrative €0.10/month Cloudflare/storage allocation for an active user. For AI, the example assumes 6,000 input + 500 output tokens per summary, used for all 250 summaries, and converts USD at €0.8621 per USD.

| Offer / usage | Customer price incl. VAT | VAT set aside | Revenue before VAT | Stripe fee | Estimated AI cost | Hosting/storage allocation | Estimated contribution before business tax, salaries, support, refunds, and chargebacks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Pro monthly — 250 normal summaries | €7.00 | €1.21 | €5.79 | €0.36 | €0.26 | €0.10 | **€5.07/month** |
| Pro yearly — 250 normal summaries/month | €59.00/year | €10.24 | €48.76 | €1.14 | €3.10/year | €1.20/year | **€43.32/year** (about €3.61/month) |
| Proposed top-up — 100 normal summaries | €3.00 | €0.52 | €2.48 | €0.30 | €0.10 | €0.04 | **€2.04 per top-up** |

The table deliberately excludes corporation/income tax because that depends on Brief's legal entity, deductible costs, and total business profit—not on one customer alone. VAT is not Brief's revenue when it is included in the displayed price. International cards, currency conversion, Stripe Billing fees, disputes, and unusually long multi-call summaries reduce these estimates.

Before activating a price, replace each assumption with a 30-day D1 measurement: average and 95th-percentile input/output tokens, failed-model-call cost, actual Stripe fee mix, actual hosting cost, refunds, and applicable tax treatment. Set a minimum contribution-margin threshold; if a plan falls below it, tighten long-summary costs or change the price before selling it.

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
