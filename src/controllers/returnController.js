import mongoose from "mongoose";
import Return from "../models/returnModel.js";
import Checkout from "../models/checkoutModel.js";
import Inventory from "../models/inventoryModel.js";

export const addReturn = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { receiptRef, returnedBy, reason, items } = req.body;

    if (!receiptRef || !returnedBy || !items?.length)
      throw new Error("Receipt number, returnedBy, and items are required.");

    // ✅ Find the checkout
    const checkout = await Checkout.findOne({ receiptNo: receiptRef }).session(
      session
    );
    if (!checkout)
      throw new Error(`Checkout with receipt ${receiptRef} not found.`);

    // ✅ Find all past returns for the same receipt
    const pastReturns = await Return.find({ receiptRef }).session(session);

    // 🧮 Build a map of how many were already returned
    const returnedCounts = {};
    pastReturns.forEach((r) =>
      r.items.forEach((i) => {
        returnedCounts[i.itemId] = (returnedCounts[i.itemId] || 0) + i.quantity;
      })
    );

    const enrichedItems = [];

    // ✅ Validate each item’s quantity against checkout + past returns
    for (const item of items) {
      const checkoutItem = checkout.items.find((c) => c.itemId === item.itemId);
      if (!checkoutItem)
        throw new Error(`Item ${item.itemName} not found in checkout record.`);

      const alreadyReturned = returnedCounts[item.itemId] || 0;
      const newTotal = alreadyReturned + item.quantity;

      if (newTotal > checkoutItem.quantity) {
        throw new Error(
          `${item.itemName}: trying to return ${newTotal} but only ${checkoutItem.quantity} were issued.`
        );
      }

      // ✅ Update inventory stock
      const inv = await Inventory.findOne({ itemId: item.itemId }).session(
        session
      );
      if (inv) {
        inv.quantity += item.quantity;
        await inv.save({ session });
      }

      // ✅ Include sizeOrSource for display in Returns.jsx
      enrichedItems.push({
        itemId: item.itemId,
        itemName: item.itemName,
        sizeOrSource: checkoutItem.sizeOrSource || "-",
        gradeLevel: checkoutItem.gradeLevel || "-",
        quantity: item.quantity,
        condition: item.condition,
        remarks: item.remarks || "",
      });
    }

    // 🧾 Generate Return Number
    const count = await Return.countDocuments().session(session);
    const next = String(count + 1).padStart(6, "0");
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const returnNumber = `R-${date}-${next}`;

    // ✅ Save Return record
    const newReturn = new Return({
      returnNumber,
      receiptRef,
      returnedBy,
      reason,
      items: enrichedItems,
      dateReturned: new Date(),
    });

    await newReturn.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "✅ Return recorded successfully.",
      returnNumber,
    });
  } catch (err) {
    console.error("❌ Return error:", err);
    await session.abortTransaction();
    session.endSession();
    res.status(400).json({ message: err.message || "Return process failed." });
  }
};

/* ✅ GET ALL RETURNS (for Returns.jsx list) */
export const getReturns = async (req, res) => {
  try {
    const records = await Return.find().sort({ createdAt: -1 });
    res.status(200).json(records);
  } catch (err) {
    console.error("❌ Error fetching returns:", err);
    res.status(500).json({ message: "Server error fetching returns." });
  }
};

/* ✅ GET SINGLE RETURN */
export const getReturnById = async (req, res) => {
  try {
    const record = await Return.findOne({ returnNumber: req.params.id });
    if (!record) return res.status(404).json({ message: "Return not found" });
    res.status(200).json(record);
  } catch (err) {
    console.error("Error fetching return:", err);
    res.status(500).json({ message: "Server error fetching return" });
  }
};
