import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import AuthProvider from "./AuthContext";
import CartProvider from "./CartContext";
import { useCart } from "./useCart";
import { useAuth } from "./useAuth";
import { SESSION_KEY } from "./auth";
import { createCart, getCartByUser, saveCartItems } from "../api/carts";
import { ADMIN_SESSION, CLIENT_SESSION, GPU, LAST_UNITS_CPU, SERVICE } from "../test/renderWithRouter";

vi.mock("../api/carts", () => ({
  getCartByUser: vi.fn(),
  createCart: vi.fn(),
  saveCartItems: vi.fn(),
}));

const wrapper = ({ children }) => (
  <AuthProvider>
    <CartProvider>{children}</CartProvider>
  </AuthProvider>
);

function renderCart(session) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return renderHook(() => ({ cart: useCart(), auth: useAuth() }), { wrapper });
}

beforeEach(() => {
  getCartByUser.mockReset().mockResolvedValue(null);
  createCart.mockReset().mockImplementation(async (userId, items) => ({ id: "c1", userId, items }));
  saveCartItems.mockReset().mockImplementation(async (id, items) => ({ id, userId: "1", items }));
});

describe("CartProvider", () => {
  it("is empty for guests and never calls the server", async () => {
    const { result } = renderCart();

    expect(result.current.cart).toMatchObject({ status: "guest", count: 0, canShop: false });
    await expect(result.current.cart.addItem(GPU)).resolves.toEqual({
      error: "Entre na sua conta para usar o carrinho",
    });
    expect(getCartByUser).not.toHaveBeenCalled();
  });

  it("does not let administrators shop", async () => {
    const { result } = renderCart(ADMIN_SESSION);

    expect(result.current.cart.canShop).toBe(false);
    await expect(result.current.cart.addItem(GPU)).resolves.toEqual({
      error: "Entre com uma conta de cliente para comprar",
    });
    expect(getCartByUser).not.toHaveBeenCalled();
  });

  it("loads the client's saved cart", async () => {
    getCartByUser.mockResolvedValue({ id: "c9", userId: "1", items: [{ productId: "13", quantity: 2 }] });
    const { result } = renderCart(CLIENT_SESSION);

    expect(result.current.cart.status).toBe("loading");
    await waitFor(() => expect(result.current.cart.status).toBe("ready"));
    expect(getCartByUser).toHaveBeenCalledWith("1");
    expect(result.current.cart.count).toBe(2);
    expect(result.current.cart.quantityOf("13")).toBe(2);
  });

  it("creates the cart on the server on the first add, then patches it", async () => {
    const { result } = renderCart(CLIENT_SESSION);
    await waitFor(() => expect(result.current.cart.status).toBe("ready"));

    await act(() => result.current.cart.addItem(GPU, 2));
    expect(createCart).toHaveBeenCalledWith("1", [{ productId: "13", quantity: 2 }]);

    await act(() => result.current.cart.addItem(SERVICE));
    expect(saveCartItems).toHaveBeenCalledWith("c1", [
      { productId: "13", quantity: 2 },
      { productId: "27", quantity: 1 },
    ]);
    expect(result.current.cart.count).toBe(3);
  });

  it("runs quick clicks in order, so the second sees the first", async () => {
    const { result } = renderCart(CLIENT_SESSION);

    // Both clicks happen before the cart has even loaded
    let first;
    let second;
    act(() => {
      first = result.current.cart.addItem(GPU, 1);
      second = result.current.cart.addItem(GPU, 1);
    });
    await act(async () => {
      await first;
      await second;
    });

    expect(createCart).toHaveBeenCalledTimes(1);
    expect(saveCartItems).toHaveBeenCalledWith("c1", [{ productId: "13", quantity: 2 }]);
    expect(result.current.cart.quantityOf("13")).toBe(2);
  });

  it("refuses more units than the stock without calling the server", async () => {
    getCartByUser.mockResolvedValue({ id: "c9", userId: "1", items: [{ productId: "1", quantity: 3 }] });
    const { result } = renderCart(CLIENT_SESSION);
    await waitFor(() => expect(result.current.cart.status).toBe("ready"));

    let outcome;
    await act(async () => {
      outcome = await result.current.cart.addItem(LAST_UNITS_CPU, 1);
    });

    expect(outcome.error).toMatch(/Você já tem 3 no carrinho/);
    expect(saveCartItems).not.toHaveBeenCalled();
  });

  it("updates, removes and clears items", async () => {
    getCartByUser.mockResolvedValue({
      id: "c9",
      userId: "1",
      items: [
        { productId: "13", quantity: 1 },
        { productId: "27", quantity: 1 },
      ],
    });
    const { result } = renderCart(CLIENT_SESSION);
    await waitFor(() => expect(result.current.cart.status).toBe("ready"));

    await act(() => result.current.cart.setQuantity(GPU, 4));
    expect(saveCartItems).toHaveBeenLastCalledWith("c9", [
      { productId: "13", quantity: 4 },
      { productId: "27", quantity: 1 },
    ]);

    await act(() => result.current.cart.removeItem("27"));
    expect(saveCartItems).toHaveBeenLastCalledWith("c9", [{ productId: "13", quantity: 4 }]);

    await act(() => result.current.cart.clearCart());
    expect(saveCartItems).toHaveBeenLastCalledWith("c9", []);
    expect(result.current.cart.count).toBe(0);
  });

  it("reports a failed save and keeps the previous items", async () => {
    getCartByUser.mockResolvedValue({ id: "c9", userId: "1", items: [{ productId: "13", quantity: 1 }] });
    saveCartItems.mockRejectedValueOnce(new Error("Erro na requisição (500)"));
    const { result } = renderCart(CLIENT_SESSION);
    await waitFor(() => expect(result.current.cart.status).toBe("ready"));

    let outcome;
    await act(async () => {
      outcome = await result.current.cart.addItem(GPU, 1);
    });
    expect(outcome).toEqual({ error: "Erro na requisição (500)" });
    expect(result.current.cart.quantityOf("13")).toBe(1);

    // The queue is not stuck after the failure
    await act(() => result.current.cart.addItem(GPU, 1));
    expect(result.current.cart.quantityOf("13")).toBe(2);
  });

  it("shows an error state when the cart cannot load", async () => {
    getCartByUser.mockRejectedValue(new Error("Não foi possível conectar ao servidor."));
    const { result } = renderCart(CLIENT_SESSION);

    await waitFor(() => expect(result.current.cart.status).toBe("error"));
    expect(result.current.cart.error).toBe("Não foi possível conectar ao servidor.");
  });

  it("empties the cart in memory on logout", async () => {
    getCartByUser.mockResolvedValue({ id: "c9", userId: "1", items: [{ productId: "13", quantity: 2 }] });
    const { result } = renderCart(CLIENT_SESSION);
    await waitFor(() => expect(result.current.cart.count).toBe(2));

    act(() => result.current.auth.logout());

    expect(result.current.cart).toMatchObject({ status: "guest", count: 0 });
  });
});
