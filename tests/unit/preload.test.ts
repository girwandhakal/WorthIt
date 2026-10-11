import { afterEach, describe, expect, it, vi } from 'vitest';
import { reviewCart } from '../../src/background/review-cart';
import { preloadReviewImages } from '../../src/ui/shared/preload';
import { walkthroughSnapshot, tumblerReceipt } from '../helpers/assessment';
import { reviewContext } from '../helpers/background';

describe('preloadReviewImages', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('starts loading the cart images and each highlight’s large image once, before the presentation opens', () => {
    const started: string[] = [];
    class FakeImage {
      decoding = '';
      decode = () => Promise.resolve();
      set src(value: string) {
        started.push(value);
      }
    }
    vi.stubGlobal('Image', FakeImage);
    const review = reviewCart(walkthroughSnapshot(), reviewContext({ history: [tumblerReceipt()] }));
    preloadReviewImages(review);
    // The cart page's own thumbnail (small tiles reuse it) and the large 480px one for the highlight.
    expect(started).toContain('https://i5.walmartimages.com/seo/Stanley-Quencher-H2-0-FlowState-Tumbler-30-oz_fixture.jpeg?odnHeight=480&odnWidth=480&odnBg=FFFFFF');
    expect(started).toContain('https://i5.walmartimages.com/seo/Stanley-Quencher-H2-0-FlowState-Tumbler-30-oz_fixture.jpeg?odnHeight=117&odnWidth=117&odnBg=FFFFFF');
    // Never an image from another host (it was not read), and nothing is requested twice.
    expect(started.some((url) => url.includes('tracker.example.com'))).toBe(false);
    const count = started.length;
    preloadReviewImages(review);
    expect(started).toHaveLength(count);
  });
});
