// ================================================================================================
// JOB 3023 — DIE GEGENPROBE: EIN WIRKLICH NEUER EINTRAG WIRD EINGESPIELT.
// ================================================================================================
//
// Ohne diesen Fall waere „alles ueberspringen" gruen, und der Auftrag waere mit einer einzigen
// `return { dublette: true }`-Zeile erfuellbar. Er laeuft ueber DIESELBE Route wie die
// Dublettenfaelle und misst zugleich, dass der Import als Ganzes mit 200 antwortet.
//
// Lauf gesamt-import-adoption: zusätzlich gemessen wird der Befund je Kandidat (mit Kennung des
// getroffenen Objekts) und der AUSGANG jeder Annahme — nur der neue Eintrag legt an.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KandidatDublettenbefund } from "../../services/library-analytics";

const ZUGANG = { name: "Admin", email: "echtneu@x.de", password: "secret123" };

interface Uebersprungen {
  titel: string;
  grund: string;
  koId: string | null;
  aehnlichkeit?: number;
}

interface KandidatDto {
  id: string;
  item: { title: string };
  koId: string | null;
  dublettenbefund?: KandidatDublettenbefund;
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
        confidentiality: "intern",
        title: "Ventil entlueften",
        statement: "Bei Ueberdruck das Ventil X langsam entlueften.",
        type: "best_practice",
        category: "Wartung",
      },
    });
    expect(bestand.statusCode, bestand.body).toBe(201);
    const bestandId = bestand.json().id as string;

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
    // R-0143 (bens F1): der direkte Eingang reiht ein; der fachlich neue Eintrag kommt über die
    // ANNAHME an, der ähnliche bleibt als Dublette markiert und legt auch angenommen nichts an.
    const body = res.json() as {
      imported: number;
      skipped: number;
      uebersprungen: Uebersprungen[];
      kandidaten: KandidatDto[];
    };
    expect(body.imported, "Direkt angelegt wird nichts mehr.").toBe(0);
    expect(body.skipped).toBe(1);
    expect(body.uebersprungen.map((e) => e.titel)).toEqual(["VENTIL ENTLUEFTEN"]);
    expect(
      body.kandidaten[0]?.dublettenbefund?.ergebnis,
      "Der fachlich neue Eintrag ist keine Dublette.",
    ).toBe("keine");
    expect(body.kandidaten[1]?.dublettenbefund).toMatchObject({
      ergebnis: "aehnlich",
      treffer: { art: "wissensobjekt", koId: bestandId },
    });

    const vorAnnahme = await app.inject({ method: "GET", url: "/api/kos", headers });
    expect((vorAnnahme.json() as { title: string }[]).map((ko) => ko.title)).toEqual([
      "Ventil entlueften",
    ]);
    const angenommen: KandidatDto[] = [];
    for (const k of body.kandidaten) {
      const annahme = await app.inject({
        method: "PUT",
        url: `/api/library/import/candidates/${k.id}`,
        headers,
        payload: { action: "accept" },
      });
      expect(annahme.statusCode, annahme.body).toBe(200);
      angenommen.push(annahme.json() as KandidatDto);
    }
    expect(angenommen[0]?.koId, "Der fachlich neue Eintrag MUSS ankommen.").toBeTruthy();
    expect(angenommen[1]?.koId, "Der aehnliche Eintrag legt kein Objekt an.").toBeNull();

    const liste = await app.inject({ method: "GET", url: "/api/kos", headers });
    const titel = (liste.json() as { title: string }[]).map((ko) => ko.title).sort();
    expect(titel).toEqual(["Notstromaggregat monatlich probelaufen lassen", "Ventil entlueften"]);
  });
});
