// Admin forms for clients (type "user") and administrators (type "admin"):
// reading, validation, conversion to the /users record, and the rules
// about which accounts can be deleted.
import verifyEmail from "./verifyEmail";
import { validatePassword, validatePhone, validateZip } from "./validators";
import { sameId } from "../api/http";

// The account required by the assignment (admin / admin)
export const DEFAULT_ADMIN_USERNAME = "admin";

export function isDefaultAdmin(user) {
  return user?.type === "admin" && user.username === DEFAULT_ADMIN_USERNAME;
}

// 3 to 30 letters, digits, ".", "-" or "_". No "@": the login page treats
// anything with "@" as an email.
export function validateUsername(username = "") {
  if (username.length < 3 || username.length > 30) return "O usuário deve ter de 3 a 30 caracteres";
  if (!/^[a-z0-9._-]+$/.test(username)) {
    return "O usuário só pode ter letras sem acento, números, ponto, hífen e sublinhado";
  }
  return "";
}

// Why `target` cannot be deleted by `currentUser` ("" = it can)
export function deleteBlockReason(target, currentUser) {
  if (sameId(target?.id, currentUser?.id)) return "Você não pode excluir a própria conta.";
  if (isDefaultAdmin(target)) return "A conta padrão “admin” não pode ser excluída.";
  return "";
}

// Reads the form (FormData) into trimmed strings. Email and username are
// lower-cased, the same way sign-up and login treat them.
export function readUserForm(formData) {
  const get = (name) => (formData.get(name) ?? "").toString().trim();
  return {
    name: get("name"),
    email: get("email").toLowerCase(),
    phone: get("phone"),
    username: get("username").toLowerCase(),
    street: get("street"),
    number: get("number"),
    city: get("city"),
    zip: get("zip"),
    // Passwords are not trimmed: spaces may be intentional
    password: (formData.get("password") ?? "").toString(),
    confirmPassword: (formData.get("confirmPassword") ?? "").toString(),
  };
}

// Stored user -> initial values of the form fields
export function toUserFormValues(user) {
  const address = user?.address ?? {};
  return {
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    username: user?.username ?? "",
    street: address.street ?? "",
    number: address.number ?? "",
    city: address.city ?? "",
    zip: address.zip ?? "",
  };
}

// Returns { field, message } for the first invalid field (`field` is the
// input id, so the page can focus it), or null when everything is valid.
// On edit, an empty password keeps the current one.
export function validateUserForm(values, { type, isNew }) {
  const error = (field, message) => ({ field, message });

  if (!values.name) return error("name", "Informe o nome");
  if (!values.email) return error("email", "Informe o e-mail");
  if (!verifyEmail(values.email)) return error("email", "E-mail inválido");
  if (!values.phone) return error("phone", "Informe o telefone");
  const phoneError = validatePhone(values.phone);
  if (phoneError) return error("phone", phoneError);

  if (type === "admin") {
    if (!values.username) return error("username", "Informe o usuário");
    const usernameError = validateUsername(values.username);
    if (usernameError) return error("username", usernameError);
  } else {
    for (const field of ["street", "number", "city", "zip"]) {
      if (!values[field]) return error(field, "Preencha o endereço completo");
    }
    const zipError = validateZip(values.zip);
    if (zipError) return error("zip", zipError);
  }

  if (isNew || values.password || values.confirmPassword) {
    if (!values.password) return error("password", "Informe a senha");
    const passwordError = validatePassword(values.password);
    if (passwordError) return error("password", passwordError);
    if (values.password !== values.confirmPassword) {
      return error("confirmPassword", "A confirmação não confere com a senha");
    }
  }

  return null;
}

// Validated values -> body for POST (isNew) or PATCH /users/:id.
// The password is only sent when one was typed. The address object is
// sent whole because PATCH only merges the top level.
export function toUserRecord(values, { type, isNew }) {
  const record = { name: values.name, email: values.email, phone: values.phone };
  if (isNew) record.type = type;

  if (type === "admin") {
    record.username = values.username;
  } else {
    record.address = { street: values.street, number: values.number, city: values.city, zip: values.zip };
  }

  if (values.password) record.password = values.password;
  return record;
}
