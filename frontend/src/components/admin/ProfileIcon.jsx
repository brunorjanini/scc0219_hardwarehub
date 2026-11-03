import "./ProfileIcon.css";
import { useAuth } from "../../contexts/useAuth";

// Circle with the logged-in admin's initial
export default function ProfileIcon() {
  const { user } = useAuth();
  const name = user?.name || "Admin";

  return (
    <div className="circle" title={name} aria-label={name} role="img">
      <span className="circle-initial" aria-hidden="true">
        {name.trim().charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
