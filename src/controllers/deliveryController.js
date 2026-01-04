import Delivery from "../models/deliveryModel.js";
import Inventory from "../models/inventoryModel.js";

// 🧮 Generate unique delivery ID (incrementing)
const generateDeliveryId = async () => {
  const last = await Delivery.findOne().sort({ createdAt: -1 });
  if (!last) return "DEL-000001";

  const lastId = parseInt(last.deliveryId.split("-")[1]);
  const newId = (lastId + 1).toString().padStart(6, "0");
  return `DEL-${newId}`;
};

// ➕ Add new delivery
export const addDelivery = async (req, res) => {
  try {
    const { deliveryNumber, supplier, receivedBy, items } = req.body;
    if (!deliveryNumber || !receivedBy || !items || items.length === 0) {
      return res.status(400).json({
        message: "Delivery number, receivedBy, and items are required.",
      });
    }

    // ✅ Generate custom deliveryId
    const deliveryId = await generateDeliveryId();

    // ✅ Create delivery record
    const delivery = new Delivery({
      deliveryId,
      deliveryNumber,
      supplier,
      receivedBy,
      dateReceived: new Date(),
      items: items.map((i) => ({
        itemId: i.itemId,
        itemName: i.itemName,
        itemType: i.itemType,
        sizeOrSource: i.sizeOrSource || "", // ✅ store it
        gradeLevel: i.gradeLevel || "",   // ✅ store it
        barcode: i.barcode || [],
        quantity: i.quantity,
      })),
    });

    await delivery.save();

    // ✅ Update inventory quantities
    for (const item of items) {
      const existing = await Inventory.findOne({ itemId: item.itemId });
      if (existing) {
        existing.quantity = (existing.quantity || 0) + item.quantity;
        await existing.save();
      }
    }

    res.status(201).json({
      message: "✅ Delivery added successfully.",
      delivery: {
        deliveryId: delivery.deliveryId,
        deliveryNumber: delivery.deliveryNumber,
        supplier: delivery.supplier,
        receivedBy: delivery.receivedBy,
        dateReceived: delivery.dateReceived,
        items: delivery.items,
      },
    });
  } catch (error) {
    console.error("❌ Error adding delivery:", error);
    res.status(500).json({ message: "Server error while adding delivery." });
  }
};

// 📋 Get all deliveries
export const getDeliveries = async (req, res) => {
  try {
    const deliveries = await Delivery.find()
      .sort({ createdAt: -1 })
      .select("-_id -__v"); // hide Mongo _id and version
    res.status(200).json(deliveries);
  } catch (error) {
    console.error("❌ Error fetching deliveries:", error);
    res.status(500).json({ message: "Server error fetching deliveries." });
  }
};

// 🔍 Get delivery by ID
export const getDeliveryById = async (req, res) => {
  try {
    const delivery = await Delivery.findOne({
      deliveryId: req.params.id,
    }).select("-_id -__v");
    if (!delivery)
      return res.status(404).json({ message: "Delivery not found." });
    res.status(200).json(delivery);
  } catch (error) {
    console.error("❌ Error fetching delivery:", error);
    res.status(500).json({ message: "Server error fetching delivery." });
  }
};
