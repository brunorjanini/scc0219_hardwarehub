import "./Footer.css";
import { Link } from "react-router";
import { Check } from "lucide-react";
import Logo from "../Logo";
import { catalogPath } from "../../utils/catalogQuery";

// Links to pages that exist (the mockup's "Institucional", "Sobre nós"...
// have no page in this milestone, so they are not shown as links)
const LINKS = [
  { label: "Catálogo", to: catalogPath({}) },
  { label: "Monte seu PC", to: "/monte-seu-pc" },
  { label: "Serviços", to: catalogPath({ category: "service" }) },
  { label: "Ofertas", to: catalogPath({ category: "offers" }) },
  { label: "Minha conta", to: "/account" },
  { label: "Carrinho", to: "/cart" },
];

// Site footer (contentinfo landmark): brand block, links and copyright
export default function Footer() {
  return (
    <footer className="footer-div">
      {/* Logo (variant for dark backgrounds), slogan and security badge */}
      <div className="logo-slogan-div">
        <Logo theme="dark" className="footer-logo" />
        <p className="slogan">Tecnologia certa, montagem segura e suporte de verdade.</p>
        <p className="safe-purchase-div">
          <Check className="check-icon" aria-hidden="true" />
          Compra 100% segura
        </p>
      </div>

      <nav aria-label="Rodapé">
        <ul>
          {LINKS.map((link) => (
            <li key={link.label}>
              <Link to={link.to}>{link.label}</Link>
            </li>
          ))}
        </ul>
        <p className="footer-payment">Pix • Cartão em até 12x</p>
      </nav>

      <p className="footer-copyright">© 2026 HardwareHub</p>
    </footer>
  );
}
