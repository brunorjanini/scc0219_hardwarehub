// Test helper: renders routes inside AuthProvider + CartProvider + a
// memory router, starting at `path`. Pass `session` to start logged in.
import { render } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import AuthProvider from "../contexts/AuthContext";
import CartProvider from "../contexts/CartContext";
import { SESSION_KEY } from "../contexts/auth";

export function renderWithRouter(routes, { path = "/", session } = {}) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const result = render(
    <AuthProvider>
      <CartProvider>
        <RouterProvider router={router} />
      </CartProvider>
    </AuthProvider>,
  );

  return { ...result, router };
}

// Sessions used across tests
export const CLIENT_SESSION = { id: "1", type: "user", name: "Ana Souza" };
export const ADMIN_SESSION = { id: "3", type: "admin", name: "Administrador" };

// Products shaped like seed.json, used across tests
export const GPU = {
  id: "13",
  name: "GeForce RTX 4070 SUPER 12GB",
  type: "product",
  category: "gpu",
  brand: "NVIDIA",
  photo: "/products/geoforce_rtx.jpg",
  description: "Placa de vídeo para jogos em 1440p.",
  price: 4299.9,
  oldPrice: 4899.9,
  stock: 6,
  sold: 27,
  specs: { vramGb: 12, lengthMm: 261, tdp: 220 },
};

export const LAST_UNITS_CPU = {
  id: "1",
  name: "AMD Ryzen 7 7800X3D",
  type: "product",
  category: "cpu",
  brand: "AMD",
  photo: "/products/ryzen7.jpeg",
  description: "Processador de 8 núcleos.",
  price: 2499.9,
  stock: 3,
  sold: 42,
  specs: { socket: "AM5", cores: 8, baseClockGhz: 4.2, tdp: 120 },
};

export const OUT_OF_STOCK = {
  id: "16",
  name: "Kingston NV2 1TB NVMe",
  type: "product",
  category: "storage",
  brand: "Kingston",
  photo: "",
  description: "SSD NVMe.",
  price: 449.9,
  stock: 0,
  sold: 70,
  specs: { storageType: "NVMe", capacityGb: 1000 },
};

export const SERVICE = {
  id: "27",
  name: "Montagem de PC",
  type: "service",
  category: "service",
  brand: "HardwareHub",
  photo: "/products/placeholder-service.svg",
  description: "Montagem completa.",
  price: 199.9,
  stock: null,
  sold: 20,
  specs: { durationHours: 4 },
};
