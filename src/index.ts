import express, {
  type Express,
  Request,
  Response,
  NextFunction,
} from "express";
import { config } from "./utils/config";
import authRoutes from "./routes/auth";
import cors from "cors";
import helmet from "helmet";
import { rateLimiting } from "./middleware/ratelimiter";
import { logger } from "./utils/logger";
import { seedAdmin } from "./utils/adminSeeder";
import auditRoutes from "./routes/audit";
import OtpRoutes from './routes/otp'
import AdminRoutes from './routes/admin'
import OrgRoutes from './routes/organization'
import ReportsRoute from './routes/reports'
import { connectDB, disconnectDB } from "./database/database";

const app: Express = express();
const CORS_WHITELIST = [
  "http://localhost:4001",
  "https://bugkhoji.com",
  "https://www.bugkhoji.com",
];

app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      if (CORS_WHITELIST.indexOf(origin) === -1) {
        return callback(new Error("Not allowed by CORS"), false);
      }

      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);

app.use(express.json());
app.use("/v1", authRoutes);
app.use("/login/researcher", rateLimiting);
app.use("/login/admin", rateLimiting);
app.use("/api/audit", auditRoutes);
app.use("/api/v1/admin/", AdminRoutes);
app.use("/api/v1/organization",OrgRoutes);
app.use("/api/v1/reports",ReportsRoute);
app.use("/api", OtpRoutes);

app.use((err: any, req: Request, res: Response, next: NextFunction): void => {
  logger.error(`${err.message} - ${req.method} ${req.originalUrl} - ${req.ip}`);

  if (err.message === "Not allowed by CORS") {
    res.status(403).json({ message: err.message });
    return;
  }

  res.status(500).json({ message: "Internal Server Error" });
});

const PORT = config.PORT;

async function startServer() {
  await connectDB();
  await seedAdmin();

  app.listen(PORT, () => {
    console.log(`Bugkhoj server is running at ${PORT}`);
    logger.info(`🚀 Bugkhoj server is running at http://localhost:${PORT}`);
  });
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("🔄 Shutting down gracefully...");
  await disconnectDB();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("🔄 Shutting down gracefully...");
  await disconnectDB();
  process.exit(0);
});

startServer();
