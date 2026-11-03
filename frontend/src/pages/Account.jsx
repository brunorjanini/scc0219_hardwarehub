import "./Account.css";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { KeyRound, Package, UserRound } from "lucide-react";
import FormField from "../components/FormField";
import { useAuth } from "../contexts/useAuth";
import { findUsersByEmail, getUser, updateUser } from "../api/users";
import { listOrdersByUser } from "../api/orders";
import { sameId } from "../api/http";
import { readProfileForm, toProfileChanges, validateProfile } from "../utils/clientForm";
import { validatePasswordChange } from "../utils/validators";
import { formatDateTime, formatPrice } from "../utils/format";
import { catalogPath } from "../utils/catalogQuery";

// Feedback line under a form: errors are alerts, successes are status
function FormMessage({ message }) {
  if (!message.text) return null;
  return (
    <p
      className={`account-message ${message.tone}`}
      role={message.tone === "error" ? "alert" : "status"}
    >
      {message.text}
    </p>
  );
}

// Loads `load()` once per `key`: { data, loading, error, setData }
function useLoad(load, key) {
  const [state, setState] = useState({ key: null, data: null, error: "" });

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (!cancelled) setState({ key, data, error: "" });
      })
      .catch((error) => {
        if (!cancelled) setState({ key, data: null, error: error.message });
      });
    return () => {
      cancelled = true;
    };
    // `load` is recreated on each render; `key` says when to reload
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    data: state.data,
    error: state.error,
    loading: state.key !== key,
    setData: (data) => setState({ key, data, error: "" }),
  };
}

// Personal data and address. Saving also updates the name in the header.
function ProfileForm({ profile, onSaved }) {
  const { user, login } = useAuth();
  const [message, setMessage] = useState({ text: "", tone: "" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;

    const values = readProfileForm(new FormData(e.target));
    const error = validateProfile(values);
    if (error) {
      setMessage({ text: error, tone: "error" });
      return;
    }

    setSaving(true);
    try {
      // Another account may already use the new email
      if (values.email !== profile.email) {
        const owners = await findUsersByEmail(values.email);
        if (owners.some((owner) => !sameId(owner.id, user.id))) {
          setMessage({ text: "Esse e-mail já está cadastrado em outra conta", tone: "error" });
          return;
        }
      }

      const updated = await updateUser(user.id, toProfileChanges(values));
      onSaved(updated);
      login({ id: user.id, type: user.type, name: updated.name });
      setMessage({ text: "Dados atualizados com sucesso", tone: "success" });
    } catch (requestError) {
      setMessage({ text: requestError.message, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  const address = profile.address ?? {};

  return (
    <section className="account-box" aria-labelledby="profile-title">
      <h2 id="profile-title">
        <UserRound aria-hidden="true" />
        Meus dados
      </h2>
      <form className="account-form" onSubmit={handleSubmit} noValidate>
        <FormField id="name" label="Nome completo" defaultValue={profile.name} autoComplete="name" />
        <FormField id="email" label="E-mail" type="email" defaultValue={profile.email} autoComplete="email" />
        <FormField id="phone" label="Telefone" type="tel" defaultValue={profile.phone} autoComplete="tel" />

        <fieldset className="account-fieldset">
          <legend>Endereço</legend>
          <div className="form-row">
            <FormField id="street" label="Rua" defaultValue={address.street} autoComplete="address-line1" />
            <FormField id="number" label="Número" defaultValue={address.number} short />
          </div>
          <div className="form-row">
            <FormField id="city" label="Cidade" defaultValue={address.city} autoComplete="address-level2" />
            <FormField id="zip" label="CEP" defaultValue={address.zip} autoComplete="postal-code" inputMode="numeric" short />
          </div>
        </fieldset>

        <FormMessage message={message} />
        <button type="submit" className="link-button account-submit" disabled={saving}>
          {saving ? "Salvando..." : "Salvar dados"}
        </button>
      </form>
    </section>
  );
}

// Password change. The current password is checked against the stored
// one; json-server is a mock, the real server must do this check itself.
function PasswordForm() {
  const { user } = useAuth();
  const [message, setMessage] = useState({ text: "", tone: "" });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;

    const form = e.target;
    const data = new FormData(form);
    const values = {
      current: (data.get("currentPassword") ?? "").toString(),
      next: (data.get("newPassword") ?? "").toString(),
      confirm: (data.get("confirmPassword") ?? "").toString(),
    };

    const error = validatePasswordChange(values);
    if (error) {
      setMessage({ text: error, tone: "error" });
      return;
    }

    setSaving(true);
    try {
      const stored = await getUser(user.id);
      if (stored.password !== values.current) {
        setMessage({ text: "Senha atual incorreta", tone: "error" });
        return;
      }
      await updateUser(user.id, { password: values.next });
      form.reset();
      setMessage({ text: "Senha alterada com sucesso", tone: "success" });
    } catch (requestError) {
      setMessage({ text: requestError.message, tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="account-box" aria-labelledby="password-title">
      <h2 id="password-title">
        <KeyRound aria-hidden="true" />
        Alterar senha
      </h2>
      <form className="account-form" onSubmit={handleSubmit} noValidate>
        <FormField id="currentPassword" label="Senha atual" type="password" autoComplete="current-password" />
        <FormField id="newPassword" label="Nova senha" type="password" autoComplete="new-password" />
        <p className="account-hint">Mínimo de 8 caracteres, com número e símbolo.</p>
        <FormField id="confirmPassword" label="Confirmar nova senha" type="password" autoComplete="new-password" />

        <FormMessage message={message} />
        <button type="submit" className="link-button account-submit" disabled={saving}>
          {saving ? "Salvando..." : "Alterar senha"}
        </button>
      </form>
    </section>
  );
}

// Orders of the logged-in client, newest first
function OrderHistory() {
  const { user } = useAuth();
  const location = useLocation();
  const orders = useLoad(() => listOrdersByUser(user.id), user.id);

  // "Ver meus pedidos" links to /account#pedidos: scroll there once loaded
  useEffect(() => {
    if (!orders.loading && location.hash === "#pedidos") {
      document.getElementById("pedidos")?.scrollIntoView?.({ block: "start" });
    }
  }, [orders.loading, location.hash]);

  let content;
  if (orders.loading) {
    content = <p className="page-message" role="status">Carregando pedidos...</p>;
  } else if (orders.error) {
    content = <p className="page-message error" role="alert">{orders.error}</p>;
  } else if (orders.data.length === 0) {
    content = (
      <div className="page-message account-empty">
        <p>Você ainda não fez nenhum pedido.</p>
        <Link to={catalogPath({})} className="link-button">
          Ver catálogo
        </Link>
      </div>
    );
  } else {
    content = (
      <div className="account-table-wrapper">
        <table className="account-orders">
          <caption className="visually-hidden">Seus pedidos, do mais recente ao mais antigo</caption>
          <thead>
            <tr>
              <th scope="col">Pedido</th>
              <th scope="col">Data</th>
              <th scope="col">Itens</th>
              <th scope="col">Total</th>
              <th scope="col">Situação</th>
              <th scope="col">
                <span className="visually-hidden">Detalhes</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {orders.data.map((order) => {
              const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
              return (
                <tr key={order.id}>
                  <th scope="row">#{order.id}</th>
                  <td>{formatDateTime(order.date)}</td>
                  <td>{units === 1 ? "1 item" : `${units} itens`}</td>
                  <td>{formatPrice(order.total)}</td>
                  <td>{order.status}</td>
                  <td>
                    {/* aria-label: each row's link says which order it opens */}
                    <Link
                      to={`/order/${order.id}`}
                      className="account-order-link"
                      aria-label={`Ver detalhes do pedido #${order.id}`}
                    >
                      Ver detalhes
                    </Link>
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
    <section id="pedidos" className="account-box account-orders-box" aria-labelledby="orders-title">
      <h2 id="orders-title">
        <Package aria-hidden="true" />
        Meus pedidos
      </h2>
      {content}
    </section>
  );
}

// My Account page (mockup C10): personal data, password and orders
export default function Account() {
  const { user } = useAuth();
  const profile = useLoad(() => getUser(user.id), user.id);

  return (
    <div className="store-page account-page">
      <div>
        <h1 className="account-title">Minha conta</h1>
        <p className="account-subtitle">Edite seus dados e acompanhe seus pedidos.</p>
      </div>

      <div className="account-grid">
        {profile.loading && <p className="page-message" role="status">Carregando seus dados...</p>}
        {profile.error && <p className="page-message error" role="alert">{profile.error}</p>}
        {profile.data && <ProfileForm profile={profile.data} onSaved={profile.setData} />}
        <PasswordForm />
      </div>

      <OrderHistory />
    </div>
  );
}
