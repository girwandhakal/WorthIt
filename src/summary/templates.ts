/**
 * Reviewed advisor wording. Second person, short, ends with a question or one
 * suggested action. `{slot}` placeholders are filled from verified data in
 * code; neither these templates nor any rephrasing ever carry real values.
 *
 * Fixed texts that are never rephrased: the health notes (added sugar and the other
 * label concerns, each with its source), store-brand
 * notes without savings, uncertainty notes, and the investment sentence.
 */

export const TEMPLATES = {
  opening: 'Before you check out, {count_phrase} worth a second thought.',
  opening_uncertain: 'Before you check out, a quick note: Worth It couldn’t read everything in your cart.',

  skip_redundant: 'You bought {what} {when}. Do you need another one? Skipping it would take {amount} off your cart.',
  skip_redundant_no_amount: 'You bought {what} {when}. Do you need another one?',
  skip_redundant_extra: 'You bought {what} {when} and said this one is an extra. Consider skipping it to take {amount} off your cart.',

  skip_novelty: 'This looks like a novelty item with no practical use, so it’s probably not worth it. Consider skipping it to take {amount} off your cart.',
  skip_novelty_no_amount: 'This looks like a novelty item with no practical use, so it’s probably not worth it. Consider skipping it.',

  cheaper_similar: '{alternative} has similar ingredients and costs about {amount} less for the same amount. Try the store brand?',
  cheaper_different: '{alternative} has some ingredient differences but costs about {amount} less for the same amount. Try the store brand?',
  cheaper_food: '{alternative} costs about {amount} less for the same amount. Try the store brand?',
  cheaper_other: '{alternative} is a lower-priced option, about {amount} less. Want to consider it?',

  repeat_question: 'You bought {what} {when}. A past receipt doesn’t show whether you still have it.',
} as const;

export type TemplateKey = keyof typeof TEMPLATES;

/** Templates whose wording may be rephrased by the wording assistant. */
export const PHRASABLE: readonly TemplateKey[] = [
  'opening',
  'skip_redundant',
  'skip_redundant_no_amount',
  'skip_redundant_extra',
  'skip_novelty',
  'skip_novelty_no_amount',
  'cheaper_similar',
  'cheaper_different',
  'cheaper_food',
  'cheaper_other',
  'repeat_question',
];

/** Templates that state an ingredient comparison (rephrasings may mention ingredients only here). */
export const INGREDIENT_CLAIM_TEMPLATES: readonly TemplateKey[] = ['cheaper_similar', 'cheaper_different'];

const SLOT = /\{([a-z_]+)\}/g;

export function slotsIn(text: string): string[] {
  return Array.from(text.matchAll(SLOT), (match) => match[1]!);
}

/** Fills `{slot}` placeholders. Missing slot values are left visible rather than guessed. */
export function fill(text: string, values: Readonly<Record<string, string>>): string {
  return text.replace(SLOT, (whole, name: string) => values[name] ?? whole);
}

export function renderTemplate(key: TemplateKey, values: Readonly<Record<string, string>>): string {
  return fill(TEMPLATES[key], values);
}

export function countPhrase(count: number): string {
  return count === 1 ? '1 thing is' : `${count} things are`;
}
