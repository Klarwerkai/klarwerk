// ================================================================================================
// JOB 3023 — DIE GEGENPROBE: EIN WIRKLICH NEUER EINTRAG WIRD EINGESPIELT.
// ================================================================================================
//
// Ohne diesen Fall waere „alles ueberspringen" gruen, und der Auftrag waere mit einer einzigen
// `return { dublette: true }`-Zeile erfuellbar. Er laeuft ueber DIESELBE Route wie die
// Dublettenfaelle.
//
// Lauf gesamt-import-adoption (Bens B3, R-0143): `POST /api/library/import` legt nichts mehr
// unmittelbar an, sondern reiht Kandidaten ein (201); erst die Annahme erzeugt das Objekt. Der Fall
// misst darum den GANZEN Weg — Einreihen (Befund je Eintrag) und Annahme aller Kandidaten — und
// zaehlt danach den Bestand, statt ein `imported` aus der Antwort zu lesen.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KandidatDublettenbefund } from "../../services/library-analytics";

const ZUGANG = { name: "Admin", email: "echtneu@x.de", password: "secret123" };

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

    expect(res.statusCode, res.body).toBe(201);
    const kandidaten = res.json() as KandidatDto[];
    expect(kandidaten).toHaveLength(2);
    expect(
      kandidaten[0]?.dublettenbefund?.ergebnis,
      "Der fachlich neue Eintrag ist keine Dublette.",
    ).toBe("keine");
    expect(kandidaten[1]?.dublettenbefund).toMatchObject({
      ergebnis: "aehnlich",
      treffer: { art: "wissensobjekt", koId: bestandId },
    });

    // Die Annahme ALLER Kandidaten: nur der neue legt ein Objekt an.
    const angenommen: KandidatDto[] = [];
    for (const kandidat of kandidaten) {
      const entscheidung = await app.inject({
        method: "PUT",
        url: `/api/library/import/candidates/${kandidat.id}`,
        headers,
        payload: { action: "accept" },
      });
      expect(entscheidung.statusCode, entscheidung.body).toBe(200);
      angenommen.push(entscheidung.json() as KandidatDto);
    }
    expect(angenommen[0]?.koId, "Der fachlich neue Eintrag MUSS ankommen.").toBeTruthy();
    expect(angenommen[1]?.koId, "Der aehnliche Eintrag legt kein Objekt an.").toBeNull();

    const liste = await app.inject({ method: "GET", url: "/api/kos", headers });
    const titel = (liste.json() as { title: string }[]).map((ko) => ko.title).sort();
    expect(titel).toEqual(["Notstromaggregat monatlich probelaufen lassen", "Ventil entlueften"]);
  });
});
