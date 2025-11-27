import express from "express";
import {
  addItem,
  getAllItems,
  updateItem,
  deleteItem,
  getItemByBarcode,
} from "../controllers/inventoryController.js";

import { verifyToken } from "../middleware/authMiddleware.js";   // 🔐 adjust path if needed
import { authorizeRole } from "../middleware/authorizeRole.js"; // 🛂

const router = express.Router();

// 📦 Get all inventory items
// IT, InventoryStaff, Accounts, InventoryAdmin can VIEW
router.get(
  "/",
  verifyToken,
  authorizeRole("IT", "InventoryStaff", "Accounts", "InventoryAdmin"),
  getAllItems
);

// 🔍 Get item by barcode
// Same as above: all 4 roles can use this
router.get(
  "/barcode/:barcode",
  verifyToken,
  authorizeRole("IT", "InventoryStaff", "Accounts", "InventoryAdmin"),
  getItemByBarcode
);

// ➕ Add new inventory item
// InventoryStaff CAN add (only edit/delete are blocked), plus IT, Accounts, InventoryAdmin
router.post(
  "/add",
  verifyToken,
  authorizeRole("IT", "InventoryStaff", "Accounts", "InventoryAdmin"),
  addItem
);

// ✏️ Update inventory item
// ❌ InventoryStaff NOT allowed
router.put(
  "/:id",
  verifyToken,
  authorizeRole("IT", "Accounts", "InventoryAdmin"),
  updateItem
);

// 🗑️ Delete inventory item
// Only IT + InventoryAdmin
router.delete(
  "/:id",
  verifyToken,
  authorizeRole("IT", "InventoryAdmin"),
  deleteItem
);

export default router;
