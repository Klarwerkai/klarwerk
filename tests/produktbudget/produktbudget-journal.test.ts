// ================================================================================================
// produkt:20261013:produktbudget-anwender-admin · DIE PRODUKTBUDGETS IM DESKTOP-JOURNALBETRIEB.
// ================================================================================================
//
// Ben, nacharbeit-2 (PBE-06/08): im Journalbetrieb (`buildDevPersistServices`) lagen Einstellungen,
// Provenienz, Buchungen und Reservierungen nur im Speicher und waren nach dem Neustart weg. Hier
// wird der Journalweg selbst gemessen — eine echte Journaldatei, ein echter zweiter Aufbau aus ihr.
// Fiktive Konten und Beträge, kein Modell, kein Netz.
//
//   J1  Einstellung, Provenienz, Reservierung und Buchung überstehen den Neustart
//   J2  am Draht: Admin speichert, Neustart, Anmeldung, derselbe Stand
//   J3  ohne geschriebene Zeile keine Bestätigung: gesperrtes Journal → Fehler, nichts gilt
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildApp } from "../../services/app/src/build-app";
import { JournalSchreibsperre, buildDevPersistServices } from "../../services/app/src/dev-persist";
import { Produktbudget } from "../../services/app/src/produktbudget";

const MANDANT = "instanz";
const ADMIN = { name: "Ada Fiktiv", email: "ada.journal@beispiel.test", password: "geheim-1234" };

const neuesJournal = (): string =>
  join(mkdtempSync(join(tmpdir(), "kw-produktbudget-journal-")), "journal.jsonl");

async function dienstAus(datei: string, sperre?: JournalSchreibsperre): Promise<Produktbudget> {
  const services = await buildDevPersistServices(datei, sperre);
  return new Produktbudget({ repo: services.produktbudget, mandant: MANDANT });
}

async function perplexity(d: Produktbudget) {
  const b = (await d.lies()).bereiche.find((x) => x.bereich === "perplexity-poc");
  if (!b) {
    throw new Error("Perplexity-Bereich fehlt");
  }
  return b;
}

describe("Produktbudgets im Journalbetrieb", () => {
  it("J1 · Einstellung, Provenienz, Reservierung und Buchung überstehen den Neustart", async () => {
    const datei = neuesJournal();
    const erste = await dienstAus(datei);
    await erste.aendere("konto-admin", "perplexity-poc", {
      betrag: "18,50",
      waehrung: "EUR",
      zeitraum: "einmalig",
      fassung: 0,
      aenderungId: "journal-aenderung-1",
      grund: "fiktiver Grund",
    });
    const reservierung = {
      zuordnung: "perplexity-poc",
      cent: 500,
      nutzer: "konto-a",
      auftragId: "journal-auftrag-1",
      versuch: 1,
      anbieter: "perplexity",
      waehrung: "EUR",
    };
    expect(await erste.reserviere(reservierung)).toBe(true);
    expect(await erste.reserviere({ ...reservierung, auftragId: "journal-auftrag-2" })).toBe(true);
    await erste.verbuche("perplexity-poc", 400, "journal-auftrag-2", {
      nutzer: "konto-a",
      versuch: 1,
    });

    const zweite = await dienstAus(datei);
    const p = await perplexity(zweite);
    expect(p).toMatchObject({
      betragCent: 1850,
      fassung: 1,
      geaendertVon: "konto-admin",
      reserviertCent: 500,
      verbrauchtCent: 400,
      verbleibendCent: 950,
      buchungen: 2,
    });
    expect(p.letzteAenderungen.map((a) => [a.aenderungId, a.grund])).toEqual([
      ["journal-aenderung-1", "fiktiver Grund"],
    ]);
    // Die Reservierung gilt nach dem Neustart weiter: dieselbe Ausführung reserviert nicht doppelt,
    // eine neue zählt gegen den verbliebenen Rest.
    expect(await zweite.reserviere(reservierung)).toBe(true);
    const zuViel = { ...reservierung, auftragId: "journal-auftrag-3", cent: 1000 };
    expect(await zweite.reserviere(zuViel)).toBe(false);
    // Und ein dritter Aufbau sieht auch, was nach dem ersten Neustart geschrieben wurde.
    await zweite.aendere("konto-admin", "perplexity-poc", {
      betrag: "19",
      waehrung: "EUR",
      zeitraum: "einmalig",
      fassung: 1,
      aenderungId: "journal-aenderung-2",
    });
    expect(await perplexity(await dienstAus(datei))).toMatchObject({
      betragCent: 1900,
      fassung: 2,
      buchungen: 2,
    });
  });

  it("J2 · am Draht: speichern, Neustart, Anmeldung, derselbe Stand", async () => {
    const datei = neuesJournal();
    const app1 = buildApp(await buildDevPersistServices(datei));
    await app1.inject({ method: "POST", url: "/api/auth/register", payload: ADMIN });
    const anmelden = async (app: ReturnType<typeof buildApp>) => {
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: ADMIN.email, password: ADMIN.password },
      });
      const token = (login.json() as { token?: string }).token ?? "";
      expect(token, "der fiktive Admin muss sich anmelden können").not.toBe("");
      return { authorization: `Bearer ${token}` };
    };
    const put = await app1.inject({
      method: "PUT",
      url: "/api/admin/produktbudget/perplexity-poc",
      headers: await anmelden(app1),
      payload: {
        betrag: "21",
        waehrung: "EUR",
        zeitraum: "einmalig",
        fassung: 0,
        aenderungId: "journal-draht-0001",
      },
    });
    expect(put.statusCode, put.body).toBe(200);
    await app1.close();

    const app2 = buildApp(await buildDevPersistServices(datei));
    const get = await app2.inject({
      method: "GET",
      url: "/api/admin/produktbudget",
      headers: await anmelden(app2),
    });
    expect(get.statusCode, get.body).toBe(200);
    type Bereich = { bereich: string; betragCent: number; fassung: number };
    const bereiche = (get.json() as { bereiche: Bereich[] }).bereiche;
    const p = bereiche.find((b) => b.bereich === "perplexity-poc");
    expect(p).toMatchObject({ betragCent: 2100, fassung: 1 });
    await app2.close();
  });

  it("J3 · gesperrtes Journal: die Änderung und die Reservierung scheitern, nichts gilt", async () => {
    const datei = neuesJournal();
    const sperre = new JournalSchreibsperre();
    const d = await dienstAus(datei, sperre);
    sperre.setzen();
    await expect(
      d.aendere("konto-admin", "perplexity-poc", {
        betrag: "5",
        waehrung: "EUR",
        zeitraum: "einmalig",
        fassung: 0,
        aenderungId: "journal-gesperrt-1",
      }),
    ).rejects.toThrow();
    await expect(
      d.reserviere({
        zuordnung: "perplexity-poc",
        cent: 500,
        nutzer: "konto-a",
        auftragId: "journal-gesperrt-auftrag",
        versuch: 1,
        anbieter: "perplexity",
        waehrung: "EUR",
      }),
    ).rejects.toThrow();
    sperre.loesen();
    expect(await perplexity(d)).toMatchObject({ betragCent: 2000, fassung: 0, buchungen: 0 });
    expect(await perplexity(await dienstAus(datei))).toMatchObject({
      betragCent: 2000,
      fassung: 0,
      buchungen: 0,
    });
  });
});
