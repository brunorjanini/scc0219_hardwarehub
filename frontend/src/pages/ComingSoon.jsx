import { Link } from "react-router";
import { catalogPath } from "../utils/catalogQuery";

// Temporary page for links whose screen is not built yet
// (cart: Task 4, PC builder: Task 8 of docs/plano-milestone2.md)
export default function ComingSoon({ title, text }) {
  return (
    <div className="store-page">
      <h1 className="coming-soon-title">{title}</h1>
      <p className="page-message">{text}</p>
      <Link to={catalogPath({})} className="link-button" style={{ alignSelf: "flex-start" }}>
        Ver catálogo
      </Link>
    </div>
  );
}
