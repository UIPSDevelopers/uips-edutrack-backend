import express from "express";
import { loginUser, verifyToken } from "../controllers/authController.js";

const router = express.Router();

router.post("/login", loginUser);
router.get("/me", verifyToken); // for fetching logged-in user details

export default router;
