import { FastifyInstance } from "fastify";
import { z } from "zod";
import { tx, call } from "../pente";

const GrantRoleBody = z.object({
  contract: z.string(),
  role:     z.string(),
  account:  z.string(),
});

export async function adminRoute(app: FastifyInstance): Promise<void> {
  app.post("/admin/grant-role", async (req, reply) => {
    const parsed = GrantRoleBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(parsed.data.contract, "grantRole", { role: parsed.data.role, account: parsed.data.account });
    return { ok: true };
  });

  app.post("/admin/revoke-role", async (req, reply) => {
    const parsed = GrantRoleBody.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    await tx(parsed.data.contract, "revokeRole", { role: parsed.data.role, account: parsed.data.account });
    return { ok: true };
  });

  app.get<{ Querystring: { contract: string; role: string; account: string } }>(
    "/admin/has-role", async (req, reply) => {
      const { contract, role, account } = req.query;
      if (!contract || !role || !account)
        return reply.code(400).send({ error: "contract, role, account required" });
      const res = await call(contract, "hasRole", { role, account });
      return { contract, role, account, hasRole: Boolean(res["0"]) };
    }
  );
}
