import "./DashboardCard.css";

// Number card of the dashboard. `tone` colours the comment: "up" (green),
// "down" (red) or "neutral" (grey); the text itself always says the change.
export default function DashboardCard({ title, value, comment, tone = "neutral", children }) {
  return (
    <div className="dashboard-card">
      <div className="card-title-icon">
        <h2>{title}</h2>
        <div className="card-icon" aria-hidden="true">
          {children}
        </div>
      </div>
      <p className="dashboard-card-value">{value}</p>
      <p className={`dashboard-card-comment ${tone}`}>{comment}</p>
    </div>
  );
}
