/**
 * @file Generic CRUD router compatible with the json-server (v1 and v0)
 * query syntax the frontend was built against.
 *
 * Filtering
 *   ?category=cpu&brand=AMD             equality
 *   ?price:gte=500&price:lte=2000       v1 operators: lt, lte, gt, gte, ne, eq, in
 *   ?name:contains=ryzen                v1 string operators: contains, startsWith, endsWith
 *   ?price_gte=500&name_like=ryzen      legacy v0 suffixes
 *   ?specs.socket=AM5                   field inside the free-form `specs`
 *   ?_where={"userId":{"eq":"1"}}       v1 JSON filter (keeps types; supports "or" / "and")
 * Sorting
 *   ?_sort=-price,name                  "-" means descending (or ?_sort=price&_order=desc)
 * Pagination
 *   ?_page=2&_per_page=10               v1: { first, prev, next, last, pages, items, data }
 *   ?_page=2&_limit=10                  v0: plain array + X-Total-Count header
 *   ?_limit=5 | ?_start=0&_end=5        simple slice
 * Relations
 *   ?_embed=orders                      attach children (matched by <resource>Id)
 *   ?_expand=user                       attach the parent (matched by userId)
 * Deletion
 *   DELETE /users/1?_dependent=carts    also deletes the listed children; other
 *                                       collections pointing to it get null
 */
const { Router } = require("express");
const { httpError, wrap } = require("./errors");

/** Query parameters with a special meaning; they are never used as field filters. */
const RESERVED = new Set([
  "_sort",
  "_order",
  "_limit",
  "_page",
  "_per_page",
  "_start",
  "_end",
  "_where",
  "_dependent",
  "_embed",
  "_expand",
]);

/** json-server comparison operators mapped to their MongoDB equivalents. */
const COMPARE = { lt: "$lt", lte: "$lte", gt: "$gt", gte: "$gte", ne: "$ne", eq: "$eq", in: "$in" };

/** Legacy (v0) field suffixes mapped to v1 operator names. */
const LEGACY_SUFFIX = {
  _lt: "lt",
  _lte: "lte",
  _gt: "gt",
  _gte: "gte",
  _ne: "ne",
  _like: "contains",
};

/**
 * Escapes regular-expression metacharacters so user input is matched literally.
 * @param {string} s Raw text.
 * @returns {string}
 */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Normalizes a query value into an array (comma-separated strings are split).
 * @param {string | string[]} v Single value, list, or "a,b,c" string.
 * @returns {string[]}
 */
const toArray = (v) => (Array.isArray(v) ? v : String(v).split(","));

/**
 * Returns the singular form of a resource name ("users" -> "user"),
 * used to derive foreign keys such as `userId`.
 * @param {string} name Plural resource name.
 * @returns {string}
 */
const singular = (name) => name.replace(/s$/, "");

/**
 * Maps the public `id` field to MongoDB's `_id`.
 * @param {string} key Field name from the request.
 * @returns {string}
 */
const idPath = (key) => (key === "id" ? "_id" : key);

/**
 * Converts a query-string value (always text) into a boolean, null or number
 * when it looks like one. Used for fields Mongoose cannot cast on its own
 * (inside the free-form `specs`).
 * @param {string} value Raw query value.
 * @returns {string | number | boolean | null}
 */
function coerce(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (value !== "" && !Number.isNaN(Number(value))) return Number(value);
  return value;
}

/**
 * Identity converter, used when values already have their final type
 * (such as those inside the `_where` JSON).
 * @param {unknown} v Any value.
 * @returns {unknown} The same value.
 */
const identity = (v) => v;

/**
 * Translates one json-server operator into a MongoDB condition.
 * @param {string} op Operator name (lt, gte, contains, in, ...).
 * @param {unknown} value Operand.
 * @param {(v: unknown) => unknown} convert Value converter for the target field.
 * @returns {Record<string, unknown>} MongoDB condition, e.g. { $gte: 5 }.
 * @throws {Error} HTTP 400 when the operator is unknown.
 */
function condition(op, value, convert) {
  switch (op) {
    case "contains":
      return { $regex: escapeRegex(String(value)), $options: "i" };
    case "startsWith":
      return { $regex: `^${escapeRegex(String(value))}`, $options: "i" };
    case "endsWith":
      return { $regex: `${escapeRegex(String(value))}$`, $options: "i" };
    case "in":
      return { $in: toArray(value).map(convert) };
    default:
      if (COMPARE[op]) return { [COMPARE[op]]: convert(value) };
      throw httpError(400, `Unknown operator: ${op}`);
  }
}

/**
 * Builds a MongoDB filter from plain query-string parameters
 * (`field=value`, `field:op=value` and legacy `field_op=value`).
 * @param {import("mongoose").Model} Model Model being queried.
 * @param {Record<string, unknown>} query Parsed `req.query`.
 * @returns {Record<string, unknown>} Filter keyed by field path.
 */
function filterFromQuery(Model, query) {
  const conditions = {};
  for (const [rawKey, rawValue] of Object.entries(query)) {
    if (RESERVED.has(rawKey)) continue;

    // Split "price:gte" (v1) or "price_gte" (v0) into field and operator.
    let field = rawKey;
    let op = "eq";
    const colon = rawKey.lastIndexOf(":");
    if (colon > 0) {
      field = rawKey.slice(0, colon);
      op = rawKey.slice(colon + 1);
    } else {
      const legacy = Object.keys(LEGACY_SUFFIX).find((s) => rawKey.endsWith(s));
      if (legacy) {
        field = rawKey.slice(0, -legacy.length);
        op = LEGACY_SUFFIX[legacy];
      }
    }

    // Schema fields are cast by Mongoose; Mixed ones (specs.*) need manual coercion.
    const path = idPath(field);
    const schemaType = Model.schema.path(path);
    /**
     * Prepares a query value for this field: schema fields are left for
     * Mongoose to cast, free-form (Mixed) ones are coerced here.
     * @param {string} v Raw query value.
     * @returns {unknown}
     */
    const convert = (v) => (schemaType && schemaType.instance !== "Mixed" ? v : coerce(v));

    // A repeated key (?category=cpu&category=gpu) means "any of".
    const cond =
      Array.isArray(rawValue) && op === "eq"
        ? { $in: rawValue.map(convert) }
        : condition(op, rawValue, convert);
    conditions[path] = { ...conditions[path], ...cond };
  }
  return conditions;
}

/**
 * Builds a MongoDB filter from the json-server v1 `_where` JSON parameter,
 * e.g. {"userId":{"eq":"1"},"or":[{"name":{"contains":"a"}}]}.
 * @param {string | undefined} raw Raw `_where` query value.
 * @returns {Record<string, unknown>} MongoDB filter ({} when `_where` is absent).
 * @throws {Error} HTTP 400 when the value is not valid JSON.
 */
function filterFromWhere(raw) {
  if (!raw) return {};
  let where;
  try {
    where = JSON.parse(raw);
  } catch {
    throw httpError(400, "_where is not valid JSON");
  }

  /**
   * Recursively converts a `_where` object into a MongoDB `$and` filter.
   * @param {Record<string, unknown>} obj Part of the `_where` tree.
   * @returns {Record<string, unknown>}
   */
  const build = (obj) => {
    const clauses = [];
    for (const [key, cond] of Object.entries(obj)) {
      if (key === "or" || key === "and") {
        clauses.push({ [`$${key}`]: cond.map(build) });
      } else if (cond !== null && typeof cond === "object" && !Array.isArray(cond)) {
        const merged = {};
        for (const [op, value] of Object.entries(cond)) {
          Object.assign(merged, condition(op, value, identity));
        }
        clauses.push({ [idPath(key)]: merged });
      } else {
        clauses.push({ [idPath(key)]: { $eq: cond } });
      }
    }
    return clauses.length ? { $and: clauses } : {};
  };
  return build(where);
}

/**
 * Combines the plain query-string filters and the `_where` filter.
 * @param {import("mongoose").Model} Model Model being queried.
 * @param {Record<string, unknown>} query Parsed `req.query`.
 * @returns {Record<string, unknown>} Final MongoDB filter.
 */
function buildFilter(Model, query) {
  const parts = [filterFromQuery(Model, query), filterFromWhere(query._where)].filter(
    (p) => Object.keys(p).length > 0,
  );
  if (parts.length === 0) return {};
  return parts.length === 1 ? parts[0] : { $and: parts };
}

/**
 * Builds a MongoDB sort specification from `_sort` (and the legacy `_order`).
 * @param {Record<string, unknown>} query Parsed `req.query`.
 * @returns {Array<[string, 1 | -1]> | undefined} Sort pairs, or undefined.
 */
function buildSort(query) {
  if (!query._sort) return undefined;
  const fields = String(query._sort).split(",").filter(Boolean);
  const orders = String(query._order || "").split(",");
  return fields.map((field, i) => {
    let desc = field.startsWith("-");
    if (desc) field = field.slice(1);
    if (!desc && (orders[i] || orders[0]).toLowerCase() === "desc") desc = true;
    return [idPath(field), desc ? -1 : 1];
  });
}

/**
 * Applies `_embed` (children) and `_expand` (parent) to a list of documents.
 * Returns the documents untouched when neither parameter is present.
 * @param {import("mongoose").Document[]} items Documents to enrich.
 * @param {Record<string, unknown>} query Parsed `req.query`.
 * @param {string} resource Name of the current resource (e.g. "users").
 * @param {Record<string, import("mongoose").Model>} models All models by resource name.
 * @returns {Promise<Array<Document | Record<string, unknown>>>}
 * @throws {Error} HTTP 400 when a named resource does not exist.
 */
async function applyRelations(items, query, resource, models) {
  const embed = [].concat(query._embed || []).flatMap(toArray);
  const expand = [].concat(query._expand || []).flatMap(toArray);
  if (!embed.length && !expand.length) return items;

  const plain = items.map((i) => i.toJSON());
  const ids = plain.map((i) => i.id);
  const fk = `${singular(resource)}Id`;

  // Children: other documents whose <resource>Id points to each item.
  for (const name of embed) {
    const Child = models[name];
    if (!Child) throw httpError(400, `Unknown resource in _embed: ${name}`);
    const children = (await Child.find({ [fk]: { $in: ids } })).map((c) => c.toJSON());
    for (const item of plain) {
      item[name] = children.filter((c) => String(c[fk]) === String(item.id));
    }
  }

  // Parent: the document each item points to through <name>Id.
  for (const name of expand) {
    const Parent = models[`${name}s`];
    if (!Parent) throw httpError(400, `Unknown resource in _expand: ${name}`);
    const parentKey = `${name}Id`;
    const parentIds = plain.map((i) => i[parentKey]).filter(Boolean);
    const parents = (await Parent.find({ _id: { $in: parentIds } })).map((p) => p.toJSON());
    for (const item of plain) {
      item[name] = parents.find((p) => String(p.id) === String(item[parentKey])) || null;
    }
  }
  return plain;
}

/**
 * Creates the CRUD router of a model.
 * @param {import("mongoose").Model} Model Model served by the router.
 * @param {object} [options]
 * @param {string} options.name Resource name (e.g. "users").
 * @param {Record<string, import("mongoose").Model>} options.models All models by resource name.
 * @param {(doc: import("mongoose").Document) => (string | null | Promise<string | null>)} [options.beforeDelete]
 *   Guard run before deletion; a returned message blocks it with HTTP 403.
 * @returns {import("express").Router}
 */
function crud(Model, options = {}) {
  const router = Router();
  const { name: resource, models = {} } = options;

  /**
   * Builds the 404 error used by every route that targets one record.
   * @returns {Error & { status: number }}
   */
  const notFound = () => httpError(404, "Not found");

  // GET / - list with filters, sorting and pagination.
  router.get(
    "/",
    wrap(async (req, res) => {
      const q = req.query;
      const filter = buildFilter(Model, q);
      let query = Model.find(filter);

      const sort = buildSort(q);
      if (sort) query = query.sort(sort);

      // v1 pagination (_page / _per_page) answers with an object plus metadata.
      const v1Pagination =
        q._per_page !== undefined || (q._page !== undefined && q._limit === undefined);
      if (v1Pagination) {
        const perPage = Math.max(parseInt(q._per_page, 10) || 10, 1);
        const page = Math.max(parseInt(q._page, 10) || 1, 1);
        const total = await Model.countDocuments(filter);
        const pages = Math.max(Math.ceil(total / perPage), 1);
        const items = await query.skip((page - 1) * perPage).limit(perPage);
        return res.json({
          first: 1,
          prev: page > 1 ? page - 1 : null,
          next: page < pages ? page + 1 : null,
          last: pages,
          pages,
          items: total,
          data: await applyRelations(items, q, resource, models),
        });
      }

      // v0 pagination / slicing answers with a plain array.
      const limit = parseInt(q._limit, 10);
      const page = parseInt(q._page, 10);
      const start = parseInt(q._start, 10);
      const end = parseInt(q._end, 10);
      if (page > 0 && limit > 0) {
        query = query.skip((page - 1) * limit).limit(limit);
        res.set("X-Total-Count", String(await Model.countDocuments(filter)));
      } else if (start >= 0 && end > start) {
        query = query.skip(start).limit(end - start);
        res.set("X-Total-Count", String(await Model.countDocuments(filter)));
      } else if (limit > 0) {
        query = query.limit(limit);
      }

      return res.json(await applyRelations(await query, q, resource, models));
    }),
  );

  // GET /:id - fetch one record.
  router.get(
    "/:id",
    wrap(async (req, res) => {
      const doc = await Model.findById(req.params.id);
      if (!doc) throw notFound();
      const [item] = await applyRelations([doc], req.query, resource, models);
      res.json(item);
    }),
  );

  // POST / - create a record (a client-provided id is kept, otherwise one is generated).
  router.post(
    "/",
    wrap(async (req, res) => {
      const { id, _id, ...data } = req.body;
      const doc = await Model.create(id ? { _id: id, ...data } : data);
      res.status(201).json(doc);
    }),
  );

  // PUT /:id - replace the whole record.
  router.put(
    "/:id",
    wrap(async (req, res) => {
      const doc = await Model.findById(req.params.id);
      if (!doc) throw notFound();
      const { id, _id, ...data } = req.body;
      doc.overwrite(data);
      await doc.save();
      res.json(doc);
    }),
  );

  // PATCH /:id - change only the fields sent.
  router.patch(
    "/:id",
    wrap(async (req, res) => {
      const { id, _id, ...data } = req.body;
      const doc = await Model.findByIdAndUpdate(
        req.params.id,
        { $set: data },
        { new: true, runValidators: true },
      );
      if (!doc) throw notFound();
      res.json(doc);
    }),
  );

  // DELETE /:id - remove a record and return it. As in json-server v1, other
  // resources pointing to it (<resource>Id) are set to null, except those
  // listed in ?_dependent=..., which are deleted. Deleting a client therefore
  // removes the cart and saved builds but keeps orders (userId: null).
  router.delete(
    "/:id",
    wrap(async (req, res) => {
      const doc = await Model.findById(req.params.id);
      if (!doc) throw notFound();
      if (options.beforeDelete) {
        const message = await options.beforeDelete(doc);
        if (message) throw httpError(403, message);
      }

      const dependents = [].concat(req.query._dependent || []).flatMap(toArray);
      for (const dep of dependents) {
        if (!models[dep]) throw httpError(400, `Unknown resource in _dependent: ${dep}`);
      }

      await doc.deleteOne();

      const fk = `${singular(resource)}Id`;
      for (const [depName, Dep] of Object.entries(models)) {
        if (Dep === Model) continue;
        if (dependents.includes(depName)) {
          await Dep.deleteMany({ [fk]: doc.id });
        } else if (Dep.schema.path(fk)) {
          await Dep.updateMany({ [fk]: doc.id }, { $set: { [fk]: null } });
        }
      }
      res.json(doc);
    }),
  );

  return router;
}

module.exports = { crud, buildFilter, buildSort };
