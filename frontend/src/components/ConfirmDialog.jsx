import "./ConfirmDialog.css";
import { useEffect, useId, useRef } from "react";

// Modal confirmation for destructive actions (delete a product, a client...).
// Render it only while open. Keyboard support: focus starts on "Cancelar"
// (the safe choice), Tab and Shift+Tab stay inside the dialog, Esc cancels,
// and focus goes back to the element that opened it.
// While `busy` (request running) it cannot be closed.
export default function ConfirmDialog({
  title,
  children,
  confirmLabel = "Excluir",
  busyLabel = "Excluindo...",
  busy = false,
  error = "",
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const textId = useId();
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    cancelRef.current?.focus();
    // If the opener was removed (e.g. its row was deleted) this does nothing
    return () => opener?.focus?.();
  }, []);

  function cancel() {
    if (!busy) onCancel();
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") {
      e.stopPropagation();
      cancel();
      return;
    }
    if (e.key !== "Tab") return;

    // Focus trap: wrap around the buttons of the dialog
    const buttons = [...dialogRef.current.querySelectorAll("button:not([disabled])")];
    if (buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="confirm-backdrop"
      // A click on the dark area (outside the box) cancels
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) cancel();
      }}
    >
      <div
        ref={dialogRef}
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId} className="confirm-dialog-title">
          {title}
        </h2>
        <div id={textId} className="confirm-dialog-text">
          {children}
        </div>
        {error && (
          <p className="confirm-dialog-error" role="alert">
            {error}
          </p>
        )}
        <div className="confirm-dialog-actions">
          <button ref={cancelRef} type="button" className="link-button secondary" onClick={cancel}>
            Cancelar
          </button>
          <button type="button" className="link-button danger" onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
