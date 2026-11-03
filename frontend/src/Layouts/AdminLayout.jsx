import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router";
import { LogOut, Menu, Store, X } from "lucide-react";
import "./AdminLayout.css";
import Logo from "../components/Logo";
import DocumentTitle from "../components/DocumentTitle";
import SkipLink from "../components/SkipLink";
import { useAuth } from "../contexts/useAuth";

// Layout for the admin area: sidebar + content area for nested routes.
// On phones the sidebar becomes a top bar and the menu opens with a
// button (aria-expanded). Access is restricted to administrators by
// RequireAuth in routes.jsx.
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  // Choosing a page closes the phone menu
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="layout">
      <DocumentTitle />
      <SkipLink />

      {/* Sidebar (banner landmark of the admin area) */}
      <header className="navbar">
        <div className="navbar-top">
          {/* Logo links back to the dashboard.
              "end" makes the link active only when the URL is exactly "/admin" */}
          <NavLink to="/admin" end aria-label="HardwareHub, dashboard" onClick={closeMenu}>
            <Logo className="logo" theme="dark" alt="" />
          </NavLink>

          {/* Only visible on phones */}
          <button
            type="button"
            className="navbar-menu-button"
            aria-expanded={menuOpen}
            aria-controls="admin-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            Menu
          </button>
        </div>

        <div id="admin-menu" className={`navbar-menu ${menuOpen ? "is-open" : ""}`}>
          {/* Menu links: NavLink adds the "active" class (and aria-current) to the current route */}
          <nav aria-label="Menu administrativo" onClick={closeMenu}>
            {/* "end" prevents this link from staying active on /admin/* routes */}
            <NavLink to="/admin" end>
              Dashboard
            </NavLink>
            <NavLink to="/admin/products">Produtos e serviços</NavLink>
            <NavLink to="/admin/clients">Clientes</NavLink>
            <NavLink to="/admin/admins">Administradores</NavLink>
          </nav>

          {/* Logged-in administrator, link to the store and logout */}
          <div className="navbar-user">
            <span className="navbar-user-name">{user?.name}</span>
            <span className="navbar-user-role">Administrador</span>
            <NavLink to="/" className="navbar-user-action">
              <Store aria-hidden="true" />
              Ver loja
            </NavLink>
            <button type="button" className="navbar-user-action" onClick={handleLogout}>
              <LogOut aria-hidden="true" />
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Content area: renders the child route matched under /admin.
          tabIndex -1: target of the skip link */}
      <main id="conteudo" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}
