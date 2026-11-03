import { Link } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { rangeText } from "../../utils/adminProductQuery";

// "Exibindo 1–10 de 31" + previous/next links of the admin lists.
// `pathFor(page)` returns the link of a page (filters kept in the URL).
export default function AdminPagination({ page, pages, items, pathFor }) {
  return (
    <nav className="admin-pagination" aria-label="Paginação">
      <p>{rangeText(page, items)}</p>
      {pages > 1 && (
        <div className="admin-pagination-links">
          {page > 1 ? (
            <Link to={pathFor(page - 1)} className="link-button secondary">
              <ChevronLeft aria-hidden="true" />
              Anterior
            </Link>
          ) : (
            <span className="link-button secondary is-disabled" aria-disabled="true">
              <ChevronLeft aria-hidden="true" />
              Anterior
            </span>
          )}
          <p aria-current="page">
            Página {page} de {pages}
          </p>
          {page < pages ? (
            <Link to={pathFor(page + 1)} className="link-button secondary">
              Próxima
              <ChevronRight aria-hidden="true" />
            </Link>
          ) : (
            <span className="link-button secondary is-disabled" aria-disabled="true">
              Próxima
              <ChevronRight aria-hidden="true" />
            </span>
          )}
        </div>
      )}
    </nav>
  );
}
