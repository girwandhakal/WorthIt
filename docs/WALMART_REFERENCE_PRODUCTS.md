# Walmart Reference Products

**Purpose:** The bundled product reference data for the hackathon MVP (issue #4 decision). It pairs name-brand products with Walmart store brands so Worth It can suggest a store brand and calculate the price difference.
**Prices last checked:** 2026-10-09 on Walmart.com, online prices for the Atlanta, GA 30303 store (store 3709). Prices vary by location and change often.
**Source:** Walmart.com search results; `ID` is Walmart's item ID from `https://www.walmart.com/ip/<ID>`.
**Used by:** `src/assessment/reference/products.ts` (issue #7), which transcribes these records.

## How Worth It uses this list

- **Name-brand item in the cart:** Worth It reads its price live from the cart page. The store-brand price comes from this list and is shown as a last-checked price with the date above; savings computed from it are labeled as an estimate.
- **Different package sizes:** Compare unit prices. The savings figure is for the same amount as the name-brand package.
- **Store brand not cheaper:** Worth It still names the store brand (PRD PR-07 and PR-16) but never claims savings.
- **Label facts:** "Similar ingredients" claims and the added-sugar rule need label data (ingredients and grams of added sugars per serving). Issue #7 adds those fields to each record from the product page before any such claim ships. Until then, those checks return `unknown`.
- **Added sugar:** Worth It never suggests a food or drink whose label lists added sugar (or whose added sugar is unknown). Pairs where the store brand lists added sugar, which is likely for the cereals, bread, ketchup, peanut butter, and Sam's Cola, get no switch suggestion; the name-brand item gets the added-sugar note instead if its label lists added sugar.
- **Purpose and skip rules:** The purpose column follows the category-to-purpose map in [the technical specification](TECH_SPEC.md#7-assessment-rules-and-calculation-behavior).
- **Walkthrough cart:** Build it on Walmart.com from name-brand items in this list, plus a few store-brand and unpaired items, so the cart shows store-brand suggestions, a no-savings case, a skip suggestion, and items with nothing to flag.
- **Refresh:** Recheck prices and IDs on Walmart.com before the walkthrough and update the date above.

## Name brand vs. Walmart store brand

| Category | Purpose class | Name brand (ID) | Size | Price | Store brand (ID) | Size | Price | Unit price (name vs. store) | Difference |
|---|---|---|---|---:|---|---|---:|---|---|
| Dairy | Essential grocery | Horizon Organic Vitamin D Whole Milk (`10309701`) | 64 fl oz | $5.96 | Great Value Organic Whole Vitamin D Milk (`10315798`) | 64 fl oz | $3.97 | 9.3¢ vs 6.2¢ per fl oz | Store brand saves $1.99 per package |
| Dairy | Essential grocery | Eggland's Best Large White Eggs, 12 ct (`10324125`) | 12 ct | $3.87 | Great Value Large White Eggs, 12 ct (`145051970`) | 12 ct | $1.67 | 32.3¢ vs 13.9¢ per ct | Store brand saves $2.20 per package |
| Dairy | Essential grocery | Kraft Natural Mild Cheddar Finely Shredded (`47088920`) | 8 oz | $2.98 | Great Value Mild Cheddar Finely Shredded (`10452370`) | 8 oz | $1.97 | 37.3¢ vs 24.6¢ per oz | Store brand saves $1.01 per package |
| Dairy | Essential grocery | Land O Lakes Salted Butter Sticks, 4 ct (`10291058`) | 16 oz | $4.46 | Great Value Sweet Cream Salted Butter, 4 sticks (`132893363`) | 16 oz | $3.06 | 27.9¢ vs 19.1¢ per oz | Store brand saves $1.40 per package |
| Bakery | Essential grocery | Wonder Classic White Sandwich Bread (`37858875`) | 20 oz | $2.47 | Great Value White Sandwich Bread (`10315752`) | 20 oz | $1.52 | 12.4¢ vs 7.6¢ per oz | Store brand saves $0.95 per package |
| Cereal | Essential grocery | Cheerios (`10311408`) | 8.9 oz | $2.97 | Great Value Toasted O's (`17238466448`) | 18 oz | $2.47 | 33.4¢ vs 13.7¢ per oz | About $1.75 less for the same 8.9 oz as the name brand (store-brand package costs $0.50 less) <br>_Different package sizes; compare unit price._ |
| Cereal | Essential grocery | Kellogg's Frosted Flakes Original (`5014113090`) | 12 oz | $3.98 | Great Value Frosted Flakes (`264614057`) | 13.5 oz | $1.96 | 33.2¢ vs 14.5¢ per oz | About $2.24 less for the same 12 oz as the name brand (store-brand package costs $2.02 less) <br>_Different package sizes; compare unit price._ |
| Pantry | Essential grocery | Jif Natural Creamy Peanut Butter Spread (`25847552`) | 16 oz | $2.98 | Great Value Natural No Stir Creamy Peanut Butter (`36267321`) | 16 oz | $1.52 | 18.6¢ vs 9.5¢ per oz | Store brand saves $1.46 per package <br>_Both are natural/no-stir style._ |
| Pantry | Essential grocery | Barilla Classic Spaghetti (`10309153`) | 16 oz | $1.88 | Great Value Spaghetti (`10534115`) | 16 oz | $1.24 | 11.8¢ vs 7.8¢ per oz | Store brand saves $0.64 per package |
| Pantry | Essential grocery | Bush's Black Beans (`10306800`) | 15 oz | $1.53 | Great Value Black Beans (`10534038`) | 15 oz | $0.92 | 10.2¢ vs 6.1¢ per oz | Store brand saves $0.61 per package |
| Pantry | Essential grocery | Mahatma Enriched Extra Long Grain White Rice (`15754607`) | 80 oz | $5.57 | Great Value Long Grain Enriched Rice (`10315395`) | 80 oz | $3.52 | 7.0¢ vs 4.4¢ per oz | Store brand saves $2.05 per package |
| Pantry | Essential grocery | Heinz Tomato Ketchup (`15529427`) | 32 oz | $4.78 | Great Value Tomato Ketchup (`172196409`) | 32 oz | $2.17 | 14.9¢ vs 6.8¢ per oz | Store brand saves $2.61 per package |
| Pantry | Essential grocery | Folgers Classic Roast Ground Coffee (`578550306`) | 25.9 oz | $12.96 | Great Value Classic Medium Roast Ground Coffee (`3400314469`) | 40.3 oz | $19.77 | 50.0¢ vs 49.1¢ per oz | About $0.25 less for the same 25.9 oz as the name brand (store-brand package costs $6.81 more) <br>_Unit prices differ by under 5%, so Worth It names the store brand as about the same price and counts no savings._ |
| Beverages | Essential grocery | Tropicana Pure Premium Orange Juice, No Pulp (`5512318310`) | 46 fl oz | $3.88 | Great Value 100% Orange Juice, No Pulp (`403284742`) | 52 fl oz | $3.96 | 8.4¢ vs 7.6¢ per fl oz | About $0.38 less for the same 46 fl oz as the name brand (store-brand package costs $0.08 more) <br>_Store-brand package costs more but its unit price is lower._ |
| Beverages | Discretionary food | Coca-Cola, 2 L (`16618684`) | 67.6 fl oz | $2.97 | Sam's Cola, 2 L (`16785073`) | 67.6 fl oz | $1.10 | 4.4¢ vs 1.6¢ per fl oz | Store brand saves $1.87 per package <br>_Sweetened soft drink._ |
| Beverages | Discretionary food | Diet Coke, 2 L (`15610624`) | 67.6 fl oz | $2.97 | Sam's Cola Diet, 2 L (`16504559`) | 67.6 fl oz | $1.16 | 4.4¢ vs 1.7¢ per fl oz | Store brand saves $1.81 per package <br>_Diet soda; the health note depends on the sweetener named on each label._ |
| Household consumables | Essential household | Bounty Essentials Select-A-Size Paper Towels, 6 double rolls (`5308263928`) | 6 double rolls | $7.97 | Great Value Ultra Strong Paper Towels, 6 double rolls (`3799647206`) | 6 double rolls | $9.92 | $1.23 vs $1.50 per 100 sheets | **Store brand costs more** ($0.27 more per 100 sheets); no savings claim <br>_Walmart lists unit prices per 100 sheets._ |
| Household consumables | Essential household | Dawn Ultra Dish Soap, Original (`1095568875`) | 18 fl oz | $2.94 | Great Value Ultra Original Dish Liquid (`18610204851`) | 18 fl oz | $1.96 | 16.3¢ vs 10.9¢ per fl oz | Store brand saves $0.98 per package |
| Household consumables | Essential household | Glad ForceFlex Tall Kitchen Drawstring Bags, 13 gal, 40 ct (`123015473`) | 40 ct | $10.98 | Great Value Tall Kitchen Drawstring Bags, 13 gal, 40 ct (`344638043`) | 40 ct | $6.48 | 27.5¢ vs 16.2¢ per ct | Store brand saves $4.50 per package <br>_Glad ForceFlex is a stretch bag; note the feature difference._ |
| Clothing basics | Essential if at most $25 and no similar clothing bought in the last 60 days | Hanes Men's Value Pack Crew T-Shirts, 6 pk (`697314670`) | 6 ea | $23.98 | George Men's Crew T-Shirts, 6 pk (`251574590`) | 6 ea | $16.98 | $4.00 vs $2.83 per ea | Store brand saves $7.00 per package <br>_Walmart's apparel store brand is George._ |
| Drinkware | Discretionary, trend premium | Stanley Quencher FlowState Tumbler, 30 oz (`18256507800`) | 1 ea | $24.97 | Ozark Trail Insulated Tumbler with Handle, 30 oz (`14622112422`) | 1 ea | $12.97 | $24.97 vs $12.97 per ea | Store brand saves $12.00 per package <br>_Trend item: suggest the cheaper option, or skip if similar drinkware was bought in the last 90 days. Walmart's store brand is Ozark Trail._ |

## Additional reviewed package variants

The cart adapter reads prices independently of this limited reference list. Purpose, label, and store-brand checks require an exact reviewed item ID; another size or shred style is a separate product, even when its name is similar. Unreviewed items remain unknown.

On 2026-10-10, the live [Kraft Natural Mild Cheddar Shredded Cheese, 16 oz Bag product page](https://www.walmart.com/ip/Kraft-Mild-Cheddar-Shredded-Cheese-16-oz-Bag/43981978) was checked directly. Item `43981978` lists a 16 oz bag, a displayed price of $5.64, 0 g added sugars, and cheddar cheese (pasteurized milk, cheese culture, salt, enzymes, annatto), modified cornstarch, and natamycin. Its milk ingredient is recorded; vegetarian status remains unknown because the enzymes are unspecified. This product's displayed price was checked separately from the Atlanta price table above and never replaces an unreadable cart price.

Its reviewed counterpart is the existing Great Value Mild Cheddar **Finely** Shredded Cheese, **8 oz** (`10452370`), at the last-checked 2026-10-09 reference price of $1.97. Worth It states the package-size and shred-style differences, compares the same 16 oz amount (two 8 oz packages), and makes no similar-ingredients claim because the recorded ingredient lists differ. At a live cart price of $5.64, the estimated difference is $1.70 for the same amount. Shopper settings and the live cart price still determine whether a suggestion is shown.

On 2026-10-10, the live [Hostess Donettes Frightfully Frosted Mini Donuts, 10 oz Bag product page](https://www.walmart.com/ip/16275314128) was checked directly. Item `16275314128` lists a 10 oz snack bag at $2.68 and 17 g **added sugars** per serving in its Nutrition Facts. This exact seasonal variant is recorded as a discretionary snack, with no reviewed store-brand pair. Ingredients, declared allergens, and vegetarian/vegan status are not recorded and remain `null`. The added-sugar rule uses the verified label; the extension never substitutes this published price for an unreadable cart price. This separately checked price does not change the 2026-10-09 dates on the original store-brand table.

## Unpaired items for the walkthrough

| Item (ID) | Price | Category | Purpose class | Expected behavior |
|---|---:|---|---|---|
| Squishmallows FuzzAMallow 5 in plush (`17741466139`) | $3.97 | Toys / collectibles | Discretionary, novelty with no practical use | Skip-eligible: suggest skipping it (no store-brand alternative). |
| Monster 16.4 ft LED Strip Lights (`18110413708`) | $14.88 | Decor | Discretionary | Skip-eligible only if similar decor was bought in the last 90 days. |
| Skittles Original, Sharing Size 15.6 oz (`656700117`) | $4.97 | Candy | Discretionary food | Gets the added-sugar note when its recorded label lists added sugar. |
| Reese's Miniatures, Share Pack 9.6 oz (`17569970321`) | $5.97 | Candy | Discretionary food | Gets the added-sugar note when its recorded label lists added sugar. |

## Label facts (added in issue #7)

`src/assessment/reference/products.ts` records, for each food or drink, the grams of **added sugars** per serving, the declared major **allergens**, whether it is vegetarian/vegan when clear, and the **ingredient list** where Worth It compares labels. Worth It uses these only as follows:

- **Added sugar > 0 g** → the approved added-sugar note; such a product is never suggested as a switch. Grams are never shown to the shopper.
- **"Similar ingredients"** is claimed only when both ingredient lists are recorded and at least 80% overlap. Otherwise the message makes no similarity claim.
- **Allergens / vegetarian / vegan** → a store brand that conflicts with the shopper's settings is flagged and not suggested.
- Anything not recorded is `null` → the related check is `unknown`, never guessed.

| Product (ID) | Added sugars | Allergens | Ingredients recorded |
|---|---|---|---|
| Horizon Organic whole milk (`10309701`) / Great Value organic whole milk (`10315798`) | 0 g / 0 g | milk | yes (organic milk, vitamin D3) |
| Eggland's Best eggs (`10324125`) / Great Value eggs (`145051970`) | 0 g / 0 g | eggs | yes |
| Kraft shredded mild cheddar (`47088920`) / Great Value (`10452370`) | 0 g / 0 g | milk | yes |
| Land O Lakes butter (`10291058`) / Great Value (`132893363`) | 0 g / 0 g | milk | yes |
| Wonder white bread (`37858875`) / Great Value (`10315752`) | 2 g / 2 g | wheat | no |
| Cheerios (`10311408`) / Great Value Toasted O's (`17238466448`) | 2 g / 2 g | not recorded | no |
| Frosted Flakes (`5014113090`) / Great Value (`264614057`) | 12 g / 12 g | not recorded | no |
| Jif Natural (`25847552`) / Great Value Natural (`36267321`) | 2 g / 2 g | peanuts | no |
| Barilla spaghetti (`10309153`) / Great Value (`10534115`) | 0 g / 0 g | wheat | no |
| Bush's black beans (`10306800`) / Great Value (`10534038`) | 0 g / 0 g | none | no |
| Mahatma rice (`15754607`) / Great Value (`10315395`) | 0 g / 0 g | none | no |
| Heinz ketchup (`15529427`) / Great Value (`172196409`) | 4 g / 4 g | none | no |
| Folgers coffee (`578550306`) / Great Value (`3400314469`) | 0 g / 0 g | none | yes (coffee) |
| Tropicana OJ (`5512318310`) / Great Value OJ (`403284742`) | 0 g / 0 g | none | Tropicana only |
| Coca-Cola (`16618684`) / Sam's Cola (`16785073`) | 39 g / 38 g | none | no |
| Diet Coke (`15610624`) / Sam's Cola Diet (`16504559`) | 0 g / 0 g | none | no |
| Skittles (`656700117`) | 34 g | none | no |
| Reese's Miniatures (`17569970321`) | 19 g | milk, peanuts, soy | no |

**Verification status:** these label values were transcribed on 2026-10-10 from the products' published Nutrition Facts, not read from the live Walmart product pages (which block automated access). Like prices, **recheck them on each product page before the walkthrough** and correct `products.ts` if a label differs. Only the zero / non-zero added-sugar distinction affects what the shopper sees.

Paper-towel sizes are recorded as sheet counts derived from Walmart's listed unit prices ($1.23 and $1.50 per 100 sheets), so the comparison matches what Walmart shows.
