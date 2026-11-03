import UserHeader from "../components/user/UserHeader";
import Footer from "../components/user/Footer";
import DocumentTitle from "../components/DocumentTitle";
import SkipLink from "../components/SkipLink";
import { Outlet } from "react-router";
import "./UserLayout.css";

// Store layout: skip link, header, page content and footer
export default function UserLayout() {
  return (
    <div className="user-layout">
      <DocumentTitle />
      <SkipLink />
      <UserHeader />
      {/* tabIndex -1: target of the skip link */}
      <main id="conteudo" tabIndex={-1} className="user-layout-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
