import "./Builder.css";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { RotateCcw } from "lucide-react";
import BuilderSlot from "../components/builder/BuilderSlot";
import BuilderStatus from "../components/builder/BuilderStatus";
import BuilderSummary from "../components/builder/BuilderSummary";
import SaveBuildForm from "../components/builder/SaveBuildForm";
import { createBuild } from "../api/builds";
import { toBuildRecord } from "../utils/savedBuilds";
import { usePagedList } from "../hooks/usePagedList";
import { useAuth } from "../contexts/useAuth";
import { useCart } from "../contexts/useCart";
import { listProducts } from "../api/products";
import { BUILDER_CATEGORIES } from "../utils/categories";
import { analyzeCompatibility } from "../utils/compatibility";
import {
  ASSEMBLY_SERVICE_ID,
  addBlockReason,
  buildCartEntries,
  cleanSelection,
  loadSelection,
  rankOptions,
  resolveParts,
  saveSelection,
  toggleId,
} from "../utils/builder";

// Every part the builder can use, cheapest first, plus the services (for
// the optional assembly). One request, ~30 items.
const CATALOG_FILTERS = { categories: [...BUILDER_CATEGORIES, "service"], sort: "price" };

const NO_FEEDBACK = { text: "", tone: "" };

const withoutSlots = (selection, slots) =>
  Object.fromEntries(Object.entries(selection).filter(([slot]) => !slots.includes(slot)));

// PC Builder page (mockup "montar-pc"): one slot per component, a picker
// with the compatibility of each option, a status banner, the problems
// next to the parts involved, and a summary that sends the whole build
// (and the optional assembly service) to the cart. The build is kept in
// localStorage, so a guest sent to login finds it again on return.
export default function Builder() {
  const { user } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  const [reloadKey, setReloadKey] = useState(0);
  const catalog = usePagedList(listProducts, CATALOG_FILTERS, reloadKey);
  // "Abrir no montador" (My Account) sends a saved build in the navigation
  // state; it replaces the build in progress
  const [openedBuild] = useState(() => location.state?.openBuild ?? null);
  const [selection, setSelection] = useState(() =>
    openedBuild ? cleanSelection(openedBuild.parts) : loadSelection(),
  );
  const [openSlot, setOpenSlot] = useState(null);
  const [withAssembly, setWithAssembly] = useState(false);
  const [adding, setAdding] = useState({ busy: false, feedback: NO_FEEDBACK });

  const ready = !catalog.loading && !catalog.error;
  const byId = useMemo(() => Object.fromEntries(catalog.data.map((p) => [String(p.id), p])), [catalog.data]);
  const { parts, missing } = useMemo(
    () => (ready ? resolveParts(selection, byId) : { parts: {}, missing: [] }),
    [ready, selection, byId],
  );
  // Parts that no longer exist are dropped on the next change
  const current = withoutSlots(selection, missing);
  const result = analyzeCompatibility(parts);
  const assemblyProduct = byId[ASSEMBLY_SERVICE_ID];
  const assembly = assemblyProduct?.category === "service" ? assemblyProduct : null;
  const reason = addBlockReason(result, parts, { isAdmin: user?.type === "admin" });

  // Save once the catalog is known, so deleted parts are not saved back
  useEffect(() => {
    if (ready) saveSelection(withoutSlots(selection, missing));
  }, [ready, selection, missing]);

  // Drop the opened build from history, so a refresh keeps later changes
  useEffect(() => {
    if (location.state?.openBuild) {
      navigate({ search: location.search }, { replace: true, state: null });
    }
  }, [location.state, location.search, navigate]);

  async function saveBuild(name) {
    try {
      await createBuild(toBuildRecord({ userId: user.id, name, parts }));
      return {};
    } catch (error) {
      return { error: error.message };
    }
  }

  const isClient = user?.type === "user";
  const saveBlocked = result.selectedCount === 0 ? "Escolha pelo menos uma peça para salvar." : "";

  // Focus goes back to the slot button after choosing, removing or closing
  const focusToggle = (slot) => document.getElementById(toggleId(slot))?.focus();

  // A change to the build makes the last "added" message out of date
  function changeSelection(next) {
    setSelection(next);
    setAdding({ busy: false, feedback: NO_FEEDBACK });
  }

  function choose(slot, product) {
    changeSelection({ ...current, [slot]: String(product.id) });
    setOpenSlot(null);
    focusToggle(slot);
  }

  function remove(slot) {
    changeSelection(withoutSlots(current, [slot]));
    setOpenSlot(null);
    focusToggle(slot);
  }

  // Adds every part (+ assembly) in one cart change: all or nothing.
  // Guests log in first and come back here; the build is still saved.
  async function addToCart() {
    if (!user) {
      navigate("/login", { state: { from: location } });
      return;
    }
    if (reason || adding.busy) return;

    setAdding({ busy: true, feedback: NO_FEEDBACK });
    const outcome = await cart.addItems(buildCartEntries(parts, withAssembly ? assembly : null));
    setAdding({
      busy: false,
      feedback: outcome.error
        ? { text: outcome.error, tone: "error" }
        : { text: "Configuração adicionada ao carrinho.", tone: "success" },
    });
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
        {openedBuild && (
          <p className="page-message builder-opened" role="status">
            Montagem “{openedBuild.name}” aberta no montador.
          </p>
        )}

        <BuilderStatus result={result} />

        {missing.length > 0 && (
          <p className="page-message" role="status">
            {missing.length === 1
              ? "Uma peça da sua montagem não está mais no catálogo e foi retirada."
              : `${missing.length} peças da sua montagem não estão mais no catálogo e foram retiradas.`}
          </p>
        )}

        <div className="builder-content">
          <div className="builder-main">
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
                  changeSelection({});
                  setOpenSlot(null);
                }}
              >
                <RotateCcw aria-hidden="true" />
                Limpar montagem
              </button>
            )}
          </div>

          <BuilderSummary
            parts={parts}
            result={result}
            assembly={assembly}
            withAssembly={withAssembly}
            onToggleAssembly={(e) => setWithAssembly(e.target.checked)}
            reason={reason}
            busy={adding.busy}
            feedback={adding.feedback}
            onAdd={addToCart}
          >
            {/* Saved builds belong to clients; guests log in first */}
            {(isClient || !user) && (
              <SaveBuildForm
                blockedReason={saveBlocked}
                onSave={saveBuild}
                onRequireLogin={user ? undefined : () => navigate("/login", { state: { from: location } })}
              />
            )}
          </BuilderSummary>
        </div>
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
