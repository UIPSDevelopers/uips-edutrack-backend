import express from "express";
import {
  addItem,
  getAllItems,
  updateItem,
  deleteItem,
  getItemByBarcode,
  bulkAddItems, // 🆕
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

// ➕ Add new inventory item (single)
// InventoryStaff CAN add (only edit/delete are blocked), plus IT, Accounts, InventoryAdmin
router.post(
  "/add",
  verifyToken,
  authorizeRole("IT", "InventoryStaff", "Accounts", "InventoryAdmin"),
  addItem
);

// 🧾 BULK IMPORT items
// Same roles as add
router.post(
  "/bulk-add",
  verifyToken,
  authorizeRole("IT", "InventoryStaff", "Accounts", "InventoryAdmin"),
  bulkAddItems
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
