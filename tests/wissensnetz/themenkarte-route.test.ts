// ==================================================================================================
// JOB 2600 · D1 — DIE THEMENKARTE, DURCH DIE ECHTE ROUTE GEMESSEN.
// ==================================================================================================
//
// Die Regeln stehen in `themenkarte.test.ts`, das Bild in `tests/app/themenkarte-mounted.test.tsx`.
// Diese Datei prueft die KETTE: Route → Guard → Ports → Naht → Lesemodell → Themenkarte.
//
// WARUM DAS EIGENS GEPRUEFT WIRD. Genau hier ist dieser Gegenstand sechsmal gescheitert: beide
// Haelften gebaut, die Kette dazwischen nie. `h3-aufrufer-route.test.ts:12-15` sagt es fuer den
// Vorgaenger woertlich — „beide Haelften waren gruen, die Kette dazwischen fehlte." Ein Modultest
// haette das nie gezeigt.
//
// ES GIBT KEINE NEUE ROUTE. Die Karte reist auf `/api/wissensnetz/luecken` mit, also auf dem
// bestehenden Weg mit der bestehenden Rechte-Naht — Codex' Auflage „KEINE zweite Lesequelle".
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const ZUGANG = { name: "Admin", email: "karte@x.de", password: "secret123" };

interface AntwortKarte {
  themen: { thema: string; objekte: number; farbe: string; ohneKanten: boolean }[];
  kanten: { a: string; b: string; gewicht: number }[];
  weitere: string[];
  weitereAbgeschnitten: boolean;
  mindesthaeufigkeit: number;
  /** JOB 2600 D7 · gehoert zum Wiretyp, damit R4 ihn nicht ueber einen Cast pruefen muss. */
  unterdruecktDurchUbiquitaet: number;
}

async function bestueckteApp() {
  const app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };

  const ids: string[] = [];
  for (const [titel, tags] of [
    ["Ventil entlueften", ["pumpe", "wartung"]],
    ["Pumpe pruefen", ["pumpe", "wartung"]],
    ["Kessel reinigen", ["reinigung"]],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: titel,
        statement: `${titel} — Kurzfassung fuer den Pruefstand.`,
        type: "best_practice",
        category: "Instandhaltung",
        tags: [...tags],
        // Eine einzige Zustimmung reicht zur Freigabe — sonst waere der Kantenfall unten nicht
        // ohne einen zweiten Anmeldenamen zu erreichen.
        neededValidations: 1,
      },
    });
    ids.push(res.json().id as string);
  }
  return { app, headers, ids };
}

async function karteVon(
  app: Awaited<ReturnType<typeof bestueckteApp>>["app"],
  headers: Record<string, string>,
): Promise<AntwortKarte> {
  const res = await app.inject({ method: "GET", url: "/api/wissensnetz/luecken", headers });
  expect(res.statusCode, res.body).toBe(200);
  const metrik = res.json() as { themenkarte?: AntwortKarte };
  expect(metrik.themenkarte, "die Themenkarte fehlt in der Antwort der echten Route").toBeDefined();
  return metrik.themenkarte as AntwortKarte;
}

describe("JOB 2600 D1 · die Themenkarte kommt durch die echte Route an", () => {
  it("R1 · die Karte ist Teil der Antwort, mit einem Knoten je Schlagwort", async () => {
    const { app, headers } = await bestueckteApp();
    const karte = await karteVon(app, headers);

    const nach = new Map(karte.themen.map((k) => [k.thema, k.objekte]));
    // Der Bestand ist durch DIE ECHTE ROUTE gegangen — nicht durch einen Nachbau.
    expect(nach.get("pumpe")).toBe(2);
    expect(nach.get("wartung")).toBe(2);
    expect(nach.get("reinigung")).toBe(1);
  });

  it("R2 · ohne Freigabe keine Kante — auch nicht bei gemeinsamem Vorkommen", async () => {
    const { app, headers } = await bestueckteApp();
    const karte = await karteVon(app, headers);

    // `pumpe` und `wartung` stehen in denselben zwei Objekten. Sie bekommen trotzdem keine
    // Kante, solange kein Objekt freigegeben ist — das ist die Abnahmebedingung, hier am
    // echten Bestand und nicht an einer Attrappe.
    expect(karte.themen.every((k) => k.farbe === "offen")).toBe(true);
    expect(karte.kanten).toEqual([]);
  });

  it("R3 · nach der Freigabe entsteht die Kante, und die Farbe wechselt", async () => {
    const { app, headers, ids } = await bestueckteApp();
    const erstes = ids[0];
    expect(erstes).toBeDefined();

    // PUT, nicht POST: der Mutations-Endpunkt verzweigt per `{action}` (`ko-routes.ts:1272-1273`).
    const rate = await app.inject({
      method: "PUT",
      url: `/api/kos/${erstes}`,
      headers,
      payload: { action: "rate", verdict: "up" },
    });
    expect(rate.statusCode, rate.body).toBe(200);

    const karte = await karteVon(app, headers);
    // Genau die zwei Schlagworte des freigegebenen Objekts sind jetzt verbunden.
    expect(karte.kanten).toEqual([{ a: "pumpe", b: "wartung", gewicht: 1 }]);
    // Und ihre Farbe traegt die Freigabe. Ohne Quelle bleibt es bei `freigegeben`.
    const farbe = new Map(karte.themen.map((k) => [k.thema, k.farbe]));
    expect(farbe.get("pumpe")).toBe("freigegeben");
    expect(farbe.get("wartung")).toBe("freigegeben");
    // Das unbeteiligte Thema bleibt, wie es war — die Freigabe faerbt nicht die ganze Karte.
    expect(farbe.get("reinigung")).toBe("offen");
  });

  it("R4 · die Antwort traegt keine globalen Mengen der Karte", async () => {
    const { app, headers } = await bestueckteApp();
    const karte = await karteVon(app, headers);

    expect(Object.keys(karte).sort()).toEqual([
      "kanten",
      "mindesthaeufigkeit",
      "themen",
      // JOB 2600 D7 · NEU. Der Waechter hat korrekt angeschlagen; die Begruendung, warum dieser
      // Schluessel keine globale Menge ist, steht bei E1 in `tests/wissensnetz/themenkarte.test.ts`.
      // Kurz: er zaehlt Paare GEZEICHNETER Themen, ist durch die 40 Knoten begrenzt und waechst
      // nicht mit unsichtbarem Bestand. Hier zaehlt zusaetzlich, dass er den Weg ueber die echte
      // Route unveraendert uebersteht — er ist Teil des Wiretyps, nicht eine Rechnung im Client.
      "unterdruecktDurchUbiquitaet",
      "weitere",
      "weitereAbgeschnitten",
    ]);
    // Und er kommt als ZAHL an, nicht als Objekt oder Liste — sonst waere er ein Kanal.
    expect(typeof karte.unterdruecktDurchUbiquitaet).toBe("number");
  });

  it("R5 · ohne Anmeldung gibt es keine Karte", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({ method: "GET", url: "/api/wissensnetz/luecken" });
    expect(res.statusCode).toBeGreaterThanOrEqual(401);
    expect(res.body).not.toContain("themenkarte");
  });
});
