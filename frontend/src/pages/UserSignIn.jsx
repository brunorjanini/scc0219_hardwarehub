import "./UserSignIn.css";
import { Mail, Lock } from "lucide-react";
import ImageBoxSignIn from "../components/user/ImageBoxSignIn";
import SignInInput from "../components/SignInInput";
import StdButton from "../components/StdButton";
import { NavLink } from "react-router";
import { useState } from "react";
import { AnimatePresence } from "motion/react";
import SuperiorModal from "../components/SuperiorModal";
import verifyEmail from "../utils/verifyEmail";
import { findUsersByEmail } from "../api/users";

// Sign-up page: image on one side, form on the other
export default function UserSignIn() {
  // Modal text; an empty string means the modal is hidden
  const [message, setMessage] = useState("");
  // Modal variant (e.g. "error")
  const [messageType, setMessageType] = useState("");

  // Validates the form and checks whether the email is already registered
  async function handleSignIn(e) {
    e.preventDefault();

    const formData = new FormData(e.target);

    // Extract the form values by input name
    const name = formData.get("name");
    const lastName = formData.get("last-name");
    const email = formData.get("e-mail");
    const password = formData.get("password");

    // Required fields
    if (!name || !lastName || !email || !password) {
      setMessage("Preencha todos os campos");
      setMessageType("error");
      return;
    }

    // Email format
    if (!verifyEmail(email)) {
      setMessage("E-mail inválido");
      setMessageType("error");
      return;
    }

    try {
      // Look up users with the same email
      const user = await findUsersByEmail(email);

      // Email already registered
      if (user.length !== 0) {
        setMessage("Esse e-mail já está cadastrado no sistema");
        setMessageType("error");
        return;
      }

      // Email is available
      setMessage("Cadastro realizado com sucesso");
      setMessageType("sucess");
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
          <h3>Crie sua conta</h3>
          <h4>Acompanhe pedidos, salve favoritos e receba ofertas.</h4>

          {/* Uncontrolled form: values are read with FormData, so each input needs a matching `name` */}
          <form className="sign-in-form" onSubmit={handleSignIn}>
            {/* First and last name side by side */}
            <div className="name-undername-div">
              <SignInInput
                type="text"
                label="Nome"
                inputName="name"
                placeholder="Ana"
              />
              <SignInInput
                type="text"
                label="Sobrenome"
                inputName="last-name"
                placeholder="Souza"
              />
            </div>

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

            {/* Terms of Use and Privacy Policy acceptance */}
            <div className="check-terms-div">
              <input type="checkbox"></input>
              <p>
                Li e estou de acordo com os Termos de Uso e Política de
                Privacidade
              </p>
            </div>

            {/* Submit button + link to login */}
            <div className="create-account-or-login-div">
              <StdButton label="Criar conta" />
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
