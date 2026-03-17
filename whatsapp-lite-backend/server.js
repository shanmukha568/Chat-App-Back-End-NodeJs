import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

import { testConnection } from "./config/db.js";
import { initSocket } from "./sockets/chatSocket.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { authenticate } from "./middleware/authMiddleware.js";
import { UserModel } from "./models/userModel.js";
import { UserController } from "./controllers/userController.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";

const app = express();
const server = createServer(app);

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const corsOriginList = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOriginMatchers = corsOriginList.map((pattern) => {
  if (pattern === "*") return { type: "any" };
  if (!pattern.includes("*")) return { type: "exact", value: pattern };
  const regexSource = pattern.split("*").map(escapeRegExp).join(".*");
  return { type: "regex", value: new RegExp(`^${regexSource}$`) };
});

function isAllowedOrigin(origin) {
  if (!origin) return true;
  for (const matcher of corsOriginMatchers) {
    if (matcher.type === "any") return true;
    if (matcher.type === "exact" && origin === matcher.value) return true;
    if (matcher.type === "regex" && matcher.value.test(origin)) return true;
  }
  return false;
}

const corsOptions = {
  origin(origin, cb) {
    if (isAllowedOrigin(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

const io = new Server(server, {
  cors: {
    origin(origin, cb) {
      if (isAllowedOrigin(origin)) return cb(null, true);
      return cb(null, false);
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingInterval: 25_000,
  pingTimeout: 60_000,
  maxHttpBufferSize: 20e6,
});
app.set("io", io);
initSocket(io);

app.get("/health", (_req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() })
);

app.use("/api", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);

app.get("/api/auth/me", authenticate, UserController.getMe);

app.post("/api/logout", authenticate, async (req, res, next) => {
  try {
    await UserModel.setOnlineStatus(req.user.id, false);
    return res.json({ success: true, message: "Logged out" });
  } catch (err) {
    next(err);
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 5001;
server.listen(PORT, async () => {
  try {
    await testConnection();
  } catch (err) {
    console.error("MySQL connection failed:", err.message);
    console.error(
      "-> Check DATABASE_URL / MYSQL_URL (or DB_*). If you used Railway and pasted a mysql://... URL into DB_HOST, that's supported too."
    );
    process.exit(1);
  }
  console.log(`Server    -> http://localhost:${PORT}`);
  console.log("Socket.IO -> ready");
  console.log(`CORS      -> ${corsOriginList.join(", ") || "(none)"}`);
});

export default app;
