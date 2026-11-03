import "./Catalog.css";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import ProductGrid from "../components/store/ProductGrid";
import { useProductList } from "../hooks/useProductList";
import { listProducts } from "../api/products";
import { CATALOG_SECTIONS, CATEGORIES } from "../utils/categories";
import {
  SORT_OPTIONS,
  catalogPath,
  catalogTitle,
  hasActiveFilters,
  parseCatalogParams,
  toCatalogSearch,
  toProductFilters,
} from "../utils/catalogQuery";

// Brand names of every product, for the brand filter
function useBrands() {
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    let cancelled = false;
    listProducts()
      .then((products) => {
        if (cancelled) return;
        const names = new Set(products.map((p) => p.brand).filter(Boolean));
        setBrands([...names].sort((a, b) => a.localeCompare(b, "pt-BR")));
      })
      // The filter still works without the list (only the select is empty)
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return brands;
}

// Catalog page (mockup C04): filters, sorting and pagination.
// Every filter lives in the URL, so results can be bookmarked and the
// back button restores the previous filters.
export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseCatalogParams(searchParams), [searchParams]);
  const list = useProductList(toProductFilters(filters));
  const brands = useBrands();

  // Applies new filters and goes back to page 1
  function applyFilters(changes) {
    setSearchParams(toCatalogSearch({ ...filters, ...changes, page: 1 }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.target);
    applyFilters({
      q: (form.get("q") ?? "").toString().trim(),
      category: form.get("category"),
      brand: form.get("brand"),
      minPrice: form.get("minPrice"),
      maxPrice: form.get("maxPrice"),
      inStock: form.get("inStock") === "1",
    });
  }

  const title = catalogTitle(filters);
  const resultText = list.loading
    ? "Carregando..."
    : `${list.items} ${list.items === 1 ? "item encontrado" : "itens encontrados"}`;

  return (
    <div className="store-page catalog-page">
      <div className="catalog-header">
        <div>
          <h1>{title}</h1>
          <p className="catalog-count" role="status">
            {resultText}
          </p>
        </div>

        {/* Sorting applies immediately */}
        <div className="catalog-sort">
          <label htmlFor="catalog-sort">Ordenar por</label>
          <select
            id="catalog-sort"
            value={filters.sort}
            onChange={(e) => applyFilters({ sort: e.target.value })}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="catalog-body">
        {/* Filters. `key` resets the fields when the URL changes
            (header search, back button, "Limpar filtros") */}
        <form
          key={toCatalogSearch({ ...filters, sort: undefined, page: 1 })}
          className="catalog-filters"
          onSubmit={handleSubmit}
          aria-label="Filtros do catálogo"
        >
          <h2 className="catalog-filters-title">Filtros</h2>

          <div className="catalog-field">
            <label htmlFor="filter-q">Buscar</label>
            <input id="filter-q" name="q" type="search" defaultValue={filters.q} placeholder="Nome do produto" />
          </div>

          <div className="catalog-field">
            <label htmlFor="filter-category">Categoria</label>
            <select id="filter-category" name="category" defaultValue={filters.category}>
              <option value="">Todas</option>
              <optgroup label="Seções">
                {CATALOG_SECTIONS.map((section) => (
                  <option key={section.slug} value={section.slug}>
                    {section.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Categorias">
                {CATEGORIES.filter((c) => c.slug !== "service").map((category) => (
                  <option key={category.slug} value={category.slug}>
                    {category.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="catalog-field">
            <label htmlFor="filter-brand">Marca</label>
            <select id="filter-brand" name="brand" defaultValue={filters.brand}>
              <option value="">Todas</option>
              {/* Keep a brand from the URL even before the list loads */}
              {filters.brand && !brands.includes(filters.brand) && (
                <option value={filters.brand}>{filters.brand}</option>
              )}
              {brands.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="catalog-field catalog-price">
            <legend>Preço (R$)</legend>
            <div className="catalog-price-inputs">
              <div>
                <label htmlFor="filter-min">Mínimo</label>
                <input id="filter-min" name="minPrice" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={filters.minPrice} />
              </div>
              <div>
                <label htmlFor="filter-max">Máximo</label>
                <input id="filter-max" name="maxPrice" type="number" min="0" step="0.01" inputMode="decimal" defaultValue={filters.maxPrice} />
              </div>
            </div>
          </fieldset>

          <div className="catalog-checkbox">
            <input id="filter-stock" name="inStock" type="checkbox" value="1" defaultChecked={filters.inStock} />
            <label htmlFor="filter-stock">Somente disponíveis</label>
          </div>

          <button type="submit" className="link-button catalog-apply">
            Aplicar filtros
          </button>
          {hasActiveFilters(filters) && (
            <Link to={catalogPath({ sort: filters.sort })} className="catalog-clear">
              <X aria-hidden="true" />
              Limpar filtros
            </Link>
          )}
        </form>

        <section className="catalog-results" aria-label="Resultados">
          <ProductGrid
            list={list}
            headingLevel="h2"
            emptyMessage="Nenhum produto corresponde aos filtros. Tente remover algum filtro."
          />

          {!list.loading && list.pages > 1 && (
            <nav className="catalog-pagination" aria-label="Paginação">
              {filters.page > 1 ? (
                <Link to={catalogPath({ ...filters, page: filters.page - 1 })} className="link-button secondary">
                  <ChevronLeft aria-hidden="true" />
                  Anterior
                </Link>
              ) : (
                <span className="link-button secondary is-disabled" aria-disabled="true">
                  <ChevronLeft aria-hidden="true" />
                  Anterior
                </span>
              )}

              <p aria-current="page">
                Página {filters.page} de {list.pages}
              </p>

              {filters.page < list.pages ? (
                <Link to={catalogPath({ ...filters, page: filters.page + 1 })} className="link-button secondary">
                  Próxima
                  <ChevronRight aria-hidden="true" />
                </Link>
              ) : (
                <span className="link-button secondary is-disabled" aria-disabled="true">
                  Próxima
                  <ChevronRight aria-hidden="true" />
                </span>
              )}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
