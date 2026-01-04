import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
  itemId: String,
  itemName: String,
  itemType: String,
  barcode: String,
  sizeOrSource: String,
  gradeLevel: String,
  quantity: Number,
});

const checkoutSchema = new mongoose.Schema(
  {
    checkoutId: { type: String, unique: true, required: true }, // ✅ custom ID
    transactionNo: { type: String, unique: true, required: true },
    receiptNo: { type: String, required: true },
    issuedBy: { type: String, required: true },
    items: [itemSchema],
  },
  { timestamps: true }
);

export default mongoose.model("Checkout", checkoutSchema);
