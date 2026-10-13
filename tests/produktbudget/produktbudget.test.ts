// ================================================================================================
// produkt:20261013:produktbudget-anwender-admin — DER DIENST UND DAS KOSTENBUCH.
// ================================================================================================
//
// Modellfrei, ohne Netz, ohne Zugang. Alle Konten, Aufträge und Beträge sind fiktiv; jeder Adapter
// ist ein Ersatztransport. Belegt werden Einstellung, Geld, Persistenz über eine neue Instanz,
// Wiederholung, Konflikt und der Deckel unter parallelen Aufrufen — NICHT eine reale Anbieterwirkung.
//
//   B1  Originalvorgaben: Perplexity 20 EUR einmalig (ersetzt 30 USD/Monat), Nr. 32 je 20 EUR offen
//   B2  Geld exakt in Cent; 0 erlaubt (stoppt), negativ/ungültig/zu hoch abgewiesen
//   B3  Speichern, neu lesen, neue Instanz (Neustart) — derselbe Stand, Provenienz ohne Geheimnis
//   B4  Wiederholung derselben Änderung: kein zweiter Eintrag; veraltete Fassung: 409 mit Stand
//   B5  Offener Zeitraum: kein Kostenweg; Festlegen nur mit Beleg
//   B6  Buchungen bleiben bei Senkung/Erhöhung; Währung ist an Buchungen gebunden
//   B7  Reservierung: atomar, parallel nie über dem Deckel, je Auftrag einmal, Anbieter/Währung
//   B8  Am Ausführungsweg: parallele Fähigkeitsaufträge, Neustart, Wiederholung, Anbieterwechsel
import { describe, expect, it } from "vitest";
import {
  type AdapterAntwort,
  type FaehigkeitsAdapter,
  FaehigkeitsAusfuehrung,
  type FaehigkeitsLage,
  type Faehigkeitsauftrag,
  type Faehigkeitsbindung,
  Faehigkeitsregistry,
  type Faehigkeitsvertrag,
  InMemoryFaehigkeitsAblage,
} from "../../services/app/src/assistenz-faehigkeiten";
import {
  BUDGET_VORGABEN,
  InMemoryProduktbudgetRepo,
  Produktbudget,
  ProduktbudgetFehler,
  type ProduktbudgetRepo,
  betragInCent,
} from "../../services/app/src/produktbudget";

const MANDANT = "instanz";
const ADMIN = "konto-admin-fiktiv";

function dienst(repo: ProduktbudgetRepo = new InMemoryProduktbudgetRepo()): Produktbudget {
  return new Produktbudget({ repo, mandant: MANDANT });
}

let kennung = 0;
function aenderungId(): string {
  kennung += 1;
  return `aenderung-${String(kennung).padStart(4, "0")}`;
}

async function bereich(d: Produktbudget, id: string) {
  const b = (await d.lies()).bereiche.find((x) => x.bereich === id);
  if (!b) {
    throw new Error(`Bereich ${id} fehlt`);
  }
  return b;
}

/** Legt den Zeitraum eines Nr.-32-Bereichs mit Beleg fest — wie es die berechtigte Person täte. */
async function festlegen(d: Produktbudget, id: string, betrag = "20"): Promise<void> {
  const b = await bereich(d, id);
  await d.aendere(ADMIN, id, {
    betrag,
    waehrung: "EUR",
    zeitraum: "einmalig",
    fassung: b.fassung,
    aenderungId: aenderungId(),
    grund: "fiktiver Beleg: Antwort zur Aufteilung",
  });
}

describe("B1 · Originalvorgaben vom 13.10.2026", () => {
  it("Perplexity 20 EUR einmalig, ersetzt 30 USD/Monat; Claude und ChatGPT je 20 EUR, Zeitraum offen", async () => {
    const d = dienst();
    const s = await d.lies();
    expect(s.bereiche.map((b) => b.bereich)).toEqual([
      "perplexity-poc",
      "nr32-claude",
      "nr32-chatgpt",
    ]);
    const p = await bereich(d, "perplexity-poc");
    expect(p).toMatchObject({
      anbieter: "perplexity",
      betragCent: 2000,
      waehrung: "EUR",
      zeitraum: "einmalig",
      fassung: 0,
      verbrauchtCent: 0,
      reserviertCent: 0,
      verbleibendCent: 2000,
      sperre: null,
      abgeloest: { betragCent: 3000, waehrung: "USD" },
      original: "produkt:20261011:assistenz-recherche-perplexity",
    });
    for (const id of ["nr32-claude", "nr32-chatgpt"]) {
      const b = await bereich(d, id);
      expect(b).toMatchObject({
        betragCent: 2000,
        waehrung: "EUR",
        zeitraum: "offen",
        sperre: "zeitraum_offen",
        abgeloest: null,
        original: "produkt:20261011:peter-p03",
      });
    }
    expect((await bereich(d, "nr32-claude")).anbieter).toBe("anthropic");
    expect((await bereich(d, "nr32-chatgpt")).anbieter).toBe("openai");
    // Kein monatlicher Zeitraum existiert überhaupt — keine Vorgabe kann ihn tragen.
    expect(BUDGET_VORGABEN.every((v) => v.zeitraum === "einmalig" || v.zeitraum === "offen")).toBe(
      true,
    );
  });

  it("Nr. 32 gibt mit offenem Zeitraum keinen Rest frei — auch nicht 0", async () => {
    const kb = dienst().kostenbuch();
    expect(await kb.rest("nr32-claude")).toBeNull();
    expect(await kb.rest("nr32-chatgpt")).toBeNull();
    expect(await kb.rest("perplexity-poc")).toBe(2000);
    expect(await kb.rest("unbekannt")).toBeNull();
  });
});

describe("B2 · Geld exakt in Cent", () => {
  it("Text und ganze Zahlen werden zeichenweise übersetzt, alles andere abgewiesen", () => {
    expect(betragInCent("20")).toBe(2000);
    expect(betragInCent("20,5")).toBe(2050);
    expect(betragInCent("20.05")).toBe(2005);
    expect(betragInCent(" 0 ")).toBe(0);
    expect(betragInCent(15)).toBe(1500);
    expect(betragInCent("0.1")).toBe(10);
    for (const falsch of ["-1", "1e3", "20,555", "", "abc", "1.000,00", "NaN", null, 0.1, -5]) {
      expect(betragInCent(falsch), String(falsch)).toBeNull();
    }
  });

  it("negativ, ungültig und über der Grenze: 400, der alte Stand bleibt", async () => {
    const d = dienst();
    for (const betrag of ["-1", "zwanzig", "10000,01", "20,001"]) {
      await expect(
        d.aendere(ADMIN, "perplexity-poc", {
          betrag,
          waehrung: "EUR",
          zeitraum: "einmalig",
          fassung: 0,
          aenderungId: aenderungId(),
        }),
      ).rejects.toMatchObject({ status: 400, grund: "betrag" });
    }
    await expect(
      d.aendere(ADMIN, "perplexity-poc", {
        betrag: "20",
        waehrung: "GBP",
        zeitraum: "einmalig",
        fassung: 0,
        aenderungId: aenderungId(),
      }),
    ).rejects.toMatchObject({ status: 400, grund: "waehrung" });
    await expect(
      d.aendere(ADMIN, "perplexity-poc", {
        betrag: "20",
        waehrung: "EUR",
        zeitraum: "monatlich",
        fassung: 0,
        aenderungId: aenderungId(),
      }),
    ).rejects.toMatchObject({ status: 400, grund: "zeitraum" });
    await expect(
      d.aendere(ADMIN, "gibt-es-nicht", {
        betrag: "20",
        waehrung: "EUR",
        zeitraum: "einmalig",
        fassung: 0,
        aenderungId: aenderungId(),
      }),
    ).rejects.toMatchObject({ status: 404, grund: "bereich" });
    const p = await bereich(d, "perplexity-poc");
    expect(p).toMatchObject({ betragCent: 2000, fassung: 0, letzteAenderungen: [] });
  });

  it("0 ist ein gültiger Betrag und stoppt den Kostenweg ehrlich", async () => {
    const d = dienst();
    await d.aendere(ADMIN, "perplexity-poc", {
      betrag: "0",
      waehrung: "EUR",
      zeitraum: "einmalig",
      fassung: 0,
      aenderungId: aenderungId(),
    });
    expect((await bereich(d, "perplexity-poc")).sperre).toBe("null_budget");
    expect(await d.kostenbuch().rest("perplexity-poc")).toBe(0);
    expect(
      await d.reserviere({
        zuordnung: "perplexity-poc",
        cent: 1,
        nutzer: "konto-fiktiv",
        auftragId: "auftrag-null",
        versuch: 1,
        anbieter: "perplexity",
        waehrung: "EUR",
      }),
    ).toBe(false);
  });
});

describe("B3 · speichern, erneut lesen, Neustart", () => {
  it("die Änderung steht nach erneutem Lesen und in einer neuen Instanz an derselben Ablage", async () => {
    const repo = new InMemoryProduktbudgetRepo();
    const erste = dienst(repo);
    const id = aenderungId();
    const r = await erste.aendere(ADMIN, "perplexity-poc", {
      betrag: "25,50",
      waehrung: "EUR",
      zeitraum: "einmalig",
      fassung: 0,
      aenderungId: id,
      grund: "fiktive Anpassung",
    });
    expect(r).toMatchObject({ geaendert: true, wiederholt: false });

    const zweite = dienst(repo);
    const p = await bereich(zweite, "perplexity-poc");
    expect(p).toMatchObject({
      betragCent: 2550,
      waehrung: "EUR",
      zeitraum: "einmalig",
      fassung: 1,
      geaendertVon: ADMIN,
    });
    expect(p.geaendertAm).not.toBeNull();
    expect(p.letzteAenderungen).toHaveLength(1);
    expect(p.letzteAenderungen[0]).toMatchObject({
      aenderungId: id,
      von: ADMIN,
      vorher: { betragCent: 2000, waehrung: "EUR", zeitraum: "einmalig" },
      nachher: { betragCent: 2550, waehrung: "EUR", zeitraum: "einmalig" },
      grund: "fiktive Anpassung",
    });
    // Die übrigen Bereiche sind unberührt.
    expect((await bereich(zweite, "nr32-claude")).fassung).toBe(0);
  });

  it("die Provenienz trägt Kennungen und Werte — keinen Schlüssel, kein Token", async () => {
    const repo = new InMemoryProduktbudgetRepo();
    await dienst(repo).aendere(ADMIN, "perplexity-poc", {
      betrag: "21",
      waehrung: "EUR",
      zeitraum: "einmalig",
      fassung: 0,
      aenderungId: aenderungId(),
    });
    const roh = JSON.stringify(await repo.hole(MANDANT));
    expect(roh).not.toMatch(/PERPLEXITY_API_KEY|Bearer|sk-|apiKey|token|password/i);
  });
});

describe("B4 · unklarer Schreibausgang und konkurrierende Änderung", () => {
  it("dieselbe Änderungskennung zweimal: einmal wirksam, kein zweiter Eintrag", async () => {
    const d = dienst();
    const eingabe = {
      betrag: "22",
      waehrung: "EUR",
      zeitraum: "einmalig",
      fassung: 0,
      aenderungId: aenderungId(),
    };
    const a = await d.aendere(ADMIN, "perplexity-poc", eingabe);
    // Die Antwort ging „verloren"; die Oberfläche sendet DIESELBE Eingabe noch einmal.
    const b = await d.aendere(ADMIN, "perplexity-poc", eingabe);
    expect(a.geaendert).toBe(true);
    expect(b).toMatchObject({ geaendert: false, wiederholt: true });
    const p = await bereich(d, "perplexity-poc");
    expect(p.fassung).toBe(1);
    expect(p.letzteAenderungen).toHaveLength(1);
  });

  it("bekannte Kennung mit ANDERER Eingabe, anderem Konto oder Bereich: 409, nichts bestätigt", async () => {
    const d = dienst();
    const id = aenderungId();
    const erste = {
      betrag: "22",
      waehrung: "EUR",
      zeitraum: "einmalig",
      fassung: 0,
      aenderungId: id,
    };
    await d.aendere(ADMIN, "perplexity-poc", erste);
    // Nach Antwortverlust tippt die Person weiter — dieselbe Kennung darf das NICHT bestätigen.
    await expect(
      d.aendere(ADMIN, "perplexity-poc", { ...erste, betrag: "23" }),
    ).rejects.toMatchObject({ status: 409, grund: "aenderung" });
    await expect(
      d.aendere(ADMIN, "perplexity-poc", { ...erste, grund: "anderer Grund" }),
    ).rejects.toMatchObject({ status: 409, grund: "aenderung" });
    await expect(d.aendere("konto-fremd", "perplexity-poc", erste)).rejects.toMatchObject({
      status: 409,
      grund: "aenderung",
    });
    await expect(
      d.aendere(ADMIN, "nr32-claude", { ...erste, zeitraum: "offen" }),
    ).rejects.toMatchObject({ status: 409, grund: "aenderung" });
    const p = await bereich(d, "perplexity-poc");
    expect(p).toMatchObject({ betragCent: 2200, fassung: 1 });
    expect(p.letzteAenderungen).toHaveLength(1);
    expect((await bereich(d, "nr32-claude")).fassung).toBe(0);
    // Die IDENTISCHE Wiederholung bleibt eine Wiederholung.
    expect((await d.aendere(ADMIN, "perplexity-poc", erste)).wiederholt).toBe(true);
  });

  it("zwei Personen auf derselben Fassung: die zweite bekommt 409 samt neuem Stand", async () => {
    const d = dienst();
    await d.aendere("konto-a", "perplexity-poc", {
      betrag: "18",
      waehrung: "EUR",
      zeitraum: "einmalig",
      fassung: 0,
      aenderungId: aenderungId(),
    });
    const zweite = d.aendere("konto-b", "perplexity-poc", {
      betrag: "30",
      waehrung: "EUR",
      zeitraum: "einmalig",
      fassung: 0,
      aenderungId: aenderungId(),
    });
    await expect(zweite).rejects.toBeInstanceOf(ProduktbudgetFehler);
    const f = (await zweite.catch((e: unknown) => e)) as ProduktbudgetFehler;
    expect(f.status).toBe(409);
    expect(f.grund).toBe("konflikt");
    expect(f.stand?.bereiche.find((b) => b.bereich === "perplexity-poc")?.betragCent).toBe(1800);
    expect((await bereich(d, "perplexity-poc")).betragCent).toBe(1800);
  });

  it("gleichzeitig auf derselben Fassung: genau eine Änderung gewinnt", async () => {
    const d = dienst();
    const ergebnisse = await Promise.allSettled(
      ["11", "12", "13", "14", "15"].map((betrag) =>
        d.aendere(ADMIN, "perplexity-poc", {
          betrag,
          waehrung: "EUR",
          zeitraum: "einmalig",
          fassung: 0,
          aenderungId: aenderungId(),
        }),
      ),
    );
    expect(ergebnisse.filter((e) => e.status === "fulfilled")).toHaveLength(1);
    const p = await bereich(d, "perplexity-poc");
    expect(p.fassung).toBe(1);
    expect(p.letzteAenderungen).toHaveLength(1);
  });
});

describe("B5 · offener Zeitraum (Nr. 32)", () => {
  it("einen offenen Zeitraum festlegen verlangt einen Beleg", async () => {
    const d = dienst();
    await expect(
      d.aendere(ADMIN, "nr32-claude", {
        betrag: "20",
        waehrung: "EUR",
        zeitraum: "einmalig",
        fassung: 0,
        aenderungId: aenderungId(),
      }),
    ).rejects.toMatchObject({ status: 400, grund: "grund" });
    expect((await bereich(d, "nr32-claude")).zeitraum).toBe("offen");
    // Der Betrag allein ist änderbar, ohne dass dadurch etwas frei wird.
    await d.aendere(ADMIN, "nr32-claude", {
      betrag: "15",
      waehrung: "EUR",
      zeitraum: "offen",
      fassung: 0,
      aenderungId: aenderungId(),
    });
    expect(await d.kostenbuch().rest("nr32-claude")).toBeNull();
    await festlegen(d, "nr32-claude", "15");
    expect(await d.kostenbuch().rest("nr32-claude")).toBe(1500);
    expect(await d.kostenbuch().rest("nr32-chatgpt")).toBeNull();
  });
});

describe("B6 · Buchungen bleiben, Währung ist gebunden", () => {
  it("Senkung unter den Verbrauch: Kosten bleiben sichtbar, der Rest ist 0, der Weg ist zu", async () => {
    const d = dienst();
    const kb = d.kostenbuch();
    await kb.verbuche("perplexity-poc", 1200, "auftrag-v1");
    let p = await bereich(d, "perplexity-poc");
    expect(p).toMatchObject({ verbrauchtCent: 1200, verbleibendCent: 800, buchungen: 1 });
    await d.aendere(ADMIN, "perplexity-poc", {
      betrag: "10",
      waehrung: "EUR",
      zeitraum: "einmalig",
      fassung: 0,
      aenderungId: aenderungId(),
    });
    p = await bereich(d, "perplexity-poc");
    expect(p).toMatchObject({
      betragCent: 1000,
      verbrauchtCent: 1200,
      verbleibendCent: 0,
      ueberschrittenCent: 200,
      sperre: "ausgeschoepft",
      buchungen: 1,
    });
    await d.aendere(ADMIN, "perplexity-poc", {
      betrag: "40",
      waehrung: "EUR",
      zeitraum: "einmalig",
      fassung: 1,
      aenderungId: aenderungId(),
    });
    p = await bereich(d, "perplexity-poc");
    expect(p).toMatchObject({ verbrauchtCent: 1200, verbleibendCent: 2800, sperre: null });
  });

  it("mit Buchungen keine Währungsumetikettierung (409), ohne Buchungen ist die Wahl frei", async () => {
    const d = dienst();
    await festlegen(d, "nr32-chatgpt");
    await d.aendere(ADMIN, "nr32-chatgpt", {
      betrag: "20",
      waehrung: "USD",
      zeitraum: "einmalig",
      fassung: 1,
      aenderungId: aenderungId(),
    });
    expect((await bereich(d, "nr32-chatgpt")).waehrung).toBe("USD");

    await d.kostenbuch().verbuche("perplexity-poc", 100, "auftrag-w1");
    await expect(
      d.aendere(ADMIN, "perplexity-poc", {
        betrag: "20",
        waehrung: "USD",
        zeitraum: "einmalig",
        fassung: 0,
        aenderungId: aenderungId(),
      }),
    ).rejects.toMatchObject({ status: 409, grund: "waehrung_gebunden" });
    expect((await bereich(d, "perplexity-poc")).waehrung).toBe("EUR");
  });
});

describe("B7 · Reservierung gegen den Deckel", () => {
  const anfrage = (auftragId: string, cent = 500, nutzer = "konto-a", versuch = 1) => ({
    zuordnung: "perplexity-poc",
    cent,
    nutzer,
    auftragId,
    versuch,
    anbieter: "perplexity",
    waehrung: "EUR",
  });

  it("zwölf parallele Reservierungen à 5 EUR gegen 20 EUR: genau vier gelingen", async () => {
    const d = dienst();
    const ergebnisse = await Promise.all(
      Array.from({ length: 12 }, (_, i) => d.reserviere(anfrage(`parallel-${i}`))),
    );
    expect(ergebnisse.filter(Boolean)).toHaveLength(4);
    const p = await bereich(d, "perplexity-poc");
    expect(p).toMatchObject({ reserviertCent: 2000, verbleibendCent: 0, sperre: "ausgeschoepft" });
  });

  it("dieselbe Ausführung reserviert einmal; Verbuchen macht daraus eine Buchung", async () => {
    const d = dienst();
    const herkunft = { nutzer: "konto-a", versuch: 1 };
    expect(await d.reserviere(anfrage("einmal"))).toBe(true);
    expect(await d.reserviere(anfrage("einmal"))).toBe(true);
    expect((await bereich(d, "perplexity-poc")).reserviertCent).toBe(500);
    await d.verbuche("perplexity-poc", 300, "einmal", herkunft);
    await d.verbuche("perplexity-poc", 300, "einmal", herkunft);
    const p = await bereich(d, "perplexity-poc");
    expect(p).toMatchObject({ reserviertCent: 0, verbrauchtCent: 300, buchungen: 1 });
    // Nach dem Verbuchen ist dieselbe Ausführung abgeschlossen — keine erneute Bestätigung.
    expect(await d.reserviere(anfrage("einmal"))).toBe(false);
  });

  it("andere Konten mit derselben Auftragskennung und jeder weitere Versuch zählen eigens", async () => {
    const d = dienst();
    expect(await d.reserviere(anfrage("gleich", 500, "konto-a"))).toBe(true);
    expect(await d.reserviere(anfrage("gleich", 500, "konto-b"))).toBe(true);
    expect(await d.reserviere(anfrage("gleich", 500, "konto-a", 2))).toBe(true);
    let p = await bereich(d, "perplexity-poc");
    expect(p).toMatchObject({ reserviertCent: 1500, verbleibendCent: 500, buchungen: 3 });
    // Das Verbuchen eines Kontos berührt die Reservierung des anderen nicht.
    await d.verbuche("perplexity-poc", 500, "gleich", { nutzer: "konto-b", versuch: 1 });
    p = await bereich(d, "perplexity-poc");
    expect(p).toMatchObject({ reserviertCent: 1000, verbrauchtCent: 500, buchungen: 3 });
    expect(await d.reserviere(anfrage("gleich", 500, "konto-c"))).toBe(true);
    expect(await d.reserviere(anfrage("gleich", 500, "konto-d"))).toBe(false);
  });

  it("eine Wiederholung wird nur mit gleichem Betrag und gleicher Währung bestätigt", async () => {
    const d = dienst();
    expect(await d.reserviere(anfrage("bindung", 500))).toBe(true);
    expect(await d.reserviere(anfrage("bindung", 400))).toBe(false);
    expect(await d.reserviere({ ...anfrage("bindung", 500), waehrung: "USD" })).toBe(false);
    expect(await d.reserviere({ ...anfrage("bindung", 500), waehrung: null })).toBe(false);
    expect(await d.reserviere(anfrage("bindung", 500))).toBe(true);
    expect((await bereich(d, "perplexity-poc")).reserviertCent).toBe(500);
  });

  it("ohne Konto oder Versuch keine Reservierung", async () => {
    const d = dienst();
    expect(await d.reserviere({ ...anfrage("x1"), nutzer: "" })).toBe(false);
    expect(await d.reserviere({ ...anfrage("x2"), versuch: Number.NaN })).toBe(false);
    expect((await bereich(d, "perplexity-poc")).buchungen).toBe(0);
  });

  it("falscher Anbieter, falsche oder fehlende Währung, offener Zeitraum: keine Freigabe", async () => {
    const d = dienst();
    expect(await d.reserviere({ ...anfrage("a1"), anbieter: "anthropic" })).toBe(false);
    expect(await d.reserviere({ ...anfrage("a2"), anbieter: null })).toBe(false);
    expect(await d.reserviere({ ...anfrage("a3"), waehrung: "USD" })).toBe(false);
    expect(await d.reserviere({ ...anfrage("a4"), waehrung: null })).toBe(false);
    expect(await d.reserviere({ ...anfrage("a5"), cent: 0 })).toBe(false);
    expect(await d.reserviere({ ...anfrage("a6"), cent: 1.5 })).toBe(false);
    expect(
      await d.reserviere({ ...anfrage("a7"), zuordnung: "nr32-claude", anbieter: "anthropic" }),
    ).toBe(false);
    expect((await bereich(d, "perplexity-poc")).buchungen).toBe(0);
  });

  it("Reservierungen überstehen den Neustart und zählen danach weiter gegen den Deckel", async () => {
    const repo = new InMemoryProduktbudgetRepo();
    expect(await dienst(repo).reserviere(anfrage("vor-neustart", 1500))).toBe(true);
    const nach = dienst(repo);
    expect(await nach.reserviere(anfrage("nach-neustart", 1000))).toBe(false);
    expect(await nach.reserviere(anfrage("vor-neustart", 1500))).toBe(true);
    expect(await nach.reserviere(anfrage("klein", 500))).toBe(true);
    expect((await bereich(nach, "perplexity-poc")).verbleibendCent).toBe(0);
  });
});

// ------------------------------------------------------------------------------------------------
// B8 · Am vorhandenen Ausführungsweg der Fähigkeiten (G18) — Ersatztransport, kein Anbieteraufruf.
// ------------------------------------------------------------------------------------------------

const BEZAHLTE_SUCHE: Faehigkeitsvertrag = {
  id: "fiktive-bezahlsuche",
  fassung: "1.0.0",
  name: "Fiktive Bezahlsuche",
  beschreibung: "Synthetische kostenpflichtige Suche mit belegtem Tarif.",
  zwecke: ["web_recherche"],
  datenempfaenger: {
    art: "extern",
    anbieter: "perplexity",
    anbieterName: "Perplexity",
    host: "suche.example",
  },
  wirkung: "lesen",
  modell: false,
  aktionen: ["netz_anfrage_anbieter"],
  eingaben: [{ name: "suchbegriff", maxLaenge: 200, pflicht: true }],
  ergebnis: { art: "trefferliste", felder: ["titel", "url"], quellenPflicht: true },
  hoechsteSchutzstufe: "oeffentlich",
  grenzen: { maxTreffer: 3, zeitlimitMs: 2_000, kostenJeAufrufCent: 500, kostenWaehrung: "EUR" },
  kostenzuordnung: "perplexity-poc",
  credential: null,
  ruecknahme: "keine_wirkung",
  unterschritte: [],
  verantwortlich: "Testverantwortung",
};

const LAGE: FaehigkeitsLage = {
  keineKi: false,
  externeWissensabfrage: "search_on_click",
  vertraulichNachExtern: false,
  freigegebeneAnbieter: ["perplexity", "testsuche"],
};

const TREFFER: AdapterAntwort = {
  status: "ok",
  eintraege: [{ titel: "Fiktiver Treffer", url: "https://beispiel.example/a" }],
};

function aufbau(repo: ProduktbudgetRepo, ablage = new InMemoryFaehigkeitsAblage()) {
  const budget = dienst(repo);
  const registry = new Faehigkeitsregistry();
  const aufrufe: string[] = [];
  const adapter = (v: Faehigkeitsvertrag): FaehigkeitsAdapter => ({
    faehigkeitId: v.id,
    fassung: v.fassung,
    transport: "ersatz",
    async fuehreAus(_eingabe, kontext) {
      aufrufe.push(kontext.auftragId);
      // Eine kleine Wartezeit, damit sich parallele Aufträge wirklich überlappen.
      await new Promise((r) => setTimeout(r, 5));
      return TREFFER;
    },
  });
  const ausfuehrung = new FaehigkeitsAusfuehrung({
    registry,
    lage: async () => LAGE,
    geheimnisse: { hole: () => null },
    ablage,
    kostenbuch: budget.kostenbuch(),
  });
  return { budget, registry, aufrufe, adapter, ausfuehrung, ablage };
}

function auftrag(id: string, gewaehlt: string, nutzer = "konto-fiktiv"): Faehigkeitsauftrag {
  return {
    auftragId: id,
    mandant: MANDANT,
    nutzer,
    sitzung: "sitzung-1",
    arbeitsbereich: null,
    zweck: "web_recherche",
    gewaehlt,
    eingabe: { suchbegriff: "fiktive Frage" },
    kontext: [],
    ausloeser: "nutzerauftrag",
  };
}

describe("B8 · der Deckel am Ausführungsweg der Fähigkeiten", () => {
  it("sechs parallele Aufträge à 5 EUR gegen 20 EUR: vier laufen, zwei stoppen ehrlich am Budget", async () => {
    const a = aufbau(new InMemoryProduktbudgetRepo());
    a.registry.registriere(BEZAHLTE_SUCHE);
    a.registry.installiereAdapter(a.adapter(BEZAHLTE_SUCHE));
    // Sechs fiktive Konten — der Deckel gilt je Bereich, nicht je Konto.
    const bindungen: Faehigkeitsbindung[] = [];
    for (let i = 0; i < 6; i++) {
      const v = await a.ausfuehrung.bereiteVor(
        auftrag(`par-${i}`, BEZAHLTE_SUCHE.id, `konto-fiktiv-${i}`),
      );
      expect(v.art).toBe("gebunden");
      if (v.art === "gebunden") {
        bindungen.push(v.bindung);
      }
    }
    const ergebnisse = await Promise.all(bindungen.map((b) => a.ausfuehrung.fuehreAus(b)));
    expect(a.aufrufe).toHaveLength(4);
    expect(ergebnisse.filter((r) => r.stand === "erfolgreich")).toHaveLength(4);
    const gestoppt = ergebnisse.filter((r) => r.stand === "voraussetzung_fehlt");
    expect(gestoppt).toHaveLength(2);
    for (const r of gestoppt) {
      expect(r.voraussetzungen.map((x) => x.art)).toContain("budget");
      expect(r.eintraege).toEqual([]);
    }
    const p = await bereich(a.budget, "perplexity-poc");
    expect(p).toMatchObject({ verbrauchtCent: 2000, reserviertCent: 0, verbleibendCent: 0 });
  });

  it("Neustart und Wiederholung derselben Auftragskennung buchen nicht doppelt", async () => {
    const repo = new InMemoryProduktbudgetRepo();
    const ablage = new InMemoryFaehigkeitsAblage();
    const erste = aufbau(repo, ablage);
    erste.registry.registriere(BEZAHLTE_SUCHE);
    erste.registry.installiereAdapter(erste.adapter(BEZAHLTE_SUCHE));
    const v = await erste.ausfuehrung.bereiteVor(auftrag("wieder-1", BEZAHLTE_SUCHE.id));
    if (v.art !== "gebunden") {
      throw new Error("nicht gebunden");
    }
    expect((await erste.ausfuehrung.fuehreAus(v.bindung)).stand).toBe("erfolgreich");

    // „Neustart": neue Instanzen an derselben Ablage und demselben Budget.
    const zweite = aufbau(repo, ablage);
    zweite.registry.registriere(BEZAHLTE_SUCHE);
    zweite.registry.installiereAdapter(zweite.adapter(BEZAHLTE_SUCHE));
    const nochmal = await zweite.ausfuehrung.fuehreAus(v.bindung);
    expect(nochmal.wiederholt).toBe(true);
    expect(zweite.aufrufe).toEqual([]);
    const p = await bereich(zweite.budget, "perplexity-poc");
    expect(p).toMatchObject({ verbrauchtCent: 500, buchungen: 1 });
  });

  it("zwei Konten mit derselben Auftragskennung: zwei Aufrufe, zwei Buchungen", async () => {
    const a = aufbau(new InMemoryProduktbudgetRepo());
    a.registry.registriere(BEZAHLTE_SUCHE);
    a.registry.installiereAdapter(a.adapter(BEZAHLTE_SUCHE));
    const bindungen: Faehigkeitsbindung[] = [];
    for (const konto of ["konto-x", "konto-y"]) {
      const a2 = auftrag("gleiche-kennung", BEZAHLTE_SUCHE.id, konto);
      const v = await a.ausfuehrung.bereiteVor(a2);
      if (v.art !== "gebunden") {
        throw new Error("nicht gebunden");
      }
      bindungen.push(v.bindung);
    }
    const ergebnisse = await Promise.all(bindungen.map((b) => a.ausfuehrung.fuehreAus(b)));
    expect(ergebnisse.map((r) => r.stand)).toEqual(["erfolgreich", "erfolgreich"]);
    expect(a.aufrufe).toHaveLength(2);
    const p = await bereich(a.budget, "perplexity-poc");
    expect(p).toMatchObject({ verbrauchtCent: 1000, reserviertCent: 0, buchungen: 2 });
  });

  it("ein erneuter Versuch nach Fehlschlag ist ein weiterer kostenwirksamer Aufruf", async () => {
    const a = aufbau(new InMemoryProduktbudgetRepo());
    a.registry.registriere(BEZAHLTE_SUCHE);
    let runde = 0;
    a.registry.installiereAdapter({
      faehigkeitId: BEZAHLTE_SUCHE.id,
      fassung: BEZAHLTE_SUCHE.fassung,
      transport: "ersatz",
      async fuehreAus(_eingabe, kontext) {
        a.aufrufe.push(kontext.auftragId);
        runde += 1;
        return runde === 1
          ? { status: "fehler", eintraege: [], meldung: "fiktiver Ausfall" }
          : TREFFER;
      },
    });
    const v = await a.ausfuehrung.bereiteVor(auftrag("zweimal", BEZAHLTE_SUCHE.id));
    if (v.art !== "gebunden") {
      throw new Error("nicht gebunden");
    }
    expect((await a.ausfuehrung.fuehreAus(v.bindung)).stand).toBe("fehlgeschlagen");
    // Der Anbieter hat geantwortet: der Tarif des Aufrufs gilt als angefallen.
    expect(await bereich(a.budget, "perplexity-poc")).toMatchObject({ verbrauchtCent: 500 });
    const zweiter = await a.ausfuehrung.fuehreAus(v.bindung);
    expect(zweiter.stand).toBe("erfolgreich");
    expect(zweiter.versuch).toBe(2);
    expect(a.aufrufe).toHaveLength(2);
    expect(await bereich(a.budget, "perplexity-poc")).toMatchObject({
      reserviertCent: 0,
      verbrauchtCent: 1000,
      verbleibendCent: 1000,
      buchungen: 2,
    });
  });

  it("Anbieterwechsel umgeht den Deckel nicht: ein anderer Empfänger bekommt dieses Budget nicht", async () => {
    const a = aufbau(new InMemoryProduktbudgetRepo());
    const fremd: Faehigkeitsvertrag = {
      ...BEZAHLTE_SUCHE,
      id: "fiktive-fremdsuche",
      datenempfaenger: {
        art: "extern",
        anbieter: "testsuche",
        anbieterName: "Testsuche AG",
        host: "suche.example",
      },
    };
    a.registry.registriere(fremd);
    a.registry.installiereAdapter(a.adapter(fremd));
    const v = await a.ausfuehrung.bereiteVor(auftrag("fremd-1", fremd.id));
    if (v.art !== "gebunden") {
      throw new Error("nicht gebunden");
    }
    const r = await a.ausfuehrung.fuehreAus(v.bindung);
    expect(r.stand).toBe("voraussetzung_fehlt");
    expect(a.aufrufe).toEqual([]);
    expect((await bereich(a.budget, "perplexity-poc")).buchungen).toBe(0);
  });

  it("ohne belegte Tarifwährung keine bezahlte Freigabe; unabhängige kostenfreie Arbeit läuft weiter", async () => {
    const a = aufbau(new InMemoryProduktbudgetRepo());
    const ohneWaehrung: Faehigkeitsvertrag = {
      ...BEZAHLTE_SUCHE,
      id: "fiktive-ohne-waehrung",
      grenzen: { maxTreffer: 3, zeitlimitMs: 2_000, kostenJeAufrufCent: 500 },
    };
    const kostenfrei: Faehigkeitsvertrag = {
      ...BEZAHLTE_SUCHE,
      id: "fiktive-gratissuche",
      grenzen: { maxTreffer: 3, zeitlimitMs: 2_000, kostenJeAufrufCent: 0 },
      kostenzuordnung: null,
    };
    for (const v of [ohneWaehrung, kostenfrei]) {
      a.registry.registriere(v);
      a.registry.installiereAdapter(a.adapter(v));
    }
    const b1 = await a.ausfuehrung.bereiteVor(auftrag("ohne-w", ohneWaehrung.id));
    const b2 = await a.ausfuehrung.bereiteVor(auftrag("gratis", kostenfrei.id));
    if (b1.art !== "gebunden" || b2.art !== "gebunden") {
      throw new Error("nicht gebunden");
    }
    expect((await a.ausfuehrung.fuehreAus(b1.bindung)).stand).toBe("voraussetzung_fehlt");
    expect((await a.ausfuehrung.fuehreAus(b2.bindung)).stand).toBe("erfolgreich");
    expect(a.aufrufe).toEqual(["gratis"]);
  });
});
