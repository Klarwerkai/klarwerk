import { describe, expect, it } from "vitest";
import {
  KlaraErinnerungDienst,
  KlaraErinnerungSteuerung,
  inMemoryErinnerungAblage,
} from "../../services/app/src/klara-erinnerung";
import { InMemoryKlaraNotizRepo, KlaraNotizDienst } from "../../services/app/src/klara-notiz";
import type {
  PflegeLeser,
  PflegeQuelle,
  PflegeVorlage,
} from "../../services/app/src/klara-wissenspflege";

const ICH = "pflege-anna";
const um = (tag: number) => Date.parse(`2026-10-${String(tag).padStart(2, "0")}T07:00:05.000Z`);
function system() {
  let jetzt = um(20) - 10_000;
  let sichtbar = true;
  let zugang = true;
  let quelle: PflegeQuelle = {
    id: "anleitung-a4",
    fassung: 1,
    titel: "Fiktive Anleitung A-4",
    aussage: "Nur Prüfunterlagen vorbereiten.",
    offenePruefung: { stand: 2, seit: "2026-10-19T10:00:00.000Z" },
    frische: { stufe: "faellig", bezugAm: null, haltbarBis: null, konflikt: "nicht_erhoben" },
  };
  const ablage = inMemoryErinnerungAblage();
  const notizen = new InMemoryKlaraNotizRepo();
  let vorSchreiben: (() => Promise<void>) | undefined;
  let nachSchreiben: (() => Promise<void>) | undefined;
  let antwortVerloren = false;
  let modelle = 0;
  const leser: PflegeLeser & { unterQuellschutz<T>(arbeit: () => Promise<T>): Promise<T> } = {
    lies: async () => {
      if (!sichtbar || !zugang) return null;
      const gesehen = structuredClone(quelle);
      const gilt = () => sichtbar && zugang && JSON.stringify(quelle) === JSON.stringify(gesehen);
      return { quelle: gesehen, nochAktuell: async () => gilt(), bedingung: { gilt } };
    },
    unterQuellschutz: (arbeit) => arbeit(),
  };
  const dienst = new KlaraErinnerungDienst({
    ablage,
    notizen,
    jetzt: () => jetzt,
    wissenspflege: leser,
  });
  const steuerung = () =>
    new KlaraErinnerungSteuerung({
      ablage,
      jetzt: () => jetzt,
      wissenspflege: leser,
      konto: async () => ({ approved: zugang }),
      zusammenfassen: async () => {
        modelle += 1;
        throw new Error("Nicht beauftragt");
      },
      ergebnisablage: {
        zuVorgang: (kontoId, v) => notizen.zuVorgang(kontoId, v),
        lege: async (kontoId, eingabe, bedingung) => {
          const davor = vorSchreiben;
          vorSchreiben = undefined;
          await davor?.();
          const r = await new KlaraNotizDienst({ repo: notizen, jetzt: () => jetzt }).lege(
            kontoId,
            eingabe,
            bedingung,
          );
          const danach = nachSchreiben;
          nachSchreiben = undefined;
          await danach?.();
          if (antwortVerloren) {
            antwortVerloren = false;
            throw new Error("Antwort nach Speicherung verloren");
          }
          return r;
        },
      },
    });
  return {
    dienst,
    ablage,
    notizen,
    steuerung,
    zeit: (tag: number) => {
      jetzt = um(tag);
    },
    version: (fassung: number) => {
      quelle = { ...quelle, fassung, aussage: `Fiktiver Quellstand ${fassung}.` };
    },
    entziehen: () => {
      sichtbar = false;
    },
    pruefstand: (stand: number) => {
      quelle = { ...quelle, offenePruefung: { stand, seit: "2026-10-20T07:00:05.000Z" } };
    },
    kontoSperren: () => {
      zugang = false;
    },
    vorSchreiben: (fn: () => Promise<void>) => {
      vorSchreiben = fn;
    },
    nachSchreiben: (fn: () => Promise<void>) => {
      nachSchreiben = fn;
    },
    antwortVerlieren: () => {
      antwortVerloren = true;
    },
    modelle: () => modelle,
    berichte: () => notizen.liste(ICH, { woerter: [], art: null, limit: 100 }),
    meldungen: () => ablage.meldungen.fuerKonto(ICH, 100),
    lege: async (vorlage: PflegeVorlage) =>
      (
        await dienst.lege(ICH, {
          vorgang: `pflege-${crypto.randomUUID()}`,
          titel: "Fiktive beauftragte Wissenspflege",
          aktion: "routine_bericht",
          zeitzone: "Europe/Berlin",
          zeitplan: {
            art: "serie",
            datum: "2026-10-20",
            uhrzeit: "09:00",
            wiederholung: { takt: "taeglich", intervall: 1, bis: "2026-10-23", anzahl: null },
          },
          routine: { wissenspflege: { vorlage, quellen: ["anleitung-a4"] } },
          verpasst: { regel: "nachholen", grenzeMinuten: 30 },
        })
      ).eintrag.erinnerung,
  };
}

describe("AW20 · Wissenspflege in der vorhandenen Erinnerungssteuerung", () => {
  it.each(["offene_pruefungen", "quellaenderung", "aktualitaet"] as const)(
    "%s: Vorschau/Einrichtung ohne Wirkung; zum tatsächlichen Termin ein interner Bericht",
    async (vorlage) => {
      const s = system();
      const v = await s.dienst.wissenspflegeVorschau(ICH, { vorlage, quellen: ["anleitung-a4"] });
      expect(v.wirkung).toBe("keine");
      const e = await s.lege(vorlage);
      expect(e.routine?.wissenspflege?.ausgangsstand).toEqual([{ id: "anleitung-a4", fassung: 1 }]);
      expect(await s.berichte()).toEqual([]);
      expect(await s.meldungen()).toEqual([]);
      await s.steuerung().lauf();
      expect(await s.berichte()).toEqual([]);
      if (vorlage === "quellaenderung") s.version(2);
      s.zeit(20);
      await s.steuerung().lauf();
      const [bericht] = await s.berichte();
      expect(bericht?.inhalt).toContain("Dies bestätigt keine fachliche Gültigkeit");
      expect(await s.meldungen()).toHaveLength(1);
      expect((await s.ablage.laeufe.fuerErinnerung(e.id, 10))[0]?.ergebnis.routine).toMatchObject({
        notizId: bericht?.id,
        wissenspflege: { stand: "vorbereitet", vorlage },
      });
      expect(s.modelle()).toBe(0);
    },
  );

  it("keine Quelländerung durch Zeitablauf; wiederholtes Polling und zwei Ausführer duplizieren denselben belegten Stand nicht", async () => {
    const s = system();
    const e = await s.lege("quellaenderung");
    s.zeit(20);
    await s.steuerung().lauf();
    expect(await s.berichte()).toEqual([]);
    expect(await s.meldungen()).toEqual([]);
    expect((await s.ablage.laeufe.fuerErinnerung(e.id, 10))[0]?.ergebnis.wissenspflege?.stand).toBe(
      "ohne_quellaenderung",
    );
    s.version(2);
    s.zeit(21);
    await Promise.all([s.steuerung().lauf(), s.steuerung().lauf()]);
    const [original] = await s.berichte();
    expect(await s.meldungen()).toHaveLength(1);
    s.zeit(22);
    await s.steuerung().lauf();
    expect((await s.berichte()).map((n) => n.id)).toEqual([original?.id]);
    expect(await s.meldungen()).toHaveLength(1);
    s.version(3);
    s.zeit(23);
    await s.steuerung().lauf();
    expect(await s.berichte()).toHaveLength(2);
    expect(await s.meldungen()).toHaveLength(2);
  });

  it("Quellenentzug pausiert nur den beauftragten Pflegeweg, ohne erfundenen Nullbefund oder neue Meldung", async () => {
    const s = system();
    const e = await s.lege("quellaenderung");
    s.zeit(20);
    await s.steuerung().lauf();
    s.entziehen();
    s.zeit(21);
    await s.steuerung().lauf();
    const lauf = (await s.ablage.laeufe.fuerErinnerung(e.id, 10))[0];
    expect(lauf).toMatchObject({
      status: "gestoppt",
      ergebnis: {
        wissenspflege: {
          stand: "ungeprueft",
          quellen: [
            { stand: "ungeprueft", letzteErfolgreichePruefung: new Date(um(20)).toISOString() },
          ],
        },
      },
    });
    expect((await s.dienst.eintrag(ICH, e.id)).erinnerung.status).toBe("pausiert");
    s.version(2);
    s.zeit(22);
    await s.steuerung().lauf();
    expect(await s.berichte()).toEqual([]);
    expect(await s.meldungen()).toEqual([]);
  });

  it("bereits gemeldeter Quellstand bleibt historischer Originalbericht, auch wenn später nur sein Prüfstand wechselt", async () => {
    const s = system();
    const e = await s.lege("quellaenderung");
    s.version(2);
    s.zeit(20);
    await s.steuerung().lauf();
    const [original] = await s.berichte();
    const [meldung] = await s.meldungen();
    s.pruefstand(9);
    s.zeit(21);
    await s.steuerung().lauf();
    expect((await s.berichte()).map((n) => n.id)).toEqual([original?.id]);
    expect(await s.meldungen()).toEqual([meldung]);
    const [neu] = await s.ablage.laeufe.fuerErinnerung(e.id, 10);
    expect(neu?.status).toBe("zugestellt");
    expect(neu?.ergebnis.routine?.wissenspflege?.geprueftAm).toBe(new Date(um(21)).toISOString());
    expect(meldung?.routine?.wissenspflege?.geprueftAm).toBe(new Date(um(20)).toISOString());
  });

  it("Pause direkt vor tatsächlichem Notizschreiben verhindert den alten Bericht", async () => {
    const s = system();
    const e = await s.lege("aktualitaet");
    s.vorSchreiben(async () => {
      await s.dienst.status(ICH, e.id, { fassung: e.fassung, aktion: "pausieren" });
    });
    s.zeit(20);
    await s.steuerung().lauf();
    expect(await s.berichte()).toEqual([]);
    expect(await s.meldungen()).toEqual([]);
  });

  it("verlorene echte Notizantwort wird über denselben Vorgang wiedergefunden statt doppelt erzeugt", async () => {
    const s = system();
    await s.lege("quellaenderung");
    s.version(2);
    s.antwortVerlieren();
    s.zeit(20);
    await s.steuerung().lauf();
    expect(await s.berichte()).toHaveLength(1);
    // Derselbe vorhandene Takt nimmt den fehlgeschlagenen Versuch schon wieder auf.
    expect(await s.meldungen()).toHaveLength(1);
    expect((await s.meldungen())[0]?.routine?.wiederholt).toBe(true);
    s.zeit(21);
    await s.steuerung().lauf();
    expect(await s.berichte()).toHaveLength(1);
    expect(await s.meldungen()).toHaveLength(1);
  });

  it("Ausscheiden pausiert den Pflegeauftrag und liefert nichts mit früherem Kontozugang nach", async () => {
    const s = system();
    const e = await s.lege("aktualitaet");
    s.kontoSperren();
    s.zeit(20);
    await s.steuerung().lauf();
    expect((await s.dienst.eintrag(ICH, e.id)).erinnerung.status).toBe("pausiert");
    expect(await s.berichte()).toEqual([]);
    expect(await s.meldungen()).toEqual([]);
  });

  it("bewusst zurückgenommene Watch-Unterlagen werden beim nächsten Polling desselben Stands nicht neu angelegt", async () => {
    const s = system();
    const e = await s.lege("quellaenderung");
    s.version(2);
    s.zeit(20);
    await s.steuerung().lauf();
    const original = (await s.ablage.laeufe.fuerErinnerung(e.id, 20))[0]!;
    await s.dienst.nimmRoutineErgebnisZurueck(ICH, e.id, original.vorkommenId);
    expect(await s.berichte()).toEqual([]);
    for (const tag of [21, 22]) {
      s.zeit(tag);
      await s.steuerung().lauf();
    }
    expect(await s.berichte()).toEqual([]);
    expect(await s.meldungen()).toHaveLength(1);
    expect((await s.ablage.laeufe.fuerErinnerung(e.id, 20))[0]?.ergebnis.wissenspflege?.stand).toBe(
      "ergebnis_entfernt",
    );
    s.version(3);
    s.zeit(23);
    await s.steuerung().lauf();
    expect(await s.berichte()).toHaveLength(1);
    expect(await s.meldungen()).toHaveLength(2);
  });

  it("aktiver Einzelabbruch erhält die bereits angelegte Pflege-Originalnotiz und sperrt die späte Meldung", async () => {
    const s = system();
    const e = await s.lege("aktualitaet");
    s.nachSchreiben(async () => {
      const lauf = (await s.ablage.laeufe.fuerErinnerung(e.id, 10))[0]!;
      expect(
        await s.ablage.brecheLaufAb?.(ICH, e.id, lauf.vorkommenId, e.fassung, um(20), s.notizen),
      ).toBe(true);
    });
    s.zeit(20);
    await s.steuerung().lauf();
    const [bericht] = await s.berichte();
    expect(bericht).toBeTruthy();
    expect((await s.ablage.laeufe.fuerErinnerung(e.id, 10))[0]).toMatchObject({
      status: "abgebrochen",
      ergebnis: {
        routine: {
          notizId: bericht?.id,
          routineFassung: 1,
          wissenspflege: { vorlage: "aktualitaet" },
        },
      },
    });
    expect(await s.meldungen()).toEqual([]);
  });

  it("ein neuer Prüfstand nach Notizspeicherung stellt den alten Bericht nicht als aktuellen Pflegeerfolg zu", async () => {
    const s = system();
    const e = await s.lege("offene_pruefungen");
    s.nachSchreiben(async () => {
      s.pruefstand(3);
    });
    s.zeit(20);
    await s.steuerung().lauf();
    expect(await s.berichte()).toHaveLength(1);
    expect((await s.berichte())[0]?.inhalt).toContain("Offene Folgeprüfung, Stand 2");
    expect((await s.meldungen()).filter((m) => m.routine)).toEqual([]);
    expect((await s.ablage.laeufe.fuerErinnerung(e.id, 20))[0]).toMatchObject({
      status: "fehlgeschlagen",
      ergebnis: { grund: "quelle_geaendert", routine: { notizId: (await s.berichte())[0]?.id } },
    });
  });
});
