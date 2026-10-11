// ================================================================================================
// KLARA-OFFICE-02 · DER KONTEXTKANAL ÜBER DIE ZEIT — mit gestellter Uhr, ohne Server.
// ================================================================================================
//
// Was sich am echten Server nur mit Warten zeigen liesse, misst dieser Fall an `BegleiterKanal`
// selbst (dieselbe Klasse, die `build-app.ts` verdrahtet), mit einer Uhr, die der Test stellt:
//
//   U1  KO-02-05 · Ohne aktiven Adapter keine Auswahl: nach `BEGLEITER_AKTIV_MS` Stille liefert der
//       Kanal das Fenster als inaktiv und OHNE Auswahl — auch die zuletzt bekannte nicht. Ein
//       Auftrag an ein stilles Fenster wird abgewiesen.
//   U2  KO-02-07 · Wiederverbindung: nach `BEGLEITER_ABLAUF_MS` ist das Fenster vergessen (404); eine
//       neue Anmeldung derselben Kennung beginnt sauber von vorn.
//   U3  Aufträge, die Word nicht abholt, verfallen nach `BEGLEITER_AKTION_FRIST_MS`.
//   U4  Grenzen: höchstens drei offene Aufträge je Fenster, höchstens acht Fenster je Konto (das
//       stillste weicht), Konten sind getrennt.
import { describe, expect, it } from "vitest";
import {
  BEGLEITER_ABLAUF_MS,
  BEGLEITER_ADAPTER_MAX,
  BEGLEITER_AKTION_FRIST_MS,
  BEGLEITER_AKTIV_MS,
  BegleiterFehler,
  BegleiterKanal,
} from "../../services/app/src/klara-begleiter";

const KONTO = "u-erik";
const FREMD = "u-vera";

function kennung(n: number): string {
  return `bgl-${n.toString(16).padStart(32, "0")}`;
}

function neuerKanal() {
  const uhr = { jetzt: Date.parse("2026-10-10T08:00:00.000Z") };
  let zaehler = 0;
  const kanal = new BegleiterKanal(
    () => uhr.jetzt,
    () => {
      zaehler += 1;
      return `aktion-${zaehler}`;
    },
  );
  return { kanal, uhr };
}

function anmelden(kanal: BegleiterKanal, instanz: string, konto = KONTO): void {
  kanal.anmelden(konto, {
    instanz,
    host: "word-web",
    hostFassung: "16.0.18129.40500",
    dokument: { kennung: `url-${"c".repeat(32)}`, titel: "Protokoll.docx", gespeichert: true },
  });
}

function fehlerVon(f: () => unknown): BegleiterFehler {
  try {
    f();
  } catch (fehler) {
    if (fehler instanceof BegleiterFehler) {
      return fehler;
    }
    throw fehler;
  }
  throw new Error("kein Fehler geworfen");
}

describe("U1 · KO-02-05 — ohne aktiven Adapter keine aktuelle Auswahl", () => {
  it("wird still: inaktiv, ohne Auswahl, und ein Auftrag wird abgewiesen", () => {
    const { kanal, uhr } = neuerKanal();
    const a = kennung(1);
    anmelden(kanal, a);
    kanal.melden(KONTO, a, { seq: 1, auswahl: { text: "Fiktiver Satz.", laenge: 14, stand: 1 } });
    expect(kanal.kontext(KONTO).adapter[0]).toMatchObject({ aktiv: true, auswahl: { stand: 1 } });

    uhr.jetzt += BEGLEITER_AKTIV_MS;
    expect(kanal.kontext(KONTO).adapter[0]?.aktiv).toBe(true);

    uhr.jetzt += 1;
    const still = kanal.kontext(KONTO).adapter[0];
    expect(still?.aktiv).toBe(false);
    expect(still?.auswahl).toBeNull();
    const f = fehlerVon(() =>
      kanal.beauftragen(KONTO, a, { art: "frage", text: "Was gilt?", auswahlStand: 1 }),
    );
    expect([f.status, f.grund]).toEqual([409, "adapter_inaktiv"]);

    // Meldet sich das Fenster wieder, ist es wieder aktiv — mit seiner AKTUELLEN Auswahl.
    kanal.melden(KONTO, a, { seq: 2, auswahl: { text: "Neuer Satz.", laenge: 11, stand: 2 } });
    expect(kanal.kontext(KONTO).adapter[0]).toMatchObject({
      aktiv: true,
      auswahl: { text: "Neuer Satz.", stand: 2 },
    });
  });
});

describe("U2 · KO-02-07 — Wiederverbindung nach Abbruch", () => {
  it("vergisst ein Fenster nach der Frist; eine neue Anmeldung beginnt von vorn", () => {
    const { kanal, uhr } = neuerKanal();
    const a = kennung(2);
    anmelden(kanal, a);
    kanal.melden(KONTO, a, { seq: 7, auswahl: null, auswahlStand: 3 });

    uhr.jetzt += BEGLEITER_ABLAUF_MS + 1;
    expect(kanal.kontext(KONTO).adapter).toEqual([]);
    const f = fehlerVon(() => kanal.melden(KONTO, a, { seq: 8, auswahl: null, auswahlStand: 3 }));
    expect([f.status, f.grund]).toEqual([404, "nicht_angemeldet"]);

    anmelden(kanal, a);
    // Von vorn: Folgenummer 1 und Auswahlstand 1 gelten wieder.
    kanal.melden(KONTO, a, { seq: 1, auswahl: { text: "Wieder da.", laenge: 10, stand: 1 } });
    expect(kanal.kontext(KONTO).adapter[0]).toMatchObject({
      aktiv: true,
      auswahl: { text: "Wieder da." },
    });
  });
});

describe("U3 · nicht abgeholte Aufträge verfallen", () => {
  it("ein Auftrag, den Word nicht abholt, steht nach der Frist als verfallen da", () => {
    const { kanal, uhr } = neuerKanal();
    const a = kennung(3);
    anmelden(kanal, a);
    kanal.melden(KONTO, a, { seq: 1, auswahl: { text: "Satz.", laenge: 5, stand: 1 } });
    kanal.beauftragen(KONTO, a, { art: "einfuegen", text: "Ergänzung", auswahlStand: 1 });
    // Das Fenster meldet sich weiter (bleibt aktiv), meldet aber kein Ergebnis — Word hängt.
    const schritte = BEGLEITER_AKTION_FRIST_MS / 10_000 + 1;
    for (let i = 0; i < schritte; i += 1) {
      uhr.jetzt += 10_000;
      const r = kanal.melden(KONTO, a, { seq: 2 + i, auswahl: null, auswahlStand: 2 });
      if (i === 0) {
        expect(r.aktionen).toHaveLength(1);
      }
      if (i === schritte - 2) {
        expect(kanal.kontext(KONTO).adapter[0]?.aktionen[0]?.stand).toBe("uebergeben");
      }
    }
    expect(kanal.kontext(KONTO).adapter[0]?.aktionen[0]?.stand).toBe("verfallen");
  });
});

describe("U4 · Grenzen und Trennung der Konten", () => {
  it("höchstens drei offene Aufträge je Fenster", () => {
    const { kanal } = neuerKanal();
    const a = kennung(4);
    anmelden(kanal, a);
    kanal.melden(KONTO, a, { seq: 1, auswahl: { text: "Satz.", laenge: 5, stand: 1 } });
    for (let i = 0; i < 3; i += 1) {
      kanal.beauftragen(KONTO, a, { art: "frage", text: `Frage ${i}`, auswahlStand: 1 });
    }
    const f = fehlerVon(() =>
      kanal.beauftragen(KONTO, a, { art: "frage", text: "Noch eine", auswahlStand: 1 }),
    );
    expect([f.status, f.grund]).toEqual([409, "zu_viele"]);
  });

  it("acht Fenster je Konto — beim neunten weicht das stillste; fremde Konten sind getrennt", () => {
    const { kanal, uhr } = neuerKanal();
    for (let i = 0; i < BEGLEITER_ADAPTER_MAX; i += 1) {
      anmelden(kanal, kennung(10 + i));
      uhr.jetzt += 100;
    }
    anmelden(kanal, kennung(99));
    const offen = kanal.kontext(KONTO).adapter.map((x) => x.instanz);
    expect(offen).toHaveLength(BEGLEITER_ADAPTER_MAX);
    expect(offen).not.toContain(kennung(10));
    expect(offen).toContain(kennung(99));

    anmelden(kanal, kennung(200), FREMD);
    expect(kanal.kontext(FREMD).adapter.map((x) => x.instanz)).toEqual([kennung(200)]);
    expect(kanal.kontext(KONTO).adapter.map((x) => x.instanz)).not.toContain(kennung(200));
  });
});
