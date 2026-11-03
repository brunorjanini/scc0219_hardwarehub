// Pages loaded on demand (code splitting). Admin pages, login/sign-up and
// the builder only download their code when first opened, which keeps the
// main bundle small for shoppers.
//
//   const AdminProducts = lazyPage(() => import("../pages/AdminProducts.jsx"));
//
// While the code downloads, a "Carregando..." message is shown. Once a page
// is loaded, it renders directly (no flash of the message on later visits).
// preloadLazyPages() loads every page at once: page tests call it, so the
// pages render synchronously like before.
import { Suspense, createElement, lazy, useState } from "react";

const registry = [];

export function lazyPage(load) {
  let Loaded = null;
  const preload = () =>
    load().then((module) => {
      Loaded = module.default;
      return module;
    });
  const Lazy = lazy(preload);

  function LazyPage(props) {
    // Fixed at mount: switching component types later would reset the page
    const [Component] = useState(() => Loaded);
    if (Component) return createElement(Component, props);
    return createElement(
      Suspense,
      { fallback: createElement("p", { className: "page-message", role: "status" }, "Carregando...") },
      createElement(Lazy, props),
    );
  }

  LazyPage.preload = preload;
  registry.push(LazyPage);
  return LazyPage;
}

export function preloadLazyPages() {
  return Promise.all(registry.map((page) => page.preload()));
}
