import Delivery from "../models/deliveryModel.js";
import Checkout from "../models/checkoutModel.js";
import Inventory from "../models/inventoryModel.js";

// 📦 Delivery Report
export const getDeliveryReport = async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = {};

    if (from && to) {
      filter.dateReceived = {
        $gte: new Date(from),
        $lte: new Date(to),
      };
    }

    // 🔹 Fetch all deliveries within date range
    const deliveries = await Delivery.find(filter)
      .sort({ dateReceived: -1 })
      .select("deliveryNumber supplier receivedBy dateReceived items");

    // 🔹 Flatten items for table view
    const formatted = [];
    deliveries.forEach((d) => {
      d.items.forEach((item) => {
        formatted.push({
          deliveryNumber: d.deliveryNumber,
          supplier: d.supplier,
          itemName: item.itemName,
          sizeOrSource: item.sizeOrSource || "-",
          barcode: item.barcode?.length ? item.barcode.join(", ") : "-",
          quantity: item.quantity,
          date: new Date(d.dateReceived).toLocaleDateString(),
          receivedBy: d.receivedBy,
        });
      });
    });

    res.status(200).json(formatted);
  } catch (error) {
    console.error("❌ Error generating delivery report:", error);
    res
      .status(500)
      .json({ message: "Server error generating delivery report." });
  }
};


// 📤 Checkout Report
export const getCheckoutReport = async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = {};

    if (from && to) {
      filter.createdAt = {
        $gte: new Date(from),
        $lte: new Date(to),
      };
    }

    const checkouts = await Checkout.find(filter)
      .sort({ createdAt: -1 })
      .select("-_id -__v");

    res.status(200).json(checkouts);
  } catch (error) {
    console.error("❌ Error generating checkout report:", error);
    res.status(500).json({ message: "Server error generating checkout report." });
  }
};

// 📊 Current Inventory Report
export const getInventoryReport = async (req, res) => {
  try {
    const items = await Inventory.find()
      .sort({ itemName: 1 })
      .select("-_id -__v");
    res.status(200).json(items);
  } catch (error) {
    console.error("❌ Error generating inventory report:", error);
    res.status(500).json({ message: "Server error generating inventory report." });
  }
};

// 🧮 Summary Report (total stock in/out)
export const getSummaryReport = async (req, res) => {
  try {
    // Aggregate deliveries (stock-in)
    const deliveryAgg = await Delivery.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.itemId",
          totalDelivered: { $sum: "$items.quantity" },
        },
      },
    ]);

    // Aggregate checkouts (stock-out)
    const checkoutAgg = await Checkout.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.itemId",
          totalCheckedOut: { $sum: "$items.quantity" },
        },
      },
    ]);

    // Get inventory
    const inventory = await Inventory.find().select("itemId itemName quantity");

    // Combine all results
    const summary = inventory.map((inv) => {
      const delivery = deliveryAgg.find((d) => d._id === inv.itemId);
      const checkout = checkoutAgg.find((c) => c._id === inv.itemId);

      return {
        itemId: inv.itemId,
        itemName: inv.itemName,
        delivered: delivery ? delivery.totalDelivered : 0,
        checkedOut: checkout ? checkout.totalCheckedOut : 0,
        currentStock: inv.quantity,
      };
    });

    res.status(200).json(summary);
  } catch (error) {
    console.error("❌ Error generating summary report:", error);
    res.status(500).json({ message: "Server error generating summary report." });
  }
};
