import { FastifyRequest, FastifyReply } from "fastify";
import { config } from "../config";

export async function apiKeyAuth(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const key = req.headers["x-api-key"];
  if (key !== config.apiKey) {
    reply.code(401).send({ error: "Unauthorized" });
  }
}
