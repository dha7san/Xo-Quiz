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
            socket.activeAdminRoom = roomName;
            console.log(`👤 Admin joined room: ${roomName} (Socket: ${socket.id})`);
            socket.emit('admin:confirmed', { room: roomName });
        });

        socket.on("admin:leave", (quizId) => {
            if (!quizId) return;
            const roomName = `admin:${quizId.toString()}`;
            socket.leave(roomName);
            if (socket.activeAdminRoom === roomName) delete socket.activeAdminRoom;
            console.log(`👤 Admin left room: ${roomName}`);
        });

        // --- User Quiz Rooms Configuration ---
        
        // Allows a user to subscribe to events ONLY for their specific quiz
        socket.on("quiz:join", (quizId) => {
            if (!quizId) return;
            const roomName = `quiz:${quizId.toString()}`;
            
            socket.join(roomName);
            // Track the room explicitly on the socket object for custom cleanup if needed
            socket.activeQuizRoom = roomName; 
            
            console.log(`🎓 Participant joined: ${roomName} (Socket: ${socket.id})`);
            socket.emit("quiz:join_confirmed", { room: roomName });
        });

        // Client triggers this explicitly when leaving the quiz
        socket.on("quiz:leave", (quizId) => {
            if (!quizId) return;
            const roomName = `quiz:${quizId.toString()}`;
            
            socket.leave(roomName);
            if (socket.activeQuizRoom === roomName) delete socket.activeQuizRoom;
            
            console.log(`🎓 Participant left ${roomName}`);
        });

        socket.on("disconnect", (reason) => {
            if (socket.activeQuizRoom) {
                socket.leave(socket.activeQuizRoom);
                console.log(`🧹 Cleaned up stale participant socket from ${socket.activeQuizRoom}`);
                delete socket.activeQuizRoom;
            }
            if (socket.activeAdminRoom) {
                socket.leave(socket.activeAdminRoom);
                console.log(`🧹 Cleaned up stale admin socket from ${socket.activeAdminRoom}`);
                delete socket.activeAdminRoom;
            }
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
