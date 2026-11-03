import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { useLocation } from "react-router";
import RequireAuth from "./RequireAuth";
import { ADMIN_SESSION, CLIENT_SESSION, renderWithRouter } from "../test/renderWithRouter";
import { routes } from "../routes";

// Shows where the guard sent the user and the saved "from" location
function LoginStub() {
  const location = useLocation();
  return <p>login page (from {location.state?.from?.pathname ?? "none"})</p>;
}

const testRoutes = [
  { path: "/", element: <p>home page</p> },
  { path: "/login", element: <LoginStub /> },
  { path: "/account", element: <RequireAuth><p>account page</p></RequireAuth> },
  { path: "/admin", element: <RequireAuth role="admin"><p>admin page</p></RequireAuth> },
];

describe("RequireAuth", () => {
  it("sends guests to /login and remembers where they came from", () => {
    renderWithRouter(testRoutes, { path: "/account" });
    expect(screen.getByText("login page (from /account)")).toBeInTheDocument();
  });

  it("lets any logged-in user through when no role is required", () => {
    renderWithRouter(testRoutes, { path: "/account", session: CLIENT_SESSION });
    expect(screen.getByText("account page")).toBeInTheDocument();
  });

  it("sends clients away from admin pages", () => {
    renderWithRouter(testRoutes, { path: "/admin", session: CLIENT_SESSION });
    expect(screen.getByText("home page")).toBeInTheDocument();
  });

  it("lets administrators into admin pages", () => {
    renderWithRouter(testRoutes, { path: "/admin", session: ADMIN_SESSION });
    expect(screen.getByText("admin page")).toBeInTheDocument();
  });
});

describe("app routes", () => {
  it.each(["/admin", "/admin/products", "/admin/clients", "/admin/admins"])(
    "%s is closed to guests",
    async (path) => {
      const { router } = renderWithRouter(routes, { path });
      expect(await screen.findByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe("/login");
    },
  );

  it("/admin is closed to clients", async () => {
    const { router } = renderWithRouter(routes, { path: "/admin/products", session: CLIENT_SESSION });
    expect(await screen.findByRole("heading", { name: /Olá, Ana/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
  });

  it("serves the sign-up page at /signup", async () => {
    renderWithRouter(routes, { path: "/signup" });
    expect(await screen.findByRole("heading", { name: "Crie sua conta" })).toBeInTheDocument();
  });
});
