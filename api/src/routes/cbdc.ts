import { FastifyInstance } from "fastify";
import { z } from "zod";
import { tx, call } from "../pente";
import { config } from "../config";

const IssueBody = z.object({ to: z.string(), amount: z.number().positive() });
const TransferBody = z.object({ from: z.string(), to: z.string(), amount: z.number().positive() });

export async function cbdcRoute(app: FastifyInstance): Promise<void> {
  app.post("/cbdc/issue", async (req, reply) => {
    const parsed = IssueBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.cbdcIssuance, "issue", parsed.data);
    return { ok: true };
  });

  app.post("/cbdc/transfer", async (req, reply) => {
    const parsed = TransferBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.cbdcTransfer, "transfer", parsed.data);
    return { ok: true };
  });

  app.get<{ Params: { address: string } }>("/cbdc/balance/:address", async (req) => {
    const res = await call(config.contracts.cbToken, "balanceOf", { account: req.params.address });
    return { address: req.params.address, balance: String(res["0"]) };
  });

  app.get("/cbdc/issued-total", async () => {
    const res = await call(config.contracts.cbdcIssuance, "getIssuedTotal");
    return { total: String(res["0"]) };
  });
}
