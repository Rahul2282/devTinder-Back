import mongoose from "mongoose";

const swipeSchema = new mongoose.Schema(
    {
        swipedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        swipedUser: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        direction: {
            type: String,
            enum: ['left', 'right'],
            required: true
        }
    },
    { timestamps: true }
);

// Compound index to ensure a user can't swipe the same person multiple times
swipeSchema.index({ swipedBy: 1, swipedUser: 1 }, { unique: true });

export const Swipe = mongoose.model("Swipe", swipeSchema); 