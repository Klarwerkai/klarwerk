// ================================================================================================
// JOB 3023 — DIE GEGENPROBE: EIN WIRKLICH NEUER EINTRAG WIRD EINGESPIELT.
// ================================================================================================
//
// Ohne diesen Fall waere „alles ueberspringen" gruen, und der Auftrag waere mit einer einzigen
// `return { dublette: true }`-Zeile erfuellbar. Er laeuft ueber DIESELBE Route wie die
// Dublettenfaelle und misst zugleich, dass der Import als Ganzes mit 200 antwortet.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const ZUGANG = { name: "Admin", email: "echtneu@x.de", password: "secret123" };

interface Uebersprungen {
  titel: string;
  grund: string;
  koId: string | null;
  aehnlichkeit?: number;
}

describe("JOB 3023 · D — die Gegenprobe", () => {
  it("D1 · ein fachlich anderer Eintrag geht durch, der aehnliche nicht", async () => {
    const app = buildApp(buildServices());
    await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: ZUGANG.email, password: ZUGANG.password },
    });
    const headers = { authorization: `Bearer ${login.json().token}` };

    const bestand = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Ventil entlueften",
        statement: "Bei Ueberdruck das Ventil X langsam entlueften.",
        type: "best_practice",
        category: "Wartung",
      },
    });
    expect(bestand.statusCode, bestand.body).toBe(201);

    const res = await app.inject({
      method: "POST",
      url: "/api/library/import",
      headers,
      payload: {
        items: [
          {
            title: "Notstromaggregat monatlich probelaufen lassen",
            statement:
              "Das Notstromaggregat einmal im Monat fuenfzehn Minuten unter Last laufen lassen und das Ergebnis im Betriebsbuch vermerken.",
            type: "best_practice",
            category: "Betrieb",
          },
          {
            title: "VENTIL ENTLUEFTEN",
            statement: "Bei Ueberdruck das Ventil X langsam entlueften!",
            type: "best_practice",
            category: "Wartung",
          },
        ],
      },
    });

    expect(res.statusCode, res.body).toBe(200);
    const body = res.json() as {
      imported: number;
      skipped: number;
      uebersprungen: Uebersprungen[];
    };
    expect(body.imported, "Der fachlich neue Eintrag MUSS ankommen.").toBe(1);
    expect(body.skipped).toBe(1);
    expect(body.uebersprungen.map((e) => e.titel)).toEqual(["VENTIL ENTLUEFTEN"]);

    const liste = await app.inject({ method: "GET", url: "/api/kos", headers });
    const titel = (liste.json() as { title: string }[]).map((ko) => ko.title).sort();
    expect(titel).toEqual(["Notstromaggregat monatlich probelaufen lassen", "Ventil entlueften"]);
  });
});
