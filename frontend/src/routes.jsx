// Route table of the SPA. Kept apart from main.jsx so tests can render
// the real routes inside a memory router.
// `handle.title` names the page in the browser tab (DocumentTitle).

// Store layout (loaded with the app)
import UserLayout from "./Layouts/UserLayout.jsx";

// Route guard (login / admin role)
import RequireAuth from "./components/RequireAuth.jsx";

// Store pages most visitors open, part of the main bundle
import Home from "./pages/Home.jsx";
import Catalog from "./pages/Catalog.jsx";
import ProductDetail from "./pages/ProductDetail.jsx";
import Cart from "./pages/Cart.jsx";
import NotFound from "./pages/NotFound.jsx";

// Everything else downloads on first visit (see utils/lazyPage.js)
import { lazyPage } from "./utils/lazyPage";

const Builder = lazyPage(() => import("./pages/Builder.jsx"));
const Checkout = lazyPage(() => import("./pages/Checkout.jsx"));
const OrderConfirmation = lazyPage(() => import("./pages/OrderConfirmation.jsx"));
const Account = lazyPage(() => import("./pages/Account.jsx"));
const UserLogin = lazyPage(() => import("./pages/UserLogin.jsx"));
const UserSignIn = lazyPage(() => import("./pages/UserSignIn.jsx"));

const AdminLayout = lazyPage(() => import("./Layouts/AdminLayout.jsx"));
const AdminDashboard = lazyPage(() => import("./pages/AdminDashboard.jsx"));
const AdminProducts = lazyPage(() => import("./pages/AdminProducts.jsx"));
const AdminProductForm = lazyPage(() => import("./pages/AdminProductForm.jsx"));
const AdminUsers = lazyPage(() => import("./pages/AdminUsers.jsx"));
const AdminUserForm = lazyPage(() => import("./pages/AdminUserForm.jsx"));

const title = (text) => ({ title: text });

export const routes = [
  // Public storefront
  {
    path: "/",
    element: <UserLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "catalog", element: <Catalog />, handle: title("Catálogo") },
      { path: "product/:id", element: <ProductDetail />, handle: title("Produto") },
      { path: "login", element: <UserLogin />, handle: title("Entrar") },
      { path: "signup", element: <UserSignIn />, handle: title("Criar conta") },
      // Purchase flow: clients only (guests go to login, admins to home)
      { path: "cart", element: <RequireAuth role="user"><Cart /></RequireAuth>, handle: title("Carrinho") },
      { path: "checkout", element: <RequireAuth role="user"><Checkout /></RequireAuth>, handle: title("Pagamento") },
      {
        path: "order/:id",
        element: <RequireAuth role="user"><OrderConfirmation /></RequireAuth>,
        handle: title("Pedido"),
      },
      { path: "account", element: <RequireAuth role="user"><Account /></RequireAuth>, handle: title("Minha conta") },
      // PC Builder: open to everyone (adding to the cart asks for login)
      { path: "monte-seu-pc", element: <Builder />, handle: title("Monte seu PC") },
      // Any other address in the store
      { path: "*", element: <NotFound />, handle: title("Página não encontrada") },
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
    handle: title("Administração"),
    children: [
      // Default page at /admin
      { index: true, element: <AdminDashboard />, handle: title("Dashboard") },
      // /admin/products (list) + create and edit forms.
      // "new" is a static segment, so it wins over ":id".
      { path: "products", element: <AdminProducts />, handle: title("Produtos e serviços") },
      { path: "products/new", element: <AdminProductForm />, handle: title("Novo produto") },
      { path: "products/:id", element: <AdminProductForm />, handle: title("Editar produto") },
      // Clients and administrators share the list and the form (by `type`).
      // `key` makes React start fresh when moving between the two lists.
      { path: "clients", element: <AdminUsers key="user" type="user" />, handle: title("Clientes") },
      { path: "clients/new", element: <AdminUserForm key="user-new" type="user" />, handle: title("Novo cliente") },
      { path: "clients/:id", element: <AdminUserForm key="user-edit" type="user" />, handle: title("Editar cliente") },
      { path: "admins", element: <AdminUsers key="admin" type="admin" />, handle: title("Administradores") },
      {
        path: "admins/new",
        element: <AdminUserForm key="admin-new" type="admin" />,
        handle: title("Novo administrador"),
      },
      {
        path: "admins/:id",
        element: <AdminUserForm key="admin-edit" type="admin" />,
        handle: title("Editar administrador"),
      },
      // Unknown admin address
      { path: "*", element: <NotFound admin />, handle: title("Página não encontrada") },
    ],
  },
];
