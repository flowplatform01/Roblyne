import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import organizationsRouter from "./organizations";
import electionsRouter from "./elections";
import eventsRouter from "./events";
import campaignsRouter from "./campaigns";
import discoverRouter from "./discover";
import adminRouter from "./admin";
import financialRouter from "./financial";
import paymentsRouter from "./payments";
import uploadsRouter from "./uploads";
import shareRouter from "./share";
import seoRouter from "./seo";
import oauthRouter from "./oauth";
import passwordResetRouter from "./password-reset";
import legalRouter from "./legal";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(organizationsRouter);
router.use(electionsRouter);
router.use(eventsRouter);
router.use(campaignsRouter);
router.use(discoverRouter);
router.use(adminRouter);
router.use(financialRouter);
router.use(paymentsRouter);
router.use(uploadsRouter);
router.use(shareRouter);
router.use(seoRouter);
router.use(oauthRouter);
router.use(passwordResetRouter);
router.use(legalRouter);

export default router;
