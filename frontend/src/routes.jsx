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
import Cart from "./pages/Cart.jsx";
import Checkout from "./pages/Checkout.jsx";
import OrderConfirmation from "./pages/OrderConfirmation.jsx";
import Account from "./pages/Account.jsx";
import UserLogin from "./pages/UserLogin.jsx";
import UserSignIn from "./pages/UserSignIn.jsx";

// Admin pages
import AdminDashboard from "./pages/AdminDashboard.jsx";
import AdminProducts from "./pages/AdminProducts.jsx";
import AdminProductForm from "./pages/AdminProductForm.jsx";
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
      // Purchase flow: clients only (guests go to login, admins to home)
      { path: "cart", element: <RequireAuth role="user"><Cart /></RequireAuth> },
      { path: "checkout", element: <RequireAuth role="user"><Checkout /></RequireAuth> },
      { path: "order/:id", element: <RequireAuth role="user"><OrderConfirmation /></RequireAuth> },
      { path: "account", element: <RequireAuth role="user"><Account /></RequireAuth> },
      // Temporary page until the builder (Task 8) exists
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
      // /admin/products (list) + create and edit forms.
      // "new" is a static segment, so it wins over ":id".
      { path: "products", element: <AdminProducts /> },
      { path: "products/new", element: <AdminProductForm /> },
      { path: "products/:id", element: <AdminProductForm /> },
      // /admin/clients
      { path: "clients", element: <AdminClients /> },
      // /admin/admins
      { path: "admins", element: <AdminAdmins /> },
    ],
  },
];
