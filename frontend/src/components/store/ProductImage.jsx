import { placeholderPhoto } from "../../utils/categories";

// Product photo that falls back to the category placeholder when the
// photo is missing or fails to load (e.g. a wrong URL typed by an admin).
// Pass alt="" when the product name is already next to the image.
export default function ProductImage({ product, alt, className }) {
  const fallback = placeholderPhoto(product.category);

  function handleError(e) {
    // Swap only once, so a missing placeholder cannot loop
    if (!e.currentTarget.src.endsWith(fallback)) {
      e.currentTarget.src = fallback;
    }
  }

  return (
    <img
      className={className}
      src={product.photo || fallback}
      alt={alt ?? product.name}
      loading="lazy"
      onError={handleError}
    />
  );
}
