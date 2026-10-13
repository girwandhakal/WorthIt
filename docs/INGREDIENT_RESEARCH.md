# Ingredient matching: research notes

What the label matching in `src/assessment/rules/food-quality.ts` is based on, and where the evidence is thinner. Matching is literal text on the product's own ingredient list; no AI model is involved. A new concern still needs owner approval and a verified source (AGENTS.md); this list only widens what each approved concern recognizes.

## Confirmed in the sources

- **Ultra-processed (NOVA group 4).** Monteiro et al., *Public Health Nutrition* 2019 ([paper](https://doi.org/10.1017/S1368980018003762)): a product is ultra-processed if its ingredients include at least one marker. Substances rarely used in cooking: fructose, high-fructose corn syrup, fruit juice concentrates, invert sugar, maltodextrin, dextrose, lactose; hydrogenated or interesterified oils; hydrolysed proteins, soya protein isolate, gluten, casein, whey protein, mechanically separated meat; soluble or insoluble fibre. Cosmetic additives: flavours, flavour enhancers (for example MSG), colours (for example caramel colour), emulsifiers (for example soya lecithin), emulsifying salts, sweeteners, thickeners, and anti-foaming, bulking, carbonating, foaming, gelling, and glazing agents. All of these are matched.
- **Non-sugar sweeteners.** WHO 2023 guideline: acesulfame K, aspartame, advantame, cyclamates, neotame, saccharin, sucralose, stevia and stevia derivatives. Low-calorie sugars and sugar alcohols (polyols) are outside it, so they are not flagged.
- **Synthetic dyes.** OEHHA 2021 assessed seven of the nine FDA-certified food dyes (Blue 1, Blue 2, Green 3, Red 3, Red 40, Yellow 5, Yellow 6). Citrus Red 2 and Orange B (narrow approved uses) are not part of that assessment, so they count only as a NOVA color additive, not as a dye concern.
- **Processed meat.** IARC defines it as meat transformed by salting, curing, fermentation, smoking, or other processes; examples include ham, sausages, corned beef, jerky, and bacon. Celery and similar vegetable powders supply nitrate that becomes nitrite, so products labeled “uncured” are chemically cured.

## Judgment calls (flag if you disagree)

- **Monk fruit and allulose** are not flagged (owner decision). The WHO guideline names stevia but no source we found names monk fruit, and whether the WHO counts allulose as a sugar was not settled.
- **Natural colors** (annatto, turmeric, beet, paprika) are not flagged even though NOVA lists colours as cosmetic additives, because they are everyday in cheese and similar foods. Same reasoning as modified starch.
- **Pectin, gelatin, agar, powdered cellulose, vanilla extract, and juice “from concentrate”** are not flagged: ordinary kitchen ingredients or anti-caking agents.
- **Celery powder** only counts for cured-meat kinds of product, so it is not read as a cure in soup or broth.
- **Added sugar** is still judged only from the label's “Added Sugars” grams. We do not infer it from ingredient names (no official FDA list of names was found).

## Ideas that need owner approval and a verified source first

Preservatives (BHA, BHT, TBHQ, sodium benzoate), potassium bromate, azodicarbonamide, brominated vegetable oil, and added sugar by ingredient name. None are matched today.
