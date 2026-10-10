import { browser } from 'wxt/browser';

export function App() {
  return (
    <main className="wi-page wi-popup">
      <h1>Worth It</h1>
      <p>
        Worth It reviews your Walmart cart when you open the cart page and highlights a few items worth a second
        thought. It never changes your cart.
      </p>
      <button type="button" className="wi-button" onClick={() => void browser.runtime.openOptionsPage()}>
        Open settings
      </button>
    </main>
  );
}
