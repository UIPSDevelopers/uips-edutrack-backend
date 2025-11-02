import express from "express";
import { addReturn, getReturns, getReturnById } from "../controllers/returnController.js";

const router = express.Router();

router.post("/", addReturn);
router.get("/", getReturns);
router.get("/:id", getReturnById);

export default router;
