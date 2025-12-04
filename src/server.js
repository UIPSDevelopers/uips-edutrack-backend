// server.js (or index.js)

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import bodyParser from "body-parser";

import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import deliveryRoutes from "./routes/deliveryRoutes.js";
import checkoutRoutes from "./routes/checkoutRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import dashboardRoutes from "./routes/dashboard.js";
import returnRoutes from "./routes/returnRoutes.js";

dotenv.config();

const app = express();

// CORS
const allowedOrigins = [
  "https://edutrack.uips.online",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"), false);
    },
    credentials: true,
  })
);

// ❌ REMOVE THIS
// app.use(express.json());

// ✅ KEEP ONLY ONE JSON PARSER WITH LIMIT
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true, limit: "10mb" }));

// Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "EduTrack backend is running",
    time: new Date().toISOString(),
  });
});

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is not defined");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// Routes
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/checkouts", checkoutRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/returns", returnRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
