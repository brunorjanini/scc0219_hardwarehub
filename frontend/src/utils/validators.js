// Form validation rules shared by sign-up, My Account and the admin forms.
// Each function returns an error message, or "" when the value is valid.

// Sign-up rule: at least 8 characters, one number and one symbol
export function validatePassword(password = "") {
  if (password.length < 8) return "A senha deve ter no mínimo 8 caracteres";
  if (!/\d/.test(password)) return "A senha deve conter pelo menos um número";
  if (!/[^A-Za-z0-9]/.test(password))
    return "A senha deve conter pelo menos um símbolo";
  return "";
}

// Password change form: all fields, matching confirmation, a new value,
// and the sign-up rule for the new password
export function validatePasswordChange({ current = "", next = "", confirm = "" }) {
  if (!current || !next || !confirm) return "Preencha todos os campos de senha";
  if (next !== confirm) return "A confirmação não confere com a nova senha";
  if (next === current) return "A nova senha deve ser diferente da atual";
  return validatePassword(next);
}

// Brazilian phone: 10 or 11 digits, formatting characters are ignored
export function validatePhone(phone = "") {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11
    ? ""
    : "Telefone inválido (use DDD + número)";
}

// Card number. The assignment says any number is accepted, so only the
// format is checked: digits (spaces and dashes allowed), 4 to 19 of them.
export function validateCardNumber(cardNumber = "") {
  const value = cardNumber.trim();
  if (!value) return "Informe o número do cartão";
  if (!/^[\d\s-]+$/.test(value)) return "O número do cartão deve ter apenas dígitos";
  const digits = value.replace(/\D/g, "").length;
  return digits >= 4 && digits <= 19 ? "" : "O número do cartão deve ter de 4 a 19 dígitos";
}

// Brazilian CEP: 8 digits, with or without the dash
export function validateZip(zip = "") {
  return /^\d{5}-?\d{3}$/.test(zip.trim()) ? "" : "CEP inválido";
}
