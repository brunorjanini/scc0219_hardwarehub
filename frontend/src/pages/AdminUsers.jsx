import "../components/admin/AdminPage.css";
import { useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { Lock, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import TopBar from "../components/admin/TopBar";
import AdminNotice from "../components/admin/AdminNotice";
import AdminPagination from "../components/admin/AdminPagination";
import ConfirmDialog from "../components/ConfirmDialog";
import { usePagedList } from "../hooks/usePagedList";
import { useNavigationNotice } from "../hooks/useNavigationNotice";
import { useConfirmDelete } from "../hooks/useConfirmDelete";
import { useAuth } from "../contexts/useAuth";
import { deleteUser, listUsers } from "../api/users";
import { sameId } from "../api/http";
import { deleteBlockReason, isDefaultAdmin } from "../utils/userForm";
import { parseAdminUserParams, toAdminUserFilters, toAdminUserSearch } from "../utils/adminUserQuery";
import { USER_KINDS } from "../utils/userKinds";

// Admin list of clients (type "user") or administrators (type "admin"):
// search and page in the URL, links to the create/edit form and deletion
// with confirmation. The default "admin" account and the logged-in admin
// cannot be deleted.
export default function AdminUsers({ type }) {
  const kind = USER_KINDS[type];
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const filters = useMemo(() => parseAdminUserParams(searchParams), [searchParams]);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((n) => n + 1);
  const list = usePagedList(listUsers, toAdminUserFilters(type, filters), reloadKey);
  const [notice, setNotice] = useNavigationNotice();

  const titleRef = useRef(null);
  const deletion = useConfirmDelete({
    focusRef: titleRef,
    remove: (person) => {
      // The buttons are hidden for protected accounts; this is the last guard
      const reason = deleteBlockReason(person, currentUser);
      if (reason) throw new Error(reason);
      return deleteUser(person.id);
    },
    onDeleted: (person) => {
      setNotice({ text: `“${person.name}” foi excluído.`, tone: "success" });
      if (list.data.length === 1 && filters.page > 1) {
        setSearchParams(toAdminUserSearch({ ...filters, page: filters.page - 1 }));
      }
      reload();
    },
  });

  function handleSearch(e) {
    e.preventDefault();
    const q = (new FormData(e.currentTarget).get("q") ?? "").toString().trim();
    setSearchParams(toAdminUserSearch({ q, page: 1 }));
  }

  const pagePath = (page) => `${kind.path}${toAdminUserSearch({ ...filters, page })}`;
  const backState = { back: location.search };
  const showTable = list.data.length > 0 && !list.error;

  let content;
  if (list.error) {
    content = (
      <div className="page-message error admin-message" role="alert">
        <p>{list.error}</p>
        <button type="button" className="link-button secondary" onClick={reload}>
          Tentar novamente
        </button>
      </div>
    );
  } else if (list.loading && !showTable) {
    content = (
      <p className="page-message" role="status">
        Carregando...
      </p>
    );
  } else if (!showTable) {
    content = (
      <div className="page-message admin-message">
        <p>{filters.q ? `Nenhum resultado para “${filters.q}”.` : kind.empty}</p>
      </div>
    );
  } else {
    content = (
      <div className="admin-table-wrapper">
        <table className="admin-table admin-users-table" aria-busy={list.loading}>
          <caption className="visually-hidden">{kind.caption}</caption>
          <thead>
            <tr>
              <th scope="col">{kind.nameColumn}</th>
              {type === "admin" && <th scope="col">Usuário</th>}
              <th scope="col">E-mail</th>
              <th scope="col">Telefone</th>
              {type === "user" && <th scope="col">Endereço</th>}
              <th scope="col">
                <span className="visually-hidden">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.data.map((person) => {
              const blocked = deleteBlockReason(person, currentUser);
              const address = person.address;
              return (
                <tr key={person.id}>
                  <th scope="row">
                    <span className="admin-product-name">{person.name}</span>
                    <span className="admin-product-meta">
                      ID {person.id}
                      {sameId(person.id, currentUser?.id) && <span className="admin-tag">Você</span>}
                      {isDefaultAdmin(person) && <span className="admin-tag">Conta padrão</span>}
                    </span>
                  </th>
                  {type === "admin" && <td>{person.username}</td>}
                  <td>{person.email}</td>
                  <td>{person.phone}</td>
                  {type === "user" && (
                    <td>
                      {address ? (
                        <>
                          {address.street}, {address.number}
                          <span className="admin-product-meta">
                            {address.city} · CEP {address.zip}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  <td>
                    <div className="admin-row-actions">
                      <Link
                        to={`${kind.path}/${person.id}`}
                        state={backState}
                        className="admin-icon-button"
                        aria-label={`Editar ${person.name}`}
                      >
                        <Pencil aria-hidden="true" />
                      </Link>
                      {blocked ? (
                        // Protected account: a lock instead of the delete button
                        <span className="admin-icon-button admin-locked" title={blocked}>
                          <Lock aria-hidden="true" />
                          <span className="visually-hidden">{blocked}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="admin-icon-button danger"
                          aria-label={`Excluir ${person.name}`}
                          onClick={() => deletion.open(person)}
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <TopBar title={kind.title} />

      <div className="admin-content">
        <div className="admin-title-row">
          <div>
            <h1 ref={titleRef} tabIndex={-1} className="admin-title">
              {kind.title}
            </h1>
            <p className="admin-subtitle">{kind.subtitle}</p>
          </div>
          <Link to={`${kind.path}/new`} state={backState} className="link-button">
            <Plus aria-hidden="true" />
            {kind.newLabel}
          </Link>
        </div>

        <AdminNotice notice={notice} onClose={() => setNotice({ text: "", tone: "success" })} />

        {/* `key` resets the field when the URL changes (back button, "Limpar") */}
        <form
          key={filters.q}
          className="admin-filters"
          role="search"
          aria-label={`Buscar ${kind.title.toLowerCase()}`}
          onSubmit={handleSearch}
        >
          <div className="admin-field admin-field-grow">
            <label htmlFor="admin-q">Buscar</label>
            <div className="admin-search">
              <input id="admin-q" name="q" type="search" defaultValue={filters.q} placeholder={kind.searchPlaceholder} />
              <button type="submit" className="admin-icon-button" aria-label="Aplicar busca">
                <Search aria-hidden="true" />
              </button>
            </div>
          </div>
        </form>

        <div className="admin-summary">
          <p className="admin-chip info" role="status">
            {list.loading ? "Carregando..." : `${list.items} ${list.items === 1 ? kind.singular : kind.plural}`}
          </p>
          {filters.q && (
            <Link to={kind.path} className="admin-chip">
              <X aria-hidden="true" />
              Limpar busca
            </Link>
          )}
        </div>

        {content}

        {showTable && <AdminPagination page={filters.page} pages={list.pages} items={list.items} pathFor={pagePath} />}
      </div>

      {deletion.target && (
        <ConfirmDialog
          title={`Excluir “${deletion.target.name}”?`}
          busy={deletion.busy}
          error={deletion.error}
          onConfirm={deletion.confirm}
          onCancel={deletion.cancel}
        >
          <p>{kind.deleteText}</p>
          <p>Essa ação não pode ser desfeita.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
