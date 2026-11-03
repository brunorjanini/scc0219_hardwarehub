import "./UserLogin.css";
import { UserRound, Lock } from "lucide-react";
import ImageBoxSignIn from "../components/user/ImageBoxSignIn";
import SignInInput from "../components/SignInInput";
import StdButton from "../components/StdButton";
import { NavLink, useLocation, useNavigate } from "react-router";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import SuperiorModal from "../components/SuperiorModal";
import { useAuth } from "../contexts/useAuth";
import { authenticate } from "../api/auth";

// Time the success message stays visible before redirecting
const LOGIN_REDIRECT_DELAY_MS = 1000;

// Where to send the user after login. Pages protected by RequireAuth pass
// the original location in `state.from`, so the user returns to it.
function redirectTarget(user, from) {
  const path = from ? `${from.pathname}${from.search ?? ""}` : "";
  const isAdminPath = path.startsWith("/admin");

  if (user.type === "admin") return isAdminPath ? path : "/admin";
  return path && !isAdminPath ? path : "/";
}

// Login page: image on one side, form on the other
export default function UserLogin() {
  // Modal text; an empty string means the modal is hidden
  const [message, setMessage] = useState("");
  // Modal variant ("error" or "success")
  const [messageType, setMessageType] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login } = useAuth();
  const timerRef = useRef(null);

  // Logged-in users (including right after a successful login) leave this page
  useEffect(() => {
    if (user) {
      navigate(redirectTarget(user, location.state?.from), { replace: true });
    }
  }, [user, navigate, location.state]);

  // Cancel a pending redirect if the page unmounts
  useEffect(() => () => clearTimeout(timerRef.current), []);

  function showMessage(text, type) {
    setMessage(text);
    setMessageType(type);
  }

  // Validates the form, looks up the user by email or username and
  // compares the password
  async function handleLogin(e) {
    e.preventDefault(); // Prevent the browser's default form submission

    const formData = new FormData(e.target);
    const identifier = formData.get("identifier");
    const password = formData.get("password");

    try {
      const { user: userData, error } = await authenticate(identifier, password);

      if (error) {
        showMessage(error, "error");
        return;
      }

      showMessage("Login realizado com sucesso", "success");

      // Save the session after the success message is shown; the effect
      // above then redirects
      timerRef.current = setTimeout(() => {
        login({ id: userData.id, type: userData.type, name: userData.name });
      }, LOGIN_REDIRECT_DELAY_MS);
    } catch (error) {
      // Show request/network errors in the modal
      showMessage(error.message, "error");
    }
  }

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
          <h3>Bem-vindo de volta</h3>
          <h4>Entre para acessar seus pedidos e configurações.</h4>

          {/* Uncontrolled form: values are read with FormData, so each input needs a matching `name` */}
          <form className="sign-in-form" onSubmit={handleLogin} noValidate>
            {/* Email or username (the default admin logs in as "admin") */}
            <SignInInput
              type="text"
              label="E-mail ou usuário"
              inputName="identifier"
              placeholder="meunome@email.com"
              autoComplete="username"
            >
              <UserRound />
            </SignInInput>

            <SignInInput
              type="password"
              label="Senha"
              inputName="password"
              placeholder="minhasenha"
              autoComplete="current-password"
            >
              <Lock />
            </SignInInput>

            {/* Submit button + link to sign-up */}
            <div className="create-account-or-login-div">
              <StdButton label="Entrar" />
              <p>
                Não tem uma conta?{" "}
                <NavLink to="/signup" className="sign-in-link">
                  Cadastrar
                </NavLink>
              </p>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
