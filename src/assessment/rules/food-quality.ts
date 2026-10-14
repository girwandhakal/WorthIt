import { ADDED_SUGAR_NOTE, type SourceId } from '../evidence/sources';

/**
 * The food branch of the decision tree. Pure and deterministic: it reads only
 * the product's own ingredient statement and Nutrition Facts, never its title
 * or a guess. No flagged marker means no comment (a whole or minimally
 * processed food); a missing label means unknown, never a concern.
 *
 *   food ─┬─ nothing flagged ............ no comment
 *         └─ flagged ─ added sugar, processed meat, trans fat, non-sugar
 *                      sweetener, high sodium, synthetic dye, or an
 *                      ultra-processed ingredient ─► say what's of concern,
 *                      with a fixed, vetted source.
 */

export type FoodConcernId =
  | 'added_sugar'
  | 'processed_meat'
  | 'trans_fat'
  | 'sweetener'
  | 'high_sodium'
  | 'dyes'
  | 'ultra_processed';

/** Presentation priority when one item has several concerns (the first leads). */
const CONCERN_ORDER: readonly FoodConcernId[] = [
  'added_sugar',
  'processed_meat',
  'trans_fat',
  'sweetener',
  'high_sodium',
  'dyes',
  'ultra_processed',
];

/**
 * How glaring each concern is, for what the presentation says first. Added sugar is the mildest: when something
 * more glaring is on the label, that ingredient leads and added sugar follows. (CONCERN_ORDER above is the order
 * the full analysis lists them in.)
 */
const GLARE_ORDER: readonly FoodConcernId[] = [
  'trans_fat',
  'processed_meat',
  'sweetener',
  'dyes',
  'ultra_processed',
  'high_sodium',
  'added_sugar',
];

/** Sodium per serving at or above this is "high" (FDA's 20%-of-Daily-Value line; the percentage itself is never quoted). */
const HIGH_SODIUM_MG = 460;

export interface FoodInputs {
  ingredients: string | null;
  addedSugarG: number | null;
  sodiumMg: number | null;
  transFatG: number | null;
  /** Category path and name, lowercase, used only to recognize meat for the cured-meat check. */
  context: string;
}

export interface FoodConcern {
  id: FoodConcernId;
  /** The specific thing found, e.g. "aspartame" or "Red 40, Yellow 5". */
  detail: string;
}

interface Pattern {
  name: string;
  test: RegExp;
}

const SWEETENERS: Pattern[] = [
  { name: 'aspartame', test: /\baspartame\b|\be951\b/ },
  { name: 'sucralose', test: /\bsucralose\b|\be955\b/ },
  { name: 'acesulfame potassium', test: /\bacesulfame\b|\bace[- ]?k\b|\be950\b/ },
  { name: 'saccharin', test: /\bsaccharin\b|\be954\b/ },
  { name: 'neotame', test: /\bneotame\b|\be961\b/ },
  { name: 'advantame', test: /\badvantame\b|\be969\b/ },
  { name: 'cyclamate', test: /\bcyclamates?\b|\be952\b/ },
  { name: 'stevia (steviol glycosides)', test: /\bsteviol\b|\bstevia\b|\brebaudioside\b|\breb[- ]?[am]\b|\be960\b/ },
];

const DYES: Pattern[] = [
  // The seven FD&C dyes in OEHHA's 2021 assessment, by number, chemical name, or E-number.
  { name: 'Red 40', test: /\b(red|fd&c red)\s*(no\.?\s*)?#?40\b(?!\s*%)|\ballura red\b|\be129\b/ },
  { name: 'Red 3', test: /\b(red|fd&c red)\s*(no\.?\s*)?#?3\b(?!\s*%)|\berythrosine\b|\be127\b/ },
  { name: 'Yellow 5', test: /\b(yellow|fd&c yellow)\s*(no\.?\s*)?#?5\b(?!\s*%)|\btartrazine\b|\be102\b/ },
  { name: 'Yellow 6', test: /\b(yellow|fd&c yellow)\s*(no\.?\s*)?#?6\b(?!\s*%)|\bsunset yellow\b|\be110\b/ },
  { name: 'Blue 1', test: /\b(blue|fd&c blue)\s*(no\.?\s*)?#?1\b(?!\s*%)|\bbrilliant blue\b|\be133\b/ },
  { name: 'Blue 2', test: /\b(blue|fd&c blue)\s*(no\.?\s*)?#?2\b(?!\s*%)|\bindigotine\b|\bindigo carmine\b|\be132\b/ },
  { name: 'Green 3', test: /\b(green|fd&c green)\s*(no\.?\s*)?#?3\b(?!\s*%)|\bfast green\b|\be143\b/ },
  { name: 'artificial color', test: /\bartificial colou?rs?\b/ },
];

/** Industrial ingredients and cosmetic additives that mark a product as ultra-processed (NOVA group 4). */
const ULTRA_PROCESSED_MARKERS: Pattern[] = [
  { name: 'high-fructose corn syrup', test: /high[- ]fructose corn syrup|glucose[- ]fructose syrup/ },
  { name: 'corn syrup', test: /\bcorn syrup\b|\bglucose syrup\b/ },
  { name: 'dextrose or maltodextrin', test: /\bdextrose\b|\bmaltodextrin\b|\bdextrin\b/ },
  { name: 'flavorings', test: /\bflavou?rs?\b|\bflavou?rings?\b/ },
  {
    name: 'emulsifiers',
    test: /\bmono(?:glycerides?)?-?\s*(?:and|&)\s*diglycerides?\b|\b(?:mono|di)glycerides?\b|\bpolysorbate\b|\blecithin\b|\bdatem\b|\bstearoyl lactylate\b|\bpolyglycerol\b|\bsucrose (?:esters?|polyesters?)\b|\bsorbitan\b|\bpropylene glycol (?:mono|di)?esters?\b|\bammonium phosphatides?\b|\bglyceryl\b|\b(?:sodium|calcium) stearoyl\b|\bmono-? ?and ?di-?acetyl\b/,
  },
  {
    name: 'gums and thickeners',
    test: /\b(?:xanthan|guar|gellan|cellulose|locust bean|acacia|tara|cassia|konjac|karaya|ghatti)\s+gum\b|\bgum (?:arabic|acacia)\b|\bcarrageenan\b|\bcarboxymethylcellulose\b|\bmethylcellulose\b|\bmicrocrystalline cellulose\b|\b(?:sodium |propylene glycol )?alginate\b|\bkonjac\b/,
  },
  { name: 'hydrolyzed protein', test: /\bhydrolyzed\b|\bhydrolysed\b|\bprotein isolate\b|\btextured (vegetable|soy) protein\b/ },
  { name: 'hydrogenated oil', test: /(?<!non[- ])\bhydrogenated\b|\binteresterified\b/ },
  { name: 'caramel color', test: /\bcaramel colou?r\b/ },
  // The other NOVA group-4 markers named by Monteiro et al. 2019: sugars, proteins, and fibers rarely used in a home kitchen...
  { name: 'fructose', test: /(?<!high[- ])(?<!glucose[- ])\bfructose\b(?! (?:corn )?syrup)/ },
  { name: 'fruit juice concentrate', test: /\b(?:fruit|vegetable) juice concentrates?\b|\bconcentrated (?:fruit|vegetable) juices?\b/ },
  { name: 'invert sugar', test: /\binvert (?:sugar|syrup)\b/ },
  { name: 'lactose', test: /\blactose\b(?![- ]free)/ },
  { name: 'casein or whey protein', test: /\bcasein(?:ate)?s?\b|\bwhey protein\b|\bmilk protein (?:concentrate|isolate)\b/ },
  { name: 'protein concentrate', test: /\bprotein concentrates?\b/ },
  { name: 'added gluten', test: /\b(?:vital|wheat|corn) gluten\b/ },
  { name: 'mechanically separated meat', test: /\bmechanically (?:separated|deboned)\b/ },
  { name: 'added fiber', test: /\b(?:soluble|insoluble|corn|oat|pea|wheat|citrus|potato|chicory(?: root)?|bamboo) fib(?:er|re)s?\b|\bpolydextrose\b|\binulin\b/ },
  // ...and the cosmetic additives: flavor enhancers, emulsifying salts, glazing and anti-foaming agents, and colors.
  { name: 'flavor enhancers', test: /\bmonosodium glutamate\b|\bmsg\b|\bdisodium (?:inosinate|guanylate|5'?-?ribonucleotides?)\b|\bribonucleotides\b/ },
  { name: 'phosphate salts', test: /\b(?:mono|di|tri|tetra)?(?:sodium|potassium) (?:acid |aluminum |aluminium )?(?:pyro|hexameta|tripoly|poly)?phosphates?\b/ },
  { name: 'glazes and anti-foaming agents', test: /\bconfectioner[’']?s? glaze\b|\bshellac\b|\bcarnauba wax\b|\bglazing agents?\b|\b(?:poly)?dimethylsiloxane\b|\bsimethicone\b|\bquillaja\b/ },
  { name: 'color additives', test: /\bcitrus red\b|\bfd&c orange b\b|\borange b\b(?! vitamin)|\btitanium dioxide\b/ },
];

/**
 * Ingredients worth pointing out that are not, on their own, a concern: they are shown on the item
 * (and in the full analysis) but never count as a concern, never change a suggestion or the savings,
 * and never stop a store-brand switch. Modified starch is an industrial ingredient and one NOVA marker,
 * but it is also an everyday anti-caking or thickening agent (for example in shredded cheese).
 */
const WATCH_INGREDIENTS: Pattern[] = [{ name: 'modified starch', test: /\bmodified \w*\s?starch\b/ }];

/** Names of the "worth noting" ingredients found in an ingredient list. Never a concern. */
export function foodWatchNotes(ingredients: string | null): string[] {
  const text = (ingredients ?? '').toLowerCase().replace(/\s+/g, ' ');
  return text ? matches(WATCH_INGREDIENTS, text) : [];
}

const MEAT_WORDS =
  /\b(beef|pork|lamb|veal|bacon|ham|sausages?|salami|pepperoni|hot dogs?|franks?|frankfurters?|wieners?|bologna|mortadella|prosciutto|pancetta|pastrami|corned beef|kielbasa|bratwurst|brats?|chorizo|capicola|andouille|turkey|chicken|jerky|deli|lunch ?meat|luncheon meat|cold cuts|meat)\b/;
const CURING = /\b(sodium|potassium) (nitrite|nitrate)\b|\bcuring salts?\b|\bprague powder\b/;
/** "Uncured" meats are cured with celery or similar vegetable powders that supply the same nitrite. */
const NATURAL_NITRITE = /\b(?:cultured )?celery (?:powder|juice(?: powder)?|extract|salt)\b|\bcultured celery\b|\bbeet(?:root)? juice powder\b|\bswiss chard powder\b/;
/** Only products that are cured meats by kind, so celery powder in a chicken soup is not read as a cure. */
const CURED_MEAT_WORDS =
  /\b(bacon|ham|sausages?|salami|pepperoni|hot dogs?|franks?|frankfurters?|wieners?|bologna|mortadella|prosciutto|pancetta|pastrami|corned beef|kielbasa|bratwurst|brats?|chorizo|capicola|andouille|jerky|deli|lunch ?meat|luncheon meat|cold cuts)\b/;

const matches = (patterns: readonly Pattern[], text: string): string[] => patterns.filter((p) => p.test.test(text)).map((p) => p.name);

/**
 * Applies the decision tree to a food's label. Returns concerns in
 * presentation order; an empty list means "no comment".
 */
export function evaluateFood(inputs: FoodInputs): FoodConcern[] {
  const text = (inputs.ingredients ?? '').toLowerCase().replace(/\s+/g, ' ');
  const found: FoodConcern[] = [];
  const add = (id: FoodConcernId, detail: string) => found.push({ id, detail });

  if (inputs.addedSugarG !== null && inputs.addedSugarG > 0) add('added_sugar', 'listed on the label');

  const curing = text ? CURING.exec(text) : null;
  const natural = text ? NATURAL_NITRITE.exec(text) : null;
  if (curing && MEAT_WORDS.test(`${text} ${inputs.context}`)) add('processed_meat', curing[0]);
  else if (natural && CURED_MEAT_WORDS.test(`${text} ${inputs.context}`.toLowerCase())) add('processed_meat', `${natural[0]}, a natural nitrite source`);

  if (/partially hydrogenated/.test(text)) add('trans_fat', 'partially hydrogenated oil');
  else if (inputs.transFatG !== null && inputs.transFatG > 0) add('trans_fat', `${inputs.transFatG} g of trans fat per serving`);

  const sweeteners = matches(SWEETENERS, text);
  if (sweeteners.length > 0) add('sweetener', sweeteners.join(', '));

  if (inputs.sodiumMg !== null && inputs.sodiumMg >= HIGH_SODIUM_MG) add('high_sodium', `${Math.round(inputs.sodiumMg)} mg`);

  const dyes = matches(DYES, text);
  if (dyes.length > 0) add('dyes', dyes.join(', '));

  const markers = matches(ULTRA_PROCESSED_MARKERS, text);
  // Non-sugar sweeteners and synthetic dyes are themselves ultra-processed markers.
  const all = [...markers, ...(sweeteners.length > 0 ? ['non-sugar sweeteners'] : []), ...(dyes.length > 0 ? ['synthetic colors'] : [])];
  if (all.length > 0) add('ultra_processed', all.slice(0, 4).join(', '));

  return found.sort((a, b) => CONCERN_ORDER.indexOf(a.id) - CONCERN_ORDER.indexOf(b.id));
}

/** Only partially hydrogenated oil is artificial trans fat; a label amount can also be natural (dairy, meat). */
const isArtificialTransFat = (detail: string): boolean => detail.startsWith('partially hydrogenated');

export interface ConcernInfo {
  /** Short label for the "Why?" evidence row. */
  label: string;
  /** Fixed advisor wording. Only label-derived values are filled in, in code. */
  note: (detail: string) => string;
  /**
   * The same wording cut to 2 or 3 short points, for the timed presentation
   * (the full note stays for screen readers, the static view, and "Why?").
   * Each point stays within what the note and its source say.
   */
  points: (detail: string) => string[];
  /** One-sentence summary of the evidence, shown behind "Why?". */
  guidance: string;
  source: SourceId;
  /** A second source for the same claim, when one is needed. */
  alsoSource?: SourceId;
}

/**
 * Fixed, reviewed wording and one vetted source per concern. Nothing here is
 * generated at runtime, and each claim is limited to what its source supports.
 */
export const CONCERN_INFO: Record<FoodConcernId, ConcernInfo> = {
  added_sugar: {
    label: 'Added sugars',
    note: () => ADDED_SUGAR_NOTE,
    points: () => ['Has added sugar', 'Too much over time is linked to type 2 diabetes and heart disease', 'Skip it, buy less, or have it less often'],
    guidance: 'Too much added sugar over time is linked to health problems, including type 2 diabetes and heart disease.',
    source: 'cdc_added_sugars',
  },
  processed_meat: {
    label: 'Cured, processed meat',
    note: (detail) =>
      `This is a cured, processed meat (it lists ${detail}). The WHO’s cancer agency (IARC) classifies processed meat as carcinogenic to humans, and the risk rises with how much is eaten. Consider having it less often.`,
    points: (detail) => [`Cured, processed meat (${detail})`, 'IARC: carcinogenic to humans; risk rises with how much', 'Have it less often'],
    guidance: 'IARC classifies processed meat as carcinogenic to humans (Group 1); the risk increases with the amount eaten.',
    source: 'iarc_processed_meat',
  },
  trans_fat: {
    label: 'Trans fat',
    note: (detail) =>
      `${isArtificialTransFat(detail) ? `This lists ${detail}, a source of artificial trans fat.` : `This has ${detail}.`} The FDA says trans fat raises LDL (“bad”) cholesterol, which increases the risk of heart disease. Consider skipping it.`,
    points: (detail) => [isArtificialTransFat(detail) ? `Artificial trans fat (${detail})` : `Trans fat (${detail})`, 'FDA: raises LDL cholesterol and heart-disease risk', 'Consider skipping it'],
    guidance: 'The FDA says trans fat raises LDL cholesterol, increasing the risk of heart disease, and decided in 2015 that partially hydrogenated oils are no longer generally recognized as safe.',
    source: 'fda_trans_fat',
  },
  sweetener: {
    label: 'Non-sugar sweetener',
    note: (detail) =>
      `This has ${detail}, a non-sugar sweetener. The WHO advises against using these to control weight, and long-term use may be linked to a higher risk of type 2 diabetes and heart disease (a conditional recommendation). Consider a version without it or having it less often.`,
    points: (detail) => [`Non-sugar sweetener (${detail})`, 'WHO advises against these for weight control', 'Try a version without it'],
    guidance:
      'WHO’s 2023 guideline conditionally recommends against non-sugar sweeteners for weight control and notes possible harms from long-term use. It is not a safety finding for any single drink.',
    source: 'who_nss',
  },
  high_sodium: {
    label: 'Sodium',
    note: (detail) =>
      `One serving has ${detail} of sodium, which is high. The CDC advises keeping sodium under 2,300 mg a day, because too much raises blood pressure and the risk of stroke and heart disease. Consider a lower-sodium option or having it less often.`,
    points: (detail) => [`${detail} of sodium per serving`, 'CDC: keep it under 2,300 mg a day', 'Try a lower-sodium option'],
    guidance: 'The CDC says excess sodium raises blood pressure, which increases the risk of stroke and coronary heart disease; the limit is under 2,300 mg a day.',
    source: 'cdc_sodium',
  },
  dyes: {
    label: 'Synthetic food dyes',
    note: (detail) =>
      `This has synthetic food dye (${detail}). California’s health-hazard office concluded in 2021 that synthetic food dyes can affect behavior, such as hyperactivity, in some children. Consider a version without them.`,
    points: (detail) => [`Synthetic food dye (${detail})`, 'Can affect behavior in some children', 'Try a version without it'],
    guidance: 'OEHHA’s 2021 assessment found synthetic food dyes can cause hyperactivity and other neurobehavioral effects in some children; children vary in sensitivity.',
    source: 'oehha_dyes',
  },
  ultra_processed: {
    label: 'Ultra-processed ingredients',
    note: (detail) =>
      `Its ingredient list includes ${detail}, which mark a food as ultra-processed. In a controlled NIH trial, people on an ultra-processed diet ate about 500 more calories a day and gained weight. That study is about a whole diet, not one item. Consider having it less often.`,
    points: (detail) => [`Ultra-processed: ${detail}`, 'NIH trial: an ultra-processed diet meant ~500 more calories a day', 'Have it less often'],
    guidance:
      'In a 20-person inpatient trial, an ultra-processed diet led to about 500 more calories a day and weight gain over two weeks. It shows a dietary pattern, not that one item causes harm. Ultra-processed is identified by ingredients using the NOVA system.',
    source: 'hall_upf',
    alsoSource: 'monteiro_nova',
  },
};

/** Concerns sorted most glaring first. */
export function byGlare<T extends { id: FoodConcernId }>(concerns: readonly T[]): T[] {
  return [...concerns].sort((a, b) => GLARE_ORDER.indexOf(a.id) - GLARE_ORDER.indexOf(b.id));
}

/**
 * Every concern on a food as short points for the presentation, most glaring first. One concern keeps its three
 * points (what, why, what to do). Several give one point each, naming the ingredient (at most three), then the
 * action for the most glaring one, so a food with high-fructose corn syrup does not just say "added sugar".
 */
export function concernPoints(concerns: readonly FoodConcern[]): string[] {
  const ranked = byGlare(concerns);
  if (ranked.length === 0) return [];
  if (ranked.length === 1) return CONCERN_INFO[ranked[0]!.id].points(ranked[0]!.detail);
  const headlines = ranked.slice(0, 3).map((concern) => CONCERN_INFO[concern.id].points(concern.detail)[0]!);
  const lead = CONCERN_INFO[ranked[0]!.id].points(ranked[0]!.detail);
  return [...headlines, lead[lead.length - 1]!];
}

/** The reviewed note for every concern, most glaring first, as one text. */
export function concernNotes(concerns: readonly FoodConcern[]): string {
  return byGlare(concerns)
    .map((concern) => CONCERN_INFO[concern.id].note(concern.detail))
    .join(' ');
}
