import { afterEach, describe, expect, it } from "vitest";
import { type App, befund, koAnlegen, welt } from "../eigene-ruecknahme/welt";

const apps: App[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("Q7: eigene Rücknahme mit echter Anmeldung, Löschroute und Dienstverdrahtung", () => {
  it.each(["a", "b"])(
    "gelöschte Seite %s verhindert den eigenen Nachweis nicht; Berechtigte lesen denselben Grabstein",
    async (seite) => {
      const { app, services, autorin, fremde, admin } = await welt();
      apps.push(app);
      const a = await koAnlegen(app, autorin, "Ventil V3", "Bei Überdruck schließen.");
      const b = await koAnlegen(app, autorin, "Pumpe P4", "Vor Wartung entlüften.");
      const entry = await befund(services, a, b);
      const url = `/api/duplicates/${entry.id}`;
      const vorher = await app.inject({ url, headers: autorin.headers });
      expect(vorher.statusCode).toBe(200);
      expect(vorher.json()).toEqual(entry);

      const geloescht = seite === "a" ? a : b;
      const del = await app.inject({
        method: "DELETE",
        url: `/api/kos/${geloescht}`,
        headers: autorin.headers,
      });
      expect(del.statusCode).toBe(204);
      expect(await services.ko.get(geloescht)).toBeUndefined();
      const gespeichert = await services.overlaps.get(entry.id);
      expect(gespeichert?.resolution).toMatchObject({ reason: "withdrawn_own", by: autorin.id });

      const nachweis = await app.inject({ url, headers: autorin.headers });
      expect(nachweis.statusCode).toBe(200);
      expect(nachweis.json()).toEqual({
        id: entry.id,
        status: "geschlossen",
        resolution: { reason: "withdrawn_own", by: autorin.id, at: gespeichert?.resolution?.at },
      });
      // Auftrag gesamt-dubletten-rueckzug (Q7-Kriterium „für Berechtigte"): beide Seiten sind
      // „intern", also durften Fremde und Admin das Paar vorher sehen. Sie lesen jetzt denselben
      // Grabstein — Grund, Urheber, Zeit —, nicht mehr das 404. Wer eine Seite NICHT sehen durfte,
      // bleibt beim 404: gemessen in tests/dubletten-ruecknahme-lesepfad/.
      for (const konto of [fremde, admin]) {
        const res = await app.inject({ url, headers: konto.headers });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toEqual(nachweis.json());
      }
      expect((await app.inject({ url })).statusCode).toBe(401);
      expect(
        (await app.inject({ url: "/api/duplicates", headers: autorin.headers })).json(),
      ).toEqual([]);
      expect(await services.overlaps.get(entry.id)).toEqual(gespeichert);
    },
  );
});
