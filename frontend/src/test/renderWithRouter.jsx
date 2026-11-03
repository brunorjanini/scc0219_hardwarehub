// Test helper: renders routes inside AuthProvider + a memory router,
// starting at `path`. Pass `session` to start logged in.
import { render } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import AuthProvider from "../contexts/AuthContext";
import { SESSION_KEY } from "../contexts/auth";

export function renderWithRouter(routes, { path = "/", session } = {}) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const result = render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );

  return { ...result, router };
}

// Sessions used across tests
export const CLIENT_SESSION = { id: "1", type: "user", name: "Ana Souza" };
export const ADMIN_SESSION = { id: "3", type: "admin", name: "Administrador" };
