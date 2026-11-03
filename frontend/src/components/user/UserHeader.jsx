import "./UserHeader.css";
import Logo from "../Logo";
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router";
import { Search, UserRound, ShoppingCart, LogOut } from "lucide-react";
import { useAuth } from "../../contexts/useAuth";
import { useCart } from "../../contexts/useCart";
import { CATALOG_SECTIONS } from "../../utils/categories";
import { catalogPath } from "../../utils/catalogQuery";

// First name only, to keep the header short
function firstName(name) {
  return (name || "").trim().split(/\s+/)[0] || "cliente";
}

// Category menu: catalog sections plus the PC builder
const MENU = [
  ...CATALOG_SECTIONS.filter((s) => s.slug !== "offers").map((s) => ({
    label: s.label,
    to: catalogPath({ category: s.slug }),
    category: s.slug,
  })),
  { label: "Computadores", to: "/monte-seu-pc" },
  { label: "Ofertas", to: catalogPath({ category: "offers" }), category: "offers", highlight: true },
];

export default function UserHeader() {
  const { user, logout } = useAuth();
  const { count, canShop } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Text currently searched in the catalog (shown in the search field)
  const currentQuery = location.pathname === "/catalog" ? (searchParams.get("q") ?? "") : "";
  const currentCategory = location.pathname === "/catalog" ? searchParams.get("category") : null;

  function handleLogout() {
    logout();
    navigate("/");
  }

  // Search opens the catalog filtered by name
  function handleSubmit(e) {
    e.preventDefault();
    const q = new FormData(e.target).get("search").toString().trim();
    navigate(catalogPath({ q }));
  }

  const cartLabel = count === 1 ? "Carrinho, 1 item" : `Carrinho, ${count} itens`;

  return (
    <header className="header-style">
      {/* Top bar */}
      <div className="free-delivery">
        <p>Frete grátis acima de R$ 499</p>
        <p>Central de Ajuda</p>
      </div>

      {/* Main header: logo, search, links, icons */}
      <div className="main-header">
        <Link to="/" aria-label="HardwareHub, página inicial">
          <Logo theme="light" className="logo-style" />
        </Link>

        {/* `key` refills the field when the searched text changes */}
        <form className="search-bar" role="search" onSubmit={handleSubmit} key={currentQuery}>
          <Search className="search-icon" aria-hidden="true" />
          <label htmlFor="header-search" className="visually-hidden">
            Buscar produtos e serviços
          </label>
          <input
            id="header-search"
            name="search"
            type="search"
            defaultValue={currentQuery}
            placeholder="Busque hardware e serviços..."
          />
        </form>

        <NavLink to="/monte-seu-pc" className="link-monte-seu-pc">
          Monte seu PC
        </NavLink>

        {/* Account area: login link for guests, name + logout when logged in */}
        {user ? (
          <div className="header-account">
            <UserRound className="user-icon" aria-hidden="true" />
            <span className="header-greeting">Olá, {firstName(user.name)}</span>
            {user.type === "admin" && (
              <NavLink to="/admin" className="header-account-link">
                Painel
              </NavLink>
            )}
            <button
              type="button"
              className="header-logout-button"
              onClick={handleLogout}
            >
              <LogOut aria-hidden="true" />
              Sair
            </button>
          </div>
        ) : (
          <NavLink to="/login" className="header-account-link">
            <UserRound className="user-icon" aria-hidden="true" />
            Entrar
          </NavLink>
        )}

        {/* Cart with item count; hidden for administrators, who cannot shop */}
        {(!user || canShop) && (
          <NavLink to="/cart" className="header-cart" aria-label={cartLabel}>
            <ShoppingCart className="shop-cart-icon" aria-hidden="true" />
            {count > 0 && (
              <span className="header-cart-badge" aria-hidden="true">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </NavLink>
        )}
      </div>

      {/* Product categories */}
      <nav className="search-classes" aria-label="Categorias">
        <ul>
          {MENU.map((item) => (
            <li key={item.label}>
              <Link
                to={item.to}
                className={item.highlight ? "product-class-red" : "product-class"}
                aria-current={item.category && item.category === currentCategory ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
