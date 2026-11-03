import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Cpu, Trash2, TriangleAlert } from "lucide-react";
import ConfirmDialog from "../ConfirmDialog";
import { useAuth } from "../../contexts/useAuth";
import { useConfirmDelete } from "../../hooks/useConfirmDelete";
import { deleteBuild, listBuildsByUser } from "../../api/builds";
import { listProducts } from "../../api/products";
import { BUILDER_CATEGORIES } from "../../utils/categories";
import { describeSavedBuild, slotList } from "../../utils/savedBuilds";
import { formatDateTime, formatPrice } from "../../utils/format";

// Builds of the client and the builder parts, loaded together
function useSavedBuilds(userId) {
  const [state, setState] = useState({ key: null, builds: [], products: [], error: "" });

  useEffect(() => {
    let cancelled = false;
    Promise.all([listBuildsByUser(userId), listProducts({ categories: BUILDER_CATEGORIES })])
      .then(([builds, products]) => {
        if (!cancelled) setState({ key: userId, builds, products, error: "" });
      })
      .catch((error) => {
        if (!cancelled) setState({ key: userId, builds: [], products: [], error: error.message });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return {
    ...state,
    loading: state.key !== userId,
    // Removes a deleted build without reloading
    remove: (id) => setState((previous) => ({ ...previous, builds: previous.builds.filter((b) => b.id !== id) })),
  };
}

// One saved build: parts, price today, what changed in the catalog
function SavedBuild({ build, productsById, onOpen, onDelete }) {
  const info = describeSavedBuild(build, productsById);
  const { missing, unavailable, priceChange } = info;

  return (
    <li className="saved-build">
      <div className="saved-build-icon" aria-hidden="true">
        <Cpu />
      </div>
      <div className="saved-build-info">
        <h3>{build.name}</h3>
        <p className="saved-build-meta">
          Salva em {formatDateTime(build.createdAt)} · {info.partCount} de {BUILDER_CATEGORIES.length} peças
        </p>
        <p className="saved-build-price">
          {formatPrice(info.currentTotal)}
          {priceChange !== 0 && (
            <span>
              {" "}
              (era {formatPrice(info.savedTotal)} quando você salvou)
            </span>
          )}
        </p>
        {missing.length > 0 && (
          <p className="saved-build-flag">
            <TriangleAlert aria-hidden="true" />
            Não {missing.length === 1 ? "está" : "estão"} mais no catálogo: {slotList(missing)}.
          </p>
        )}
        {unavailable.length > 0 && (
          <p className="saved-build-flag">
            <TriangleAlert aria-hidden="true" />
            Sem estoque agora: {slotList(unavailable)}.
          </p>
        )}
      </div>
      <div className="saved-build-actions">
        <button
          type="button"
          className="link-button"
          onClick={() => onOpen(build)}
          aria-label={`Abrir “${build.name}” no montador`}
        >
          Abrir no montador
        </button>
        <button
          type="button"
          className="saved-build-delete"
          onClick={() => onDelete(build)}
          aria-label={`Excluir “${build.name}”`}
        >
          <Trash2 aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

// "Minhas montagens" section of My Account: open a saved build in the
// builder (it replaces the build in progress) or delete it.
export default function SavedBuilds() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const saved = useSavedBuilds(user.id);
  const productsById = useMemo(
    () => Object.fromEntries(saved.products.map((p) => [String(p.id), p])),
    [saved.products],
  );
  const titleRef = useRef(null);
  const [notice, setNotice] = useState("");

  const deletion = useConfirmDelete({
    focusRef: titleRef,
    remove: (build) => deleteBuild(build.id),
    onDeleted: (build) => {
      saved.remove(build.id);
      setNotice(`Montagem “${build.name}” excluída.`);
    },
  });

  // "Ver em Minha conta" links to /account#montagens: scroll there once loaded
  useEffect(() => {
    if (!saved.loading && location.hash === "#montagens") {
      document.getElementById("montagens")?.scrollIntoView?.({ block: "start" });
    }
  }, [saved.loading, location.hash]);

  function open(build) {
    navigate("/monte-seu-pc", { state: { openBuild: { name: build.name, parts: build.parts } } });
  }

  let content;
  if (saved.loading) {
    content = (
      <p className="page-message" role="status">
        Carregando montagens...
      </p>
    );
  } else if (saved.error) {
    content = (
      <p className="page-message error" role="alert">
        {saved.error}
      </p>
    );
  } else if (saved.builds.length === 0) {
    content = (
      <div className="page-message account-empty">
        <p>Você ainda não salvou nenhuma montagem.</p>
        <Link to="/monte-seu-pc" className="link-button">
          Montar um PC
        </Link>
      </div>
    );
  } else {
    content = (
      <ul className="saved-builds">
        {saved.builds.map((build) => (
          <SavedBuild
            key={build.id}
            build={build}
            productsById={productsById}
            onOpen={open}
            onDelete={deletion.open}
          />
        ))}
      </ul>
    );
  }

  return (
    <section id="montagens" className="account-box" aria-labelledby="builds-title">
      <h2 id="builds-title" ref={titleRef} tabIndex={-1}>
        <Cpu aria-hidden="true" />
        Minhas montagens
      </h2>
      <p className="account-hint saved-builds-hint">
        Abrir uma montagem substitui a que estiver no montador. Preços e estoque são os de hoje.
      </p>
      <div role="status">{notice && <p className="account-message success">{notice}</p>}</div>
      {content}

      {deletion.target && (
        <ConfirmDialog
          title={`Excluir “${deletion.target.name}”?`}
          busy={deletion.busy}
          error={deletion.error}
          onConfirm={deletion.confirm}
          onCancel={deletion.cancel}
        >
          <p>A montagem sai da sua conta. As peças continuam no catálogo.</p>
        </ConfirmDialog>
      )}
    </section>
  );
}
