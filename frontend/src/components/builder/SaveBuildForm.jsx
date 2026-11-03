import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { Save } from "lucide-react";
import { BUILD_NAME_MAX, defaultBuildName, validateBuildName } from "../../utils/savedBuilds";

// "Salvar montagem" in the builder summary. The button opens a small form
// for the name; `onSave(name)` saves and resolves to { error } or {}.
// `blockedReason` disables the button (and describes why); `onRequireLogin`
// is used instead of the form for guests.
export default function SaveBuildForm({ blockedReason, onSave, onRequireLogin }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultBuildName);
  const [status, setStatus] = useState({ busy: false, error: "", savedName: "" });
  const inputRef = useRef(null);
  const toggleRef = useRef(null);
  const returnFocus = useRef(false);

  // Opening focuses the name field; closing (cancel or saved) focuses the
  // "Salvar montagem" button again
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      toggleRef.current?.focus();
    }
  }, [open]);

  function close() {
    returnFocus.current = true;
    setOpen(false);
  }

  function start() {
    if (onRequireLogin) {
      onRequireLogin();
      return;
    }
    setStatus({ busy: false, error: "", savedName: "" });
    setOpen(true);
  }


  async function handleSubmit(e) {
    e.preventDefault();
    if (status.busy) return;

    const error = validateBuildName(name);
    if (error) {
      setStatus({ busy: false, error, savedName: "" });
      inputRef.current?.focus();
      return;
    }

    setStatus({ busy: true, error: "", savedName: "" });
    const result = await onSave(name.trim());
    if (result.error) {
      setStatus({ busy: false, error: result.error, savedName: "" });
      return;
    }
    setStatus({ busy: false, error: "", savedName: name.trim() });
    setName(defaultBuildName());
    close();
  }

  return (
    <div className="builder-save">
      {open ? (
        <form
          className="builder-save-form"
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
          noValidate
          aria-label="Salvar montagem"
        >
          <label htmlFor="builder-save-name">Nome da montagem</label>
          <input
            ref={inputRef}
            id="builder-save-name"
            value={name}
            maxLength={BUILD_NAME_MAX + 10}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={status.error ? true : undefined}
            aria-describedby={status.error ? "builder-save-error" : undefined}
          />
          {status.error && (
            <p id="builder-save-error" className="builder-save-error" role="alert">
              {status.error}
            </p>
          )}
          <div className="builder-save-actions">
            <button type="submit" className="link-button" disabled={status.busy}>
              {status.busy ? "Salvando..." : "Salvar"}
            </button>
            <button type="button" className="link-button secondary" onClick={close}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          ref={toggleRef}
          type="button"
          className="link-button secondary builder-save-toggle"
          onClick={start}
          disabled={Boolean(blockedReason)}
          aria-describedby={blockedReason ? "builder-save-reason" : undefined}
        >
          <Save aria-hidden="true" />
          Salvar montagem
        </button>
      )}
      {!open && blockedReason && (
        <p id="builder-save-reason" className="builder-summary-reason builder-save-reason">
          {blockedReason}
        </p>
      )}

      <div role="status">
        {status.savedName && (
          <p className="builder-save-done">
            Montagem “{status.savedName}” salva. <Link to="/account#montagens">Ver em Minha conta</Link>
          </p>
        )}
      </div>
    </div>
  );
}
