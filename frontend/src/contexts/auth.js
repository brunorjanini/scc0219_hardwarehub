import { createContext } from "react";

// Shared auth context object. Kept in its own file so AuthContext.jsx
// only exports a component (required by Vite fast refresh).
// Use the useAuth() hook from ./useAuth.js to read it.
export const AuthContext = createContext(null);

// localStorage key that keeps the session across page reloads
export const SESSION_KEY = "hardwarehub:session";
