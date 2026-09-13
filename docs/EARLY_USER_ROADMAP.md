# Brief early-user roadmap

**Purpose:** turn the public 1.0.10 release into evidence about who finds Brief useful, why they return, and what single improvement should be made next.

This is not a plan to chase downloads. In the first quarter, success means finding a small group of people who repeatedly use Brief for a real reading problem and tell us exactly where it helps or fails.

## Product position for outreach

Brief is currently best for people who use **Chrome on a computer** to read articles, news, research, work material, or learning content. It summarizes a page or selected text in the chosen language, lets people save useful results to a personal library, and can share a saved item.

Do not present it as a mobile-first product yet. Be clear that mobile Share Sheet capture is a future direction, not a current promise.

## North-star learning question

> Which type of desktop reader uses Brief at least weekly because it makes a repeated reading/saving task meaningfully easier?

The first candidate groups are:

1. People who follow news in multiple languages.
2. Students and researchers reading long articles or sources.
3. Knowledge workers saving useful work reading.

Start with people you can speak to directly. Do not try to serve all three groups at once; compare their feedback and choose the strongest signal.

## Stage 1 — first 10 invited testers (next 7–14 days)

### Goal

Invite 10 people who use Chrome on a computer. Aim for 7 installs, 5 people who complete the core task, and 5 honest feedback conversations. A core task is:

1. install the extension;
2. summarize at least one article;
3. save one useful result to the dashboard.

### How to recruit

- Send a personal message, not a mass broadcast.
- Include the Chrome Web Store link and the short test checklist.
- Ask for a 10-minute trial, not an open-ended favour.
- Follow up once after 24–48 hours; do not chase someone repeatedly.
- Prefer people who regularly read on a laptop for work, study, or news.

### What to ask after they try it

Ask these questions in a short chat or voice note:

1. What did you try to summarize, and why?
2. Was it clear how to open Brief and get a summary?
3. Was the result useful enough to save or share? Why or why not?
4. What felt slow, confusing, or missing?
5. Would you use it again next week? For what?

Record answers faithfully. Do not explain away criticism or try to sell the product during the feedback conversation.

### Stage-1 exit criteria

Move forward when at least five people have completed the core task and you can name the three most repeated themes. If fewer than five complete it, focus first on install/onboarding friction rather than adding features.

## Stage 2 — first month

### Goals

| Area | Target | Why it matters |
| --- | ---: | --- |
| People personally invited | 25 | Enough conversations to see patterns beyond one friend group. |
| Core-task completions | 12 | Tests activation, not passive installs. |
| Week-two returners | 5 | First evidence that Brief solves a repeated problem. |
| Direct feedback conversations | 10 | Gives context that analytics cannot provide. |
| Repeated feedback themes identified | 3 | Creates an evidence-based product priority. |

These are learning targets, not pass/fail growth numbers. If a target is missed, identify where people stopped and change only the biggest blocker.

### Plan

1. **Keep 1.0.10 stable.** Do not publish 1.0.11 merely to create a new release. The prepared package remains a controlled follow-up when feedback sampling is worth introducing.
2. **Run the invite loop each week.** Invite 5–8 relevant people, follow up once, and ask for feedback after a real trial.
3. **Review the funnel weekly.** Track invite sent → installed/opened → first summary → first save → returned after seven days.
4. **Ship at most one small improvement per release cycle.** Choose the issue that blocks the most people. Examples: clearer install/pin guidance, an easier first summary, or dashboard onboarding.
5. **Close the loop.** Tell testers when their feedback led to a change. This earns trust and encourages another trial.

### Do not do in month one

- Do not run paid advertising.
- Do not build a native mobile app before desktop retention is understood.
- Do not add broad features because one person asked for them.
- Do not optimize pricing before people repeatedly use the free experience.

## Stage 3 — first quarter (months 2–3)

### Quarter objective

Establish a repeatable, small-scale acquisition and learning loop for one primary audience—not broad market growth yet.

### Targets

| Area | Quarter target | Evidence of progress |
| --- | ---: | --- |
| Relevant people invited | 75 | Invitations increasingly come from the best-performing audience. |
| Core-task completions | 35 | Activation is not limited to close friends. |
| Four-week returners | 12 | People return for another real reading task. |
| People who save 3+ items | 10 | The library is providing continuing value. |
| Testimonials or permissioned quotes | 5 | Clear language for the Store listing and future outreach. |
| Repeated weekly active users | 10 | A small but meaningful base for deciding the next product investment. |

### Expansion path

1. Start with friends and colleagues who match the three candidate reader groups.
2. Ask the people who find Brief useful for one introduction to a similar reader.
3. Participate helpfully in relevant study, research, language-learning, or professional communities; do not spam links.
4. Update the Chrome Web Store description and screenshots using the phrases real users use to describe the benefit.
5. Only test a small public channel after activation and week-four return are visible. Prefer one channel at a time: a community, newsletter partnership, or creator—not many at once.

### End-of-quarter decision

Choose one based on evidence:

- **Double down:** one audience shows repeated weekly use and referrals. Improve its most important workflow.
- **Fix activation:** people install but do not complete a first useful summary/save. Improve onboarding before outreach.
- **Reposition:** people value summaries but not saving; simplify the product message or flow.
- **Validate mobile demand:** if multiple active users repeatedly say desktop access is the blocker, prototype the native iOS/iPadOS Share Sheet flow described in the backlog.

## Production and commercial-launch gate

Do not use an installation or user-count threshold to decide when to register a business or address tax obligations. The appropriate trigger is **before accepting paid subscriptions, issuing invoices, or taking another action that begins commercial activity**. Complete this gate before turning on Stripe payments or presenting a paid plan as available.

1. Confirm the operating country, legal structure, VAT/tax treatment, invoicing requirements, and any self-employed or company registrations with a qualified local accountant or tax adviser.
2. Complete the required registrations before commercial activity begins; retain the adviser’s written guidance and the registration records.
3. Configure Stripe with the correct legal name, bank account, tax settings, invoice details, refund policy, and support contact.
4. Test a full paid flow in a non-production environment: checkout, invoice/receipt, failed payment, cancellation, refund, and customer support hand-off.
5. Recheck the published terms, privacy policy, subscription disclosures, data-processing arrangements, and account-deletion flow before launch.

For a Spain-based operation, the Agencia Tributaria states that registration in the census of entrepreneurs/professionals/withholders using Modelo 036 is generally made before starting an activity or operations. The exact obligations depend on the facts and legal form, so obtain Spain-specific advice before taking the first payment or business commitment. See the [AEAT census FAQs](https://sede.agenciatributaria.gob.es/Sede/censos-nif-domicilio-fiscal/tramites-censales-relacionados-empresarios-profesionales-retenedores/preguntas-frecuentes-modelos-036-037.html) and its [Modelo 036 registration guidance](https://sede.agenciatributaria.gob.es/Sede/eu_es/ayuda/manuales-videos-folletos/manuales-practicos/guia-practica-cumplimentacion-modelo-censal-036/capitulo-01-cuestiones-generales/plazos-presentacion/declaracion-alta/alta-censo-empresarios-profesionales-retenedores-036.html).

## Six-month ambition: 10,000 users

**10,000 registered accounts in six months is a stretch ambition, not the operating forecast.** From zero, it means roughly 55 new registrations every day for six months. Friends, manual outreach, and a Chrome Web Store listing alone will not reliably produce that volume. It becomes plausible only after Brief demonstrates a strong audience, activation, retention, and at least one scalable acquisition channel (for example, search, a creator partnership, referrals, or paid acquisition with sustainable economics).

Do not define the goal simply as “users.” Track four separate measures:

| Measure | Why it matters |
| --- | --- |
| Registered accounts | Reach, but can be vanity if people never use the product. |
| Activated users | People who complete a first useful summary and save or share something. |
| Weekly/monthly active users | Whether the product becomes a recurring habit. |
| Retained users | Whether people return after week one and week four. |

The committed six-month objective is to prove one repeatable channel that consistently brings relevant, activated users and to retain a meaningful share of them. Treat 10,000 registrations as a conditional upside target: promote it to an operating target only after the first channel has delivered a sustained cohort of activated, returning users. A target of 10,000 active users in six months is not a realistic planning assumption at the current stage.

## Weekly operating rhythm

| When | Activity | Output |
| --- | --- | --- |
| Monday | Review funnel and support/report data. | One written insight and one candidate problem. |
| Tuesday–Thursday | Invite 5–8 relevant people and hold 2–3 feedback conversations. | Notes using the five feedback questions. |
| Friday | Group feedback by theme; choose one action or explicitly choose no change. | A short decision record. |
| End of release cycle | Test one small change in Development, then promote only if it fixes the chosen problem. | Release note and before/after observation. |

## Minimal scorecard

Maintain a private weekly sheet or note with:

- invitations sent;
- installs/extension opens;
- first summaries;
- first saves;
- day-7 and week-4 returns;
- number of feedback conversations;
- top three feedback themes;
- decision made that week.

The existing Brief admin pages and safe product events help with usage and failure trends. Direct conversations provide the missing context.

## Definition of a good first quarter

At the end of the quarter, a good outcome is not “many downloads.” It is being able to say:

> “These specific people use Brief for this recurring reading task. We know the activation obstacle, the strongest reason they return, and the next smallest product change worth testing.”

That is the foundation for confident growth, pricing, and eventually a mobile product.
