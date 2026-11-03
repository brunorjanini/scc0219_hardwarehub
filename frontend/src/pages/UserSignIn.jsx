import "./UserSignIn.css";
import { Mail, Lock, Phone } from "lucide-react";
import ImageBoxSignIn from "../components/user/ImageBoxSignIn";
import SignInInput from "../components/SignInInput";
import StdButton from "../components/StdButton";
import { Navigate, NavLink, useNavigate } from "react-router";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import SuperiorModal from "../components/SuperiorModal";
import { createUser, findUsersByEmail } from "../api/users";
import { readClientForm, toClientRecord, validateClient } from "../utils/clientForm";
import { useAuth } from "../contexts/useAuth";

// Time the success message stays visible before going to the login page
const SIGNUP_REDIRECT_DELAY_MS = 1500;

// Sign-up page: image on one side, form on the other
export default function UserSignIn() {
  // Modal text; an empty string means the modal is hidden
  const [message, setMessage] = useState("");
  // Modal variant ("error" or "success")
  const [messageType, setMessageType] = useState("");
  // Prevents double submits while the request is running
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const timerRef = useRef(null);

  // Cancel a pending redirect if the page unmounts
  useEffect(() => () => clearTimeout(timerRef.current), []);

  function showMessage(text, type) {
    setMessage(text);
    setMessageType(type);
  }

  // Validates the form, checks the email is free and creates the client
  async function handleSignIn(e) {
    e.preventDefault();
    if (submitting) return;

    const formData = new FormData(e.target);
    const values = readClientForm(formData);

    const error = validateClient(values);
    if (error) {
      showMessage(error, "error");
      return;
    }

    if (!formData.get("terms")) {
      showMessage("Aceite os Termos de Uso para continuar", "error");
      return;
    }

    setSubmitting(true);
    try {
      // Email already registered?
      const existing = await findUsersByEmail(values.email);
      if (existing.length !== 0) {
        showMessage("Esse e-mail já está cadastrado no sistema", "error");
        return;
      }

      await createUser(toClientRecord(values));

      showMessage("Cadastro realizado com sucesso! Faça login para continuar.", "success");
      timerRef.current = setTimeout(
        () => navigate("/login"),
        SIGNUP_REDIRECT_DELAY_MS,
      );
    } catch (requestError) {
      // Show request/network errors in the modal
      showMessage(requestError.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  // Logged-in users do not need to sign up
  if (user) return <Navigate to="/" replace />;

  return (
    <>
      {/* Modal is mounted only when there is a message; AnimatePresence handles the exit animation */}
      <div aria-live="polite">
        <AnimatePresence>
          {message && (
            <SuperiorModal type={messageType} onClose={() => setMessage("")}>
              {message}
            </SuperiorModal>
          )}
        </AnimatePresence>
      </div>

      <div className="sign-in-div">
        <ImageBoxSignIn />

        <div className="sign-in-form-div">
          <h2>HARDWAREHUB</h2>
          <h3>Crie sua conta</h3>
          <h4>Acompanhe pedidos, salve favoritos e receba ofertas.</h4>

          {/* Uncontrolled form: values are read with FormData, so each input needs a matching `name` */}
          <form className="sign-in-form" onSubmit={handleSignIn} noValidate>
            {/* First and last name side by side */}
            <div className="name-undername-div">
              <SignInInput type="text" label="Nome" inputName="name" placeholder="Ana" autoComplete="given-name" />
              <SignInInput type="text" label="Sobrenome" inputName="last-name" placeholder="Souza" autoComplete="family-name" />
            </div>

            <SignInInput
              type="text"
              label="E-mail"
              inputName="e-mail"
              placeholder="meunome@email.com"
              autoComplete="email"
              inputMode="email"
            >
              <Mail />
            </SignInInput>

            <SignInInput
              type="tel"
              label="Telefone"
              inputName="phone"
              placeholder="(16) 99999-9999"
              autoComplete="tel"
            >
              <Phone />
            </SignInInput>

            {/* Address: required for client records and used at checkout */}
            <div className="name-undername-div">
              <SignInInput type="text" label="Rua" inputName="street" placeholder="Av. São Carlos" autoComplete="address-line1" />
              <div className="short-field">
                <SignInInput type="text" label="Número" inputName="number" placeholder="400" />
              </div>
            </div>

            <div className="name-undername-div">
              <SignInInput type="text" label="Cidade" inputName="city" placeholder="São Carlos" autoComplete="address-level2" />
              <div className="short-field">
                <SignInInput type="text" label="CEP" inputName="zip" placeholder="13560-000" autoComplete="postal-code" inputMode="numeric" />
              </div>
            </div>

            {/* Password input + requirements hint */}
            <div className="password-criteria-div">
              <SignInInput
                type="password"
                label="Senha"
                inputName="password"
                placeholder="minhasenha"
                autoComplete="new-password"
              >
                <Lock />
              </SignInInput>
              <p>Mínimo de 8 caracteres, com número e símbolos</p>
            </div>

            {/* Terms of Use and Privacy Policy acceptance */}
            <div className="check-terms-div">
              <input type="checkbox" id="terms" name="terms" />
              <label htmlFor="terms">
                Li e estou de acordo com os Termos de Uso e Política de
                Privacidade
              </label>
            </div>

            {/* Submit button + link to login */}
            <div className="create-account-or-login-div">
              <StdButton label={submitting ? "Criando conta..." : "Criar conta"} />
              <p>
                Já tem uma conta?{" "}
                <NavLink to="/login" className="login-link">
                  Entrar
                </NavLink>
              </p>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
