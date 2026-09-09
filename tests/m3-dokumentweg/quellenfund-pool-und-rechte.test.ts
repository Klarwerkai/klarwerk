// ================================================================================================
// JOB 3216 · M3c — DER QUELLENFUND ERBT DEN POOL UND DIE RECHTE, ER ERFINDET SIE NICHT.
// ================================================================================================
//
// Ein Quellenfund liefert einen AUSSCHNITT AUS DEM GESPEICHERTEN VOLLTEXT eines fremden Objekts.
// Damit ist er derselbe Egress wie die Bibliothekssuche — und trägt zusätzlich die engeren Regeln
// der Textprüfung. Diese Datei misst beide Schichten am echten HTTP-Weg:
//
//   · Zustand      — der Add-in-Schlüsselweg sieht nur Validiertes; der Sitzungsweg auch Offenes.
//   · Entwurf      — ein privater Entwurf ist kein Wissensobjekt und nie ein Suchraum.
//   · Vertraulich  — vertrauliche Objekte sind KEINE Kandidaten, auch nicht für die Kuratorin,
//                    die sie in der Bibliothek sehr wohl findet.
//   · Demobestand  — Demodaten sind kein Wissen des Hauses.
//   · Deckel       — höchstens 20 werden geprüft und ausgeliefert; die Kennzeichnung sagt es.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  KURZE_AUSSAGE,
  PASSAGE,
  S1,
  anlegen,
  aufbau,
  eigeneKennung,
  langerBody,
  loginCookie,
  pruefe,
  pruefeMitSchluessel,
  validieren,
} from "./harness";

const FLAG = "KLARWERK_ADDON_API";
const SCHLUESSELNAME = "KLARWERK_ADDON_API_KEY";
const SCHLUESSEL = "m3c-schluessel-fuer-den-test";
const GEMERKT: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of [FLAG, SCHLUESSELNAME]) {
    GEMERKT[k] = process.env[k];
  }
  process.env[FLAG] = "1";
  process.env[SCHLUESSELNAME] = SCHLUESSEL;
});
afterEach(() => {
  for (const k of [FLAG, SCHLUESSELNAME]) {
    if (GEMERKT[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = GEMERKT[k];
    }
  }
});

describe.each(["bearer", "cookie"] as const)(
  "M3c · Pool und Rechte des Quellenfunds · %s",
  (anmeldeweg) => {
    it("B1 · Passage nur in einem OFFENEN Objekt: Schlüsselweg leer, Sitzungsweg findet es", async () => {
      const { app, autor, admin } = await aufbau(anmeldeweg);
      const id = await anlegen(app, autor, {
        title: "Eingereichtes Handbuch",
        statement: KURZE_AUSSAGE,
        bodyHtml: langerBody(PASSAGE),
        type: "best_practice",
        category: "Produktion",
        neededValidations: 1,
      });

      // Der eingeschränkte Add-in-Schlüsselweg (`checktext.validated`) bleibt eingeschränkt.
      const ueberSchluessel = await pruefeMitSchluessel(app, SCHLUESSEL, PASSAGE);
      expect(ueberSchluessel.sourceHits).toEqual([]);
      expect(ueberSchluessel.quellenfund.gelaufen).toBe(true);

      // Der angemeldete Mensch prüft gegen den ganzen Bestand — mit Prüfstand am Treffer.
      const ueberSitzung = await pruefe(app, autor, PASSAGE);
      const treffer = ueberSitzung.sourceHits.find((h) => h.refId === id);
      expect(treffer, JSON.stringify(ueberSitzung.sourceHits)).toBeDefined();
      expect(treffer?.pruefstand).toBe("eingereicht");
      expect(treffer?.koStatus).toBe("offen");

      // GEGENPROBE ZUR LEERE OBEN: nach der Validierung findet ihn AUCH der Schlüsselweg. Die Leere
      // lag am Zustand, nicht an einer kaputten Verdrahtung.
      await validieren(app, admin, id);
      const danach = await pruefeMitSchluessel(app, SCHLUESSEL, PASSAGE);
      expect(danach.sourceHits.map((h) => h.refId)).toEqual([id]);
    });

    it("B2 · ein privater Entwurf mit derselben Passage wird NIE zum Quellenfund", async () => {
      const { app, autor } = await aufbau(anmeldeweg);
      const entwurf = await app.inject({
        method: "POST",
        url: "/api/drafts",
        headers: autor,
        payload: {
          title: "Mein privater Entwurf",
          statement: KURZE_AUSSAGE,
          bodyHtml: langerBody(PASSAGE),
          type: "best_practice",
          category: "Produktion",
        },
      });
      expect(entwurf.statusCode, entwurf.body).toBe(201);
      const entwurfId = (entwurf.json() as { id: string }).id;

      const antwort = await pruefe(app, autor, PASSAGE);
      expect(antwort.sourceHits).toEqual([]);
      expect(JSON.stringify(antwort)).not.toContain(entwurfId);
    });

    it("B3 · ein vertrauliches Objekt ist kein Kandidat — auch nicht für die Kuratorin", async () => {
      const { app, services, admin, fremd } = await aufbau(anmeldeweg);
      const fremdId = await eigeneKennung(app, fremd);
      const ko = (await services.ko.create({
        title: "Vertrauliches Handbuch",
        statement: KURZE_AUSSAGE,
        bodyHtml: langerBody(PASSAGE),
        type: "best_practice",
        category: "Produktion",
        author: fremdId,
        confidentiality: "vertraulich",
      })) as { id: string };

      // Die Admin-Rolle trägt `ko.validate` und SIEHT das Objekt in der Bibliothek — der Vergleich
      // ist der Punkt: die Textprüfung ist enger als die Suche, nicht die Suche kaputt.
      const bibliothek = await app.inject({
        method: "GET",
        url: `/api/library/search?q=${encodeURIComponent(S1)}`,
        headers: admin,
      });
      expect(bibliothek.statusCode, bibliothek.body).toBe(200);
      expect((bibliothek.json() as { id: string }[]).map((t) => t.id)).toContain(ko.id);

      const antwort = await pruefe(app, admin, PASSAGE);
      expect(antwort.sourceHits).toEqual([]);
      expect(JSON.stringify(antwort)).not.toContain("Vertrauliches Handbuch");
    });

    it("B4 · Demobestand ist kein Wissen des Hauses und nie ein Quellenfund", async () => {
      const { app, services, autor } = await aufbau(anmeldeweg);
      const autorId = await eigeneKennung(app, autor);
      const ko = (await services.ko.create({
        title: "Demo-Handbuch",
        statement: KURZE_AUSSAGE,
        bodyHtml: langerBody(PASSAGE),
        type: "best_practice",
        category: "Produktion",
        author: autorId,
        demoSeed: true,
      })) as { id: string };

      const antwort = await pruefe(app, autor, PASSAGE);
      expect(antwort.sourceHits.map((h) => h.refId)).not.toContain(ko.id);
      expect(antwort.sourceHits).toEqual([]);
    });

    it("B5 · mehr zulässige Kandidaten als der Deckel → 20 Funde und `sourceHitsTruncated`", async () => {
      const { app, autor } = await aufbau(anmeldeweg);
      const ids: string[] = [];
      for (let i = 0; i < 21; i += 1) {
        ids.push(
          await anlegen(app, autor, {
            title: `Handbuch ${i}`,
            statement: KURZE_AUSSAGE,
            bodyHtml: langerBody(PASSAGE),
            type: "best_practice",
            category: "Produktion",
            neededValidations: 1,
          }),
        );
      }
      const antwort = await pruefe(app, autor, PASSAGE);
      expect(antwort.sourceHits).toHaveLength(20);
      expect(antwort.sourceHitsTruncated).toBe(true);
      expect(antwort.quellenfund.geprueft).toBe(20);
      // Jeder ausgelieferte Fund gehört zu einem der angelegten Objekte — keine erfundenen Einträge.
      for (const treffer of antwort.sourceHits) {
        expect(ids).toContain(treffer.refId);
      }
    });

    it("B6 · der Sicherheitstrim der Route reist bis in die Datenquelle — und nur am Menschenweg", async () => {
      // WARUM DIESER FALL SEIN MUSS. Auf dem heutigen Regelstand sind die beiden Sichtbarkeitslinien
      // der Route (`sqlSichtbarkeitFuer` als Trim, `sichtbarkeitsfilterFuer` als Prädikat) in ihrer
      // WIRKUNG von der engeren Poolregel des Kerns verdeckt: was `darfSehen` ausschließt
      // (vertraulich, fremder Autor), schließt `istPoolKandidat` ohnehin aus, und den Papierkorb
      // filtert `KoService.listForSearch` selbst. Ein rein ergebnisbezogener Fall könnte den Wegfall
      // dieser Verdrahtung deshalb NICHT sehen — sie wäre gebaut und nie gerufen, genau die
      // Fehlerklasse, gegen die der Aufrufer-Wächter steht. Gemessen wird darum die ÜBERGABE.
      const { app, services, autor } = await aufbau(anmeldeweg);
      await anlegen(app, autor, {
        title: "Handbuch fuer den Trimnachweis",
        statement: KURZE_AUSSAGE,
        bodyHtml: langerBody(PASSAGE),
        type: "best_practice",
        category: "Produktion",
        neededValidations: 1,
      });
      const spion = vi.spyOn(services.ko, "listForSearch");

      await pruefe(app, autor, PASSAGE);
      const amMenschenweg = spion.mock.calls.at(-1);
      expect(amMenschenweg?.[1], "Sitzungsweg ohne Sicherheitstrim").toBeDefined();

      spion.mockClear();
      await pruefeMitSchluessel(app, SCHLUESSEL, PASSAGE);
      // Der Schlüsselweg hat keinen angemeldeten Menschen — also auch keinen Trim. Dass er trotzdem
      // gesucht hat, belegt der Aufruf selbst; dass er nichts findet, belegt B1.
      for (const aufruf of spion.mock.calls) {
        expect(aufruf[1]).toBeUndefined();
      }
      spion.mockRestore();
    });
  },
);

it.each(["fehlend", "ungültig"] as const)(
  "C1 · Cookie %s, kein Authorization: 401 und keine sourceHits",
  async (lage) => {
    const { app } = await aufbau();
    try {
      const echt = await loginCookie(app, "autor@m3c.test", "geheim12345");
      // Den echten Namen übernehmen, nur den Sitzungswert ungültig machen.
      const headers =
        lage === "fehlend" ? {} : { cookie: `${echt.cookie.split("=")[0]}=ungueltige-sitzung` };
      expect(headers).not.toHaveProperty("authorization");
      const res = await app.inject({
        method: "POST",
        url: "/api/check-text",
        headers,
        payload: { text: PASSAGE },
      });
      expect(res.statusCode, res.body).toBe(401);
      expect(res.json()).not.toHaveProperty("sourceHits");
    } finally {
      await app.close();
    }
  },
);
