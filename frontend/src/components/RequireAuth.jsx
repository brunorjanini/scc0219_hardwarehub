import { Navigate, useLocation } from "react-router";
import { useAuth } from "../contexts/useAuth";

// Route guard. Wrap protected pages with it:
//   <RequireAuth>...</RequireAuth>             any logged-in user
//   <RequireAuth role="admin">...</RequireAuth> administrators only
// Guests go to /login (and come back after logging in);
// logged-in users without the role go to the home page.
export default function RequireAuth({ role, children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (role && user.type !== role) {
    return <Navigate to="/" replace />;
  }

  return children;
}
