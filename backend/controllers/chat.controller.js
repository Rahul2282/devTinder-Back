import { Chat } from "../models/chat.model.js";
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";

// Find room between two users
export const findRoom = async (req, res) => {
  try {
    const targetUserId  = req.body.targetUserId;
    // Extract token from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const currentUser = await User.findOne({ _id: decoded.userId });
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentUserId = currentUser._id;
    // Find existing chat between these users
    let chat = await Chat.findOne({
      participants: {
        $all: [currentUserId, targetUserId],
        $size: 2,
      },
    });

    // If no chat exists, create a new one
    if (!chat) {
      chat = await Chat.create({
        participants: [currentUserId, targetUserId],
        messages: [],
      });
    }

    res.json({ chatId: chat._id });
  } catch (error) {
    console.error("Error creating chat:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const chatHistory = async (req, res) => {
    try {
        const { chatId } = req.body.chatId;
        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.status(404).json({ message: "Chat not found" });
        }
        res.json(chat.messages);
    } catch (error) {
        console.error("Error fetching chat history:", error);
        res.status(500).json({ message: "Internal server error" });
    }
}
