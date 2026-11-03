import { errorProps } from "./adminFormErrors";

// Labelled input / select / textarea of the admin forms (styles in
// AdminPage.css). `id` is also the name read with FormData. When `error`
// points to this field it gets aria-invalid and the error as description.
export default function AdminField({ id, label, hint, error, as = "input", children, ...props }) {
  const Control = as;
  const hintId = hint ? `${id}-hint` : undefined;
  const invalid = errorProps(error, id);
  const describedBy = [hintId, invalid["aria-describedby"]].filter(Boolean).join(" ") || undefined;

  return (
    <div className="admin-form-field">
      <label htmlFor={id}>{label}</label>
      <Control id={id} name={id} {...props} {...invalid} aria-describedby={describedBy}>
        {children}
      </Control>
      {hint && (
        <p id={hintId} className="admin-field-hint">
          {hint}
        </p>
      )}
    </div>
  );
}
