// ================================================================================================
// JOB 4151 · R6 — DIE ANTWORT DER SCHREIBWEGE HAT DIE FORM, DIE DIE ANZEIGE WIRKLICH LIEST.
// ================================================================================================
//
// DER BEFUND, DER DIESE DATEI ERZWUNGEN HAT, und er ist erst beim EINBAU sichtbar geworden:
// WG-PERSISTENZ (dieser Job) und WG-ANZEIGE (JOB 4153) wurden nebeneinander aus demselben
// verbindlichen API-Vertrag geschnitten. Beide waren für sich grün. Zusammengesetzt passte die
// Antwort des Schreibwegs nicht zu dem, was die Anzeige von ihr liest:
//
//   · Der Server sendete das AGGREGAT (`KuratierteKante`: `quelleId`/`zielId`, kein `gegenstueck`).
//   · Die Anzeige liest `antwort.gegenstueck.id`, um zu prüfen, ob die Antwort ihr eigener Auftrag
//     ist (`apps/web/src/components/WissensbeziehungenBereich.tsx`, `antwortPasstZumAuftrag`).
//
// Am echten Draht wäre das `undefined.id` gewesen — ein Fehler GENAU IM ERFOLGSFALL, also dann,
// wenn der Mensch gerade etwas richtig gemacht hat.
//
// WARUM ES KEINE DER BEIDEN SEITEN GEMERKT HAT: Die Prüfungen der Anzeige laufen gegen eine
// Attrappe, die ein `gegenstueck` mitliefert (`tests/wissensgraph-anzeige/bestand.ts:225`) — grün
// gegen eine Form, die der Server nie gesendet hat. Und die Prüfungen dieses Jobs lasen von der
// Antwort nur `id`, `urheber`, `version` und `status`, also ausgerechnet die Felder, die in BEIDEN
// Formen gleich heissen. Zwei grüne Testsätze, ein kaputter Draht.
//
// DIESE DATEI MISST DESHALB DIE ANTWORT SELBST, an der vollständigen App und mit echten Konten —
// und sie misst sie mit DERSELBEN Bedingung, die die Anzeige stellt, statt sie nachzuerzählen.
import { describe, expect, it } from "vitest";
import { baueBuehne, kopfFuer, neuesKo } from "./buehne";

/**
 * Die Bedingung der Anzeige, Feld für Feld übernommen aus
 * `apps/web/src/components/WissensbeziehungenBereich.tsx` (`antwortPasstZumAuftrag`).
 *
 * SIE STEHT HIER NACHGEBILDET UND WIRD NICHT IMPORTIERT: `apps/web` ist ein anderer Baum, und ein
 * Import über die Baumgrenze gäbe es sonst nirgends. Der Preis ist benannt — weicht die Anzeige
 * eines Tages ab, misst dieser Test die alte Bedingung. Dagegen hilft nur, dass hier steht, WOHER
 * sie stammt.
 */
function antwortPasstZumAuftrag(
  antwort: { gegenstueck?: { id?: string }; art?: string; richtung?: string },
  auftrag: { zielId: string; art: string; richtung: string },
): boolean {
  return (
    antwort.gegenstueck?.id === auftrag.zielId &&
    antwort.art === auftrag.art &&
    antwort.richtung === auftrag.richtung
  );
}

let laufendeMarke = 0;
const frischeMarke = (): string => {
  laufendeMarke += 1;
  return `antwortform-${laufendeMarke}`;
};

describe("JOB 4151 · A — die Schreibwege antworten in der Ansichtsform", () => {
  it("A1: POST liefert `gegenstueck`, `aktuell`, `abweichung` und `herkunft` — nicht das nackte Aggregat", async () => {
    const buehne = await baueBuehne();
    try {
      const links = await neuesKo(buehne, "Wartungsplan Halle 2");
      const rechts = await neuesKo(buehne, "Filterwechsel dokumentiert");
      const auftrag = { zielId: rechts, art: "ergaenzt", richtung: "ungerichtet" };

      const antwort = await buehne.app.inject({
        method: "POST",
        url: `/api/kos/${links}/beziehungen`,
        headers: kopfFuer(buehne, "controller"),
        payload: {
          ...auftrag,
          beitragSchluessel: frischeMarke(),
          gesehen: { quelleVersion: 1, zielVersion: 1 },
        },
      });

      expect(antwort.statusCode, antwort.body).toBe(201);
      const kante = antwort.json() as Record<string, unknown>;

      // DIE EINE BEDINGUNG, AN DER DIE ANZEIGE HÄNGT. Vor dieser Runde war sie `undefined === id`
      // und damit `false` — die Fläche hätte „anderer Auftrag" gemeldet, wo sie gerade erfolgreich
      // gesetzt hat.
      expect(
        antwortPasstZumAuftrag(kante, auftrag),
        `die Antwort trägt den Auftrag nicht: ${antwort.body}`,
      ).toBe(true);

      expect(kante.gegenstueck).toMatchObject({ id: rechts, title: "Filterwechsel dokumentiert" });
      expect(kante.herkunft).toBe("kuratiert");
      expect(kante.status).toBe("aktiv");
      // Der Inhaltsbezug (G6) reist mit — ohne ihn könnte die Fläche „gilt das noch?" nicht
      // beantworten und müsste raten.
      expect(kante.aktuell).toEqual({ quelleVersion: 1, zielVersion: 1 });
      expect(kante.abweichung).toBe("unveraendert");

      // UND DAS AGGREGAT IST NICHT DURCHGESICKERT. Ohne diese Zeile wäre A1 auch mit einer Antwort
      // grün, die BEIDE Formen zusammenwirft — und dann gäbe es am Draht wieder zwei Wahrheiten.
      expect(kante.quelleId, "die Antwort trägt noch Felder des Aggregats").toBeUndefined();
      expect(kante.zielId).toBeUndefined();
      expect(
        kante.beitragSchluessel,
        "Wiederholschlüssel gehören nicht in die Auskunft",
      ).toBeUndefined();
    } finally {
      await buehne.schliesse();
    }
  });

  it("A2: die WIEDERHOLUNG desselben Beitrags antwortet in derselben Form (200)", async () => {
    // Ohne diesen Fall wäre A1 auch mit einem Server grün, der nur den Neuanlagezweig umgestellt
    // hat — und ausgerechnet die Wiederholung ist der Fall, in dem die Antwort verloren ging und
    // die Fläche sie am dringendsten richtig lesen muss.
    const buehne = await baueBuehne();
    try {
      const links = await neuesKo(buehne, "Wartungsplan Halle 2");
      const rechts = await neuesKo(buehne, "Filterwechsel dokumentiert");
      const auftrag = { zielId: rechts, art: "ergaenzt", richtung: "ungerichtet" };
      const nutzlast = {
        ...auftrag,
        beitragSchluessel: frischeMarke(),
        gesehen: { quelleVersion: 1, zielVersion: 1 },
      };
      const senden = () =>
        buehne.app.inject({
          method: "POST",
          url: `/api/kos/${links}/beziehungen`,
          headers: kopfFuer(buehne, "controller"),
          payload: nutzlast,
        });

      const erste = await senden();
      const zweite = await senden();

      expect(erste.statusCode).toBe(201);
      expect(zweite.statusCode, zweite.body).toBe(200);
      const wiederholt = zweite.json() as Record<string, unknown>;
      expect(antwortPasstZumAuftrag(wiederholt, auftrag), zweite.body).toBe(true);
      // Es ist dieselbe Beziehung, unverändert — die Idempotenzzusage, jetzt auch in der Form.
      expect(wiederholt.id).toBe((erste.json() as { id: string }).id);
      expect(wiederholt.version).toBe(1);
    } finally {
      await buehne.schliesse();
    }
  });

  it("A3: der WIDERRUF antwortet mit `status: widerrufen`, dem Zeitpunkt und BEIDEN Namen", async () => {
    const buehne = await baueBuehne();
    try {
      const links = await neuesKo(buehne, "Wartungsplan Halle 2");
      const rechts = await neuesKo(buehne, "Filterwechsel dokumentiert");
      const gesetzt = await buehne.app.inject({
        method: "POST",
        url: `/api/kos/${links}/beziehungen`,
        headers: kopfFuer(buehne, "controller"),
        payload: {
          zielId: rechts,
          art: "ergaenzt",
          richtung: "ungerichtet",
          beitragSchluessel: frischeMarke(),
          gesehen: { quelleVersion: 1, zielVersion: 1 },
        },
      });
      expect(gesetzt.statusCode, gesetzt.body).toBe(201);
      const { id, version } = gesetzt.json() as { id: string; version: number };

      // Ein ANDERER Mensch nimmt zurück — nur so lassen sich die beiden Verantwortlichkeiten
      // überhaupt unterscheiden.
      const widerruf = await buehne.app.inject({
        method: "POST",
        url: `/api/beziehungen/${id}/widerruf`,
        headers: kopfFuer(buehne, "admin"),
        payload: { version },
      });

      expect(widerruf.statusCode, widerruf.body).toBe(200);
      const zurueck = widerruf.json() as Record<string, unknown>;
      // DIE FRAGE DER FLÄCHE nach einem Widerruf, wörtlich (`widerrufAusfuehren`): ist er geschehen?
      expect(zurueck.status, "der Widerruf meldet sich nicht als solcher").toBe("widerrufen");
      // Auch hier die Ansichtsform — sonst läse die Fläche auf zwei Wegen zwei verschiedene Formen.
      //
      // DIE ORIENTIERUNG IST DIE KANONISCHE, und dieser Test hat sie beim ersten Lauf selbst
      // korrigiert: in dieser Adresse steht KEIN Wissenseintrag, nur die Kennung der Beziehung —
      // es gibt also kein „angefragtes Objekt", aus dem sich das Gegenstück ergäbe. Die Route
      // orientiert deshalb an `quelleId`, und die ist bei einer richtungslosen Beziehung die
      // lexikografisch kleinere Kennung (`kanten-paar.ts`). Das Gegenstück ist damit die grössere —
      // unabhängig davon, von welcher Seite aus der Mensch widerrufen hat. Genau diese
      // Unabhängigkeit ist der Zweck der Wahl; ein `toMatchObject({ id: rechts })` hätte hier nur
      // zufällig gestimmt.
      const [, groessere] = [links, rechts].sort();
      expect(zurueck.gegenstueck).toMatchObject({ id: groessere });
      expect(zurueck.herkunft).toBe("kuratiert");
      // ZWEI NAMEN, ZWEI AUSSAGEN: wer sie erfunden hat, und wer sie zurückgenommen hat.
      expect(zurueck.urheber, "der ursprüngliche Urheber ist überschrieben").toBe(
        buehne.konto.controller.id,
      );
      expect(zurueck.widerrufenVon, "der Widerrufende fehlt in der Antwort").toBe(
        buehne.konto.admin.id,
      );
      expect(typeof zurueck.geaendertAm, "der Zeitpunkt der Rücknahme fehlt").toBe("string");
      expect(zurueck.version).toBe(version + 1);
    } finally {
      await buehne.schliesse();
    }
  });

  it("A4: GEGENPROBE — der Leseweg führt die widerrufene Beziehung NICHT", async () => {
    // Die Kehrseite von A3 und die Grenze der Ansichtsform: dass der SCHREIBweg `widerrufen`
    // zurückgibt, darf den LESEweg nicht aufweichen. Täte es das, wäre aus der Antwortform eine
    // Existenzauskunft geworden — genau das, was der Trimm verhindert.
    const buehne = await baueBuehne();
    try {
      const links = await neuesKo(buehne, "Wartungsplan Halle 2");
      const rechts = await neuesKo(buehne, "Filterwechsel dokumentiert");
      const gesetzt = await buehne.app.inject({
        method: "POST",
        url: `/api/kos/${links}/beziehungen`,
        headers: kopfFuer(buehne, "controller"),
        payload: {
          zielId: rechts,
          art: "ergaenzt",
          richtung: "ungerichtet",
          beitragSchluessel: frischeMarke(),
          gesehen: { quelleVersion: 1, zielVersion: 1 },
        },
      });
      const { id, version } = gesetzt.json() as { id: string; version: number };
      await buehne.app.inject({
        method: "POST",
        url: `/api/beziehungen/${id}/widerruf`,
        headers: kopfFuer(buehne, "admin"),
        payload: { version },
      });

      const liste = await buehne.app.inject({
        method: "GET",
        url: `/api/kos/${links}/beziehungen`,
        headers: kopfFuer(buehne, "controller"),
      });
      expect(liste.statusCode).toBe(200);
      expect(liste.json()).toEqual({ koId: links, kanten: [], total: 0 });
    } finally {
      await buehne.schliesse();
    }
  });
});
