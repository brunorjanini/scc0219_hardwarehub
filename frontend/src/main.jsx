// Entry point of the React app
import { createRoot } from "react-dom/client";
import "./index.css";

// Auth Context (keeps the logged-in user, saved in localStorage)
import AuthProvider from "./contexts/AuthContext.jsx";

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
    <RouterProvider router={router} />
  </AuthProvider>,
);
