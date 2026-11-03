import TopBar from "../components/admin/TopBar";
import "./AdminDashboard.css";
import { useEffect, useState } from "react";
import { ChartNoAxesColumnIncreasing, CircleDollarSign, PackageX, RefreshCw, ShoppingBag } from "lucide-react";
import DashboardCard from "../components/admin/DashboardCard";
import SellingChart from "../components/admin/SellingChart";
import { listOrders } from "../api/orders";
import { listProducts } from "../api/products";
import { listUsers } from "../api/users";
import { dashboardStats } from "../utils/dashboardStats";
import { formatDateTime, formatNumber, formatPrice } from "../utils/format";

// Loads orders, products and users together. Bumping `reloadKey` reloads;
// the previous numbers stay on screen meanwhile.
function useDashboardData(reloadKey) {
  const [state, setState] = useState({ key: null, data: null, loadedAt: null, error: "" });

  useEffect(() => {
    let cancelled = false;
    Promise.all([listOrders(), listProducts(), listUsers()])
      .then(([orders, products, users]) => {
        if (!cancelled) setState({ key: reloadKey, data: { orders, products, users }, loadedAt: new Date(), error: "" });
      })
      .catch((error) => {
        if (!cancelled) setState((previous) => ({ ...previous, key: reloadKey, error: error.message }));
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return { ...state, loading: state.key !== reloadKey };
}

const units = (n) => (n === 1 ? "1 item" : `${formatNumber(n)} itens`);

// One line of "Pedidos recentes"
function RecentOrder({ order }) {
  return (
    <li className="actv-box">
      <div className="actv-icon-box" aria-hidden="true">
        <ShoppingBag />
      </div>
      <div className="actv-descr">
        <h3>
          Pedido #{order.id} · {formatPrice(order.total)}
        </h3>
        <p>
          {order.customer} · {units(order.units)} · <time dateTime={order.date.toISOString()}>{order.ago}</time>
        </p>
      </div>
    </li>
  );
}

// Admin home: this month's numbers compared with the previous month,
// stock alerts, revenue of the last 7 days and the latest orders, all
// computed from the mock server data (utils/dashboardStats.js).
export default function AdminDashboard() {
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loadedAt, error, loading } = useDashboardData(reloadKey);
  const stats = data ? dashboardStats(data, loadedAt) : null;

  return (
    <div className="dashboard-page">
      <TopBar title="Dashboard" />

      <div className="dashboard-main">
        <div className="subtitle-box">
          <div>
            <h2>Visão Geral</h2>
            <p role="status">
              {loading
                ? "Atualizando dados..."
                : loadedAt
                  ? `Dados atualizados em ${formatDateTime(loadedAt)}`
                  : ""}
            </p>
          </div>
          <button
            type="button"
            className="link-button secondary dashboard-refresh"
            onClick={() => setReloadKey((n) => n + 1)}
            disabled={loading}
          >
            <RefreshCw aria-hidden="true" />
            Atualizar
          </button>
        </div>

        {error && (
          <div className="page-message error dashboard-message" role="alert">
            <p>{error}</p>
            <button type="button" className="link-button secondary" onClick={() => setReloadKey((n) => n + 1)}>
              Tentar novamente
            </button>
          </div>
        )}

        {!stats && !error && (
          <p className="page-message dashboard-message" role="status">
            Carregando dados...
          </p>
        )}

        {stats && (
          <>
            <div className="general-infos">
              <DashboardCard
                title="Receita no mês"
                value={formatPrice(stats.month.revenue)}
                comment={stats.comments.revenue.text}
                tone={stats.comments.revenue.tone}
              >
                <CircleDollarSign />
              </DashboardCard>
              <DashboardCard
                title="Pedidos no mês"
                value={formatNumber(stats.month.orders)}
                comment={stats.comments.orders.text}
                tone={stats.comments.orders.tone}
              >
                <ShoppingBag />
              </DashboardCard>
              <DashboardCard
                title="Ticket médio"
                value={stats.month.orders ? formatPrice(stats.month.ticket) : "–"}
                comment={stats.comments.ticket.text}
                tone={stats.comments.ticket.tone}
              >
                <ChartNoAxesColumnIncreasing />
              </DashboardCard>
              <DashboardCard
                title="Produtos sem estoque"
                value={formatNumber(stats.stock.out)}
                comment={`${formatNumber(stats.stock.low)} com últimas unidades`}
                tone={stats.stock.out > 0 ? "down" : "neutral"}
              >
                <PackageX />
              </DashboardCard>
            </div>

            <div className="chart-and-activities">
              <SellingChart
                title="Vendas nos últimos 7 dias"
                data={stats.days.map((day) => ({
                  dia: day.label,
                  valor: day.total,
                  destaque: day.isToday,
                  descricao: day.longLabel,
                }))}
              />
              <section className="activities-box" aria-labelledby="recent-orders-title">
                <h2 id="recent-orders-title">Pedidos recentes</h2>
                {stats.recent.length === 0 ? (
                  <p className="activities-empty">Nenhum pedido ainda.</p>
                ) : (
                  <ul className="activities-list">
                    {stats.recent.map((order) => (
                      <RecentOrder key={order.id} order={order} />
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
