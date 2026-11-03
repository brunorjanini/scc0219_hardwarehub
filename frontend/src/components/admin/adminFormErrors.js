// Links the invalid input of an admin form to the error message shown
// next to the submit button (id FORM_ERROR_ID).
export const FORM_ERROR_ID = "admin-form-error";

// `error` is { field, message } (see validateProduct / validateUserForm)
export function errorProps(error, id) {
  return error?.field === id ? { "aria-invalid": true, "aria-describedby": FORM_ERROR_ID } : {};
}
