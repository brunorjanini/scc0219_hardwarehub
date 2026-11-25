/**
 * @file Checkout route: turns a cart into a paid order while keeping stock
 * consistent.
 */
const { Router } = require("express");
const { users, products, carts, orders } = require("../models");
const { httpError, wrap } = require("../errors");

const router = Router();

/**
 * Rounds a monetary value to cents, avoiding floating-point noise
 * such as 899.9 * 3 = 2699.7000000000003.
 * @param {number} n Amount.
 * @returns {number}
 */
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * POST /checkout
 * Body: { userId, items: [{ productId, quantity }], cardNumber, address? }
 *
 * Everything runs on the server so stock cannot become inconsistent:
 *  1. validates the items and uses the prices stored in the database;
 *  2. decrements `stock` and increments `sold` with a conditional update
 *     (`stock >= quantity`), which is atomic even with concurrent buyers;
 *  3. stores the order (masked card) and empties the cart.
 * If any line fails, the lines already applied are reverted.
 */
router.post(
  "/",
  wrap(async (req, res) => {
    const { userId, items, cardNumber } = req.body;

    if (!userId) throw httpError(400, "userId is required");
    if (!Array.isArray(items) || items.length === 0) throw httpError(400, "The cart is empty");
    const digits = String(cardNumber ?? "").replace(/\D/g, "");
    if (digits.length < 4) throw httpError(400, "Enter the card number");

    const user = await users.findById(userId);
    if (!user) throw httpError(404, "Customer not found");

    // Merge repeated lines of the same product.
    const quantities = new Map();
    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!item.productId || !Number.isInteger(quantity) || quantity < 1) {
        throw httpError(400, "Invalid cart item");
      }
      quantities.set(item.productId, (quantities.get(item.productId) || 0) + quantity);
    }

    // Load the products and pair each one with the requested quantity.
    const found = await products.find({ _id: { $in: [...quantities.keys()] } });
    const byId = new Map(found.map((p) => [p.id, p]));
    const lines = [];
    for (const [productId, quantity] of quantities) {
      const product = byId.get(productId);
      if (!product) throw httpError(404, `Product ${productId} not found`);
      lines.push({ product, quantity });
    }

    // Apply stock changes line by line, remembering what to undo on failure.
    const applied = [];
    let order;
    try {
      for (const { product, quantity } of lines) {
        if (product.type === "service") {
          // Services have no stock; only the sales counter changes.
          await products.updateOne({ _id: product.id }, { $inc: { sold: quantity } });
          applied.push({ id: product.id, quantity, service: true });
          continue;
        }
        const result = await products.updateOne(
          { _id: product.id, stock: { $gte: quantity } },
          { $inc: { stock: -quantity, sold: quantity } },
        );
        if (result.modifiedCount === 0) {
          throw httpError(409, `Not enough stock for "${product.name}"`);
        }
        applied.push({ id: product.id, quantity, service: false });
      }

      order = await orders.create({
        userId,
        items: lines.map(({ product, quantity }) => ({
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity,
        })),
        total: round2(lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0)),
        cardLast4: digits.slice(-4),
        address: req.body.address || user.address,
        status: "Pago", // value used by the frontend, do not translate
      });
    } catch (err) {
      // Compensate: give back the stock and the sales counters already changed.
      for (const a of applied) {
        await products.updateOne(
          { _id: a.id },
          a.service
            ? { $inc: { sold: -a.quantity } }
            : { $inc: { stock: a.quantity, sold: -a.quantity } },
        );
      }
      throw err;
    }

    // Emptying the cart is best effort: the order already exists at this point.
    await carts.updateOne({ userId }, { $set: { items: [] } }).catch(() => {});
    res.status(201).json(order);
  }),
);

module.exports = router;
