// Logo asset variants (one per background)
import logoDark from "../assets/logo-dark.svg";
import logoLight from "../assets/logo-light.svg";

// HardwareHub logo. `theme="dark"` is the variant for dark backgrounds.
// The alt text is the store name; pass alt="" when the logo sits inside a
// link that already has its own name (e.g. "HardwareHub, página inicial").
export default function Logo({ theme, className, alt = "HardwareHub" }) {
  return <img className={className} src={theme === "dark" ? logoDark : logoLight} alt={alt} />;
}
