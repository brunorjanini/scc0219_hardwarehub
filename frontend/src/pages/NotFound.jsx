import { Link, useLocation } from "react-router";
import { SearchX } from "lucide-react";
import { catalogPath } from "../utils/catalogQuery";

// 404 page for unknown addresses. `admin` shows links back into the
// admin area instead of the store.
export default function NotFound({ admin = false }) {
  const { pathname } = useLocation();

  return (
    <div className="store-page not-found">
      <SearchX className="not-found-icon" aria-hidden="true" />
      <h1 className="not-found-title">Página não encontrada</h1>
      <p className="not-found-text">
        O endereço <code>{pathname}</code> não existe. Ele pode ter sido digitado errado ou a página saiu do ar.
      </p>
      <div className="not-found-actions">
        {admin ? (
          <Link to="/admin" className="link-button">
            Voltar ao dashboard
          </Link>
        ) : (
          <>
            <Link to="/" className="link-button">
              Ir para a página inicial
            </Link>
            <Link to={catalogPath({})} className="link-button secondary">
              Ver catálogo
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
