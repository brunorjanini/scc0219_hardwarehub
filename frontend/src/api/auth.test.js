import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticate } from "./auth";
import { findUsersByEmail, findUsersByUsername } from "./users";

vi.mock("./users", () => ({
  findUsersByEmail: vi.fn(),
  findUsersByUsername: vi.fn(),
}));

const admin = { id: "3", type: "admin", name: "Administrador", username: "admin", password: "admin" };
const client = { id: "1", type: "user", name: "Ana Souza", email: "user@gmail.com", password: "Password123" };

beforeEach(() => {
  findUsersByEmail.mockReset();
  findUsersByUsername.mockReset();
});

describe("authenticate", () => {
  it("logs in the default admin with username admin / password admin", async () => {
    findUsersByUsername.mockResolvedValue([admin]);

    await expect(authenticate("admin", "admin")).resolves.toEqual({ user: admin });
    expect(findUsersByUsername).toHaveBeenCalledWith("admin");
    expect(findUsersByEmail).not.toHaveBeenCalled();
  });

  it("logs in a client by email, ignoring case and spaces", async () => {
    findUsersByEmail.mockResolvedValue([client]);

    await expect(authenticate("  User@Gmail.com ", "Password123")).resolves.toEqual({ user: client });
    expect(findUsersByEmail).toHaveBeenCalledWith("user@gmail.com");
  });

  it("does not apply the sign-up password rule at login", async () => {
    findUsersByUsername.mockResolvedValue([admin]);
    // "admin" is shorter than 8 characters and has no number or symbol
    await expect(authenticate("admin", "admin")).resolves.toHaveProperty("user");
  });

  it("rejects empty fields without calling the server", async () => {
    await expect(authenticate("", "x")).resolves.toEqual({ error: "Preencha todos os campos" });
    await expect(authenticate("admin", "")).resolves.toEqual({ error: "Preencha todos os campos" });
    expect(findUsersByEmail).not.toHaveBeenCalled();
    expect(findUsersByUsername).not.toHaveBeenCalled();
  });

  it("rejects a malformed email", async () => {
    await expect(authenticate("ana@", "x")).resolves.toEqual({ error: "E-mail inválido" });
  });

  it("reports an unknown user and a wrong password", async () => {
    findUsersByUsername.mockResolvedValue([]);
    await expect(authenticate("ninguem", "x")).resolves.toEqual({ error: "Usuário não encontrado" });

    findUsersByUsername.mockResolvedValue([admin]);
    await expect(authenticate("admin", "errada")).resolves.toEqual({ error: "Senha incorreta" });
  });

  it("lets network errors propagate to the page", async () => {
    findUsersByUsername.mockRejectedValue(new Error("offline"));
    await expect(authenticate("admin", "admin")).rejects.toThrow("offline");
  });
});
