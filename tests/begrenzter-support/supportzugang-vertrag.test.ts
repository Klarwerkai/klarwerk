// produkt:20261011:peter-p11 — DER VERTRAG FÜR BEGRENZTEN SUPPORT, JE KRITERIUM POSITIV UND NEGATIV.
//
// Gegenprobe zu `services/app/src/supportzugang-vertrag.ts` und
// `docs/operations/begrenzter-support.md`. Alle Personen, Fälle und Belege sind fiktiv. Es wird kein
// Zugang geöffnet, keine Sitzung gestartet und kein Dienst angesprochen; geprüft ist das
// Vertragsverhalten, nicht ein realer Betreiber.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DIAGNOSE_UMFANG,
  type FreigabeAntrag,
  type FreigabeBindung,
  type Kundenadmin,
  SUPPORTZUGANG_PHASE,
  type SupportBeleg,
  type SupportFreigabe,
  type SupportIdentitaet,
  VORGESCHLAGENE_ZEITWERTE,
  ZEITWERTE_HINWEIS,
  ablaufDurchsetzen,
  abschliessen,
  belegPruefen,
  freigabeErteilen,
  freigabeZustand,
  identitaetPruefen,
  mitInhaltszugriff,
  verlaengern,
  widerrufen,
  zeitwerteFestlegen,
  zugriffPruefen,
} from "../../services/app/src/supportzugang-vertrag";
import { REPO_WURZEL, repoPfad } from "../support/repoPfad";

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 13, 8, 0, 0);

const PERSON: SupportIdentitaet = {
  kennung: "erika.beispiel@betreiber.example",
  anzeigename: "Erika Beispiel",
  betreiber: "Fiktiver Betreiber GmbH",
  mfaBestaetigt: true,
};
const ADMIN: Kundenadmin = { kennung: "max.kunde@kunde.example", rolle: "admin" };
const BELEG: SupportBeleg = { art: "ticket", referenz: "KUNDE-4711", am: T0 };
const ANTRAG: FreigabeAntrag = {
  fall: "KUNDE-4711",
  zweck: "Import bricht ab",
  datenbereich: "Wissensraum Einkauf",
  dauerMinuten: 60,
};

function erteile(antrag: Partial<FreigabeAntrag> = {}): SupportFreigabe {
  const r = freigabeErteilen({
    id: "f-1",
    antrag: { ...ANTRAG, ...antrag },
    identitaet: PERSON,
    admin: ADMIN,
    beleg: BELEG,
    jetzt: T0,
  });
  if (!r.ok) throw new Error(r.fehler);
  return r.freigabe;
}

function bindungen(): FreigabeBindung[] {
  return [
    { art: "sitzung", kennung: "s-1", freigabeId: "f-1" },
    { art: "job", kennung: "j-1", freigabeId: "f-1" },
    { art: "sitzung", kennung: "fremd", freigabeId: "f-2" },
  ];
}

function darf(f: SupportFreigabe, recht: Parameters<typeof zugriffPruefen>[1], t: number) {
  return zugriffPruefen(f, recht, T0 + t * MIN, "bedienung").erlaubt;
}

describe("P11-AC01 — namentliche Supportidentität statt gemeinsamem Dauerkonto", () => {
  it("nimmt eine persönliche Kennung mit Namen, Betreiber und MFA an", () => {
    expect(identitaetPruefen(PERSON)).toEqual({ ok: true });
  });

  it.each([
    ["support@betreiber.example", "geteiltes_konto"],
    ["Helpdesk2@betreiber.example", "geteiltes_konto"],
    ["admin", "geteiltes_konto"],
    ["", "kennung_fehlt"],
  ])("weist die Kennung %j ab (%s)", (kennung, fehler) => {
    expect(identitaetPruefen({ ...PERSON, kennung })).toEqual({ ok: false, fehler });
  });

  it("weist Funktionsnamen, fehlenden Betreiber und fehlende MFA ab", () => {
    const team = identitaetPruefen({ ...PERSON, anzeigename: "Team" });
    const ohneBetreiber = identitaetPruefen({ ...PERSON, betreiber: " " });
    const ohneMfa = identitaetPruefen({ ...PERSON, mfaBestaetigt: false });
    expect(team).toEqual({ ok: false, fehler: "name_fehlt" });
    expect(ohneBetreiber).toEqual({ ok: false, fehler: "betreiber_fehlt" });
    expect(ohneMfa).toEqual({ ok: false, fehler: "mfa_fehlt" });
  });

  it("eine Freigabe für ein geteiltes Konto entsteht nicht", () => {
    const r = freigabeErteilen({
      id: "f-x",
      antrag: ANTRAG,
      identitaet: { ...PERSON, kennung: "support@betreiber.example" },
      admin: ADMIN,
      beleg: BELEG,
      jetzt: T0,
    });
    expect(r).toEqual({ ok: false, fehler: "geteiltes_konto" });
  });
});

describe("P11-AC02 — Kundenadmin bestätigt Zweck, Datenbereich und Dauer", () => {
  it("hält Fall, Zweck, Datenbereich, Dauer, Bestätiger und Beleg fest", () => {
    const r = freigabeErteilen({
      id: "f-1",
      antrag: { ...ANTRAG, dauerMinuten: 45 },
      identitaet: PERSON,
      admin: ADMIN,
      beleg: BELEG,
      jetzt: T0,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.freigabe).toMatchObject({
      fall: "KUNDE-4711",
      zweck: "Import bricht ab",
      datenbereich: "Wissensraum Einkauf",
      bestaetigtVon: ADMIN.kennung,
      endetAm: T0 + 45 * MIN,
    });
    expect(r.ereignis).toMatchObject({ art: "erteilt", durch: ADMIN.kennung, beleg: BELEG });
  });

  it("Rollen ohne Nutzerverwaltung dürfen nicht freigeben", () => {
    for (const rolle of ["viewer", "experte", "controller"] as const) {
      const r = freigabeErteilen({
        id: "f-1",
        antrag: ANTRAG,
        identitaet: PERSON,
        admin: { kennung: "x.y@kunde.example", rolle },
        beleg: BELEG,
        jetzt: T0,
      });
      expect(r, rolle).toEqual({ ok: false, fehler: "kein_kundenadmin" });
    }
  });

  const unvollstaendig: [Partial<FreigabeAntrag>, string][] = [
    [{ fall: " " }, "fall_fehlt"],
    [{ zweck: "" }, "zweck_fehlt"],
    [{ datenbereich: "" }, "datenbereich_fehlt"],
    [{ dauerMinuten: 0 }, "dauer_ungueltig"],
    [{ dauerMinuten: 61 }, "dauer_ueber_sitzung"],
  ];
  it.each(unvollstaendig)("Angabe %j fehlt oder ist zu lang", (abweichung, fehler) => {
    expect(() => erteile(abweichung)).toThrow(fehler);
  });

  it("die Supportperson kann sich nicht selbst freigeben", () => {
    const r = freigabeErteilen({
      id: "f-1",
      antrag: ANTRAG,
      identitaet: PERSON,
      admin: { kennung: PERSON.kennung.toUpperCase(), rolle: "admin" },
      beleg: BELEG,
      jetzt: T0,
    });
    expect(r).toEqual({ ok: false, fehler: "selbstfreigabe" });
  });
});

describe("P11-AC03 — Diagnose ohne Inhaltszugriff als Ausgangspunkt", () => {
  it("ohne weitere Angabe gilt nur Diagnose, und Diagnose hat keinen Inhaltszugriff", () => {
    const f = erteile();
    expect(f.rechte).toEqual(["diagnose"]);
    expect(mitInhaltszugriff("diagnose")).toBe(false);
    expect(darf(f, "diagnose", 1)).toBe(true);
    for (const recht of ["lesen", "aendern", "export"] as const) {
      expect(mitInhaltszugriff(recht)).toBe(true);
      expect(zugriffPruefen(f, recht, T0 + MIN, "bedienung")).toEqual({
        erlaubt: false,
        grund: "recht_fehlt",
      });
    }
  });

  it("der Diagnoseumfang nennt Betriebszustand, keinen Wissensinhalt", () => {
    const text = DIAGNOSE_UMFANG.join(" ");
    expect(text).toContain("/health");
    expect(text).toContain("ohne Prompt- und Antworttext");
    expect(text).toContain("ohne Titel oder Namen");
  });
});

describe("P11-AC04 — Lesen, Ändern und Export getrennte Freigaben", () => {
  it("Lesen erlaubt weder Ändern noch Export", () => {
    const f = erteile({ rechte: ["lesen"] });
    expect(darf(f, "lesen", 1)).toBe(true);
    expect(darf(f, "aendern", 1)).toBe(false);
    expect(darf(f, "export", 1)).toBe(false);
  });

  it("Ändern schließt Lesen nicht ein", () => {
    const f = erteile({ rechte: ["aendern"] });
    expect(darf(f, "aendern", 1)).toBe(true);
    expect(darf(f, "lesen", 1)).toBe(false);
  });

  it("Export braucht eigenen Zweck und Löschfrist und gibt nur Export frei", () => {
    const leererZweck = { zweck: "", loeschfristTage: 7 };
    const ohneFrist = { zweck: "Fehlerbild", loeschfristTage: 0 };
    const fehlt = "exportzweck_fehlt";
    expect(() => erteile({ rechte: ["export"] })).toThrow(fehlt);
    expect(() => erteile({ rechte: ["export"], export: leererZweck })).toThrow(fehlt);
    expect(() => erteile({ rechte: ["export"], export: ohneFrist })).toThrow(fehlt);
    const regel = { zweck: "Fehlerbild an Hersteller", loeschfristTage: 7 };
    const f = erteile({ rechte: ["export"], export: regel });
    expect(f.export).toEqual(regel);
    expect(darf(f, "export", 1)).toBe(true);
    expect(darf(f, "lesen", 1)).toBe(false);
  });
});

describe("P11-AC05 — vorgeschlagene Zeitwerte konfigurierbar, nicht als SLA", () => {
  it("die Vorschläge sind 60/15/240 Minuten, nicht beschlossen und keine SLA", () => {
    expect(VORGESCHLAGENE_ZEITWERTE).toEqual({
      sitzungMinuten: 60,
      inaktivitaetMinuten: 15,
      hoechstMinuten: 240,
      herkunft: "vorschlag",
      sla: false,
      beschlossen: false,
    });
    expect(ZEITWERTE_HINWEIS).toContain("noch nicht beschlossen");
    expect(ZEITWERTE_HINWEIS).toContain("keine zugesagte Reaktions- oder Bereitschaftszeit");
  });

  it("abweichende Werte heißen konfiguriert, bleiben aber unbeschlossen und ohne SLA", () => {
    const r = zeitwerteFestlegen({ sitzungMinuten: 30, inaktivitaetMinuten: 10 });
    expect(r).toEqual({
      ok: true,
      werte: {
        sitzungMinuten: 30,
        inaktivitaetMinuten: 10,
        hoechstMinuten: 240,
        herkunft: "konfiguriert",
        sla: false,
        beschlossen: false,
      },
    });
    expect(zeitwerteFestlegen()).toEqual({ ok: true, werte: VORGESCHLAGENE_ZEITWERTE });
  });

  it("widersprüchliche oder ungültige Werte werden abgewiesen", () => {
    expect(zeitwerteFestlegen({ sitzungMinuten: 0 })).toMatchObject({ ok: false });
    expect(zeitwerteFestlegen({ inaktivitaetMinuten: 90 })).toEqual({
      ok: false,
      fehler: "inaktivitaet_ueber_sitzung",
    });
    expect(zeitwerteFestlegen({ sitzungMinuten: 300 })).toEqual({
      ok: false,
      fehler: "sitzung_ueber_hoechstdauer",
    });
  });

  it("konfigurierte Werte wirken auf die Freigabe", () => {
    const r = zeitwerteFestlegen({ sitzungMinuten: 30, inaktivitaetMinuten: 5 });
    if (!r.ok) throw new Error(r.fehler);
    const erteilung = freigabeErteilen({
      id: "f-1",
      antrag: { ...ANTRAG, dauerMinuten: 45 },
      identitaet: PERSON,
      admin: ADMIN,
      beleg: BELEG,
      zeitwerte: r.werte,
      jetzt: T0,
    });
    expect(erteilung).toEqual({ ok: false, fehler: "dauer_ueber_sitzung" });
  });

  it("das Konzept nennt die Werte als Vorschlag und behauptet keine Bereitschaft", () => {
    const doku = readFileSync(repoPfad("docs/operations/begrenzter-support.md"), "utf8");
    expect(doku).toContain("**Vorschläge, nicht beschlossen, keine SLA**");
    expect(doku).toContain("**keine** behauptete 24/7-Bereitschaft");
  });
});

describe("P11-AC06 — Ablauf und Inaktivität beenden den Zugriff technisch", () => {
  it("nach Ablauf verweigert jede Prüfung, auch für Diagnose", () => {
    let f = erteile({ dauerMinuten: 30 });
    for (const t of [10, 20, 29]) {
      const r = zugriffPruefen(f, "diagnose", T0 + t * MIN, "bedienung");
      expect(r.erlaubt).toBe(true);
      if (r.erlaubt) f = r.freigabe;
    }
    expect(zugriffPruefen(f, "diagnose", T0 + 30 * MIN, "bedienung")).toEqual({
      erlaubt: false,
      grund: "abgelaufen",
    });
  });

  it("nach 15 Minuten ohne Bedienung ist die Freigabe inaktiv", () => {
    const f = erteile();
    expect(freigabeZustand(f, T0 + 14 * MIN)).toBe("aktiv");
    expect(zugriffPruefen(f, "diagnose", T0 + 15 * MIN, "bedienung")).toEqual({
      erlaubt: false,
      grund: "inaktiv",
    });
  });

  it("Hintergrundabfragen verlängern nichts — keine stille Verlängerung", () => {
    let f = erteile();
    for (const t of [5, 10, 14]) {
      const r = zugriffPruefen(f, "diagnose", T0 + t * MIN, "hintergrund");
      expect(r.erlaubt).toBe(true);
      if (r.erlaubt) f = r.freigabe;
    }
    expect(f.letzteBedienungAm).toBe(T0);
    expect(zugriffPruefen(f, "diagnose", T0 + 15 * MIN, "hintergrund")).toEqual({
      erlaubt: false,
      grund: "inaktiv",
    });
  });

  it("beim Ablauf werden die laufenden Sitzungen und Jobs dieser Freigabe beendet", () => {
    const f = erteile({ dauerMinuten: 30 });
    const vorher = ablaufDurchsetzen({
      freigabe: f,
      laufend: bindungen(),
      beenden: () => true,
      jetzt: T0 + 5 * MIN,
    });
    expect(vorher).toEqual({ faellig: false });
    const beendet: string[] = [];
    const r = ablaufDurchsetzen({
      freigabe: f,
      laufend: bindungen(),
      beenden: (b) => {
        beendet.push(b.kennung);
        return true;
      },
      jetzt: T0 + 30 * MIN,
    });
    expect(r).toMatchObject({ faellig: true, vollstaendig: true });
    expect(beendet).toEqual(["s-1", "j-1"]);
  });
});

describe("P11-AC07 — Widerruf beendet auch bestehende Sitzungen und Jobs", () => {
  it("der Widerruf sperrt sofort und beendet Sitzung und Job, nicht fremde Bindungen", () => {
    const f = erteile({ rechte: ["lesen"] });
    const beendet: string[] = [];
    const r = widerrufen({
      freigabe: f,
      admin: ADMIN,
      laufend: bindungen(),
      beenden: (b) => {
        beendet.push(`${b.art}:${b.kennung}`);
        return true;
      },
      jetzt: T0 + 5 * MIN,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(beendet).toEqual(["sitzung:s-1", "job:j-1"]);
    expect(r.vollstaendig).toBe(true);
    expect(r.ereignis).toMatchObject({
      art: "widerrufen",
      durch: ADMIN.kennung,
      beendet: ["sitzung:s-1", "job:j-1"],
      nichtBeendet: [],
    });
    expect(zugriffPruefen(r.freigabe, "lesen", T0 + 5 * MIN, "bedienung")).toEqual({
      erlaubt: false,
      grund: "widerrufen",
    });
    const hintergrund = zugriffPruefen(r.freigabe, "diagnose", T0 + 5 * MIN, "hintergrund");
    expect(hintergrund.erlaubt).toBe(false);
  });

  it("eine nicht beendbare Bindung macht den Widerruf sichtbar unvollständig", () => {
    const r = widerrufen({
      freigabe: erteile(),
      admin: ADMIN,
      laufend: bindungen(),
      beenden: (b) => {
        if (b.art === "job") throw new Error("Job reagiert nicht");
        return true;
      },
      jetzt: T0 + MIN,
    });
    expect(r).toMatchObject({ ok: true, vollstaendig: false });
    if (!r.ok) return;
    expect(r.ereignis.nichtBeendet).toEqual(["job:j-1"]);
    expect(freigabeZustand(r.freigabe, T0 + MIN)).toBe("widerrufen");
  });

  it("nur ein Kundenadmin widerruft, und ein Widerruf gilt nur einmal", () => {
    const f = erteile();
    const ohneRecht = widerrufen({
      freigabe: f,
      admin: { kennung: "x.y@kunde.example", rolle: "controller" },
      laufend: [],
      beenden: () => true,
      jetzt: T0,
    });
    expect(ohneRecht).toEqual({ ok: false, fehler: "kein_kundenadmin" });
    const erst = widerrufen({
      freigabe: f,
      admin: ADMIN,
      laufend: [],
      beenden: () => true,
      jetzt: T0,
    });
    if (!erst.ok) throw new Error(erst.fehler);
    const zweit = widerrufen({
      freigabe: erst.freigabe,
      admin: ADMIN,
      laufend: [],
      beenden: () => true,
      jetzt: T0,
    });
    expect(zweit).toEqual({ ok: false, fehler: "bereits_beendet" });
  });
});

describe("P11-AC08 — Verlängerung und Abschluss mit realem Beleg protokollieren", () => {
  it("verlängert mit Beleg und protokolliert Admin, Beleg und neues Ende", () => {
    const beleg: SupportBeleg = {
      art: "adminbestaetigung",
      referenz: "PROT-2026-10-13-0815",
      am: T0 + 10 * MIN,
    };
    const r = verlaengern({
      freigabe: erteile(),
      admin: ADMIN,
      zusatzMinuten: 60,
      beleg,
      jetzt: T0 + 10 * MIN,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.freigabe.endetAm).toBe(T0 + 120 * MIN);
    expect(r.ereignis).toMatchObject({
      art: "verlaengert",
      durch: ADMIN.kennung,
      beleg,
      ergebnis: `bis ${new Date(T0 + 120 * MIN).toISOString()}`,
    });
  });

  it.each([
    [{ art: "ticket", referenz: "", am: T0 }, "beleg_fehlt"],
    [{ art: "ticket", referenz: "TODO", am: T0 }, "beleg_platzhalter"],
    [{ art: "ticket", referenz: "-", am: T0 }, "beleg_platzhalter"],
    [{ art: "ticket", referenz: "KUNDE-1", am: T0 + 60 * MIN }, "beleg_zukunft"],
  ] as const)("ohne realen Beleg keine Verlängerung (%j)", (beleg, fehler) => {
    expect(belegPruefen(beleg, T0)).toEqual({ ok: false, fehler });
    const r = verlaengern({
      freigabe: erteile(),
      admin: ADMIN,
      zusatzMinuten: 30,
      beleg,
      jetzt: T0,
    });
    expect(r).toEqual({ ok: false, fehler });
  });

  it("über die Höchstdauer hinaus wird nicht verlängert", () => {
    // Innerhalb von 15 Minuten nach der letzten Bedienung, damit die Freigabe aktiv bleibt.
    let f = erteile();
    for (const t of [5, 10, 13]) {
      const r = verlaengern({
        freigabe: f,
        admin: ADMIN,
        zusatzMinuten: 60,
        beleg: BELEG,
        jetzt: T0 + t * MIN,
      });
      if (!r.ok) throw new Error(r.fehler);
      f = r.freigabe;
    }
    expect(f.endetAm).toBe(T0 + 240 * MIN);
    const darueber = verlaengern({
      freigabe: f,
      admin: ADMIN,
      zusatzMinuten: 1,
      beleg: BELEG,
      jetzt: T0 + 14 * MIN,
    });
    expect(darueber).toEqual({ ok: false, fehler: "ueber_hoechstdauer" });
  });

  it("ohne Adminrecht oder nach Ablauf wird nicht verlängert", () => {
    const ohneRecht = verlaengern({
      freigabe: erteile(),
      admin: { kennung: "x.y@kunde.example", rolle: "experte" },
      zusatzMinuten: 10,
      beleg: BELEG,
      jetzt: T0,
    });
    expect(ohneRecht).toEqual({ ok: false, fehler: "kein_kundenadmin" });
    const abgelaufen = verlaengern({
      freigabe: erteile(),
      admin: ADMIN,
      zusatzMinuten: 10,
      beleg: BELEG,
      jetzt: T0 + 60 * MIN,
    });
    expect(abgelaufen).toEqual({ ok: false, fehler: "nicht_aktiv" });
  });

  it("Abschluss braucht Ergebnis und Beleg und beendet verbliebene Bindungen", () => {
    const f = erteile();
    const ohneErgebnis = abschliessen({
      freigabe: f,
      durch: PERSON.kennung,
      ergebnis: "offen",
      beleg: BELEG,
      laufend: [],
      beenden: () => true,
      jetzt: T0 + 20 * MIN,
    });
    expect(ohneErgebnis).toEqual({ ok: false, fehler: "ergebnis_fehlt" });
    const ohneBeleg = abschliessen({
      freigabe: f,
      durch: PERSON.kennung,
      ergebnis: "Importzuordnung korrigiert",
      beleg: { art: "ticket", referenz: "folgt", am: T0 },
      laufend: [],
      beenden: () => true,
      jetzt: T0 + 20 * MIN,
    });
    expect(ohneBeleg).toEqual({ ok: false, fehler: "beleg_platzhalter" });
    const r = abschliessen({
      freigabe: f,
      durch: PERSON.kennung,
      ergebnis: "Importzuordnung korrigiert, Lauf erfolgreich",
      beleg: { art: "ticket", referenz: "KUNDE-4711", am: T0 + 20 * MIN },
      laufend: bindungen(),
      beenden: () => true,
      jetzt: T0 + 20 * MIN,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ereignis).toMatchObject({
      art: "abgeschlossen",
      durch: PERSON.kennung,
      beleg: { referenz: "KUNDE-4711" },
      beendet: ["sitzung:s-1", "job:j-1"],
    });
    expect(freigabeZustand(r.freigabe, T0 + 20 * MIN)).toBe("abgeschlossen");
    expect(darf(r.freigabe, "diagnose", 21)).toBe(false);
  });
});

describe("Phase: Konzept — der Vertrag öffnet keinen Zugang", () => {
  it("ist als Konzept ohne aktiven Zugang gekennzeichnet", () => {
    expect(SUPPORTZUGANG_PHASE).toEqual({
      phase: "konzept",
      betreiber: "nach PoC",
      zugangAktiv: false,
    });
  });

  it("kein Produktcode außer dem Vertrag selbst bindet ihn an Route oder Server", () => {
    const funde: string[] = [];
    const lauf = (ordner: string) => {
      for (const name of readdirSync(ordner)) {
        const pfad = join(ordner, name);
        if (statSync(pfad).isDirectory()) {
          if (name !== "node_modules") lauf(pfad);
          continue;
        }
        if (!/\.(ts|tsx|js|mjs)$/.test(name) || name === "supportzugang-vertrag.ts") continue;
        if (readFileSync(pfad, "utf8").includes("supportzugang-vertrag")) {
          funde.push(relative(REPO_WURZEL, pfad));
        }
      }
    };
    lauf(repoPfad("services"));
    lauf(repoPfad("apps/web/src"));
    expect(funde).toEqual([]);
  });
});
