import "./SignInInput.css";

// Labeled text input with an optional icon (passed as children).
// The <label> is linked to the input through `htmlFor`/`id`, so screen
// readers announce it and clicking the label focuses the field.
export default function SignInInput({
  label,
  inputName,
  placeholder,
  type,
  autoComplete,
  inputMode,
  children,
}) {
  const id = `field-${inputName}`;

  return (
    <div className="sign-in-input-div">
      <label htmlFor={id}>{label}</label>

      <div className="icon-input-div">
        {children && (
          <div className="input-icon" aria-hidden="true">
            {children}
          </div>
        )}
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          name={inputName}
          autoComplete={autoComplete}
          inputMode={inputMode}
        />
      </div>
    </div>
  );
}
