// ================================================================================================
// JOB 3023 — DIESELBE SACHE ZWEIMAL IN EINER NUTZLAST ERZEUGT EIN OBJEKT, NICHT ZWEI.
// ================================================================================================
//
// Der Vergleich lief bis HEAD 7cf92ce gegen einen `Set`, der die bereits importierten Schluessel
// mitfuehrte (`service.ts:1430`) — aber wieder nur zeichengleich. Eine Sicherung, die denselben
// Eintrag zweimal in leicht abweichender Schreibweise enthaelt, legte ihn zweimal an. Der Bestand
// war danach schon beim ERSTEN Einspielen doppelt.
//
// Lauf gesamt-import-adoption (Bens B3, R-0143): `POST /api/library/import` reiht nur noch
// Kandidaten ein; erst die Annahme legt an. Derselbe Schutz wird darum zweimal gemessen: beim
// Einreihen trifft der zweite Eintrag den Kandidaten DESSELBEN Laufs, und nach der Annahme beider
// Kandidaten steht genau ein Objekt im Bestand.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KandidatDublettenbefund } from "../../services/library-analytics";

const ZUGANG = { name: "Admin", email: "laufintern@x.de", password: "secret123" };

interface KandidatDto {
  id: string;
  koId: string | null;
  dublettenbefund?: KandidatDublettenbefund;
}

async function leereApp() {
  const app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  return { app, headers: { authorization: `Bearer ${login.json().token}` } };
}

describe("JOB 3023 · B — der Vergleich laeuft auch gegen den eigenen Lauf", () => {
  it("B1 · zweimal dieselbe Sache in EINER Nutzlast → ein Objekt", async () => {
    const { app, headers } = await leereApp();

    const res = await app.inject({
      method: "POST",
      url: "/api/library/import",
      headers,
      payload: {
        items: [
          {
            title: "Filter wechseln",
            statement: "Den Filter der Anlage 3 jaehrlich wechseln.",
            type: "best_practice",
            category: "Wartung",
          },
          {
            title: "FILTER WECHSELN",
            statement: "Den Filter der Anlage 3 jaehrlich wechseln!",
            type: "best_practice",
            category: "Wartung",
          },
        ],
      },
    });

    expect(res.statusCode, res.body).toBe(201);
    const kandidaten = res.json() as KandidatDto[];
    expect(kandidaten).toHaveLength(2);
    expect(kandidaten[0]?.dublettenbefund?.ergebnis).toBe("keine");
    expect(
      kandidaten[1]?.dublettenbefund,
      "Der zweite Eintrag trifft den Kandidaten DESSELBEN Laufs.",
    ).toMatchObject({
      ergebnis: "aehnlich",
      treffer: { art: "kandidat", kandidatId: kandidaten[0]?.id },
    });

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

    const liste = await app.inject({ method: "GET", url: "/api/kos", headers });
    const kos = liste.json() as { id: string }[];
    expect(
      kos,
      "Aus zwei Schreibweisen derselben Sache wird genau ein Wissensobjekt.",
    ).toHaveLength(1);
    expect(angenommen[0]?.koId).toBe(kos[0]?.id);
    expect(angenommen[1]?.koId, "Die Annahme der Dublette legt nichts an.").toBeNull();
    expect(
      angenommen[1]?.dublettenbefund,
      "Der Treffer ist das im selben Lauf erzeugte Objekt — nicht `null`.",
    ).toMatchObject({ ergebnis: "aehnlich", treffer: { art: "wissensobjekt", koId: kos[0]?.id } });
  });
});
