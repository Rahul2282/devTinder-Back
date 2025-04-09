import express from "express";
import { findRoom } from "../controllers/chat.controller.js";
import { chatHistory } from "../controllers/chat.controller.js";

const router = express.Router();
router.post("/findRoom", findRoom);
router.post("/chatHistory", chatHistory);

export default router;