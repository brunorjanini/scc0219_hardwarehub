// In-memory fake of the store API for page tests (cart, checkout, orders).
// Tests call vi.mock() on the api modules and then installStore(...) to
// make the mocked functions read and write this fake database.
import { getProduct, listProducts, updateProduct } from "../api/products";
import { createCart, getCartByUser, saveCartItems } from "../api/carts";
import { createOrder, getOrder } from "../api/orders";
import { getUser } from "../api/users";
import { ApiError } from "../api/http";

const notFound = () => new ApiError("Erro na requisição (404)", 404);

// Copies the given data and wires every mocked API function to it.
// Returns the live database so tests can inspect the final state.
export function installStore({ products = [], cartItems = null, users = [], orders = [] } = {}) {
  const db = {
    products: Object.fromEntries(products.map((p) => [String(p.id), { ...p }])),
    cart: cartItems ? { id: "c1", userId: "1", items: cartItems.map((i) => ({ ...i })) } : null,
    users: Object.fromEntries(users.map((u) => [String(u.id), { ...u }])),
    orders: Object.fromEntries(orders.map((o) => [String(o.id), { ...o }])),
  };

  getProduct.mockReset().mockImplementation(async (id) => {
    const product = db.products[String(id)];
    if (!product) throw notFound();
    return { ...product };
  });
  updateProduct.mockReset().mockImplementation(async (id, changes) => {
    db.products[String(id)] = { ...db.products[String(id)], ...changes };
    return { ...db.products[String(id)] };
  });
  listProducts.mockReset().mockImplementation(async () => Object.values(db.products));

  getCartByUser.mockReset().mockImplementation(async () => (db.cart ? { ...db.cart } : null));
  createCart.mockReset().mockImplementation(async (userId, items) => {
    db.cart = { id: "c1", userId, items };
    return { ...db.cart };
  });
  saveCartItems.mockReset().mockImplementation(async (id, items) => {
    db.cart = { ...db.cart, items };
    return { ...db.cart };
  });

  createOrder.mockReset().mockImplementation(async (order) => {
    const id = `o${Object.keys(db.orders).length + 1}`;
    db.orders[id] = { ...order, id };
    return { ...db.orders[id] };
  });
  getOrder.mockReset().mockImplementation(async (id) => {
    const order = db.orders[String(id)];
    if (!order) throw notFound();
    return { ...order };
  });

  getUser.mockReset().mockImplementation(async (id) => {
    const user = db.users[String(id)];
    if (!user) throw notFound();
    return { ...user };
  });

  return db;
}

// The seed client (id "1"), with an address for the checkout form
export const CLIENT = {
  id: "1",
  type: "user",
  name: "Ana Souza",
  email: "user@gmail.com",
  phone: "(16) 99123-4567",
  address: { street: "Av. Trabalhador São-carlense", number: "400", city: "São Carlos", zip: "13566-590" },
};
