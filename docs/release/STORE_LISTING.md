# Chrome Web Store listing (draft)

## Basics

- **Name:** Worth It
- **Short description (≤132 chars):** Before you check out, Worth It points out a few cart items worth a second thought. You stay in control of your cart.
- **Category:** Shopping
- **Language:** English (United States)

## Detailed description

Worth It is a pre-checkout advisor for Walmart and Amazon carts. When you open your cart, it reviews every item and, only if something deserves a second look, shows a short recap:

- a lower-priced store brand, with the actual price difference;
- something similar you bought recently (from purchase history you control), with one quick question;
- items whose labels list added sugar, with a short CDC-cited note;
- one hypothetical illustration of what the cart's total potential savings could grow to (you can turn it off).

Ordinary carts see nothing at all. Worth It never adds, removes, or replaces items, never clicks checkout, and never connects to bank or retailer accounts. Purchase history stays on your device; Gmail import is optional and read-only.

## Single purpose

Help shoppers reconsider items in their online shopping cart before checkout by showing evidence-based suggestions, without changing the cart.

## Permission justifications

| Permission | Justification |
|---|---|
| `https://www.walmart.com/*`, `https://www.amazon.com/*` | Read cart line names, links, quantities, and prices on the cart page to show the review; with the user's opt-in, read item rows on order pages to record purchases. Inert on all other pages, including checkout. |
| `storage` | Store preferences and per-tab panel state locally. |
| `identity` | Optional, user-initiated Gmail connection to import order receipts. |
| `https://gmail.googleapis.com/*` | Search and read likely order emails after the user connects Gmail; parsed locally. |
| Wording service origin (proxy) | Phrase the recap from placeholder templates; no personal data sent. |
| OAuth scope `gmail.readonly` | Read-only access to find receipts the user chooses to import. Worth It never sends, modifies, or deletes email. |

Not requested: tabs, history, cookies, webRequest, downloads, all-sites access. No remote code.

## Privacy practices form (data collected)

| Category | Collected? | Notes |
|---|---|---|
| Personally identifiable information | No | |
| Health information | Only user-entered allergies/dietary preferences, stored locally | Used only to flag conflicts with suggested products; never transmitted |
| Financial and payment information | No | |
| Authentication information | No | Chrome manages the Gmail OAuth token |
| Personal communications | Emails are read locally only to extract order details the user approves | Bodies not stored or transmitted |
| Location | No | |
| Web history | No | |
| User activity | Cart contents and approved purchase records, stored locally | |
| Website content | Cart and (opt-in) order item rows, processed locally | |

Certifications to make: data is not sold to third parties; not used or transferred for purposes unrelated to the single purpose; not used to determine creditworthiness or for lending.

## Assets to prepare

- 128×128 icon (`public/icon/128.png`), 1280×800 screenshots of: the recap, the static view with "Why?", full analysis, settings history, Gmail review step.
- 440×280 small promotional tile.
- Privacy policy URL (host [PRIVACY_POLICY.md](PRIVACY_POLICY.md) after owner edits) and support contact.
