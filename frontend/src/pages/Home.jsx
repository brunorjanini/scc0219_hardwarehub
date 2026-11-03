import "./Home.css";
import { NavLink } from "react-router";
import { useAuth } from "../contexts/useAuth";

// Temporary home page. Task 3 of docs/plano-milestone2.md replaces it with
// the storefront (banner, benefits and best sellers from the API).
export default function Home() {
  const { user } = useAuth();

  return (
    <section className="home-placeholder" aria-labelledby="home-title">
      <h1 id="home-title">
        {user ? `Olá, ${user.name || "cliente"}!` : "Bem-vindo à HardwareHub"}
      </h1>
      <p className="home-placeholder-text">
        Hardware de última geração, serviços especializados e o Montador de PC.
      </p>

      {user ? (
        user.type === "admin" && (
          <NavLink to="/admin" className="home-placeholder-link">
            Ir para o painel administrativo
          </NavLink>
        )
      ) : (
        <div className="home-placeholder-actions">
          <NavLink to="/login" className="home-placeholder-link">
            Entrar
          </NavLink>
          <NavLink to="/signup" className="home-placeholder-link secondary">
            Criar conta
          </NavLink>
        </div>
      )}
    </section>
  );
}
