// Set API_KEY before any imports
process.env.API_KEY = "test-key";

import Fastify from "fastify";
import { apiKeyAuth } from "../src/middleware/auth";

const app = Fastify();
app.addHook("preHandler", apiKeyAuth);
app.get("/test", async () => ({ ok: true }));

beforeAll(() => app.ready());
afterAll(() => app.close());

test("rejects missing API key", async () => {
  const res = await app.inject({ method: "GET", url: "/test" });
  expect(res.statusCode).toBe(401);
});

test("rejects wrong API key", async () => {
  const res = await app.inject({
    method: "GET", url: "/test",
    headers: { "x-api-key": "wrong" },
  });
  expect(res.statusCode).toBe(401);
});

test("allows correct API key", async () => {
  const res = await app.inject({
    method: "GET", url: "/test",
    headers: { "x-api-key": "test-key" },
  });
  expect(res.statusCode).toBe(200);
});
