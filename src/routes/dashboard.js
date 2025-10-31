import express from "express";
import Inventory from "../models/inventoryModel.js";
import Delivery from "../models/deliveryModel.js";
import Checkout from "../models/checkoutModel.js";
import User from "../models/userModel.js";

const router = express.Router();

/**
 * GET /api/dashboard/summary
 * Dashboard main overview
 */
router.get("/summary", async (req, res) => {
  try {
    // 🧮 Run all queries in parallel
    const [
      totalItems,
      totalDeliveries,
      totalCheckouts,
      totalUsers,
      lowStockItems,
      categoryDistribution,
    ] = await Promise.all([
      Inventory.countDocuments(),
      Delivery.countDocuments(),
      Checkout.countDocuments(),
      User.countDocuments(),
      Inventory.find({ quantity: { $lt: 5 } })
        .select("itemId itemName quantity")
        .limit(10),
      Inventory.aggregate([
        { $group: { _id: "$itemType", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.json({
      totalItems,
      totalDeliveries,
      totalCheckouts,
      totalUsers,
      lowStockItems,
      categoryDistribution,
    });
  } catch (error) {
    console.error("❌ Dashboard summary error:", error);
    res.status(500).json({ message: "Server error loading dashboard summary" });
  }
});

/**
 * GET /api/dashboard/top-checkedout
 * Top 5 most checked-out items
 */
router.get("/top-checkedout", async (req, res) => {
  try {
    const topItems = await Checkout.aggregate([
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.itemName",
          totalCheckedOut: { $sum: "$items.quantity" },
        },
      },
      { $sort: { totalCheckedOut: -1 } },
      { $limit: 5 },
    ]);

    res.json(topItems);
  } catch (error) {
    console.error("❌ Error loading top checked-out items:", error);
    res.status(500).json({ message: "Error fetching top items" });
  }
});

/**
 * GET /api/dashboard/recent
 * 5 most recent deliveries or checkouts
 */
router.get("/recent", async (req, res) => {
  try {
    const [recentDeliveries, recentCheckouts] = await Promise.all([
      Delivery.find().sort({ createdAt: -1 }).limit(3),
      Checkout.find().sort({ createdAt: -1 }).limit(3),
    ]);

    const recent = [
      ...recentDeliveries.map((d) => ({
        user: d.receivedBy,
        action: "delivered",
        itemName: d.items?.[0]?.itemName || "Unknown",
        date: new Date(d.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      })),
      ...recentCheckouts.map((c) => ({
        user: c.checkedOutBy,
        action: "checked out",
        itemName: c.items?.[0]?.itemName || "Unknown",
        date: new Date(c.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      })),
    ].sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    res.json(recent.slice(0, 6));
  } catch (error) {
    console.error("❌ Error loading recent activity:", error);
    res.status(500).json({ message: "Error fetching recent activity" });
  }
});

export default router;
