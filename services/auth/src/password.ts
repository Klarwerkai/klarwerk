import { pbkdf2, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// NFR-SEC-01: Passwörter nur als Salt+Hash, etabliertes Verfahren, hohe Iteration.
// WP-VIP2-GATE (bens P1): asynchrone crypto-Variante (pbkdf2 statt pbkdf2Sync) — EXAKT dieselben
// Parameter (Iterationen/Länge/Digest), daher bleiben ALLE bestehenden Hashes gültig (kein
// Algorithmuswechsel). Gewinn: die ~100k-Iterationen-Ableitung läuft im libuv-Threadpool und
// blockiert den Event-Loop nicht mehr (Login/Registrierung unter Last).
const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

const pbkdf2Async = promisify(pbkdf2);

export async function hashPassword(password: string): Promise<{ salt: string; hash: string }> {
  const salt = randomBytes(16).toString("hex");
  const derived = await pbkdf2Async(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return { salt, hash: derived.toString("hex") };
}

export async function verifyPassword(
  password: string,
  salt: string,
  hash: string,
): Promise<boolean> {
  const candidate = await pbkdf2Async(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(candidate, expected);
}
