import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserLogin from "./UserLogin";
import RequireAuth from "../components/RequireAuth";
import { CLIENT_SESSION, renderWithRouter } from "../test/renderWithRouter";
import { SESSION_KEY } from "../contexts/auth";
import { findUsersByEmail, findUsersByUsername } from "../api/users";
import { ApiError } from "../api/http";

vi.mock("../api/users", () => ({
  findUsersByEmail: vi.fn(),
  findUsersByUsername: vi.fn(),
}));

const admin = { id: "3", type: "admin", name: "Administrador", username: "admin", email: "admin@hardwarehub.com", password: "admin" };
const client = { id: "1", type: "user", name: "Ana Souza", email: "user@gmail.com", password: "Password123" };

// Stub pages: the test only checks where the user ends up
const routes = [
  { path: "/", element: <p>home page</p> },
  { path: "/login", element: <UserLogin /> },
  { path: "/admin", element: <p>admin page</p> },
  { path: "/cart", element: <RequireAuth><p>cart page</p></RequireAuth> },
];

// Redirect happens 1s after the success message
const REDIRECT = { timeout: 2500 };

async function fillAndSubmit(identifier, password) {
  const user = userEvent.setup();
  if (identifier) await user.type(screen.getByLabelText("E-mail ou usuário"), identifier);
  if (password) await user.type(screen.getByLabelText("Senha"), password);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
}

beforeEach(() => {
  findUsersByEmail.mockReset().mockResolvedValue([]);
  findUsersByUsername.mockReset().mockResolvedValue([]);
});

describe("UserLogin", () => {
  it("logs in admin/admin, saves the session and opens the admin panel", async () => {
    findUsersByUsername.mockResolvedValue([admin]);
    renderWithRouter(routes, { path: "/login" });

    await fillAndSubmit("admin", "admin");

    expect(await screen.findByText("Login realizado com sucesso")).toBeInTheDocument();
    expect(await screen.findByText("admin page", {}, REDIRECT)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(SESSION_KEY))).toEqual({
      id: "3",
      type: "admin",
      name: "Administrador",
    });
  });

  it("logs in a client by email and goes to the home page", async () => {
    findUsersByEmail.mockResolvedValue([client]);
    renderWithRouter(routes, { path: "/login" });

    await fillAndSubmit("user@gmail.com", "Password123");

    expect(await screen.findByText("home page", {}, REDIRECT)).toBeInTheDocument();
  });

  it("returns to the protected page that sent the user to login", async () => {
    findUsersByEmail.mockResolvedValue([client]);
    renderWithRouter(routes, { path: "/cart" });

    // RequireAuth sent the guest here
    expect(screen.getByRole("heading", { name: "Bem-vindo de volta" })).toBeInTheDocument();
    await fillAndSubmit("user@gmail.com", "Password123");

    expect(await screen.findByText("cart page", {}, REDIRECT)).toBeInTheDocument();
  });

  it("shows an error for a wrong password and stays logged out", async () => {
    findUsersByUsername.mockResolvedValue([admin]);
    renderWithRouter(routes, { path: "/login" });

    await fillAndSubmit("admin", "errada");

    expect(await screen.findByText("Senha incorreta")).toBeInTheDocument();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("stops at empty fields without calling the server", async () => {
    renderWithRouter(routes, { path: "/login" });

    await fillAndSubmit("", "");

    expect(await screen.findByText("Preencha todos os campos")).toBeInTheDocument();
    expect(findUsersByEmail).not.toHaveBeenCalled();
    expect(findUsersByUsername).not.toHaveBeenCalled();
  });

  it("shows the server error when the mock server is down", async () => {
    findUsersByUsername.mockRejectedValue(new ApiError("Não foi possível conectar ao servidor.", 0));
    renderWithRouter(routes, { path: "/login" });

    await fillAndSubmit("admin", "admin");

    expect(await screen.findByText("Não foi possível conectar ao servidor.")).toBeInTheDocument();
  });

  it("redirects users who are already logged in", async () => {
    renderWithRouter(routes, { path: "/login", session: CLIENT_SESSION });
    expect(await screen.findByText("home page")).toBeInTheDocument();
  });
});
