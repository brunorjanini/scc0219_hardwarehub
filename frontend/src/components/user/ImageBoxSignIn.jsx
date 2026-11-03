import "./ImageBoxSignIn.css";
import Logo from "../Logo";

// Decorative image box next to the login / sign-up forms (hidden on
// phones by SignInPage.css). The slogan is a paragraph, not a heading:
// the form's <h1> is the page title.
export default function ImageBoxSignIn() {
  return (
    <div className="image-box-div">
      <Logo theme="dark" className="image-box-logo" />

      <p className="image-box-slogan">
        Seu setup começa com
        <br /> escolhas confiáveis
      </p>
    </div>
  );
}
