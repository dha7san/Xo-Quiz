import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";

// Global Error Protection
process.on("uncaughtException", (err) => {
    console.error("🔥 Uncaught Exception:", err);
    process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("🔥 Unhandled Rejection at:", promise, "reason:", reason);
});

import { initSocket } from "./socket.js";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO using the dedicated module
const io = initSocket(httpServer);

// Also set on app for flexibility
app.set("io", io);

import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";

app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
}));

// Security Middleware
app.use(helmet());
app.use(compression());

// Request Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 150, // Limit each IP to 150 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many requests from this IP, please try again after 15 minutes" }
});
app.use('/api', apiLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/admin', adminRoutes);

app.get("/", (req, res) => {
    res.send("Quiz App API is running");
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error("❌ Unhandled Error:", err);
    res.status(500).json({
        message: "Internal Server Error",
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

const PORT = process.env.PORT || 5000;

// Connect to MongoDB before starting server
mongoose
    .connect(process.env.MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
    })
    .then(() => {
        console.log("Connected to MongoDB");
        // Start server only after DB connects
        httpServer.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((error) => {
        console.error("MongoDB connection error:", error);
        process.exit(1);
    });


