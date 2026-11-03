import "./OrderConfirmation.css";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { CircleCheck } from "lucide-react";
import OrderLines from "../components/store/OrderLines";
import { useAuth } from "../contexts/useAuth";
import { getOrder } from "../api/orders";
import { sameId } from "../api/http";
import { catalogPath } from "../utils/catalogQuery";
import { formatAddress, formatDateTime } from "../utils/format";

// Loads an order; orders of other clients are treated as not found
function useOrder(id, userId) {
  const [state, setState] = useState({ id: null, order: null, error: "", notFound: false });

  useEffect(() => {
    let cancelled = false;
    getOrder(id)
      .then((order) => {
        if (cancelled) return;
        const mine = sameId(order.userId, userId);
        setState({ id, order: mine ? order : null, error: "", notFound: !mine });
      })
      .catch((error) => {
        if (cancelled) return;
        setState({ id, order: null, error: error.message, notFound: error.status === 404 });
      });
    return () => {
      cancelled = true;
    };
  }, [id, userId]);

  return { ...state, loading: state.id !== id };
}

// Order confirmation page (mockup C09)
export default function OrderConfirmation() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const { order, loading, error, notFound } = useOrder(id, user.id);

  if (loading) {
    return (
      <div className="store-page">
        <p className="page-message" role="status">Carregando pedido...</p>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="store-page">
        <h1 className="order-title">Pedido não encontrado</h1>
        <p className={`page-message ${notFound ? "" : "error"}`} role={notFound ? undefined : "alert"}>
          {notFound ? "Não encontramos este pedido na sua conta." : error}
        </p>
      </div>
    );
  }

  // Right after checkout the page celebrates; from My Account it is a detail view
  const justPlaced = Boolean(location.state?.justPlaced);

  return (
    <div className="store-page order-page">
      <section className="order-confirmation" aria-labelledby="order-title">
        <CircleCheck className="order-icon" aria-hidden="true" />
        <h1 id="order-title" className="order-title">
          {justPlaced ? "Pedido confirmado!" : `Pedido #${order.id}`}
        </h1>
        <p className="order-lead">
          {justPlaced ? (
            <>
              Obrigado pela compra. O pagamento foi aprovado e o pedido <strong>#{order.id}</strong> já
              está em preparação.
            </>
          ) : (
            <>Feito em {formatDateTime(order.date)}.</>
          )}
        </p>
        {location.state?.cartNotCleared && (
          <p className="page-message error" role="alert">
            O pedido foi concluído, mas não conseguimos esvaziar o carrinho. Remova os itens manualmente
            antes de uma nova compra.
          </p>
        )}
      </section>

      <div className="order-details">
        <section aria-labelledby="order-items-title" className="order-box">
          <h2 id="order-items-title">Itens</h2>
          <OrderLines lines={order.items} total={order.total} />
        </section>

        <section aria-labelledby="order-info-title" className="order-box">
          <h2 id="order-info-title">Detalhes</h2>
          <dl className="order-info">
            <div>
              <dt>Data</dt>
              <dd>{formatDateTime(order.date)}</dd>
            </div>
            <div>
              <dt>Situação</dt>
              <dd>{order.status}</dd>
            </div>
            <div>
              <dt>Pagamento</dt>
              <dd>Cartão terminado em {order.cardLast4}</dd>
            </div>
            <div>
              <dt>Entrega</dt>
              <dd>{formatAddress(order.address)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="order-actions">
        <Link to={catalogPath({})} className="link-button">
          Continuar comprando
        </Link>
        <Link to="/account#pedidos" className="link-button secondary">
          Ver meus pedidos
        </Link>
      </div>
    </div>
  );
}
