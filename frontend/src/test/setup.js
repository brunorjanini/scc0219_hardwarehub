// Global test setup: jest-dom matchers (toBeInTheDocument, ...) and
// unmounting rendered components after each test.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

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
