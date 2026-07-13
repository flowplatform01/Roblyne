import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import organizationsRouter from "./organizations";
import electionsRouter from "./elections";
import eventsRouter from "./events";
import campaignsRouter from "./campaigns";
import discoverRouter from "./discover";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(organizationsRouter);
router.use(electionsRouter);
router.use(eventsRouter);
router.use(campaignsRouter);
router.use(discoverRouter);
router.use(adminRouter);

export default router;
