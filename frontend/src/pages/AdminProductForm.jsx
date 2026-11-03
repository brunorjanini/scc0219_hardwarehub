import "../components/admin/AdminPage.css";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ChevronLeft, ExternalLink } from "lucide-react";
import TopBar from "../components/admin/TopBar";
import ProductImage from "../components/store/ProductImage";
import { createProduct, getProduct, updateProduct } from "../api/products";
import { CATEGORIES } from "../utils/categories";
import { formatNumber } from "../utils/format";
import {
  PHOTO_SUGGESTIONS,
  isServiceCategory,
  readProductForm,
  specFieldLabel,
  specFields,
  specInitialValue,
  specInputId,
  toFormValues,
  toProductRecord,
  validateProduct,
} from "../utils/productForm";

const ERROR_ID = "product-form-error";

// Loads the product being edited: { product, loading, error }
function useProduct(id) {
  const [state, setState] = useState({ id: null, product: null, error: null });

  useEffect(() => {
    if (id === undefined) return undefined;
    let cancelled = false;
    getProduct(id)
      .then((product) => {
        if (!cancelled) setState({ id, product, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ id, product: null, error });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (id === undefined) return { product: null, loading: false, error: null };
  return { ...state, loading: state.id !== id };
}

// Props that link an input to the current error message
function errorProps(error, id) {
  return error?.field === id ? { "aria-invalid": true, "aria-describedby": ERROR_ID } : {};
}

// One labelled input/select/textarea of the main fields
function Field({ id, label, hint, error, as = "input", children, ...props }) {
  const Control = as;
  const hintId = hint ? `${id}-hint` : undefined;
  const invalid = errorProps(error, id);
  const describedBy = [hintId, invalid["aria-describedby"]].filter(Boolean).join(" ") || undefined;

  return (
    <div className="admin-form-field">
      <label htmlFor={id}>{label}</label>
      <Control id={id} name={id} {...props} {...invalid} aria-describedby={describedBy}>
        {children}
      </Control>
      {hint && (
        <p id={hintId} className="admin-field-hint">
          {hint}
        </p>
      )}
    </div>
  );
}

// One technical spec input, chosen by the field kind (see SPEC_FIELDS)
function SpecField({ field, specs, error }) {
  const id = specInputId(field.key);
  const label = `${specFieldLabel(field)}${field.required || field.kind === "boolean" ? "" : " (opcional)"}`;
  const initial = specInitialValue(field, specs);

  if (field.kind === "multi") {
    return (
      <fieldset className="admin-form-field">
        <legend>{label}</legend>
        <div className="admin-checks">
          {field.choices.map((choice) => {
            const choiceId = specInputId(field.key, choice);
            return (
              <label key={choice} className="admin-check" htmlFor={choiceId}>
                <input
                  type="checkbox"
                  id={choiceId}
                  name={id}
                  value={choice}
                  defaultChecked={initial.includes(choice)}
                  {...errorProps(error, choiceId)}
                />
                {choice}
              </label>
            );
          })}
        </div>
      </fieldset>
    );
  }

  if (field.kind === "boolean") {
    return (
      <div className="admin-form-field">
        <label className="admin-check" htmlFor={id}>
          <input type="checkbox" id={id} name={id} value="1" defaultChecked={initial} />
          {label}
        </label>
      </div>
    );
  }

  if (field.kind === "select") {
    return (
      <Field as="select" id={id} label={label} error={error} defaultValue={initial}>
        <option value="">Selecione</option>
        {field.choices.map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </Field>
    );
  }

  const inputMode = field.kind === "integer" ? "numeric" : field.kind === "decimal" ? "decimal" : undefined;
  return (
    <Field
      id={id}
      label={label}
      error={error}
      type="text"
      inputMode={inputMode}
      defaultValue={initial}
      placeholder={field.placeholder}
    />
  );
}

// The form itself. Fields are uncontrolled (read with FormData on submit);
// only the category (which specs to show) and the photo (preview) are state.
function ProductForm({ product, backPath }) {
  const isNew = !product;
  const navigate = useNavigate();
  const initial = toFormValues(product);
  const [category, setCategory] = useState(initial.category);
  const [photo, setPhoto] = useState(initial.photo);
  const [name, setName] = useState(initial.name);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Specs of the stored product only apply to its own category
  const specs = category === initial.category ? initial.specs : {};
  const fields = specFields(category);
  const service = isServiceCategory(category);

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;

    const values = readProductForm(new FormData(e.currentTarget));
    const problem = validateProduct(values);
    if (problem) {
      setError(problem);
      document.getElementById(problem.field)?.focus();
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const record = toProductRecord(values, { isNew });
      const saved = isNew ? await createProduct(record) : await updateProduct(product.id, record);
      const notice = isNew ? `“${saved.name}” foi criado.` : `“${saved.name}” foi atualizado.`;
      navigate(backPath, { state: { notice } });
    } catch (requestError) {
      setError({ field: "", message: requestError.message });
      setSaving(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit} noValidate aria-label={isNew ? "Novo produto" : "Editar produto"}>
      <div className="admin-form-main">
        <section className="admin-box" aria-labelledby="product-info-title">
          <h2 id="product-info-title" className="admin-box-title">
            Informações
          </h2>
          <Field id="name" label="Nome" error={error} defaultValue={initial.name} onChange={(e) => setName(e.target.value)} />
          <div className="admin-form-grid">
            <Field
              as="select"
              id="category"
              label="Categoria"
              error={error}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Selecione</option>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </Field>
            <Field id="brand" label="Marca" error={error} defaultValue={initial.brand} />
          </div>
          <Field as="textarea" id="description" label="Descrição" error={error} defaultValue={initial.description} />
        </section>

        <section className="admin-box" aria-labelledby="product-price-title">
          <h2 id="product-price-title" className="admin-box-title">
            Preço e estoque
          </h2>
          <div className="admin-form-grid">
            <Field id="price" label="Preço (R$)" error={error} inputMode="decimal" defaultValue={initial.price} />
            <Field
              id="oldPrice"
              label="Preço antigo (opcional)"
              hint="Preencha para anunciar como oferta. Deve ser maior que o preço."
              error={error}
              inputMode="decimal"
              defaultValue={initial.oldPrice}
            />
            {!service && (
              <Field id="stock" label="Estoque (unidades)" error={error} inputMode="numeric" defaultValue={initial.stock} />
            )}
            {!isNew && (
              <Field
                id="sold"
                label="Vendidos"
                hint="Atualizado a cada compra."
                value={formatNumber(product.sold ?? 0)}
                disabled
              />
            )}
          </div>
          {service && <p className="admin-box-hint">Serviços não têm estoque: são feitos sob agendamento.</p>}
        </section>

        {/* `key`: a new category starts with a fresh set of spec inputs */}
        <fieldset key={category} className="admin-box">
          <legend>Especificações técnicas</legend>
          {fields.length === 0 ? (
            <p className="admin-box-hint">Escolha a categoria para ver as especificações.</p>
          ) : (
            <div className="admin-form-grid">
              {fields.map((field) => (
                <SpecField key={field.key} field={field} specs={specs} error={error} />
              ))}
            </div>
          )}
        </fieldset>
      </div>

      <div className="admin-form-side">
        <section className="admin-box" aria-labelledby="product-photo-title">
          <h2 id="product-photo-title" className="admin-box-title">
            Foto
          </h2>
          {/* `key` reloads the preview (and its fallback) when the path changes */}
          <ProductImage
            key={`${photo}|${category}`}
            product={{ name, category, photo }}
            alt="Pré-visualização da foto"
            className="admin-photo-preview"
          />
          <Field
            id="photo"
            label="Caminho ou endereço da foto (opcional)"
            hint="Ex.: /products/ryzen7.jpeg. Sem foto, usamos a imagem padrão da categoria."
            error={error}
            list="photo-suggestions"
            defaultValue={initial.photo}
            onChange={(e) => setPhoto(e.target.value.trim())}
          />
          <datalist id="photo-suggestions">
            {PHOTO_SUGGESTIONS.map((path) => (
              <option key={path} value={path} />
            ))}
          </datalist>
        </section>

        {!isNew && (
          <section className="admin-box" aria-labelledby="product-meta-title">
            <h2 id="product-meta-title" className="admin-box-title">
              Item no catálogo
            </h2>
            <p className="admin-box-hint">ID {product.id}</p>
            <Link to={`/product/${product.id}`} className="admin-back-link" target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" />
              Ver na loja
              <span className="visually-hidden">(abre em nova aba)</span>
            </Link>
          </section>
        )}

        <div className="admin-box">
          {error && (
            <p id={ERROR_ID} className="admin-form-error" role="alert">
              {error.message}
            </p>
          )}
          <div className="admin-form-actions">
            <button type="submit" className="link-button" disabled={saving}>
              {saving ? "Salvando..." : isNew ? "Criar produto" : "Salvar alterações"}
            </button>
            <Link to={backPath} className="link-button secondary">
              Cancelar
            </Link>
          </div>
        </div>
      </div>
    </form>
  );
}

// Admin page to create (/admin/products/new) or edit (/admin/products/:id)
// a product or service. Saving goes back to the list with its filters.
export default function AdminProductForm() {
  const { id } = useParams();
  const location = useLocation();
  const { product, loading, error } = useProduct(id);

  // The list sends its search string, so "back" keeps filters and page
  const back = location.state?.back;
  const backPath = `/admin/products${typeof back === "string" && back.startsWith("?") ? back : ""}`;
  const isNew = id === undefined;

  let content;
  if (loading) {
    content = (
      <p className="page-message" role="status">
        Carregando produto...
      </p>
    );
  } else if (error) {
    content = (
      <div className="page-message error admin-message" role="alert">
        <p>{error.status === 404 ? "Produto não encontrado. Ele pode ter sido excluído." : error.message}</p>
        <Link to={backPath} className="link-button secondary">
          Voltar para a lista
        </Link>
      </div>
    );
  } else {
    content = <ProductForm key={id ?? "new"} product={product} backPath={backPath} />;
  }

  return (
    <div className="admin-page">
      <TopBar title="Produtos e serviços" />
      <div className="admin-content">
        <div>
          <Link to={backPath} className="admin-back-link">
            <ChevronLeft aria-hidden="true" />
            Voltar para a lista
          </Link>
          <h1 className="admin-title">{isNew ? "Novo produto" : "Editar produto"}</h1>
          {product && <p className="admin-subtitle">{product.name}</p>}
        </div>
        {content}
      </div>
    </div>
  );
}
