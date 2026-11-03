import { describe, expect, it } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import AuthProvider from "./AuthContext";
import { useAuth } from "./useAuth";
import { SESSION_KEY } from "./auth";

const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

describe("AuthProvider", () => {
  it("starts logged out with empty storage", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
  });

  it("saves the session on login without the password", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => result.current.login({ id: 3, type: "admin", name: "Administrador", password: "admin" }));

    const expected = { id: "3", type: "admin", name: "Administrador" };
    expect(result.current.user).toEqual(expected);
    expect(JSON.parse(localStorage.getItem(SESSION_KEY))).toEqual(expected);
  });

  it("restores the session after a reload (new provider)", () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: "1", type: "user", name: "Ana" }));

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toEqual({ id: "1", type: "user", name: "Ana" });
  });

  it("clears the session on logout", () => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id: "1", type: "user", name: "Ana" }));
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => result.current.logout());

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("ignores corrupted or incomplete saved data", () => {
    localStorage.setItem(SESSION_KEY, "{not json");
    expect(renderHook(() => useAuth(), { wrapper }).result.current.user).toBeNull();

    localStorage.setItem(SESSION_KEY, JSON.stringify({ name: "sem id" }));
    expect(renderHook(() => useAuth(), { wrapper }).result.current.user).toBeNull();
  });
});

describe("useAuth", () => {
  it("throws a clear error outside the provider", () => {
    function Orphan() {
      useAuth();
      return null;
    }
    // React logs the error; silence it for this test
    const original = console.error;
    console.error = () => {};
    try {
      expect(() => render(<Orphan />)).toThrow(/AuthProvider/);
    } finally {
      console.error = original;
    }
    expect(screen.queryByText(/./)).toBeNull();
  });
});
