// Accessibility check for page tests, using axe-core (the engine behind
// the browser "axe DevTools" extension).
//
//   expect(await axeViolations()).toEqual([]);
//
// Returns one readable line per violation ("rule: help -> CSS selectors"),
// so a failing test says what to fix.
//
// Rules that need a real browser are turned off: jsdom has no layout or
// computed colours, so colour contrast is checked by hand (see the notes
// in docs) instead of here.
import axe from "axe-core";

const JSDOM_UNSUPPORTED = {
  "color-contrast": { enabled: false },
  "color-contrast-enhanced": { enabled: false },
  "link-in-text-block": { enabled: false },
  "target-size": { enabled: false },
};

export async function axeViolations(context = document) {
  const results = await axe.run(context, {
    rules: JSDOM_UNSUPPORTED,
    resultTypes: ["violations"],
  });
  return results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} -> ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`,
  );
}
