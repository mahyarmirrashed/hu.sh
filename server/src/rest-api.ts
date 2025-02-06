import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import sss from "shamirs-secret-sharing";
import { z } from "zod";
import cron from "node-cron";
import {
  calculateExpirationDatetime,
  generateShortId,
  reassembleSecret,
} from "./helpers";
import { StatusCodes } from "http-status-codes";

// Configure environment variables
dotenv.config();

const PORT = process.env.PORT || 8000;
const HASH_SALT = parseInt(process.env.HASH_SALT || "10", 10); // Bcrypt salting rounds
const SHARE_COUNT = parseInt(process.env.SHARE_COUNT || "5", 10);
const SHARE_THRESHOLD = parseInt(process.env.SHARE_THRESHOLD || "5", 10);

const app = express();
import { db } from "./db/knex";

// Middleware
app.use(cors());
app.use(express.json());

const secretCreationSchema = z.object({
  content: z.string().min(1, "Content must be a non-empty string"),
  expiration: z.object({
    amount: z.number().min(1, "Expiration amount must be at least 1"),
    value: z.enum(["m", "h", "d"]),
  }),
  password: z.string().optional(),
});
const secretRetrievalSchema = z.object({
  password: z.string().min(1, "Password must be a non-empty string"),
});

/**
 * POST /api/create
 * Creates a new secret share.
 * Expected JSON body:
 * {
 *   content: string,
 *   expiration: { amount: number, value: "m" | "h" | "d" },
 *   password?: string
 * }
 */
app.post("/api/create", async (req, res) => {
  const parsed = secretCreationSchema.safeParse(req.body);
  if (!parsed.success) {
    const error = parsed.error.errors.map((e) => e.message).join(", ");
    res.status(StatusCodes.BAD_REQUEST).json({ message: error });
    return;
  }

  const { content, expiration, password } = parsed.data;
  const expiresAt = calculateExpirationDatetime(expiration);

  const secretBuffer = Buffer.from(content, "utf-8");
  const shares = sss.split(secretBuffer, {
    shares: SHARE_COUNT,
    threshold: SHARE_THRESHOLD,
  });
  const sharesHex = shares.map((share) => share.toString("hex"));

  const hash = password ? await bcrypt.hash(password, HASH_SALT) : null;

  let shortId: string;
  do {
    shortId = generateShortId();
  } while (await db("secrets").where({ shortId }).first());

  await db("secrets").insert({
    shortId,
    expiresAt,
    fragments: JSON.stringify(sharesHex),
    hash,
  });

  res.json({ shortlink: shortId });
});

/**
 * GET /api/share/:shortId
 * Retrieves a secret that is not password-protected.
 */
app.get("/api/share/:shortId", async (req, res) => {
  const { shortId } = req.params;

  const secret = await db("secrets").where({ shortId }).first();
  if (!secret) {
    res.status(StatusCodes.NOT_FOUND).json({ message: "Secret not found" });
    return;
  }

  // Check if the secret has expired (all times are in ISO UTC format)
  const now = new Date();
  if (now > new Date(secret.expiresAt)) {
    await db("secrets").where({ shortId }).del();
    res.status(StatusCodes.NOT_FOUND).json({ message: "Secret has expired" });
    return;
  }

  if (secret.hash) {
    res.status(StatusCodes.UNAUTHORIZED).json({ message: "Password required" });
    return;
  }

  res.json({ content: reassembleSecret(secret.fragments) });
});

/**
 * POST /api/share/:shortId
 * Retrieves a password-protected secret.
 * Expected JSON body:
 * {
 *   password: string
 * }
 */
app.post("/api/share/:shortId", async (req, res) => {
  const { shortId } = req.params;
  const parsed = secretRetrievalSchema.safeParse(req.body);
  if (!parsed.success) {
    const error = parsed.error.errors.map((e) => e.message).join(", ");
    res.status(StatusCodes.BAD_REQUEST).json({ message: error });
    return;
  }
  const { password } = parsed.data;

  const secret = await db("secrets").where({ shortId }).first();
  if (!secret) {
    res.status(StatusCodes.NOT_FOUND).json({ message: "Secret not found" });
    return;
  }

  // Check if the secret has expired (all times are in ISO UTC format)
  const now = new Date();
  if (now > new Date(secret.expiresAt)) {
    await db("secrets").where({ shortId }).del();
    res.status(StatusCodes.NOT_FOUND).json({ message: "Secret has expired" });
    return;
  }

  if (!secret.hash) {
    res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: "Secret is not password protected" });
    return;
  }

  const valid = await bcrypt.compare(password, secret.hash);
  if (!valid) {
    res.status(StatusCodes.FORBIDDEN).json({ message: "Incorrect password" });
    return;
  }

  res.json({ content: reassembleSecret(secret.fragments) });
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server has started on port ${PORT}`);
  });

  cron.schedule("* * * * *", async () => {
    try {
      const deletedCount = await db("secrets")
        .where("expiresAt", "<", new Date())
        .del();
      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} expired secret(s).`);
      }
    } catch (error) {
      console.error("Error cleaning up expired secrets:", error);
    }
  });
}

export default app;
