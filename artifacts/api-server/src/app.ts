import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import pagesRouter from "./routes/pages";
import adminRouter from "./routes/admin";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use("/admin", adminRouter);
// The API artifact is previewed under /api in the workspace. Mirror the
// server-rendered pages there so preview links are testable without producing
// false 404s. The public deployment continues to use the root paths below.
app.use("/api", pagesRouter);
app.use("/", pagesRouter);

export default app;
