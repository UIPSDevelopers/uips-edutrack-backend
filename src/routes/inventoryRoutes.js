import express from "express";
import { addItem, getAllItems, updateItem, deleteItem, getItemByBarcode } from "../controllers/inventoryController.js";

const router = express.Router();

router.post("/add", addItem);
router.get("/", getAllItems);
router.put("/:id", updateItem);     // ✏️ update item
router.delete("/:id", deleteItem);  // 🗑️ delete item
router.get("/barcode/:barcode", getItemByBarcode);

export default router;
