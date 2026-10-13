#!/usr/bin/env node
// ==================================================================================================
// Aufnahme `gesamt-tls-betrieb` — NACHWEIS AM ÖFFENTLICHEN BETRIEBSWEG (R-0816, R-0822, NFR-SEC-02)
// ==================================================================================================
//
// R-0816: die Verschlüsselung leistet der vorgelagerte Vermittler der Plattform, der auch das
// Zertifikat holt — „ob das wirklich so eingerichtet ist, hat nie jemand am laufenden Vermittler
// nachgesehen" (OFFEN.md I11-U3). R-0822: der Word-Zusatz erreicht den Server nur verschlüsselt mit
// gültigem Zertifikat, ein unsicherer Startweg ist ausgeschlossen.
//
// Diese Probe sieht von AUSSEN nach, was der laufende Vermittler tatsächlich ausliefert. Sie ändert
// nichts, braucht weder root noch Docker noch ein Geheimnis und läuft von jedem Rechner:
//
//   node scripts/betrieb/tls-oeffentlich-nachweis.mjs [host ...]      (Vorgabe: klarwerk.ai app.klarwerk.ai)
//
// Je Host drei Proben:
//   O1  Zertifikat: TLS-Handschlag gegen den Vertrauensspeicher des Systems mit Namensprüfung,
//       mindestens TLS 1.2, Restlaufzeit mindestens MINDEST_RESTTAGE. Aussteller und Laufzeit stehen
//       im Beleg — daran sieht man, WER das Zertifikat ausgestellt hat (bei Let's Encrypt über den
//       Vermittler: Aussteller „Let's Encrypt", Laufzeit höchstens 90 Tage).
//   O2  Kein Klartext-Startweg: http://<host><pfad> für das Taskpane des Word-Zusatzes und /health
//       muss auf https:// umleiten. Jede andere Klartext-Antwort ist durchgefallen.
//   O3  Der Startweg selbst: https://<host>/word-addin/taskpane.html antwortet 200 und trägt HSTS mit
//       max-age von mindestens einem Jahr.
//
// Jede Probe kennt drei Ausgänge — bestanden, durchgefallen, UNGEKLÄRT. Ungeklärt ist nicht
// bestanden: eine verweigerte Verbindung, ein unbekannter Name oder eine Zeitüberschreitung sagt
// nichts über den Vermittler. Exitcode 0 nur, wenn jede Probe jedes Hosts bestanden hat.
//
// GRENZE: Die Probe sieht, was der Vermittler AUSLIEFERT, nicht seine Konfiguration. Ob er das
// Zertifikat selbst erneuert, zeigt sich erst über die Zeit (Aussteller und Restlaufzeit in zwei
// Belegen im Abstand einer Erneuerung). Die Strecke Vermittler → Anwendung belegt
// `scripts/betrieb/tls-intern-nachweis.sh` (R-2057).
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { connect } from "node:tls";
import { fileURLToPath } from "node:url";

export const OEFFENTLICHE_HOSTS = ["klarwerk.ai", "app.klarwerk.ai"];
export const TASKPANE_PFAD = "/word-addin/taskpane.html";
export const KLARTEXT_PFADE = [TASKPANE_PFAD, "/health"];
export const MINDEST_RESTTAGE = 14;
export const HSTS_MINDEST_MAX_AGE = 31_536_000;
const ZEIT_MS = 10_000;
const TAG_MS = 86_400_000;

// Fehlercodes, die ein ABGELEHNTES Zertifikat bedeuten: der Vermittler hat geantwortet, aber nicht
// mit einem gültigen Zertifikat für diesen Namen. Alles andere ist ungeklärt.
const ZERTIFIKATSFEHLER = new Set([
  "CERT_HAS_EXPIRED",
  "CERT_NOT_YET_VALID",
  "CERT_UNTRUSTED",
  "CERT_SIGNATURE_FAILURE",
  "CERT_REVOKED",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "UNABLE_TO_GET_ISSUER_CERT",
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "ERR_TLS_CERT_ALTNAME_INVALID",
]);

function ziel(optionen) {
  return {
    host: optionen.host,
    adresse: optionen.adresse ?? optionen.host,
    httpsPort: optionen.httpsPort ?? 443,
    httpPort: optionen.httpPort ?? 80,
    ca: optionen.ca,
    zeitMs: optionen.zeitMs ?? ZEIT_MS,
  };
}

function fehlercode(fehler) {
  return fehler?.code ?? fehler?.message ?? String(fehler);
}

/** O1 — das ausgelieferte Zertifikat. */
export function pruefeZertifikat(optionen) {
  const z = ziel(optionen);
  const mindestRestTage = optionen.mindestRestTage ?? MINDEST_RESTTAGE;
  const jetzt = optionen.jetzt ?? Date.now();
  return new Promise((fertig) => {
    const socket = connect({
      host: z.adresse,
      port: z.httpsPort,
      servername: z.host,
      ca: z.ca,
      timeout: z.zeitMs,
    });
    let gemeldet = false;
    const ende = (befund) => {
      if (gemeldet) return;
      gemeldet = true;
      socket.destroy();
      fertig({ probe: "O1", host: z.host, ...befund });
    };
    socket.on("secureConnect", () => {
      const zert = socket.getPeerCertificate();
      const protokoll = socket.getProtocol();
      const gueltigAb = Date.parse(zert.valid_from);
      const gueltigBis = Date.parse(zert.valid_to);
      const restTage = Math.floor((gueltigBis - jetzt) / TAG_MS);
      const beleg = {
        protokoll,
        aussteller: zert.issuer?.O ?? zert.issuer?.CN ?? null,
        aussteller_cn: zert.issuer?.CN ?? null,
        gueltig_ab: new Date(gueltigAb).toISOString(),
        gueltig_bis: new Date(gueltigBis).toISOString(),
        laufzeit_tage: Math.round((gueltigBis - gueltigAb) / TAG_MS),
        rest_tage: restTage,
      };
      if (!socket.authorized) {
        ende({ ergebnis: "durchgefallen", grund: `nicht autorisiert: ${socket.authorizationError}`, ...beleg });
      } else if (protokoll !== "TLSv1.2" && protokoll !== "TLSv1.3") {
        ende({ ergebnis: "durchgefallen", grund: `Protokoll ${protokoll} unter TLS 1.2`, ...beleg });
      } else if (restTage < mindestRestTage) {
        ende({
          ergebnis: "durchgefallen",
          grund: `Restlaufzeit ${restTage} Tage unter ${mindestRestTage} — die Erneuerung durch den Vermittler greift nicht rechtzeitig`,
          ...beleg,
        });
      } else {
        ende({ ergebnis: "bestanden", grund: "gültiges Zertifikat mit Namensprüfung", ...beleg });
      }
    });
    socket.on("timeout", () => ende({ ergebnis: "ungeklaert", grund: "Zeitüberschreitung" }));
    socket.on("error", (fehler) => {
      const code = fehlercode(fehler);
      ende(
        ZERTIFIKATSFEHLER.has(code)
          ? { ergebnis: "durchgefallen", grund: `Zertifikat abgelehnt: ${code}` }
          : { ergebnis: "ungeklaert", grund: `keine Aussage über das Zertifikat: ${code}` },
      );
    });
  });
}

function hole(modul, optionen) {
  return new Promise((fertig) => {
    const anfrage = modul(optionen, (antwort) => {
      antwort.resume();
      antwort.on("end", () => fertig({ status: antwort.statusCode ?? 0, kopf: antwort.headers }));
    });
    anfrage.setTimeout(optionen.timeout, () => anfrage.destroy(new Error("Zeitüberschreitung")));
    anfrage.on("error", (fehler) => fertig({ fehler: fehlercode(fehler) }));
    anfrage.end();
  });
}

/** O2 — ein Pfad im Klartext: nur eine Umleitung auf https:// ist bestanden. */
export async function pruefeKlartext(optionen, pfad) {
  const z = ziel(optionen);
  const a = await hole(httpRequest, {
    host: z.adresse,
    port: z.httpPort,
    path: pfad,
    headers: { Host: z.host },
    timeout: z.zeitMs,
    agent: false,
  });
  const basis = { probe: "O2", host: z.host, pfad };
  if (a.fehler) {
    return { ...basis, ergebnis: "ungeklaert", grund: `keine Klartext-Antwort messbar: ${a.fehler}` };
  }
  const ort = String(a.kopf.location ?? "");
  if ([301, 302, 303, 307, 308].includes(a.status) && ort.startsWith("https://")) {
    return { ...basis, ergebnis: "bestanden", status: a.status, umleitung: ort };
  }
  return {
    ...basis,
    ergebnis: "durchgefallen",
    status: a.status,
    umleitung: ort || null,
    grund: "Klartext-Antwort ohne Umleitung auf https://",
  };
}

function hstsMaxAge(wert) {
  const treffer = /(?:^|;)\s*max-age\s*=\s*"?(\d+)"?/i.exec(String(wert ?? ""));
  return treffer ? Number(treffer[1]) : null;
}

/** O3 — der verschlüsselte Startweg des Word-Zusatzes. */
export async function pruefeStartweg(optionen) {
  const z = ziel(optionen);
  const a = await hole(httpsRequest, {
    host: z.adresse,
    port: z.httpsPort,
    path: TASKPANE_PFAD,
    servername: z.host,
    headers: { Host: z.host },
    ca: z.ca,
    timeout: z.zeitMs,
    agent: false,
  });
  const basis = { probe: "O3", host: z.host, pfad: TASKPANE_PFAD };
  if (a.fehler) {
    return { ...basis, ergebnis: "ungeklaert", grund: `HTTPS nicht messbar: ${a.fehler}` };
  }
  const hsts = a.kopf["strict-transport-security"] ?? null;
  const maxAge = hstsMaxAge(hsts);
  if (a.status !== 200) {
    return { ...basis, ergebnis: "durchgefallen", status: a.status, hsts, grund: "Taskpane nicht ausgeliefert" };
  }
  if (maxAge === null || maxAge < HSTS_MINDEST_MAX_AGE) {
    return { ...basis, ergebnis: "durchgefallen", status: a.status, hsts, grund: "HSTS fehlt oder zu kurz" };
  }
  return { ...basis, ergebnis: "bestanden", status: a.status, hsts };
}

/** Alle Proben eines Hosts. */
export async function pruefeHost(optionen) {
  const proben = [await pruefeZertifikat(optionen)];
  for (const pfad of KLARTEXT_PFADE) {
    proben.push(await pruefeKlartext(optionen, pfad));
  }
  proben.push(await pruefeStartweg(optionen));
  return proben;
}

/** Der Beleg über alle Hosts. `bestanden` nur, wenn JEDE Probe bestanden ist. */
export async function nachweis(hosts = OEFFENTLICHE_HOSTS, zusatz = {}) {
  const proben = [];
  for (const host of hosts) {
    proben.push(...(await pruefeHost({ ...zusatz, host })));
  }
  return {
    anforderung: "R-0816 / R-0822 / NFR-SEC-02",
    zeit: new Date().toISOString(),
    hosts,
    proben,
    bestanden: proben.length > 0 && proben.every((p) => p.ergebnis === "bestanden"),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const hosts = process.argv.slice(2);
  const beleg = await nachweis(hosts.length > 0 ? hosts : OEFFENTLICHE_HOSTS);
  process.stdout.write(`${JSON.stringify(beleg, null, 2)}\n`);
  process.exitCode = beleg.bestanden ? 0 : 1;
}
