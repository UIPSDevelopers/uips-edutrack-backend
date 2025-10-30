import express from "express";
import {
  addDelivery,
  getDeliveries,
  getDeliveryById,
} from "../controllers/deliveryController.js";

const router = express.Router();

router.post("/add", addDelivery);
router.get("/", getDeliveries);
router.get("/:id", getDeliveryById);

export default router;
