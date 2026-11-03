import "./QuantitySelector.css";
import { Minus, Plus } from "lucide-react";

// Quantity input with − / + buttons, limited to [1, max].
// Controlled: the parent keeps `value` and receives integers in onChange.
export default function QuantitySelector({ value, max, onChange, id = "quantity", label = "Quantidade" }) {
  const clamp = (n) => Math.min(Math.max(n, 1), Math.max(max, 1));

  function handleInput(e) {
    const number = Number.parseInt(e.target.value, 10);
    onChange(Number.isNaN(number) ? 1 : clamp(number));
  }

  return (
    <div className="quantity-selector">
      <label htmlFor={id}>{label}</label>
      <div className="quantity-selector-controls">
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= 1}
          aria-label="Diminuir quantidade"
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
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          aria-label="Aumentar quantidade"
        >
          <Plus aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
