import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

dotenv.config();

const app = express();
const httpServer = createServer(app);

// Export io for direct use in controllers
export let io;

// Socket.IO setup
io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

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

// Socket.IO connection handling
io.on("connection", (socket) => {
    console.log("🔌 Socket connected:", socket.id);

    // Admin joins a room to receive real-time flag updates
    socket.on("admin:join", (quizId) => {
        if (!quizId) return;
        const roomName = `admin:${quizId.toString()}`;
        socket.join(roomName);
        console.log(`👤 Admin joined room: ${roomName} (Socket: ${socket.id})`);
        
        // Immediate confirmation to admin
        socket.emit('admin:confirmed', { room: roomName });
    });

    // Admin leaves room
    socket.on("admin:leave", (quizId) => {
        if (!quizId) return;
        const roomName = `admin:${quizId.toString()}`;
        socket.leave(roomName);
        console.log(`👤 Admin left room: ${roomName}`);
    });

    socket.on("disconnect", (reason) => {
        console.log(`🔌 Socket disconnected: ${socket.id} (Reason: ${reason})`);
    });
});

const PORT = process.env.PORT || 5000;

mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("Connected to MongoDB");
        httpServer.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((error) => console.log("MongoDB connection error:", error));
