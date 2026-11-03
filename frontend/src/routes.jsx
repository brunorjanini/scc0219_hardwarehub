// Route table of the SPA. Kept apart from main.jsx so tests can render
// the real routes inside a memory router.

// Layouts shared by groups of pages
import AdminLayout from "./Layouts/AdminLayout.jsx";
import UserLayout from "./Layouts/UserLayout.jsx";

// Route guard (login / admin role)
import RequireAuth from "./components/RequireAuth.jsx";

// Store pages
import Home from "./pages/Home.jsx";
import Catalog from "./pages/Catalog.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import ComingSoon from "./pages/ComingSoon.jsx";
import UserLogin from "./pages/UserLogin.jsx";
import UserSignIn from "./pages/UserSignIn.jsx";

// Admin pages
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminProducts from "./pages/AdminProducts.jsx";
import AdminClients from "./pages/AdminClients.jsx";
import AdminAdmins from "./pages/AdminAdmins.jsx";

export const routes = [
  // Public storefront
  {
    path: "/",
    element: <UserLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "catalog", element: <Catalog /> },
      { path: "product/:id", element: <ProductDetail /> },
      { path: "login", element: <UserLogin /> },
      { path: "signup", element: <UserSignIn /> },
      // Temporary pages until the cart (Task 4) and builder (Task 8) exist
      {
        path: "cart",
        element: (
          <RequireAuth>
            <ComingSoon
              title="Carrinho"
              text="A página do carrinho está em construção. Os itens adicionados já ficam salvos na sua conta."
            />
          </RequireAuth>
        ),
      },
      {
        path: "monte-seu-pc",
        element: (
          <ComingSoon
            title="Monte seu PC"
            text="O Montador de PC está em construção."
          />
        ),
      },
    ],
  },

  // Admin area: only administrators get past RequireAuth
  {
    path: "/admin",
    element: (
      <RequireAuth role="admin">
        <AdminLayout />
      </RequireAuth>
    ),
    children: [
      // Default page at /admin
      { index: true, element: <AdminDashboard /> },
      // /admin/products
      { path: "products", element: <AdminProducts /> },
      // /admin/clients
      { path: "clients", element: <AdminClients /> },
      // /admin/admins
      { path: "admins", element: <AdminAdmins /> },
    ],
  },
];
