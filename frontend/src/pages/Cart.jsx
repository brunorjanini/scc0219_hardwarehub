import "./Cart.css";
import { useState } from "react";
import { Link } from "react-router";
import { ShoppingCart, Trash2, TriangleAlert } from "lucide-react";
import ProductImage from "../components/store/ProductImage";
import QuantitySelector from "../components/store/QuantitySelector";
import { useCart } from "../contexts/useCart";
import { useCartProducts } from "../hooks/useCartProducts";
import { buildCartLines, cartTotal, lineCount } from "../utils/checkout";
import { catalogPath } from "../utils/catalogQuery";
import { formatPrice } from "../utils/format";
import { isService, maxPurchasable } from "../utils/stock";

// One cart line: photo, name, unit price, quantity, subtotal and remove
function CartLine({ line }) {
  const { setQuantity, removeItem } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { product } = line;
  const name = product?.name ?? "Produto indisponível";

  async function run(change) {
    setBusy(true);
    setError("");
    const result = await change();
    setBusy(false);
    if (result.error) setError(result.error);
  }

  return (
    <li className={`cart-line ${line.problem ? "has-problem" : ""}`}>
      {product ? (
        <ProductImage product={product} alt="" className="cart-line-image" />
      ) : (
        <div className="cart-line-image cart-line-image-missing" aria-hidden="true">
          <TriangleAlert />
        </div>
      )}

      <div className="cart-line-info">
        {product ? (
          <Link to={`/product/${product.id}`} className="cart-line-name">
            {name}
          </Link>
        ) : (
          <p className="cart-line-name">{name}</p>
        )}
        {product && (
          <p className="cart-line-unit">
            {formatPrice(product.price)} {isService(product) ? "por serviço" : "cada"}
          </p>
        )}
        {line.problem && (
          <p className="cart-line-problem">
            <TriangleAlert aria-hidden="true" />
            {line.problem}
          </p>
        )}
        {error && (
          <p className="cart-line-problem" role="alert">
            {error}
          </p>
        )}
      </div>

      {product && maxPurchasable(product) > 0 && (
        <QuantitySelector
          id={`quantity-${line.productId}`}
          itemName={name}
          value={line.quantity}
          max={Math.max(maxPurchasable(product), line.quantity)}
          disabled={busy}
          onChange={(quantity) => run(() => setQuantity(product, quantity))}
        />
      )}

      <p className="cart-line-subtotal">
        <span className="visually-hidden">Subtotal: </span>
        {formatPrice(line.subtotal)}
      </p>

      <button
        type="button"
        className="cart-line-remove"
        onClick={() => run(() => removeItem(line.productId))}
        disabled={busy}
        aria-label={`Remover ${name} do carrinho`}
      >
        <Trash2 aria-hidden="true" />
      </button>
    </li>
  );
}

// "Esvaziar carrinho" asks for confirmation before clearing
function ClearCartButton() {
  const { clearCart } = useCart();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    const result = await clearCart();
    if (result.error) setError(result.error);
    setConfirming(false);
  }

  if (!confirming) {
    return (
      <>
        <button type="button" className="cart-clear" onClick={() => setConfirming(true)}>
          <Trash2 aria-hidden="true" />
          Esvaziar carrinho
        </button>
        {error && <p className="cart-line-problem" role="alert">{error}</p>}
      </>
    );
  }

  return (
    <div className="cart-clear-confirm" role="group" aria-label="Confirmar esvaziar carrinho">
      <p>Remover todos os itens do carrinho?</p>
      <div>
        <button type="button" className="link-button" onClick={handleConfirm}>
          Sim, esvaziar
        </button>
        <button type="button" className="link-button secondary" onClick={() => setConfirming(false)}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// Cart page (mockup C07). Prices and stock come fresh from the server;
// lines with a problem (deleted product, not enough stock) block checkout.
export default function Cart() {
  const cart = useCart();
  const { products, loading, error } = useCartProducts(cart.items);

  if (cart.status === "loading" || (cart.items.length > 0 && loading)) {
    return (
      <div className="store-page">
        <h1 className="cart-title">Carrinho</h1>
        <p className="page-message" role="status">Carregando carrinho...</p>
      </div>
    );
  }

  if (cart.status === "error" || error) {
    return (
      <div className="store-page">
        <h1 className="cart-title">Carrinho</h1>
        <p className="page-message error" role="alert">{cart.error || error}</p>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="store-page">
        <h1 className="cart-title">Carrinho</h1>
        <div className="page-message cart-empty">
          <ShoppingCart aria-hidden="true" />
          <p>Seu carrinho está vazio.</p>
          <Link to={catalogPath({})} className="link-button">
            Ver catálogo
          </Link>
        </div>
      </div>
    );
  }

  const lines = buildCartLines(cart.items, products);
  const units = lineCount(lines);
  const blocked = lines.some((line) => line.problem);

  return (
    <div className="store-page cart-page">
      <h1 className="cart-title">Carrinho</h1>

      <div className="cart-body">
        <section aria-label="Itens do carrinho">
          <ul className="cart-lines">
            {lines.map((line) => (
              <CartLine key={line.productId} line={line} />
            ))}
          </ul>
          <ClearCartButton />
        </section>

        <aside className="cart-summary" aria-labelledby="cart-summary-title">
          <h2 id="cart-summary-title">Resumo</h2>
          <dl>
            <div>
              <dt>{units === 1 ? "1 item" : `${units} itens`}</dt>
              <dd>{formatPrice(cartTotal(lines))}</dd>
            </div>
            <div>
              <dt>Frete</dt>
              <dd>Grátis</dd>
            </div>
            <div className="cart-summary-total">
              <dt>Total</dt>
              <dd>{formatPrice(cartTotal(lines))}</dd>
            </div>
          </dl>

          {blocked ? (
            <>
              <p className="cart-line-problem" id="cart-blocked">
                <TriangleAlert aria-hidden="true" />
                Resolva os itens destacados para continuar.
              </p>
              <span className="link-button is-disabled cart-checkout" aria-disabled="true" aria-describedby="cart-blocked">
                Finalizar compra
              </span>
            </>
          ) : (
            <Link to="/checkout" className="link-button cart-checkout">
              Finalizar compra
            </Link>
          )}
          <Link to={catalogPath({})} className="cart-continue">
            Continuar comprando
          </Link>
        </aside>
      </div>
    </div>
  );
}
