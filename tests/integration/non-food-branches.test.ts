import { describe, expect, it } from 'vitest';
import { reviewCart } from '../../src/background/review-cart';
import type { ProductFacts } from '../../src/domain/product-facts';
import { assess, line, purchase, snapshot } from '../helpers/assessment';
import { reviewContext } from '../helpers/background';

/**
 * Non-food, beyond the novelty and recent-purchase branches (issue #40):
 *   toy     → flagged, counted in the savings
 *   decor   → soft: "compare Walmart's own lines", or a rethink after a recent purchase; never counted
 *   gadget  → soft: a rethink after a recent purchase (two years for a phone and other high-value gadgets); never counted, no swap
 *   other   → "Nothing to flag", or "Couldn't check" when the category can't be read
 */
const page = (itemId: string, name: string, categoryPath: string[]): ProductFacts => ({ itemId, name, categoryPath, ingredients: null, nutrition: null });
const cartLine = (itemId: string, title: string, cents: number) => line(itemId, { title, linePriceCents: cents });
const assessOne = (cart: ReturnType<typeof snapshot>, facts: ProductFacts, history = [] as ReturnType<typeof purchase>[]) =>
  assess(cart, { facts: { [facts.itemId]: facts }, history }).items[0]!;

const BARBIE = page('101010101', 'Barbie Dream Besties Weekend Getaway Teresa Fashion Doll with 7 Travel Themed Accessories', ['Toys', 'Dolls & Dollhouses', 'Fashion Dolls']);
const PHONE = page('202020202', 'Samsung Galaxy S24 128GB Unlocked Smartphone', ['Electronics', 'Cell Phones', 'Smartphones']);
const CASE = page('303030303', 'Spigen Case for iPhone 15', ['Electronics', 'Cell Phones', 'Cell Phone Accessories']);
const VASE = page('404040404', 'Glass Flower Vase, Clear', ['Home', 'Home Decor', 'Vases']);
const WRENCH = page('505050505', 'Hyper Tough 10-Piece Wrench Set', ['Tools & Hardware', 'Hand Tools', 'Wrenches']);

describe('toys', () => {
  it('a toy is flagged to skip, and counts toward the potential savings', () => {
    const cart = snapshot([cartLine(BARBIE.itemId, BARBIE.name!, 1997)]);
    expect(assessOne(cart, BARBIE).primary).toEqual({ kind: 'skip_toy', amountCents: 1997 });
    const result = reviewCart(cart, reviewContext({ facts: { [BARBIE.itemId]: BARBIE } }));
    expect(result.summary.totals.combinedCents).toBe(1997);
    expect(result.findings[0]!.text).toMatch(/toy.*want than a need/);
  });
});

describe('decor', () => {
  it('suggests comparing with Walmart’s own decor lines, with no amount and nothing added to the savings', () => {
    const cart = snapshot([cartLine(VASE.itemId, VASE.name!, 1299)]);
    expect(assessOne(cart, VASE).primary).toEqual({ kind: 'decor_brand_note', amountCents: null });
    const result = reviewCart(cart, reviewContext({ facts: { [VASE.itemId]: VASE } }));
    expect(result.summary.totals.combinedCents).toBe(0);
    expect(result.findings[0]!.text).toMatch(/Mainstays/);
  });

  it('says nothing about brands when the decor is already a Walmart line', () => {
    const own = page('404040405', 'Mainstays Glass Vase, Clear', VASE.categoryPath);
    expect(assessOne(snapshot([cartLine(own.itemId, own.name!, 599)]), own).primary).toBeNull();
  });

  it('rethinks a similar decor item bought recently, softly and without an amount', () => {
    const cart = snapshot([cartLine(VASE.itemId, VASE.name!, 1299)]);
    const item = assessOne(cart, VASE, [purchase('Glass Flower Vase, Clear', '2026-09-20')]);
    expect(item.primary).toEqual({ kind: 'rethink', amountCents: null });
    expect(item.question).not.toBeNull();
  });
});

describe('gadgets', () => {
  const phoneCart = snapshot([cartLine(PHONE.itemId, PHONE.name!, 79999)]);

  it('says nothing about a gadget with no similar purchase, and never suggests a swap', () => {
    expect(assessOne(phoneCart, PHONE).primary).toBeNull();
  });

  it('asks "do you really need this?" about a phone when one was bought within two years', () => {
    const history = [purchase('Apple iPhone 14 128GB', '2025-04-01')]; // about 18 months before the test date
    const item = assessOne(phoneCart, PHONE, history);
    expect(item.primary).toEqual({ kind: 'rethink', amountCents: null });
    expect(item.question).not.toBeNull();
    const result = reviewCart(phoneCart, reviewContext({ facts: { [PHONE.itemId]: PHONE }, history }));
    expect(result.findings[0]!.text).toMatch(/about 18 months ago/);
    expect(result.summary.totals.combinedCents).toBe(0);
  });

  it('lets a phone bought more than two years ago go', () => {
    expect(assessOne(phoneCart, PHONE, [purchase('Apple iPhone 12 64GB', '2024-06-01')]).primary).toBeNull();
  });

  it('does not count a phone case as a phone, in either direction', () => {
    const caseCart = snapshot([cartLine(CASE.itemId, CASE.name!, 1499)]);
    expect(assessOne(caseCart, CASE, [purchase('Apple iPhone 14 128GB', '2026-09-01')]).primary).toBeNull();
    expect(assessOne(phoneCart, PHONE, [purchase('Spigen Case for iPhone 15', '2026-09-01')]).primary).toBeNull();
  });

  it('keeps the three-month window for a lower-value gadget such as earbuds', () => {
    const buds = page('606060606', 'Skullcandy Dime True Wireless Earbuds', ['Electronics', 'Headphones', 'Earbuds']);
    const cart = snapshot([cartLine(buds.itemId, buds.name!, 2500)]);
    expect(assessOne(cart, buds, [purchase('JLab Go Air Pop Wireless Earbuds', '2026-05-01')]).primary).toBeNull(); // 5 months
    expect(assessOne(cart, buds, [purchase('JLab Go Air Pop Wireless Earbuds', '2026-09-01')]).primary).toEqual({ kind: 'rethink', amountCents: null });
  });
});

describe('everything else', () => {
  it('a plain tool is “nothing to flag”, not silently missing', () => {
    const item = assessOne(snapshot([cartLine(WRENCH.itemId, WRENCH.name!, 1999)]), WRENCH);
    expect(item.primary).toBeNull();
    expect(item.criteria.find((c) => c.criterion === 'purpose')).toMatchObject({ status: 'no_concern', summary: 'Nothing to flag.' });
  });

  it('an item whose category could not be read is “couldn’t check”, not “fine”', () => {
    const blank = page('707070707', 'Mystery Item', []);
    const item = assessOne(snapshot([cartLine(blank.itemId, blank.name!, 999)]), blank);
    expect(item.primary).toBeNull();
    expect(item.criteria.find((c) => c.criterion === 'purpose')?.status).toBe('unknown');
  });
});
