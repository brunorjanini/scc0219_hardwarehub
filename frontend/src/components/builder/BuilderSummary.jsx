import { Link } from "react-router";
import { ShoppingCart } from "lucide-react";
import { BUILDER_CATEGORIES, categoryLabel } from "../../utils/categories";
import { buildTotal } from "../../utils/builder";
import { formatNumber, formatPrice } from "../../utils/format";

const REASON_ID = "builder-add-reason";

// Side card of the builder (mockup "Resumo do setup"): price of each
// part, power, the optional assembly service, the total and the button
// that sends the whole build to the cart. `reason` (from addBlockReason)
// explains why the button is disabled.
export default function BuilderSummary({
  parts,
  result,
  assembly,
  withAssembly,
  onToggleAssembly,
  reason,
  busy,
  feedback,
  onAdd,
}) {
  const chosenAssembly = withAssembly ? assembly : null;
  const total = buildTotal(parts, chosenAssembly);
  const psuWatts = parts.psu?.specs?.watts;

  return (
    <aside className="builder-summary" aria-labelledby="builder-summary-title">
      <h2 id="builder-summary-title" className="builder-summary-title">
        Resumo do setup
      </h2>

      <ul className="builder-summary-lines">
        {BUILDER_CATEGORIES.map((slot) => (
          <li key={slot}>
            <span>{categoryLabel(slot)}</span>
            <span>{parts[slot] ? formatPrice(parts[slot].price) : "–"}</span>
          </li>
        ))}
        {chosenAssembly && (
          <li>
            <span>{chosenAssembly.name}</span>
            <span>{formatPrice(chosenAssembly.price)}</span>
          </li>
        )}
      </ul>

      <dl className="builder-summary-power">
        <div>
          <dt>Consumo estimado</dt>
          <dd>{result.estimatedWatts ? `${formatNumber(result.estimatedWatts)} W` : "–"}</dd>
        </div>
        <div>
          <dt>Fonte recomendada</dt>
          <dd>{result.recommendedWatts ? `${formatNumber(result.recommendedWatts)} W` : "–"}</dd>
        </div>
        <div>
          <dt>Fonte escolhida</dt>
          <dd>{psuWatts ? `${formatNumber(psuWatts)} W` : "–"}</dd>
        </div>
      </dl>

      {assembly && (
        <div className="builder-summary-assembly">
          <input id="builder-assembly" type="checkbox" checked={withAssembly} onChange={onToggleAssembly} />
          <label htmlFor="builder-assembly">
            Incluir {assembly.name} (+ {formatPrice(assembly.price)})
            <span>
              Entregamos o PC montado e testado
              {assembly.specs?.durationHours ? ` (cerca de ${formatNumber(assembly.specs.durationHours)} h)` : ""}.
            </span>
          </label>
        </div>
      )}

      <div className="builder-summary-total">
        <span>Total</span>
        <strong>{formatPrice(total)}</strong>
      </div>

      <button
        type="button"
        className="link-button builder-add"
        onClick={onAdd}
        disabled={Boolean(reason) || busy}
        aria-describedby={reason ? REASON_ID : undefined}
      >
        <ShoppingCart aria-hidden="true" />
        {busy ? "Adicionando..." : "Adicionar configuração ao carrinho"}
      </button>
      {reason && (
        <p id={REASON_ID} className="builder-summary-reason">
          {reason}
        </p>
      )}

      {/* Result of the last attempt, announced by screen readers */}
      <div role="status" className="builder-summary-feedback">
        {feedback.text && (
          <>
            <p className={`builder-tone-${feedback.tone === "error" ? "error" : "ok"}`}>{feedback.text}</p>
            {feedback.tone === "success" && (
              <Link to="/cart" className="link-button secondary">
                Ir para o carrinho
              </Link>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
