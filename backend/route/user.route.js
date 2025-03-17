import express from "express";
import { updateProfile, getFeed, swipeUser, getLikedBy, getMatches, respondToLike } from "../controllers/user.controller.js";
import upload from "../middleware/multerConfig.js";

const router = express.Router();

router.post("/updateProfile", upload.single("file"), updateProfile);
router.post("/swipe", swipeUser);
router.get("/feed", getFeed);
router.get("/likedBy", getLikedBy);
router.get("/matches", getMatches);
router.post("/respondToLike", respondToLike);


export default router;