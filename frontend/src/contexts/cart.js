import { createContext } from "react";

// Shared cart context object. Kept in its own file so CartContext.jsx
// only exports a component (required by Vite fast refresh).
// Use the useCart() hook from ./useCart.js to read it.
export const CartContext = createContext(null);
