# Worth It demo video script (about 2:45)

Goal: show the real extension on a real Walmart cart. One take of the cart flow, plus a short Gmail/privacy beat.

## Before recording

1. Build and load the extension (`npm run build`, then load `dist/chrome-mv3` in Chrome). Refresh the Walmart tab after loading.
2. Import the synthetic receipts (`node scripts/synthetic-receipts.mjs`, then Settings > Import from Gmail), so the tumbler shows as bought 20 days ago.
3. Fill the cart with the mixed cart from `docs/WALKTHROUGH.md` section 3: Horizon milk, Kraft cheddar, Bounty Essentials, Diet Coke, Stanley tumbler, Squishmallows 5", Skittles.
4. Do one dry run. **The dollar amounts below are examples.** Live prices and label notes change them, so replace them with what your screen shows.
5. Close other tabs, hide bookmarks, set Chrome zoom to 110%, and record at 1080p.

## Script

| Time | On screen | Voiceover |
|---|---|---|
| 0:00 | Title card: logo and "Worth It" | "Checkout is the last moment a purchase is still a choice. Worth It gives you one moment to think twice." |
| 0:12 | Walmart cart page with the 7 items. Slowly scroll the cart. | "This is a normal Walmart cart. Notice that Worth It shows nothing on the page. It stays out of the way while you shop." |
| 0:25 | Move the cursor to Checkout and click. The presentation opens full screen. | "When I click Checkout and there's something worth a second look, Worth It holds that first click once and plays a short presentation. It never clicks anything for me." |
| 0:40 | Highlight 1: the tumbler, with its thumbnail and the question. | "It shows at most three items. First, this tumbler. I bought a similar one 20 days ago, so it asks: is this a replacement, an extra, or a gift?" |
| 0:55 | Highlight 2: Skittles with the added-sugar note. | "Next, Skittles. The label lists added sugar, so it suggests skipping them, having less, or choosing a smaller size. The wording is fixed and cites a health source." |
| 1:10 | Highlight 3: the novelty plush. | "And this plush toy is a novelty item with no practical use, so it says: probably not worth it." |
| 1:22 | Grouped line: "You also had 3 other items..." then the savings meter. | "The rest is grouped. A running meter shows what I would keep: about $38 for this cart." |
| 1:35 | Growth chart animates. | "At the end, one chart: if I invested that saving at an assumed 10 percent for 40 years, it could grow to about $1,750. It's a hypothetical, and Worth It says so on screen." |
| 1:50 | Pause, replay, captions; mention the presentation can't be skipped. Continue unlocks. | "I can pause, replay, and read captions. The presentation can't be skipped, so the pause really happens. Then Continue unlocks." |
| 2:00 | Click "See full analysis", scroll the table, then "Back to highlights". | "If I want the detail, I open the full analysis with every check and source. By default I only see the short version." |
| 2:12 | Go back to the tumbler and answer "Replacing a worn one". Show the new suggestion (Ozark Trail, $12 less) and the new total. | "I'll tell it the tumbler is a replacement. Now it suggests a cheaper store brand instead, and the totals update. Every number comes from code, not from an AI model." |
| 2:25 | Click Continue, then click Checkout again and go straight through. Show the cart unchanged. | "I click Continue, then Checkout, and it goes straight through. My cart is unchanged. Worth It informs. I decide." |
| 2:35 | Settings page: purchase history, "Delete all", permission list. | "History is optional. Gmail is read-only, receipts are parsed on my device, and I approve each record. No bank account and no backend. Everything stays in my browser." |
| 2:48 | End card: logo, "Worth It: think twice before you check out", GitHub URL. | "Worth It. Think twice before you check out." |

## Tips

- Keep the voiceover to one idea per line, and let the animation play in silence for a second or two.
- If the cart review ever shows "couldn't read", refresh the tab and retry. Don't record that take.
- Do not show your real Gmail inbox, tokens, or the OpenAI key field. Show only the synthetic-labeled records.
- If you need a shorter cut (Devpost often recommends 2 to 3 minutes), drop the full-analysis beat (2:00) and the settings beat (2:35).
