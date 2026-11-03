import { describe, expect, it } from "vitest";
import {
  validateCardNumber,
  validatePassword,
  validatePasswordChange,
  validatePhone,
  validateZip,
} from "./validators";

describe("validatePassword", () => {
  it("accepts 8+ characters with a number and a symbol", () => {
    expect(validatePassword("Senha@123")).toBe("");
  });

  it.each([
    ["Ab@1", /8 caracteres/],
    ["SenhaSem@", /número/],
    ["Senha1234", /símbolo/],
    ["", /8 caracteres/],
  ])("rejects %j", (password, message) => {
    expect(validatePassword(password)).toMatch(message);
  });
});

describe("validatePhone", () => {
  it.each(["(16) 99123-4567", "16991234567", "(16) 3373-0000"])("accepts %s", (phone) => {
    expect(validatePhone(phone)).toBe("");
  });

  it.each(["123", "991234567", "(16) 99123-45678"])("rejects %s", (phone) => {
    expect(validatePhone(phone)).not.toBe("");
  });
});

describe("validatePasswordChange", () => {
  const ok = { current: "Password123", next: "NovaSenha@1", confirm: "NovaSenha@1" };

  it("accepts a valid change", () => {
    expect(validatePasswordChange(ok)).toBe("");
  });

  it("checks fields, confirmation, reuse and strength in that order", () => {
    expect(validatePasswordChange({ ...ok, current: "" })).toBe("Preencha todos os campos de senha");
    expect(validatePasswordChange({ ...ok, confirm: "Outra@123" })).toBe("A confirmação não confere com a nova senha");
    expect(validatePasswordChange({ current: "Senha@123", next: "Senha@123", confirm: "Senha@123" })).toBe(
      "A nova senha deve ser diferente da atual",
    );
    expect(validatePasswordChange({ ...ok, next: "fraca", confirm: "fraca" })).toMatch(/8 caracteres/);
  });
});

describe("validateCardNumber", () => {
  it.each(["4111 1111 1111 1111", "1234", "5555-4444-3333-2222", "1234567890123456789"])(
    "accepts any number: %s",
    (card) => {
      expect(validateCardNumber(card)).toBe("");
    },
  );

  it.each([
    ["", /Informe/],
    ["   ", /Informe/],
    ["4111 abcd", /apenas dígitos/],
    ["123", /4 a 19/],
    ["12345678901234567890", /4 a 19/],
  ])("rejects %j", (card, message) => {
    expect(validateCardNumber(card)).toMatch(message);
  });
});

describe("validateZip", () => {
  it.each(["13566-590", "13566590", " 13566-590 "])("accepts %j", (zip) => {
    expect(validateZip(zip)).toBe("");
  });

  it.each(["1356-590", "ABCDE-123", "135665900"])("rejects %s", (zip) => {
    expect(validateZip(zip)).toBe("CEP inválido");
  });
});
