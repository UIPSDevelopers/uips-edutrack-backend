import User from "../models/userModel.js";
import bcrypt from "bcryptjs";

/* ===========================
   🧩 CREATE USER
=========================== */
export const addUser = async (req, res) => {
  try {
    const { firstname, lastname, email, role, password } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password is required" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Generate incremental userId
    const lastUser = await User.findOne().sort({ createdAt: -1 });
    let newId = 1;
    if (lastUser && lastUser.userId) {
      const lastNum = parseInt(lastUser.userId.split("-")[1]);
      newId = lastNum + 1;
    }
    const userId = `USR-${String(newId).padStart(4, "0")}`;

    const user = await User.create({
      userId,
      firstname,
      lastname,
      email,
      role,
      password,
    });

    res.status(201).json({
      message: "User created successfully",
      user: {
        userId: user.userId,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ===========================
   📋 GET ALL USERS
=========================== */
export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* ===========================
   🔍 GET USER BY userId
=========================== */
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findOne({ userId: id }).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ===========================
   ✏️ UPDATE USER BY userId
=========================== */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstname, lastname, email, role, password } = req.body;

    const user = await User.findOne({ userId: id });
    if (!user) return res.status(404).json({ message: "User not found" });

    user.firstname = firstname || user.firstname;
    user.lastname = lastname || user.lastname;
    user.email = email || user.email;
    user.role = role || user.role;

    // Only update password if provided
    if (password && password.trim() !== "") {
      user.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await user.save();

    res.status(200).json({
      message: "User updated successfully",
      user: {
        userId: updatedUser.userId,
        firstname: updatedUser.firstname,
        lastname: updatedUser.lastname,
        email: updatedUser.email,
        role: updatedUser.role,
      },
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: error.message });
  }
};

/* ===========================
   ❌ DELETE USER BY userId
=========================== */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findOne({ userId: id });
    if (!user) return res.status(404).json({ message: "User not found" });

    await user.deleteOne();
    res.status(200).json({ message: `User ${user.userId} deleted successfully` });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: error.message });
  }
};