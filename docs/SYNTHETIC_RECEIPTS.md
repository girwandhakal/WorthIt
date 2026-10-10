# Synthetic receipt emails

**Purpose:** Fictional order receipts the owner sends to their own Gmail account so the hackathon walkthrough exercises the real Gmail import path (search → fetch → local parse → review → save). They are not a demo mode and there is no bundled history seed.

Worth It finds these messages with the Gmail search `subject:"[Worth It Test Receipt]" from:me` within the date range the shopper picks, parses them with the same importer used for real receipts, and saves approved records with the source `synthetic_gmail`, shown in history as **Synthetic test receipt (Gmail)**.

## Generate the emails

```sh
node scripts/synthetic-receipts.mjs
```

The script prints ready-to-send emails whose order dates are relative to today (for example, the tumbler is dated 20 days ago, as in the [acceptance walkthrough](TECH_SPEC.md#hackathon-acceptance-walkthrough)). For each one, compose a new message in Gmail **to yourself**, paste the subject and body exactly, and send it. Nothing is sent by the script.

## Template (v1)

**Subject** must start with the marker:

```
[Worth It Test Receipt] Walmart order WI-TEST-0001
```

**Body** (plain text). Header lines are `Label: value`. The item table is pipe-separated with this exact header row; one item per line.

```
WORTH IT TEST RECEIPT (synthetic, fictional)
Merchant: Walmart
Order number: WI-TEST-0001
Order date: 2026-09-20
Order status: Delivered

Item ID | Item | Qty | Price | Status
18256507800 | Stanley Quencher H2.0 FlowState Tumbler, 30 oz | 1 | $24.97 | Delivered
656700117 | Skittles Original Fruity Candy, Sharing Size, 15.6 oz | 2 | $9.94 | Delivered
```

| Field | Required | Notes |
|---|---|---|
| `Merchant` | yes | e.g. `Walmart` |
| `Order number` | no | Used to deduplicate re-imports |
| `Order date` | no | `YYYY-MM-DD`. If missing, the email's sent date is used |
| `Order status` | no | Default status for items without their own |
| `Item ID` | no | Walmart item ID (`/ip/<ID>`); leave blank if unknown |
| `Item` | yes | Product name |
| `Qty` | no | Whole number; blank marks the record incomplete |
| `Price` | no | Line total (all units), e.g. `$9.94`; blank marks the record incomplete |
| `Status` | no | `Delivered`/`Purchased`, `Canceled`, `Returned`, or `Refunded` |

An HTML body is also supported: a `<table>` whose first row has the same five column headings. If a message has both parts, the plain-text part is parsed first.

## What is kept

Only the parsed fields above, plus the Gmail message ID for provenance. Email bodies, other headers, and attachments are discarded after parsing and are never sent anywhere. A message that does not match the template is listed as **not parsed** in the review step; Worth It never guesses its contents.

## Real Walmart receipts

Parsing real Walmart order emails is best effort. Worth It searches Walmart sender addresses, reads item lines that show a quantity and a price, and reports anything else as not parsed. It is tested only with fictional fixtures that mimic that structure (`tests/fixtures/email/`).
