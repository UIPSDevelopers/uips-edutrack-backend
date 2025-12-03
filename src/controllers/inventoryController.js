import Inventory from "../models/inventoryModel.js";
import Counter from "../models/counter.js";
import Delivery from "../models/deliveryModel.js"; // 🆕 make sure path is correct

const generateItemId = async () => {
  const counter = await Counter.findOneAndUpdate(
    { name: "inventory" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true } // create if not exists
  );

  const nextNumber = counter.seq;
  return `ITEM-${nextNumber.toString().padStart(6, "0")}`;
};

const generateDeliveryId = async () => {
  const counter = await Counter.findOneAndUpdate(
    { name: "delivery" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const nextNumber = counter.seq;
  return `DEL-${nextNumber.toString().padStart(6, "0")}`;
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

// ➕ Single add item
export const addItem = async (req, res) => {
  try {
    const { itemType, itemName, sizeOrSource, barcode, addedBy } = req.body;

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
      // quantity stays default: 0
    });

    res.status(201).json({ message: "Item added successfully", item: newItem });
  } catch (error) {
    console.error("Error adding item:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// 🚚 BULK ADD ITEMS (with quantity + optional Initial Delivery)
// POST /api/inventory/bulk-add
// body: {
//   items: [ { itemType, itemName, sizeOrSource, barcode, quantity?, addedBy }, ... ],
//   createInitialDelivery?: boolean,
//   deliveryNumber?: string
// }
export const bulkAddItems = async (req, res) => {
  try {
    const { items, createInitialDelivery, deliveryNumber } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res
        .status(400)
        .json({ message: "No items provided for bulk insert." });
    }

    // Clean / normalize input
    const cleaned = items.map((item, index) => ({
      index, // keep original index for error reporting (for frontend)
      itemType: item.itemType?.toString().trim() || "",
      itemName: item.itemName?.toString().trim() || "",
      sizeOrSource: item.sizeOrSource?.toString().trim() || "",
      barcode: item.barcode?.toString().trim() || "",
      quantity: Number(item.quantity ?? 0) || 0, // 🆕 quantity support
      addedBy: item.addedBy?.toString().trim() || "Unknown User",
    }));

    const failedRows = [];
    const validItems = [];
    const seenBarcodes = new Set();

    // Basic validation + in-file duplicate check
    for (const item of cleaned) {
      if (!item.itemType || !item.itemName || !item.barcode) {
        failedRows.push({
          index: item.index,
          reason: "Missing required fields (itemType, itemName, barcode).",
        });
        continue;
      }

      if (seenBarcodes.has(item.barcode)) {
        failedRows.push({
          index: item.index,
          reason: `Duplicate barcode in file: ${item.barcode}`,
        });
        continue;
      }

      seenBarcodes.add(item.barcode);
      validItems.push(item);
    }

    if (!validItems.length) {
      return res.status(400).json({
        message: "No valid items to import after validation.",
        failedRows,
      });
    }

    // Check against existing barcodes in DB
    const barcodes = validItems.map((i) => i.barcode);
    const existing = await Inventory.find({
      barcode: { $in: barcodes },
    }).select("barcode");
    const existingSet = new Set(existing.map((e) => e.barcode));

    const docsToInsert = [];

    for (const item of validItems) {
      if (existingSet.has(item.barcode)) {
        failedRows.push({
          index: item.index,
          reason: `Barcode already exists in system: ${item.barcode}`,
        });
        continue;
      }

      const itemId = await generateItemId();

      docsToInsert.push({
        itemId,
        itemType: item.itemType,
        itemName: item.itemName,
        sizeOrSource: item.sizeOrSource,
        barcode: item.barcode,
        addedBy: item.addedBy,
        quantity: item.quantity, // 🆕 use quantity from file (initial stock)
      });
    }

    if (!docsToInsert.length) {
      return res.status(400).json({
        message: "All rows failed validation / duplicate checks.",
        failedRows,
      });
    }

    // Insert (unordered so it doesn't stop on first error if any race on unique indexes)
    const inserted = await Inventory.insertMany(docsToInsert, {
      ordered: false,
    });

    const successCount = inserted.length;
    const total = items.length;

    // 🧾 Optionally create an Initial Delivery record (but don't break if this fails)
    let deliveryInfo = null;

    if (createInitialDelivery && inserted.length > 0) {
      try {
        const newDeliveryId = await generateDeliveryId();
        const receivedBy = inserted[0].addedBy || "System (Bulk Import)";

        const deliveryDoc = await Delivery.create({
          deliveryId: newDeliveryId,
          deliveryNumber: (deliveryNumber || "INITIAL-STOCK").toString().trim(),
          supplier: "Initial Inventory Import",
          receivedBy,
          dateReceived: new Date(),
          items: inserted.map((it) => ({
            itemId: it.itemId,
            itemName: it.itemName,
            itemType: it.itemType,
            sizeOrSource: it.sizeOrSource || "",
            barcode: [it.barcode], // your Delivery model uses array
            quantity: it.quantity || 0,
          })),
        });

        deliveryInfo = {
          deliveryId: deliveryDoc.deliveryId,
          deliveryNumber: deliveryDoc.deliveryNumber,
        };
      } catch (err) {
        console.error(
          "❌ Error creating initial Delivery from bulkAddItems:",
          err
        );
        // don't fail the whole bulk insert because of delivery failure
        deliveryInfo = {
          error: true,
          message: err.message || "Failed to create initial delivery record.",
        };
      }
    }

    return res.status(200).json({
      message:
        failedRows.length === 0
          ? "Bulk insert successful."
          : "Bulk insert completed with some errors.",
      count: successCount,
      failedRows, // [{ index, reason }]
      total,
      delivery: deliveryInfo, // 🆕 more detailed info for frontend
    });
  } catch (error) {
    console.error("Error in bulkAddItems:", error);
    res.status(500).json({
      message: "Server error during bulk insert.",
      error: error.message,
    });
  }
};
