// ================================================================================================
// produkt:20261011:assistenz-browser-aktionen (BPA-03) — DER PRODUKTWEG ÜBER DIE ECHTEN TÜREN.
// ================================================================================================
//
// Hier läuft der Weg, den die Erweiterung geht, gegen die ECHTE Kompositionswurzel (`buildApp`
// mit dem synthetischen Seitenprofil): Auftrag anlegen (`POST /api/me/klara/browser-auftraege`),
// Schritte im Takt abholen und beantworten (`…/:id/takt`), steuern (`…/:id/steuerung`) und den
// Verlauf lesen. Echt sind Anmeldung, Rollenrechte je Schritt, Befehlsrelais, Aktionskern und die
// Ablage im Klara-Gespräch.
//
// GESTELLT ist nur die Erweiterung samt Seite: eine kleine Takt-Schleife beantwortet jeden Befehl
// aus einem Seitenmodell, das die Semantik von `extensions/klara-browser/aktion.js` nachbildet
// (Lage samt `tabId` wie vom Worker ergänzt, Füllen, Klicken, Löschen) und selbst zählt, was
// wirklich geschah. Jede Zusicherung über Wirkung liest diese Zähler — nicht Klaras Meldung.
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { BrowserAuftragSicht } from "../../services/app/src/klara-browser-aktion-dienst";
import type { BrowserBefehl } from "../../services/app/src/klara-browser-relais";
import { BETREFF, EMPFAENGER, LECKZEICHEN, NACHRICHT, ORIGIN, PFAD, TESTSEITE } from "./testseite";

const API = "/api/me/klara/browser-auftraege";
const FASSUNG = "aktion.js@1.0.0";
const ABDRUCK = "0a1b2c3d4e5f6789";
const PASSWORT = "test-password-bpa03";
const TAB = 7;

const ENTWURF = `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}“, Empfänger ${EMPFAENGER}, Nachricht „${NACHRICHT}“ und speichere ihn als Entwurf.`;
const SENDEN = `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}“, Empfänger ${EMPFAENGER}, Nachricht „${NACHRICHT}“ und klicke Endgültig senden.`;

type Antwort = { auftrag: BrowserAuftragSicht; befehl: BrowserBefehl | null };
type Konto = { id: string; email: string; token: string };

const kopf = (token: string) => ({ authorization: `Bearer ${token}` });

/** Die synthetische Seite als Modell — dieselben Antworten wie `aktion.js`, mit eigenen Zählern. */
function seitenmodell() {
  const z = {
    felder: new Map([
      ["Betreff", ""],
      ["Empfänger", ""],
      ["Nachricht", ""],
    ]),
    abdruck: ABDRUCK,
    entwuerfe: [
      { id: "E-alt-1", betreff: BETREFF },
      { id: "E-alt-2", betreff: `${LECKZEICHEN} Gehaltsliste Q3` },
    ],
    naechste: 1,
    eintragungen: 0,
    speicherungen: 0,
    versand: 0,
    bestellungen: 0,
    loeschungen: 0,
  };
  const knoepfe = ["Entwurf speichern", "Endgültig senden", "Bestellung auslösen"];
  const fehler = (grund: string) => ({ ok: false, grund });
  function fuehreAus(b: BrowserBefehl): unknown {
    const a = b.args as Record<string, unknown>;
    if (b.art === "lage") {
      const da = a.formular === "Angebotsentwurf";
      return {
        origin: ORIGIN,
        pfad: PFAD,
        hindernisse: [],
        formularTreffer: da ? 1 : 0,
        formular: da
          ? {
              name: "Angebotsentwurf",
              fingerabdruck: z.abdruck,
              felder: [...z.felder].map(([label, wert]) => ({
                label,
                typ: label === "Nachricht" ? "textarea" : "text",
                wert,
                gesperrt: false,
              })),
              knoepfe,
            }
          : null,
        entwuerfe: a.liste
          ? z.entwuerfe.map((e) => ({ id: e.id, text: `Angebotsentwurf: ${e.betreff}` }))
          : [],
        // Die `tabId` ergänzt der Worker (`worker.js`, aktionBefehl).
        tabId: b.tabId,
      };
    }
    if (b.art === "loesche") {
      const liste = a.liste as { name?: string } | undefined;
      const i = z.entwuerfe.findIndex((e) => e.id === a.id);
      if (liste?.name !== "Gespeicherte Entwürfe" || i < 0) return fehler("eintrag_fehlt");
      if (a.knopf !== "Entwurf löschen") return fehler("knopf_fehlt");
      z.entwuerfe.splice(i, 1);
      z.loeschungen++;
      return { ok: true, wert: null };
    }
    if (a.formular !== "Angebotsentwurf" || a.fingerabdruck !== z.abdruck) {
      return fehler("ziel_geaendert");
    }
    if (b.art === "fuelle") {
      const label = String(a.label);
      if (!z.felder.has(label)) return fehler("feld_fehlt");
      if (typeof a.erwartet === "string" && z.felder.get(label) !== a.erwartet) {
        return fehler("wert_geaendert");
      }
      z.felder.set(label, String(a.wert).slice(0, 4000));
      z.eintragungen++;
      return { ok: true, wert: { wert: z.felder.get(label) } };
    }
    if (b.art === "klicke") {
      const knopf = String(a.knopf);
      if (!knoepfe.includes(knopf)) return fehler("knopf_fehlt");
      for (const soll of (a.werte ?? []) as { label: string; wert: string }[]) {
        if (z.felder.get(soll.label) !== soll.wert) return fehler("wert_geaendert");
      }
      if (knopf === "Entwurf speichern") {
        z.speicherungen++;
        z.entwuerfe.push({ id: `E-${z.naechste++}`, betreff: z.felder.get("Betreff") ?? "" });
      } else if (knopf === "Endgültig senden") {
        z.versand++;
      } else {
        z.bestellungen++;
      }
      return { ok: true, wert: null };
    }
    return { fehler: "nicht_ausgefuehrt" };
  }
  return { z, fuehreAus };
}

type Seite = ReturnType<typeof seitenmodell>;
/** Was die Erweiterung mit einem Befehl tut: ausführen und melden, ausführen und die Antwort
 * verlieren, oder (Seitenfreigabe widerrufen) nichts ausführen und den Entzug melden. */
type Verhalten = "antworten" | "schweigen" | "entzogen";

/** Die Erweiterung im Takt: genau eine Anmeldung, genau ein Lauf, streng steigende Folge. */
class Leiste {
  constructor(
    private readonly app: FastifyInstance,
    readonly token: string,
    readonly id: string,
    private readonly seite: Seite,
    private folge = 0,
  ) {}

  takt(body: Record<string, unknown> = {}) {
    return this.app.inject({
      method: "POST",
      url: `${API}/${this.id}/takt`,
      headers: kopf(this.token),
      payload: { folge: ++this.folge, ...body },
    });
  }

  async steuere(art: string, extra: Record<string, unknown> = {}) {
    return this.app.inject({
      method: "POST",
      url: `${API}/${this.id}/steuerung`,
      headers: kopf(this.token),
      payload: { art, ...extra },
    });
  }

  /** Beantwortet jeden Befehl, bis keiner mehr kommt und der Lauf ruht. */
  async treibe(
    start: Antwort,
    verhalten: (b: BrowserBefehl) => Verhalten | Promise<Verhalten> = () => "antworten",
  ): Promise<BrowserAuftragSicht> {
    let { auftrag, befehl } = start;
    const behandelt = new Set<number>();
    const bis = Date.now() + 15_000;
    while (Date.now() < bis) {
      let body: Record<string, unknown> = {};
      if (befehl && behandelt.has(befehl.nr)) {
        // Ein abgeholter Befehl ohne Antwort: die Antwortfrist des Servers läuft.
        await new Promise((weiter) => setTimeout(weiter, 40));
      } else if (befehl) {
        behandelt.add(befehl.nr);
        const v = await verhalten(befehl);
        if (v === "antworten") {
          const ergebnis = this.seite.fuehreAus(befehl);
          body = { antwort: { nr: befehl.nr, ergebnis }, seite: { adapter: FASSUNG } };
        } else if (v === "entzogen") {
          body = {
            antwort: { nr: befehl.nr, ergebnis: { fehler: "nicht_ausgefuehrt" } },
            seite: { recht: "entzogen", grund: "freigabe_widerrufen" },
          };
        } else {
          this.seite.fuehreAus(befehl);
        }
      } else if (!auftrag.laeuft) {
        return auftrag;
      }
      const r = await this.takt(body);
      expect(r.statusCode, r.body).toBe(200);
      ({ auftrag, befehl } = r.json() as Antwort);
    }
    throw new Error("Der Lauf kam nicht zur Ruhe.");
  }
}

let offen: FastifyInstance | null = null;
afterEach(async () => {
  await offen?.close();
  offen = null;
});

/** Eine frische App mit drei Konten: Admin (das erste), die Person (experte) und ein fremdes. */
async function aufbau() {
  const services = buildServices();
  const app = buildApp(services, {
    browserAktion: {
      seitenprofile: [TESTSEITE],
      fristen: { abholMs: 300, antwortMs: 300, taktMs: 200 },
    },
  });
  offen = app;
  const anmelden = async (email: string) => {
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: PASSWORT },
    });
    expect(r.statusCode, r.body).toBe(200);
    return r.json().token as string;
  };
  const konten: Konto[] = [];
  for (const [name, email] of [
    ["Admin BPA-03", "admin-bpa03@example.test"],
    ["Person BPA-03", "person-bpa03@example.test"],
    ["Fremd BPA-03", "fremd-bpa03@example.test"],
  ] as const) {
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name, email, password: PASSWORT },
    });
    expect(r.statusCode, r.body).toBe(201);
    const id = r.json().id as string;
    if (konten.length === 0) {
      konten.push({ id, email, token: await anmelden(email) });
      continue;
    }
    const freigabe = await app.inject({
      method: "POST",
      url: `/api/auth/users/${id}/approve`,
      headers: kopf(konten[0]!.token),
    });
    expect(freigabe.statusCode, freigabe.body).toBeLessThan(300);
    konten.push({ id, email, token: await anmelden(email) });
  }
  const [admin, person, fremd] = konten as [Konto, Konto, Konto];
  const lege = async (wortlaut: string, teil: Record<string, unknown> = {}, token = person.token) =>
    app.inject({
      method: "POST",
      url: API,
      headers: kopf(token),
      payload: {
        vorgang: `vorgang-${randomUUID()}`,
        quelle: "getippt",
        wortlaut,
        // Abfrage und Anker binden nichts: gebunden wird Herkunft + Pfad.
        ziel: { tabId: TAB, url: `${ORIGIN}${PFAD}?neu=1#oben` },
        host: { browser: "Chromium", version: "130.0", erweiterung: "1.0.0" },
        ...teil,
      },
    });
  const liste = async (token = person.token) => {
    const r = await app.inject({ method: "GET", url: API, headers: kopf(token) });
    expect(r.statusCode, r.body).toBe(200);
    return r.json().auftraege as BrowserAuftragSicht[];
  };
  /** Legt einen Auftrag an und gibt die Leiste dazu zurück. */
  const starte = async (wortlaut: string, seite: Seite) => {
    const r = await lege(wortlaut);
    expect(r.statusCode, r.body).toBe(201);
    const start = r.json() as Antwort & { art: string };
    expect(start.art).toBe("auftrag");
    return { start, leiste: new Leiste(app, person.token, start.auftrag.id, seite) };
  };
  return { app, services, admin, person, fremd, anmelden, lege, liste, starte };
}

const schrittStaende = (a: BrowserAuftragSicht) => a.schritte.map((s) => `${s.art}:${s.stand}`);

describe("BPA-03 · Produktweg: Anlage und Übergabe", () => {
  it("P1 · ohne Anmeldung: 401 an jeder Tür", async () => {
    const { app } = await aufbau();
    const anlage = await app.inject({ method: "POST", url: API, payload: { wortlaut: ENTWURF } });
    expect(anlage.statusCode).toBe(401);
    const lesen = await app.inject({ method: "GET", url: API });
    expect(lesen.statusCode).toBe(401);
    const takt = await app.inject({
      method: "POST",
      url: `${API}/${randomUUID()}/takt`,
      payload: { folge: 1 },
    });
    expect(takt.statusCode).toBe(401);
  });

  it("P2 · nicht unterstützte Seite: Übergabe mit konkretem Schritt, kein Befehl, im Verlauf", async () => {
    const { lege, liste } = await aufbau();
    const r = await lege(ENTWURF, {
      ziel: { tabId: TAB, url: "https://fremd.test/formular" },
    });
    expect(r.statusCode, r.body).toBe(201);
    const a = r.json() as Antwort & { art: string };
    expect(a.art).toBe("auftrag");
    expect(a.befehl).toBeNull();
    expect(a.auftrag.stand).toBe("uebergabe");
    expect(a.auftrag.uebergabe?.grund).toBe("nicht_unterstuetzt");
    expect(a.auftrag.uebergabe?.schritt).toContain("https://fremd.test/formular");
    expect(a.auftrag.erfolg).toBe(false);
    const eintraege = await liste();
    expect(eintraege.map((e) => [e.id, e.stand])).toEqual([[a.auftrag.id, "uebergabe"]]);
  });

  it("P3 · mehrdeutiger Wortlaut: Klärung (200), nichts im Verlauf", async () => {
    const { lege, liste } = await aufbau();
    const r = await lege(`Betreff „${BETREFF}“ und speichere ihn.`);
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().art).toBe("klaerung");
    expect(r.json().text).toContain("Welches Formular");
    expect(await liste()).toEqual([]);
  });

  it('P4 · Entwurfsauftrag mit „bestelle": gesperrte Handlung, Übergabe, die Seite bleibt unberührt', async () => {
    const { lege } = await aufbau();
    const seite = seitenmodell();
    const r = await lege(
      `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}“ und speichere ihn als Entwurf, dann bestelle.`,
    );
    expect(r.statusCode, r.body).toBe(201);
    const a = r.json() as Antwort;
    expect(a.befehl).toBeNull();
    expect(a.auftrag.stand).toBe("uebergabe");
    expect(a.auftrag.uebergabe?.grund).toBe("gesperrte_handlung");
    expect(a.auftrag.uebergabe?.schritt).toContain('„bestelle"');
    expect(a.auftrag.schritte).toEqual([]);
    expect(seite.z).toMatchObject({ eintragungen: 0, speicherungen: 0, bestellungen: 0 });
  });
});

describe("BPA-03 · Produktweg: Lauf, Verlauf, Doppelklick", () => {
  it("P5 · getippter Auftrag: fertig und nachgelesen, genau eine Speicherung; der Verlauf trägt Aktionskennungen und keine Feldwerte", async () => {
    const { services, person, liste, starte } = await aufbau();
    const seite = seitenmodell();
    const { start, leiste } = await starte(ENTWURF, seite);
    expect(start.befehl?.art).toBe("lage");
    const ende = await leiste.treibe(start);
    expect(ende.stand).toBe("fertig");
    expect(ende.erfolg).toBe(true);
    expect(ende.ergebnis).toEqual({ entwurfId: "E-1", nachgelesen: true, zurueckgenommen: false });
    expect(seite.z.speicherungen).toBe(1);
    expect(seite.z.entwuerfe.at(-1)).toEqual({ id: "E-1", betreff: BETREFF });
    expect([...seite.z.felder.values()]).toEqual([BETREFF, EMPFAENGER, NACHRICHT]);
    expect(seite.z.versand + seite.z.bestellungen).toBe(0);
    expect(ende.host.adapter).toContain(FASSUNG);
    expect(ende.ruecknahmeAngebot).toBe("entwurf_loeschen");

    const [eintrag, ...rest] = await liste();
    expect(rest).toEqual([]);
    expect(eintrag?.id).toBe(leiste.id);
    expect(eintrag?.stand).toBe("fertig");
    expect(eintrag?.schritte.map((s) => s.aktionskennung)).toEqual(
      [1, 2, 3, 4, 5, 6].map((nr) => `klara-auftrag-${leiste.id}-${nr}`),
    );
    expect(eintrag?.schritte.map((s) => s.art)).toEqual([
      "lesen",
      "fuellen",
      "fuellen",
      "fuellen",
      "speichern",
      "nachlesen",
    ]);
    // Die abgelegte Fassung im Gespräch: Werte stehen nur im Wortlaut der Person.
    const g = await services.klaraGespraeche.aktuelles(person.id);
    const abgelegt = g?.browserAuftraege?.find((e) => e.id === leiste.id);
    expect(abgelegt?.stand).toBe("fertig");
    expect(abgelegt?.felder).toEqual(["Betreff", "Empfänger", "Nachricht"]);
    expect(abgelegt?.wortlaut).toContain(EMPFAENGER);
    const { wortlaut: _w1, ...ohneWortlaut } = abgelegt ?? { wortlaut: "" };
    const { wortlaut: _w2, ...sichtOhneWortlaut } = eintrag ?? { wortlaut: "" };
    for (const json of [JSON.stringify(ohneWortlaut), JSON.stringify(sichtOhneWortlaut)]) {
      for (const wert of [BETREFF, EMPFAENGER, NACHRICHT, LECKZEICHEN]) {
        expect(json).not.toContain(wert);
      }
    }
  });

  it("P6 · derselbe Vorgang zweimal (Doppelklick, AC07): derselbe Auftrag, genau eine Speicherung", async () => {
    const { app, person, lege, liste } = await aufbau();
    const seite = seitenmodell();
    const vorgang = `vorgang-${randomUUID()}`;
    const erst = await lege(ENTWURF, { vorgang });
    const zweit = await lege(ENTWURF, { vorgang });
    expect(erst.statusCode, erst.body).toBe(201);
    expect(zweit.statusCode, zweit.body).toBe(201);
    const a = erst.json() as Antwort;
    const b = zweit.json() as Antwort;
    expect(b.auftrag.id).toBe(a.auftrag.id);
    // Derselbe offene Befehl, kein zweiter Lauf.
    expect(b.befehl?.nr).toBe(a.befehl?.nr);
    expect(seite.z.speicherungen).toBe(0);
    const ende = await new Leiste(app, person.token, a.auftrag.id, seite).treibe(b);
    expect(ende.stand).toBe("fertig");
    expect(seite.z.speicherungen).toBe(1);
    // Ein dritter Klick nach dem Ende: derselbe Auftrag, kein Befehl, keine Wirkung.
    const dritt = await lege(ENTWURF, { vorgang });
    expect((dritt.json() as Antwort).auftrag.id).toBe(a.auftrag.id);
    expect((dritt.json() as Antwort).befehl).toBeNull();
    expect(seite.z.speicherungen).toBe(1);
    expect((await liste()).map((e) => e.id)).toEqual([a.auftrag.id]);
  });
});

describe("BPA-03 · Produktweg: Rechte je Schritt", () => {
  it("P7 · Rolle zwischen zwei Schritten entzogen (experte → viewer): gestoppt_recht, kein weiterer Eintrag, kein Speichern", async () => {
    const { app, admin, person, starte } = await aufbau();
    const seite = seitenmodell();
    const { start, leiste } = await starte(ENTWURF, seite);
    let herabgestuft = false;
    const ende = await leiste.treibe(start, async (b): Promise<Verhalten> => {
      if (b.art === "fuelle" && !herabgestuft) {
        herabgestuft = true;
        // Der vorhandene Verwaltungsweg; die Person bleibt angemeldet und behält `ko.read`.
        const r = await app.inject({
          method: "PUT",
          url: `/api/users/${person.id}`,
          headers: kopf(admin.token),
          payload: { role: "viewer" },
        });
        expect(r.statusCode, r.body).toBeLessThan(300);
      }
      return "antworten";
    });
    expect(ende.stand).toBe("gestoppt_recht");
    expect(ende.erfolg).toBe(false);
    // Der laufende Schritt meldet sein tatsächliches Ergebnis; danach geht nichts weiter.
    expect(schrittStaende(ende)).toEqual([
      "lesen:erfolgt",
      "fuellen:erfolgt",
      "fuellen:uebersprungen",
      "fuellen:uebersprungen",
      "speichern:uebersprungen",
      "nachlesen:uebersprungen",
    ]);
    expect(seite.z.eintragungen).toBe(1);
    expect([...seite.z.felder.values()]).toEqual([BETREFF, "", ""]);
    expect(seite.z.speicherungen).toBe(0);
    // Fortsetzen nach dem Entzug wirkt nicht mehr.
    const weiter = await leiste.steuere("fortsetzen");
    expect(weiter.statusCode, weiter.body).toBe(200);
    expect((await leiste.treibe(weiter.json() as Antwort)).stand).toBe("gestoppt_recht");
    expect(seite.z.eintragungen + seite.z.speicherungen).toBe(1);
  });

  it("P8 · Widerruf der Seitenfreigabe über die Steuerung, während ein Eintrag unterwegs ist: dessen Ergebnis steht, danach gestoppt_recht", async () => {
    const { starte } = await aufbau();
    const seite = seitenmodell();
    const { start, leiste } = await starte(ENTWURF, seite);
    let widerrufen = false;
    const ende = await leiste.treibe(start, async (b): Promise<Verhalten> => {
      if (b.art === "fuelle" && !widerrufen) {
        widerrufen = true;
        const r = await leiste.steuere("widerruf");
        expect(r.statusCode, r.body).toBe(200);
      }
      return "antworten";
    });
    expect(ende.stand).toBe("gestoppt_recht");
    expect(ende.erfolg).toBe(false);
    expect(ende.verlauf.map((v) => v.ereignis)).toContain("recht_entzogen");
    expect(seite.z.eintragungen).toBe(1);
    expect(seite.z.speicherungen).toBe(0);
  });

  it("P8 · Widerruf, den die Erweiterung im Takt meldet (seite.recht = entzogen, nichts ausgeführt): gestoppt_recht, die Seite bleibt unberührt", async () => {
    const { starte } = await aufbau();
    const seite = seitenmodell();
    const { start, leiste } = await starte(ENTWURF, seite);
    const ende = await leiste.treibe(start, (b) => (b.art === "fuelle" ? "entzogen" : "antworten"));
    expect(ende.stand).toBe("gestoppt_recht");
    expect(ende.erfolg).toBe(false);
    expect(ende.schritte.filter((s) => s.art !== "lesen").map((s) => s.stand)).toEqual(
      Array(5).fill("uebersprungen"),
    );
    expect(seite.z.eintragungen + seite.z.speicherungen).toBe(0);
  });

  it("P8 · Abmelden mitten im Lauf: die Erweiterung erreicht den Lauf nicht mehr; kein weiterer Schritt, kein Erfolg, nicht mehr steuerbar", async () => {
    const { app, person, anmelden, starte } = await aufbau();
    const seite = seitenmodell();
    const { start, leiste } = await starte(ENTWURF, seite);
    // Lesen und den ersten Eintrag beantworten; der Takt bringt die Lage vor dem zweiten Eintrag.
    let a: Antwort = start;
    while (a.befehl && seite.z.eintragungen < 1) {
      const r = await leiste.takt({
        antwort: { nr: a.befehl.nr, ergebnis: seite.fuehreAus(a.befehl) },
      });
      expect(r.statusCode, r.body).toBe(200);
      a = r.json() as Antwort;
    }
    expect(a.befehl?.art).toBe("lage");
    const aus = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: kopf(person.token),
    });
    expect(aus.statusCode).toBe(204);
    const danach = await leiste.takt({ antwort: { nr: a.befehl?.nr, ergebnis: null } });
    expect(danach.statusCode).toBe(401);
    // Die Antwortfrist (300 ms) verstreicht: die Lage kam nie zurück.
    await new Promise((weiter) => setTimeout(weiter, 450));
    const neu = await anmelden(person.email);
    const sicht = await app.inject({
      method: "GET",
      url: `${API}/${leiste.id}`,
      headers: kopf(neu),
    });
    expect(sicht.statusCode, sicht.body).toBe(200);
    const s = sicht.json().auftrag as BrowserAuftragSicht;
    expect(s.erfolg).toBe(false);
    expect(s.steuerbar).toBe(false);
    // Gemessen: „klaerung" (die Lage vor dem nächsten Schritt kam nicht zurück, bevor die
    // Rechteprüfung dieses Schritts lief). Beides ist ein Halt ohne weitere Wirkung.
    expect(["klaerung", "gestoppt_recht"]).toContain(s.stand);
    const weiter = await app.inject({
      method: "POST",
      url: `${API}/${leiste.id}/steuerung`,
      headers: kopf(neu),
      payload: { art: "fortsetzen" },
    });
    expect([weiter.statusCode, weiter.json().grund]).toEqual([409, "andere_sitzung"]);
    expect(seite.z.eintragungen).toBe(1);
    expect(seite.z.speicherungen).toBe(0);
  });
});

describe("BPA-03 · Produktweg: Bindung an Konto, Anmeldung und Folge", () => {
  it('P9 · fremdes Konto: 404 „unbekannt" wie eine unbekannte Kennung; eine zweite Anmeldung derselben Person steuert nicht (409 andere_sitzung)', async () => {
    const { app, fremd, person, anmelden, liste, starte } = await aufbau();
    const seite = seitenmodell();
    const { start, leiste } = await starte(ENTWURF, seite);
    expect((await leiste.treibe(start)).stand).toBe("fertig");
    const unbekannt = randomUUID();
    const wege = [
      {
        method: "POST" as const,
        pfad: (id: string) => `${API}/${id}/takt`,
        payload: { folge: 99 },
      },
      {
        method: "POST" as const,
        pfad: (id: string) => `${API}/${id}/steuerung`,
        payload: { art: "ruecknahme" },
      },
      { method: "GET" as const, pfad: (id: string) => `${API}/${id}`, payload: undefined },
    ];
    for (const w of wege) {
      const fremdR = await app.inject({
        method: w.method,
        url: w.pfad(leiste.id),
        headers: kopf(fremd.token),
        ...(w.payload ? { payload: w.payload } : {}),
      });
      const unbekanntR = await app.inject({
        method: w.method,
        url: w.pfad(unbekannt),
        headers: kopf(person.token),
        ...(w.payload ? { payload: w.payload } : {}),
      });
      expect([fremdR.statusCode, fremdR.json().grund], w.pfad("…")).toEqual([404, "unbekannt"]);
      expect([unbekanntR.statusCode, unbekanntR.json().grund]).toEqual([404, "unbekannt"]);
    }
    expect(await liste(fremd.token)).toEqual([]);
    // Dieselbe Person, neue Anmeldung: lesen ja, steuern nein.
    const zweite = await anmelden(person.email);
    expect(zweite).not.toBe(person.token);
    const takt = await app.inject({
      method: "POST",
      url: `${API}/${leiste.id}/takt`,
      headers: kopf(zweite),
      payload: { folge: 99 },
    });
    expect([takt.statusCode, takt.json().grund]).toEqual([409, "andere_sitzung"]);
    const steuerung = await app.inject({
      method: "POST",
      url: `${API}/${leiste.id}/steuerung`,
      headers: kopf(zweite),
      payload: { art: "ruecknahme" },
    });
    expect([steuerung.statusCode, steuerung.json().grund]).toEqual([409, "andere_sitzung"]);
    const sicht = await app.inject({
      method: "GET",
      url: `${API}/${leiste.id}`,
      headers: kopf(zweite),
    });
    expect(sicht.statusCode).toBe(200);
    expect(sicht.json().auftrag.steuerbar).toBe(false);
    // Keine der abgewiesenen Steuerungen hat gewirkt.
    expect(seite.z).toMatchObject({ speicherungen: 1, loeschungen: 0 });
  });

  it("P10 · eine Folgenummer, die nicht streng steigt, ist im Takt veraltet (409); an der Steuerung zählt sie nicht", async () => {
    const { app, person, starte } = await aufbau();
    const seite = seitenmodell();
    const { start, leiste } = await starte(ENTWURF, seite);
    const takt = (folge: unknown, body: Record<string, unknown> = {}) =>
      app.inject({
        method: "POST",
        url: `${API}/${leiste.id}/takt`,
        headers: kopf(person.token),
        payload: { folge, ...body },
      });
    const befehl = start.befehl as BrowserBefehl;
    const erst = await takt(5, { antwort: { nr: befehl.nr, ergebnis: seite.fuehreAus(befehl) } });
    expect(erst.statusCode, erst.body).toBe(200);
    for (const alt of [5, 4]) {
      const r = await takt(alt);
      expect([r.statusCode, r.json().grund]).toEqual([409, "veraltet"]);
    }
    for (const kaputt of [0, -1, "6", 6.5]) {
      const r = await takt(kaputt);
      expect([r.statusCode, r.json().grund], String(kaputt)).toEqual([400, "eingabe"]);
    }
    // Eine Steuerung mit kleiner Folge ist unschädlich (sie wird dort nicht geprüft).
    const steuerung = await leiste.steuere("fortsetzen", { folge: 1 });
    expect(steuerung.statusCode, steuerung.body).toBe(200);
    // Der Lauf geht mit der nächsten gültigen Folge normal zu Ende.
    const weiter = new Leiste(app, person.token, leiste.id, seite, 5);
    const ende = await weiter.treibe(erst.json() as Antwort);
    expect(ende.stand).toBe("fertig");
    expect(seite.z.speicherungen).toBe(1);
  });
});

describe("BPA-03 · Produktweg: Bestätigung, Rücknahme, Pause, unklarer Ausgang", () => {
  it('P11 · Sendeauftrag: hält vor „Endgültig senden", fremde Bestätigung 409, die passende sendet genau einmal; nicht rücknehmbar', async () => {
    const { starte } = await aufbau();
    const seite = seitenmodell();
    const { start, leiste } = await starte(SENDEN, seite);
    const halt = await leiste.treibe(start);
    expect(halt.stand).toBe("bestaetigung_noetig");
    expect(halt.bedarf?.knopf).toBe("Endgültig senden");
    expect(halt.bedarf?.fingerabdruck).toMatch(/^[0-9a-f]{64}$/);
    expect(halt.bedarf?.werte).toEqual([
      { label: "Betreff", wert: BETREFF },
      { label: "Empfänger", wert: EMPFAENGER },
      { label: "Nachricht", wert: NACHRICHT },
    ]);
    expect(seite.z.versand).toBe(0);
    expect([...seite.z.felder.values()]).toEqual([BETREFF, EMPFAENGER, NACHRICHT]);

    const falsch = await leiste.steuere("bestaetigen", { fingerabdruck: "0".repeat(64) });
    expect([falsch.statusCode, falsch.json().grund]).toEqual([409, "bestaetigung_passt_nicht"]);
    expect(seite.z.versand).toBe(0);

    const richtig = await leiste.steuere("bestaetigen", {
      fingerabdruck: halt.bedarf?.fingerabdruck,
    });
    expect(richtig.statusCode, richtig.body).toBe(200);
    const ende = await leiste.treibe(richtig.json() as Antwort);
    expect(ende.stand).toBe("fertig");
    expect(ende.erfolg).toBe(true);
    expect(ende.bestaetigung?.knopf).toBe("Endgültig senden");
    expect(seite.z.versand).toBe(1);
    expect(seite.z.speicherungen + seite.z.bestellungen).toBe(0);
    // Dieselbe Bestätigung ein zweites Mal findet keinen Bedarf mehr.
    const nochmal = await leiste.steuere("bestaetigen", {
      fingerabdruck: halt.bedarf?.fingerabdruck,
    });
    expect([nochmal.statusCode, nochmal.json().grund]).toEqual([409, "keine_bestaetigung"]);

    expect(ende.ruecknahmeAngebot).toBe("nicht_ruecknehmbar");
    const rueck = await leiste.steuere("ruecknahme");
    expect(rueck.statusCode, rueck.body).toBe(200);
    const nach = await leiste.treibe(rueck.json() as Antwort);
    expect(nach.ruecknahme?.art).toBe("nicht_ruecknehmbar");
    expect(seite.z).toMatchObject({ versand: 1, loeschungen: 0 });
  });

  it("P12 · Rücknahme löscht genau den eigenen Entwurf; der ältere mit demselben Betreff bleibt", async () => {
    const { starte } = await aufbau();
    const seite = seitenmodell();
    const { start, leiste } = await starte(ENTWURF, seite);
    expect((await leiste.treibe(start)).ergebnis?.entwurfId).toBe("E-1");
    const rueck = await leiste.steuere("ruecknahme");
    expect(rueck.statusCode, rueck.body).toBe(200);
    const nach = await leiste.treibe(rueck.json() as Antwort);
    expect(nach.ruecknahme?.art).toBe("zurueckgenommen");
    expect(nach.ruecknahme?.text).toContain("Entwurf E-1 gelöscht");
    expect(nach.ergebnis).toEqual({ entwurfId: "E-1", nachgelesen: true, zurueckgenommen: true });
    expect(seite.z.entwuerfe.map((e) => e.id)).toEqual(["E-alt-1", "E-alt-2"]);
    expect(seite.z.loeschungen).toBe(1);
    expect(seite.z.speicherungen).toBe(1);
  });

  it("P12 · nach der Rücknahme des Entwurfs bietet die Sicht nichts an, was eine Rücknahme nicht mehr kann", async () => {
    const { starte } = await aufbau();
    const seite = seitenmodell();
    const { start, leiste } = await starte(ENTWURF, seite);
    await leiste.treibe(start);
    const nach = await leiste.treibe((await leiste.steuere("ruecknahme")).json() as Antwort);
    expect(nach.ruecknahme?.art).toBe("zurueckgenommen");
    // Eine zweite Rücknahme bewirkt nichts mehr …
    const zweite = await leiste.treibe((await leiste.steuere("ruecknahme")).json() as Antwort);
    expect(zweite.ruecknahme?.art).toBe("nichts");
    expect(seite.z.loeschungen).toBe(1);
    // … also darf die Sicht davor auch nichts anbieten („angeboten wird nur, was möglich ist").
    expect(nach.ruecknahmeAngebot).toBeNull();
  });

  it("P13 · Pause hält vor dem nächsten Schritt und zeigt Erfolgtes; Fortsetzen speichert genau einmal", async () => {
    const { starte } = await aufbau();
    const seite = seitenmodell();
    const { start, leiste } = await starte(ENTWURF, seite);
    let pausiert = false;
    const halt = await leiste.treibe(start, async (b): Promise<Verhalten> => {
      if (b.art === "fuelle" && !pausiert) {
        pausiert = true;
        const r = await leiste.steuere("pause");
        expect(r.statusCode, r.body).toBe(200);
      }
      return "antworten";
    });
    expect(halt.stand).toBe("pausiert");
    expect(halt.erfolg).toBe(false);
    expect(schrittStaende(halt)).toEqual([
      "lesen:erfolgt",
      "fuellen:erfolgt",
      "fuellen:offen",
      "fuellen:offen",
      "speichern:offen",
      "nachlesen:offen",
    ]);
    expect(halt.text).toContain("1 von 3 Feldern eingetragen");
    expect(seite.z).toMatchObject({ eintragungen: 1, speicherungen: 0 });
    const weiter = await leiste.steuere("fortsetzen");
    expect(weiter.statusCode, weiter.body).toBe(200);
    const ende = await leiste.treibe(weiter.json() as Antwort);
    expect(ende.stand).toBe("fertig");
    expect(ende.erfolg).toBe(true);
    expect(seite.z).toMatchObject({ eintragungen: 3, speicherungen: 1 });
    expect(ende.verlauf.map((v) => v.ereignis)).toEqual(
      expect.arrayContaining(["pausiert", "fortgesetzt", "gespeichert", "nachgelesen"]),
    );
  });

  it("P14 · Antwort nach dem Speicherklick verloren: unklar; Fortsetzen gleicht lesend ab, kein zweiter Klick", async () => {
    const { starte } = await aufbau();
    const seite = seitenmodell();
    const { start, leiste } = await starte(ENTWURF, seite);
    let verloren = false;
    const halt = await leiste.treibe(start, (b) => {
      if (b.art === "klicke" && !verloren) {
        verloren = true;
        return "schweigen";
      }
      return "antworten";
    });
    expect(halt.stand).toBe("unklar");
    expect(halt.erfolg).toBe(false);
    expect(halt.schritte.find((s) => s.art === "speichern")?.stand).toBe("unklar");
    expect(halt.ruecknahmeAngebot).toBe("unklar");
    // Die Seite HAT gespeichert — nur die Antwort kam nie an.
    expect(seite.z.speicherungen).toBe(1);
    const weiter = await leiste.steuere("fortsetzen");
    expect(weiter.statusCode, weiter.body).toBe(200);
    const ende = await leiste.treibe(weiter.json() as Antwort);
    expect(ende.stand).toBe("fertig");
    expect(ende.erfolg).toBe(true);
    expect(ende.ergebnis?.entwurfId).toBe("E-1");
    expect(ende.schritte.find((s) => s.art === "speichern")?.beleg).toContain("abgeglichen");
    expect(seite.z.speicherungen).toBe(1);
    expect(seite.z.entwuerfe.map((e) => e.id)).toEqual(["E-alt-1", "E-alt-2", "E-1"]);
  });
});

// ================================================================================================
// Gegenproben zu den Befunden der unabhängigen Prüfung (Chat 62, 17.10.2026) — am Produktweg.
// ================================================================================================
describe("BPA-03 · Produktweg: Gegenproben zu den Prüfbefunden", () => {
  it("M6 · ein Feld ändert sich nach dem Eintragen: kein Speichern, Klärung statt Erfolg", async () => {
    const { starte } = await aufbau();
    const seite = seitenmodell();
    const { start, leiste } = await starte(ENTWURF, seite);
    let geaendert = false;
    const ende = await leiste.treibe(start, (b) => {
      if (b.art === "lage" && seite.z.eintragungen === 3 && !geaendert) {
        geaendert = true;
        seite.z.felder.set("Empfänger", "angreifer@beispiel.invalid");
      }
      return "antworten";
    });
    expect(ende.stand).toBe("klaerung");
    expect(ende.erfolg).toBe(false);
    expect(ende.klaerung).toContain("Empfänger");
    expect(seite.z.speicherungen).toBe(0);
  });

  it("M7 · Pause direkt nach dem Speicherklick: der Text sagt „ausgelöst, noch nicht nachgelesen“, nie „nichts gespeichert“", async () => {
    const { starte } = await aufbau();
    const seite = seitenmodell();
    const { start, leiste } = await starte(ENTWURF, seite);
    const ende = await leiste.treibe(start, async (b): Promise<Verhalten> => {
      if (b.art === "klicke") {
        const r = await leiste.steuere("pause");
        expect(r.statusCode, r.body).toBe(200);
      }
      return "antworten";
    });
    expect(ende.stand).toBe("pausiert");
    expect(seite.z.speicherungen).toBe(1);
    expect(ende.text).toContain("Speichern ausgelöst, noch nicht nachgelesen");
    expect(ende.text).not.toContain("Nichts gespeichert");
  });

  it("M8 · Rücknahme: Löschen wirkt, das Nachlesen bleibt ohne Antwort — „unklar“, kein falsches „gespeichert“, kein neues Angebot", async () => {
    const { starte } = await aufbau();
    const seite = seitenmodell();
    const { start, leiste } = await starte(ENTWURF, seite);
    const fertig = await leiste.treibe(start);
    expect(fertig.ruecknahmeAngebot).toBe("entwurf_loeschen");
    const r = await leiste.steuere("ruecknahme");
    expect(r.statusCode, r.body).toBe(200);
    let geloescht = false;
    const ende = await leiste.treibe(r.json() as Antwort, (b) => {
      if (b.art === "loesche") geloescht = true;
      return geloescht && b.art === "lage" ? "schweigen" : "antworten";
    });
    expect(seite.z.loeschungen).toBe(1);
    expect(ende.ruecknahme?.art).toBe("unklar");
    expect(ende.ruecknahmeAngebot).toBe("unklar");
    expect(ende.text).not.toContain("ist gespeichert");
    expect(ende.text).toContain("unklar");
  });

  it("M9 · fünf beendete Läufe sperren das Konto nicht: der sechste Auftrag läuft", async () => {
    const { starte } = await aufbau();
    for (let i = 0; i < 5; i++) {
      const seite = seitenmodell();
      const { start, leiste } = await starte(ENTWURF, seite);
      const ab = await leiste.steuere("abbruch");
      expect(ab.statusCode, ab.body).toBe(200);
      const ende = await leiste.treibe(ab.json() as Antwort);
      expect(ende.stand).toBe("abgebrochen");
      expect(start.auftrag.id).toBeTruthy();
    }
    const seite = seitenmodell();
    const { start, leiste } = await starte(ENTWURF, seite);
    const ende = await leiste.treibe(start);
    expect(ende.stand).toBe("fertig");
    expect(seite.z.speicherungen).toBe(1);
  });

  it("m1 · das Gespräch wird während des Laufs gelöscht: es entsteht kein neues mit dem Auftrag", async () => {
    const { app, person, starte } = await aufbau();
    const seite = seitenmodell();
    const { start, leiste } = await starte(ENTWURF, seite);
    const gid = start.auftrag.gespraechId;
    expect(gid).toBeTruthy();
    const weg = await app.inject({
      method: "DELETE",
      url: `/api/me/klara/gespraeche/${gid}`,
      headers: kopf(person.token),
    });
    expect(weg.statusCode, weg.body).toBeLessThan(300);
    const ende = await leiste.treibe(start);
    expect(ende.stand).toBe("fertig");
    const aktuell = await app.inject({
      method: "GET",
      url: "/api/me/klara/gespraech",
      headers: kopf(person.token),
    });
    expect(aktuell.statusCode).toBe(200);
    expect(aktuell.json().gespraech).toBeNull();
  });

  it("m3 · eine fremd geformte Entwurfskennung der Seite wird nicht übernommen: unklar statt Beleg", async () => {
    const { starte, liste } = await aufbau();
    const seite = seitenmodell();
    const { start, leiste } = await starte(ENTWURF, seite);
    const ende = await leiste.treibe(start, (b) => {
      const neu = seite.z.entwuerfe.find((e) => e.id === "E-1");
      if (neu) neu.id = "E-1 <b>Angriff</b>";
      return b.art === "lage" ? "antworten" : "antworten";
    });
    expect(ende.stand).toBe("unklar");
    expect(ende.ergebnis).toBeNull();
    expect(JSON.stringify(await liste())).not.toContain("<b>");
  });

  it("m6 · derselbe Vorgang nach einem Neustart des Servers: derselbe Auftrag, keine zweite Speicherung", async () => {
    const { services, person, app } = await aufbau();
    const seite = seitenmodell();
    const vorgang = `vorgang-${randomUUID()}`;
    const anlage = (a: FastifyInstance) =>
      a.inject({
        method: "POST",
        url: API,
        headers: kopf(person.token),
        payload: {
          vorgang,
          quelle: "getippt",
          wortlaut: ENTWURF,
          ziel: { tabId: TAB, url: `${ORIGIN}${PFAD}` },
          host: { browser: "Chromium", version: "130.0", erweiterung: "1.0.0" },
        },
      });
    const r1 = await anlage(app);
    expect(r1.statusCode, r1.body).toBe(201);
    const erste = r1.json() as Antwort;
    await new Leiste(app, person.token, erste.auftrag.id, seite).treibe(erste);
    expect(seite.z.speicherungen).toBe(1);
    // Neustart: dieselbe Ablage (Konten, Sitzungen, Gespräche), neuer Prozesszustand.
    const neu = buildApp(services, {
      browserAktion: {
        seitenprofile: [TESTSEITE],
        fristen: { abholMs: 300, antwortMs: 300, taktMs: 200 },
      },
    });
    try {
      const r2 = await anlage(neu);
      expect(r2.statusCode, r2.body).toBe(201);
      const zweite = r2.json() as Antwort;
      expect(zweite.auftrag.id).toBe(erste.auftrag.id);
      expect(zweite.befehl).toBeNull();
      expect(zweite.auftrag.steuerbar).toBe(false);
      expect(zweite.auftrag.stand).toBe("fertig");
      expect(seite.z.speicherungen).toBe(1);
    } finally {
      await neu.close();
    }
  });

  it("m7 · eine Seite ohne Löschen: der gespeicherte Entwurf wird ehrlich „kein Löschen“ genannt, nicht „Außenwirkung“", async () => {
    const ohneLoeschen = {
      ...TESTSEITE,
      id: "bpa03-synthetisch-ohne-loeschen",
      formulare: TESTSEITE.formulare.map((f) => ({
        ...f,
        handlungen: f.handlungen.filter((h) => h.art !== "entwurf_loeschen"),
      })),
    };
    const services = buildServices();
    const app = buildApp(services, {
      browserAktion: {
        seitenprofile: [ohneLoeschen],
        fristen: { abholMs: 300, antwortMs: 300, taktMs: 200 },
      },
    });
    offen = app;
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Erste Person", email: "erste-bpa03@example.test", password: PASSWORT },
    });
    expect(r.statusCode, r.body).toBe(201);
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "erste-bpa03@example.test", password: PASSWORT },
    });
    const token = login.json().token as string;
    const seite = seitenmodell();
    const a = await app.inject({
      method: "POST",
      url: API,
      headers: kopf(token),
      payload: {
        vorgang: `vorgang-${randomUUID()}`,
        quelle: "getippt",
        wortlaut: ENTWURF,
        ziel: { tabId: TAB, url: `${ORIGIN}${PFAD}` },
        host: { browser: "Chromium", version: "130.0", erweiterung: "1.0.0" },
      },
    });
    expect(a.statusCode, a.body).toBe(201);
    const start = a.json() as Antwort;
    const ende = await new Leiste(app, token, start.auftrag.id, seite).treibe(start);
    expect(ende.stand).toBe("fertig");
    expect(ende.ruecknahmeAngebot).toBe("kein_loeschen");
  });
});

/** Die Erweiterung im Takt, die zusätzlich jeden Antwortkörper des Servers mitschreibt. */
class Mitschnitt extends Leiste {
  readonly koerper: string[] = [];

  override async takt(body: Record<string, unknown> = {}) {
    const r = await super.takt(body);
    this.koerper.push(r.body);
    return r;
  }

  override async steuere(art: string, extra: Record<string, unknown> = {}) {
    const r = await super.steuere(art, extra);
    this.koerper.push(r.body);
    return r;
  }
}

/** Beantwortet Befehle, bis ein Befehl der Art `art` kommt — der wird NICHT beantwortet. */
async function bisZu(leiste: Leiste, seite: Seite, start: Antwort, art: BrowserBefehl["art"]) {
  let { befehl } = start;
  for (let i = 0; i < 200; i++) {
    if (befehl?.art === art) return befehl;
    const body = befehl
      ? {
          antwort: { nr: befehl.nr, ergebnis: seite.fuehreAus(befehl) },
          seite: { adapter: FASSUNG },
        }
      : {};
    const r = await leiste.takt(body);
    expect(r.statusCode, r.body).toBe(200);
    ({ befehl } = r.json() as Antwort);
  }
  throw new Error(`Kein Befehl ${art}.`);
}

const WIRKUNGEN: readonly string[] = ["fuelle", "klicke", "loesche"];

describe("BPA-03 · Produktweg: Einordnung für die Prüftorregister (Chat 57)", () => {
  it("Q1 · Datenfluss: kein Inhalt eines Wissensobjekts reist zur Erweiterung — Befehle tragen nur Werte aus dem Wortlaut, Namen aus dem Profil und Gelesenes derselben Seite", async () => {
    const { app, person, lege, liste } = await aufbau();
    // Ein Wissensobjekt DERSELBEN Person mit eindeutiger Marke (auch als Adresse geformt).
    const MARKE = `KOMARKE${randomUUID().replace(/-/g, "")}`;
    const ko = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: kopf(person.token),
      payload: {
        confidentiality: "intern",
        title: `${MARKE} Angebot Kühlanlage`,
        statement: `${MARKE} Empfänger ${MARKE}@ko.invalid`,
        type: "best_practice",
        category: "K",
      },
    });
    expect(ko.statusCode, ko.body).toBe(201);
    const koerper: string[] = [];
    const befehle: BrowserBefehl[] = [];
    const merke = (b: BrowserBefehl): "antworten" => {
      befehle.push(b);
      return "antworten";
    };
    for (const wortlaut of [ENTWURF, SENDEN]) {
      const seite = seitenmodell();
      const r = await lege(wortlaut);
      expect(r.statusCode, r.body).toBe(201);
      koerper.push(r.body);
      const start = r.json() as Antwort;
      const leiste = new Mitschnitt(app, person.token, start.auftrag.id, seite);
      let ende = await leiste.treibe(start, merke);
      if (ende.bedarf) {
        const ja = await leiste.steuere("bestaetigen", {
          fingerabdruck: ende.bedarf.fingerabdruck,
        });
        ende = await leiste.treibe(ja.json() as Antwort, merke);
        expect(seite.z.versand).toBe(1);
      } else {
        const rueck = await leiste.steuere("ruecknahme");
        ende = await leiste.treibe(rueck.json() as Antwort, merke);
        expect(ende.ruecknahme?.art).toBe("zurueckgenommen");
      }
      expect(ende.stand).toBe("fertig");
      koerper.push(...leiste.koerper);
      const einzeln = await app.inject({
        method: "GET",
        url: `${API}/${start.auftrag.id}`,
        headers: kopf(person.token),
      });
      expect(einzeln.statusCode, einzeln.body).toBe(200);
      koerper.push(einzeln.body);
    }
    koerper.push(JSON.stringify(await liste()));
    // Keine Antwort einer der fünf Türen trägt etwas aus dem Wissensobjekt.
    expect(koerper.join("\n")).not.toContain(MARKE);
    expect(new Set(befehle.map((b) => b.art))).toEqual(
      new Set(["lage", "fuelle", "klicke", "loesche"]),
    );
    // Jeder geschriebene oder beim Klick verglichene Wert stammt aus dem Wortlaut der Person; ein
    // erwarteter Altwert ist das, was dieselbe Seite vorher meldete (hier: leer).
    const auftragswerte = new Set([BETREFF, EMPFAENGER, NACHRICHT]);
    for (const b of befehle) {
      const a = b.args as Record<string, unknown>;
      if (b.art === "fuelle") {
        expect(auftragswerte.has(String(a.wert)), String(a.wert)).toBe(true);
        if (a.erwartet !== undefined) expect(a.erwartet).toBe("");
      }
      if (b.art === "klicke") {
        for (const w of (a.werte ?? []) as { wert: string }[]) {
          expect(auftragswerte.has(w.wert), w.wert).toBe(true);
        }
      }
    }
  });

  for (const k of [1, 2, 3, 4]) {
    it(`Q2 · frische ko.create-Prüfung je Wirkung am Draht: Rolle unmittelbar vor der ${k}. Wirkung entzogen → genau ${k - 1} Wirkung(en), kein weiterer Wirkbefehl, gestoppt_recht`, async () => {
      const { app, admin, person, starte } = await aufbau();
      const seite = seitenmodell();
      const { start, leiste } = await starte(ENTWURF, seite);
      let gesehen = 0;
      let wirkungen = 0;
      let entzogen = false;
      const ende = await leiste.treibe(start, async (b): Promise<Verhalten> => {
        gesehen++;
        if (WIRKUNGEN.includes(b.art)) wirkungen++;
        // Entzogen wird, sobald der Befehl VOR der k-ten Wirkung ausgegeben ist (vor seiner Antwort).
        const jetzt = k === 1 ? gesehen === 1 : WIRKUNGEN.includes(b.art) && wirkungen === k - 1;
        if (jetzt && !entzogen) {
          entzogen = true;
          const r = await app.inject({
            method: "PUT",
            url: `/api/users/${person.id}`,
            headers: kopf(admin.token),
            payload: { role: "viewer" },
          });
          expect(r.statusCode, r.body).toBeLessThan(300);
        }
        return "antworten";
      });
      expect(entzogen).toBe(true);
      expect(wirkungen).toBe(k - 1);
      expect(seite.z.eintragungen + seite.z.speicherungen).toBe(k - 1);
      expect(ende.stand).toBe("gestoppt_recht");
      expect(ende.erfolg).toBe(false);
    });
  }

  it("Q3 · Sendeauftrag: Rolle nach der Bestätigungsfrage entzogen — die Bestätigung allein löst nichts aus, der Sendeklick wird nie ausgegeben", async () => {
    const { app, admin, person, starte } = await aufbau();
    const seite = seitenmodell();
    const { start, leiste } = await starte(SENDEN, seite);
    const halt = await leiste.treibe(start);
    expect(halt.stand).toBe("bestaetigung_noetig");
    const r = await app.inject({
      method: "PUT",
      url: `/api/users/${person.id}`,
      headers: kopf(admin.token),
      payload: { role: "viewer" },
    });
    expect(r.statusCode, r.body).toBeLessThan(300);
    const ja = await leiste.steuere("bestaetigen", { fingerabdruck: halt.bedarf?.fingerabdruck });
    const klicks: string[] = [];
    const ende =
      ja.statusCode === 200
        ? await leiste.treibe(ja.json() as Antwort, (b) => {
            if (b.art === "klicke") klicks.push(String((b.args as { knopf?: unknown }).knopf));
            return "antworten";
          })
        : halt;
    expect(klicks).toEqual([]);
    expect(seite.z.versand).toBe(0);
    expect(ja.statusCode === 200 ? ende.stand : "gestoppt_recht").toBe("gestoppt_recht");
  });

  it("Q4 · Rücknahme ist eine Wirkung: Rolle vor der Rücknahme entzogen — kein Löschbefehl, nichts gelöscht", async () => {
    const { app, admin, person, starte } = await aufbau();
    const seite = seitenmodell();
    const { start, leiste } = await starte(ENTWURF, seite);
    const fertig = await leiste.treibe(start);
    expect(fertig.ruecknahmeAngebot).toBe("entwurf_loeschen");
    const r = await app.inject({
      method: "PUT",
      url: `/api/users/${person.id}`,
      headers: kopf(admin.token),
      payload: { role: "viewer" },
    });
    expect(r.statusCode, r.body).toBeLessThan(300);
    const rueck = await leiste.steuere("ruecknahme");
    expect(rueck.statusCode, rueck.body).toBe(200);
    const arten: string[] = [];
    const nach = await leiste.treibe(rueck.json() as Antwort, (b): Verhalten => {
      arten.push(b.art);
      return "antworten";
    });
    expect(arten).not.toContain("loesche");
    expect(seite.z.loeschungen).toBe(0);
    expect(nach.ruecknahme?.text).toContain("Recht");
  });

  it("N2 · derselbe Vorgang erneut, während der Speicherklick abgeholt und unbeantwortet ist: derselbe Lauf, der Klick kommt als „wiederholt“ (die Erweiterung führt ihn ohne gemerkte Antwort nicht aus)", async () => {
    const { app, person, lege } = await aufbau();
    const seite = seitenmodell();
    const vorgang = `vorgang-${randomUUID()}`;
    const r1 = await lege(ENTWURF, { vorgang });
    expect(r1.statusCode, r1.body).toBe(201);
    const erste = r1.json() as Antwort;
    const leiste = new Leiste(app, person.token, erste.auftrag.id, seite);
    const klick = await bisZu(leiste, seite, erste, "klicke");
    expect(klick.wiederholt).toBe(false);
    const r2 = await lege(ENTWURF, { vorgang });
    expect(r2.statusCode, r2.body).toBe(201);
    const zweite = r2.json() as Antwort;
    expect(zweite.auftrag.id).toBe(erste.auftrag.id);
    expect(zweite.befehl).toMatchObject({ nr: klick.nr, art: "klicke", wiederholt: true });
    expect(seite.z.speicherungen).toBe(0);
  });

  it("N3 · derselbe Vorgang erst auf einer nicht unterstützten Seite, dann auf der richtigen: neu geprüft (neuer Lauf); nach dem fertigen Lauf bleibt er derselbe", async () => {
    const { app, person, lege } = await aufbau();
    const seite = seitenmodell();
    const vorgang = `vorgang-${randomUUID()}`;
    const r1 = await lege(ENTWURF, {
      vorgang,
      ziel: { tabId: TAB, url: "https://fremd.test/formular" },
    });
    const eins = r1.json() as Antwort;
    expect(eins.auftrag.stand).toBe("uebergabe");
    const r2 = await lege(ENTWURF, { vorgang });
    expect(r2.statusCode, r2.body).toBe(201);
    const zwei = r2.json() as Antwort;
    expect(zwei.auftrag.id).not.toBe(eins.auftrag.id);
    expect(zwei.befehl).not.toBeNull();
    const ende = await new Leiste(app, person.token, zwei.auftrag.id, seite).treibe(zwei);
    expect(ende.stand).toBe("fertig");
    const r3 = await lege(ENTWURF, { vorgang });
    expect((r3.json() as Antwort).auftrag.id).toBe(zwei.auftrag.id);
    expect((r3.json() as Antwort).befehl).toBeNull();
    expect(seite.z.speicherungen).toBe(1);
  });
});
