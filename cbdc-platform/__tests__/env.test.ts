import { describe, it, expect } from "vitest";
import { z } from "zod";

const schema = z.object({ APP_ROLE: z.enum(["operator", "participant"]) });

describe("env schema", () => {
  it("rejects an invalid APP_ROLE", () => {
    expect(() => schema.parse({ APP_ROLE: "nope" })).toThrow();
  });
  it("accepts operator", () => {
    expect(schema.parse({ APP_ROLE: "operator" }).APP_ROLE).toBe("operator");
  });
});
