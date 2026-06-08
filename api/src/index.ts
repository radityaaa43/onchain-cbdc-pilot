import Fastify from "fastify";
import { config } from "./config";
import { apiKeyAuth } from "./middleware/auth";
import { healthRoute } from "./routes/health";
import { cbdcRoute } from "./routes/cbdc";
import { bondsRoute } from "./routes/bonds";
import { dvpRoute } from "./routes/dvp";

const app = Fastify({ logger: true });

// Auth on all non-health routes
app.addHook("preHandler", async (req, reply) => {
  if (req.url === "/health") return;
  await apiKeyAuth(req, reply);
});

app.register(healthRoute);
app.register(cbdcRoute);
app.register(bondsRoute);
app.register(dvpRoute);

app.listen({ port: config.port, host: "0.0.0.0" }, (err) => {
  if (err) { app.log.error(err); process.exit(1); }
});
