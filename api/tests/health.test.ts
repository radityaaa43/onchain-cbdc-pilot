import Fastify from "fastify";
import { healthRoute } from "../src/routes/health";

const app = Fastify();
app.register(healthRoute);

beforeAll(() => app.ready());
afterAll(() => app.close());

test("GET /health returns 200", async () => {
  const res = await app.inject({ method: "GET", url: "/health" });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ status: "ok" });
});
