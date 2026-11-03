import "./UserHeader.css";
import Logo from "../Logo";
import { NavLink, useNavigate } from "react-router";
import { Search, UserRound, ShoppingCart, LogOut } from "lucide-react";
import { useAuth } from "../../contexts/useAuth";

// First name only, to keep the header short
function firstName(name) {
  return (name || "").trim().split(/\s+/)[0] || "cliente";
}

export default function UserHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  // Handles the search form submit
  function handleSubmit(e) {
    // Avoid unexpect behavior
    e.preventDefault();

    const search = e.target.search.value;

    console.log("Pesquisando!" + search);
  }

  return (
    <div className="header-style">
      {/* Top bar */}
      <div className="free-delivery">
        <p>Frete grátis acima de R$ 499</p>
        <p>Central de Ajuda</p>
      </div>

      {/* Main header: logo, search, links, icons */}
      <div className="main-header">
        <Logo theme="light" className="logo-style" />

        <form className="search-bar" onSubmit={handleSubmit}>
          <Search className="search-icon" />
          <input
            name="search"
            placeholder="Busque hardware e serviços..."
          ></input>
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

        {/* Cart icon: becomes a link with item count in Task 3 */}
        <ShoppingCart className="shop-cart-icon" aria-hidden="true" />
      </div>

      {/* Product categories (missing "to" prop) */}
      <div className="search-classes">
        <ul>
          <NavLink className="product-class">Hardware</NavLink>
          <NavLink className="product-class">Periféricos</NavLink>
          <NavLink className="product-class">Computadores</NavLink>
          <NavLink className="product-class">Serviços</NavLink>
          <NavLink className="product-class-red">Ofertas</NavLink>
        </ul>
      </div>
    </div>
  );
}
