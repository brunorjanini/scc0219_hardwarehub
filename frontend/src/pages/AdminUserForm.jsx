import "../components/admin/AdminPage.css";
import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { ChevronLeft } from "lucide-react";
import TopBar from "../components/admin/TopBar";
import Field from "../components/admin/AdminField";
import { FORM_ERROR_ID } from "../components/admin/adminFormErrors";
import { useAuth } from "../contexts/useAuth";
import { createUser, findUsersByEmail, findUsersByUsername, getUser, updateUser } from "../api/users";
import { sameId } from "../api/http";
import {
  DEFAULT_ADMIN_USERNAME,
  isDefaultAdmin,
  readUserForm,
  toUserFormValues,
  toUserRecord,
  validateUserForm,
} from "../utils/userForm";
import { USER_KINDS } from "../utils/userKinds";

// Loads the account being edited: { person, loading, error }.
// An account of the other type counts as not found (/admin/clients/3
// must not open an administrator).
function usePerson(id, type) {
  const [state, setState] = useState({ id: null, person: null, error: null });

  useEffect(() => {
    if (id === undefined) return undefined;
    let cancelled = false;
    getUser(id)
      .then((person) => {
        if (cancelled) return;
        if (person.type !== type) setState({ id, person: null, error: { status: 404 } });
        else setState({ id, person, error: null });
      })
      .catch((error) => {
        if (!cancelled) setState({ id, person: null, error });
      });
    return () => {
      cancelled = true;
    };
  }, [id, type]);

  if (id === undefined) return { person: null, loading: false, error: null };
  return { ...state, loading: state.id !== id };
}

// Email (all accounts) and username must not belong to another account.
// Returns { field, message } or null.
async function findConflict(values, type, selfId) {
  const others = (users) => users.some((u) => !sameId(u.id, selfId));

  if (others(await findUsersByEmail(values.email))) {
    return { field: "email", message: "Esse e-mail já está cadastrado em outra conta" };
  }
  if (type === "admin" && others(await findUsersByUsername(values.username))) {
    return { field: "username", message: "Esse usuário já está em uso" };
  }
  return null;
}

function PersonForm({ type, person, backPath }) {
  const kind = USER_KINDS[type];
  const isNew = !person;
  const isDefault = isDefaultAdmin(person);
  const navigate = useNavigate();
  const { user: currentUser, login } = useAuth();
  const initial = toUserFormValues(person);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  function fail(problem) {
    setError(problem);
    if (problem.field) document.getElementById(problem.field)?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;

    const values = readUserForm(new FormData(e.currentTarget));
    // The default account always keeps the "admin" username
    if (isDefault) values.username = DEFAULT_ADMIN_USERNAME;

    const problem = validateUserForm(values, { type, isNew });
    if (problem) {
      fail(problem);
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const conflict = await findConflict(values, type, person?.id);
      if (conflict) {
        fail(conflict);
        setSaving(false);
        return;
      }

      const record = toUserRecord(values, { type, isNew });
      const saved = isNew ? await createUser(record) : await updateUser(person.id, record);

      // Editing your own account: keep the name in the sidebar up to date
      if (!isNew && sameId(person.id, currentUser?.id)) {
        login({ id: currentUser.id, type: currentUser.type, name: saved.name });
      }

      const notice = isNew ? `“${saved.name}” foi cadastrado.` : `“${saved.name}” foi atualizado.`;
      navigate(backPath, { state: { notice } });
    } catch (requestError) {
      setError({ field: "", message: requestError.message });
      setSaving(false);
    }
  }

  return (
    <form
      className="admin-form"
      onSubmit={handleSubmit}
      noValidate
      autoComplete="off"
      aria-label={isNew ? kind.newLabel : kind.editLabel}
    >
      <div className="admin-form-main">
        <section className="admin-box" aria-labelledby="person-data-title">
          <h2 id="person-data-title" className="admin-box-title">
            Dados pessoais
          </h2>
          <Field id="name" label="Nome completo" error={error} defaultValue={initial.name} />
          <div className="admin-form-grid">
            <Field id="email" label="E-mail" type="email" error={error} defaultValue={initial.email} />
            <Field id="phone" label="Telefone" type="tel" error={error} defaultValue={initial.phone} />
            {type === "admin" && (
              <Field
                id="username"
                label="Usuário"
                hint={
                  isDefault
                    ? "A conta padrão sempre usa o usuário “admin”."
                    : "Usado no login, junto com o e-mail. Letras sem acento, números, “.”, “-” e “_”."
                }
                error={error}
                defaultValue={initial.username}
                readOnly={isDefault}
              />
            )}
          </div>
        </section>

        {type === "user" && (
          <fieldset className="admin-box">
            <legend>Endereço</legend>
            <div className="admin-form-grid">
              <Field id="street" label="Rua" error={error} defaultValue={initial.street} />
              <Field id="number" label="Número" error={error} defaultValue={initial.number} />
              <Field id="city" label="Cidade" error={error} defaultValue={initial.city} />
              <Field id="zip" label="CEP" error={error} inputMode="numeric" defaultValue={initial.zip} />
            </div>
          </fieldset>
        )}
      </div>

      <div className="admin-form-side">
        <section className="admin-box" aria-labelledby="person-password-title">
          <h2 id="person-password-title" className="admin-box-title">
            {isNew ? "Senha de acesso" : "Alterar senha"}
          </h2>
          <p className="admin-box-hint">
            {isNew
              ? "Mínimo de 8 caracteres, com número e símbolo."
              : "Deixe em branco para manter a senha atual. A nova senha precisa de 8 caracteres, com número e símbolo."}
          </p>
          <Field
            id="password"
            label={isNew ? "Senha" : "Nova senha"}
            type="password"
            autoComplete="new-password"
            error={error}
          />
          <Field
            id="confirmPassword"
            label={isNew ? "Confirmar senha" : "Confirmar nova senha"}
            type="password"
            autoComplete="new-password"
            error={error}
          />
        </section>

        {!isNew && (
          <section className="admin-box" aria-labelledby="person-meta-title">
            <h2 id="person-meta-title" className="admin-box-title">
              Conta
            </h2>
            <p className="admin-box-hint">ID {person.id}</p>
            {isDefault && <p className="admin-box-hint">Conta padrão do sistema: não pode ser excluída.</p>}
          </section>
        )}

        <div className="admin-box">
          {error && (
            <p id={FORM_ERROR_ID} className="admin-form-error" role="alert">
              {error.message}
            </p>
          )}
          <div className="admin-form-actions">
            <button type="submit" className="link-button" disabled={saving}>
              {saving ? "Salvando..." : isNew ? `Cadastrar ${kind.singular}` : "Salvar alterações"}
            </button>
            <Link to={backPath} className="link-button secondary">
              Cancelar
            </Link>
          </div>
        </div>
      </div>
    </form>
  );
}

// Admin page to create or edit a client (/admin/clients/new, /:id) or an
// administrator (/admin/admins/new, /:id). Saving goes back to the list.
export default function AdminUserForm({ type }) {
  const kind = USER_KINDS[type];
  const { id } = useParams();
  const location = useLocation();
  const { person, loading, error } = usePerson(id, type);
  const isNew = id === undefined;

  // The list sends its search string, so "back" keeps the search and page
  const back = location.state?.back;
  const backPath = `${kind.path}${typeof back === "string" && back.startsWith("?") ? back : ""}`;

  let content;
  if (loading) {
    content = (
      <p className="page-message" role="status">
        Carregando...
      </p>
    );
  } else if (error) {
    content = (
      <div className="page-message error admin-message" role="alert">
        <p>{error.status === 404 ? `Cadastro de ${kind.singular} não encontrado.` : error.message}</p>
        <Link to={backPath} className="link-button secondary">
          Voltar para a lista
        </Link>
      </div>
    );
  } else {
    content = <PersonForm key={id ?? "new"} type={type} person={person} backPath={backPath} />;
  }

  return (
    <div className="admin-page">
      <TopBar title={kind.title} />
      <div className="admin-content">
        <div>
          <Link to={backPath} className="admin-back-link">
            <ChevronLeft aria-hidden="true" />
            Voltar para a lista
          </Link>
          <h1 className="admin-title">{isNew ? kind.newLabel : kind.editLabel}</h1>
          {person && <p className="admin-subtitle">{person.name}</p>}
        </div>
        {content}
      </div>
    </div>
  );
}
