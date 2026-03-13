import { Server } from 'socket.io';

let io;

export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || "*",
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            credentials: true
        }
    });

    io.on("connection", (socket) => {
        console.log("🔌 Socket connected:", socket.id);

        socket.on("admin:join", (quizId) => {
            if (!quizId) return;
            const roomName = `admin:${quizId.toString()}`;
            socket.join(roomName);
            console.log(`👤 Admin joined room: ${roomName} (Socket: ${socket.id})`);
            socket.emit('admin:confirmed', { room: roomName });
        });

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

    return io;
};

export const getIO = () => {
    if (!io) {
        console.warn("⚠️ getIO called before initSocket. Returning null.");
        return null;
    }
    return io;
};
