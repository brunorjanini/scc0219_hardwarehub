import { useContext } from "react";
import { AuthContext } from "./auth";

// Returns { user, login, logout }. `user` is null when nobody is logged in,
// otherwise { id, type: "user" | "admin", name }.
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}
