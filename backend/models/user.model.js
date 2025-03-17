import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
	{
		email: {
			type: String,
			required: true,
			unique: true,
		},
		password: {
			type: String,
			required: true,
		},
		name: {
			type: String,
			required: true,
		},
		lastLogin: {
			type: Date,
			default: Date.now,
		},
		isVerified: {
			type: Boolean,
			default: false,
		},
		resetPasswordToken: String,
		resetPasswordExpiresAt: Date,
		verificationToken: String,
		verificationTokenExpiresAt: Date,
		gender: {
			type: String,
			enum: ["male", "female"],
			default: null, // Initially null, user will set it later
		},
		bio: {
			type: String,
			default: "This is the default bio of the user",
		},
		genderPreference: {
			type: String,
			enum: ["male", "female", "both"],
			default: null, // Initially null, user will set it later
		},
		profileUrl: {
			type: String,
			default: null, // User will upload a profile pic later
		},
	},
	{ timestamps: true }
);

export const User = mongoose.model("User", userSchema);