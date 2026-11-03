import "../components/admin/AdminPage.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { Check, Pencil, Plus, Search, Trash2, TriangleAlert, X } from "lucide-react";
import TopBar from "../components/admin/TopBar";
import AdminNotice from "../components/admin/AdminNotice";
import AdminPagination from "../components/admin/AdminPagination";
import ConfirmDialog from "../components/ConfirmDialog";
import ProductImage from "../components/store/ProductImage";
import StockBadge from "../components/store/StockBadge";
import { useProductList } from "../hooks/useProductList";
import { useNavigationNotice } from "../hooks/useNavigationNotice";
import { useConfirmDelete } from "../hooks/useConfirmDelete";
import { deleteProduct, listProducts, updateProduct } from "../api/products";
import { CATEGORIES, categoryLabel } from "../utils/categories";
import { formatNumber, formatPrice } from "../utils/format";
import { isService } from "../utils/stock";
import { parseNumber } from "../utils/productForm";
import {
  ADMIN_SORT_OPTIONS,
  STOCK_STATUS_OPTIONS,
  parseAdminProductParams,
  toAdminProductFilters,
  toAdminProductSearch,
} from "../utils/adminProductQuery";

// Number of products without stock, for the alert chip
function useOutOfStockCount(reloadKey) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listProducts({ stockLevel: "out" })
      .then((products) => {
        if (!cancelled) setCount(products.length);
      })
      // Only the chip depends on it
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return count;
}

// Quick stock edit inside the table row (services have no stock).
// Focus stays on the input after saving, so keyboard users can go on.
function StockEditor({ product, onSaved, onError }) {
  const inputId = `stock-${product.id}`;
  const inputRef = useRef(null);
  const [saved, setSaved] = useState(String(product.stock));
  const [value, setValue] = useState(String(product.stock));
  const [saving, setSaving] = useState(false);
  const changed = value.trim() !== saved;

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving || !changed) return;

    const stock = parseNumber(value);
    if (!Number.isInteger(stock) || stock < 0) {
      onError(`Estoque inválido para “${product.name}”: use um número inteiro maior ou igual a zero.`);
      inputRef.current.focus();
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProduct(product.id, { stock });
      setSaved(String(updated.stock));
      setValue(String(updated.stock));
      onSaved(updated);
    } catch (error) {
      onError(error.message);
    } finally {
      setSaving(false);
      inputRef.current?.focus();
    }
  }

  return (
    // noValidate: our message (announced in the live region) replaces the
    // browser bubble that min="0" would show
    <form className="admin-stock-form" onSubmit={handleSubmit} noValidate>
      <label htmlFor={inputId} className="visually-hidden">
        Estoque de {product.name}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="number"
        min="0"
        step="1"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        type="submit"
        className="admin-icon-button"
        aria-label={`Salvar estoque de ${product.name}`}
        disabled={!changed || saving}
      >
        <Check aria-hidden="true" />
      </button>
    </form>
  );
}

// Admin list of products and services (mockup "admin-produtos"):
// search, filters, sorting and pagination in the URL, quick stock edit,
// links to the create/edit form and deletion with confirmation.
export default function AdminProducts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const filters = useMemo(() => parseAdminProductParams(searchParams), [searchParams]);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((n) => n + 1);
  const list = useProductList(toAdminProductFilters(filters), reloadKey);
  const outOfStock = useOutOfStockCount(reloadKey);

  // Feedback after an action. The form page sends one in the navigation state.
  const [notice, setNotice] = useNavigationNotice();

  const titleRef = useRef(null);
  const deletion = useConfirmDelete({
    focusRef: titleRef,
    remove: (product) => deleteProduct(product.id),
    onDeleted: (product) => {
      setNotice({ text: `“${product.name}” foi excluído.`, tone: "success" });
      // The last row of a page was removed: go back one page
      if (list.data.length === 1 && filters.page > 1) {
        setSearchParams(toAdminProductSearch({ ...filters, page: filters.page - 1 }));
      }
      reload();
    },
  });

  function applyFilters(changes) {
    setSearchParams(toAdminProductSearch({ ...filters, ...changes, page: 1 }));
  }

  // Search applies on submit; the selects apply as soon as they change
  function readFilterForm(form) {
    const data = new FormData(form);
    return {
      q: (data.get("q") ?? "").toString().trim(),
      category: data.get("category"),
      status: data.get("status"),
      sort: data.get("sort"),
    };
  }

  function handleFilterSubmit(e) {
    e.preventDefault();
    applyFilters(readFilterForm(e.currentTarget));
  }

  function handleSelectChange(e) {
    applyFilters(readFilterForm(e.currentTarget.form));
  }

  function handleStockSaved(product) {
    setNotice({ text: `Estoque de “${product.name}” atualizado para ${formatNumber(product.stock)}.`, tone: "success" });
    reload();
  }

  function handleError(text) {
    setNotice({ text, tone: "error" });
  }

  const pagePath = (page) => `/admin/products${toAdminProductSearch({ ...filters, page })}`;
  const hasFilters = Boolean(filters.q || filters.category || filters.status);
  const backState = { back: location.search };
  const showTable = list.data.length > 0 && !list.error;

  let content;
  if (list.error) {
    content = (
      <div className="page-message error admin-message" role="alert">
        <p>{list.error}</p>
        <button type="button" className="link-button secondary" onClick={reload}>
          Tentar novamente
        </button>
      </div>
    );
  } else if (list.loading && !showTable) {
    content = (
      <p className="page-message" role="status">
        Carregando produtos...
      </p>
    );
  } else if (!showTable) {
    content = (
      <div className="page-message admin-message">
        <p>{hasFilters ? "Nenhum produto corresponde aos filtros." : "Nenhum produto cadastrado."}</p>
        {hasFilters && (
          <Link to="/admin/products" className="link-button secondary">
            Limpar filtros
          </Link>
        )}
      </div>
    );
  } else {
    content = (
      <div className="admin-table-wrapper">
        <table className="admin-table" aria-busy={list.loading}>
          <caption className="visually-hidden">Produtos e serviços cadastrados</caption>
          <thead>
            <tr>
              <th scope="col">Produto</th>
              <th scope="col">Categoria</th>
              <th scope="col">Preço</th>
              <th scope="col">Estoque</th>
              <th scope="col">Vendidos</th>
              <th scope="col">Situação</th>
              <th scope="col">
                <span className="visually-hidden">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.data.map((product) => (
              <tr key={product.id}>
                <th scope="row">
                  <div className="admin-product-cell">
                    <ProductImage product={product} alt="" className="admin-product-thumb" />
                    <div>
                      <span className="admin-product-name">{product.name}</span>
                      <span className="admin-product-meta">
                        {product.brand} · ID {product.id}
                      </span>
                    </div>
                  </div>
                </th>
                <td>{categoryLabel(product.category)}</td>
                <td>
                  {formatPrice(product.price)}
                  {product.oldPrice > product.price && (
                    <span className="admin-product-meta">
                      Oferta (de <s>{formatPrice(product.oldPrice)}</s>)
                    </span>
                  )}
                </td>
                <td>
                  {isService(product) ? (
                    <span className="admin-product-meta">Serviço</span>
                  ) : (
                    <StockEditor product={product} onSaved={handleStockSaved} onError={handleError} />
                  )}
                </td>
                <td>{formatNumber(product.sold ?? 0)}</td>
                <td>
                  <StockBadge product={product} />
                </td>
                <td>
                  <div className="admin-row-actions">
                    <Link
                      to={`/admin/products/${product.id}`}
                      state={backState}
                      className="admin-icon-button"
                      aria-label={`Editar ${product.name}`}
                    >
                      <Pencil aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      className="admin-icon-button danger"
                      aria-label={`Excluir ${product.name}`}
                      onClick={() => deletion.open(product)}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <TopBar title="Produtos e serviços" />

      <div className="admin-content">
        <div className="admin-title-row">
          <div>
            <h1 ref={titleRef} tabIndex={-1} className="admin-title">
              Produtos e serviços
            </h1>
            <p className="admin-subtitle">Gerencie catálogo, preços, serviços e estoque.</p>
          </div>
          <Link to="/admin/products/new" state={backState} className="link-button">
            <Plus aria-hidden="true" />
            Novo produto
          </Link>
        </div>

        {/* Announces saves, deletions and errors */}
        <AdminNotice notice={notice} onClose={() => setNotice({ text: "", tone: "success" })} />

        {/* `key` resets the fields when the URL changes (back button, "Limpar") */}
        <form
          key={toAdminProductSearch({ ...filters, page: 1 })}
          className="admin-filters"
          role="search"
          aria-label="Filtrar produtos"
          onSubmit={handleFilterSubmit}
        >
          <div className="admin-field admin-field-grow">
            <label htmlFor="admin-q">Buscar</label>
            <div className="admin-search">
              <input id="admin-q" name="q" type="search" defaultValue={filters.q} placeholder="Nome do produto" />
              <button type="submit" className="admin-icon-button" aria-label="Aplicar busca">
                <Search aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="admin-field">
            <label htmlFor="admin-category">Categoria</label>
            <select id="admin-category" name="category" defaultValue={filters.category} onChange={handleSelectChange}>
              <option value="">Todas</option>
              {CATEGORIES.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-field">
            <label htmlFor="admin-status">Estoque</label>
            <select id="admin-status" name="status" defaultValue={filters.status} onChange={handleSelectChange}>
              <option value="">Todos</option>
              {STOCK_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-field">
            <label htmlFor="admin-sort">Ordenar por</label>
            <select id="admin-sort" name="sort" defaultValue={filters.sort} onChange={handleSelectChange}>
              {ADMIN_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </form>

        <div className="admin-summary">
          <p className="admin-chip info" role="status">
            {list.loading ? "Carregando..." : `${list.items} ${list.items === 1 ? "item" : "itens"}`}
          </p>
          {outOfStock > 0 && filters.status !== "out" && (
            <button type="button" className="admin-chip danger" onClick={() => applyFilters({ status: "out" })}>
              <TriangleAlert aria-hidden="true" />
              {outOfStock} sem estoque
              <span className="visually-hidden">(mostrar)</span>
            </button>
          )}
          {hasFilters && (
            <Link to="/admin/products" className="admin-chip">
              <X aria-hidden="true" />
              Limpar filtros
            </Link>
          )}
        </div>

        {content}

        {showTable && <AdminPagination page={filters.page} pages={list.pages} items={list.items} pathFor={pagePath} />}
      </div>

      {deletion.target && (
        <ConfirmDialog
          title={`Excluir “${deletion.target.name}”?`}
          busy={deletion.busy}
          error={deletion.error}
          onConfirm={deletion.confirm}
          onCancel={deletion.cancel}
        >
          <p>
            O item sai do catálogo. Carrinhos que o tiverem vão mostrá-lo como indisponível, e pedidos já feitos
            não mudam.
          </p>
          <p>Essa ação não pode ser desfeita.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
