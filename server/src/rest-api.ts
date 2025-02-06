import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import sss from "shamirs-secret-sharing";
import { z } from "zod";
import cron from "node-cron";
import consola from "consola"; // Import Consola
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
const askCreationSchema = z.object({
  period: z.number().min(1, "Expiration time in minutes."),
});
const respondRequestSchema = z.object({
  content: z.string().min(1, "Content must be a non-empty string"),
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
  consola.info("Received request to create a new secret.");

  const parsed = secretCreationSchema.safeParse(req.body);
  if (!parsed.success) {
    const error = parsed.error.errors.map((e) => e.message).join(", ");
    consola.warn(`Validation failed: ${error}`);
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

  consola.success(`Secret stored successfully. ID: ${shortId}`);
  res.json({ shortlink: shortId });
});

/**
 * GET /api/share/:shortId
 * Retrieves a secret that is not password-protected.
 */
app.get("/api/share/:shortId", async (req, res) => {
  const { shortId } = req.params;
  consola.info(`Received request to retrieve secret: ${shortId}`);

  const secret = await db("secrets").where({ shortId }).first();
  if (!secret) {
    consola.warn(`Secret not found: ${shortId}`);
    res.status(StatusCodes.NOT_FOUND).json({ message: "Secret not found" });
    return;
  }

  // Check if the secret has expired (all times are in ISO UTC format)
  const now = new Date();
  if (now > new Date(secret.expiresAt)) {
    await db("secrets").where({ shortId }).del();
    consola.info(`Expired secret deleted: ${shortId}`);
    res.status(StatusCodes.NOT_FOUND).json({ message: "Secret has expired" });
    return;
  }

  if (secret.hash) {
    consola.warn(`Unauthorized access attempt for secret: ${shortId}`);
    res.status(StatusCodes.UNAUTHORIZED).json({ message: "Password required" });
    return;
  }

  consola.success(`Secret retrieved successfully: ${shortId}`);
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
  consola.info(`Received request to retrieve protected secret: ${shortId}`);

  const parsed = secretRetrievalSchema.safeParse(req.body);
  if (!parsed.success) {
    const error = parsed.error.errors.map((e) => e.message).join(", ");
    consola.warn(`Validation failed: ${error}`);
    res.status(StatusCodes.BAD_REQUEST).json({ message: error });
    return;
  }
  const { password } = parsed.data;

  const secret = await db("secrets").where({ shortId }).first();
  if (!secret) {
    consola.warn(`Secret not found: ${shortId}`);
    res.status(StatusCodes.NOT_FOUND).json({ message: "Secret not found" });
    return;
  }

  // Check if the secret has expired (all times are in ISO UTC format)
  const now = new Date();
  if (now > new Date(secret.expiresAt)) {
    await db("secrets").where({ shortId }).del();
    consola.info(`Expired secret deleted: ${shortId}`);
    res.status(StatusCodes.NOT_FOUND).json({ message: "Secret has expired" });
    return;
  }

  if (!secret.hash) {
    consola.warn(
      `Attempted password auth for a non-password-protected secret: ${shortId}`,
    );
    res
      .status(StatusCodes.BAD_REQUEST)
      .json({ message: "Secret is not password protected" });
    return;
  }

  const valid = await bcrypt.compare(password, secret.hash);
  if (!valid) {
    consola.warn(`Incorrect password attempt for secret: ${shortId}`);
    res.status(StatusCodes.FORBIDDEN).json({ message: "Incorrect password" });
    return;
  }

  consola.success(`Protected secret retrieved successfully: ${shortId}`);
  res.json({ content: reassembleSecret(secret.fragments) });
});

/**
 * POST /api/ask
 * Create a request to a receiver for a secret.
 * Expected JSON body:
 * {
 *   period: number // minutes
 * }
 */
app.post("/api/ask", async (req, res) => {
  consola.info(`Received request to create request link.`);

  const parsed = askCreationSchema.safeParse(req.body);
  if (!parsed.success) {
    const error = parsed.error.errors.map((e) => e.message).join(", ");
    consola.warn(`Validation failed: ${error}`);
    res.status(StatusCodes.BAD_REQUEST).json({ message: error });
    return;
  }
  const { period } = parsed.data;

  let receiverShortId: string;
  do {
    receiverShortId = generateShortId();
  } while (await db("secret_requests").where({ receiverShortId }).first());

  let adminShortId: string;
  do {
    adminShortId = generateShortId();
  } while (await db("secret_requests").where({ adminShortId }).first());

  await db("secret_requests").insert({
    adminShortId,
    receiverShortId,
    period,
    expiresAt: null,
  });

  consola.success(
    `Created secret request successfully: ${adminShortId}, ${receiverShortId}!`,
  );
  res.json({ adminShortId, receiverShortId });
});

/**
 * GET /api/admin/:shortId
 * Read your requested short id from the receiver.
 */
app.get("/api/admin/:shortId", async (req, res) => {
  consola.info(`Received request to read requested secret.`);

  const { shortId } = req.params;
  const request = await db("secret_requests")
    .where({ adminShortId: shortId })
    .first();
  if (!request) {
    consola.warn(`Request not found: ${shortId}`);
    res.status(StatusCodes.NOT_FOUND).json({ message: "Request not found" });
    return;
  }

  consola.success(`Retrieved secret request successfully: ${shortId}!`);
  res.json({ content: request.content || "" });
});

/**
 * GET /api/receiver/:shortId
 * Read your requested short id.
 */
app.get("/api/receiver/:shortId", async (req, res) => {
  consola.info(`Received request to read secret.`);

  const { shortId } = req.params;
  const request = await db("secret_requests")
    .where({ receiverShortId: shortId })
    .first();
  if (!request) {
    consola.warn(`Request not found: ${shortId}`);
    res.status(StatusCodes.NOT_FOUND).json({ message: "Request not found" });
    return;
  }

  const { expiresAt, period } = request;
  const now = new Date();
  if (expiresAt === null) {
    await db("secret_requests")
      .where({ receiverShortId: shortId })
      .update({
        expiresAt: calculateExpirationDatetime({ amount: period, value: "m" }),
      });
  } else if (now > new Date(expiresAt)) {
    res.status(StatusCodes.NOT_FOUND).json({ message: "Secret has expired" });
    return;
  }

  consola.success(`Retrieved secret successfully: ${shortId}!`);
  res.json({ content: request.content || "" });
});

/**
 * POST /api/receiver/:shortId
 * Set the requested secret.
 * Expected JSON body:
 * {
 *   content: string
 * }
 */
app.post("/api/receiver/:shortId", async (req, res) => {
  const { shortId } = req.params;
  consola.info(`Received request to set requested secret: ${shortId}`);

  const parsed = respondRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const error = parsed.error.errors.map((e) => e.message).join(", ");
    consola.warn(`Validation failed: ${error}`);
    res.status(StatusCodes.BAD_REQUEST).json({ message: error });
    return;
  }
  const { content } = parsed.data;

  const request = await db("secret_requests")
    .where({ receiverShortId: shortId })
    .first();
  if (!request) {
    consola.warn(`Request not found: ${shortId}`);
    res.status(StatusCodes.NOT_FOUND).json({ message: "Request not found" });
    return;
  }

  const { expiresAt } = request;
  const now = new Date();
  if (expiresAt === null) {
    console.warn(`Attempt made to set secret without using UI: ${shortId}`);
    res.status(StatusCodes.UNAUTHORIZED).json({ message: "Request not found" });
    return;
  } else if (now > new Date(expiresAt)) {
    res.status(StatusCodes.NOT_FOUND).json({ message: "Request has expired" });
    return;
  }

  await db("secret_requests")
    .where({ receiverShortId: shortId })
    .update({ content: content });

  res.json({ content });
});

/**
 * Cleanup expired secrets every minute.
 */
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    consola.ready(`Server has started on port ${PORT}`);
  });

  cron.schedule("* * * * *", async () => {
    try {
      const deletedCount = await db("secrets")
        .where("expiresAt", "<", new Date())
        .del();
      if (deletedCount > 0) {
        consola.info(`Cleaned up ${deletedCount} expired secret(s).`);
      }
    } catch (error) {
      consola.error("Error cleaning up expired secrets:", error);
    }
  });
}

export default app;
