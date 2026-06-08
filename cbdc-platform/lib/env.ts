import { z } from "zod";

const schema = z.object({
  APP_ROLE: z.enum(["operator", "participant"]),
  DLT_API_URL: z.string().url(),
  DLT_API_KEY: z.string().min(1),
  ORG_ID: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  CONTRACT_CBTOKEN: z.string().default(""),
  CONTRACT_FIXED_INCOME_TOKEN: z.string().default(""),
});

export const env = schema.parse({
  APP_ROLE: process.env.APP_ROLE,
  DLT_API_URL: process.env.DLT_API_URL,
  DLT_API_KEY: process.env.DLT_API_KEY,
  ORG_ID: process.env.ORG_ID,
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  CONTRACT_CBTOKEN: process.env.CONTRACT_CBTOKEN,
  CONTRACT_FIXED_INCOME_TOKEN: process.env.CONTRACT_FIXED_INCOME_TOKEN,
});

export type AppRole = (typeof env)["APP_ROLE"];
