/**
 * @file Store rules shared with the React client. The MCP server imports
 * them straight from `frontend/src/utils` so agents and the store always
 * apply the same compatibility, stock and spec rules. Only pure modules are
 * imported here: anything that touches `import.meta.env` or the DOM would
 * not load in Node.
 */
export {
  CATEGORIES,
  BUILDER_CATEGORIES,
  categoryLabel,
} from "../../frontend/src/utils/categories.js";
export {
  analyzeCompatibility,
  BASE_WATTS,
  PSU_HEADROOM,
} from "../../frontend/src/utils/compatibility.js";
export {
  rankOptions,
  statusMessage,
  keySpecsText,
  addBlockReason,
  buildCartEntries,
  ASSEMBLY_SERVICE_ID,
} from "../../frontend/src/utils/builder.js";
export { addItems, setItemQuantity, removeItem, cartCount } from "../../frontend/src/utils/cart.js";
export {
  BUILD_NAME_MAX,
  describeSavedBuild,
  toBuildRecord,
  validateBuildName,
} from "../../frontend/src/utils/savedBuilds.js";
export { sameId } from "../../frontend/src/utils/ids.js";
export { formatSpecs } from "../../frontend/src/utils/specs.js";
export { stockStatus, maxPurchasable, LOW_STOCK_THRESHOLD } from "../../frontend/src/utils/stock.js";
export {
  specFields,
  specFieldLabel,
  validateProduct,
  toFormValues,
  toProductRecord,
} from "../../frontend/src/utils/productForm.js";
export { dashboardStats } from "../../frontend/src/utils/dashboardStats.js";
export { isService } from "../../frontend/src/utils/stock.js";
