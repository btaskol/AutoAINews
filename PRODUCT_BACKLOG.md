# Brief product backlog

Brief’s core job is simple: save useful web content, understand it quickly, and find it again when it matters. New work should strengthen capture, understanding, retrieval, or acting on a saved item.

## Release rule

Do not promote an idea from this backlog because it sounds useful. Promote it when at least one of these is true:

- several users request the same outcome;
- users repeatedly work around the missing capability;
- product data shows a clear activation, retention, or conversion problem it could solve.

For every idea: make the smallest testable version in development, test it with a few users, measure usage, then keep, improve, or remove it.

## Now — before the first production release

| Item | Why it matters | Smallest release | Success signal |
| --- | --- | --- | --- |
| Install and pin onboarding | A web signup has little value if the extension is not installed and available. | Dashboard panel for people with no captures: Chrome Web Store install link plus a two-step pin guide and dismiss action. | More new users create their first capture. |
| Live billing readiness | Paid users need a reliable, understandable upgrade path. | Live Stripe prices/table/webhook and one end-to-end real-flow test. | Checkout, plan update, cancellation, and deletion all behave as stated. |
| Launch measurement | Decisions after launch should be based on behaviour, not guesses. | Track signup, extension install/open, first capture, fifth capture, day-7 return, upgrade click, checkout success, and cancellation. | A simple weekly funnel can be reviewed. |
| Privacy and support basics | People need to know what Brief stores and how to get help. | Privacy Policy, Terms, support contact, and clear delete-account wording. | Ready for store review and early-user questions. |

## Next — validate with early users

| Item | User problem | Smallest experiment | What to measure |
| --- | --- | --- | --- |
| Follow-up on a saved Brief | “I saved this, but I need to do something with it later.” | A single optional **Add follow-up** checkbox/text field on a saved card; a simple filtered list in the dashboard. | Number of follow-ups created and completed; repeat use. |
| Better notes | “I need to remember why I saved this.” | Improve the existing note field with clearer placement and search inclusion. | Portion of saves with notes; notes used in later searches. |
| Reading queue | “I want to keep this for later, not process it now.” | A `Read later` tag/filter, not a separate task system. | Queue items later opened, starred, or completed. |
| Feedback loop | “I have an idea or issue.” | Optional feedback link in the dashboard/extension; keep the existing five-capture rating prompt. | Quality and repetition of feedback themes. |
| Team feedback workflow | “Someone else should help process customer feedback.” | Use the existing `Feedback reviewer` role; test it with one trusted helper. | Reviewer can work independently without Cloudflare access. |

## Later — only if demand proves it

| Item | Why it is later | Guardrail |
| --- | --- | --- |
| Reminders | Useful when follow-ups are consistently used; otherwise adds notification complexity. | Start with one optional date per follow-up, not a full calendar. |
| Sharing / collections | Potentially valuable for teams, but introduces permissions and collaboration design. | Validate that people try to share exports or links first. |
| Dedicated admin console | Useful once operational tools change often or multiple admins work concurrently. | Keep it inside the main Worker until that becomes a real constraint. |
| Advanced analytics | Valuable at scale, but custom dashboards too early can become maintenance work. | Start with a few product events in an analytics service. |
| General task manager | Risks making Brief unclear and competing with mature task apps. | Only expand from capture-linked follow-ups after proven use. |

## Parked ideas

Keep these visible, but do not schedule them yet:

- richer tags and saved-search views;
- exports/integrations with note-taking tools;
- shared research spaces;
- AI suggestions for tags or follow-ups;
- browser-wide capture shortcuts and additional browser support.

## Weekly review template

Every week after launch, answer:

1. How many people signed up, installed/opened the extension, made a first capture, made five captures, returned after seven days, and upgraded?
2. What are the three most repeated feedback themes?
3. Where did users fail, abandon, or ask for help?
4. Which single backlog item has the strongest evidence to test next?

Pick at most one small experiment per release cycle.
