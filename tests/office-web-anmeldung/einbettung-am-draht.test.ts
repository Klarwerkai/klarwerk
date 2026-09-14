// ================================================================================================
// JOB 4016 · LIEFERUNG 1+2+3 — WELCHER MICROSOFT-HOST KLARA EINBETTEN DARF, UND WAS WIRKLICH RAUSGEHT
// ================================================================================================
//
// Bis hierher stand die Liste der Office-Web-Herkuenfte als Zeichenkette mitten in einer
// CSP-Konstante (`services/app/src/security-headers.ts`, Zeile 36 am Stand b0315de). Sie hatte
// keinen Namen, keine Gegenprobe und keinen Ort, an dem ein Mensch die Frage „darf dieser Host
// Klara einbetten?" beantwortet faende. Seit JOB 4016 ist dieser Ort
// `services/app/src/office-host.ts`, und diese Datei ist seine Gegenprobe.
//
// ------------------------------------------------------------------------------------------------
// WAS HIER NICHT NOCH EINMAL GEMESSEN WIRD — und wo es gemessen ist
// ------------------------------------------------------------------------------------------------
// Der Auftrag verlangt ausdruecklich KEINEN zweiten Messweg ueber dieselbe Zusage. Zwei der drei
// Faelle liegen bereits in `tests/app/word-addin-csp.test.ts`, am selben Draht (`app.inject`):
//
//   (a) Taskpane-Pfad traegt die Ersatz-CSP, KEIN `X-Frame-Options`
//       → dort Fall „(a) NUR der kanonische Taskpane-Pfad → Ersatz-CSP, KEIN X-Frame-Options"
//         (gemessen wird die ausgelieferte Antwortkopfzeile, also die RAW-Ebene) und Fall
//         „(b) Query-String aendert den Scope nicht".
//   (b) jeder andere Pfad traegt `frame-ancestors 'none'`
//       → dort Faelle „(a2) die Icons …", „(c) Praefix-/Traversal-/API-/Root-Pfade …" und
//         „(d) nicht existenter /word-addin/foo.html (404) …".
//
// HIER bleiben: die ZEICHENGLEICHHEIT der ausgelieferten CSP ueber die Abloesung hinweg (Fall D1),
// die Fehlfreigaben AM DRAHT (Fall D2 — der Auftrag nennt ihn (c)), die GLEICHHEIT von Regel und
// ausgeliefertem Header (Fall D3, bens ROT-Befund aus Runde 1) und die exakte Hostpruefung selbst
// (Faelle E1–E4). Fall D1 ist der Beleg dafuer, dass die CSP wirklich aus dem neuen Ort kommt:
// verstellt man in `office-host.ts` einen Hostnamen um ein Zeichen, wird D1 rot.
import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ERLAUBTE_EINBETTUNGS_HOSTS,
  NICHT_FREIGEGEBENE_PLATTFORMFAMILIEN,
  istErlaubterEinbettungsHost,
} from "../../services/app/src/office-host";
import { registerSecurityHeaders } from "../../services/app/src/security-headers";

const TASKPANE = "/word-addin/taskpane.html";

// ------------------------------------------------------------------------------------------------
// DER PIN — woertlich am Draht abgegriffen, VOR der Abloesung
// ------------------------------------------------------------------------------------------------
// Dieser String ist keine Abschrift aus dem Quelltext, sondern die Antwortkopfzeile, die der
// Taskpane-Pfad am Stand b0315de (also mit dem alten Literal in `security-headers.ts:36`) wirklich
// ausgeliefert hat. Er ist die Zusage der Abloesung: die CSP bleibt zeichengleich.
const ERWARTETE_TASKPANE_CSP =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline' https://appsforoffice.microsoft.com; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; " +
  "connect-src 'self'; " +
  "object-src 'none'; " +
  "base-uri 'self'; " +
  "form-action 'self'; " +
  "frame-ancestors 'self' https://*.office.com https://*.officeapps.live.com";

/**
 * Eine echte Fastify-Instanz mit der ECHTEN Produktionsregistrierung. Kein Nachbau der Kopfzeilen,
 * keine Kopie der Konstante — gemessen wird, was `registerSecurityHeaders` an den Draht gibt.
 * Der Taskpane-Pfad bekommt eine Stellvertreter-Route (die statische Auslieferung braucht ein
 * gebautes `dist`; die Kopfzeilen kommen ohnehin nicht aus der Route, sondern aus helmet und dem
 * onSend-Hook).
 */
async function baueApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await registerSecurityHeaders(app);
  app.get(TASKPANE, async (_request, reply) => reply.type("text/html").send("ok"));
  await app.ready();
  return app;
}

describe("JOB 4016 · D · die ausgelieferte Einbettungs-Erlaubnis", () => {
  let app: FastifyInstance;
  let csp: string;

  beforeAll(async () => {
    app = await baueApp();
    const res = await app.inject({ method: "GET", url: TASKPANE });
    expect(res.statusCode).toBe(200);
    csp = String(res.headers["content-security-policy"] ?? "");
  });

  afterAll(async () => {
    await app.close();
  });

  it("D1 · die CSP des Taskpane-Pfads ist zeichengleich der vor der Abloesung gemessenen", () => {
    expect(csp).toBe(ERWARTETE_TASKPANE_CSP);
  });

  it("D2 · keine Fehlfreigabe am Draht: die ausgeschlossenen Plattformfamilien fehlen", () => {
    // Der Auftrag nennt diesen Fall (c). Gemessen wird die AUSGELIEFERTE Kopfzeile, nicht die
    // Konstante — ein Eintrag, der erst beim Zusammensetzen entstuende, faellt hier auf.
    expect(NICHT_FREIGEGEBENE_PLATTFORMFAMILIEN.length).toBeGreaterThan(0);
    for (const familie of NICHT_FREIGEGEBENE_PLATTFORMFAMILIEN) {
      expect(csp, familie.familie).not.toContain(`*.${familie.familie}`);
      expect(istErlaubterEinbettungsHost(familie.beispiel), familie.beispiel).toBe(false);
    }
    // Kalibrierung: der Fall ist nicht vakuos — die belegten Hosts stehen sehr wohl drin.
    expect(csp).toContain("https://*.office.com");
    expect(csp).toContain("https://*.officeapps.live.com");
  });

  it("D3 · Regel und Header beschreiben DIESELBE Hostmenge — bens ROT-Befund aus Runde 1", () => {
    // Runde 1 liess die Pruefung die nackte Basisdomain erlauben, waehrend die ausgelieferte
    // Direktive sie NICHT deckt: eine Host-Quelle mit Platzhalter (`https://*.office.com`) trifft
    // laut CSP-Vertrag (W3C CSP3, „Match Hosts") nur Namen, die auf `.office.com` enden. Beide
    // Aussagen waren gruen und widersprachen sich.
    //
    // Dieser Fall misst deshalb nicht gegen eine Liste im Test, sondern gegen die AUSGELIEFERTE
    // Direktive: fuer JEDE Host-Quelle, die wirklich im Header steht, muss die nackte Basisdomain
    // FALSCH und eine Unterdomain WAHR sein. Kommt je eine Host-Quelle dazu, wird sie hier
    // mitgemessen, ohne dass jemand diesen Test nachfuehren muss.
    const direktive = csp.split("; ").find((d) => d.startsWith("frame-ancestors "));
    expect(direktive, "die Direktive fehlt in der ausgelieferten CSP").toBeDefined();
    const teile = (direktive ?? "").split(" ");
    const quellen = teile.filter((t) => t.startsWith("https://*."));
    // Kalibrierung: es gibt wirklich mehr als eine, und KEINE Herkunft im Header bleibt ungemessen
    // (eine Host-Quelle ohne Platzhalter waere eine andere Zusage und faellt hier auf).
    expect(quellen.length).toBeGreaterThan(1);
    expect(quellen.length).toBe(ERLAUBTE_EINBETTUNGS_HOSTS.length);
    expect(teile.filter((t) => t.startsWith("https://")).length).toBe(quellen.length);
    for (const quelle of quellen) {
      const basis = quelle.slice("https://*.".length);
      expect(istErlaubterEinbettungsHost(`https://${basis}`), `nackt: ${basis}`).toBe(false);
      expect(istErlaubterEinbettungsHost(`https://pruef.${basis}`), `unter: ${basis}`).toBe(true);
    }
  });
});

describe("JOB 4016 · E · istErlaubterEinbettungsHost — exakt und fail-closed", () => {
  it("E1 · der Angreifer-Suffix ist FALSCH, der belegte Office-Web-Host ist WAHR", () => {
    // Die zwei Faelle des Red-first-Vertrags (Auftrag §6).
    expect(istErlaubterEinbettungsHost("https://office.com.angreifer.tld")).toBe(false);
    expect(istErlaubterEinbettungsHost("https://word-edit.officeapps.live.com")).toBe(true);
  });

  it("E2 · WAHR sind genau die UNTERDOMAINS der belegten Hosts — mehr deckt der Header nicht", () => {
    for (const gut of [
      "https://www.office.com",
      "https://word-edit.office.com",
      "https://word-edit.officeapps.live.com",
      "https://euc-word-edit.officeapps.live.com",
      // Hostnamen sind laut DNS nicht schreibungsabhaengig, und Browser senden `Origin` klein.
      // Die Pruefung normalisiert deshalb die Schreibung — und NUR sie.
      "https://WORD-EDIT.OFFICEAPPS.LIVE.COM",
    ]) {
      expect(istErlaubterEinbettungsHost(gut), gut).toBe(true);
    }
  });

  it("E3 · FALSCH ist alles andere — kein Praefix, kein Teilstring, kein anderes Schema", () => {
    for (const boese of [
      // DIE NACKTEN BASISDOMAINEN (bens ROT-Befund aus Runde 1): `https://*.office.com` deckt sie
      // NICHT — der Platzhalter verlangt mindestens einen Bezeichner davor. Die Pruefung sagt
      // deshalb dasselbe wie der ausgelieferte Header (D3 misst genau diese Gleichheit).
      "https://office.com",
      "https://officeapps.live.com",
      // Suffix-Anhaengsel: der belegte Name steht LINKS, die fremde Herkunft rechts.
      "https://office.com.angreifer.tld",
      "https://klarwerk.ai.office.com.angreifer.tld",
      "https://officeapps.live.com.angreifer.tld",
      // Teilstring ohne Punktgrenze.
      "https://xoffice.com",
      "https://xofficeapps.live.com",
      "https://notoffice.com",
      // Ganze Plattformfamilien — genau die bewusste Nicht-Freigabe.
      "https://beliebig.live.com",
      "https://live.com",
      "https://beliebig.microsoft.com",
      "https://appsforoffice.microsoft.com",
      // Kein HTTPS, kein Schema, anderes Schema.
      "http://word-edit.officeapps.live.com",
      "word-edit.officeapps.live.com",
      "//word-edit.officeapps.live.com",
      "data:text/html,https://office.com",
      // Herkunft ist Schema + Host, sonst nichts: Pfad, Query, Fragment, Port, Nutzerinfo.
      "https://office.com/",
      "https://office.com/pfad",
      "https://office.com?x=1",
      "https://office.com#frag",
      "https://office.com:8443",
      "https://angreifer.tld@office.com",
      "https://office.com\\@angreifer.tld",
      // Leere Bezeichner und Randformen.
      "https://.office.com",
      "https://office.com.",
      "https://a..office.com",
      "https://",
      " https://office.com",
      "https://office.com ",
      "null",
      "",
      undefined,
    ]) {
      expect(istErlaubterEinbettungsHost(boese), String(boese)).toBe(false);
    }
  });

  it("E4 · KALIBRIERUNG: die Pruefung haengt an der Liste, nicht an einer festen Antwort", () => {
    // Ohne diesen Fall waere eine Pruefung, die immer `false` liefert, in E3 gruen.
    const gut = ["https://word-edit.office.com", "https://word-edit.officeapps.live.com"];
    expect(gut.every((o) => istErlaubterEinbettungsHost(o))).toBe(true);
    // Jeder Eintrag traegt sein Beispiel UND sein Gegenbeispiel, und beide stimmen: das Beispiel
    // ist gedeckt, die nackte Basisdomain nicht. Genau diese zwei Zusagen misst auch der Riegel
    // beim Laden des Moduls (`pruefeEintraege`).
    expect(ERLAUBTE_EINBETTUNGS_HOSTS.length).toBeGreaterThan(1);
    for (const eintrag of ERLAUBTE_EINBETTUNGS_HOSTS) {
      expect(eintrag.hostQuelle.startsWith("https://*."), eintrag.hostQuelle).toBe(true);
      expect(istErlaubterEinbettungsHost(eintrag.beispiel), eintrag.beispiel).toBe(true);
      expect(istErlaubterEinbettungsHost(eintrag.gegenbeispiel), eintrag.gegenbeispiel).toBe(false);
      expect(eintrag.warum.length, eintrag.hostQuelle).toBeGreaterThan(40);
    }
    // Und die ausgeschlossenen Familien stehen als DATEN da, nicht nur im Fliesstext.
    expect(NICHT_FREIGEGEBENE_PLATTFORMFAMILIEN.map((f) => f.familie).sort()).toEqual([
      "live.com",
      "microsoft.com",
    ]);
    for (const familie of NICHT_FREIGEGEBENE_PLATTFORMFAMILIEN) {
      expect(familie.warum.length, familie.familie).toBeGreaterThan(40);
    }
  });
});
