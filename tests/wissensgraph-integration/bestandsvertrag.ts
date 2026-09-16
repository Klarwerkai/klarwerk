// ================================================================================================
// JOB 4151 · WG-PERSISTENZ — DER FALLSATZ, DEN BEIDE BESTÄNDE ERFÜLLEN MÜSSEN. EINMAL GESCHRIEBEN.
// ================================================================================================
//
// WARUM ALS EIGENE DATEI UND NICHT ZWEIMAL ALS TESTDATEI. `kanten-repo.ts:20-24` sagt über den
// In-Memory-Bestand wörtlich: „Dieser Bestand ist die Vorlage, die ein solcher Adapter zu
// übersetzen hätte, nicht sein Ersatz." Eine Vorlage, deren Regeln an zwei Stellen einzeln
// behauptet werden, ist keine — sie ist der Anfang zweier Bestände, die auseinanderlaufen. Der
// Fallsatz steht deshalb genau einmal und wird zweimal GEFAHREN:
//
//   · `bestandsvertrag-beide-fassungen.test.ts`      → `DeduplizierenderKantenBestand` (Tor)
//   · `bestand-postgres.integration.test.ts`         → `PgKantenRepo` (Prüfplatz, echtes Postgres)
//
// DASS ES WIRKLICH ZWEI FAHRER GIBT, wird nicht geglaubt: `bestandsvertrag-beide-fassungen.test.ts`
// pinnt die Anwesenheit des zweiten Fahrers (V7). Ohne diesen Pin könnte die Postgres-Hälfte still
// verschwinden und die verbleibende Hälfte weiter grün „Vertrag erfüllt" melden.
import { expect, it } from "vitest";
import type { KantenRepo, KuratierteKante } from "../../services/knowledge-object";
import { KantenError } from "../../services/knowledge-object";

/** Ein vollständiges Aggregat mit sprechenden Vorgaben — jeder Fall setzt nur, was er meint. */
export function kante(
  p: Partial<KuratierteKante> & { quelleId: string; zielId: string },
): KuratierteKante {
  return {
    id: `k-${p.quelleId}-${p.zielId}`,
    art: "ergaenzt",
    richtung: "ungerichtet",
    urheber: "u-erste",
    gesetztAm: "2026-09-01T05:00:00.000Z",
    geaendertAm: "2026-09-01T05:00:00.000Z",
    status: "aktiv",
    version: 1,
    ...p,
  };
}

/** Wie ein Fahrer einen FRISCHEN, leeren Bestand herstellt. */
export type Bestandsfabrik = () => Promise<KantenRepo>;

/**
 * Der Fallsatz. `name` erscheint in jedem Testnamen, damit eine Fehlermeldung sagt, WELCHE Fassung
 * gebrochen ist — bei zwei Fahrern über demselben Text ist das die halbe Diagnose.
 *
 * `ueberspringen` ist der SICHTBARE Ausstieg für den Postgres-Fahrer: fehlt auf dem Prüfplatz
 * sowohl eine `KLARWERK_PG_TEST_URL` als auch eine Container-Laufzeit, meldet vitest die Fälle als
 * `skipped` — sie sehen dann nicht aus wie bestanden. Ein stiller Rückfall auf „grün" wäre die
 * gefährlichere Richtung: er behauptete einen Persistenznachweis, den niemand gefahren hat.
 * Der Speicherfahrer übergibt nichts und läuft immer.
 */
export function fuehreBestandsvertrag(
  name: string,
  frischerBestand: Bestandsfabrik,
  ueberspringen?: () => boolean,
): void {
  const fall = (titel: string, koerper: () => Promise<void>) => {
    it(titel, async (ctx) => {
      if (ueberspringen?.()) {
        ctx.skip();
        return;
      }
      await koerper();
    });
  };

  fall(`${name} · dieselbe Beziehung andersherum gesetzt bleibt EIN Eintrag`, async () => {
    const bestand = await frischerBestand();
    await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", id: "k-1" }));
    await bestand.setze(kante({ quelleId: "ko-b", zielId: "ko-a", id: "k-2" }));

    expect(await bestand.fuerKo("ko-a")).toHaveLength(1);
    expect(await bestand.fuerKo("ko-b")).toHaveLength(1);
  });

  fall(
    `${name} · KALIBRIERUNG: eine andere Art ist eine andere Beziehung — zwei Einträge`,
    async () => {
      // Ohne diesen Gegenfall wäre die Deduplizierung auch mit einem Bestand grün, der alles
      // zusammenwirft.
      const bestand = await frischerBestand();
      await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", art: "ergaenzt", id: "k-1" }));
      await bestand.setze(
        kante({ quelleId: "ko-a", zielId: "ko-b", art: "widerspricht", id: "k-2" }),
      );

      expect(await bestand.fuerKo("ko-a")).toHaveLength(2);
    },
  );

  fall(`${name} · gerichtet und richtungslos bleiben getrennt`, async () => {
    const bestand = await frischerBestand();
    await bestand.setze(
      kante({ quelleId: "ko-a", zielId: "ko-b", richtung: "ungerichtet", id: "k-1" }),
    );
    await bestand.setze(
      kante({ quelleId: "ko-a", zielId: "ko-b", richtung: "gerichtet", id: "k-2" }),
    );

    expect(await bestand.fuerKo("ko-a")).toHaveLength(2);
  });

  fall(`${name} · die älteste Herkunft bleibt stehen, die Kennung wandert nicht`, async () => {
    const bestand = await frischerBestand();
    await bestand.setze(
      kante({
        quelleId: "ko-a",
        zielId: "ko-b",
        id: "k-zuerst",
        urheber: "u-erste",
        gesetztAm: "2026-01-01T00:00:00.000Z",
      }),
    );
    await bestand.setze(
      kante({
        quelleId: "ko-b",
        zielId: "ko-a",
        id: "k-spaeter",
        urheber: "u-zweite",
        gesetztAm: "2026-09-01T05:00:00.000Z",
        geaendertAm: "2026-09-01T05:00:00.000Z",
      }),
    );

    const [k] = await bestand.fuerKo("ko-a");
    expect(k?.id).toBe("k-zuerst");
    expect(k?.urheber).toBe("u-erste");
    expect(k?.gesetztAm).toBe("2026-01-01T00:00:00.000Z");
    // Der Gegenfall zum Herkunftserhalt: was sich wirklich geändert hat, wird sichtbar.
    expect(k?.geaendertAm).toBe("2026-09-01T05:00:00.000Z");
    expect(k?.version).toBe(2);
  });

  fall(`${name} · Selbstbeziehungen werden AM EINGANG abgewiesen`, async () => {
    const bestand = await frischerBestand();
    await expect(bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-a" }))).rejects.toThrow(
      KantenError,
    );
    expect(await bestand.fuerKo("ko-a")).toEqual([]);
  });

  fall(
    `${name} · eine widerrufene Beziehung bleibt im Bestand — Widerruf ist keine Löschung`,
    async () => {
      const bestand = await frischerBestand();
      await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", id: "k-1" }));
      await bestand.setze(
        kante({ quelleId: "ko-a", zielId: "ko-b", id: "k-1", status: "widerrufen" }),
      );

      const gefunden = await bestand.fuerKo("ko-a");
      expect(gefunden).toHaveLength(1);
      expect(gefunden[0]?.status).toBe("widerrufen");
    },
  );

  fall(
    `${name} · der Widerrufs-Urheber wird abgelegt, gefunden und mit der Rücknahme wieder frei`,
    async () => {
      // JOB 4151 (BEN R2, Korrekturpflicht 3). Der Fall steht im GEMEINSAMEN Fallsatz und nicht nur
      // am Draht: über den Postgres-Fahrer belegt er, dass beide Verantwortlichkeiten eine neue
      // Instanz überleben — eine Spalte, die nur im Speicher existiert, wäre keine Rücknahme.
      const bestand = await frischerBestand();
      await bestand.setze(
        kante({ quelleId: "ko-a", zielId: "ko-b", id: "k-1", urheber: "u-erste" }),
      );
      await bestand.setze(
        kante({
          quelleId: "ko-a",
          zielId: "ko-b",
          id: "k-1",
          urheber: "u-erste",
          status: "widerrufen",
          widerrufenVon: "u-admin",
          geaendertAm: "2026-09-02T09:00:00.000Z",
        }),
      );

      const widerrufen = await bestand.hole("k-1");
      // BEIDE Namen, und sie sagen Verschiedenes: wer sie erfunden, wer sie zurückgenommen hat.
      expect(widerrufen?.urheber).toBe("u-erste");
      expect(widerrufen?.widerrufenVon).toBe("u-admin");
      expect(widerrufen?.geaendertAm).toBe("2026-09-02T09:00:00.000Z");

      // Erneut SETZEN macht sie wieder aktiv — dann gibt es keine geltende Rücknahme mehr, und es
      // steht auch niemand mehr dafür ein. Ein stehen gebliebener Name wäre eine falsche Auskunft.
      await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", id: "k-1" }));
      const wiederAktiv = await bestand.hole("k-1");
      expect(wiederAktiv?.status).toBe("aktiv");
      expect(wiederAktiv?.widerrufenVon ?? null).toBeNull();
      expect(wiederAktiv?.urheber).toBe("u-erste");
    },
  );

  fall(
    `${name} · \`hole\` findet die Beziehung über IHRE Kennung, nicht über die Endpunkte`,
    async () => {
      const bestand = await frischerBestand();
      await bestand.setze(kante({ quelleId: "ko-b", zielId: "ko-a", id: "k-1" }));

      const geholt = await bestand.hole("k-1");
      // Kanonisch abgelegt: die kleinere Kennung steht vorn, auch wenn andersherum gesetzt wurde.
      expect(geholt?.quelleId).toBe("ko-a");
      expect(geholt?.zielId).toBe("ko-b");
      expect(await bestand.hole("gibt-es-nicht")).toBeUndefined();
    },
  );

  fall(
    `${name} · eine veraltete erwartete Version wird abgewiesen, statt still zu überschreiben`,
    async () => {
      const bestand = await frischerBestand();
      await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", id: "k-1" }));
      // Stand ist jetzt Version 1. Ein zweiter Schreiber, der noch Version 1 kennt, kommt durch …
      await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", id: "k-1" }), {
        erwarteteVersion: 1,
      });
      expect((await bestand.hole("k-1"))?.version).toBe(2);

      // … und derselbe veraltete Stand ein zweites Mal nicht mehr.
      await expect(
        bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", id: "k-1" }), {
          erwarteteVersion: 1,
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect((await bestand.hole("k-1"))?.version).toBe(2);
    },
  );

  fall(
    `${name} · der beurteilte Inhaltsstand reist mit und überlebt die Fortschreibung`,
    async () => {
      const bestand = await frischerBestand();
      await bestand.setze(
        kante({
          quelleId: "ko-a",
          zielId: "ko-b",
          id: "k-1",
          beurteilt: {
            quelleVersion: 3,
            zielVersion: 7,
            quelleFassungAm: "2026-08-01T00:00:00.000Z",
            zielFassungAm: "2026-08-02T00:00:00.000Z",
          },
        }),
      );

      expect((await bestand.hole("k-1"))?.beurteilt).toEqual({
        quelleVersion: 3,
        zielVersion: 7,
        quelleFassungAm: "2026-08-01T00:00:00.000Z",
        zielFassungAm: "2026-08-02T00:00:00.000Z",
      });

      // Eine erneute Setzung beurteilt NEU — der Stand folgt der neuen Setzung, die Herkunft nicht.
      //
      // UND SIE WIRD ANDERSHERUM GESETZT. Das ist der eigentliche Prüfgegenstand dieses Falls:
      // `kanonischesPaar` dreht das Endpunktpaar zurück in die kanonische Form und MUSS dabei den
      // beurteilten Stand mitdrehen. Täte es das nicht, stünde hier die Fassung von `ko-a` unter
      // `zielVersion` — eine Verwechslung, die keinen Fehler wirft und trotzdem falsch auskunftet.
      await bestand.setze(
        kante({
          quelleId: "ko-b",
          zielId: "ko-a",
          id: "k-2",
          urheber: "u-zweite",
          beurteilt: {
            // In der Eingabeorientierung: Quelle ist `ko-b` (7), Ziel ist `ko-a` (4).
            quelleVersion: 7,
            zielVersion: 4,
            quelleFassungAm: "2026-08-02T00:00:00.000Z",
            zielFassungAm: "2026-09-10T00:00:00.000Z",
          },
        }),
      );
      const k = await bestand.hole("k-1");
      // Kanonisch abgelegt (ko-a vorn) — und der Stand ist mitgedreht.
      expect(k?.quelleId).toBe("ko-a");
      expect(k?.beurteilt).toEqual({
        quelleVersion: 4,
        zielVersion: 7,
        quelleFassungAm: "2026-09-10T00:00:00.000Z",
        zielFassungAm: "2026-08-02T00:00:00.000Z",
      });
      expect(k?.urheber).toBe("u-erste");
    },
  );

  fall(
    `${name} · die Wiederholschlüssel sammeln sich — kein Beitrag verliert seine Zusage`,
    async () => {
      const bestand = await frischerBestand();
      await bestand.setze(
        kante({ quelleId: "ko-a", zielId: "ko-b", id: "k-1", beitragSchluessel: ["b-1"] }),
      );
      await bestand.setze(
        kante({ quelleId: "ko-b", zielId: "ko-a", id: "k-2", beitragSchluessel: ["b-2"] }),
      );

      // BEIDE Schlüssel finden dieselbe Beziehung — auch der ältere. Behielte der Bestand nur den
      // letzten, liefe die Idempotenzzusage des ersten Beitrags still ab.
      expect((await bestand.holeNachBeitrag("b-1"))?.id).toBe("k-1");
      expect((await bestand.holeNachBeitrag("b-2"))?.id).toBe("k-1");
      expect(await bestand.holeNachBeitrag("gibt-es-nicht")).toBeUndefined();
    },
  );

  fall(`${name} · \`fuerKos\` liefert dieselbe Kante genau EINMAL`, async () => {
    const bestand = await frischerBestand();
    await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", id: "k-1" }));
    await bestand.setze(kante({ quelleId: "ko-b", zielId: "ko-c", id: "k-2" }));

    // `ko-a` und `ko-b` sind BEIDE Endpunkte von `k-1` — ohne Entdopplung stünde sie zweimal da,
    // und jeder Zähler über der Menge wäre um eins zu hoch.
    const beide = await bestand.fuerKos(["ko-a", "ko-b"]);
    expect(beide.map((k) => k.id).sort()).toEqual(["k-1", "k-2"]);
    expect(await bestand.fuerKos([])).toEqual([]);
  });

  fall(`${name} · \`alleAktiven\` lässt Widerrufenes aus — es ist Vergangenheit`, async () => {
    const bestand = await frischerBestand();
    await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", id: "k-1" }));
    await bestand.setze(
      kante({ quelleId: "ko-a", zielId: "ko-c", id: "k-2", status: "widerrufen" }),
    );

    expect((await bestand.alleAktiven()).map((k) => k.id)).toEqual(["k-1"]);
    // Und der Bestand HAT sie trotzdem — `alleAktiven` filtert, es löscht nicht.
    expect(await bestand.fuerKo("ko-c")).toHaveLength(1);
  });

  fall(
    `${name} · der Bestand fällt kein Sichtbarkeitsurteil — \`fuerKo\` gibt ungetrimmt heraus`,
    async () => {
      const bestand = await frischerBestand();
      await bestand.setze(
        kante({ quelleId: "ko-a", zielId: "ko-b", id: "k-1", status: "widerrufen" }),
      );

      expect(await bestand.fuerKo("ko-a")).toHaveLength(1);
    },
  );
}
