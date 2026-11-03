import { CircleCheck, CircleX, Plus, TriangleAlert, X } from "lucide-react";
import ProductImage from "../store/ProductImage";
import StockBadge from "../store/StockBadge";
import { SLOT_PLACEHOLDERS, keySpecsText, toggleId } from "../../utils/builder";
import { categoryLabel } from "../../utils/categories";
import { formatPrice } from "../../utils/format";
import { stockStatus } from "../../utils/stock";

const ISSUE_ICONS = { error: CircleX, warning: TriangleAlert };

// Problem messages of a part, with icon + text
function IssueList({ messages, level, className }) {
  if (messages.length === 0) return null;
  const Icon = ISSUE_ICONS[level];
  return (
    <ul className={className}>
      {messages.map((message) => (
        <li key={message} className={`builder-issue builder-tone-${level}`}>
          <Icon aria-hidden="true" />
          {message}
        </li>
      ))}
    </ul>
  );
}

// Options of one slot, shown below it. Each option says how it fits the
// parts already chosen; incompatible ones can still be picked (the user
// may change the other part next), unavailable ones cannot.
function PartPicker({ slot, label, options, selectedId, onChoose }) {
  return (
    <div id={`builder-picker-${slot}`} className="builder-picker" role="region" aria-label={`Opções de ${label}`}>
      {options.length === 0 ? (
        <p className="builder-picker-empty">Nenhuma peça desta categoria no catálogo.</p>
      ) : (
        <ul className="builder-options">
          {options.map(({ product, check, available }) => {
            const selected = product.id === selectedId;
            return (
              <li key={product.id} className="builder-option">
                <ProductImage product={product} alt="" className="builder-option-thumb" />
                <div className="builder-option-info">
                  <p className="builder-option-name">{product.name}</p>
                  <p className="builder-option-specs">{keySpecsText(product)}</p>
                  {check.level === "ok" ? (
                    <p className="builder-issue builder-tone-ok">
                      <CircleCheck aria-hidden="true" />
                      Compatível com as peças escolhidas
                    </p>
                  ) : (
                    <IssueList messages={check.messages} level={check.level} className="builder-option-issues" />
                  )}
                  {!available && <StockBadge product={product} />}
                </div>
                <p className="builder-option-price">{formatPrice(product.price)}</p>
                <button
                  type="button"
                  className="link-button secondary builder-option-button"
                  onClick={() => onChoose(product)}
                  disabled={!available || selected}
                  aria-label={selected ? `${product.name} (escolhido)` : `Escolher ${product.name}`}
                >
                  {selected ? "Escolhido" : available ? "Escolher" : "Indisponível"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// One component row (mockup "montar-pc"): chosen part or placeholder,
// its problems, and the buttons to choose/change and remove it.
export default function BuilderSlot({ slot, product, issues, open, options, onToggle, onChoose, onRemove, onClose }) {
  const label = categoryLabel(slot);
  const errors = issues.filter((i) => i.level === "error").map((i) => i.message);
  const warnings = issues.filter((i) => i.level === "warning").map((i) => i.message);
  const unavailable = product && !stockStatus(product).available;

  let tone = "empty";
  let Icon = Plus;
  if (product) {
    if (errors.length) [tone, Icon] = ["error", CircleX];
    else if (warnings.length || unavailable) [tone, Icon] = ["warning", TriangleAlert];
    else [tone, Icon] = ["ok", CircleCheck];
  }

  // Esc closes the picker, from its toggle button or from any option
  function handleKeyDown(e) {
    if (open && e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  }

  return (
    <li className={`builder-slot builder-slot-${tone}`} onKeyDown={handleKeyDown}>
      <div className="builder-slot-row">
        <div className={`builder-slot-icon builder-tone-${tone}`}>
          <Icon aria-hidden="true" />
        </div>

        <div className="builder-slot-info">
          <h2 className="builder-slot-category">{label}</h2>
          <p className="builder-slot-name">{product ? product.name : SLOT_PLACEHOLDERS[slot]}</p>
          {product && <p className="builder-option-specs">{keySpecsText(product)}</p>}
          <IssueList messages={errors} level="error" className="builder-slot-issues" />
          <IssueList messages={warnings} level="warning" className="builder-slot-issues" />
          {unavailable && <StockBadge product={product} />}
        </div>

        <p className="builder-slot-price">{product ? formatPrice(product.price) : "–"}</p>

        <div className="builder-slot-actions">
          <button
            id={toggleId(slot)}
            type="button"
            className="link-button secondary"
            aria-expanded={open}
            aria-controls={open ? `builder-picker-${slot}` : undefined}
            aria-label={`${product ? "Trocar" : "Escolher"} ${label}`}
            onClick={onToggle}
          >
            {product ? "Trocar" : "Escolher"}
          </button>
          {product && (
            <button type="button" className="builder-remove" aria-label={`Remover ${label}`} onClick={onRemove}>
              <X aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {open && (
        <PartPicker
          slot={slot}
          label={label}
          options={options}
          selectedId={product?.id}
          onChoose={onChoose}
        />
      )}
    </li>
  );
}
