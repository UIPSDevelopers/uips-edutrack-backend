import mongoose from "mongoose";

const InventorySchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true, unique: true }, // 👈 added
    itemType: { type: String, required: true },
    itemName: { type: String, required: true },
    sizeOrSource: { type: String },
    gradeLevel: { type: String },
    barcode: { type: String, required: true, unique: true },
    quantity: { type: Number, default: 0 }, // 
    addedBy: { type: String, required: true },
    barcodeImage: { type: String },
  },
  { timestamps: true }
);

export default mongoose.model("Inventory", InventorySchema);
