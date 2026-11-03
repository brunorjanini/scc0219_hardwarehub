import { describe, expect, it } from "vitest";
import {
  readClientForm,
  readProfileForm,
  toClientRecord,
  toProfileChanges,
  validateClient,
  validateProfile,
} from "./clientForm";

const valid = {
  firstName: "Bruno",
  lastName: "Janini",
  email: "bruno@usp.br",
  phone: "(16) 99999-0000",
  street: "Av. Trabalhador São-carlense",
  number: "400",
  city: "São Carlos",
  zip: "13566-590",
  password: "Senha@123",
};

describe("validateClient", () => {
  it("accepts a complete client", () => {
    expect(validateClient(valid)).toBe("");
  });

  it("requires every field", () => {
    for (const field of Object.keys(valid)) {
      expect(validateClient({ ...valid, [field]: "" }), field).toBe(
        "Preencha todos os campos",
      );
    }
  });

  it("checks email, phone, CEP and password in that order", () => {
    expect(validateClient({ ...valid, email: "bruno" })).toBe("E-mail inválido");
    expect(validateClient({ ...valid, phone: "123" })).toMatch(/Telefone/);
    expect(validateClient({ ...valid, zip: "123" })).toBe("CEP inválido");
    expect(validateClient({ ...valid, password: "fraca" })).toMatch(/senha/i);
  });

  it("can skip the password (profile edit)", () => {
    expect(validateClient({ ...valid, password: "" }, { requirePassword: false })).toBe("");
  });
});

describe("readClientForm / toClientRecord", () => {
  it("trims fields, lowercases the email and builds the /users record", () => {
    const form = new FormData();
    form.set("name", " Bruno ");
    form.set("last-name", "Janini");
    form.set("e-mail", " Bruno@USP.br ");
    form.set("phone", "(16) 99999-0000");
    form.set("street", "Rua A");
    form.set("number", "10");
    form.set("city", "São Carlos");
    form.set("zip", "13566-590");
    form.set("password", " Senha@123 ");

    const values = readClientForm(form);
    expect(values.email).toBe("bruno@usp.br");
    expect(values.password).toBe(" Senha@123 ");

    expect(toClientRecord(values)).toEqual({
      type: "user",
      name: "Bruno Janini",
      email: "bruno@usp.br",
      password: " Senha@123 ",
      phone: "(16) 99999-0000",
      address: { street: "Rua A", number: "10", city: "São Carlos", zip: "13566-590" },
    });
  });
});

describe("profile form", () => {
  const profile = {
    name: "Ana Souza",
    email: "ana@usp.br",
    phone: "(16) 99123-4567",
    street: "Rua A",
    number: "10",
    city: "São Carlos",
    zip: "13566-590",
  };

  it("reads trimmed values and lowercases the email", () => {
    const form = new FormData();
    for (const [key, value] of Object.entries(profile)) form.set(key, ` ${value} `);
    form.set("email", " Ana@USP.br ");

    expect(readProfileForm(form)).toEqual(profile);
  });

  it("validates like the sign-up, without a password", () => {
    expect(validateProfile(profile)).toBe("");
    expect(validateProfile({ ...profile, name: "" })).toBe("Preencha todos os campos");
    expect(validateProfile({ ...profile, email: "ana" })).toBe("E-mail inválido");
    expect(validateProfile({ ...profile, phone: "1" })).toMatch(/Telefone/);
    expect(validateProfile({ ...profile, zip: "1" })).toBe("CEP inválido");
  });

  it("builds the PATCH body without type or password", () => {
    expect(toProfileChanges(profile)).toEqual({
      name: "Ana Souza",
      email: "ana@usp.br",
      phone: "(16) 99123-4567",
      address: { street: "Rua A", number: "10", city: "São Carlos", zip: "13566-590" },
    });
  });
});
