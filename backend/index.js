import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
// import http from "http";
import { createServer } from "http";
import { setupSocket } from "./socket/chat.socket.js";
// import socket from "socket.io";

import { connectDB } from "./db/connectDB.js";

import authRoutes from "./route/auth.route.js";
import userRoutes from "./route/user.route.js";
import chatRoutes from "./route/chat.route.js";


dotenv.config();

const app = express();
const server = createServer(app);
const io = setupSocket(server);

const PORT = process.env.PORT || 5000;
// const __dirname = path.resolve();

app.use(cors({ 
	origin: process.env.FRONTEND_URL || "http://localhost:5174", 
	credentials: true 
}));

app.use(express.json()); // allows us to parse incoming requests:req.body
app.use(cookieParser()); // allows us to parse incoming cookies

app.use("/api/auth", authRoutes);
app.use("/api/users",userRoutes);
app.use("/api/chats",chatRoutes);



server.listen(PORT, () => {
	connectDB();
	console.log("Server is running on port: ", PORT);
});