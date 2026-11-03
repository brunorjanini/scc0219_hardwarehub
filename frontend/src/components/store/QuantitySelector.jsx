import "./QuantitySelector.css";
import { Minus, Plus } from "lucide-react";

// Quantity input with − / + buttons, limited to [1, max].
// Controlled: the parent keeps `value` and receives integers in onChange.
// `itemName` is added to the labels for screen readers when several
// selectors share a page (cart lines).
export default function QuantitySelector({ value, max, onChange, id = "quantity", itemName, disabled = false }) {
  const clamp = (n) => Math.min(Math.max(n, 1), Math.max(max, 1));
  const suffix = itemName ? ` de ${itemName}` : "";

  function handleInput(e) {
    const number = Number.parseInt(e.target.value, 10);
    onChange(Number.isNaN(number) ? 1 : clamp(number));
  }

  return (
    <div className="quantity-selector">
      <label htmlFor={id}>
        Quantidade
        {itemName && <span className="visually-hidden">{suffix}</span>}
      </label>
      <div className="quantity-selector-controls">
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          disabled={disabled || value <= 1}
          aria-label={`Diminuir quantidade${suffix}`}
        >
          <Minus aria-hidden="true" />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={1}
          max={max}
          value={value}
          onChange={handleInput}
          disabled={disabled}
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          disabled={disabled || value >= max}
          aria-label={`Aumentar quantidade${suffix}`}
        >
          <Plus aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
