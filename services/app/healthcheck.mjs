// Container-Selbsttest (Dockerfile HEALTHCHECK): /health muss 200 liefern, sonst gilt der Container
// als krank. R-2057: Ist am App-Port TLS eingeschaltet (KLARWERK_TLS_CERT_FILE, s.
// services/app/src/transport-tls.ts), fragt der Test über HTTPS MIT Zertifikatsprüfung — gegen
// KLARWERK_TLS_CA_FILE (sonst das Zertifikat selbst) und, falls gesetzt, KLARWERK_TLS_SERVERNAME.
// Eine Prüfungsabschaltung gibt es hier bewusst nicht.
import { readFileSync } from "node:fs";
import { request } from "node:https";

const port = process.env.PORT || "3001";
const cert = process.env.KLARWERK_TLS_CERT_FILE?.trim();

function ende(ok) {
  process.exit(ok ? 0 : 1);
}

if (!cert) {
  fetch(`http://127.0.0.1:${port}/health`)
    .then((antwort) => ende(antwort.ok))
    .catch(() => ende(false));
} else {
  const servername = process.env.KLARWERK_TLS_SERVERNAME?.trim();
  const anfrage = request(
    {
      host: "127.0.0.1",
      port,
      path: "/health",
      ca: readFileSync(process.env.KLARWERK_TLS_CA_FILE?.trim() || cert),
      ...(servername ? { servername } : {}),
      timeout: 3000,
    },
    (antwort) => {
      antwort.resume();
      ende(antwort.statusCode === 200);
    },
  );
  anfrage.on("timeout", () => anfrage.destroy());
  anfrage.on("error", () => ende(false));
  anfrage.end();
}
