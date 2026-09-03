import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { toast } from "../utils/toast";
import { storage, StorageKeys } from "../services/storage";
import { registerForPushNotifications } from "../utils/notifications";
import { http } from "../api/client";

const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? "";

type SocketState = {
  connected: boolean;
  socket: Socket | null;
};

const SocketContext = createContext<SocketState>({ connected: false, socket: null });

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { driver } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!driver) return;

    registerForPushNotifications()
      .then((pushToken) => {
        if (pushToken) {
          http.post("/driver/push-token", { pushToken }).catch(() => {});
        }
      })
      .catch(() => {});

    if (!WS_URL) return;
    let s: Socket;

    const connect = async () => {
      const token = await storage.get<string>(StorageKeys.token);
      s = io(WS_URL, {
        auth: { token, role: "driver" },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: 10,
      });

      s.on("connect", () => {
        console.log("[WS] Driver connected", s.id);
        if (driver.propertyId) {
          s.emit("subscribe:property", driver.propertyId);
        }
      });

      s.on("disconnect", (reason) => {
        console.log("[WS] Driver disconnected", reason);
      });

      s.on("valet.order.created", (data) => {
        if (data.driverId !== driver.id) {
          toast.info("New order", "A new vehicle order has been created.");
        }
      });

      s.on("valet.order.return.requested", (data) => {
        if (data.driverId === driver.id) {
          toast.info("Guest is ready", "A guest has requested their vehicle.");
        }
      });

      s.on("valet.order.completed", (data) => {
        if (data.driverId === driver.id) {
          toast.success("Order completed", "Your order has been completed.");
        }
      });

      s.on("connect_error", (err) => {
        console.log("[WS] Connection error:", err.message);
      });

      setSocket(s);
    };

    connect();

    return () => {
      s?.disconnect();
      setSocket(null);
    };
  }, [driver?.id, driver?.propertyId]);

  return (
    <SocketContext.Provider value={{ connected: socket?.connected ?? false, socket }}>
      {children}
    </SocketContext.Provider>
  );
};
