import { NavLink, Outlet, useNavigate } from "react-router";
import { LogOut, Store } from "lucide-react";
import "./AdminLayout.css";
import Logo from "../components/Logo";
import { useAuth } from "../contexts/useAuth";

// Layout for the admin area: fixed sidebar + content area for nested routes.
// Access is restricted to administrators by RequireAuth in routes.jsx.
export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <>
      <div className="layout">
        {/* Sidebar */}
        <div className="navbar">
          {/* Logo links back to the dashboard.
              "end" makes the link active only when the URL is exactly "/admin" */}
          <NavLink to="/admin" end aria-label="Dashboard">
            <Logo className="logo" theme="dark" />
          </NavLink>

          {/* Menu links: NavLink adds the "active" class to the current route */}
          <nav aria-label="Menu administrativo">
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
            <button
              type="button"
              className="navbar-user-action"
              onClick={handleLogout}
            >
              <LogOut aria-hidden="true" />
              Sair
            </button>
          </div>
        </div>

        {/* Content area: renders the child route matched under /admin */}
        <main>
          <Outlet />
        </main>
      </div>
    </>
  );
}
