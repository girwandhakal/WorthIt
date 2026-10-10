import { useId, useState, type FormEvent } from 'react';
import { PURCHASE_STATUS_LABELS, purchaseStatusSchema, type PurchaseInput, type PurchaseStatus } from '../../domain/history';
import { localIsoDate } from '../../shared/dates';
import { parseDollarInput } from './context';

export interface PurchaseFormProps {
  initial?: PurchaseInput;
  today: Date;
  submitLabel: string;
  onSubmit: (input: PurchaseInput) => Promise<void>;
  onCancel?: () => void;
}

/** Add or correct one purchase record. */
export function PurchaseForm({ initial, today, submitLabel, onSubmit, onCancel }: PurchaseFormProps) {
  const id = useId();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [merchant, setMerchant] = useState(initial?.merchant ?? 'Walmart');
  const [purchasedOn, setPurchasedOn] = useState(initial?.purchasedOn ?? localIsoDate(today));
  const [quantity, setQuantity] = useState(initial?.quantity?.toString() ?? '1');
  const [price, setPrice] = useState(initial?.linePriceCents != null ? (initial.linePriceCents / 100).toFixed(2) : '');
  const [status, setStatus] = useState<PurchaseStatus>(initial?.status ?? 'purchased');
  const [itemId, setItemId] = useState(initial?.retailerItemId ?? '');
  const [orderId, setOrderId] = useState(initial?.orderId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsedPrice = parseDollarInput(price);
    const qty = quantity.trim() === '' ? null : Number(quantity);
    if (!title.trim()) return setError('Enter the item name.');
    if (parsedPrice.error) return setError(parsedPrice.error);
    if (qty !== null && (!Number.isInteger(qty) || qty < 1 || qty > 999)) return setError('Quantity must be 1–999.');
    if (itemId.trim() && !/^\d{5,15}$/.test(itemId.trim())) return setError('Item ID should be the number from the product link.');
    setError(null);
    setBusy(true);
    try {
      await onSubmit({
        source: initial?.source ?? 'manual',
        merchant: merchant.trim() || 'Walmart',
        title: title.trim(),
        retailerItemId: itemId.trim() || null,
        orderId: orderId.trim() || null,
        purchasedOn,
        quantity: qty,
        linePriceCents: parsedPrice.cents,
        status,
        description: initial?.description ?? null,
        gmailMessageId: initial?.gmailMessageId ?? null,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? 'Could not save: check the fields and try again.' : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="wi-form" onSubmit={(event) => void submit(event)} aria-label={submitLabel}>
      <label htmlFor={`${id}-title`}>Item name</label>
      <input id={`${id}-title`} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={300} required />

      <div className="wi-form-row">
        <span>
          <label htmlFor={`${id}-merchant`}>Store</label>
          <input id={`${id}-merchant`} value={merchant} onChange={(event) => setMerchant(event.target.value)} maxLength={80} />
        </span>
        <span>
          <label htmlFor={`${id}-date`}>Purchase date</label>
          <input
            id={`${id}-date`}
            type="date"
            value={purchasedOn}
            onChange={(event) => setPurchasedOn(event.target.value)}
            required
          />
        </span>
      </div>

      <div className="wi-form-row">
        <span>
          <label htmlFor={`${id}-qty`}>Quantity</label>
          <input id={`${id}-qty`} inputMode="numeric" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        </span>
        <span>
          <label htmlFor={`${id}-price`}>Total price</label>
          <input
            id={`${id}-price`}
            inputMode="decimal"
            placeholder="e.g. 24.97"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </span>
        <span>
          <label htmlFor={`${id}-status`}>Status</label>
          <select
            id={`${id}-status`}
            value={status}
            onChange={(event) => setStatus(purchaseStatusSchema.parse(event.target.value))}
          >
            {purchaseStatusSchema.options.map((option) => (
              <option key={option} value={option}>
                {PURCHASE_STATUS_LABELS[option]}
              </option>
            ))}
          </select>
        </span>
      </div>

      <div className="wi-form-row">
        <span>
          <label htmlFor={`${id}-item`}>Walmart item ID (optional)</label>
          <input id={`${id}-item`} inputMode="numeric" value={itemId} onChange={(event) => setItemId(event.target.value)} />
        </span>
        <span>
          <label htmlFor={`${id}-order`}>Order number (optional)</label>
          <input id={`${id}-order`} value={orderId} onChange={(event) => setOrderId(event.target.value)} maxLength={80} />
        </span>
      </div>

      {error && (
        <p className="wi-error" role="alert">
          {error}
        </p>
      )}
      <div className="wi-actions">
        <button type="submit" className="wi-button" disabled={busy}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="wi-button-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
