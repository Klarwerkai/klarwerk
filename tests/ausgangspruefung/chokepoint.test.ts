// ================================================================================================
// R-1646 · AUSGANGSPRÜFUNG AM CHOKEPOINT — Anonymisierung, Anhalten, Freigabe, Ablehnung.
// ================================================================================================
//
// Ordnung zu den Originalkriterien (AUFTRAG-B1.json):
//   K1 · „Vor jedem ausgehenden Aufruf zeigt KLARWERK exakt, welcher Text das Werk verlassen würde —
//        mit hervorgehobenen Anonymisierungen. Der Controller gibt frei oder lehnt ab."
//        Gemessen hier: der Aufruf wartet, die Vorschau trägt die Ersetzungen als eigene Abschnitte,
//        gesendet wird Zeichen für Zeichen der Vorschautext, eine Ablehnung oder ein Ablauf sendet
//        nichts. Lokale Endpunkte und der ausgeschaltete Zustand bleiben unverändert.
//
// Alle Personen- und Kontodaten hier sind synthetische Beispielwerte.
import { afterEach, describe, expect, it } from "vitest";
import {
  AusgangAbgelehntFehler,
  Ausgangspruefung,
  abschnitteAlsText,
  anonymisiereNachricht,
  ausgangspruefungAusEnv,
  setzeAusgangspruefung,
} from "../../services/reasoner/src/ausgangspruefung";
import {
  ConfidentialEgressError,
  cappedModelClient,
} from "../../services/reasoner/src/model-concurrency";
import type { ModelClient } from "../../services/reasoner/src/provider-model";

const NAME = "Erika Mustermann";
const EMAIL = "erika.mustermann@beispiel.de";
const TELEFON = "+49 30 1234567";
const IBAN = "DE89 3704 0044 0532 0130 00";
const FRAGE = `Bitte an ${NAME} (${EMAIL}, ${TELEFON}) zahlen: ${IBAN}.`;
const SYSTEM = `Du hilfst ${NAME}.`;
const BILD = "data:image/png;base64,iVBORw0KGgo=";

interface Aufruf {
  system: string;
  user: string;
  bild?: string;
}

function attrappe(antwort = "Erledigt für [Person 1]."): {
  client: ModelClient;
  aufrufe: Aufruf[];
} {
  const aufrufe: Aufruf[] = [];
  const client: ModelClient = {
    name: "cloud:openai:testmodell",
    async complete(system, user) {
      aufrufe.push({ system, user });
      return antwort;
    },
    async completeVision(system, bild, user) {
      aufrufe.push({ system, user, bild });
      return antwort;
    },
  };
  return { client, aufrufe };
}

function pruefer(
  extra: Partial<ConstructorParameters<typeof Ausgangspruefung>[0]> = {},
): Ausgangspruefung {
  const p = new Ausgangspruefung({
    wartezeitMs: 60_000,
    maxOffen: 5,
    namenQuelle: () => [NAME],
    ...extra,
  });
  setzeAusgangspruefung(p);
  return p;
}

async function bisWartend(p: Ausgangspruefung, anzahl = 1) {
  for (let i = 0; i < 50 && p.offene().length < anzahl; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
  return p.offene();
}

afterEach(() => {
  setzeAusgangspruefung(null);
});

describe("R-1646 · Anonymisierung (deterministisch)", () => {
  it("ersetzt Name, E-Mail, Telefon und IBAN und hebt jede Ersetzung als Abschnitt hervor", () => {
    const a = anonymisiereNachricht({ system: SYSTEM, user: FRAGE }, [NAME]);
    expect(abschnitteAlsText(a.nutzer)).toBe(
      "Bitte an [Person 1] ([E-Mail 1], [Telefon 1]) zahlen: [IBAN 1].",
    );
    // Derselbe Name bekommt in Anweisung und Text denselben Platzhalter.
    expect(abschnitteAlsText(a.system)).toBe("Du hilfst [Person 1].");
    expect(a.nutzer.filter((x) => x.ersetzt).map((x) => x.ersetzt)).toEqual([
      "person",
      "email",
      "telefon",
      "iban",
    ]);
    // Nicht ersetzte Stücke bleiben wörtlich.
    expect(a.nutzer[0]).toEqual({ text: "Bitte an ", ersetzt: null });
    expect(a.zuordnung.get("[Person 1]")).toBe(NAME);
  });

  it("lässt gewöhnliche Zahlen und Daten stehen", () => {
    const text = "Am 01.02.2026 wurden 4500 Teile in Halle 3 gezählt (Version 2.4.1).";
    const a = anonymisiereNachricht({ system: "", user: text }, [NAME]);
    expect(abschnitteAlsText(a.nutzer)).toBe(text);
    expect(a.nutzer.every((x) => x.ersetzt === null)).toBe(true);
  });
});

describe("R-1646 · Ausgangsprüfung am Chokepoint", () => {
  it("hält den externen Aufruf an, bis freigegeben ist, und sendet genau den Vorschautext", async () => {
    const p = pruefer();
    const { client, aufrufe } = attrappe();
    const lauf = cappedModelClient(client, { rejectsConfidential: true }).complete(
      SYSTEM,
      FRAGE,
      false,
    );
    const [offen] = await bisWartend(p);
    expect(offen).toBeDefined();
    expect(aufrufe).toHaveLength(0);
    expect(offen?.anbieter).toBe("cloud:openai:testmodell");
    expect(offen?.ersetzungen).toEqual({ email: 1, iban: 1, telefon: 1, person: 2 });
    // Die Vorschau trägt die Originale NICHT.
    const vorschau = JSON.stringify(offen);
    for (const original of [NAME, EMAIL, TELEFON, IBAN]) {
      expect(vorschau).not.toContain(original);
    }

    expect(p.entscheide(offen?.id ?? "", "freigegeben")).not.toBeNull();
    // Die Antwort kommt mit den Originalen zurück ins Haus.
    await expect(lauf).resolves.toBe(`Erledigt für ${NAME}.`);
    expect(aufrufe).toEqual([
      {
        system: abschnitteAlsText(offen?.system ?? []),
        user: abschnitteAlsText(offen?.nutzer ?? []),
      },
    ]);
    for (const original of [NAME, EMAIL, TELEFON, IBAN]) {
      expect(aufrufe[0]?.user).not.toContain(original);
    }
    expect(p.offene()).toEqual([]);
  });

  it("Ablehnung: nichts geht hinaus, der Aufruf endet mit AusgangAbgelehntFehler", async () => {
    const p = pruefer();
    const { client, aufrufe } = attrappe();
    const lauf = cappedModelClient(client, { rejectsConfidential: true }).complete(
      SYSTEM,
      FRAGE,
      false,
    );
    const [offen] = await bisWartend(p);
    p.entscheide(offen?.id ?? "", "abgelehnt");
    await expect(lauf).rejects.toMatchObject({
      name: "AusgangAbgelehntFehler",
      grund: "abgelehnt",
    });
    expect(aufrufe).toHaveLength(0);
    // Eine zweite Entscheidung über denselben Aufruf ändert nichts.
    expect(p.entscheide(offen?.id ?? "", "freigegeben")).toBeNull();
  });

  it("ohne Entscheidung bis zum Ablauf: nichts geht hinaus", async () => {
    pruefer({ wartezeitMs: 20 });
    const { client, aufrufe } = attrappe();
    const lauf = cappedModelClient(client, { rejectsConfidential: true }).complete(
      SYSTEM,
      FRAGE,
      false,
    );
    await expect(lauf).rejects.toBeInstanceOf(AusgangAbgelehntFehler);
    await expect(lauf).rejects.toMatchObject({ grund: "zeitlimit" });
    expect(aufrufe).toHaveLength(0);
  });

  it("volle Warteschlange lehnt sofort ab, statt still zu senden", async () => {
    const p = pruefer({ maxOffen: 1 });
    const { client, aufrufe } = attrappe();
    const capped = cappedModelClient(client, { rejectsConfidential: true });
    const erster = capped.complete(SYSTEM, FRAGE, false);
    await bisWartend(p);
    await expect(capped.complete(SYSTEM, FRAGE, false)).rejects.toMatchObject({
      grund: "warteschlange_voll",
    });
    p.entscheide(p.offene()[0]?.id ?? "", "abgelehnt");
    await expect(erster).rejects.toBeInstanceOf(AusgangAbgelehntFehler);
    expect(aufrufe).toHaveLength(0);
  });

  it("nicht lesbare Namensliste: fail-closed, nichts geht hinaus", async () => {
    pruefer({
      namenQuelle: () => {
        throw new Error("Kontenliste nicht erreichbar");
      },
    });
    const { client, aufrufe } = attrappe();
    await expect(
      cappedModelClient(client, { rejectsConfidential: true }).complete(SYSTEM, FRAGE, false),
    ).rejects.toMatchObject({ grund: "namen_nicht_verfuegbar" });
    expect(aufrufe).toHaveLength(0);
  });

  it("Bildweg: die Vorschau sagt, dass das Bild unverändert mitgeht", async () => {
    const p = pruefer();
    const { client, aufrufe } = attrappe();
    const vision = cappedModelClient(client, { rejectsConfidential: true }).completeVision;
    expect(vision).toBeDefined();
    const lauf = vision?.(SYSTEM, BILD, FRAGE, false);
    const [offen] = await bisWartend(p);
    expect(offen?.bildUnveraendert).toBe(true);
    p.entscheide(offen?.id ?? "", "freigegeben");
    await lauf;
    expect(aufrufe[0]?.bild).toBe(BILD);
    expect(aufrufe[0]?.user).toBe(abschnitteAlsText(offen?.nutzer ?? []));
  });

  it("vertraulicher Inhalt wird wie bisher VOR der Prüfung abgewiesen — keine Vorschau", async () => {
    const p = pruefer();
    const { client } = attrappe();
    await expect(
      cappedModelClient(client, { rejectsConfidential: true }).complete(SYSTEM, FRAGE, true),
    ).rejects.toBeInstanceOf(ConfidentialEgressError);
    expect(p.offene()).toEqual([]);
  });

  it("bestätigt lokaler Endpunkt verlässt das Haus nicht und wird nicht angehalten", async () => {
    const p = pruefer();
    const { client, aufrufe } = attrappe("lokal");
    await expect(
      cappedModelClient(client, { rejectsConfidential: false }).complete(SYSTEM, FRAGE, false),
    ).resolves.toBe("lokal");
    expect(aufrufe).toEqual([{ system: SYSTEM, user: FRAGE }]);
    expect(p.offene()).toEqual([]);
  });

  it("ausgeschaltet: der Chokepoint sendet wie bisher den Originaltext", async () => {
    const { client, aufrufe } = attrappe("unverändert");
    await expect(
      cappedModelClient(client, { rejectsConfidential: true }).complete(SYSTEM, FRAGE, false),
    ).resolves.toBe("unverändert");
    expect(aufrufe).toEqual([{ system: SYSTEM, user: FRAGE }]);
  });

  it("der Schalter: nur ausdrücklich `an` schaltet ein", () => {
    expect(ausgangspruefungAusEnv({})).toBeNull();
    expect(ausgangspruefungAusEnv({ KLARWERK_AUSGANGSPRUEFUNG: "aus" })).toBeNull();
    expect(ausgangspruefungAusEnv({ KLARWERK_AUSGANGSPRUEFUNG: "an" })).toEqual({
      wartezeitMs: 300_000,
      maxOffen: 20,
    });
  });
});
