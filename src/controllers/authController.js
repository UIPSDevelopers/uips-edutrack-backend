import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import User from "../models/userModel.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m"; // ⏱ default 15 minutes

if (!JWT_SECRET) {
  console.error("❌ JWT_SECRET is not defined in environment variables.");
}

/* ===========================
   🔐 LOGIN USER
=========================== */
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    // Allow login via email OR userId (username-style)
    const user = await User.findOne({
      $or: [{ email: email }, { userId: email }],
    });

    if (!user) {
      return res
        .status(401)
        .json({ message: "Invalid email/user ID or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ message: "Invalid email/user ID or password." });
    }

    // Generate short-lived JWT (15 minutes by default)
    const token = jwt.sign(
      { userId: user.userId, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      message: "Login successful.",
      token,
      expiresIn: JWT_EXPIRES_IN, // optional: frontend can read this
      user: {
        userId: user.userId,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res
      .status(500)
      .json({ message: "Server error during login.", error: error.message });
  }
};

/* ===========================
   🧠 VERIFY TOKEN (for /me)
=========================== */
export const verifyToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided." });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findOne({ userId: decoded.userId }).select(
      "-password"
    );
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Verify token error:", error);

    // Professional, clear messages
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "Session expired. Please log in again." });
    }

    return res
      .status(401)
      .json({ message: "Invalid or expired token. Please log in again." });
  }
};
