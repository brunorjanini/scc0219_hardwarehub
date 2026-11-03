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

// Brazilian phone: 10 or 11 digits, formatting characters are ignored
export function validatePhone(phone = "") {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 || digits.length === 11
    ? ""
    : "Telefone inválido (use DDD + número)";
}

// Brazilian CEP: 8 digits, with or without the dash
export function validateZip(zip = "") {
  return /^\d{5}-?\d{3}$/.test(zip.trim()) ? "" : "CEP inválido";
}
