import {User} from "../models/user.model.js"; 
import { Swipe } from "../models/swipe.model.js";
import cloudinary from "cloudinary";
import jwt from "jsonwebtoken";



// Configure Cloudinary
cloudinary.v2.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});

// const upload = multer({ storage: multer.memoryStorage() });

export const updateProfile = async (req, res) => {
    try {
        // Ensure req.body values are extracted properly for multipart/form-data
        const email = req.body.email?.trim();
        const bio = req.body.bio?.trim();
        const gender = req.body.gender?.trim();
        const genderPreference = req.body.genderPreference?.trim();

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Update bio and gender
        if (bio) user.bio = bio;
        if (gender) user.gender = gender;
        if (genderPreference) user.genderPreference = genderPreference;

        // Handle file upload if file is provided
        if (req.file) {
            const result = await cloudinary.v2.uploader.upload_stream(
                { folder: "profile_images", transformation: [{ width: 500, height: 500, crop: "fill" }] },
                async (error, result) => {
                    if (error) {
                        console.error(error);
                        return res.status(500).json({ message: "Image upload failed" });
                    }
                    user.profileUrl = result.secure_url;
                    await user.save();
                    return res.status(200).json({ message: "Profile updated successfully", user });
                }
            );

            result.end(req.file.buffer); // Convert buffer to stream for upload
        } else {
            await user.save();
            return res.status(200).json({ message: "Profile updated successfully", user });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

export const getFeed = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        // Extract token from cookies
        const token = req.cookies?.token;
        if (!token) {
            return res.status(401).json({ message: "Unauthorized: No token provided" });
        }

        // Verify token and get current user
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const currentUser = await User.findOne({ email: decoded.email });
        if (!currentUser) {
            return res.status(404).json({ message: "User not found" });
        }

        // Get all users that the current user has swiped
        const swipedUsers = await Swipe.find({ swipedBy: currentUser._id })
            .select('swipedUser');
        
        const swipedUserIds = swipedUsers.map(swipe => swipe.swipedUser);

        // Build query
        let query = {
            _id: { $nin: swipedUserIds }, // Exclude swiped users
            email: { $ne: decoded.email } // Exclude current user
        };

        // Apply gender preference filter
        if (currentUser.genderPreference === "male") {
            query.gender = "male";
        } else if (currentUser.genderPreference === "female") {
            query.gender = "female";
        }

        const skip = (page - 1) * limit;

        const users = await User.find(query)
            .skip(skip)
            .limit(limit)
            .select("-password");

        const totalUsers = await User.countDocuments(query);
        const totalPages = Math.ceil(totalUsers / limit);

        res.status(200).json({
            message: "Feed fetched successfully",
            users,
            totalUsers,
            totalPages,
            currentPage: page,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

export const swipeUser = async (req, res) => {
    try {
        const { swipedUserId, direction } = req.body;
        
        // Get current user from token
        const token = req.cookies?.token;
        if (!token) {
            return res.status(401).json({ message: "Unauthorized: No token provided" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const currentUser = await User.findOne({ email: decoded.email });
        
        if (!currentUser) {
            return res.status(404).json({ message: "Current user not found" });
        }

        // Validate direction
        if (!['left', 'right'].includes(direction)) {
            return res.status(400).json({ message: "Invalid swipe direction" });
        }

        // Create swipe record
        await Swipe.create({
            swipedBy: currentUser._id,
            swipedUser: swipedUserId,
            direction
        });

        res.status(200).json({ message: "Swipe recorded successfully" });
    } catch (error) {
        if (error.code === 11000) { // Duplicate key error
            return res.status(400).json({ message: "You have already swiped this user" });
        }
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

export const getLikedBy = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const token = req.cookies?.token;
        if (!token) {
            return res.status(401).json({ message: "Unauthorized: No token provided" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const currentUser = await User.findOne({ email: decoded.email });
        if (!currentUser) {
            return res.status(404).json({ message: "User not found" });
        }

        const skip = (page - 1) * limit;

        // Find users who I've left-swiped (rejected)
        const rejectedUserIds = await Swipe.find({
            swipedBy: currentUser._id,
            direction: 'left'
        }).distinct('swipedUser');

        // Find right swipes where current user is the swipedUser
        // but exclude those who I've rejected
        const rightSwipes = await Swipe.find({
            swipedUser: currentUser._id,
            direction: 'right',
            swipedBy: { $nin: rejectedUserIds }
        })
        .populate('swipedBy', '-password')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

        const totalLikes = await Swipe.countDocuments({
            swipedUser: currentUser._id,
            direction: 'right',
            swipedBy: { $nin: rejectedUserIds }
        });

        const totalPages = Math.ceil(totalLikes / limit);
        const likedByUsers = rightSwipes.map(swipe => swipe.swipedBy);

        res.status(200).json({
            message: "Liked by users fetched successfully",
            users: likedByUsers,
            totalLikes,
            totalPages,
            currentPage: page
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

export const respondToLike = async (req, res) => {
    try {
        const { userId, action } = req.body;
        
        if (!['accept', 'reject'].includes(action)) {
            return res.status(400).json({ message: "Invalid action. Use 'accept' or 'reject'" });
        }

        // Get current user from token
        const token = req.cookies?.token;
        if (!token) {
            return res.status(401).json({ message: "Unauthorized: No token provided" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const currentUser = await User.findOne({ email: decoded.email });
        
        if (!currentUser) {
            return res.status(404).json({ message: "Current user not found" });
        }

        // Create swipe record (left swipe for reject, right swipe for accept)
        await Swipe.create({
            swipedBy: currentUser._id,
            swipedUser: userId,
            direction: action === 'accept' ? 'right' : 'left'
        });

        res.status(200).json({ 
            message: action === 'accept' ? 
                "Match created successfully!" : 
                "Profile rejected successfully" 
        });

    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ message: "You have already responded to this user" });
        }
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

export const getMatches = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const token = req.cookies?.token;
        if (!token) {
            return res.status(401).json({ message: "Unauthorized: No token provided" });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const currentUser = await User.findOne({ email: decoded.email });
        if (!currentUser) {
            return res.status(404).json({ message: "User not found" });
        }

        const skip = (page - 1) * limit;

        // Find users who have right-swiped current user
        const rightSwipedBy = await Swipe.find({
            swipedUser: currentUser._id,
            direction: 'right'
        }).distinct('swipedBy');

        // Find users who current user has right-swiped
        const matches = await Swipe.find({
            swipedBy: currentUser._id,
            swipedUser: { $in: rightSwipedBy },
            direction: 'right'
        })
        .populate('swipedUser', '-password')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 });

        const totalMatches = await Swipe.countDocuments({
            swipedBy: currentUser._id,
            swipedUser: { $in: rightSwipedBy },
            direction: 'right'
        });

        const totalPages = Math.ceil(totalMatches / limit);
        const matchedUsers = matches.map(match => match.swipedUser);

        res.status(200).json({
            message: "Matches fetched successfully",
            users: matchedUsers,
            totalMatches,
            totalPages,
            currentPage: page
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};
