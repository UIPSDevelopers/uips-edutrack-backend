import express from "express";
import {
  addCheckout,
  getCheckouts,
  getCheckoutById,
} from "../controllers/checkoutController.js";

const router = express.Router();

router.post("/add", addCheckout);
router.get("/", getCheckouts);
router.get("/:id", getCheckoutById); // ✅ Fetch by custom checkoutId

export default router;
