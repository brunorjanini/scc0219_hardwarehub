import "./Builder.css";
import { useEffect, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import BuilderSlot from "../components/builder/BuilderSlot";
import BuilderStatus from "../components/builder/BuilderStatus";
import { usePagedList } from "../hooks/usePagedList";
import { listProducts } from "../api/products";
import { BUILDER_CATEGORIES } from "../utils/categories";
import { analyzeCompatibility } from "../utils/compatibility";
import { loadSelection, rankOptions, resolveParts, saveSelection, toggleId } from "../utils/builder";

// Every part the builder can use, cheapest first (one request, ~25 items)
const CATALOG_FILTERS = { categories: BUILDER_CATEGORIES, sort: "price" };

const withoutSlots = (selection, slots) =>
  Object.fromEntries(Object.entries(selection).filter(([slot]) => !slots.includes(slot)));

// PC Builder page (mockup "montar-pc"): one slot per component, a picker
// with the compatibility of each option, a status banner and the problems
// next to the parts involved. The build is kept in localStorage.
// Summary, total and "add to cart" come in Task 9.
export default function Builder() {
  const [reloadKey, setReloadKey] = useState(0);
  const catalog = usePagedList(listProducts, CATALOG_FILTERS, reloadKey);
  const [selection, setSelection] = useState(loadSelection);
  const [openSlot, setOpenSlot] = useState(null);

  const ready = !catalog.loading && !catalog.error;
  const byId = useMemo(() => Object.fromEntries(catalog.data.map((p) => [String(p.id), p])), [catalog.data]);
  const { parts, missing } = useMemo(
    () => (ready ? resolveParts(selection, byId) : { parts: {}, missing: [] }),
    [ready, selection, byId],
  );
  // Parts that no longer exist are dropped on the next change
  const current = withoutSlots(selection, missing);
  const result = analyzeCompatibility(parts);

  // Save once the catalog is known, so deleted parts are not saved back
  useEffect(() => {
    if (ready) saveSelection(withoutSlots(selection, missing));
  }, [ready, selection, missing]);

  // Focus goes back to the slot button after choosing, removing or closing
  const focusToggle = (slot) => document.getElementById(toggleId(slot))?.focus();

  function choose(slot, product) {
    setSelection({ ...current, [slot]: String(product.id) });
    setOpenSlot(null);
    focusToggle(slot);
  }

  function remove(slot) {
    setSelection(withoutSlots(current, [slot]));
    setOpenSlot(null);
    focusToggle(slot);
  }

  function close(slot) {
    setOpenSlot(null);
    focusToggle(slot);
  }

  const { selectedCount, totalSlots } = result;

  let content;
  if (catalog.error) {
    content = (
      <div className="page-message error builder-message" role="alert">
        <p>{catalog.error}</p>
        <button type="button" className="link-button secondary" onClick={() => setReloadKey((n) => n + 1)}>
          Tentar novamente
        </button>
      </div>
    );
  } else if (catalog.loading) {
    content = (
      <p className="page-message" role="status">
        Carregando peças...
      </p>
    );
  } else {
    content = (
      <>
        <BuilderStatus result={result} />

        {missing.length > 0 && (
          <p className="page-message" role="status">
            {missing.length === 1
              ? "Uma peça da sua montagem não está mais no catálogo e foi retirada."
              : `${missing.length} peças da sua montagem não estão mais no catálogo e foram retiradas.`}
          </p>
        )}

        <ul className="builder-slots" aria-label="Componentes do PC">
          {BUILDER_CATEGORIES.map((slot) => (
            <BuilderSlot
              key={slot}
              slot={slot}
              product={parts[slot]}
              issues={result.issues.filter((issue) => issue.parts.includes(slot))}
              open={openSlot === slot}
              options={openSlot === slot ? rankOptions(catalog.data, parts, slot) : []}
              onToggle={() => setOpenSlot(openSlot === slot ? null : slot)}
              onChoose={(product) => choose(slot, product)}
              onRemove={() => remove(slot)}
              onClose={() => close(slot)}
            />
          ))}
        </ul>

        {selectedCount > 0 && (
          <button
            type="button"
            className="link-button secondary builder-clear"
            onClick={() => {
              setSelection({});
              setOpenSlot(null);
            }}
          >
            <RotateCcw aria-hidden="true" />
            Limpar montagem
          </button>
        )}
      </>
    );
  }

  return (
    <div className="store-page builder-page">
      <div className="builder-intro">
        <div>
          <p className="builder-eyebrow">Montador inteligente</p>
          <h1 className="builder-title">Monte seu PC</h1>
          <p className="builder-subtitle">Escolha as peças. Nós validamos a compatibilidade em tempo real.</p>
        </div>

        <div className="builder-progress">
          <p id="builder-progress-label">
            {selectedCount} de {totalSlots} componentes selecionados
          </p>
          <div
            className="builder-progress-bar"
            role="progressbar"
            aria-labelledby="builder-progress-label"
            aria-valuemin={0}
            aria-valuemax={totalSlots}
            aria-valuenow={selectedCount}
          >
            <div style={{ width: `${(selectedCount / totalSlots) * 100}%` }} />
          </div>
        </div>
      </div>

      {content}
    </div>
  );
}
