import { FastifyInstance } from "fastify";
import { z } from "zod";
import { tx, call } from "../pente";

const Addr = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const B32  = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const GrantRoleBody = z.object({
  contract: Addr,
  role:     B32,
  account:  Addr,
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
      if (!/^0x[0-9a-fA-F]{40}$/.test(contract) || !/^0x[0-9a-fA-F]{64}$/.test(role) || !/^0x[0-9a-fA-F]{40}$/.test(account))
        return reply.code(400).send({ error: "invalid address or role format" });
      const res = await call(contract, "hasRole", { role, account });
      return { contract, role, account, hasRole: Boolean(res["0"]) };
    }
  );
}
