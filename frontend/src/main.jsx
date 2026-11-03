// Entry point of the React app
import { createRoot } from "react-dom/client";
import "./index.css";

// Contexts: logged-in user (saved in localStorage) and the client's cart
// (saved on the server). CartProvider needs the user, so it goes inside.
import AuthProvider from "./contexts/AuthContext.jsx";
import CartProvider from "./contexts/CartContext.jsx";

// Routing: router factory and the provider that renders it
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";

// Route table (pages, layouts and guards)
import { routes } from "./routes.jsx";

// Route configuration (uses the browser History API)
const router = createBrowserRouter(routes);

// Mount the app into the #root element and enable routing
createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <CartProvider>
      <RouterProvider router={router} />
    </CartProvider>
  </AuthProvider>,
);
