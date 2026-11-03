import { describe, expect, it } from "vitest";
import seed from "../seed.json";
import {
  deleteBlockReason,
  isDefaultAdmin,
  readUserForm,
  toUserFormValues,
  toUserRecord,
  validateUserForm,
  validateUsername,
} from "./userForm";
import { parseAdminUserParams, toAdminUserFilters, toAdminUserSearch } from "./adminUserQuery";

const CLIENT_VALUES = {
  name: "Bruno Lima",
  email: "bruno@usp.br",
  phone: "(16) 98888-7777",
  username: "",
  street: "Rua XV",
  number: "10",
  city: "São Carlos",
  zip: "13560-000",
  password: "Senha@123",
  confirmPassword: "Senha@123",
};

const ADMIN_VALUES = {
  ...CLIENT_VALUES,
  name: "Carla Dias",
  email: "carla@hardwarehub.com",
  username: "carla",
  street: "",
  number: "",
  city: "",
  zip: "",
};

const NEW_CLIENT = { type: "user", isNew: true };
const NEW_ADMIN = { type: "admin", isNew: true };

describe("default admin and deletion rules", () => {
  const defaultAdmin = seed.users.find((u) => u.username === "admin");
  const otherAdmin = seed.users.find((u) => u.type === "admin" && u.username !== "admin");
  const client = seed.users.find((u) => u.type === "user");

  it("recognises the default admin account", () => {
    expect(isDefaultAdmin(defaultAdmin)).toBe(true);
    expect(isDefaultAdmin(otherAdmin)).toBe(false);
    expect(isDefaultAdmin({ type: "user", username: "admin" })).toBe(false);
  });

  it("blocks deleting the default admin and yourself", () => {
    expect(deleteBlockReason(defaultAdmin, { id: otherAdmin.id })).toMatch(/conta padrão/);
    expect(deleteBlockReason(otherAdmin, { id: otherAdmin.id })).toMatch(/própria conta/);
    expect(deleteBlockReason(otherAdmin, { id: defaultAdmin.id })).toBe("");
    expect(deleteBlockReason(client, { id: defaultAdmin.id })).toBe("");
  });
});

describe("validateUsername", () => {
  it.each(["admin", "marina.costa", "joao_2", "a-b"])("accepts %s", (username) => {
    expect(validateUsername(username)).toBe("");
  });

  it.each(["ab", "a".repeat(31), "ana@usp", "joão", "com espaço"])("refuses %s", (username) => {
    expect(validateUsername(username)).not.toBe("");
  });
});

describe("readUserForm", () => {
  it("trims fields and lower-cases email and username", () => {
    const data = new FormData();
    data.append("name", " Carla ");
    data.append("email", " Carla@HardwareHub.com ");
    data.append("username", "Carla");
    data.append("password", " a b ");
    expect(readUserForm(data)).toMatchObject({
      name: "Carla",
      email: "carla@hardwarehub.com",
      username: "carla",
      street: "",
      password: " a b ",
      confirmPassword: "",
    });
  });
});

describe("validateUserForm", () => {
  it("accepts valid clients and admins", () => {
    expect(validateUserForm(CLIENT_VALUES, NEW_CLIENT)).toBeNull();
    expect(validateUserForm(ADMIN_VALUES, NEW_ADMIN)).toBeNull();
  });

  it.each([
    [{ name: "" }, "name", "Informe o nome"],
    [{ email: "" }, "email", "Informe o e-mail"],
    [{ email: "bruno" }, "email", "E-mail inválido"],
    [{ phone: "" }, "phone", "Informe o telefone"],
    [{ phone: "123" }, "phone", /Telefone inválido/],
    [{ street: "" }, "street", "Preencha o endereço completo"],
    [{ city: "" }, "city", "Preencha o endereço completo"],
    [{ zip: "1" }, "zip", "CEP inválido"],
    [{ password: "", confirmPassword: "" }, "password", "Informe a senha"],
    [{ password: "fraca", confirmPassword: "fraca" }, "password", /no mínimo 8/],
    [{ confirmPassword: "Outra@123" }, "confirmPassword", /confirmação/],
  ])("refuses a client with %j", (changes, field, message) => {
    const error = validateUserForm({ ...CLIENT_VALUES, ...changes }, NEW_CLIENT);
    expect(error.field).toBe(field);
    expect(error.message).toMatch(message);
  });

  it("requires a valid username for admins but no address", () => {
    expect(validateUserForm({ ...ADMIN_VALUES, username: "" }, NEW_ADMIN)).toEqual({
      field: "username",
      message: "Informe o usuário",
    });
    expect(validateUserForm({ ...ADMIN_VALUES, username: "a@b" }, NEW_ADMIN).field).toBe("username");
  });

  it("keeps the password on edit when both password fields are empty", () => {
    const values = { ...CLIENT_VALUES, password: "", confirmPassword: "" };
    expect(validateUserForm(values, { type: "user", isNew: false })).toBeNull();
    // Only the confirmation typed: still checked
    expect(validateUserForm({ ...values, confirmPassword: "x" }, { type: "user", isNew: false }).field).toBe("password");
  });
});

describe("toUserRecord", () => {
  it("builds a new client with address and password", () => {
    expect(toUserRecord(CLIENT_VALUES, NEW_CLIENT)).toEqual({
      type: "user",
      name: "Bruno Lima",
      email: "bruno@usp.br",
      phone: "(16) 98888-7777",
      address: { street: "Rua XV", number: "10", city: "São Carlos", zip: "13560-000" },
      password: "Senha@123",
    });
  });

  it("builds a new admin with username and no address", () => {
    expect(toUserRecord(ADMIN_VALUES, NEW_ADMIN)).toEqual({
      type: "admin",
      name: "Carla Dias",
      email: "carla@hardwarehub.com",
      phone: "(16) 98888-7777",
      username: "carla",
      password: "Senha@123",
    });
  });

  it("does not send type or an empty password on edit", () => {
    const record = toUserRecord({ ...ADMIN_VALUES, password: "" }, { type: "admin", isNew: false });
    expect(record).not.toHaveProperty("type");
    expect(record).not.toHaveProperty("password");
  });
});

describe("toUserFormValues", () => {
  it("round-trips every seed user through validation", () => {
    for (const user of seed.users) {
      const values = { ...toUserFormValues(user), password: "", confirmPassword: "" };
      expect(validateUserForm(values, { type: user.type, isNew: false }), user.name).toBeNull();
    }
  });
});

describe("admin user query", () => {
  const parse = (query) => parseAdminUserParams(new URLSearchParams(query));

  it("parses and round-trips the search and page", () => {
    expect(parse("")).toEqual({ q: "", page: 1 });
    expect(parse("q=%20ana%20&page=0")).toEqual({ q: "ana", page: 1 });
    expect(parse(toAdminUserSearch({ q: "ana", page: 3 }).slice(1))).toEqual({ q: "ana", page: 3 });
    expect(toAdminUserSearch({ q: "", page: 1 })).toBe("");
  });

  it("maps to listUsers filters sorted by name", () => {
    expect(toAdminUserFilters("admin", { q: "car", page: 2 })).toEqual({
      type: "admin",
      search: "car",
      sort: "name",
      page: 2,
      perPage: 10,
    });
  });
});
