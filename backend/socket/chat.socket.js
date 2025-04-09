import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { Chat } from "../models/chat.model.js";

export const setupSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL,
            methods: ["GET", "POST"]
        }
    });

    // Authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error("Authentication error"));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.userId;
            next();
        } catch (err) {
            next(new Error("Authentication error"));
        }
    });

    const userSockets = new Map(); // Store user-socket mapping

    io.on("connection", (socket) => {
        userSockets.set(socket.userId, socket.id);

        // Join chat room
        socket.on("join_chat", (chatId) => {
            socket.join(chatId);
        });

        // Handle new message
        socket.on("send_message", async (data) => {
            try {
                const { chatId, content } = data;
                
                const newMessage = {
                    sender: socket.userId,
                    content,
                    readBy: [socket.userId]
                };

                // Save message to database
                const updatedChat = await Chat.findByIdAndUpdate(
                    chatId,
                    {
                        $push: { messages: newMessage },
                        lastMessage: new Date()
                    },
                    { new: true }
                ).populate('messages.sender', 'name profileUrl');

                const latestMessage = updatedChat.messages[updatedChat.messages.length - 1];

                // Emit message to all users in the chat
                io.to(chatId).emit("receive_message", {
                    chatId,
                    message: latestMessage
                });

            } catch (error) {
                console.error("Message error:", error);
                socket.emit("error", { message: "Failed to send message" });
            }
        });

        // Handle read receipts
        socket.on("mark_read", async ({ chatId, messageIds }) => {
            try {
                await Chat.updateMany(
                    { 
                        _id: chatId,
                        "messages._id": { $in: messageIds }
                    },
                    {
                        $addToSet: { "messages.$[].readBy": socket.userId }
                    }
                );

                io.to(chatId).emit("messages_read", {
                    chatId,
                    userId: socket.userId,
                    messageIds
                });
            } catch (error) {
                console.error("Read receipt error:", error);
            }
        });

        socket.on("disconnect", () => {
            userSockets.delete(socket.userId);
        });
    });

    return io;
};