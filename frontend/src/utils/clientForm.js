// Validation and conversion for client (customer) forms. Used by the
// sign-up page now and by My Account / admin client forms later.
import verifyEmail from "./verifyEmail";
import { validatePassword, validatePhone, validateZip } from "./validators";

// Returns the first error message, or "" if every field is valid.
// `values` holds trimmed strings read from the form.
export function validateClient(values, { requirePassword = true } = {}) {
  const required = [
    values.firstName,
    values.lastName,
    values.email,
    values.phone,
    values.street,
    values.number,
    values.city,
    values.zip,
  ];
  if (requirePassword) required.push(values.password);

  if (required.some((value) => !value)) return "Preencha todos os campos";
  if (!verifyEmail(values.email)) return "E-mail inválido";

  return (
    validatePhone(values.phone) ||
    validateZip(values.zip) ||
    (requirePassword ? validatePassword(values.password) : "")
  );
}

// Reads the client fields from a FormData object (trimmed strings)
export function readClientForm(formData) {
  const get = (name) => (formData.get(name) ?? "").toString().trim();
  return {
    firstName: get("name"),
    lastName: get("last-name"),
    email: get("e-mail").toLowerCase(),
    phone: get("phone"),
    street: get("street"),
    number: get("number"),
    city: get("city"),
    zip: get("zip"),
    // Passwords are not trimmed: spaces may be intentional
    password: (formData.get("password") ?? "").toString(),
  };
}

// Converts validated form values into the record saved in /users
export function toClientRecord(values) {
  return {
    type: "user",
    name: `${values.firstName} ${values.lastName}`,
    email: values.email,
    password: values.password,
    phone: values.phone,
    address: {
      street: values.street,
      number: values.number,
      city: values.city,
      zip: values.zip,
    },
  };
}

// ---- My Account: profile form (full name in one field, no password) ----

// Reads the profile fields from a FormData object (trimmed strings)
export function readProfileForm(formData) {
  const get = (name) => (formData.get(name) ?? "").toString().trim();
  return {
    name: get("name"),
    email: get("email").toLowerCase(),
    phone: get("phone"),
    street: get("street"),
    number: get("number"),
    city: get("city"),
    zip: get("zip"),
  };
}

// Same rules as sign-up, minus the password
export function validateProfile(values) {
  const required = [values.name, values.email, values.phone, values.street, values.number, values.city, values.zip];
  if (required.some((value) => !value)) return "Preencha todos os campos";
  if (!verifyEmail(values.email)) return "E-mail inválido";
  return validatePhone(values.phone) || validateZip(values.zip);
}

// Validated profile values -> PATCH body for /users/:id
export function toProfileChanges(values) {
  return {
    name: values.name,
    email: values.email,
    phone: values.phone,
    address: {
      street: values.street,
      number: values.number,
      city: values.city,
      zip: values.zip,
    },
  };
}
