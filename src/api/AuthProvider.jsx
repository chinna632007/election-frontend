import { useCallback, useEffect, useState } from "react";
import { AuthContext } from "./auth-context.js";
import * as api from "./client.js";

/**
 * Verifies the session cookie against GET /api/auth/me on mount and exposes
 * login / logout / refresh to the rest of the app.
 *
 * State updates happen inside promise continuations (.then/.catch), not
 * synchronously in the effect body, so they don't cause a cascading render.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | authenticated | anonymous

  const refresh = useCallback(
    () =>
      api
        .me()
        .then((data) => {
          setUser(data?.user ?? null);
          setStatus(data?.user ? "authenticated" : "anonymous");
        })
        .catch(() => {
          setUser(null);
          setStatus("anonymous");
        }),
    []
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    (creds) =>
      api.login(creds).then((data) => {
        setUser(data?.user ?? null);
        setStatus(data?.user ? "authenticated" : "anonymous");
        return data?.user ?? null;
      }),
    []
  );

  const logout = useCallback(
    () =>
      api
        .logout()
        .catch(() => {})
        .finally(() => {
          setUser(null);
          setStatus("anonymous");
        }),
    []
  );

  return (
    <AuthContext.Provider value={{ user, status, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}
