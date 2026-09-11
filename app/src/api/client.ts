import { API_URL, API_TIMEOUT_MS } from "../config";
import { storage, StorageKeys } from "../services/storage";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: object | string;
};

let authLogoutHandler: (() => void | Promise<void>) | null = null;

export const setAuthLogoutHandler = (handler: () => void | Promise<void>) => {
  authLogoutHandler = handler;
};

const request = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const token = await storage.get<string>(StorageKeys.token);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers,
      body: options.body
        ? typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body)
        : undefined,
    });

    if (response.status === 401) {
      await storage.remove(StorageKeys.token);
      await storage.remove(StorageKeys.user);
      if (authLogoutHandler) await authLogoutHandler();
      throw new Error("Session expired");
    }

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || `API request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
};

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: object) =>
    request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: object) =>
    request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: object) =>
    request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
