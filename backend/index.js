import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

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

app.use(cors());
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

// Export app for Vercel
export default app;

// Start server locally or on traditional VPS
// (Vercel will ignore this and use the exported app)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    httpServer.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// Connect to MongoDB independently
mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch((error) => console.log("MongoDB connection error:", error));


