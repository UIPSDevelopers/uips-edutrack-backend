import Inventory from "../models/inventoryModel.js";
import Counter from "../models/counter.js";

const generateItemId = async () => {
  const counter = await Counter.findOneAndUpdate(
    { name: "inventory" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true } // create if not exists
  );

  const nextNumber = counter.seq;
  return `ITEM-${nextNumber.toString().padStart(6, "0")}`;
};

// 📦 Get all inventory items
export const getAllItems = async (req, res) => {
  try {
    const items = await Inventory.find().sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (error) {
    console.error("Error fetching items:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✏️ Update item
export const updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;

    const updated = await Inventory.findOneAndUpdate(
      { itemId: id },
      updatedData,
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Item not found." });
    }

    res
      .status(200)
      .json({ message: "Item updated successfully", item: updated });
  } catch (error) {
    console.error("Error updating item:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 🗑️ Delete item
export const deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Inventory.findOneAndDelete({ itemId: id });

    if (!deleted) {
      return res.status(404).json({ message: "Item not found." });
    }

    res.status(200).json({ message: "Item deleted successfully" });
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 🔍 Find item by barcode or serial number
export const getItemByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;
    const item = await Inventory.findOne({ barcode: barcode });

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.status(200).json({ item });
  } catch (error) {
    console.error("Error fetching item by barcode:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const addItem = async (req, res) => {
  try {
    const { itemType, itemName, sizeOrSource, barcode, addedBy } =
      req.body;

    if (!itemType || !itemName || !barcode || !addedBy) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const existing = await Inventory.findOne({ barcode });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Item with this barcode already exists." });
    }

    const itemId = await generateItemId();

    const newItem = await Inventory.create({
      itemId,
      itemType,
      itemName,
      sizeOrSource,
      barcode,
      addedBy,
    });

    res.status(201).json({ message: "Item added successfully", item: newItem });
  } catch (error) {
    console.error("Error adding item:", error);
    res.status(500).json({ message: "Server error" });
  }
};
