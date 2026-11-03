import "./ProductCard.css";
import { Link } from "react-router";
import ProductImage from "./ProductImage";
import StockBadge from "./StockBadge";
import AddToCartButton from "./AddToCartButton";
import { categoryLabel } from "../../utils/categories";
import { formatPrice } from "../../utils/format";

// Product summary used in the home page and the catalog grid
export default function ProductCard({ product, headingLevel = "h3" }) {
  const Heading = headingLevel;
  const onSale = product.oldPrice > product.price;

  return (
    <article className="product-card">
      {/* The name below already describes the product, so the image is decorative */}
      <ProductImage product={product} alt="" className="product-card-image" />

      <p className="product-card-category">{categoryLabel(product.category)}</p>
      <Heading className="product-card-name">
        <Link to={`/product/${product.id}`}>{product.name}</Link>
      </Heading>

      <StockBadge product={product} />

      <div className="product-card-prices">
        {onSale && (
          <p className="product-card-old-price">
            <span className="visually-hidden">De </span>
            <s>{formatPrice(product.oldPrice)}</s>
          </p>
        )}
        <p className="product-card-price">
          {onSale && <span className="visually-hidden">Por </span>}
          {formatPrice(product.price)}
        </p>
      </div>

      <AddToCartButton product={product} />
    </article>
  );
}
