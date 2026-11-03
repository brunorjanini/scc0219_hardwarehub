import "./StockBadge.css";
import { CalendarClock, CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { stockStatus } from "../../utils/stock";

const ICONS = {
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleX,
  info: CalendarClock,
};

// Availability label with an icon: the text carries the meaning and the
// colour only reinforces it (accessibility: information never by colour alone)
export default function StockBadge({ product }) {
  const { label, tone } = stockStatus(product);
  const Icon = ICONS[tone];

  return (
    <p className={`stock-badge stock-badge-${tone}`}>
      <Icon aria-hidden="true" />
      {label}
    </p>
  );
}
