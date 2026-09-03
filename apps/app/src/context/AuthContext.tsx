import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Driver } from "../types";
import { storage, StorageKeys } from "../services/storage";
import { http } from "../api/client";
import { ApiEndpoints } from "../api/endpoints";
import { setAuthLogoutHandler } from "../api/client";

type AuthState = {
  driver: Driver | null;
  loading: boolean;
  signIn: (valetId: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshDriver: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  driver: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
  refreshDriver: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [driver, setDriver] = useState<Driver | null>(null);
  const [loading, setLoading] = useState(true);

  const signOut = useCallback(async () => {
    setDriver(null);
    await storage.remove(StorageKeys.token);
    await storage.remove(StorageKeys.user);
  }, []);

  useEffect(() => {
    setAuthLogoutHandler(signOut);
  }, [signOut]);

  useEffect(() => {
    const restore = async () => {
      try {
        const token = await storage.get<string>(StorageKeys.token);
        const saved = await storage.get<Driver>(StorageKeys.user);
        if (token && saved) {
          setDriver(saved);
          try {
            const { driver: fresh } = await http.get<{ driver: Driver }>(
              ApiEndpoints.driver.profile,
            );
            setDriver(fresh);
            await storage.set(StorageKeys.user, fresh);
          } catch {
            await signOut();
          }
        }
      } finally {
        setLoading(false);
      }
    };
    restore();
  }, [signOut]);

  const signIn = useCallback(async (valetId: string, password: string) => {
    const res = await http.post<{ token: string; driver: Driver }>(
      ApiEndpoints.auth.driverLogin,
      { valetId, password },
    );
    await storage.set(StorageKeys.token, res.token);
    await storage.set(StorageKeys.user, res.driver);
    setDriver(res.driver);
  }, []);

  const refreshDriver = useCallback(async () => {
    try {
      const { driver: fresh } = await http.get<{ driver: Driver }>(
        ApiEndpoints.driver.profile,
      );
      setDriver(fresh);
      await storage.set(StorageKeys.user, fresh);
    } catch {
      // silent
    }
  }, []);

  return (
    <AuthContext.Provider value={{ driver, loading, signIn, signOut, refreshDriver }}>
      {children}
    </AuthContext.Provider>
  );
};
