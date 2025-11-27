import Delivery from "../models/deliveryModel.js";
import Checkout from "../models/checkoutModel.js";
import Inventory from "../models/inventoryModel.js";
import Return from "../models/returnModel.js";

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

// 🔁 Returns Report
export const getReturnsReport = async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = {};

    // 🔹 Filter by date range (use dateReturned to be consistent with your schema)
    if (from && to) {
      filter.dateReturned = {
        $gte: new Date(from),
        $lte: new Date(to),
      };
    }

    // 🔹 Fetch all returns within range
    const records = await Return.find(filter)
      .sort({ dateReturned: -1 })
      .select(
        "returnNumber receiptRef transactionRef returnedBy dateReturned items"
      );

    // 🔹 Flatten items for table view (same style as other reports)
    const formatted = [];
    records.forEach((r) => {
      r.items.forEach((item) => {
        formatted.push({
          returnNumber: r.returnNumber,
          receiptRef: r.receiptRef,
          transactionRef: r.transactionRef || "-",
          itemId: item.itemId,
          itemName: item.itemName,
          sizeOrSource: item.sizeOrSource || "-",
          quantity: item.quantity,
          condition: item.condition || "Good",
          remarks: item.remarks || "",
          date: new Date(r.dateReturned).toLocaleDateString(),
          returnedBy: r.returnedBy,
        });
      });
    });

    res.status(200).json(formatted);
  } catch (error) {
    console.error("❌ Error generating returns report:", error);
    res
      .status(500)
      .json({ message: "Server error generating returns report." });
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

// 🧮 Summary Report (with total stock for date range, including returns)
export const getSummaryReport = async (req, res) => {
  try {
    const { from, to } = req.query;
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : new Date();
    toDate.setHours(23, 59, 59, 999);

    // 📦 Deliveries (stock-in)
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

    // 📤 Checkouts (stock-out)
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

    // 🔁 Returns (stock-in)
    const returnsAgg = await Return.aggregate([
      {
        $match: fromDate
          ? { dateReturned: { $gte: fromDate, $lte: toDate } }
          : { dateReturned: { $lte: toDate } },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.itemId",
          totalReturned: { $sum: "$items.quantity" },
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
      const returned = returnsAgg.find((r) => r._id === inv.itemId);

      const totalDelivered = delivery ? delivery.totalDelivered : 0;
      const totalCheckedOut = checkout ? checkout.totalCheckedOut : 0;
      const totalReturned = returned ? returned.totalReturned : 0;

      const netChange = totalDelivered + totalReturned - totalCheckedOut;

      return {
        itemId: inv.itemId,
        itemName: inv.itemName,
        sizeOrSource: inv.sizeOrSource || "-",
        totalDelivered,
        totalReturned,
        totalCheckedOut,
        netChange,
        totalStockAsOfDate: netChange,
        currentStock: inv.quantity,
      };
    });

    // 🧮 Grand total (bottom line)
    const totals = summary.reduce(
      (acc, cur) => {
        acc.totalDelivered += cur.totalDelivered;
        acc.totalReturned += cur.totalReturned;
        acc.totalCheckedOut += cur.totalCheckedOut;
        acc.totalStockAsOfDate += cur.totalStockAsOfDate;
        return acc;
      },
      {
        totalDelivered: 0,
        totalReturned: 0,
        totalCheckedOut: 0,
        totalStockAsOfDate: 0,
      }
    );

    res.status(200).json({
      dateRange: {
        from: fromDate ? fromDate.toISOString() : "Beginning",
        to: toDate.toISOString(),
      },
      summary,
      totals,
    });
  } catch (error) {
    console.error("❌ Error generating summary report:", error);
    res
      .status(500)
      .json({ message: "Server error generating summary report." });
  }
};
