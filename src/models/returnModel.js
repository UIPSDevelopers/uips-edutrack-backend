import mongoose from "mongoose";

// 🧩 Item Schema for each returned item
const itemSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  itemName: { type: String, required: true },
  sizeOrSource: { type: String, default: "-" }, // ✅ added to show in Returns.jsx
  quantity: { type: Number, required: true },
  condition: { type: String, enum: ["Good", "Damaged"], default: "Good" },
  remarks: { type: String, default: "" },
});

// 🧾 Return Schema
const returnSchema = new mongoose.Schema(
  {
    // 🧾 Auto-generated return number like "R-20251102-000001"
    returnNumber: { type: String, unique: true, required: true },

    // 🔗 Reference to the original receipt / checkout
    receiptRef: { type: String, required: true },

    // 🔗 Optional reference to transaction number (if you want both)
    transactionRef: { type: String },

    // 👤 Who made the return
    returnedBy: { type: String, required: true },

    // 📝 Notes / reason for return
    reason: { type: String, default: "" },

    // 📦 Returned items list
    items: [itemSchema],

    // 📅 Return date
    dateReturned: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Return", returnSchema);
