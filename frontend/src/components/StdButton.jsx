import "./StdButton.css";

// Primary form button. Defaults to type="submit" (inside forms).
export default function StdButton({ label, type = "submit", disabled }) {
  return (
    <button className="std-button" type={type} disabled={disabled}>
      {label}
    </button>
  );
}
