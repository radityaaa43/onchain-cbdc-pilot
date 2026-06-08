import Fastify from "fastify";
import { config } from "./config";
import { apiKeyAuth } from "./middleware/auth";
import { healthRoute } from "./routes/health";
import { cbdcRoute } from "./routes/cbdc";
import { cbdcExtendedRoute } from "./routes/cbdc-extended";
import { bondsRoute } from "./routes/bonds";
import { bondLifecycleRoute } from "./routes/bond-lifecycle";
import { bondAdvancedRoute } from "./routes/bond-advanced";
import { dvpRoute } from "./routes/dvp";
import { complianceRoute } from "./routes/compliance";
import { infrastructureRoute } from "./routes/infrastructure";

const app = Fastify({ logger: true });

app.addHook("preHandler", async (req, reply) => {
  if (req.url === "/health") return;
  await apiKeyAuth(req, reply);
});

app.register(healthRoute);
app.register(cbdcRoute);
app.register(cbdcExtendedRoute);
app.register(bondsRoute);
app.register(bondLifecycleRoute);
app.register(bondAdvancedRoute);
app.register(dvpRoute);
app.register(complianceRoute);
app.register(infrastructureRoute);

app.listen({ port: config.port, host: "0.0.0.0" }, (err) => {
  if (err) { app.log.error(err); process.exit(1); }
});
