import { createContext, useContext } from "react";

/**
 * Auth context + hook (kept in a component-free module so the react-refresh
 * ESLint rule stays happy). The provider itself lives in AuthProvider.jsx.
 *
 * Value shape: { user, status, login, logout, refresh }
 *   user   -> { id, username, role } | null
 *   status -> "loading" | "authenticated" | "anonymous"
 */
export const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
