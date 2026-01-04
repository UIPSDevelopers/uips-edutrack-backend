import mongoose from "mongoose";
import Checkout from "../models/checkoutModel.js";
import Inventory from "../models/inventoryModel.js";

// 🧮 Generate unique checkout ID (incrementing)
const generateCheckoutId = async (session) => {
  const last = await Checkout.findOne()
    .sort({ createdAt: -1 })
    .session(session);
  if (!last) return "CH-000001";

  const lastId = parseInt(last.checkoutId.split("-")[1]);
  const newId = (lastId + 1).toString().padStart(6, "0");
  return `CH-${newId}`;
};

// ➕ Add new checkout (with rollback safety)
export const addCheckout = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { receiptNo, issuedBy, items } = req.body;

    // 🔹 Basic validation
    if (!receiptNo || !issuedBy || !items || items.length === 0) {
      throw new Error("Receipt number, issuedBy, and items are required.");
    }

    // ✅ Generate custom IDs
    const checkoutId = await generateCheckoutId(session);
    const transactionCount = await Checkout.countDocuments().session(session);
    const nextNum = String(transactionCount + 1).padStart(6, "0");
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const transactionNo = `TXN-${date}-${nextNum}`;

    const enrichedItems = [];

    // ✅ Validate & deduct stock
    for (const item of items) {
      const existing = await Inventory.findOne({ itemId: item.itemId }).session(
        session
      );

      if (!existing) {
        throw new Error(
          `❌ Item ${item.itemName} (ID: ${item.itemId}) not found in inventory.`
        );
      }

      if ((existing.quantity || 0) < item.quantity) {
        throw new Error(
          `⚠️ Not enough stock for ${item.itemName}. Available: ${existing.quantity}, requested: ${item.quantity}.`
        );
      }

      // Deduct quantity
      existing.quantity = (existing.quantity || 0) - item.quantity;
      await existing.save({ session });

      // ✅ Enrich item details from inventory
      enrichedItems.push({
        itemId: existing.itemId,
        itemName: existing.itemName,
        itemType: existing.itemType || "-",
        sizeOrSource: existing.sizeOrSource || "-",
        gradeLevel: existing.gradeLevel || "-",
        barcode: existing.barcode || "-",
        quantity: item.quantity,
      });
    }

    // ✅ Save checkout record
    const checkout = new Checkout({
      checkoutId,
      transactionNo,
      receiptNo,
      issuedBy,
      items: enrichedItems, // enriched inventory items
    });

    await checkout.save({ session });

    // ✅ Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "✅ Checkout recorded successfully.",
      checkoutId,
      transactionNo,
    });
  } catch (error) {
    console.error("❌ Error adding checkout:", error.message);
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({
      message: error.message || "Server error while adding checkout.",
    });
  }
};

// 📋 Get all checkouts
export const getCheckouts = async (req, res) => {
  try {
    const checkouts = await Checkout.find()
      .sort({ createdAt: -1 })
      .select("-_id -__v");
    res.status(200).json(checkouts);
  } catch (error) {
    console.error("❌ Error fetching checkouts:", error);
    res.status(500).json({ message: "Server error fetching checkouts." });
  }
};

// 🔍 Get checkout by receipt number or checkoutId
export const getCheckoutById = async (req, res) => {
  try {
    const ref = req.params.id.trim();
    console.log("🧾 Searching checkout by receipt:", ref);

    const checkout = await Checkout.findOne({
      $or: [
        { receiptNo: ref },
        { checkoutId: ref },
        { transactionNo: ref },
      ],
    }).select("-_id -__v");

    if (!checkout) {
      console.log("❌ No checkout found for:", ref);
      return res.status(404).json({ message: "Checkout not found." });
    }

    console.log("✅ Checkout found:", checkout.receiptNo);
    res.status(200).json(checkout);
  } catch (error) {
    console.error("❌ Error fetching checkout:", error);
    res.status(500).json({ message: "Server error fetching checkout." });
  }
};


