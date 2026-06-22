import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";

// NFR-SEC-01: Passwörter nur als Salt+Hash, etabliertes Verfahren, hohe Iteration.
const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const candidate = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(candidate, expected);
}
