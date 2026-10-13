# Worth It repository guide for coding agents

## Start here

Before planning or coding, read the assigned GitHub issue and this guidance, then consult the relevant sections of:

1. `docs/PRD.md` for approved user behavior and product requirements.
2. `docs/TECH_SPEC.md` for architecture, proposed repository structure, data handling, and test strategy.
3. `docs/IMPLEMENTATION_PLAN.md` for the ordered issue list, dependencies, and current status.
4. Existing source and tests related to the issue, once implementation has started.

The assigned issue's acceptance criteria define the work. If they conflict with the PRD or leave a user-visible decision open, clarify/update the issue before coding. Keep this file short; put detailed and changing plans in the linked documents and GitHub issues.

## Current delivery order

The roadmap is tracked in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) and the issue bodies are the source of truth for scope and completion criteria. The current sequence is:

1. [#4 — Finalize hackathon MVP decisions and owner setup](https://github.com/girwandhakal/WorthIt/issues/4) — blocking decision gate.
2. [#5 — Extension foundation and Walmart checkout panel](https://github.com/girwandhakal/WorthIt/issues/5).
3. [#6 — Local purchase history and Gmail receipt import](https://github.com/girwandhakal/WorthIt/issues/6).
4. [#7 — Explainable assessment rules](https://github.com/girwandhakal/WorthIt/issues/7).
5. [#8 — Cart savings and animated recap](https://github.com/girwandhakal/WorthIt/issues/8).
6. [#9 — Integration, verification, and hackathon package](https://github.com/girwandhakal/WorthIt/issues/9).
7. [#10 — Amazon adapter](https://github.com/girwandhakal/WorthIt/issues/10), after the Walmart flow.
8. [#11 — Optional public release](https://github.com/girwandhakal/WorthIt/issues/11), only if the owner chooses public distribution.

Do not start implementation work blocked by #4 until its relevant decisions are recorded. For the hackathon deliverable, build the actual usable extension; there is no separate demo mode.

## Product constraints

- Worth It informs and suggests. The shopper makes every cart change and decides whether to purchase; never mutate the cart or trigger checkout. Nothing of Worth It's is visible on the cart page until checkout (owner decision: no pill or indicator). The one approved interruption: when there is something un-dismissed to show, the first real user click on the retailer's checkout control on the cart page is held once and the full-screen presentation opens and plays; Worth It never clicks anything itself, and the shopper's next click goes straight through. The presentation cannot be skipped (owner decision): Continue, dismiss, Escape, and "See full analysis" unlock only when it has played to the end; pause, replay, and captions remain, and reduced motion gets the static view. Nothing is ever held when there is nothing to show, for scripted clicks, or off the cart page.
- Worth It is an advisor that makes shoppers think twice, not an analysis tool. The checkout presentation highlights at most three items (with the retailer's own product thumbnail, and its reason as two or three short points or a question), groups the rest, and keeps scores, categories, and tables out of the default view. Its only visuals are thumbnails, a running savings meter, and the one animated investment-growth chart at the end; the shopper can open “See full analysis” for a short, plain list of every item with its main points (the full assessment goes to the console for debugging) (PRD 3.6, TECH_SPEC section 8).
- Assess readable cart items, but show concise prompts only for meaningful findings and report uncertainty instead of guessing.
- Prefer an available store brand for groceries. Claim similarity or savings only when product data supports it. Store-brand pairs and prices come from `docs/WALMART_REFERENCE_PRODUCTS.md`; the owner's MVP decisions are in section 1 of `docs/TECH_SPEC.md`.
- Purchase history shows prior purchases, not proof of current ownership or consumption. Treat routine consumables as restocking unless evidence supports otherwise.
- Food is judged by a decision tree on the product's own label, read from its Walmart product page (PRD PR-16): a food with nothing flagged gets no comment; otherwise the approved concerns are added sugar, cured/processed meat, trans fat, non-sugar sweeteners, high sodium, synthetic dyes, and ultra-processed ingredients, each with fixed reviewed wording and one vetted source. Never suggest a product with added sugar or one of those concerns as a switch. Do not quote Daily Value percentages, diagnose, or claim a single item/serving causes disease. A new health trigger needs owner approval and a verified source.
- Every item takes one branch of the decision tree (TECH_SPEC section 7): food with a label concern gets that concern and its source; other food, and useful non-food not bought in the last 90 days, get a cheaper store-brand recommendation only when one does the same job; useful non-food bought recently gets a warning and one question; a novelty item with no practical use gets "probably not worth it". Food is never warned about a past purchase, and an item that can't be told to be food or not gets no comment.
- Reading product pages is limited to the retailer's own pages for items already in the cart, same-origin, a few at a time, and stops at the first bot check. Never crawl, search, or read pages for items not in the cart.
- Do not connect bank accounts or use personal financial data. The investment illustration is on by default (the shopper can turn it off), hypothetical, and shown once for aggregate cart potential savings, never per item.
- Gmail history is optional and requires explicit read-only consent. Parse locally, ask the user to review records before saving, and do not retain raw email bodies/attachments. Synthetic receipt emails for the hackathon use the same Gmail import flow and must be labeled synthetic.
- Never commit secrets (including the OpenAI API key), OAuth tokens, real emails, personal purchase data, or account-specific artifacts.

## Branches, pull requests, and testing

- Work on one issue at a time. Create a focused branch from up-to-date `main`, named with its issue number when practical (for example, `issue-5-walmart-panel`). Do not commit implementation work directly to `main`.
- Open a PR targeting `main`; link the issue and use `Closes #N` when the PR completes it. Summarize the user-visible result, approach, exact checks run and their outcomes, and known limitations.
- Follow the repository's review and CI process. Do not bypass required checks or protections.
- Add or update tests for every implementation change. Run the focused tests and all applicable project checks; they must pass before completion. Report every command accurately and identify anything that could not be run.
- The implementation issues require these project checks once established by #5: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, and `npm run build`. If a script is not applicable, explain why in the PR. Follow `docs/TECH_SPEC.md` for test locations and fixture guidance.
- Update product or technical documentation in the same issue when behavior or setup changes.
