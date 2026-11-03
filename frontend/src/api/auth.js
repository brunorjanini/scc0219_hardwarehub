// Login against the mock server. Accepts an email or a username, so the
// default account required by the assignment (admin / admin) works.
// NOTE: passwords are compared in plain text because json-server is only a
// mock; the Node server in the final version must hash them.
import { findUsersByEmail, findUsersByUsername } from "./users";
import verifyEmail from "../utils/verifyEmail";

// Returns { user } on success or { error } with a message for the UI.
// Network errors are thrown (ApiError) so the page can show them.
export async function authenticate(identifier, password) {
  const login = (identifier ?? "").trim();

  if (!login || !password) {
    return { error: "Preencha todos os campos" };
  }

  // An "@" means the user typed an email; otherwise it is a username
  const isEmail = login.includes("@");
  if (isEmail && !verifyEmail(login)) {
    return { error: "E-mail inválido" };
  }

  // Emails and usernames are saved in lower case (sign-up and admin forms)
  const users = isEmail
    ? await findUsersByEmail(login.toLowerCase())
    : await findUsersByUsername(login.toLowerCase());

  if (users.length === 0) {
    return { error: "Usuário não encontrado" };
  }

  const user = users[0];
  if (user.password !== password) {
    return { error: "Senha incorreta" };
  }

  return { user };
}
