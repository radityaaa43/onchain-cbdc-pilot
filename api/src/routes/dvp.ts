import { FastifyInstance } from "fastify";
import { ethers } from "ethers";
import { z } from "zod";
import { tx, txWithLogs, call } from "../pente";
import { config } from "../config";

const STATE_MAP: Record<string, string> = {
  PRIMARY:   ethers.id("PRIMARY"),
  SECONDARY: ethers.id("SECONDARY"),
};

const InitiateBody = z.object({
  bondId:     z.string(),
  bondSeller: z.string(),
  bondBuyer:  z.string(),
  bondAmount: z.number().positive(),
  fromState:  z.enum(["PRIMARY", "SECONDARY"]),
  toState:    z.enum(["PRIMARY", "SECONDARY"]),
  cbdcPayer:  z.string(),
  cbdcPayee:  z.string(),
  cbdcAmount: z.number().positive(),
  model:      z.number().int().min(0).max(2),
});

const ReasonBody = z.object({ reason: z.string() });

export async function dvpRoute(app: FastifyInstance): Promise<void> {
  app.post("/dvp/initiate", async (req, reply) => {
    const parsed = InitiateBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { fromState, toState, ...rest } = parsed.data;
    const { logs } = await txWithLogs(config.contracts.dvp, "initiateDVP", {
      ...rest,
      fromState: STATE_MAP[fromState],
      toState:   STATE_MAP[toState],
    });
    if (logs.length === 0) return reply.code(500).send({ error: "No logs from initiateDVP" });
    const settlementId = logs[0]?.topics?.[1];
    if (!settlementId) return reply.code(500).send({ error: "Invalid log format from initiateDVP" });
    return { settlementId };
  });

  app.post<{ Params: { settlementId: string } }>("/dvp/:settlementId/confirm", async (req) => {
    await tx(config.contracts.dvp, "confirmDVP", { settlementId: req.params.settlementId });
    return { ok: true };
  });

  app.post<{ Params: { settlementId: string } }>("/dvp/:settlementId/fail", async (req, reply) => {
    const parsed = ReasonBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.dvp, "failDVP", {
      settlementId: req.params.settlementId,
      reason: parsed.data.reason,
    });
    return { ok: true };
  });

  app.post<{ Params: { settlementId: string } }>("/dvp/:settlementId/cancel", async (req, reply) => {
    const parsed = ReasonBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(config.contracts.dvp, "cancelDVP", {
      settlementId: req.params.settlementId,
      reason: parsed.data.reason,
    });
    return { ok: true };
  });

  app.get<{ Params: { settlementId: string } }>("/dvp/:settlementId/status", async (req) => {
    const res = await call(config.contracts.dvp, "getDVPStatus", {
      settlementId: req.params.settlementId,
    });
    return { settlement: res["s"] ?? res["0"] };
  });
}
