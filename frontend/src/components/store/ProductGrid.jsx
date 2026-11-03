import "./ProductCard.css";
import ProductCard from "./ProductCard";

// Grid of product cards with loading, error and empty states.
// `list` is the object returned by useProductList().
export default function ProductGrid({ list, emptyMessage = "Nenhum produto encontrado.", headingLevel }) {
  if (list.loading) {
    return (
      <p className="page-message" role="status">
        Carregando produtos...
      </p>
    );
  }

  if (list.error) {
    return (
      <p className="page-message error" role="alert">
        {list.error}
      </p>
    );
  }

  if (list.data.length === 0) {
    return <p className="page-message">{emptyMessage}</p>;
  }

  return (
    <ul className="product-grid">
      {list.data.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} headingLevel={headingLevel} />
        </li>
      ))}
    </ul>
  );
}
