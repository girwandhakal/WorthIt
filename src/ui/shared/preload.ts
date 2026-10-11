import type { CartReview } from '../../domain/review';
import { sizedImage } from '../checkout/verdict';

/** Image requests already started, so a review that is re-sent does not ask again. */
const requested = new Set<string>();
/** Held until each image is decoded, so it isn't dropped before it has loaded. */
const inFlight = new Set<HTMLImageElement>();

/**
 * Starts loading (and decoding) the thumbnails the presentation will show, as soon as the review is
 * ready, so they are in the browser's cache when the checkout click opens it. The small tiles reuse the
 * cart page's own image, and each highlight's large one is fetched here.
 */
export function preloadReviewImages(review: CartReview): void {
  if (typeof Image === 'undefined') return;
  const urls = [
    ...review.summary.highlights.map((finding) => sizedImage(finding.imageUrl, 480)),
    ...review.assessment.items.map((item) => sizedImage(item.imageUrl, null)),
  ];
  for (const url of urls) {
    if (!url || requested.has(url)) continue;
    requested.add(url);
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    inFlight.add(image);
    const done = () => void inFlight.delete(image);
    if (typeof image.decode === 'function') image.decode().then(done, done);
    else done();
  }
}
