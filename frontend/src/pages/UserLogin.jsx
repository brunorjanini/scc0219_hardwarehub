import "./UserLogin.css";
import { Mail, Lock } from "lucide-react";
import ImageBoxSignIn from "../components/user/ImageBoxSignIn";
import SignInInput from "../components/SignInInput";
import StdButton from "../components/StdButton";
import { NavLink, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";
import SuperiorModal from "../components/SuperiorModal";
import verifyEmail from "../utils/verifyEmail";
import { useAuth } from "../contexts/AuthContext";
import { findUsersByEmail } from "../api/users";

// Login page: image on one side, form on the other
export default function UserLogin() {
  // Modal text; an empty string means the modal is hidden
  const [message, setMessage] = useState("");
  // Modal variant ("error" or "success")
  const [messageType, setMessageType] = useState("");
  const navigate = useNavigate();

  const { user, login } = useAuth();

  useEffect(() => {
    if (user) {
      if (user.type === "admin") {
        navigate("/admin");
      } else {
        navigate("/");
      }
    }
  }, [user, navigate]);

  // Validates the form, looks up the user by email and compares the password
  async function handleLogin(e) {
    e.preventDefault(); // Prevent the browser's default form submission

    const formData = new FormData(e.target);

    // Extract the form values by input name
    const email = formData.get("e-mail");
    const password = formData.get("password");

    // Required fields
    if (!email || !password) {
      setMessage("Preencha todos os campos");
      setMessageType("error");
    }

    // Email format
    if (!verifyEmail(email)) {
      setMessage("E-mail incorreto");
      setMessageType("error");
      return;
    }

    try {
      // Look up users with the same email
      const users = await findUsersByEmail(email);

      // No user with this email
      if (users.length === 0) {
        setMessage("Usuário não encontrado");
        setMessageType("error");
        return;
      }

      const userData = users[0];

      // Compare the stored password with the typed one
      if (userData.password !== password) {
        setMessage("Senha incorreta");
        setMessageType("error");
        return;
      }

      setMessage("Login realizado com sucesso");
      setMessageType("success");

      // Redirect to home after the success modal is shown
      setTimeout(() => {
        login({ id: userData.id, type: userData.type });
      }, 1000);
    } catch (error) {
      // Show request/network errors in the modal
      setMessage(error.message);
      setMessageType("error");
    }
  }

  return (
    <>
      {/* Modal is mounted only when there is a message; AnimatePresence handles the exit animation */}
      <AnimatePresence>
        {message && (
          <SuperiorModal type={messageType} onClose={() => setMessage("")}>
            {message}
          </SuperiorModal>
        )}
      </AnimatePresence>

      <div className="sign-in-div">
        <ImageBoxSignIn />

        <div className="sign-in-form-div">
          <h2>HARDWAREHUB</h2>
          <h3>Bem-vindo de volta</h3>
          <h4>Entre para acessar seus pedidos e configurações.</h4>

          {/* Uncontrolled form: values are read with FormData, so each input needs a matching `name` */}
          <form className="sign-in-form" onSubmit={handleLogin}>
            {/* Email input; the icon is passed as children */}
            <SignInInput
              type="text"
              label="E-mail"
              inputName="e-mail"
              placeholder="meunome@email.com"
            >
              <Mail />
            </SignInInput>

            {/* Password input + requirements hint */}
            <div className="password-criteria-div">
              <SignInInput
                type="password"
                label="Senha"
                inputName="password"
                placeholder="minhasenha"
              >
                <Lock />
              </SignInInput>
              <p>Mínimo de 8 caracteres, com número e símbolos</p>
            </div>

            {/* Submit button + link to sign-up */}
            <div className="create-account-or-login-div">
              <StdButton label="Entrar" />
              <p>
                Não tem uma conta?{" "}
                <NavLink to="/" className="sign-in-link">
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
