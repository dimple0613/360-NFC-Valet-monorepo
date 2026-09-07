// Live real-time server for the valet business surface (issue #1).
//
// This replaces the legacy admin's `ws-server.js` and runs standalone on
// WS_PORT (default 3002) via `pnpm vws / pnpm --filter web vws`. It serves
// three kinds of sockets on the same endpoint:
//
//   - GUESTS (the public tap web, apps/mobile-web): anonymous, joins
//     `property:<id>` rooms via `subscribe:property` to watch their car's
//     order events.
//   - DRIVERS (the driver app, apps/app): authenticated with the HS256 driver
//     JWT sent as `auth: { token, role: 'driver' }`; automatically joined to
//     their shift property.
//   - ADMINS (tenant-admin console, web/src/lib/ws.ts connectAuthedWs):
//     socket path `/live/admin?token=<valet_ws_token>` — the short-lived,
//     signed ws-token cookie value (see web/src/lib/auth/ws-token.ts); joined
//     to the `admin` room.
//
// The Next app publishes to this server over POST /broadcast (see
// web/src/lib/valet-live.ts). Events are fanned out to `property:<id>` (for
// the matching property) and the `admin` room.
//
// Env: WS_PORT, WS_ORIGIN (comma list; "*" = any), JWT_SECRET / WS_TOKEN_SECRET
// (signing), WS_BROADCAST_URL (client side only).

import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { Server, DefaultEventsMap } from "socket.io";
import { WebSocketServer } from "ws";
import { config as loadEnv } from "dotenv";
import { verifyDriverToken } from "./src/lib/driver-jwt";

loadEnv({ path: fileURLToPath(new URL("../packages/db/.env", import.meta.url)) });
loadEnv({ path: fileURLToPath(new URL("./.env", import.meta.url)) });

const PORT = Number(process.env.WS_PORT) || 3002;
const ALLOWED_ORIGINS = (process.env.WS_ORIGIN || "*")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// The admin console socket joins the shared `admin` room, which receives every
// broadcast (queue, dashboard, offers...). A valid session credential alone is
// not an entitlement to all that data — the socket must also belong to a user
// who holds at least one valet.* permission in their session's organization,
// mirroring what page.tsx requireValetPage checks server-side. Scoped to "at
// least one valet.*" because the room is room-wide; per-resource (per-event)
// fan-out granularity would need the broadcast path to carry resource type and
// per-socket permission sets, which is out of scope for the admin room today.
const dbPool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;

async function sessionHoldsValetPermission(sessionId: string): Promise<boolean> {
  if (!dbPool) return false;
  try {
    const res = await dbPool.query(
      `SELECT 1
         FROM sessions s
         JOIN user_roles ur ON ur.user_id = s.user_id
         JOIN roles r ON r.id = ur.role_id
         JOIN role_permissions rp ON rp.role_id = r.id
         JOIN permissions p ON p.id = rp.permission_id
        WHERE s.id = $1
          AND s.revoked_at IS NULL
          AND s.expires_at > NOW()
          AND p.key LIKE 'valet.%'
          AND (r.organization_id = s.organization_id OR r.organization_id IS NULL)
        LIMIT 1`,
      [sessionId],
    );
    return (res.rowCount ?? 0) > 0;
  } catch {
    // A DB failure during auth must fail closed: an admin socket that can't be
    // validated against the permission grant isn't allowed in.
    return false;
  }
}

function wsTokenSecret(): string {
  return process.env.JWT_SECRET || process.env.WS_TOKEN_SECRET || "dev-secret-change-me";
}

// valet_ws_token cookie format: `<sessionId>.<expiryEpochMs>.<hmac(hex)>`.
function verifyWsToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [sessionId, expiryMs, mac] = parts;
  const expiry = Number(expiryMs);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) return null;
  const expected = createHmac("sha256", wsTokenSecret())
    .update(`${sessionId}.${expiryMs}`)
    .digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return sessionId;
}

const httpServer = createServer((req, res) => {
  if (req.method === "POST" && req.url === "/broadcast") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const { event, data } = JSON.parse(body);
        if (!event || !data) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end('{"error":"event and data are required"}');
          return;
        }
        const room = data.propertyId ? `property:${data.propertyId}` : "all";
        io.to(room).emit(event, data);
        io.to("admin").emit(event, data);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end('{"ok":true}');
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end('{"error":"invalid json"}');
      }
    });
    return;
  }
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, connections: io.engine.clientsCount }));
    return;
  }
  res.writeHead(404);
  res.end();
});

// The tenant-admin console (web/src/lib/ws.ts connectAuthedWs) opens a plain
// browser WebSocket to /live/admin?token=<valet_ws_token> — NOT a socket.io
// connection. Route those upgrades to a raw `ws` server on the same port and
// authenticate them with the ws-token HMAC so the socket only opens when the
// admin cookie is valid. Everything else goes through socket.io's own upgrade
// path (Engine.IO handshake), so leave other paths untouched here.
const rawAdminServer = new WebSocketServer({ noServer: true });
httpServer.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname !== "/live/admin") return;
  const sessionId = verifyWsToken(url.searchParams.get("token") || "");
  if (!sessionId) {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }
  sessionHoldsValetPermission(sessionId).then((allowed) => {
    if (!allowed) {
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    rawAdminServer.handleUpgrade(req, socket, head, (ws) => {
      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg?.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
        } catch {
          // ignore non-JSON frames
        }
      });
      ws.on("error", () => undefined);
      ws.on("close", () => undefined);
    });
  });
});

const io = new Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>(httpServer, {
  cors: {
    origin(origin, cb) {
      if (!origin || ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error("Origin not allowed"));
      }
    },
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  pingInterval: 25000,
  pingTimeout: 10000,
});

interface SocketData {
  auth?: {
    type: "guest" | "driver" | "admin";
    driverId?: number;
    valetId?: string;
    propertyId?: number | null;
    sessionId?: string;
  };
}

io.use(async (socket, next) => {
  try {
    const requestedUrl = new URL(socket.handshake.url, "http://localhost");
    const pathname = requestedUrl.pathname;
    const token =
      (socket.handshake.auth?.token as string | undefined) ||
      (socket.handshake.query?.token as string | undefined);
    const role =
      (socket.handshake.auth?.role as string | undefined) ||
      (socket.handshake.query?.role as string | undefined);

    // Admin console sockets take their own path and use the ws-token cookie
    // value (opaque session id + HMAC). No driver JWT involved.
    if (pathname === "/live/admin") {
      const sessionId = token ? verifyWsToken(token) : null;
      if (!sessionId) return next(new Error("Invalid or expired token"));
      if (!(await sessionHoldsValetPermission(sessionId))) {
        return next(new Error("Session has no valet access"));
      }
      socket.data.auth = { type: "admin", sessionId };
      return next();
    }

    if (token) {
      if (role === "driver") {
        const claims = verifyDriverToken(token);
        if (!claims) return next(new Error("Invalid or expired token"));
        socket.data.auth = { type: "driver", driverId: claims.driverId, valetId: claims.valetId, propertyId: claims.propertyId };
        return next();
      }
      const sessionId = verifyWsToken(token);
      if (!sessionId) return next(new Error("Invalid or expired token"));
      if (!(await sessionHoldsValetPermission(sessionId))) {
        return next(new Error("Session has no valet access"));
      }
      socket.data.auth = { type: "admin", sessionId };
      return next();
    }

    // Guest sockets (public tap web) connect anonymously and only ever join
    // `property:<id>` rooms they subscribe to.
    socket.data.auth = { type: "guest" };
    return next();
  } catch {
    return next(new Error("Invalid connection"));
  }
});

io.on("connection", (socket) => {
  const ctx = socket.data.auth || { type: "guest" as const };
  const kind = ctx.type;

  if (kind === "admin") {
    socket.join("admin");
  }
  if (kind === "driver" && ctx.propertyId) {
    socket.join(`property:${ctx.propertyId}`);
  }

  socket.on("subscribe:property", (propertyId: number) => {
    if (propertyId) socket.join(`property:${propertyId}`);
  });

  socket.on("unsubscribe:property", (propertyId: number) => {
    if (propertyId) socket.leave(`property:${propertyId}`);
  });

  socket.on("disconnect", () => {
    for (const room of [...socket.rooms]) {
      if (room !== socket.id) socket.leave(room);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`[WS] WebSocket server listening on :${PORT} (origins: ${ALLOWED_ORIGINS.join(", ")})`);
});