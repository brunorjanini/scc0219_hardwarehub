import { useEffect } from "react";
import { useMatches } from "react-router";

const SITE = "HardwareHub";

// Sets the browser tab title from the deepest route with `handle.title`
// (see routes.jsx): "Carrinho | HardwareHub". A new title on each page
// also tells screen reader users that the page changed.
export default function DocumentTitle() {
  const matches = useMatches();
  const title = [...matches].reverse().find((match) => match.handle?.title)?.handle.title;

  useEffect(() => {
    document.title = title ? `${title} | ${SITE}` : SITE;
  }, [title]);

  return null;
}
