import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// ==================================================================================================
// JOB 2009 · D2 · H3 — DER AUFRUFER, DURCH DEN ECHTEN WEG GEMESSEN.
// ==================================================================================================
//
// DER BEFUND AUS D1: `wissensnetzLuecken` — der einzige oeffentliche Weg des Wissensnetz-Moduls —
// wurde im Produkt von NIEMANDEM gerufen. Alle Treffer lagen in Tests. Das Modul war vollstaendig
// gebaut, 46 Faelle gruen, und trotzdem sah kein Anwender je eine Zahl daraus.
//
// WARUM DIESER TEST DIE GANZE APP MONTIERT UND KEIN MODUL: Genau daran ist KA2 vierzehn Durchgaenge
// lang gescheitert — beide Haelften waren gruen, die Kette dazwischen fehlte. Ein Modultest haette
// das nie gezeigt. Hier laeuft ein echter Request durch `buildApp`: Route → Guard → Ports →
// Naht → Lesemodell → Metrik. Faellt irgendein Glied aus, faellt dieser Test.
//
// DIE NAHT IST DER KERN. `policyFuer` warf bis D1 UNBEDINGT (`NAHT_OFFEN`). Ein Aufrufer waere
// toter Code gewesen. Die Kompositionswurzel schliesst sie jetzt (`build-app.ts`,
// `policyNahtSchliessen`) — und A3 unten ist der Fall, der beweist, dass sie wirklich geschlossen
// ist und nicht bloss nicht mehr wirft.

const ZUGANG = { name: "Admin", email: "a@x.de", password: "secret123" };
/** JOB 3073: eine Kategorie, die in keinem Schlagwort dieses Bestands vorkommt. */
const KATEGORIE_OHNE_WIRKUNG = "Kategorie ohne Wirkung";

async function bestueckteApp() {
  const app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };

  // JOB 3073: das Thema der Sichtmetrik kommt aus den SCHLAGWORTEN. Die Kategorie steht daneben
  // und ist ausdruecklich KEINES davon — sonst waere A1 auch mit der alten Achse gruen.
  for (const [titel, thema] of [
    ["Ventil entlueften", "Wartung"],
    ["Pumpe pruefen", "Wartung"],
    ["Kessel reinigen", "Reinigung"],
  ] as const) {
    await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: titel,
        statement: `${titel} — Kurzfassung fuer den Pruefstand.`,
        type: "best_practice",
        category: KATEGORIE_OHNE_WIRKUNG,
        tags: [thema],
      },
    });
  }
  return { app, headers };
}

describe("JOB 2009 D2 · H3 — die Beziehungen haben einen Leser", () => {
  it("A1 · der Aufrufer laeuft durch: die Route liefert eine Sichtmetrik", async () => {
    const { app, headers } = await bestueckteApp();
    const res = await app.inject({ method: "GET", url: "/api/wissensnetz/luecken", headers });

    expect(res.statusCode, res.body).toBe(200);
    const m = res.json() as {
      objekteGesamt: number;
      ohneThema: number;
      sichtbareBeitragendeGesamt: number;
      themen: { thema: string; objekte: number }[];
    };

    // Der Bestand ist durch DIE ECHTE ROUTE gegangen — nicht durch einen Nachbau.
    expect(m.objekteGesamt).toBeGreaterThanOrEqual(3);
    expect(Array.isArray(m.themen)).toBe(true);
    const wartung = m.themen.find((t) => t.thema === "Wartung");
    expect(
      wartung,
      "Das Thema aus dem angelegten Bestand muss in der Metrik erscheinen — sonst ist die Kette " +
        "zwischen Route und Lesemodell nicht geschlossen.",
    ).toBeDefined();
    expect(wartung?.objekte).toBe(2);
    expect(m.themen.find((t) => t.thema === "Reinigung")?.objekte).toBe(1);
    // JOB 3073: und die Kategorie ist KEIN Thema — sonst stuende hier die alte Achse.
    expect(m.themen.map((t) => t.thema)).not.toContain(KATEGORIE_OHNE_WIRKUNG);
  });

  it("A2 · der Deckel aus der Anfrage wirkt — und wird nicht hier nachgerechnet", async () => {
    const { app, headers } = await bestueckteApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/wissensnetz/luecken?deckel=1",
      headers,
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().themen).toHaveLength(1);
  });

  it("A3 · DIE NAHT IST WIRKLICH GESCHLOSSEN: es kommt eine Metrik, kein NAHT_OFFEN", async () => {
    const { app, headers } = await bestueckteApp();
    const res = await app.inject({ method: "GET", url: "/api/wissensnetz/luecken", headers });

    // Waere die Naht offen, wuerfe das Modul VOR dem ersten Lesen — die Route faenge es und
    // antwortete mit einem Fehler, der den Text traegt. Ein 200 mit Zahlen ist der Beweis, dass
    // die Kompositionswurzel die zentrale Policy wirklich hereingereicht hat.
    expect(res.statusCode).toBe(200);
    expect(
      res.body,
      "Die Antwort darf den Nahttext nicht tragen — sonst hat die Wurzel nicht geschlossen.",
    ).not.toContain("Sichtbarkeitsnaht ist offen");
    expect(typeof res.json().objekteGesamt).toBe("number");
  });

  it("A4 · ohne Anmeldung gibt es nichts — der Guard steht vor der Erhebung", async () => {
    const { app } = await bestueckteApp();
    const res = await app.inject({ method: "GET", url: "/api/wissensnetz/luecken" });
    expect(res.statusCode).toBe(401);
  });
});
