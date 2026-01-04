import Delivery from "../models/deliveryModel.js";
import Checkout from "../models/checkoutModel.js";
import Inventory from "../models/inventoryModel.js";
import Return from "../models/returnModel.js";

// 📦 Delivery Report
export const getDeliveryReport = async (req, res) => {
  try {
    const { from, to, page = 1, limit = 20, all } = req.query;
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
          gradeLevel: item.gradeLevel || "-",
          barcode: item.barcode?.length ? item.barcode.join(", ") : "-",
          quantity: item.quantity,
          date: new Date(d.dateReceived).toLocaleDateString(),
          receivedBy: d.receivedBy,
        });
      });
    });

    // 🔹 Apply backend pagination on flattened rows
    const paged = paginateArray(formatted, page, limit, all === "true");

    res.status(200).json(paged);
  } catch (error) {
    console.error("❌ Error generating delivery report:", error);
    res
      .status(500)
      .json({ message: "Server error generating delivery report." });
  }
};

// Simple array pagination helper
const paginateArray = (array, page = 1, limit = 20, allFlag = false) => {
  const isAll = allFlag || !limit || Number(limit) === 0;

  const total = array.length;
  if (isAll) {
    return {
      items: array,
      total,
      page: 1,
      pages: 1,
    };
  }

  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Number(limit) || 20);

  const pages = Math.max(1, Math.ceil(total / safeLimit));
  const start = (safePage - 1) * safeLimit;
  const end = start + safeLimit;

  return {
    items: array.slice(start, end),
    total,
    page: safePage,
    pages,
  };
};

// 🔁 Returns Report
export const getReturnsReport = async (req, res) => {
  try {
    const { from, to, page = 1, limit = 20, all } = req.query;
    const filter = {};

    if (from && to) {
      filter.dateReturned = {
        $gte: new Date(from),
        $lte: new Date(to),
      };
    }

    const records = await Return.find(filter)
      .sort({ dateReturned: -1 })
      .select(
        "returnNumber receiptRef transactionRef returnedBy dateReturned items"
      );

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
          gradeLevel: item.gradeLevel || "-",
          quantity: item.quantity,
          condition: item.condition || "Good",
          remarks: item.remarks || "",
          date: new Date(r.dateReturned).toLocaleDateString(),
          returnedBy: r.returnedBy,
        });
      });
    });

    const paged = paginateArray(formatted, page, limit, all === "true");

    res.status(200).json(paged);
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
    const { from, to, page = 1, limit = 20, all } = req.query;
    const filter = {};

    if (from && to) {
      filter.createdAt = {
        $gte: new Date(from),
        $lte: new Date(to),
      };
    }

    const checkouts = await Checkout.find(filter)
      .sort({ createdAt: -1 })
      .select("transactionNo receiptNo issuedBy createdAt items");

    const formatted = [];
    checkouts.forEach((c) => {
      c.items.forEach((item) => {
        formatted.push({
          transactionNo: c.transactionNo,
          receiptNo: c.receiptNo,
          itemName: item.itemName || "-",
          sizeOrSource: item.sizeOrSource || "-",
          gradeLevel: item.gradeLevel || "-",
          barcode: item.barcode || "-",
          quantity: item.quantity || 0,
          date: new Date(c.createdAt).toLocaleDateString(),
          receivedBy: c.issuedBy || "-", // consistent
        });
      });
    });

    const paged = paginateArray(formatted, page, limit, all === "true");

    res.status(200).json(paged);
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
    const { page = 1, limit = 20, all } = req.query;

    const items = await Inventory.find()
      .sort({ itemName: 1 })
      .select("-_id -__v");

    const paged = paginateArray(items, page, limit, all === "true");

    res.status(200).json(paged);
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
    const { from, to, page = 1, limit = 20, all } = req.query;
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

    const inventory = await Inventory.find().select(
      "itemId itemName sizeOrSource gradeLevel quantity"
    );

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
        gradeLevel: inv.gradeLevel || "-",
        totalDelivered,
        totalReturned,
        totalCheckedOut,
        netChange,
        totalStockAsOfDate: netChange,
        currentStock: inv.quantity,
      };
    });

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

    // 🔹 Backend pagination on summary rows
    const paged = paginateArray(summary, page, limit, all === "true");

    res.status(200).json({
      dateRange: {
        from: fromDate ? fromDate.toISOString() : "Beginning",
        to: toDate.toISOString(),
      },
      summary: paged.items,
      totals,
      total: paged.total,
      page: paged.page,
      pages: paged.pages,
    });
  } catch (error) {
    console.error("❌ Error generating summary report:", error);
    res
      .status(500)
      .json({ message: "Server error generating summary report." });
  }
};
