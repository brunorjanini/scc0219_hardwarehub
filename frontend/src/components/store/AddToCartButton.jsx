import "./AddToCartButton.css";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ShoppingCart } from "lucide-react";
import { useAuth } from "../../contexts/useAuth";
import { useCart } from "../../contexts/useCart";
import { stockStatus } from "../../utils/stock";

// "Adicionar" button used by product cards and the product page.
// Guests are sent to /login and come back to this page afterwards
// (RequireAuth-style `state.from`, handled by UserLogin).
export default function AddToCartButton({ product, quantity = 1, label = "Adicionar" }) {
  const { user } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState({ text: "", tone: "" });

  if (!stockStatus(product).available) {
    return (
      <div className="add-to-cart">
        <button type="button" className="add-to-cart-button" disabled>
          Indisponível
        </button>
      </div>
    );
  }

  async function handleClick() {
    if (!user) {
      navigate("/login", { state: { from: location } });
      return;
    }

    setBusy(true);
    const result = await addItem(product, quantity);
    setBusy(false);
    setFeedback(
      result.error
        ? { text: result.error, tone: "error" }
        : { text: "Adicionado ao carrinho", tone: "success" },
    );
  }

  return (
    <div className="add-to-cart">
      <button
        type="button"
        className="add-to-cart-button"
        onClick={handleClick}
        disabled={busy}
        aria-label={`Adicionar ${product.name} ao carrinho`}
      >
        <ShoppingCart aria-hidden="true" />
        {busy ? "Adicionando..." : label}
      </button>
      {/* Announced by screen readers when the text changes */}
      <p className={`add-to-cart-feedback ${feedback.tone}`} role="status">
        {feedback.text}
      </p>
    </div>
  );
}
