import "./ProductDetail.css";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ChevronRight } from "lucide-react";
import ProductImage from "../components/store/ProductImage";
import StockBadge from "../components/store/StockBadge";
import QuantitySelector from "../components/store/QuantitySelector";
import AddToCartButton from "../components/store/AddToCartButton";
import { getProduct } from "../api/products";
import { categoryLabel } from "../utils/categories";
import { catalogPath } from "../utils/catalogQuery";
import { formatPrice } from "../utils/format";
import { formatSpecs } from "../utils/specs";
import { isService, maxPurchasable, stockStatus } from "../utils/stock";

// Loads one product; `notFound` is true for a 404 (deleted or wrong id)
function useProduct(id) {
  const [state, setState] = useState({ id: null, product: null, error: "", notFound: false });

  useEffect(() => {
    let cancelled = false;
    getProduct(id)
      .then((product) => {
        if (!cancelled) setState({ id, product, error: "", notFound: false });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ id, product: null, error: error.message, notFound: error.status === 404 });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { ...state, loading: state.id !== id };
}

// Quantity + add to cart. Rendered with key={product.id}, so the
// quantity goes back to 1 when another product opens.
function PurchaseBox({ product }) {
  const [quantity, setQuantity] = useState(1);
  const max = maxPurchasable(product);
  const { available } = stockStatus(product);

  return (
    <div className="product-detail-purchase">
      {available && (
        <QuantitySelector value={quantity} max={max} onChange={setQuantity} />
      )}
      {!isService(product) && available && (
        <p className="product-detail-stock-count">
          {product.stock === 1 ? "1 unidade disponível" : `${product.stock} unidades disponíveis`}
        </p>
      )}
      <AddToCartButton product={product} quantity={quantity} label="Adicionar ao carrinho" />
    </div>
  );
}

// Product page (mockup C05): photo, price, availability, description and specs
export default function ProductDetail() {
  const { id } = useParams();
  const { product, loading, error, notFound } = useProduct(id);

  if (loading) {
    return (
      <div className="store-page">
        <p className="page-message" role="status">Carregando produto...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="store-page">
        <h1 className="product-detail-missing">Produto não encontrado</h1>
        <p className="page-message">
          Este produto não existe ou foi removido do catálogo.
        </p>
        <Link to={catalogPath({})} className="link-button product-detail-back">
          Voltar ao catálogo
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="store-page">
        <p className="page-message error" role="alert">{error}</p>
      </div>
    );
  }

  const specs = formatSpecs(product.specs);
  const onSale = product.oldPrice > product.price;
  const label = categoryLabel(product.category);

  return (
    <div className="store-page product-detail-page">
      {/* Breadcrumb */}
      <nav aria-label="Você está em" className="product-detail-breadcrumb">
        <ol>
          <li>
            <Link to="/">Início</Link>
            <ChevronRight aria-hidden="true" />
          </li>
          <li>
            <Link to={catalogPath({ category: product.category })}>{label}</Link>
            <ChevronRight aria-hidden="true" />
          </li>
          <li aria-current="page">{product.name}</li>
        </ol>
      </nav>

      <article className="product-detail">
        <ProductImage product={product} className="product-detail-image" />

        <div className="product-detail-info">
          <p className="product-detail-category">
            {label} · {product.brand}
          </p>
          <h1>{product.name}</h1>
          <StockBadge product={product} />

          <div className="product-detail-prices">
            {onSale && (
              <p className="product-detail-old-price">
                <span className="visually-hidden">De </span>
                <s>{formatPrice(product.oldPrice)}</s>
              </p>
            )}
            <p className="product-detail-price">
              {onSale && <span className="visually-hidden">Por </span>}
              {formatPrice(product.price)}
            </p>
            <p className="product-detail-installments">
              ou 12x de {formatPrice(product.price / 12)} sem juros
            </p>
          </div>

          <PurchaseBox key={product.id} product={product} />

          <section aria-labelledby="description-title">
            <h2 id="description-title" className="product-detail-subtitle">Descrição</h2>
            <p className="product-detail-description">{product.description}</p>
          </section>
        </div>
      </article>

      {specs.length > 0 && (
        <section className="product-detail-specs" aria-labelledby="specs-title">
          <h2 id="specs-title" className="product-detail-subtitle">
            {isService(product) ? "Detalhes do serviço" : "Especificações técnicas"}
          </h2>
          <table>
            <tbody>
              {specs.map((spec) => (
                <tr key={spec.key}>
                  <th scope="row">{spec.label}</th>
                  <td>{spec.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
