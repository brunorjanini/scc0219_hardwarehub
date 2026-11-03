import "./FormField.css";

// Labeled input used by the checkout and My Account forms.
// `id` is also the input name (read with FormData). Extra props go to the
// <input>; `short` makes the field narrow when it sits next to a wide one.
export default function FormField({ id, label, short = false, ...inputProps }) {
  return (
    <div className={`form-field ${short ? "form-field-short" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} name={id} {...inputProps} />
    </div>
  );
}
