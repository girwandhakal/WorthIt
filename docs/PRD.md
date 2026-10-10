
# Worth It — Product Requirements Document (PRD)

**Product Name:** Worth It  
**Product Type:** AI-Powered Shopping and Purchase Assessment Assistant  
**Platform:** Chrome Browser Extension  
**Primary Retailers:** Amazon and Walmart  
**Project Context:** Hacklanta 2026 — Fintech Track  
**Status:** Product Requirements — Hackathon MVP

---

## 1. Product Overview

Worth It is an AI-powered Chrome extension designed to help consumers reduce impulsive, unnecessary, redundant, and excessively expensive purchases while shopping online. The hackathon project focuses on one standout capability: a polished, evidence-based review of the shopper's cart immediately before checkout. Item criteria, purchase history, value comparisons, and applicable health evidence all support this single experience rather than appearing as separate product features.

Right before checkout, the Chrome extension reviews every item in the cart, including ordinary groceries, and assesses the item itself as well as its cost. It considers the item's likely purpose and usefulness, whether purchase history suggests the user may already have enough, whether a lower-cost comparable product exists, and relevant quality or nutrition information. The checkout panel gives a concise summary of items that merit attention, such as a store-brand alternative or a possible repeat purchase. Ordinary items with no relevant concern are omitted from the user-facing summary. A review is not a restriction: the user always controls whether to buy or change the cart. Worth It checks each item against fixed assessment criteria, records applicable findings and scores, and leaves non-applicable checks out of the recap. Related findings can be grouped into a cart summary. Criterion scores, group statistics, price comparisons, and savings come from product and cart evidence and are calculated deterministically. Language AI phrases the verified summary naturally, but cannot change its findings, evidence, or numbers.

Worth It evaluates the purchase itself rather than a shopper's personal finances: affordability or income does not determine whether a product is useful, suitable, redundant, or good value.

The product aims to encourage intentional spending rather than simply restricting spending. Its assessment should not treat a low price as proof that an item is suitable. When enabled, the checkout summary may total supported potential savings across the current cart and show one clearly stated long-term investment illustration based on that aggregate. It does not show investment projections for individual items or use the shopper's personal financial information.

Worth It should work automatically during online shopping, requiring minimal interaction and only interrupting users when it identifies a meaningful reason to reconsider a purchase.
When it intervenes, its role is to add a brief pause and offer evidence-based suggestions that encourage the user to review the purchase. Worth It is not a cart builder: it must never add, remove, replace, or purchase items. The user makes any changes directly on the retailer's website.

---

## 2. Product Mission

**Help people buy what they actually need, avoid what they don't, and spend no more than necessary to satisfy their needs.**

Worth It should help users:

- Avoid impulsive purchases.
- Identify unnecessary purchases.
- Recognize redundant purchases of items they already own.
- Distinguish genuine needs from discretionary wants.
- Avoid paying unnecessarily high prices for basic needs.
- Discover lower-cost alternatives that provide comparable practical utility.
- Understand how purchase price and product value compare.
- Make more intentional purchasing decisions without excessive friction.

The product should not encourage users to eliminate all discretionary spending. Instead, it should help them make informed choices while preserving personal autonomy.

---

## 3. Core Product Principles

### 3.1 Affordability Does Not Equal Necessity

An expensive purchase is not automatically unnecessary, and an affordable purchase is not automatically justified.

The product evaluates purchase necessity and product value without accessing the user's personal financial situation.

For example:

- A $140 pair of shoes may be necessary, but a cheaper pair might satisfy the same need.
- A $700 laptop may be essential for employment or education, even if it is unusual relative to historical spending.

### 3.2 Minimize Checkout Friction

Worth It should not interrupt every purchase.

When the product has no meaningful concerns, the user should be able to shop normally.

When additional context is necessary, the product should ask at most one short, context-specific clarification question.

### 3.3 Evidence Over Assumptions

The product should prioritize verifiable information over unsupported generic advice. Worth It evaluates every cart item against a fixed set of criteria. Each criterion receives an applicable finding, a no-concern result, or an unknown result when evidence is insufficient. Only applicable findings and material uncertainty appear in the shopper-facing recap; checks with no applicable finding are omitted. When AI helps phrase the recap, it may make verified findings sound natural, but it must not change scores, classifications, calculations, facts, or sources.

Recommendations should be based on relevant evidence such as:

- Previous item-level purchases.
- Similarity to products the user already owns.
- The user's stated purchase purpose.
- Product specifications and comparable alternatives.
- Relevant research about whether premium products provide meaningful additional utility.
- Product labels and credible nutrition or health guidance when discussing food.
- Comparable product specifications, ingredient lists, nutrition facts, and unit prices when considering a store-brand or other lower-cost alternative.

When information is incomplete or uncertain, the product should acknowledge that uncertainty.
Health and nutrition information should be general and evidence-based, not a diagnosis or a claim about an individual user's health. Investment illustrations should state their assumptions and make clear that future returns are uncertain.

### 3.4 Preserve User Autonomy

Worth It is an assistant, not a purchasing restriction system.

Users should always be able to dismiss recommendations and continue shopping.

The product should avoid guilt-inducing, judgmental, or overly restrictive messaging.

### 3.5 Personalize Recommendations

Recommendations should reflect the user's stated purpose, preferences, and purchasing history rather than applying identical rules to everyone.

---

## 4. Target Users

Worth It is designed for online shoppers who:

- Frequently make unplanned purchases.
- Want to reduce unnecessary spending.
- Have difficulty distinguishing needs from wants.
- Sometimes purchase items they already own.
- Want to find better-value purchases without eliminating hobbies or discretionary purchases.
- Would benefit from personalized shopping recommendations.
- Want to understand what the cart's total potential savings could become over time under a hypothetical investment assumption.

The initial product experience should focus on shoppers using Amazon and Walmart.

---

## 5. Primary User Experience

### 5.1 Initial Setup

When a user first installs Worth It, they should be able to:

1. Optionally connect Gmail with read-only consent to find order receipts or add records manually. Gmail is not required. For the single-user hackathon project, synthetic receipt emails sent to the user's own Gmail account are imported through the same Gmail flow and clearly marked as synthetic. Worth It does not connect to bank or retailer accounts.
2. Choose product, dietary, and shopping preferences they want considered.
3. Choose how frequently the product should intervene.
4. Review and adjust the purchase-history information used for recommendations.

The product should clearly communicate what information it accesses and why.

Users should be able to control, correct, and delete locally stored purchase-history information.

### 5.2 Shopping Experience

The user visits Amazon or Walmart and shops normally.

When a product is added to their cart or they approach checkout, Worth It should automatically evaluate the purchase.

The evaluation should consider:

- What the user intends to buy.
- Whether the item is likely essential or discretionary.
- Whether the user has recently purchased a similar product.
- Whether the product may be redundant.
- Whether the purchase appears unusual relative to previous behavior.
- Whether a cheaper product could meet substantially the same need.

When no meaningful issue is detected, the shopping experience should continue without interruption.

When intervention is warranted, Worth It should display a compact, contextual panel on the shopping website.

The panel should explain the concern, present the relevant evidence concisely, and let the user dismiss the suggestion or continue. Any cart change must be made by the user on the retailer's website.
At checkout, the extension should show a concise summary of items that merit attention and why. It should omit items without a meaningful concern rather than listing a status for every cart line. When an item cannot be read reliably and that uncertainty affects the review, the summary should say so. Each concern should include a short reason and access to supporting details. Worth It evaluates each item against the same defined criteria and groups related applicable findings into a readable cart summary. Item scores and summary statistics are determined from the available product, label, price, and history evidence; AI may help phrase those verified results naturally but cannot change their meaning or numbers.

---

## 6. Core Product Requirements

### PR-01: Automatic Product Recognition

**Priority: Must Have**

Worth It must recognize products that users are considering purchasing on supported shopping websites.

The product should identify:

- Product name.
- Product category.
- Brand, when available.
- Product price.
- Quantity.
- Merchant.
- Relevant product specifications.
- Current cart contents.
- Checkout total, when available.

The product should support evaluating individual items rather than relying exclusively on the combined cart total.
At checkout, it should review each line item in the cart, not only items the system has already decided to flag. If an item, quantity, or price cannot be read reliably, the review should say so rather than silently omit it or guess.

For example, a cart containing groceries and unnecessary electronics should not be classified as entirely essential or entirely discretionary.

The product should recognize that checkout totals may differ from product-page prices because of quantities, discounts, taxes, and shipping.

When purchase information cannot be determined reliably, the product should avoid making misleading price, value, or savings claims.

### PR-02: Automatic Purchase Necessity Classification

**Priority: Must Have**

Worth It must automatically evaluate whether a product appears necessary for the user's circumstances.

The product should classify purchases into categories such as:

1. **Essential:** An item that satisfies a fundamental or clearly established requirement.
2. **Useful / Context-Dependent:** An item that may serve a legitimate purpose, but whose necessity depends on the user's situation.
3. **Discretionary:** An optional purchase primarily associated with convenience, entertainment, preference, or enjoyment.
4. **Potentially Unnecessary or Redundant:** An item for which available evidence suggests the user may already have a suitable alternative or may not need another one.
5. **Unknown:** Insufficient information to make a reliable assessment.

Classification should consider the product's intended use rather than its category alone. The purchase assessment should also evaluate the product itself independently from the user's ability to afford it, including fit for purpose, quality, price and value, relevant product or nutrition evidence, and likely redundancy. It should explain the evidence and uncertainty rather than issue a moral judgment about the shopper.

For example:

- A laptop may be essential for school.
- A gaming headset may be discretionary.
- A second headset may be redundant.
- Running shoes may be essential if the user's current shoes are worn out.
- Additional running shoes may be discretionary if the user recently purchased a suitable pair.

The product must not treat these classifications as definitive judgments about the user's needs.

### PR-03: User-Controlled Purchase History

**Priority: Must Have**

Worth It should let users build purchase history without depending on having receipt emails. Users may optionally connect Gmail through an explicit Google consent flow so Worth It can find likely order receipts and prepare item records for the user to review before import. Gmail access is read-only and optional; users can instead add records manually. For the single-user hackathon project, synthetic receipt emails sent to the owner's own Gmail account are found and imported through this same flow, so the demonstration exercises the actual Gmail integration instead of a separate demo path. These generated receipts must be clearly marked as synthetic in the resulting purchase records. With the user's consent, the extension may also record items they purchase through supported shopping pages going forward. Worth It does not connect to bank or retailer accounts.

The initial experience should focus on Amazon and Walmart.

For records the user adds or imports, the product should capture relevant purchase information, including:

- Product names.
- Purchase dates.
- Merchants.
- Prices.
- Quantities.
- Order identifiers, when available.
- Available product descriptions.
- Order cancellation or refund information, when identifiable.

Worth It should organize this information into a searchable item-level purchase history.

The product should distinguish between an order being placed and an item actually being retained whenever reliable information is available.

If a provided receipt or order record does not contain sufficient item details, Worth It should identify the purchase as incomplete or uncertain instead of inventing missing information.

Users should be able to review, correct, and delete purchase records, disconnect Gmail, and revoke email access. Gmail remains optional for ordinary use; manual history and permitted retailer observations remain available without it. Imported messages are processed only to extract order details; email bodies and attachments are not retained after extraction.

### PR-04: Need Memory — Previously Purchased Item Recognition

**Priority: Must Have**

Worth It must use historical purchase information to identify items that users may already own.

When a user considers purchasing a product, the system should compare it against previous purchases.

The product should identify:

- Exact repeat purchases.
- Similar products.
- Products serving overlapping purposes.
- Recently purchased items in the same functional category.
- Potentially redundant purchases.

The system should distinguish between:

- Purchasing a replacement.
- Purchasing an additional item.
- Purchasing an item for a different purpose.
- Repurchasing a consumable product.
- Purchasing an item that was previously returned or canceled.

**Example:**

A user purchased Nike running shoes 14 days ago and is now considering another pair.

Worth It displays:

> You purchased similar running shoes 14 days ago. Are these replacing your previous pair, serving a different purpose, or an additional purchase?

The user's answer should update the purchase assessment.

The product must not automatically assume that purchasing multiple similar items is wasteful.

### PR-05: Impulsive Purchase Risk Detection

**Priority: Must Have**

Worth It should automatically identify purchasing patterns that may indicate impulsive or unplanned spending.

The system should consider available behavioral information, such as:

- Purchase frequency.
- Spending frequency within a product category.
- Unusually expensive purchases relative to personal spending history.
- Repeated discretionary purchases within a short period.
- Recent spending increases.
- Repeated purchases from similar merchants.
- Purchase timing patterns.
- Relevant shopping behavior observed with permission.

The product should distinguish between a statistically unusual purchase and a genuinely impulsive purchase.

An unusual purchase should not automatically be labeled impulsive.

For example:

- A $700 laptop purchased for college may be unusual but well planned.
- Five discretionary purchases in one evening may warrant additional reflection.
- Repeated purchases of similar items over a short period may indicate avoidable spending.

When appropriate, the product should communicate that a purchase shows signs of potential impulsivity rather than claiming to know the user's intentions.

### PR-06: One-Question Clarification

**Priority: Must Have**

When Worth It cannot confidently determine whether a purchase is necessary, it should ask one short, contextual question.

The question should address the specific missing information that could meaningfully change the purchase recommendation.

Example scenarios:

| Situation | Clarification Question |
|---|---|
| Similar item purchased recently | Are you replacing the previous item or buying another one? |
| Expensive item with unclear purpose | What is the main reason for this purchase? |
| Multiple similar products in one cart | Do you intend to use all of these? |
| Unusual discretionary purchase | Is this something you planned to buy? |
| Product with multiple potential uses | What will you primarily use this for? |

The product should:

- Avoid generic questionnaires.
- Ask no more than one clarification question per item during a checkout evaluation.
- Provide simple, quickly selectable answers.
- Allow the user to skip the question.
- Remember relevant answers for future recommendations.
- Avoid repeatedly asking for information the user has already supplied.
- Update its assessment based on the answer.

A user's stated purchase purpose should be respected, but it should not automatically override separate evidence about redundancy, product suitability, nutrition, or value.

### PR-07: Need-Based Lower-Cost Alternatives

**Priority: Must Have**

Worth It should suggest less expensive alternatives when a cheaper product may satisfy the same underlying need. For grocery alternatives with sufficiently similar labels and ingredients, it should state that similarity, identify the lower price, and quantify the potential savings. It must not add the alternative to the cart, replace the selected item, or otherwise change the retailer's cart.

The product should distinguish between:

1. The same product available at a lower price.
2. A less expensive product with comparable functionality.
3. A lower-cost product that meets the user's essential requirements despite offering fewer premium features.

The product should evaluate the functional purpose of the original item before recommending substitutes. For grocery products, when a store-brand version is available, Worth It should prefer it as the default brand recommendation, including for staples such as milk and bread. This default applies even when the available evidence does not establish equivalence or a lower price. The checkout message should state the actual price difference and briefly describe ingredient, nutrition, size, or other material differences. It may say the products have similar ingredients only when the labels support that claim, and may quantify potential savings only when the store brand costs less. For example: “The store brand has similar ingredients and costs $0.40 less per unit. Choosing it for these 3 units could save about $1.20.” If a known allergy, dietary requirement, or explicit user preference conflicts with the store-brand product, clearly flag that conflict rather than recommending it as suitable.

**Example:**

A user considers purchasing $140 running shoes.

Worth It determines that the user may genuinely need new shoes.

Rather than discouraging the purchase entirely, it evaluates whether a lower-cost pair could reasonably satisfy the user's intended use.

For casual daily wear, a basic option may be sufficient.

For serious running, occupational requirements, medical needs, or specialized use, premium features may be justified.

The product should present alternatives only when there is reasonable evidence that they meet the user's needs. The user can review the suggestion and manually decide whether to make a change on the retailer's website.

It should not automatically recommend the cheapest available product.

Recommendations should consider:

- Intended use.
- Important functional specifications.
- Comfort and fit where relevant.
- Quality and reliability.
- Durability.
- Safety requirements.
- Price difference.
- Available evidence of comparable performance.

The user should be able to keep the original product without penalty.

### PR-08: Evidence-Backed Product Recommendations

**Priority: Must Have**

Worth It should support product recommendations with credible evidence whenever it makes factual claims about quality, performance, or value.

Relevant evidence may include:

- Independent product comparisons.
- Academic research.
- Reputable testing organizations.
- Verified product specifications.
- Available performance measurements.
- Reliable price comparisons.
- Product ingredient and nutrition labels.
- Authoritative nutrition or health guidance relevant to a specific, observable cart characteristic.

The product should distinguish between:

- Evidence that a cheaper product is functionally equivalent.
- Evidence that a premium feature offers limited additional benefit.
- Evidence that higher prices do not consistently correspond to better performance.
- Cases where the available evidence is insufficient.

For example, the product could explain that a high price does not necessarily guarantee better comfort or performance, while acknowledging when a specific premium product has not been directly compared with a cheaper alternative.

Each evidence-backed recommendation should identify its supporting source.
Health-related messages should describe the general evidence and the observed product or quantity (for example, added-sugar information shown on package labels). They must not infer that a user has a medical condition, prescribe treatment, or claim that a food is categorically harmful to that user. When the source does not support a direct comparison or a confident conclusion, the product should say so.

The system must not fabricate sources, product equivalence, or claims about performance.

### PR-09: Contextual Checkout Intervention

**Priority: Must Have**

Worth It should display recommendations directly within the shopping experience.

The extension should present a compact, visually clear panel when a purchase deserves attention.

The panel may include:

- Product being considered.
- Purchase price.
- Necessity assessment.
- Relevant historical purchases.
- Reasons the purchase was flagged.
- Lower-cost alternatives.
- One clarification question, when necessary.
- Available user actions.
- A concise explanation of what, if anything, is concerning about each item and the cart overall.
- The item's share of the cart total, where prices and quantities are known.
- Relevant product, nutrition, or purchase-history evidence, with source links when applicable.
- One optional, clearly labeled cart-level opportunity-cost illustration based on aggregate potential savings, shown after the item summaries.

The intervention should occur before the final purchase is completed.

The extension should not interfere with payment processing or accidentally submit an order.

Users should be able to dismiss the panel and continue shopping normally.

### PR-10: Explainable Purchase Assessments

**Priority: Must Have**

Worth It must explain its recommendations in understandable language.

It should not rely exclusively on opaque scores.

Possible explanations include:

- "You purchased a similar item two weeks ago."
- "This is your fourth discretionary electronics purchase this month."
- "A lower-cost alternative may meet the same basic need."
- "This purchase appears consistent with your usual spending patterns."

Explanations should be grounded in actual observations or clearly identified estimates.

The product should not present predictions as proven facts.
When the available evidence suggests a concern, the assessment should summarize the concrete reason (such as a recent similar purchase, a higher unit price, or a notable nutrition-label value). It should not declare an item "not worth it" without explaining which criteria led to that conclusion. The shopper must be able to dismiss the recommendation and continue without repeated pressure.

### PR-11: Save for Later and Reflection

**Priority: Should Have**

Worth It should allow users to postpone discretionary purchases without losing track of the items.

Users should be able to:

- Save an item for later.
- Choose a reflection period, such as 24 hours.
- Review previously delayed purchases.
- Revisit the original purchasing reasons.
- Decide whether they still want the item.

The product may remind users about saved items after the selected reflection period.

Reminders should not pressure users to complete purchases.

The purpose is to introduce a voluntary cooling-off period that can reduce unnecessary impulsive decisions.

### PR-12: Purchase Decision History

**Priority: Should Have**

Worth It should maintain a history of shopping decisions and recommendations.

The history should distinguish between:

- Purchases completed.
- Purchases postponed.
- Purchases canceled.
- Items saved for later.
- Recommendations dismissed.
- Alternative products selected.
- Purchases returned when that information is available.

The product should not automatically count an abandoned or postponed purchase as money saved.

When savings are reported, the system should distinguish between:

- Potential avoided spending.
- Estimated savings from choosing a cheaper alternative.
- Verified savings supported by completed transaction information.

### PR-13: Personalized Learning and Feedback

**Priority: Should Have**

Worth It should improve recommendations through explicit user feedback.

Users should be able to indicate:

- A purchase was planned.
- A product was necessary.
- An item replaced something they owned.
- An item was purchased for a different purpose.
- A recommendation was useful.
- A recommendation was incorrect.
- A completed purchase was later regretted.
- A previously purchased item was returned or no longer owned.

The system should retain relevant preferences and contextual information to avoid repeating incorrect assumptions.

The product should recognize that user feedback is subjective and should not automatically be treated as verified ground truth.

### PR-14: Purchase-Level and Cart-Level Analysis

**Priority: Must Have**

Worth It should evaluate each product individually and assess the combined impact of the entire cart.

For example, a Walmart cart may contain:

- $45 in groceries.
- $25 in household cleaning supplies.
- $150 headphones.
- $80 decorative accessories.

The product should be capable of treating groceries and cleaning supplies differently from optional electronics and decorations.

It should identify which items deserve reconsideration rather than discouraging the entire purchase.

When suggesting changes, the product should show their estimated impact on the total cart price.
The system should assess every line item internally, including items where the result is "no meaningful concern" or "not enough information." The checkout panel should summarize only items that need attention, such as a store-brand recommendation, a possible duplicate, or a supported health concern; it should omit ordinary items with no relevant concern. It should not apply one overall label to a mixed cart. Where data is available, it may show how much each flagged item contributes to the cart total and distinguish repeated non-consumable purchases from normal grocery restocking.

### PR-15: User Control and Privacy

**Priority: Must Have**

Worth It should provide users with clear control over their personal information and shopping experience.

Users should be able to:

- Understand what information is stored and how it is used.
- Review extracted purchase history.
- Correct inaccurate purchase records.
- Delete stored purchase information.
- Add, import, or remove purchase-history records.
- Adjust intervention preferences.
- Dismiss recommendations.
- Proceed with purchases despite warnings.

The product should access only information relevant to its functionality.

Purchase-history records should come from user-provided information or purchases the user explicitly chooses to record through the extension. The product must not connect to email, bank, or shopping accounts to collect purchase history.

The extension should not collect payment card details, passwords, or unrelated sensitive checkout information.

### PR-16: Evidence-Based Nutrition and Grocery Value

**Priority: Must Have**

When reliable product information and relevant evidence are available, Worth It should assess grocery items for price and product characteristics as well as purchase history. When a store-brand version is available, it should be the default brand recommendation, including when it is not cheaper or when the products are not established as equivalent. Worth It should concisely state actual price differences and material ingredient, nutrition, or package differences; describe ingredients as similar only when the labels support that claim. Quantify potential savings for the current quantity only when the store brand costs less. If purchase history contains comparable records, it may also estimate how much less the user might have spent by choosing the store brand for those past purchases. Historical savings are hypothetical and must be labeled as an estimate, especially when past prices are unavailable; use recorded historical price differences when available, otherwise state that the estimate applies today's price difference to recorded quantities. Do not present hypothetical savings as money actually saved.

Health is a selective supporting lens in the purchase review, not a separate health score, diagnosis, or health-management feature. Most foods should receive no health advice. Worth It should surface a short health prompt only when item-specific label or ingredient data meets a defined trigger and credible evidence supports a useful concern. Examples of triggers include added sugars at 20% or more of the FDA Daily Value per serving (a high amount on the label), and other nutrients at a high label value when relevant. It may also flag an item confidently classified as ultra-processed when the supporting evidence is relevant, or note a named sweetener when evidence specific to that sweetener warrants attention. It should not flag an item only because it belongs to a broad category such as chips or candy. If evidence is mixed, indirect, or about a whole dietary pattern rather than an individual food, say so plainly and avoid implying that one item causes disease. For triggered items, give a concise suggestion to skip it, choose a smaller amount, or have it less often, and state how removing it would reduce the current cart total. The user decides whether to act; the extension never removes the item.

Health notes must cite credible sources, distinguish established findings from emerging research, and must not diagnose the shopper or use personal health information. For example, FDA label guidance treats 20% Daily Value or more as high for nutrients such as added sugars ([FDA label guidance](https://www.fda.gov/media/135299/download)). A controlled NIH study found higher calorie intake and short-term weight gain during a diet composed of ultra-processed foods, but this is evidence about a dietary pattern, not proof that one bag of chips causes disease ([NIH study summary](https://www.nih.gov/news-events/news-releases/nih-study-finds-heavily-processed-foods-cause-overeating-and-weight-gain)). For non-sugar sweeteners, identify the specific sweetener and keep claims calibrated: WHO's recommendation against using them for long-term weight control is conditional and is not a safety assessment of each sweetener ([WHO guideline](https://www.who.int/publications-detail-redirect/9789240073616)); evidence on human gut microbiota effects remains mixed ([systematic review](https://pubmed.ncbi.nlm.nih.gov/37897982/)).

The store-brand preference must not be presented as proof that two products are equivalent. Worth It should not warn solely because an item is candy or another particular food category. Health messages must be grounded in the item label and credible, cited guidance; they should describe general evidence without diagnosing or making a personalized medical claim. For example, when a candy label shows added sugar, a concise tip may say: “Too much added sugar over time can contribute to health problems, including type 2 diabetes. Consider a smaller portion or having it less often.” For diet soda, identify the sweetener shown on the label and summarize evidence at the sweetener level. WHO conditionally recommends against using non-sugar sweeteners for long-term weight control; this is not a safety assessment of each sweetener or evidence that one drink causes disease ([WHO guideline](https://www.who.int/publications-detail-redirect/9789240073616)). Research on effects of specific sweeteners on human gut microbiota and glucose responses remains mixed, with limitations in the available human studies ([systematic review](https://pubmed.ncbi.nlm.nih.gov/37897982/)). The user can dismiss a message and continue with the purchase.

### PR-17: Pre-Checkout Concern Summary

**Priority: Must Have**

Immediately before checkout, Worth It should provide a concise summary of cart items that merit attention. It should omit items with no meaningful concern instead of showing a status for every line. It should identify items that may deserve a second look and, when the uncertainty materially affects the review, items it could not assess reliably. For each concern, it should explain the specific reason and distinguish observed facts from estimates or uncertain inferences.

Before checkout, the shopper sees a short, polished animated recap of the items that merit attention. The recap explains each finding, its evidence, and a suggestion, then shows the combined potential reduction to the cart. If enabled, one hypothetical investment illustration appears at the end, based on that combined amount. The shopper can pause, replay, skip, or continue checkout at any time, and can read the same concise information with captions and supporting details. The recap does not label the shopper or the cart as "bad," modify the cart, or place an order. For grocery suggestions, it states whether available label evidence supports similar ingredients, notes material differences, and shows the price difference. Health advice appears only for items that meet the defined triggers and have credible supporting evidence; routine items receive no health advice.

### PR-18: Long-Term Opportunity-Cost Illustration

**Priority: Should Have**

At the end of the checkout summary, Worth It may show one illustration of what the total potential reduction in the current cart could grow to if invested over a stated period, such as 40 years. This total may combine supported savings from lower-priced alternatives and the prices of flagged items the shopper could choose to remove. For example: “Following these suggestions could reduce this cart by $5. If you invested that $5 at an assumed 10% annual return, compounded annually, it could grow to about $226 in 40 years before inflation.” Calculate the projection using only supported potential reductions in the current cart and the stated assumptions: future value = aggregate potential reduction × (1 + annual return) ^ years. Count each item only once, do not include estimated savings from past purchases, and do not show a separate investment projection for any individual item. This is an optional perspective on the cart, not a recommendation to invest or a promise of actual returns.

The single cart-level illustration must appear after the total potential reduction and state that amount, time horizon, assumed annual return, compounding frequency, and whether the projected value is nominal or adjusted for inflation. It must calculate the projected amount from those assumptions and explain that returns are uncertain and the result is hypothetical, not guaranteed. Worth It must not call an amount "saved" unless the user actually makes the lower-priced choice or removes the item and the product can verify that change. This comparison should remain secondary to the direct assessment of the cart.

---

## 7. Purchase Evaluation Framework

Worth It should evaluate purchasing decisions using distinct, evidence-backed dimensions. Not every dimension applies to every item. The product does not access or evaluate the user's personal financial situation; the optional opportunity-cost illustration is calculated once at cart level from total supported potential savings and stated assumptions.

| Dimension | Core Question |
|---|---|
| Purpose and need | Does the item appear to fit the user's stated purpose or likely use? |
| Product fit, quality, and health information | Do available specifications, ingredients, nutrition facts, and credible guidance raise a relevant consideration? |
| Redundancy and purchase pattern | Does history suggest a recent similar purchase or a quantity/frequency worth reviewing, after accounting for restocking, replacement, and other uses? |
| Price and value | Is the unit price reasonable relative to a comparable product that meets the user's requirements? |
| Opportunity cost | Would one optional, assumption-based illustration of the cart's total potential savings help the user understand its hypothetical long-term investment value? |
| Evidence and confidence | What is observed, estimated, uncertain, or unknown, and how strong is the supporting evidence? |

These dimensions must remain conceptually distinct.

A product may be:

- Necessary and good value.
- Necessary but unnecessarily expensive.
- Discretionary and reasonably priced.
- Redundant regardless of price.
- Unusual but planned and justified.

Worth It should use the combined assessment to determine whether an intervention is warranted.

The system should not use price or a single behavioral score as the sole measure of purchase quality. It should summarize relevant concerns and recommendations for flagged cart items, with the reason and supporting detail. Items with no relevant finding should not appear in the checkout summary. When the system lacks enough information to assess an item and that limitation matters, it should state the uncertainty rather than make a guess.

---

## 8. Recommended Purchase Outcomes

The product should support the following outcomes.

### Outcome A: Proceed Without Intervention

Used when the available evidence reveals no meaningful concern.

Example:

A user purchases ordinary groceries consistent with their stated needs and purchase history.

**Product behavior:** No interruption.

### Outcome B: Discretionary Purchase Reminder

Used when a purchase is optional but not evidently harmful.

Example:

A user buys a $40 video game and purchase history shows no recent similar purchase.

**Product behavior:** No intervention or a small, nonblocking reminder.

### Outcome C: Clarify Purchase Purpose

Used when missing context could materially change the recommendation.

Example:

A user purchases another pair of running shoes shortly after buying a similar pair.

**Product behavior:** Ask one contextual question and update the recommendation.

### Outcome D: Suggest a Lower-Cost Alternative

Used when the item serves a legitimate need but a cheaper product may adequately satisfy it.

Example:

A user needs basic everyday shoes but is considering an expensive premium model.

**Product behavior:** Show a cheaper potential substitute with a clear explanation of relevant functional differences and supporting evidence.

### Outcome E: Suggest a Cooling-Off Period

Used when multiple signals indicate the purchase may be impulsive or redundant.

Example:

A user adds another pair of expensive headphones shortly after purchasing a similar pair.

**Product behavior:** Explain the concern and offer to save the item for later.

### Outcome F: Illustrate Cart-Level Opportunity Cost

Shown once at the end of the checkout summary, if enabled, using the total supported potential savings across the current cart.

**Product behavior:** Show the total potential savings, time horizon, assumed return, compounding frequency, and inflation basis. Label the result as uncertain and hypothetical; do not use personal account, income, budget, or obligation data. Do not show per-item investment projections.

### Outcome G: User Override

Available for every recommendation.

**Product behavior:** Allow the user to proceed without additional questioning or repeated pressure for the same checkout decision.

---

## 9. Example User Scenarios

### Scenario 1: Redundant Shoe Purchase

**Context:**
- The user purchased $130 running shoes 14 days ago.
- They are considering another $140 pair.
- Their purchase history contains the original purchase, added by the user or recorded through the extension.

**Expected behavior:**
1. Worth It recognizes the new shoes.
2. Need Memory identifies the previous purchase.
3. The product flags potential redundancy.
4. The user receives one question about the purpose of the new pair.
5. The recommendation adapts to the response.
6. The user may continue, review an alternative and manually choose it on the retailer's website, or postpone.

### Scenario 2: Necessary but Expensive Purchase

**Context:**
- The user's shoes are worn out.
- They need a replacement for everyday use.
- They select a premium $140 pair.
- No comparable recent purchase is found.

**Expected behavior:**
1. Worth It recognizes that the purchase may be necessary.
2. The product evaluates whether the premium price is needed for the stated purpose.
3. A lower-cost potential alternative is identified.
4. The product explains relevant differences and cites supporting evidence.
5. The user decides whether the premium is worthwhile.

### Scenario 3: Duplicate Purchase Independent of Personal Finances

**Context:**
- They are considering $250 headphones.
- They purchased similar headphones recently.

**Expected behavior:**
1. Need Memory detects the recent similar purchase.
2. Worth It explains why the purchase may be redundant, while acknowledging the receipt cannot confirm whether the earlier headphones are still owned or usable.
3. It offers a clarification or a gentle suggestion to reconsider or postpone.
4. The assessment does not depend on the user's income or account balances.
5. The user retains full purchasing control.

### Scenario 4: Essential Purchase with a Premium Alternative

**Context:**
- A student needs a laptop for school.
- The purchase is unusual compared with historical spending.
- A lower-cost laptop may meet the stated school requirements.

**Expected behavior:**
1. Worth It recognizes the potential educational necessity.
2. It does not automatically classify the laptop as impulsive because of its price.
3. It compares available alternatives against the stated school requirements and relevant specifications.
4. It explains the price and feature tradeoffs, with evidence where available.
5. The user decides how to proceed; the system does not evaluate personal finances.

### Scenario 5: Discretionary Purchase with No History Concern

**Context:**
- They are considering a $45 hobby-related purchase.
- No redundancy or concerning spending pattern is detected.

**Expected behavior:**
1. Worth It classifies the purchase as discretionary.
2. The item fits the user's stated purpose and no relevant purchase-history concern is detected.
3. No meaningful intervention is triggered.
4. The user continues shopping normally.

### Scenario 6: Mixed Shopping Cart

**Context:**
- The user has groceries, household supplies, headphones, and decorative items in one Walmart cart.

**Expected behavior:**
1. Worth It evaluates each item separately.
2. Essential purchases are not unnecessarily challenged.
3. Potentially redundant or impulsive items receive attention.
4. The combined cart total and the effect of any suggested substitutions are shown.
5. The user receives targeted recommendations rather than a generic warning about the entire cart.

### Scenario 7: Grocery Value, Nutrition, and Purchase Context

**Context:**
- The user is checking out with milk, branded cereal, store-brand cereal, several candy items, and diet soda.
- Available package labels show product sizes, unit prices, nutrition facts, ingredients, and the specific sweetener in the diet soda.
- Purchase history shows a recent receipt for a similar candy purchase, but does not show whether the food was consumed or who used it.

**Expected behavior:**
1. Worth It assesses every cart item for purchase context and applicable evidence. Health prompts appear only for items that meet a defined trigger; routine items receive no health advice.
2. It recommends the store-brand cereal by default, directly states whether label and ingredient data support similarity, and gives the actual price difference. If it costs less, it quantifies the potential savings for the current quantity; it does not require the user to open a separate comparison view.
3. It does not give routine health advice for the milk or cereal. It summarizes the candy label and flags it only if it meets the added-sugar trigger, without assuming the user has a health condition or declaring all candy categorically harmful.
4. For a triggered candy item, it offers a quick, practical suggestion to skip it, choose a smaller amount, or have it less often; accurately explains that too much added sugar over time can contribute to health problems including type 2 diabetes; and states how removing it would reduce the cart total. It cites credible general guidance; for example, the [CDC explains the health risks associated with consuming too much added sugar](https://www.cdc.gov/nutrition/php/data-research/added-sugars.html).
5. It reports the prior similar purchase as history, not proof that the user still has unused candy, and lets the user decide whether it matters.
6. For diet soda, it flags the product only when the named sweetener and applicable evidence meet the health-note criteria. It describes possible gut or glucose effects as mixed or emerging where appropriate. It may mention WHO's conditional recommendation against using non-sugar sweeteners for long-term weight control, while clarifying that this is not evidence that one drink causes metabolic dysfunction or gut disease.
7. Chips may be flagged when reliable product data supports an ultra-processed classification and relevant evidence supports a useful prompt. The product explains that study findings concern ultra-processed diets or dietary patterns, not proof that one bag causes disease, and may suggest skipping or reducing the item while showing the potential cart reduction.
8. Items that do not meet a health trigger receive no health advice; missing or uncertain data must not be used to invent a risk.
9. It presents the item-specific findings and each item's share of the basket where the data is available. The user can keep all items and continue checkout.
10. When purchase history contains comparable grocery purchases, it may estimate the cumulative amount the user might have spent less by choosing the store brand each time, clearly labeling this as hypothetical and explaining whether it uses historical prices or today's price difference applied to recorded quantities. This past-purchase estimate is separate from current-cart potential reduction and is not included in the investment projection.

### Scenario 8: Cart Savings and Long-Term Opportunity Cost

**Context:**
- The current cart contains several items with supported lower-priced alternatives and $5 in total potential savings.

**Expected behavior:**
1. Worth It assesses the item's purpose, price, alternatives, product evidence, and purchase history; it does not request or use personal financial data.
2. The cart summary totals the supported potential reduction from lower-priced alternatives and flagged items the user could remove; potential savings from past purchases are reported separately and excluded from this current-cart total.
3. After the item summaries, if the opportunity-cost feature is enabled, Worth It shows one 40-year hypothetical investment illustration based on the $5 aggregate potential savings, together with the return assumption, compounding frequency, and inflation basis.
4. The illustration states the assumed return and time horizon, makes clear that the result is uncertain, and does not imply that potential savings or investment growth are guaranteed.
5. The user may dismiss the insight and complete the purchase.

---

## 10. Primary Product Interface

### 10.1 Browser Extension

The Chrome extension is the primary user-facing interface.

It should provide:

- Automatic shopping-context awareness.
- Minimal interruption.
- Compact checkout recommendations.
- One-question clarification.
- Clear purchase explanations.
- Lower-cost product suggestions.
- Item and cart price comparisons.
- Optional save-for-later functionality.
- Dismiss and continue actions.
- No automatic cart edits, item substitutions, or purchases; the user makes all changes on the retailer's website.

### 10.1.1 Checkout User Journey

1. As checkout approaches, the shopper sees a short animated recap of only the cart items that merit attention.
2. Each item has been assessed against defined criteria; the recap shows only applicable findings and groups related points into a concise cart-level explanation.
3. The recap explains what Worth It noticed and why. For example, it may show the price difference for a store-brand suggestion or remind the shopper about a similar recent purchase.
4. For a supported health concern, it gives a brief, evidence-based tip. Ordinary items receive no health warning.
4. The recap totals the potential reduction if the shopper follows its suggestions. If enabled, it then shows one hypothetical investment illustration based on that combined amount.
5. The shopper may pause, replay, read captions, review supporting details, skip the recap, or continue checkout. The shopper decides whether to make any changes. The recap is an animated presentation inside the checkout panel, populated with the current review's findings rather than an AI-generated video.

### 10.2 Purchase Insight Panel

The contextual panel should communicate:

**What is happening?**  
The purchase or cart item being evaluated.

**What did Worth It notice?**  
A specific concern such as a recent similar purchase, a price or value difference, or a nutrition-label observation.

**Why does it matter?**  
A short explanation grounded in available evidence.

**What could the user do instead?**  
Continue, clarify purpose, choose a cheaper alternative, or postpone.

The panel should avoid overwhelming users with investment calculations, technical details, or long AI-generated explanations.

### 10.3 Optional Dashboard

A lightweight dashboard may allow users to view:

- Historical purchases.
- Product, dietary, and shopping preferences.
- Saved items.
- Past recommendations.
- Potential or verified savings.
- Investment projection assumptions, when the optional illustration is enabled.

The dashboard is secondary to the checkout experience.

The product should deliver its primary value without requiring users to open the dashboard regularly.

---

## 11. Hackathon MVP Scope

The Hacklanta MVP should make one capability excellent: the pre-checkout cart review and animated recap. Cart recognition, a small set of high-confidence assessment criteria, purchase-history context, supported savings, and clear presentation are parts of this one end-to-end experience, not separate features. Favor a reliable, polished Walmart flow over breadth across retailers or criteria.

### Required MVP Capabilities

1. A functioning Chrome extension on at least one supported shopping flow.
2. Automatic recognition of every product and relevant price in a supported checkout cart, with uncertainty shown for items the extension cannot read reliably.
3. A concise pre-checkout summary of flagged items and meaningful concerns, including material uncertainty when an item could not be assessed reliably; ordinary items with no relevant concern are omitted.
4. User-controlled purchase history using manual records, receipts the user chooses to import, and items the extension records with the user's consent.
5. Automatic purpose/necessity assessment and detection of potentially redundant purchases, while distinguishing food restocking, replacements, and additional items where possible.
6. A single contextual clarification question when missing user context could change an assessment.
7. At least one working, evidence-backed grocery value or nutrition insight based on actual product and label data, showing the store-brand recommendation, its actual price difference, and quantified potential savings when it costs less.
8. A functional, evidence-backed lower-cost alternative recommendation for at least one supported product category.
9. A short, polished animated pre-checkout recap that explains flagged items and potential cart reduction, with captions and controls to pause, replay, skip, or continue checkout.
10. A clear, user-controlled checkout recommendation panel with source details and uncertainty available.

### Optional MVP Capabilities

- Multiple retailer support.
- Multiple product categories for alternatives.
- Save-for-later functionality.
- Personalized learning from user feedback.
- Detailed decision history.
- A spending insights dashboard.
- Return and refund reconciliation.
- Notifications about delayed purchases.
- A long-term investment opportunity-cost illustration with explicit assumptions and uncertainty.

### Out of Scope for the Hackathon

- A complete universal product catalog.
- Compatibility with every online retailer.
- Guaranteed identification of every historical purchase.
- Perfect prediction of impulsive behavior.
- Fully automated purchasing decisions.
- Direct payment processing.
- Credit or lending recommendations.
- A complete personal finance management platform.
- Bank-account connections, personalized financial advice, and personal budget or cash-flow analysis.
- Commercial subscription or monetization functionality.

---

## 12. Hackathon Demonstration Requirements

The product should support a repeatable demonstration that clearly illustrates its intelligence and practical value.

### Demo 1: A Normal Purchase

A user adds an essential product to their cart.

**Expected result:** Worth It recognizes that no meaningful intervention is necessary and does not disrupt checkout.

### Demo 2: A Redundant Purchase

A user selects a product similar to something in their purchase history.

**Expected result:** Worth It identifies the earlier purchase, asks one contextual question, and updates its recommendation.

### Demo 3: A Necessary but Overpriced Purchase

A user selects a premium product for a relatively basic need.

**Expected result:** Worth It identifies a potentially suitable lower-cost alternative and explains the relevant tradeoffs using credible evidence.

### Demo 4: Cart-Level Long-Term Opportunity-Cost Illustration

A user has $5 in total potential savings across supported lower-priced alternatives in the cart.

**Expected result:** At the end of the cart summary, Worth It shows one projection of the aggregate potential savings, with the time horizon, assumed return, compounding frequency, and inflation basis. It does not show a projection for each item and explains that the result is uncertain and depends on the assumptions.

### Demo 5: A Costly Duplicate Purchase

A user considers buying something potentially redundant after a similar recent purchase.

**Expected result:** Worth It explains the relevant purchase-history evidence without using or inferring the user's income, account balances, or ability to pay.

### Demo 6: A Grocery Cart with Value and Nutrition Insights

A user checks out with branded and store-brand groceries, plus multiple candy items.

**Expected result:** Worth It assesses every item, compares the grocery options using available unit price and label evidence, and summarizes any relevant nutrition observation with a source. It does not assume the store brand is equivalent, treat repeat food purchases as proof of redundancy, or tell the user they cannot buy the candy.

### Demo 7: Animated Pre-Checkout Recap

A user has several flagged items, such as a branded grocery with a lower-priced store-brand option and a possible repeat purchase from history.

**Expected result:** Before checkout, Worth It presents a short animated recap populated with the current cart's applicable findings and verified evidence. Related findings are grouped, supported potential cart savings are totaled, and captions and a readable text summary provide the same facts. The shopper can pause, replay, skip, or continue immediately; the recap never modifies the cart. If enabled, one investment illustration appears at the end based on the aggregate potential reduction.

---

## 13. Product Success Criteria

The hackathon MVP should be considered successful when it can demonstrate that:

- A user can shop on a supported website with Worth It active.
- The extension can recognize a proposed purchase.
- Every item in a supported checkout cart receives an internal assessment; the visible checkout summary includes flagged items and material uncertainty, while omitting items with no relevant concern.
- User-controlled purchase history can provide useful item-level context without an account connection.
- The system can identify a genuinely relevant prior purchase.
- A user can receive a targeted clarification question.
- The product differentiates essential purchases from discretionary ones.
- Purchase usefulness, redundancy, product evidence, and value are assessed without personal financial data.
- The product can explain why a purchase deserves reconsideration.
- A lower-cost alternative can be supported by relevant product information and evidence.
- Grocery recommendations prefer an available store-brand version by default and accurately report its price and material product differences.
- At least one grocery value or nutrition observation can be demonstrated from item-level price, package, or label data with a credible source where a health claim is made.
- Purchase concerns are summarized with their evidence and uncertainty, and the long-term investment illustration (if included) states its assumptions and uncertainty.
- The user can accept, dismiss, or override recommendations.
- The main user experience can be demonstrated without relying on unverified claims about model accuracy.

The product should prioritize a complete and convincing end-to-end shopping experience over the total number of implemented features.

---

## 14. Future Product Opportunities

Beyond the initial hackathon MVP, Worth It could eventually support:

- More online retailers.
- More comprehensive itemized receipt extraction.
- Long-term ownership tracking.
- Recognition of product replacements and upgrades.
- Automatic identification of unused or regretted purchases.
- Improved personalization from user feedback.
- Monitoring saved products for meaningful price reductions.
- Better identification of functionally equivalent products.
- Purchase recommendations based on long-term savings priorities.
- Household-level purchase history with user consent.
- More sophisticated behavioral risk modeling.
- Measured reductions in purchase regret and avoidable spending.

These capabilities should not take priority over the hackathon MVP.

---

## 15. Final Product Vision

Worth It should become an intelligent layer between shopping intent and purchasing action.

Rather than simply asking users whether they need something, the product should use available evidence to understand the decision.

It should use purchase history to identify when a user may already own a suitable product, recognize when a purchase appears impulsive, assess whether a less expensive alternative could provide the same practical benefit, and explain the evidence and uncertainty behind each observation.

Most importantly, Worth It should recognize that a good purchasing decision is not defined solely by price or product category.

**The product's ultimate purpose is to help users purchase intentionally: buying what they need, enjoying what they consciously choose, avoiding unnecessary duplication, and not spending more than required to achieve their goals.**

### Product Tagline

**Worth It — Buy what you need. Think before you spend.**

