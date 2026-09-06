// ================================================================================================
// JOB 3116 · R4 — DER DRAHTVERTRAG WIRD BELEGT, NICHT GEAENDERT.
// ================================================================================================
//
// `services/app/**` bleibt in diesem Auftrag unberuehrt: das Antwort-DTO der Route ist eine
// ALLOWLIST, die `dublettenbefund` als GANZES durchreicht (`library-routes.ts:95-97`). Ob der neue
// Ausgang samt Kennung damit wirklich beim Client ankommt, ist eine MESSUNG und keine Ableitung —
// dieselbe Stelle, an der JOB 3081 (P1b) den fuenften Ausgang gemessen hat.
//
// Gefahren wird die ECHTE Route `GET /api/library/import/candidates` auf einer echten
// Fastify-Instanz. Der Anker-Strang haengt am generischen Import-Enable
// (`build-app.ts`), darum das Flag NUR fuer `buildServices`.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { ImportItem } from "../../services/library-analytics";

const ZUGANG = { name: "Admin", email: "q2c-draht@x.de", password: "secret123" };

const ITEM: ImportItem = {
  title: "Wartungsplan Anlage 3",
  statement: "Den Filter der Anlage 3 jaehrlich wechseln",
  type: "best_practice",
  category: "Wartung",
  provider: "test",
  externalId: "q2c-draht-aktiv",
  sourceVersion: 1,
};

const GETRASHT: ImportItem = { ...ITEM, externalId: "q2c-draht-papierkorb" };

interface KandidatAmDraht {
  id: string;
  duplicate: boolean;
  dublettenbefund?: { ergebnis: string; treffer?: { art: string; koId: string } };
}

async function angemeldeteApp() {
  process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
  const services = buildServices();
  delete process.env.KLARWERK_CONFLUENCE_IMPORT;
  const app = buildApp(services);
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  return { app, headers: { authorization: `Bearer ${login.json().token}` } };
}

describe("JOB 3116 · R4 — die echte Route traegt beide Befunde mit Kennung", () => {
  it("R4 · GET /api/library/import/candidates liefert `wiederverwendet` UND `im_papierkorb`, je mit `treffer.koId`", async () => {
    const { app, headers } = await angemeldeteApp();
    const reiheEin = async (item: ImportItem) => {
      const res = await app.inject({
        method: "POST",
        url: "/api/library/import/candidates",
        headers,
        payload: { items: [item] },
      });
      expect(res.statusCode, res.body).toBe(201);
      return (res.json() as { id: string }[])[0]?.id as string;
    };
    const accept = async (id: string) => {
      const res = await app.inject({
        method: "PUT",
        url: `/api/library/import/candidates/${id}`,
        headers,
        payload: { action: "accept" },
      });
      expect(res.statusCode, res.body).toBe(200);
      return (res.json() as { koId: string | null }).koId;
    };

    // (a) Anker AKTIV: einspielen, annehmen, denselben Anker erneut einspielen.
    const aktiveKennung = await accept(await reiheEin(ITEM));
    expect(aktiveKennung, "Der erste Accept legt das Objekt an.").toEqual(expect.any(String));
    const wiederverwendet = await reiheEin({ ...ITEM, sourceVersion: 2 });

    // (b) Anker im PAPIERKORB: einspielen, annehmen, loeschen, erneut einspielen.
    const getrashteKennung = await accept(await reiheEin(GETRASHT));
    const geloescht = await app.inject({
      method: "DELETE",
      url: `/api/kos/${getrashteKennung}`,
      headers,
    });
    expect(geloescht.statusCode, geloescht.body).toBe(204);
    const imPapierkorb = await reiheEin({ ...GETRASHT, sourceVersion: 2 });

    const liste = await app.inject({
      method: "GET",
      url: "/api/library/import/candidates",
      headers,
    });
    expect(liste.statusCode, liste.body).toBe(200);
    const kandidaten = liste.json() as KandidatAmDraht[];
    const befundVon = (id: string) => kandidaten.find((k) => k.id === id)?.dublettenbefund;

    expect(
      befundVon(wiederverwendet),
      "Der Wiederimport auf einen aktiven Anker weist die Kennung des bestehenden Objekts aus.",
    ).toEqual({
      ergebnis: "wiederverwendet",
      treffer: { art: "wissensobjekt", koId: aktiveKennung },
    });
    expect(
      befundVon(imPapierkorb),
      "Und der Papierkorb-Fall unveraendert die Kennung des getrashten Objekts (JOB 3081).",
    ).toEqual({
      ergebnis: "im_papierkorb",
      treffer: { art: "wissensobjekt", koId: getrashteKennung },
    });
  });
});
