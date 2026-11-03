import "./Home.css";
import { Link } from "react-router";
import { ArrowRight, CreditCard, Headset, ShieldCheck, Truck } from "lucide-react";
import ProductGrid from "../components/store/ProductGrid";
import { useProductList } from "../hooks/useProductList";
import { catalogPath } from "../utils/catalogQuery";

// Store benefits shown below the banner (static content)
const BENEFITS = [
  { Icon: Truck, title: "Frete grátis", text: "Em compras acima de R$ 499" },
  { Icon: CreditCard, title: "Até 12x sem juros", text: "Nos principais cartões" },
  { Icon: ShieldCheck, title: "Garantia e segurança", text: "Compra 100% protegida" },
  { Icon: Headset, title: "Suporte especialista", text: "Antes e depois da compra" },
];

// Filters for the two product lists (see api/products.js)
// Best sellers skip sold-out items, so the home page only shows what can be bought
const BEST_SELLERS = { type: "product", inStock: true, sort: "-sold", page: 1, perPage: 4 };
const SERVICES = { type: "service", sort: "-sold" };

// Storefront home page (mockup C01): banner, benefits, best sellers and services
export default function Home() {
  const bestSellers = useProductList(BEST_SELLERS);
  const services = useProductList(SERVICES);

  return (
    <div className="store-page home-page">
      {/* Banner with the main calls to action */}
      <section className="home-banner" aria-labelledby="home-title">
        <p className="home-banner-badge">SEMANA GAMER ATÉ 20% OFF</p>
        <h1 id="home-title">
          Performance sem <br />
          limites.
        </h1>
        <p className="home-banner-text">
          Eleve seu setup com hardware de última geração, preços especiais e
          montagem feita por especialistas.
        </p>
        <div className="home-banner-actions">
          <Link to={catalogPath({ category: "offers" })} className="link-button">
            <ArrowRight aria-hidden="true" />
            Comprar ofertas
          </Link>
          <Link to="/monte-seu-pc" className="link-button secondary">
            Monte seu PC
          </Link>
        </div>
      </section>

      {/* Store benefits */}
      <section aria-label="Vantagens da loja">
        <ul className="home-benefits">
          {BENEFITS.map(({ Icon, title, text }) => (
            <li key={title} className="home-benefit">
              <span className="home-benefit-icon" aria-hidden="true">
                <Icon />
              </span>
              <span>
                <span className="home-benefit-title">{title}</span>
                <span className="home-benefit-text">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Best sellers, loaded from the API */}
      <section className="home-section" aria-labelledby="best-sellers-title">
        <div className="home-section-header">
          <div>
            <p className="home-section-eyebrow">ESCOLHAS DA COMUNIDADE</p>
            <h2 id="best-sellers-title">Mais vendidos</h2>
            <p className="home-section-text">
              Os componentes preferidos para upgrades e novos setups.
            </p>
          </div>
          <Link to={catalogPath({})} className="home-section-link">
            Ver catálogo
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        <ProductGrid list={bestSellers} />
      </section>

      {/* Services sold by the store */}
      <section className="home-section" aria-labelledby="services-title">
        <div className="home-section-header">
          <div>
            <p className="home-section-eyebrow">FEITO POR ESPECIALISTAS</p>
            <h2 id="services-title">Serviços</h2>
            <p className="home-section-text">
              Montagem, instalação e manutenção agendadas com a nossa equipe.
            </p>
          </div>
          <Link to={catalogPath({ category: "service" })} className="home-section-link">
            Ver serviços
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        <ProductGrid list={services} emptyMessage="Nenhum serviço disponível." />
      </section>
    </div>
  );
}
