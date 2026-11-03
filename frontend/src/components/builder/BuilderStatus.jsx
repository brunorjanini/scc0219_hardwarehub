import { CircleX, ListChecks, ShieldCheck, TriangleAlert } from "lucide-react";
import { statusMessage } from "../../utils/builder";

const ICONS = {
  incomplete: ListChecks,
  ok: ShieldCheck,
  warning: TriangleAlert,
  error: CircleX,
};

// Compatibility banner of the builder. The title always says the status
// in words; colour and icon only reinforce it. role="status" makes screen
// readers announce each change as parts are chosen.
export default function BuilderStatus({ result }) {
  const { title, detail } = statusMessage(result);
  const Icon = ICONS[result.status];
  // Incomplete builds with a warning use the warning colour
  const tone = result.status === "incomplete" && result.issues.length > 0 ? "warning" : result.status;

  return (
    <div className={`builder-status builder-tone-${tone}`} role="status">
      <Icon aria-hidden="true" />
      <div>
        <p className="builder-status-title">{title}</p>
        {detail && <p className="builder-status-detail">{detail}</p>}
      </div>
    </div>
  );
}
