// ================================================================================================
// JOB 3073 · V6 — EINE THEMENACHSE, AN DER ECHTEN ROUTE. (Vorher: der Diagnose-Pin auf den Bruch.)
// ================================================================================================
//
// WAS HIER BIS JOB 3071 STAND, und warum es nicht mehr stimmt. Diese Datei entstand in JOB 3070 D3
// als ausführbare DIAGNOSE eines Bruchs: dieselbe Antwort nannte andere Themen, als sie zeichnete.
// Wörtlich aus jenem Lauf (`archiv/3070/runde-3/RUECKGABE.md`):
//
//     JOB 3070 D3 · N1 · gesprochen ["Hygienic Design","Reinigung"]
//                      · gezeichnet ["Dichtungen","Reinigung","Ventile"]
//
// Der Pin war ausdrücklich so gebaut, dass er bei einer Serverkorrektur ROT wird — „die Änderung
// muss hier nachgeführt werden, statt still an einem grünen Test vorbeizugehen". JOB 3073 hat die
// Achse zusammengeführt (`themenVon` in `services/wissensnetz/src/themenkarte.ts`, benutzt von
// `services/wissensnetz/src/lesemodell.ts`); der Pin ist deshalb NACHGEFÜHRT, nicht gelöscht: er
// misst jetzt an derselben Stelle dieselbe Frage — und die Antwort ist die umgekehrte.
//
//   N1  DIE ZUSAGE      gesprochene und gezeichnete Themenmenge sind GLEICH, samt Trägerzahlen
//   N2  DIE GRENZE      jenseits des Knotendeckels gibt es Zeilen ohne Knoten — und dann `null`
//   N3  KALIBRIERUNG    eine Zeile MIT Knoten trägt dessen Zustand, Ubiquität und Nachbarn
//   N4  DIE ANSAGE      im Normalfall gibt es nichts anzusagen; unter einem Deckel schon
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import type { Sichtmetrik } from "../../apps/web/src/api/types";
import { leseThemen } from "../../apps/web/src/pages/Wissensnetz";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { THEMEN_KNOTEN_DECKEL } from "../../services/wissensnetz";

/** Die Kategorie ist ABSICHTLICH keines der Schlagworte — das ist der Gegenstand dieser Datei. */
const KATEGORIE = "Hygienic Design";
const SCHLAGWORTE = ["Dichtungen", "Ventile"] as const;
/** Das zweite Objekt bringt ein drittes Schlagwort und teilt sich `Ventile` mit dem ersten. */
const ZWEITE_KATEGORIE = "Reinigungstechnik";
const SCHLAGWORTE_ZWEI = ["Reinigung", "Ventile"] as const;

let app: ReturnType<typeof buildApp>;
let headers: Record<string, string>;
let metrik: Sichtmetrik;
/** Dieselbe Route, nur mit dem Deckel aus der Anfrage — für N4. */
let metrikGedeckelt: Sichtmetrik;
/** Eine zweite App mit mehr Themen, als die Zeichnung Knoten führt — für N2. */
let metrikVieleThemen: Sichtmetrik;

async function anlegen(
  a: ReturnType<typeof buildApp>,
  kopf: Record<string, string>,
  titel: string,
  kategorie: string,
  tags: readonly string[],
  freigeben: boolean,
): Promise<void> {
  const res = await a.inject({
    method: "POST",
    url: "/api/kos",
    headers: kopf,
    payload: {
      title: titel,
      statement: "Kurzfassung fuer den Pruefstand.",
      type: "best_practice",
      category: kategorie,
      tags: [...tags],
      neededValidations: 1,
    },
  });
  if (res.statusCode !== 201) {
    throw new Error(`Anlage von „${titel}" scheiterte: ${res.statusCode} ${res.body}`);
  }
  if (freigeben) {
    const id = (res.json() as { id: string }).id;
    const frei = await a.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: kopf,
      payload: { action: "rate", verdict: "up" },
    });
    if (frei.statusCode !== 200) {
      throw new Error(`Freigabe scheiterte: ${frei.statusCode} ${frei.body}`);
    }
  }
}

async function frischeApp(email: string): Promise<{
  a: ReturnType<typeof buildApp>;
  kopf: Record<string, string>;
}> {
  const a = buildApp(buildServices());
  await a.ready();
  await a.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email, password: "geheim12345" },
  });
  const login = await a.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  const kopf = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  await a.inject({ method: "POST", url: "/api/auth/notice", headers: kopf });
  return { a, kopf };
}

async function metrikVon(
  a: ReturnType<typeof buildApp>,
  kopf: Record<string, string>,
  abfrage = "",
): Promise<Sichtmetrik> {
  // DIE EINE ROUTE — dieselbe, die `useWissensnetz` ruft. Kein zweiter Weg, keine zweite Zaehlung.
  const res = await a.inject({
    method: "GET",
    url: `/api/wissensnetz/luecken${abfrage}`,
    headers: kopf,
  });
  if (res.statusCode !== 200) {
    throw new Error(`Route scheiterte: ${res.statusCode} ${res.body}`);
  }
  return res.json() as Sichtmetrik;
}

let vieleApp: ReturnType<typeof buildApp>;

beforeAll(async () => {
  const haupt = await frischeApp("pedi@job3073-kette.test");
  app = haupt.a;
  headers = haupt.kopf;

  // (a) Der Streitfall: EINE Kategorie, ZWEI davon verschiedene Schlagworte. Freigegeben, damit
  //     ueberhaupt eine Kante entstehen kann („in demselben freigegebenen Wissensobjekt").
  await anlegen(app, headers, "CIP-Reinigung mit Dichtungswechsel", KATEGORIE, SCHLAGWORTE, true);
  // (b) Ein zweites Objekt, dessen Kategorie ebenfalls in keinem Schlagwort vorkommt.
  await anlegen(app, headers, "Reinigungsplan Linie 4", ZWEITE_KATEGORIE, SCHLAGWORTE_ZWEI, true);

  metrik = await metrikVon(app, headers);
  metrikGedeckelt = await metrikVon(app, headers, "?deckel=1");

  // (c) Mehr Themen, als die Zeichnung Knoten fuehrt (`THEMEN_KNOTEN_DECKEL`) — fuer N2.
  const viele = await frischeApp("pedi@job3073-kette-viele.test");
  vieleApp = viele.a;
  for (let i = 0; i < THEMEN_KNOTEN_DECKEL + 2; i++) {
    await anlegen(
      viele.a,
      viele.kopf,
      `Objekt ${String(i).padStart(3, "0")}`,
      KATEGORIE,
      [`Thema-${String(i).padStart(3, "0")}`],
      false,
    );
  }
  metrikVieleThemen = await metrikVon(viele.a, viele.kopf);
}, 120_000);

afterAll(async () => {
  await app?.close();
  await vieleApp?.close();
});

describe("JOB 3073 V6 · eine Themenachse — an der echten Route", () => {
  it("N1 · DIE ZUSAGE: dieselbe Antwort nennt genau die Themen, die sie zeichnet — mit denselben Trägerzahlen", () => {
    const gesprochen = metrik.themen.map((t) => t.thema).sort();
    const gezeichnet = (metrik.themenkarte?.themen ?? []).map((k) => k.thema).sort();
    console.info(
      `JOB 3073 · N1 · gesprochen ${JSON.stringify(gesprochen)} · gezeichnet ${JSON.stringify(gezeichnet)}`,
    );

    // Kalibrierung: der Bestand ist wirklich der Streitfall — die Kategorien sind keine Schlagworte.
    expect(metrik.objekteGesamt).toBe(2);
    expect(metrik.ohneThema).toBe(0);
    expect(gesprochen, "die Kategorie ist kein Thema mehr").not.toContain(KATEGORIE);
    expect(gesprochen).not.toContain(ZWEITE_KATEGORIE);

    // ── DIE EINE ACHSE ────────────────────────────────────────────────────────────────────────
    // `Ventile` steht in BEIDEN Objekten — die Vereinigung, nicht die Aneinanderreihung.
    expect(gesprochen).toEqual([...new Set([...SCHLAGWORTE, ...SCHLAGWORTE_ZWEI])].sort());
    expect(gesprochen, "gesprochen = gezeichnet").toEqual(gezeichnet);
    expect(gesprochen.filter((k) => !gezeichnet.includes(k))).toEqual([]);
    expect(gezeichnet.filter((k) => !gesprochen.includes(k))).toEqual([]);

    // Nicht nur die Namen: dieselben Traegerzahlen. „Ventile" steht in beiden Objekten.
    const zahlZeile = new Map(metrik.themen.map((t) => [t.thema, t.objekte]));
    for (const k of metrik.themenkarte?.themen ?? []) {
      expect(zahlZeile.get(k.thema), `Traegerzahl von „${k.thema}"`).toBe(k.objekte);
    }
    expect(zahlZeile.get("Ventile")).toBe(2);
  });

  it("N2 · DIE GRENZE: jenseits des Knotendeckels gibt es Zeilen ohne Knoten — und dann steht `null`, keine Behauptung", () => {
    const gezeichnet = new Set((metrikVieleThemen.themenkarte?.themen ?? []).map((k) => k.thema));
    const zeilen = leseThemen(metrikVieleThemen);

    // Kalibrierung: die Zeichnung ist wirklich am Deckel, die Liste nicht.
    expect(gezeichnet.size).toBe(THEMEN_KNOTEN_DECKEL);
    expect(zeilen.length).toBe(THEMEN_KNOTEN_DECKEL + 2);

    const ohneKnoten = zeilen.filter((z) => !gezeichnet.has(z.thema));
    expect(ohneKnoten.length, "zwei Zeilen mehr als Knoten").toBe(2);
    for (const z of ohneKnoten) {
      // Kein Zustandswort, keine Ubiquitaetsaussage, und vor allem kein „kommt mit keinem Thema
      // zusammen vor" — die Antwort gibt zu diesem Namen schlicht nichts her.
      expect(z.zustand, z.thema).toBeNull();
      expect(z.ubiquitaer, z.thema).toBeNull();
      expect(z.zusammenMit, z.thema).toBeNull();
      expect(z.zusammenMit, z.thema).not.toEqual([]);
      // Die Zahlen bleiben, was der Server erhoben hat — sie sind nicht betroffen.
      expect(z.objekte, z.thema).toBe(1);
    }
  });

  it("N3 · KALIBRIERUNG: eine Zeile MIT Knoten trägt dessen Zustand, Ubiquität und Nachbarn", () => {
    // Ohne diesen Fall waere N2 auch dann gruen, wenn die Zuordnung ueberhaupt nichts kann.
    const zeilen = leseThemen(metrik);
    for (const knoten of metrik.themenkarte?.themen ?? []) {
      const zeile = zeilen.find((z) => z.thema === knoten.thema);
      expect(zeile, `die Zeile zu „${knoten.thema}" steht`).toBeDefined();
      expect(zeile?.zustand, `Zustand aus dem Knoten „${knoten.thema}"`).toBe(knoten.farbe);
      expect(zeile?.ubiquitaer).toBe(knoten.ohneKanten);
      expect(zeile?.objekte, "dieselbe Traegerzahl wie der Knoten").toBe(knoten.objekte);
      expect(zeile?.zusammenMit, `${knoten.thema}: erhoben, nicht null`).not.toBeNull();
    }
    // Und die Kante des gemeinsamen Traegers steht in beiden Richtungen als Nachbarschaft.
    expect(zeilen.find((z) => z.thema === "Dichtungen")?.zusammenMit).toEqual(["Ventile"]);
    expect(zeilen.find((z) => z.thema === "Ventile")?.zusammenMit).toEqual([
      "Dichtungen",
      "Reinigung",
    ]);
  });

  it("N4 · DIE ANSAGE: im Normalfall gibt es keine gezeichneten Themen ohne Zeile — unter einem Deckel schon", () => {
    // Was die Flaeche daraus macht, misst `tests/wissensnetz-leseweg/leseweg.test.tsx` (L12) und
    // der Chromium-Fall T2 in `tests/design/zielbild-wissensnetz.test.ts`. Hier steht die Rechnung
    // selbst: sie ist eine Ablesung aus DERSELBEN Antwort, keine zweite Quelle.
    const ohneZeile = (m: Sichtmetrik): string[] => {
      const genannt = new Set(leseThemen(m).map((z) => z.thema));
      return (m.themenkarte?.themen ?? []).filter((k) => !genannt.has(k.thema)).map((k) => k.thema);
    };

    // (a) Der Normalfall — genau der Bestand, der bis JOB 3071 zwei Achsen erzeugte.
    expect(ohneZeile(metrik), "nach der Zusammenfuehrung bleibt nichts uebrig").toEqual([]);

    // (b) Der Deckel aus der Anfrage: die Liste ist beschnitten, die Zeichnung nicht. Genau dafuer
    //     bleibt der Ansagesatz auf der Flaeche stehen.
    expect(metrikGedeckelt.themen).toHaveLength(1);
    expect((metrikGedeckelt.themenkarte?.themen ?? []).length).toBe(3);
    expect(ohneZeile(metrikGedeckelt).sort()).toEqual(["Dichtungen", "Reinigung"]);
  });
});
