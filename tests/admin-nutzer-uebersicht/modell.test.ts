// ================================================================================================
// ADMIN-04 · DAS MODELL DER KONTENLISTE — Zugangsstand, Suche/Filter, Rollenwirkung, Sammelvorschau.
// ================================================================================================
//
// produkt:20261009:admin-nutzer-uebersicht, gemessen an `apps/web/src/lib/nutzerliste.ts` ohne DOM.
//
//   K1  Suche (Name, E-Mail) und Rollen-/Zugangsfilter wirken GEMEINSAM; Adresswerte, die es nicht
//       gibt, gelten als „nicht gesetzt"; `filter=wartet` (ADMIN-01) bleibt der Name für „gesperrt".
//   K2  Der Zugangsstand folgt genau den vorhandenen Feldern (`approved`, `accessExpiresAt`) — wie
//       `zugangsstand` im Dienst (`services/app/src/verantwortung.ts`).
//   K4  Die Wirkung eines Rollenwechsels kommt aus dem bestehenden Rollenmodell (`rollenFreiheiten`).
//   K5  Sammelaktionen: nur Freigeben/Befristen; die Vorschau nennt je Konto Wirkung oder Grund;
//       die Bilanz ist nie „vollständig", solange eine Zeile scheiterte.
//
// Alle Konten sind erfundene Testdaten.
import { describe, expect, it } from "vitest";
import { freiheitenSchluessel } from "../../apps/web/src/components/einstellungen/rollenFreiheiten";
import {
  type KontoZugang,
  faehigkeitenVon,
  filterAktiv,
  filtereKonten,
  kontenFilterAus,
  kontenFilterQuery,
  kontoZugang,
  rollenwirkung,
  sammelSignatur,
  sammelbilanz,
  sammelvorschau,
  sucheTrifft,
} from "../../apps/web/src/lib/nutzerliste";
import { zugangsstand } from "../../services/app/src/verantwortung";

const JETZT = Date.parse("2026-10-09T10:00:00.000Z");
const GESTERN = "2026-10-08T21:59:59.999Z";
const MORGEN = "2026-10-10T21:59:59.999Z";

type Konto = {
  id: string;
  name: string;
  email: string;
  role: "viewer" | "experte" | "controller" | "admin";
  approved: boolean;
  createdAt: string;
  accessExpiresAt?: string;
};

const KONTEN: Konto[] = [
  {
    id: "u1",
    name: "Jörg Prüfer",
    email: "joerg.pruefer@werk.test",
    role: "controller",
    approved: true,
    createdAt: "2026-09-01T08:00:00.000Z",
  },
  {
    id: "u2",
    name: "Gina Gast",
    email: "gina@extern.test",
    role: "viewer",
    approved: true,
    createdAt: "2026-09-02T08:00:00.000Z",
    accessExpiresAt: MORGEN,
  },
  {
    id: "u3",
    name: "Alt Ablauf",
    email: "alt@extern.test",
    role: "viewer",
    approved: true,
    createdAt: "2026-08-01T08:00:00.000Z",
    accessExpiresAt: GESTERN,
  },
  {
    id: "u4",
    name: "Neu Wartend",
    email: "neu@werk.test",
    role: "experte",
    approved: false,
    createdAt: "2026-10-08T08:00:00.000Z",
  },
  {
    id: "u5",
    name: "Erika Expertin",
    email: "erika@werk.test",
    role: "experte",
    approved: true,
    createdAt: "2026-07-01T08:00:00.000Z",
  },
];

const zugangVon = (k: Konto): KontoZugang =>
  kontoZugang(
    k.approved,
    k.accessExpiresAt === undefined ? undefined : Date.parse(k.accessExpiresAt),
    JETZT,
  );

describe("ADMIN-04 · K2 Zugangsstand aus vorhandenen Feldern", () => {
  it("aktiv, befristet, abgelaufen und gesperrt — dieselbe Einteilung wie der Dienst", () => {
    expect(KONTEN.map((k) => [k.id, zugangVon(k)])).toEqual([
      ["u1", "aktiv"],
      ["u2", "befristet"],
      ["u3", "abgelaufen"],
      ["u4", "gesperrt"],
      ["u5", "aktiv"],
    ]);
    // Gegenprobe gegen die Serverregel, Konto für Konto.
    for (const k of KONTEN) {
      expect(zugangVon(k), k.id).toBe(zugangsstand(k, JETZT));
    }
  });

  it("der Ablaufzeitpunkt selbst gilt schon als abgelaufen (`<=` wie im Dienst)", () => {
    expect(kontoZugang(true, JETZT, JETZT)).toBe("abgelaufen");
    expect(kontoZugang(true, JETZT + 1, JETZT)).toBe("befristet");
  });

  it("ein nicht freigegebenes Konto ist gesperrt — auch mit Befristung in der Zukunft", () => {
    expect(kontoZugang(false, JETZT + 86_400_000, JETZT)).toBe("gesperrt");
  });

  it("es gibt keinen Zustand „Einladung offen“ — das Konto führt ihn nicht", () => {
    const zustaende = new Set(KONTEN.map(zugangVon));
    expect([...zustaende].sort()).toEqual(["abgelaufen", "aktiv", "befristet", "gesperrt"]);
  });
});

describe("ADMIN-04 · K1 Suche und Filter gemeinsam", () => {
  it("Suche nach Name und E-Mail, ohne Gross-/Kleinschreibung und Umlautakzent", () => {
    expect(sucheTrifft(KONTEN[0] as Konto, "jörg")).toBe(true);
    expect(sucheTrifft(KONTEN[0] as Konto, "JORG")).toBe(true);
    expect(sucheTrifft(KONTEN[0] as Konto, "pruefer@werk")).toBe(true);
    // Mehrere Wörter: alle müssen vorkommen, je in Name ODER Adresse.
    expect(sucheTrifft(KONTEN[1] as Konto, "gina extern")).toBe(true);
    expect(sucheTrifft(KONTEN[1] as Konto, "gina werk")).toBe(false);
    expect(sucheTrifft(KONTEN[1] as Konto, "   ")).toBe(true);
  });

  it("Suche, Rolle und Zugang wirken zusammen (UND), nicht nebeneinander (ODER)", () => {
    const ids = (f: Parameters<typeof filtereKonten>[1]) =>
      filtereKonten(KONTEN, f, zugangVon).map((k) => k.id);
    expect(ids({ suche: "extern", rolle: null, zugang: null })).toEqual(["u2", "u3"]);
    expect(ids({ suche: "extern", rolle: "viewer", zugang: "abgelaufen" })).toEqual(["u3"]);
    expect(ids({ suche: "werk", rolle: "experte", zugang: null })).toEqual(["u4", "u5"]);
    expect(ids({ suche: "werk", rolle: "experte", zugang: "gesperrt" })).toEqual(["u4"]);
    // Leeres Ergebnis aus einer Kombination, die einzeln Treffer hätte.
    expect(ids({ suche: "extern", rolle: "controller", zugang: null })).toEqual([]);
  });

  it("die Filter kommen aus der Adresse und gehen in sie zurück; Unbekanntes gilt als nicht gesetzt", () => {
    const f = kontenFilterAus(
      new URLSearchParams("bereich=konten&suche=gina%20gast&rolle=viewer&filter=befristet"),
    );
    expect(f).toEqual({ suche: "gina gast", rolle: "viewer", zugang: "befristet" });
    expect(filterAktiv(f)).toBe(true);
    expect(kontenFilterQuery(f)).toBe("suche=gina%20gast&rolle=viewer&filter=befristet");

    const fremd = kontenFilterAus(new URLSearchParams("rolle=chef&filter=eingeladen"));
    expect(fremd).toEqual({ suche: "", rolle: null, zugang: null });
    expect(filterAktiv(fremd)).toBe(false);
    expect(kontenFilterQuery(fremd)).toBe("");
  });

  it("`filter=wartet` (Aufgabe aus ADMIN-01) ist der Zugang „gesperrt“ — und bleibt so in der Adresse", () => {
    const f = kontenFilterAus(new URLSearchParams("bereich=konten&filter=wartet"));
    expect(f.zugang).toBe("gesperrt");
    expect(kontenFilterQuery(f)).toBe("filter=wartet");
    // „gesperrt" als Rohwert gibt es in der Adresse nicht — sonst hätte derselbe Filter zwei Namen.
    expect(kontenFilterAus(new URLSearchParams("filter=gesperrt")).zugang).toBeNull();
  });
});

describe("ADMIN-04 · K4 Wirkung eines Rollenwechsels aus dem bestehenden Rollenmodell", () => {
  it("die Fähigkeiten einer Rolle sind ihre eigenen und die aller Rollen darunter", () => {
    expect(faehigkeitenVon("viewer")).toEqual(freiheitenSchluessel("viewer"));
    expect(faehigkeitenVon("controller")).toEqual([
      ...freiheitenSchluessel("viewer"),
      ...freiheitenSchluessel("experte"),
      ...freiheitenSchluessel("controller"),
    ]);
  });

  it("hinauf: nur Zugewinn; hinunter: nur Wegfall — genau die Fähigkeiten dazwischen", () => {
    const hoch = rollenwirkung("experte", "controller");
    expect(hoch.weg).toEqual([]);
    expect(hoch.dazu).toEqual(freiheitenSchluessel("controller"));
    expect(hoch.dazu.length).toBeGreaterThan(0);

    const runter = rollenwirkung("controller", "viewer");
    expect(runter.dazu).toEqual([]);
    expect(runter.weg).toEqual([
      ...freiheitenSchluessel("experte"),
      ...freiheitenSchluessel("controller"),
    ]);
    expect(rollenwirkung("experte", "experte")).toEqual({ dazu: [], weg: [] });
  });
});

describe("ADMIN-04 · K5 Sammelaktionen: Vorschau je Konto, Bilanz ohne Pauschalerfolg", () => {
  it("Freigeben wirkt nur bei wartenden Konten; die übrigen entfallen mit Grund", () => {
    const v = sammelvorschau("freigeben", KONTEN, "u1");
    expect(v.map((z) => [z.id, z.art])).toEqual([
      ["u1", "entfaellt"],
      ["u2", "entfaellt"],
      ["u3", "entfaellt"],
      ["u4", "wirkt"],
      ["u5", "entfaellt"],
    ]);
    expect(v.find((z) => z.id === "u2")).toMatchObject({ grund: "schonFrei" });
  });

  it("Befristen: nicht beim eigenen Konto und nicht bei gesperrten (es würde nichts beenden)", () => {
    const v = sammelvorschau("befristen", KONTEN, "u1");
    expect(v.find((z) => z.id === "u1")).toMatchObject({ art: "entfaellt", grund: "selbst" });
    expect(v.find((z) => z.id === "u4")).toMatchObject({ art: "entfaellt", grund: "gesperrt" });
    expect(v.filter((z) => z.art === "wirkt").map((z) => z.id)).toEqual(["u2", "u3", "u5"]);
  });

  it("die Vorschau-Signatur ändert sich mit Auswahl, Kontozustand, Aktion und Tag", () => {
    const ab = [KONTEN[1], KONTEN[2]] as Konto[];
    const basis = sammelSignatur("befristen", MORGEN, ab, "u1");
    expect(sammelSignatur("befristen", MORGEN, [...ab], "u1")).toBe(basis);
    // Filter blendet B aus / leere Auswahl.
    expect(sammelSignatur("befristen", MORGEN, [KONTEN[1] as Konto], "u1")).not.toBe(basis);
    expect(sammelSignatur("befristen", MORGEN, [], "u1")).not.toBe(basis);
    // Der Server meldet einen anderen Freigabestand.
    const umgestellt = ab.map((k, i) => (i === 0 ? { ...k, approved: false } : k));
    expect(sammelSignatur("befristen", MORGEN, umgestellt, "u1")).not.toBe(basis);
    expect(sammelSignatur("freigeben", null, ab, "u1")).not.toBe(basis);
    expect(sammelSignatur("befristen", GESTERN, ab, "u1")).not.toBe(basis);
  });

  it("eine gescheiterte Zeile macht die Bilanz unvollständig und wird mitgezählt", () => {
    expect(
      sammelbilanz([
        { id: "u2", name: "Gina Gast", ok: true },
        {
          id: "u5",
          name: "Erika Expertin",
          ok: false,
          meldung: "Das Konto ist noch für 1 Beiträge hauptverantwortlich.",
          abgewiesen: true,
        },
      ]),
    ).toEqual({ ok: 1, fehler: 1, vollstaendig: false });
    expect(sammelbilanz([{ id: "u2", name: "Gina Gast", ok: true }])).toEqual({
      ok: 1,
      fehler: 0,
      vollstaendig: true,
    });
  });
});
