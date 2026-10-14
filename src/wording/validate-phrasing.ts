import { slotsIn } from './templates';

const MAX_PHRASE_LENGTH = 220;

/** Words a rephrasing may never introduce: judgment, pressure, health or financial claims. */
const BANNED =
  /\b(bad|wrong|stupid|silly|waste|wasteful|irresponsible|must|never|forbidden|shame|guilt|diagnos\w*|disease|diabetes|heart|cancer|obes\w*|unhealthy|healthy|healthier|invest\w*|returns?|guarantee\w*|debt|budget|afford\w*|income|salary|bank)\b/i;

/** Claims allowed only when the reviewed template itself makes an ingredient comparison. */
const COMPARISON_CLAIMS = /ingredient|identical|equivalent|same quality|just as good|better|tastes?|quality/i;

/**
 * Accepts a rephrased sentence only if it keeps exactly the template's slots,
 * adds no numbers, money, URLs, or unsupported claims, and stays short. Any
 * failure returns null so the reviewed template is used instead.
 */
export function validateRephrasing(template: string, candidate: unknown, options: { allowIngredientClaims: boolean }): string | null {
  if (typeof candidate !== 'string') return null;
  const text = candidate.trim();
  if (text.length < 10 || text.length > MAX_PHRASE_LENGTH) return null;
  if (/[\r\n]/.test(text)) return null;
  if (/\d|[$%¢€£]/.test(text.replace(/\{[a-z_]+\}/g, ''))) return null;
  if (/https?:|www\.|\.(com|org|net|gov)\b|@/i.test(text)) return null;
  if (/[<>]/.test(text)) return null;
  if (BANNED.test(text)) return null;
  if (!options.allowIngredientClaims && COMPARISON_CLAIMS.test(text)) return null;
  if (!/[.?!]$/.test(text)) return null;

  const expected = slotsIn(template).sort();
  const actual = slotsIn(text).sort();
  if (expected.length !== actual.length || expected.some((slot, index) => slot !== actual[index])) return null;
  // Stray braces that aren't well-formed slots.
  if ((text.match(/[{}]/g) ?? []).length !== actual.length * 2) return null;
  return text;
}
