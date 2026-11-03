import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";

// Feedback message of the admin lists: { text, tone: "success" | "error" }.
// Forms send one when they finish, with navigate(path, { state: { notice } }).
// The notice is then removed from the history entry, so a page refresh
// does not show it again.
export function useNavigationNotice() {
  const location = useLocation();
  const navigate = useNavigate();
  const [notice, setNotice] = useState(() => ({ text: location.state?.notice ?? "", tone: "success" }));

  useEffect(() => {
    if (location.state?.notice) {
      navigate({ search: location.search }, { replace: true, state: null });
    }
  }, [location.state, location.search, navigate]);

  return [notice, setNotice];
}
