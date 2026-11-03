import "./Checkout.css";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { CreditCard, Lock } from "lucide-react";
import OrderLines from "../components/store/OrderLines";
import { useAuth } from "../contexts/useAuth";
import { useCart } from "../contexts/useCart";
import { useCartProducts } from "../hooks/useCartProducts";
import { getUser } from "../api/users";
import { buildCartLines, cartTotal, placeOrder } from "../utils/checkout";
import { formatPrice } from "../utils/format";
import { validateCardNumber, validateZip } from "../utils/validators";

const EMPTY_ADDRESS = { street: "", number: "", city: "", zip: "" };

// Saved address of the client, used to prefill the form.
// Falls back to empty fields if the profile cannot be loaded.
function useSavedAddress(userId) {
  const [state, setState] = useState({ userId: null, address: EMPTY_ADDRESS });

  useEffect(() => {
    let cancelled = false;
    getUser(userId)
      .then((profile) => {
        if (!cancelled) setState({ userId, address: { ...EMPTY_ADDRESS, ...profile.address } });
      })
      .catch(() => {
        if (!cancelled) setState({ userId, address: EMPTY_ADDRESS });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { address: state.address, loading: state.userId !== userId };
}

// Returns the first error message of the payment form, or ""
function validatePayment({ street, number, city, zip, cardNumber }) {
  if (!street || !number || !city || !zip) return "Preencha o endereço de entrega";
  return validateZip(zip) || validateCardNumber(cardNumber);
}

// Labeled text field of this form
function Field({ id, label, ...inputProps }) {
  return (
    <div className="checkout-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={id} {...inputProps} />
    </div>
  );
}

// Checkout page (mockup C08): delivery address + card number.
// Any card number is accepted (assignment rule); only the last 4 digits
// are saved with the order.
export default function Checkout() {
  const { user } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const { products, loading: productsLoading, error: productsError } = useCartProducts(cart.items);
  const { address, loading: addressLoading } = useSavedAddress(user.id);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  // Set after a successful payment, so the now-empty cart does not send
  // the client back to /cart while navigating to the confirmation
  const [placed, setPlaced] = useState(false);
  const messageRef = useRef(null);

  // Move focus to the error so keyboard and screen reader users notice it
  useEffect(() => {
    if (message) messageRef.current?.focus();
  }, [message]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    const form = new FormData(e.target);
    const get = (name) => (form.get(name) ?? "").toString().trim();
    const values = {
      street: get("street"),
      number: get("number"),
      city: get("city"),
      zip: get("zip"),
      cardNumber: get("cardNumber"),
    };

    const error = validatePayment(values);
    if (error) {
      setMessage(error);
      return;
    }

    setSubmitting(true);
    setMessage("");
    try {
      const order = await placeOrder({
        userId: user.id,
        items: cart.items,
        address: { street: values.street, number: values.number, city: values.city, zip: values.zip },
        cardNumber: values.cardNumber,
      });
      setPlaced(true);

      // Payment done: the cart is emptied (assignment rule)
      const cleared = await cart.clearCart();
      navigate(`/order/${order.id}`, {
        replace: true,
        state: { cartNotCleared: Boolean(cleared.error) },
      });
    } catch (placeError) {
      setMessage(placeError.message);
      setSubmitting(false);
    }
  }

  if (cart.status === "loading" || addressLoading || (cart.items.length > 0 && productsLoading)) {
    return (
      <div className="store-page">
        <h1 className="checkout-title">Pagamento</h1>
        <p className="page-message" role="status">Carregando...</p>
      </div>
    );
  }

  if (cart.status === "error" || productsError) {
    return (
      <div className="store-page">
        <h1 className="checkout-title">Pagamento</h1>
        <p className="page-message error" role="alert">{cart.error || productsError}</p>
      </div>
    );
  }

  if (placed) {
    return (
      <div className="store-page">
        <p className="page-message" role="status">Pagamento aprovado. Abrindo o pedido...</p>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  const lines = buildCartLines(cart.items, products);
  // Problems are shown and fixed in the cart page
  if (lines.some((line) => line.problem)) {
    return <Navigate to="/cart" replace />;
  }
  const total = cartTotal(lines);

  return (
    <div className="store-page checkout-page">
      <h1 className="checkout-title">Pagamento</h1>

      <div className="checkout-body">
        <form className="checkout-form" onSubmit={handleSubmit} noValidate aria-describedby={message ? "checkout-message" : undefined}>
          {message && (
            <p id="checkout-message" className="page-message error" role="alert" tabIndex={-1} ref={messageRef}>
              {message}
            </p>
          )}

          <fieldset>
            <legend>Endereço de entrega</legend>
            <div className="checkout-row">
              <Field id="street" label="Rua" defaultValue={address.street} autoComplete="address-line1" />
              <Field id="number" label="Número" defaultValue={address.number} className="checkout-short" />
            </div>
            <div className="checkout-row">
              <Field id="city" label="Cidade" defaultValue={address.city} autoComplete="address-level2" />
              <Field id="zip" label="CEP" defaultValue={address.zip} autoComplete="postal-code" inputMode="numeric" className="checkout-short" />
            </div>
          </fieldset>

          <fieldset>
            <legend>Pagamento</legend>
            <div className="checkout-card">
              <CreditCard aria-hidden="true" />
              <Field
                id="cardNumber"
                label="Número do cartão"
                autoComplete="cc-number"
                inputMode="numeric"
                placeholder="0000 0000 0000 0000"
              />
            </div>
            <p className="checkout-hint">
              Ambiente de demonstração: qualquer número de cartão é aceito. Guardamos apenas os 4 últimos dígitos.
            </p>
          </fieldset>

          <button type="submit" className="link-button checkout-submit" disabled={submitting}>
            <Lock aria-hidden="true" />
            {submitting ? "Processando pagamento..." : `Pagar ${formatPrice(total)}`}
          </button>
          <Link to="/cart" className="checkout-back">
            Voltar ao carrinho
          </Link>
        </form>

        <aside className="checkout-summary" aria-labelledby="checkout-summary-title">
          <h2 id="checkout-summary-title">Resumo do pedido</h2>
          <OrderLines
            lines={lines.map(({ productId, product, quantity }) => ({
              productId,
              name: product.name,
              price: product.price,
              quantity,
            }))}
            total={total}
          />
        </aside>
      </div>
    </div>
  );
}
