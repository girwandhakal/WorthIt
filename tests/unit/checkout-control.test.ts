import { describe, expect, it } from 'vitest';
import { amazonAdapter } from '../../src/adapters/amazon';
import { walmartAdapter } from '../../src/adapters/walmart';

function html(markup: string): Element {
  document.body.innerHTML = markup;
  return document.body.firstElementChild!;
}

describe('recognizing the retailer’s checkout control', () => {
  it.each([
    '<button>Continue to checkout</button>',
    '<button>Check out</button>',
    '<button aria-label="Checkout"><span>Go</span></button>',
    '<a href="/checkout">Proceed to checkout</a>',
    '<button data-automation-id="checkout"><span>Anything</span></button>',
  ])('Walmart: %s', (markup) => {
    const element = html(markup);
    const inner = element.querySelector('span') ?? element;
    expect(walmartAdapter.isCheckoutControl!(inner)).toBe(true);
    expect(walmartAdapter.isCheckoutControl!(element)).toBe(true);
  });

  it.each([
    '<button>Remove</button>',
    '<button>Save for later</button>',
    '<button>Increase quantity</button>',
    '<a href="/ip/123">Checkout the new arrivals and our long list of seasonal products today</a>',
    '<div>Continue to checkout</div>',
    '<worth-it-panel><button>Continue</button></worth-it-panel>',
  ])('Walmart ignores: %s', (markup) => {
    const element = html(markup);
    expect(walmartAdapter.isCheckoutControl!(element.querySelector('button') ?? element)).toBe(false);
  });

  it('Amazon: the proceed-to-checkout submit button', () => {
    const element = html('<input type="submit" value="Proceed to checkout">');
    expect(amazonAdapter.isCheckoutControl!(element)).toBe(true);
    expect(amazonAdapter.isCheckoutControl!(html('<input type="submit" name="proceedToRetailCheckout" value="Go">'))).toBe(true);
    expect(amazonAdapter.isCheckoutControl!(html('<input type="submit" value="Delete">'))).toBe(false);
  });
});
