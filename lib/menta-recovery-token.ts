
import {
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

type RecoveryAuthorization = {
  version: 1;
  jti: string;
  userId: string;
  start: string;
  end: string;
  issuedAt: number;
  expiresAt: number;
};

const TOKEN_DURATION_MS = 5 * 60 * 1000;

function getSecret(): string {
  const secret = process.env.MENTA_RECOVERY_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "MENTA_RECOVERY_SECRET no está configurada correctamente."
    );
  }

  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret())
    .update(payload)
    .digest("base64url");
}

export function createRecoveryToken(
  userId: string,
  start: string,
  end: string
): string {
  const now = Date.now();

  const authorization: RecoveryAuthorization = {
    version: 1,
    jti: randomUUID(),
    userId,
    start,
    end,
    issuedAt: now,
    expiresAt: now + TOKEN_DURATION_MS,
  };

  const payload = Buffer.from(
    JSON.stringify(authorization)
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function verifyRecoveryToken(
  token: string,
  userId: string,
  start: string,
  end: string
): RecoveryAuthorization | null {
  try {
    const parts = token.split(".");

    if (parts.length !== 2) {
      return null;
    }

    const [payload, signature] = parts;
    const expectedSignature = sign(payload);

    const actualBuffer = Buffer.from(
      signature,
      "base64url"
    );

    const expectedBuffer = Buffer.from(
      expectedSignature,
      "base64url"
    );

    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      return null;
    }

    const authorization = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as RecoveryAuthorization;

    const now = Date.now();

    if (
      authorization.version !== 1 ||
      typeof authorization.jti !== "string" ||
      typeof authorization.issuedAt !== "number" ||
      typeof authorization.expiresAt !== "number" ||
      authorization.userId !== userId ||
      authorization.start !== start ||
      authorization.end !== end ||
      authorization.issuedAt > now ||
      authorization.expiresAt <= now ||
      authorization.expiresAt - authorization.issuedAt >
        TOKEN_DURATION_MS
    ) {
      return null;
    }

    return authorization;
  } catch {
    return null;
  }
}
