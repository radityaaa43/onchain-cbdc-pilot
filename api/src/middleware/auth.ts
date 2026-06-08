import * as crypto from "crypto";
import { FastifyRequest, FastifyReply } from "fastify";
import { config } from "../config";

export async function apiKeyAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const key = String(req.headers["x-api-key"] ?? "");
  let valid = false;
  try {
    valid = key.length === config.apiKey.length &&
      crypto.timingSafeEqual(Buffer.from(key), Buffer.from(config.apiKey));
  } catch {
    valid = false;
  }
  if (!valid) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }
}
