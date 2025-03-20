import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
// import socket from "socket.io";

import { connectDB } from "./db/connectDB.js";

import authRoutes from "./route/auth.route.js";
import userRoutes from "./route/user.route.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
// const __dirname = path.resolve();

app.use(cors({ origin: "http://localhost:5174", credentials: true }));

app.use(express.json()); // allows us to parse incoming requests:req.body
app.use(cookieParser()); // allows us to parse incoming cookies

app.use("/api/auth", authRoutes);
app.use("/api/users",userRoutes);


const server = http.createServer(app);
// const io = socket(server,{
// 	cors: {
// 		origin: "http://localhost:5174",
// 	},
// });

// io.on("connection", (socket) => {
// 	// handle the connection
// });



server.listen(PORT, () => {
	connectDB();
	console.log("Server is running on port: ", PORT);
});