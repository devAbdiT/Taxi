import { Router } from "express";
import { type AuthResponse, LoginRequest, type MeResponse, RegisterRequest } from "@taxiflow/shared";
import { hashPassword, hashPasswordSync, signToken, verifyPassword } from "../lib/auth.js";
import { prisma } from "../lib/db.js";
import { AppError, conflict, unauthorized } from "../lib/errors.js";
import { toPublicUser } from "../lib/serialize.js";
import { getAuth, requireAuth } from "../middleware/auth.js";
import { loginLimiter, registerLimiter } from "../middleware/rateLimit.js";
import { Prisma } from "../generated/prisma/client.js";

export const authRouter = Router();

/** Compared against when the phone is unknown, so that case takes as long as a wrong password. */
const DUMMY_HASH = hashPasswordSync("not-a-real-password");

authRouter.post("/auth/register", registerLimiter, async (req, res) => {
  const body = RegisterRequest.parse(req.body);

  try {
    const user = await prisma.user.create({
      data: {
        name: body.name,
        phone: body.phone,
        passwordHash: await hashPassword(body.password),
        role: "PASSENGER",
        language: body.language,
      },
    });
    const response: AuthResponse = { token: signToken({ userId: user.id, role: user.role }), user: toPublicUser(user) };
    res.status(201).json(response);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw conflict("phone_taken", "An account with this phone number already exists");
    }
    throw err;
  }
});

authRouter.post("/auth/login", loginLimiter, async (req, res) => {
  const body = LoginRequest.parse(req.body);

  const user = await prisma.user.findUnique({ where: { phone: body.phone } });
  const passwordOk = await verifyPassword(body.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) {
    throw new AppError(401, "invalid_credentials", "Phone number or password is wrong");
  }

  const response: AuthResponse = { token: signToken({ userId: user.id, role: user.role }), user: toPublicUser(user) };
  res.json(response);
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: getAuth(req).userId } });
  if (!user) {
    throw unauthorized("Your account no longer exists. Please log in again.");
  }
  const response: MeResponse = { user: toPublicUser(user) };
  res.json(response);
});
