import ProfileIcon from "./ProfileIcon";
import "./TopBar.css";

// Strip at the top of every admin page: section name + admin initial.
// The section name is not a heading: each page has its own <h1>.
export default function TopBar({ title }) {
  return (
    <div className="topbar">
      <div className="textbox">
        <p className="topbar-title">{title}</p>
        <p>Painel administrativo HardwareHub</p>
      </div>

      <ProfileIcon />
    </div>
  );
}
