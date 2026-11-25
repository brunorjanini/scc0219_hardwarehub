/**
 * @file Mongoose models. The export keys are the REST resource names
 * (/users, /products, ...), which the generic CRUD router relies on.
 */
const { Schema, model } = require("mongoose");
const { randomBytes } = require("crypto");

/**
 * Generates a random 12-character string id. Ids are strings (as in
 * json-server): seed data keeps "1", "2", ... and new records get this one.
 * @returns {string}
 */
const newId = () => randomBytes(9).toString("base64url");

/**
 * JSON serialization options: exposes `_id` as `id` so API responses keep
 * the shape the frontend expects.
 */
const toJSON = {
  /**
   * Renames `_id` to `id` and puts it first in the serialized object.
   * @param {unknown} doc Source document (unused).
   * @param {Record<string, unknown>} ret Plain object being serialized.
   * @returns {Record<string, unknown>}
   */
  transform: (doc, ret) => {
    const { _id, ...rest } = ret;
    return { id: _id, ...rest };
  },
};

/**
 * Builds a schema with a string `_id`, no `__v` and the `id` serialization.
 * @param {import("mongoose").SchemaDefinition} definition Field definitions.
 * @returns {Schema}
 */
function makeSchema(definition) {
  return new Schema(
    { _id: { type: String, default: newId }, ...definition },
    { versionKey: false, toJSON },
  );
}

/** Address fields shared by users and orders. */
const address = {
  street: String,
  number: String,
  city: String,
  zip: String,
};

/** Clients and administrators share one collection, told apart by `type`. */
const userSchema = makeSchema({
  type: { type: String, enum: ["user", "admin"], default: "user" },
  name: { type: String, required: true, trim: true },
  username: String, // admins only
  email: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true }, // plain text by design: no hashing required
  phone: String,
  address, // clients only
});

/** Products and services; `specs` varies by category, hence a free-form object. */
const productSchema = makeSchema({
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: ["product", "service"], default: "product", index: true },
  category: { type: String, required: true, index: true },
  brand: String,
  photo: String,
  description: String,
  price: { type: Number, required: true, min: 0 },
  oldPrice: Number,
  stock: { type: Number, default: null, min: 0 }, // null = service (no stock limit)
  sold: { type: Number, default: 0, min: 0 },
  specs: { type: Schema.Types.Mixed, default: {} },
});

/** A line of a shopping cart. */
const cartItemSchema = new Schema(
  {
    productId: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

/** One cart per client. */
const cartSchema = makeSchema({
  userId: { type: String, required: true, index: true },
  items: { type: [cartItemSchema], default: [] },
});

/** A purchased line; name and price are copied at purchase time. */
const orderItemSchema = new Schema(
  { productId: String, name: String, price: Number, quantity: Number },
  { _id: false },
);

/** Orders keep sales history, so `userId` may become null if the client is deleted. */
const orderSchema = makeSchema({
  userId: { type: String, index: true },
  items: [orderItemSchema],
  total: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  cardLast4: String,
  address,
  status: { type: String, default: "Pago" }, // value used by the frontend, do not translate
});

/** Saved PC Builder configurations; `parts` maps a slot to a product id. */
const buildSchema = makeSchema({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  parts: { type: Schema.Types.Mixed, default: {} },
  total: Number,
  createdAt: { type: Date, default: Date.now },
});

module.exports = {
  users: model("User", userSchema),
  products: model("Product", productSchema),
  carts: model("Cart", cartSchema),
  orders: model("Order", orderSchema),
  builds: model("Build", buildSchema),
};
