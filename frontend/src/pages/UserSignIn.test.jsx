import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserSignIn from "./UserSignIn";
import { CLIENT_SESSION, renderWithRouter } from "../test/renderWithRouter";
import { createUser, findUsersByEmail } from "../api/users";

vi.mock("../api/users", () => ({
  findUsersByEmail: vi.fn(),
  createUser: vi.fn(),
}));

const routes = [
  { path: "/", element: <p>home page</p> },
  { path: "/login", element: <p>login page</p> },
  { path: "/signup", element: <UserSignIn /> },
];

const VALID = {
  Nome: "Bruno",
  Sobrenome: "Janini",
  "E-mail": "Bruno@USP.br",
  Telefone: "(16) 99999-0000",
  Rua: "Av. Trabalhador São-carlense",
  Número: "400",
  Cidade: "São Carlos",
  CEP: "13566-590",
  Senha: "Senha@123",
};

// Fills the form (fields set to "" are left empty) and submits it
async function fillAndSubmit(overrides = {}, { acceptTerms = true } = {}) {
  const user = userEvent.setup();
  const values = { ...VALID, ...overrides };

  for (const [label, value] of Object.entries(values)) {
    if (value) await user.type(screen.getByLabelText(label), value);
  }
  if (acceptTerms) await user.click(screen.getByLabelText(/Termos de Uso/));
  await user.click(screen.getByRole("button", { name: "Criar conta" }));
}

beforeEach(() => {
  findUsersByEmail.mockReset().mockResolvedValue([]);
  createUser.mockReset().mockImplementation(async (record) => ({ id: "abc", ...record }));
});

describe("UserSignIn", () => {
  it("creates the client in /users and then goes to login", async () => {
    renderWithRouter(routes, { path: "/signup" });

    await fillAndSubmit();

    expect(await screen.findByText(/Cadastro realizado com sucesso/)).toBeInTheDocument();
    expect(findUsersByEmail).toHaveBeenCalledWith("bruno@usp.br");
    expect(createUser).toHaveBeenCalledWith({
      type: "user",
      name: "Bruno Janini",
      email: "bruno@usp.br",
      password: "Senha@123",
      phone: "(16) 99999-0000",
      address: {
        street: "Av. Trabalhador São-carlense",
        number: "400",
        city: "São Carlos",
        zip: "13566-590",
      },
    });
    expect(await screen.findByText("login page", {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it("rejects an email that is already registered", async () => {
    findUsersByEmail.mockResolvedValue([{ id: "1", email: "bruno@usp.br" }]);
    renderWithRouter(routes, { path: "/signup" });

    await fillAndSubmit();

    expect(await screen.findByText("Esse e-mail já está cadastrado no sistema")).toBeInTheDocument();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("applies the password rule at sign-up", async () => {
    renderWithRouter(routes, { path: "/signup" });

    await fillAndSubmit({ Senha: "fraca" });

    expect(await screen.findByText(/no mínimo 8 caracteres/)).toBeInTheDocument();
    expect(findUsersByEmail).not.toHaveBeenCalled();
  });

  it("requires the address", async () => {
    renderWithRouter(routes, { path: "/signup" });

    await fillAndSubmit({ Rua: "" });

    expect(await screen.findByText("Preencha todos os campos")).toBeInTheDocument();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("requires accepting the terms", async () => {
    renderWithRouter(routes, { path: "/signup" });

    await fillAndSubmit({}, { acceptTerms: false });

    expect(await screen.findByText("Aceite os Termos de Uso para continuar")).toBeInTheDocument();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("sends logged-in users to the home page", async () => {
    renderWithRouter(routes, { path: "/signup", session: CLIENT_SESSION });
    expect(await screen.findByText("home page")).toBeInTheDocument();
  });
});
