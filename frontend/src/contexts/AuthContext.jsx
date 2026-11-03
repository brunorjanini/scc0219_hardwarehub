import { useCallback, useMemo, useState } from "react";
import { AuthContext, SESSION_KEY } from "./auth";

// Reads the saved session; ignores missing or corrupted data
function readSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (saved && saved.id !== undefined && saved.type) return saved;
  } catch {
    // Corrupted JSON: fall through and start logged out
  }
  return null;
}

// Keeps the logged-in user in memory and in localStorage, so a page
// reload does not log the user out. Only id, type and name are stored
// (never the password).
export default function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession);

  const login = useCallback(({ id, type, name }) => {
    const session = { id: String(id), type, name: name ?? "" };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    setUser(session);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
