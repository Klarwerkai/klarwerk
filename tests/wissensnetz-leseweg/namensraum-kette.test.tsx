// ================================================================================================
// JOB 3070 · D3 — DIE ZWEI THEMENACHSEN EINER ANTWORT: GEMESSEN, NICHT BEHAUPTET.
// ================================================================================================
//
// DER BEFUND, den Codex an D1 erhoben hat, hier als dauerhaft ausfuehrbare Messung an der ECHTEN
// Kette — echte Fastify-App, echter `KoService`, echte Rechte-Naht, echte Route
// `GET /api/wissensnetz/luecken`, danach genau die Funktion, die die Oberflaeche benutzt:
//
//     ko = { category: "Hygienic Design", tags: ["Dichtungen", "Ventile"] }
//       → `metrik.themen`      nennt    ["Hygienic Design"]        (Server: aus `ko.category`)
//       → `metrik.themenkarte` zeichnet ["Dichtungen", "Ventile"]  (Server: aus `ko.tags`)
//
// EINE Antwort, ZWEI Namensraeume, kein Feld, das sie verbindet. Die Ursache liegt im Server
// (`services/wissensnetz/src/lesemodell.ts` gruppiert nach `category`,
// `services/wissensnetz/src/themenkarte.ts` nach `tags`, mit ausgeschriebener Begruendung: eine
// Kante verlangt ZWEI Themen im SELBEN Objekt, und eine Kategorie ist EIN Wert je Objekt).
//
// WARUM DIESE DATEI DEN BRUCH FESTHAELT UND NICHT BEHEBT: `services/**` ist fuer JOB 3070 kein
// Zielpfad. D2 hat die Achse dort zusammengefuehrt und ist an der Zielpfad-Vorpruefung gescheitert
// (`code.md` D2: „ZIELPFAD-VERSTOSS"). Die Zusammenfuehrung ist damit eine EIGENE Entscheidung und
// ein eigener Auftrag — sie steht als Frage in `RUECKGABE.md`. Was diese Datei leistet, ist das,
// was ohne sie fehlte: der Befund ist nicht mehr eine Behauptung in einer Ruckgabe, sondern ein
// Testfall, der laeuft.
//
// UND SIE HAELT DIE EIGENSCHAFT FEST, DIE IN JEDEM FALL GELTEN MUSS — vor wie nach einer
// Serverkorrektur: Die Oberflaeche behauptet NIE eine Zuordnung, die die Antwort nicht hergibt.
// Ein Thema ohne Knoten bekommt `null` (kein Zustand, keine Nachbarn, kein negativer Satz), und die
// Seite sagt an, dass die Zeichnung Themen fuehrt, zu denen keine Zeile steht.
//
//   N1  DIAGNOSE   die beiden Achsen derselben Antwort, gemessen und benannt (Pin, s. dort)
//   N2  EIGENSCHAFT ein Thema ohne Knoten erzeugt drei `null` — keine Behauptung ohne Grundlage
//   N3  GEGENPROBE  wo Kategorie UND Schlagwort denselben Namen tragen, ordnet `leseThemen` zu
//   N4  ANSAGE      die Zahl der gezeichneten Themen ohne Zeile ist nicht stumm
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import type { Sichtmetrik } from "../../apps/web/src/api/types";
import { leseThemen } from "../../apps/web/src/pages/Wissensnetz";
import { buildApp, buildServices } from "../../services/app/src/build-app";

/** Die Kategorie ist ABSICHTLICH keines der Schlagworte — das ist der Gegenstand dieser Datei. */
const KATEGORIE = "Hygienic Design";
const SCHLAGWORTE = ["Dichtungen", "Ventile"] as const;
/** N3: hier faellt beides zusammen — der Fall, in dem die Zuordnung heute schon traegt. */
const GLEICHNAMIG = "Reinigung";

let app: ReturnType<typeof buildApp>;
let headers: Record<string, string>;
let metrik: Sichtmetrik;

async function anlegen(
  titel: string,
  kategorie: string,
  tags: readonly string[],
  freigeben: boolean,
): Promise<void> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
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
    const frei = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "rate", verdict: "up" },
    });
    if (frei.statusCode !== 200) {
      throw new Error(`Freigabe scheiterte: ${frei.statusCode} ${frei.body}`);
    }
  }
}

beforeAll(async () => {
  app = buildApp(buildServices());
  await app.ready();
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@job3070-kette.test", password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job3070-kette.test", password: "geheim12345" },
  });
  headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  await app.inject({ method: "POST", url: "/api/auth/notice", headers });

  // (a) Der Streitfall: EINE Kategorie, ZWEI davon verschiedene Schlagworte. Freigegeben, damit
  //     ueberhaupt eine Kante entstehen kann („in demselben freigegebenen Wissensobjekt").
  await anlegen("CIP-Reinigung mit Dichtungswechsel", KATEGORIE, SCHLAGWORTE, true);
  // (b) Der Gegenfall fuer N3: Kategorie und Schlagwort tragen denselben Namen.
  await anlegen("Reinigungsplan Linie 4", GLEICHNAMIG, [GLEICHNAMIG], true);

  // DIE EINE ROUTE — dieselbe, die `useWissensnetz` ruft. Kein zweiter Weg, keine zweite Zaehlung.
  const res = await app.inject({ method: "GET", url: "/api/wissensnetz/luecken", headers });
  if (res.statusCode !== 200) {
    throw new Error(`Route scheiterte: ${res.statusCode} ${res.body}`);
  }
  metrik = res.json() as Sichtmetrik;
}, 60_000);

afterAll(async () => {
  await app?.close();
});

describe("JOB 3070 D3 · die zwei Themenachsen einer Antwort — an der echten Route", () => {
  it("N1 · DIAGNOSE: dieselbe Antwort nennt andere Themen, als sie zeichnet", () => {
    const gesprochen = metrik.themen.map((t) => t.thema).sort();
    const gezeichnet = (metrik.themenkarte?.themen ?? []).map((k) => k.thema).sort();
    console.info(
      `JOB 3070 D3 · N1 · gesprochen ${JSON.stringify(gesprochen)} · gezeichnet ${JSON.stringify(gezeichnet)}`,
    );

    // Kalibrierung: der Bestand ist wirklich der Streitfall.
    expect(metrik.objekteGesamt).toBe(2);
    expect(metrik.ohneThema).toBe(0);

    // ── DER PIN AUF DEN HEUTIGEN ZUSTAND ──────────────────────────────────────────────────────
    // Er schreibt den Bruch NICHT fest, er macht ihn sichtbar: `Hygienic Design` steht in der
    // Liste, obwohl kein Knoten so heisst, und `Dichtungen`/`Ventile` sind gezeichnet, ohne in der
    // Liste zu stehen. Fuehrt der Server die Achsen eines Tages zusammen (s. RUECKGABE.md, offene
    // Frage), wird GENAU DIESER Fall rot — und das ist der Zweck: die Aenderung muss hier
    // nachgefuehrt werden, statt still an einem gruenen Test vorbeizugehen.
    expect(gesprochen, "die Liste nennt die KATEGORIE").toEqual([KATEGORIE, GLEICHNAMIG].sort());
    expect(gezeichnet, "das Bild zeichnet die SCHLAGWORTE").toEqual(
      [...SCHLAGWORTE, GLEICHNAMIG].sort(),
    );
    const nurGezeichnet = gezeichnet.filter((k) => !gesprochen.includes(k));
    const nurGesprochen = gesprochen.filter((k) => !gezeichnet.includes(k));
    expect(nurGezeichnet, "gezeichnet, aber nicht genannt").toEqual([...SCHLAGWORTE].sort());
    expect(nurGesprochen, "genannt, aber nicht gezeichnet").toEqual([KATEGORIE]);
  });

  it("N2 · EIGENSCHAFT: ein Thema ohne Knoten erzeugt drei `null` — nie eine Behauptung ohne Grundlage", () => {
    const zeile = leseThemen(metrik).find((z) => z.thema === KATEGORIE);
    expect(zeile, "die Zeile der Kategorie steht").toBeDefined();
    // Kein Zustandswort, keine Ubiquitaetsaussage, und vor allem kein „kommt mit keinem Thema
    // zusammen vor" — die Antwort gibt zu diesem Namen schlicht nichts her.
    expect(zeile?.zustand).toBeNull();
    expect(zeile?.ubiquitaer).toBeNull();
    expect(zeile?.zusammenMit).toBeNull();
    expect(zeile?.zusammenMit).not.toEqual([]);
    // Die Zahlen bleiben, was der Server erhoben hat — sie sind nicht betroffen.
    expect(zeile?.objekte).toBe(1);
  });

  it("N3 · GEGENPROBE: traegt ein Thema in BEIDEN Achsen denselben Namen, ordnet `leseThemen` zu", () => {
    // Ohne diesen Fall waere N2 auch dann gruen, wenn die Zuordnung ueberhaupt nichts kann.
    const zeile = leseThemen(metrik).find((z) => z.thema === GLEICHNAMIG);
    const knoten = (metrik.themenkarte?.themen ?? []).find((k) => k.thema === GLEICHNAMIG);
    expect(knoten, "der Knoten ist gezeichnet").toBeDefined();
    expect(zeile?.zustand, "Zustand aus dem Knoten").toBe(knoten?.farbe);
    expect(zeile?.ubiquitaer).toBe(knoten?.ohneKanten);
    expect(zeile?.zusammenMit, "erhoben, und hier leer — der Knoten hat keine Kante").toEqual([]);
    expect(zeile?.objekte, "dieselbe Traegerzahl wie der Knoten").toBe(knoten?.objekte);
  });

  it("N4 · ANSAGE: die Zahl der gezeichneten Themen ohne Zeile steht der Oberflaeche zur Verfuegung", () => {
    // Was die Flaeche daraus macht, misst `leseweg.test.tsx` (L12) und der Chromium-Fall T2. Hier
    // steht die Rechnung selbst: sie ist eine Ablesung aus DERSELBEN Antwort, keine zweite Quelle.
    const genannt = new Set(leseThemen(metrik).map((z) => z.thema));
    const ohneZeile = (metrik.themenkarte?.themen ?? []).filter((k) => !genannt.has(k.thema));
    expect(ohneZeile.map((k) => k.thema).sort()).toEqual([...SCHLAGWORTE].sort());
    expect(ohneZeile.length).toBe(2);
  });
});
