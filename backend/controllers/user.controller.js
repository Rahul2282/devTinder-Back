import { User } from "../models/user.model.js";
import { Swipe } from "../models/swipe.model.js";
import cloudinary from "cloudinary";
import jwt from "jsonwebtoken";

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
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
        {
          folder: "profile_images",
          transformation: [{ width: 500, height: 500, crop: "fill" }],
        },
        async (error, result) => {
          if (error) {
            console.error(error);
            return res.status(500).json({ message: "Image upload failed" });
          }
          user.profileUrl = result.secure_url;
          await user.save();
          return res
            .status(200)
            .json({ message: "Profile updated successfully", user });
        }
      );

      result.end(req.file.buffer); // Convert buffer to stream for upload
    } else {
      await user.save();
      return res
        .status(200)
        .json({ message: "Profile updated successfully", user });
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

    // Extract token from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const currentUser = await User.findOne({ _id: decoded.userId });
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get gender preference
    const preferredGender = currentUser.genderPreference;

    // If genderPreference is null, return an empty feed
    if (!preferredGender) {
      return res.status(400).json({ message: "Please set your gender preference." });
    }

    // Get users the current user has swiped left on
    const leftSwipedUsers = await Swipe.find({
      swipedBy: currentUser._id,
      direction: "left",
    }).select("swipedUser");

    const leftSwipedUserIds = leftSwipedUsers.map((swipe) => swipe.swipedUser);

    // Get users the current user has swiped right on
    const rightSwipedUsers = await Swipe.find({
      swipedBy: currentUser._id,
      direction: "right",
    }).select("swipedUser");

    const rightSwipedUserIds = rightSwipedUsers.map((swipe) => swipe.swipedUser);

    // Get mutual right-swipes (matches)
    const matchedUsers = await Swipe.find({
      swipedBy: { $in: rightSwipedUserIds },
      swipedUser: currentUser._id,
      direction: "right",
    }).select("swipedBy");

    const matchedUserIds = matchedUsers.map((swipe) => swipe.swipedBy);

    // Build query
    let genderFilter = {};
    if (preferredGender !== "both") {
      genderFilter = { gender: preferredGender };
    }

    let query = {
      _id: { 
        $nin: [...leftSwipedUserIds, ...matchedUserIds] // Exclude left-swiped and matched users
      }, 
      email: { $ne: decoded.email }, // Exclude current user
      ...genderFilter, // Apply gender preference filter
      $or: [
        { _id: { $in: rightSwipedUserIds } }, // Include right-swiped users
        { _id: { $nin: rightSwipedUserIds } } // Also include users who haven't been swiped on
      ]
    };

    const skip = (page - 1) * limit;

    let users = await User.find(query)
      .skip(skip)
      .limit(limit)
      .select("-password");

    // Fisher-Yates shuffle algorithm
    const shuffleArray = (array) => {
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    };

    users = shuffleArray(users); // Shuffle the retrieved users

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

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const currentUser = await User.findOne({ _id: decoded.userId });

    if (!currentUser) {
      return res.status(404).json({ message: "Current user not found" });
    }

    // Validate direction
    if (!["left", "right"].includes(direction)) {
      return res.status(400).json({ message: "Invalid swipe direction" });
    }

    // Find an existing swipe record
    const existingSwipe = await Swipe.findOne({
      swipedBy: currentUser._id,
      swipedUser: swipedUserId,
    });

    if (existingSwipe) {
      // Update direction if a swipe record exists
      existingSwipe.direction = direction;
      await existingSwipe.save();
    } else {
      // If no existing swipe record, create a new one
      await Swipe.create({
        swipedBy: currentUser._id,
        swipedUser: swipedUserId,
        direction,
      });
    }

    // Check if the swiped user has already right-swiped the current user
    if (direction === "right") {
      const mutualSwipe = await Swipe.findOne({
        swipedBy: swipedUserId,
        swipedUser: currentUser._id,
        direction: "right",
      });

      if (mutualSwipe) {
        return res.status(200).json({ message: "Swipe recorded successfully", matchMessage: "It's a match" });
      }
    }

    res.status(200).json({ message: "Swipe recorded successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};


export const getLikedBy = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

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

    const skip = (page - 1) * limit;

    // Find users whom the current user has responded to (either accepted or rejected)
    const respondedUserIds = await Swipe.find({
      swipedBy: currentUser._id, // Current user made a decision
      direction: { $in: ["left", "right"] }, // Either accepted or rejected
    }).distinct("swipedUser");

    // Get users who liked the current user but have NOT been responded to
    const rightSwipes = await Swipe.find({
      swipedUser: currentUser._id,
      direction: "right",
      swipedBy: { $nin: respondedUserIds }, // Exclude accepted/rejected users
    })
      .populate("swipedBy", "-password")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const totalLikes = await Swipe.countDocuments({
      swipedUser: currentUser._id,
      direction: "right",
      swipedBy: { $nin: respondedUserIds },
    });

    const totalPages = Math.ceil(totalLikes / limit);
    const likedByUsers = rightSwipes.map((swipe) => swipe.swipedBy);

    res.status(200).json({
      message: "Liked by users fetched successfully",
      users: likedByUsers,
      totalLikes,
      totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const respondToLike = async (req, res) => {
  try {
    const { userId, action } = req.body;

    if (!["accept", "reject"].includes(action)) {
      return res
        .status(400)
        .json({ message: "Invalid action. Use 'accept' or 'reject'" });
    }

    // Get current user from token
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
      return res.status(404).json({ message: "Current user not found" });
    }

    // Determine the swipe direction
    const direction = action === "accept" ? "right" : "left";

    // Use `findOneAndUpdate` to update existing swipes or create a new one
    const swipe = await Swipe.findOneAndUpdate(
      { swipedBy: currentUser._id, swipedUser: userId }, // Find existing swipe
      { direction }, // Update direction
      { upsert: true, new: true } // Create if not exists, return updated document
    );

    res.status(200).json({
      message:
        action === "accept"
          ? "Match created successfully!"
          : "Profile rejected successfully",
      swipe,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

export const getMatches = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Unauthorized: No token provided" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // console.log("decoded",decoded)
    const currentUser = await User.findOne({ _id: decoded.userId });
    if (!currentUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const skip = (page - 1) * limit;

    // Find users who have right-swiped current user
    const rightSwipedBy = await Swipe.find({
      swipedUser: currentUser._id,
      direction: "right",
    }).distinct("swipedBy");

    // Find users who current user has right-swiped
    const matches = await Swipe.find({
      swipedBy: currentUser._id,
      swipedUser: { $in: rightSwipedBy },
      direction: "right",
    })
      .populate("swipedUser", "-password")
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const totalMatches = await Swipe.countDocuments({
      swipedBy: currentUser._id,
      swipedUser: { $in: rightSwipedBy },
      direction: "right",
    });

    const totalPages = Math.ceil(totalMatches / limit);
    const matchedUsers = matches.map((match) => match.swipedUser);

    res.status(200).json({
      message: "Matches fetched successfully",
      users: matchedUsers,
      totalMatches,
      totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};


