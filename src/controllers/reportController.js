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

    // 🔹 Filter by date range
    if (from && to) {
      filter.createdAt = {
        $gte: new Date(from),
        $lte: new Date(to),
      };
    }

    // 🔹 Fetch all checkouts within range
    const checkouts = await Checkout.find(filter)
      .sort({ createdAt: -1 })
      .select("transactionNo receiptNo issuedBy createdAt items");

    // 🔹 Flatten items to match delivery report format
    const formatted = [];
    checkouts.forEach((c) => {
      c.items.forEach((item) => {
        formatted.push({
          transactionNo: c.transactionNo,
          receiptNo: c.receiptNo,
          itemName: item.itemName || "-",
          sizeOrSource: item.sizeOrSource || "-",
          barcode: item.barcode || "-",
          quantity: item.quantity || 0,
          date: new Date(c.createdAt).toLocaleDateString(),
          receivedBy: c.issuedBy || "-", // ✅ consistent column naming
        });
      });
    });

    res.status(200).json(formatted);
  } catch (error) {
    console.error("❌ Error generating checkout report:", error);
    res
      .status(500)
      .json({ message: "Server error generating checkout report." });
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
    res
      .status(500)
      .json({ message: "Server error generating inventory report." });
  }
};

// 🧮 Summary Report (with total stock for date range)
export const getSummaryReport = async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : new Date();
    toDate.setHours(23, 59, 59, 999);

    // 📦 Deliveries (stock-in) within and before range
    const deliveryAgg = await Delivery.aggregate([
      {
        $match: fromDate
          ? { dateReceived: { $gte: fromDate, $lte: toDate } }
          : { dateReceived: { $lte: toDate } },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.itemId",
          totalDelivered: { $sum: "$items.quantity" },
        },
      },
    ]);

    // 📤 Checkouts (stock-out) within and before range
    const checkoutAgg = await Checkout.aggregate([
      {
        $match: fromDate
          ? { createdAt: { $gte: fromDate, $lte: toDate } }
          : { createdAt: { $lte: toDate } },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.itemId",
          totalCheckedOut: { $sum: "$items.quantity" },
        },
      },
    ]);

    // 🧾 Inventory reference
    const inventory = await Inventory.find().select(
      "itemId itemName sizeOrSource quantity"
    );

    // 🔄 Combine data
    const summary = inventory.map((inv) => {
      const delivery = deliveryAgg.find((d) => d._id === inv.itemId);
      const checkout = checkoutAgg.find((c) => c._id === inv.itemId);

      const totalDelivered = delivery ? delivery.totalDelivered : 0;
      const totalCheckedOut = checkout ? checkout.totalCheckedOut : 0;

      return {
        itemId: inv.itemId,
        itemName: inv.itemName,
        sizeOrSource: inv.sizeOrSource || "-",
        totalDelivered,
        totalCheckedOut,
        netChange: totalDelivered - totalCheckedOut,
        totalStockAsOfDate: totalDelivered - totalCheckedOut, // 🧮 stock as of that date
        currentStock: inv.quantity, // live today
      };
    });

    // 🧮 Grand total (bottom line)
    const totals = summary.reduce(
      (acc, cur) => {
        acc.totalDelivered += cur.totalDelivered;
        acc.totalCheckedOut += cur.totalCheckedOut;
        acc.totalStockAsOfDate += cur.totalStockAsOfDate;
        return acc;
      },
      { totalDelivered: 0, totalCheckedOut: 0, totalStockAsOfDate: 0 }
    );

    res.status(200).json({
      dateRange: {
        from: fromDate ? fromDate.toISOString() : "Beginning",
        to: toDate.toISOString(),
      },
      summary,
      totals, // 👈 easy for frontend to show totals row
    });
  } catch (error) {
    console.error("❌ Error generating summary report:", error);
    res
      .status(500)
      .json({ message: "Server error generating summary report." });
  }
};
