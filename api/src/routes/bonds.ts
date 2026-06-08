import { FastifyInstance } from "fastify";
import { ethers } from "ethers";
import { z } from "zod";
import { tx, call } from "../pente";
import { config } from "../config";

const PRIMARY_STATE   = ethers.id("PRIMARY");
const SECONDARY_STATE = ethers.id("SECONDARY");
const STATE_MAP: Record<string, string> = { PRIMARY: PRIMARY_STATE, SECONDARY: SECONDARY_STATE };

const RegisterBody   = z.object({ maturityDate: z.number().positive() });
const IssueBody      = z.object({ investor: z.string(), amount: z.number().positive() });
const TransitionBody = z.object({
  holder:    z.string(),
  amount:    z.number().positive(),
  fromState: z.enum(["PRIMARY", "SECONDARY"]),
  toState:   z.enum(["PRIMARY", "SECONDARY"]),
});

export async function bondsRoute(app: FastifyInstance): Promise<void> {
  app.post("/bonds/register", async (req, reply) => {
    const parsed = RegisterBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.lifecycle, "registerBond", {
      bond: config.contracts.bondMetadata,
      maturityDate: parsed.data.maturityDate,
    });
    const res = await call(config.contracts.lifecycle, "getLastBondId");
    return { bondId: String(res["0"]) };
  });

  app.post<{ Params: { bondId: string } }>("/bonds/:bondId/issue", async (req, reply) => {
    const parsed = IssueBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.bondIssuance, "issueBond", {
      bondId: req.params.bondId,
      investor: parsed.data.investor,
      amount: parsed.data.amount,
    });
    return { ok: true };
  });

  app.post<{ Params: { bondId: string } }>("/bonds/:bondId/transition", async (req, reply) => {
    const parsed = TransitionBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const fromState = STATE_MAP[parsed.data.fromState];
    const toState   = STATE_MAP[parsed.data.toState];
    await tx(config.contracts.lifecycle, "transition", {
      bondId: req.params.bondId,
      holder: parsed.data.holder,
      amount: parsed.data.amount,
      fromState, toState,
      data: "0x",
    });
    return { ok: true };
  });

  app.get("/bonds/last-id", async () => {
    const res = await call(config.contracts.lifecycle, "getLastBondId");
    return { bondId: String(res["0"]) };
  });

  app.get<{ Params: { bondId: string }; Querystring: { state?: string; holder?: string } }>(
    "/bonds/:bondId/balance", async (req, reply) => {
      const { state = "PRIMARY", holder } = req.query;
      if (!holder) return reply.code(400).send({ error: "holder query param required" });
      const stateHash = STATE_MAP[state];
      if (!stateHash) return reply.code(400).send({ error: "state must be PRIMARY or SECONDARY" });
      const res = await call(config.contracts.fiToken, "balanceOfByBond", {
        bondId: req.params.bondId, state: stateHash, holder,
      });
      return { bondId: req.params.bondId, balance: String(res["0"]) };
    }
  );

  app.get<{ Params: { bondId: string } }>("/bonds/:bondId/matured", async (req) => {
    const res = await call(config.contracts.lifecycle, "isMatured", { bondId: req.params.bondId });
    return { bondId: req.params.bondId, matured: Boolean(res["0"]) };
  });
}
