import { CircleCheck, TriangleAlert, X } from "lucide-react";

// Feedback line of the admin lists. The live region is always rendered,
// so screen readers announce each new message; errors are alerts.
// `notice` is { text, tone: "success" | "error" } (see useNavigationNotice).
export default function AdminNotice({ notice, onClose }) {
  const isError = notice.tone === "error";

  return (
    <div aria-live="polite" className="admin-notice-region">
      {notice.text && (
        <div className={`admin-notice ${isError ? "error" : "success"}`} role={isError ? "alert" : undefined}>
          {isError ? <TriangleAlert aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}
          <p>{notice.text}</p>
          <button type="button" className="admin-icon-button" aria-label="Fechar aviso" onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
