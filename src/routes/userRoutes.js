import express from "express";
import {
  addUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "../controllers/userController.js";

const router = express.Router();

// ✅ Place login route first

router.post("/", addUser);
router.get("/", getUsers);
router.get("/:id", getUserById);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;
