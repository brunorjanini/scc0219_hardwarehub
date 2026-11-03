// Global test setup: jest-dom matchers (toBeInTheDocument, ...) and
// unmounting rendered components after each test.
import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

// findBy*/waitFor wait up to 3 s (default 1 s). Pages load data through
// several mocked requests, and on a busy machine 1 s was sometimes short.
configure({ asyncUtilTimeout: 3000 });

// Same language as index.html (the test document starts without one)
if (globalThis.document) document.documentElement.lang = "pt-BR";

// Tests never reach a real server: any request that a test did not mock
// fails right away like an unreachable server (pages show their error state).
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new TypeError("fetch is not mocked in this test"))),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  // Not defined in files that opt into the node environment
  globalThis.localStorage?.clear();
});
