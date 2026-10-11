// ================================================================================================
// produkt:20261009:referenzki-quellenbelege (REF-01, Ben nacharbeit-7 K2) — DER ABRUFBELEG.
// ================================================================================================
//
// WAS FEHLTE. Eine externe Belegstelle trug nur `KoSource.at` — den Zeitpunkt, zu dem der Auszug
// am Wissensobjekt GESPEICHERT wurde. Das ist kein Abruf: auch ein von Hand eingetragener Auszug
// bekommt ihn. Ein vollständiger externer Beleg (Herkunft, Abrufzeit, Passage, Fingerabdruck) war
// deshalb nicht herstellbar.
//
// WO EIN ABRUF WIRKLICH STATTFINDET. Die externe Suche läuft über den SERVER
// (`GET /api/external/search`, `ExternalSearchService.search`). Nur dort weiss das Produkt, wann es
// welchen Inhalt unter welcher Adresse tatsächlich bekommen hat. Der Server stellt deshalb zu jedem
// Treffer einen Abrufbeleg aus: Adresse, abgerufener Inhalt (der Treffertext) und Abrufzeit,
// signiert mit HMAC-SHA256 — dieselbe zustandslose Bauform wie der Antwortbeleg
// (`services/ask/src/receipt.ts`).
//
// WIE ER WIRKT. Hängt jemand den Treffer an (`add-source`), legt der Client den Beleg vor. Der Server
// übernimmt die Abrufzeit NUR, wenn (1) die Signatur stimmt, (2) die Adresse genau die abgerufene ist
// und (3) der gespeicherte Auszug ein Anfang des tatsächlich abgerufenen Inhalts ist (die Fläche
// kürzt lange Treffertexte, `apps/web/src/lib/externalSearch.ts`). Sonst bleibt die Abrufzeit leer —
// die Belegstelle ist dann ehrlich unvollständig, wie jeder Altbestand.
//
// EHRLICHE GRENZE: der Schlüssel ist prozesslokal. Ein Beleg, der einen Neustart überdauert (etwa in
// einer Entwurfswarteliste), wird danach nicht mehr anerkannt — die Quelle wird trotzdem angehängt,
// nur eben ohne Abrufzeit. Kein Beleg wird erfunden, keiner verlängert.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const PROZESS_SCHLUESSEL = randomBytes(32);

/** Was ein Abrufbeleg bezeugt — vom Server beim eigenen Abruf festgehalten. */
export interface Abruf {
  readonly url: string;
  /** Der tatsächlich abgerufene Inhalt (Treffertext des Anbieters). */
  readonly inhalt: string;
  /** Wann der Server ihn abgerufen hat (ISO). */
  readonly abgerufenAm: string;
}

interface Nutzlast {
  u: string;
  i: string;
  t: string;
}

function signatur(schluessel: Buffer, rumpf: string): string {
  return createHmac("sha256", schluessel).update(rumpf).digest("base64url");
}

/** Stellt den Abrufbeleg zu einem SERVERSEITIG durchgeführten Abruf aus. */
export function stelleAbrufbelegAus(abruf: Abruf, schluessel: Buffer = PROZESS_SCHLUESSEL): string {
  const nutzlast: Nutzlast = { u: abruf.url, i: abruf.inhalt, t: abruf.abgerufenAm };
  const rumpf = Buffer.from(JSON.stringify(nutzlast), "utf8").toString("base64url");
  return `${rumpf}.${signatur(schluessel, rumpf)}`;
}

/** Der Fingerabdruck des abgerufenen Inhalts — dieselbe Form wie die Fundstellen (`sha256:<hex>`). */
export function abrufFingerabdruck(inhalt: string): string {
  return `sha256:${createHash("sha256").update(inhalt.trim(), "utf8").digest("hex")}`;
}

/**
 * Prüft einen vorgelegten Abrufbeleg gegen die anzuhängende Quelle. Liefert den BELEGTEN Abruf —
 * oder `null` (fehlend, manipuliert, andere Adresse, anderer Inhalt). Nie ein Wurf.
 */
export function pruefeAbrufbeleg(
  beleg: unknown,
  quelle: { url: unknown; excerpt: unknown },
  schluessel: Buffer = PROZESS_SCHLUESSEL,
): { abgerufenAm: string; inhaltFingerabdruck: string } | null {
  if (typeof beleg !== "string" || beleg.length === 0 || beleg.length > 20_000) {
    return null;
  }
  const punkt = beleg.indexOf(".");
  if (punkt <= 0 || punkt >= beleg.length - 1) {
    return null;
  }
  const rumpf = beleg.slice(0, punkt);
  const vorgelegt = Buffer.from(beleg.slice(punkt + 1));
  const erwartet = Buffer.from(signatur(schluessel, rumpf));
  if (vorgelegt.length !== erwartet.length || !timingSafeEqual(vorgelegt, erwartet)) {
    return null;
  }
  let nutzlast: Nutzlast;
  try {
    nutzlast = JSON.parse(Buffer.from(rumpf, "base64url").toString("utf8")) as Nutzlast;
  } catch {
    return null;
  }
  if (
    typeof nutzlast?.u !== "string" ||
    typeof nutzlast.i !== "string" ||
    typeof nutzlast.t !== "string" ||
    Number.isNaN(Date.parse(nutzlast.t))
  ) {
    return null;
  }
  const url = typeof quelle.url === "string" ? quelle.url.trim() : "";
  const auszug = typeof quelle.excerpt === "string" ? quelle.excerpt.trim() : "";
  if (url !== nutzlast.u.trim() || auszug.length === 0 || !nutzlast.i.trim().startsWith(auszug)) {
    return null;
  }
  return { abgerufenAm: nutzlast.t, inhaltFingerabdruck: abrufFingerabdruck(nutzlast.i) };
}
