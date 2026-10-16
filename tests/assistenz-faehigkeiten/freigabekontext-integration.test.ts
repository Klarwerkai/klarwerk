// ================================================================================================
// produkt:20261015:rechte-freigabekontext-integration · GEGENPROBEN ZUM ÜBERNOMMENEN FREIGABEFIX.
// ================================================================================================
//
// Der Fix aus dem Rechtekandidaten 9315fa9 (rechteentzug-gespraeche-belege, Nacharbeit 43) lässt das
// persönliche Freigabeniveau (`freigabe`) aus dem je Schritt frisch gelesenen Konto in den
// Betrachter von `produktKontextPruefung` mitreisen. Geprüft wird der echte Kontextpfad der
// Fähigkeiten — Ausführung, Hintergrundfortsetzung und Ergebniszugriff — mit fiktiven Konten und
// Objekten, ohne Netz und ohne Modell:
//
//   F1  Ein hochrangiges Konto mit ausdrücklich auf `intern` begrenzter Freigabe sieht vertraulichen
//       Kontext NICHT — weder bei Ausführung, Fortsetzung im Hintergrund noch Ergebniszugriff.
//   F2  Eine danach ausdrücklich erhöhte Freigabe erlaubt — aber nur, solange Space- und Quellleserecht
//       weiterhin bestehen; der Entzug der Freigabe wirkt beim nächsten Schritt.
//   F3  Ohne persönlichen Wert bleibt der Rollenstandard (`freigaberang`) maßgeblich.
import { beforeEach, describe, expect, it } from "vitest";
import {
  type AdapterAntwort,
  FaehigkeitsAusfuehrung,
  type Faehigkeitsauftrag,
  type Faehigkeitsbindung,
  Faehigkeitsregistry,
  type Faehigkeitsvertrag,
  ProfilFaehigkeitsAblage,
} from "../../services/app/src/assistenz-faehigkeiten";
import {
  produktFaehigkeitsLage,
  produktKontextPruefung,
} from "../../services/app/src/assistenz-faehigkeiten-anbindung";
import { InMemoryAssistenzProfilRepo } from "../../services/app/src/assistenz-profil";
import type { Freigabestufe } from "../../services/auth";
import { InMemoryExternalKnowledgePolicyRepo } from "../../services/external-search";

// Ein interner Entwurf: der Empfänger darf bis streng vertraulich — die Sperre kommt also allein
// aus den Kontextrechten des Kontos, nicht aus der Empfängergrenze.
const ENTWURF: Faehigkeitsvertrag = {
  id: "fgi-entwurf",
  fassung: "1.0.0",
  name: "Fiktiver Entwurf",
  beschreibung: "Legt einen privaten Entwurf an; idempotent über die Auftragskennung.",
  zwecke: ["entwurf_anlegen"],
  datenempfaenger: { art: "intern" },
  wirkung: "entwurf_schreiben",
  modell: false,
  aktionen: ["wissen_lesen", "entwurf_anlegen"],
  eingaben: [{ name: "titel", maxLaenge: 120, pflicht: true }],
  ergebnis: { art: "entwurf", felder: ["kennung", "titel"], quellenPflicht: false },
  hoechsteSchutzstufe: "streng_vertraulich",
  grenzen: { maxTreffer: 1, zeitlimitMs: 2_000, kostenJeAufrufCent: 0 },
  kostenzuordnung: null,
  credential: null,
  ruecknahme: "entwurf_verwerfen",
  unterschritte: [],
  verantwortlich: "Testverantwortung",
};

interface Konto {
  id: string;
  role: "viewer" | "experte" | "controller" | "admin";
  approved: boolean;
  freigabe?: Freigabestufe;
}

interface WissenEintrag {
  confidentiality: "intern" | "vertraulich" | "streng_vertraulich";
  author: string;
  version: number;
  title: string;
  statement: string;
  spaceId: string;
  quellrechte: { leser: string[] };
}

let konten: Konto[];
let spaces: Map<string, Set<string>>;
let wissen: Map<string, WissenEintrag>;
let profile: InMemoryAssistenzProfilRepo;
let entwuerfe: Map<string, string>;
let kontenLesungen: number;

const deps = () => ({
  // Frisch je Schritt — jede Prüfung liest die Konten neu (wie `services.auth.listUsers()`).
  konten: async () => {
    kontenLesungen += 1;
    return konten.map((k) => ({ ...k }));
  },
  wissen: { get: async (id: string) => wissen.get(id) },
  lesbareSpaces: async (nutzer: string) => new Set(spaces.get(nutzer) ?? []),
});

function baue(instanz: string): FaehigkeitsAusfuehrung {
  const registry = new Faehigkeitsregistry();
  registry.registriere(ENTWURF);
  registry.installiereAdapter({
    faehigkeitId: ENTWURF.id,
    fassung: ENTWURF.fassung,
    transport: "ersatz",
    fuehreAus: async (_eingabe, k): Promise<AdapterAntwort> => {
      const kennung = entwuerfe.get(k.auftragId) ?? `entwurf-${entwuerfe.size + 1}`;
      entwuerfe.set(k.auftragId, kennung);
      return { status: "ok", eintraege: [{ kennung, titel: "Notiz" }], wirkungKennung: kennung };
    },
  });
  return new FaehigkeitsAusfuehrung({
    registry,
    lage: produktFaehigkeitsLage({
      reasoner: {
        kiAbschaltung: () => ({ abgeschaltet: false }),
        vertraulicheAusleitungFreigegeben: () => false,
      },
      externeWissensabfrage: new InMemoryExternalKnowledgePolicyRepo(),
    }),
    geheimnisse: { hole: () => null },
    ablage: new ProfilFaehigkeitsAblage(profile),
    kontext: produktKontextPruefung(deps()),
    instanz,
  });
}

let zaehler = 0;
function auftrag(): Faehigkeitsauftrag {
  zaehler += 1;
  return {
    auftragId: `fgi-auftrag-${zaehler}`,
    mandant: "instanz",
    nutzer: "carla",
    sitzung: "s1",
    arbeitsbereich: "projekt-fiktiv",
    zweck: "entwurf_anlegen",
    gewaehlt: null,
    eingabe: { titel: "Notiz" },
    kontext: [{ kennung: "ko-v", fassung: "1", schutz: "vertraulich", text: "Liefervertrag" }],
    ausloeser: "nutzerauftrag",
  };
}

async function binde(a: FaehigkeitsAusfuehrung): Promise<Faehigkeitsbindung> {
  const v = await a.bereiteVor(auftrag());
  if (v.art !== "gebunden") {
    throw new Error(`nicht gebunden: ${v.stand} ${v.erklaerung}`);
  }
  return v.bindung;
}

function setzeFreigabe(freigabe: Freigabestufe | undefined): void {
  konten = konten.map((k) => {
    if (k.id !== "carla") {
      return k;
    }
    const { freigabe: _alt, ...rest } = k;
    return freigabe ? { ...rest, freigabe } : rest;
  });
}

const KONTEXT = [{ kennung: "ko-v", fassung: "1", schutz: "vertraulich" as const }];

beforeEach(() => {
  // Carla ist Admin (Rollenstandard: Rang 1 = vertraulich), persönlich aber auf „intern" begrenzt.
  konten = [{ id: "carla", role: "admin", approved: true, freigabe: "intern" }];
  spaces = new Map([["carla", new Set(["space-einkauf"])]]);
  wissen = new Map([
    [
      "ko-v",
      {
        confidentiality: "vertraulich",
        author: "bert",
        version: 1,
        title: "Liefervertrag",
        statement: "Konditionen Lieferant Nord",
        spaceId: "space-einkauf",
        quellrechte: { leser: ["carla", "bert"] },
      },
    ],
  ]);
  profile = new InMemoryAssistenzProfilRepo();
  entwuerfe = new Map();
  kontenLesungen = 0;
});

describe("F1 · ausdrücklich auf intern begrenzte Freigabe sperrt vertraulichen Kontext", () => {
  it("Kontextprüfung und Laden verweigern trotz Admin-Rolle, Space- und Quellleserecht", async () => {
    const k = produktKontextPruefung(deps());
    expect((await k.pruefe("carla", KONTEXT, "ausfuehrung"))?.art).toBe("kontextrecht");
    expect((await k.pruefe("carla", KONTEXT, "rueckgabe"))?.art).toBe("kontextrecht");
    // `lade` ist am Interface optional; fehlte es, wäre das Ergebnis `undefined` und nicht `null`.
    expect(await k.lade?.("carla", KONTEXT)).toBeNull();
    // Gegenprobe ohne die Begrenzung: dieselbe Rolle sieht es über den Rollenstandard.
    setzeFreigabe(undefined);
    expect(await k.pruefe("carla", KONTEXT, "ausfuehrung")).toBeNull();
    expect((await k.lade?.("carla", KONTEXT))?.[0]?.text).toBe(
      "Liefervertrag\nKonditionen Lieferant Nord",
    );
  });

  it("Ausführung und Hintergrundfortsetzung bleiben gesperrt, ohne Wirkung und ohne Inhalt", async () => {
    const a = baue("A");
    const sofort = await a.fuehreAus(await binde(a));
    expect(sofort.stand).toBe("gesperrt");
    expect(sofort.voraussetzungen.map((v) => v.art)).toContain("kontextrecht");
    expect(JSON.stringify(sofort)).not.toContain("Konditionen");

    const b = await binde(a);
    expect((await a.starteImHintergrund(b)).stand).toBe("wartet");
    // Fortsetzung in einem neuen Prozess — dieselbe Ablage, frisch gelesenes Konto.
    const [r] = await baue("B").arbeiteWarteschlangeAb();
    expect(r?.stand).toBe("gesperrt");
    expect(r?.voraussetzungen.map((v) => v.art)).toContain("kontextrecht");
    expect(entwuerfe.size).toBe(0);
  });
});

describe("F2 · erhöhte Freigabe nur mit aktuellen Space- und Quellrechten; Entzug beim nächsten Schritt", () => {
  it("erhöht → ausführbar; Space oder Quellrecht entzogen → Ergebnis gesperrt; Freigabe entzogen → gesperrt", async () => {
    setzeFreigabe("vertraulich");
    const a = baue("A");
    const b = await binde(a);
    const r = await a.fuehreAus(b);
    expect(r.stand).toBe("erfolgreich");
    expect(entwuerfe.size).toBe(1);

    // Space-Leserecht weg: die Freigabe allein öffnet nichts.
    spaces.set("carla", new Set());
    expect((await a.auftrag("carla", b.auftragId))?.ergebnis?.stand).toBe("gesperrt");
    spaces.set("carla", new Set(["space-einkauf"]));
    // Quellleserecht weg: ebenso.
    wissen.set("ko-v", {
      ...(wissen.get("ko-v") as WissenEintrag),
      quellrechte: { leser: ["bert"] },
    });
    expect((await a.fuehreAus(b)).stand).toBe("gesperrt");
    wissen.set("ko-v", {
      ...(wissen.get("ko-v") as WissenEintrag),
      quellrechte: { leser: ["carla", "bert"] },
    });
    expect((await a.auftrag("carla", b.auftragId))?.ergebnis?.eintraege).toHaveLength(1);

    // Freigabe wieder auf intern: der nächste Ergebniszugriff ist gesperrt, ohne neue Wirkung.
    setzeFreigabe("intern");
    const gesperrt = await a.fuehreAus(b);
    expect(gesperrt.stand).toBe("gesperrt");
    expect(gesperrt.eintraege).toEqual([]);
    expect((await a.auftraege("carla"))[0]?.ergebnis?.eintraege).toEqual([]);
    expect(entwuerfe.size).toBe(1);
  });

  it("Entzug zwischen Vormerkung und Hintergrundlauf wirkt beim Lauf", async () => {
    setzeFreigabe("vertraulich");
    const a = baue("A");
    await a.starteImHintergrund(await binde(a));
    setzeFreigabe("intern");
    const vorher = kontenLesungen;
    const [r] = await a.arbeiteWarteschlangeAb();
    expect(r?.stand).toBe("gesperrt");
    expect(kontenLesungen).toBeGreaterThan(vorher);
    expect(entwuerfe.size).toBe(0);
  });
});

describe("F3 · ohne persönlichen Wert gilt der Rollenstandard", () => {
  it("Admin ohne Wert sieht vertraulich, nicht streng vertraulich; Experte ohne Wert sieht nicht vertraulich", async () => {
    const k = produktKontextPruefung(deps());
    setzeFreigabe(undefined);
    expect(await k.pruefe("carla", KONTEXT, "ausfuehrung")).toBeNull();
    wissen.set("ko-v", {
      ...(wissen.get("ko-v") as WissenEintrag),
      confidentiality: "streng_vertraulich",
    });
    expect((await k.pruefe("carla", KONTEXT, "ausfuehrung"))?.art).toBe("kontextrecht");
    // Nur die ausdrückliche Freigabe öffnet „streng vertraulich".
    setzeFreigabe("streng_vertraulich");
    expect(await k.pruefe("carla", KONTEXT, "ausfuehrung")).toBeNull();

    wissen.set("ko-v", {
      ...(wissen.get("ko-v") as WissenEintrag),
      confidentiality: "vertraulich",
    });
    konten = [{ id: "carla", role: "experte", approved: true }];
    expect((await k.pruefe("carla", KONTEXT, "ausfuehrung"))?.art).toBe("kontextrecht");
  });

  it("eine Freigabe öffnet kein gesperrtes Konto", async () => {
    konten = [{ id: "carla", role: "admin", approved: false, freigabe: "streng_vertraulich" }];
    const k = produktKontextPruefung(deps());
    expect((await k.pruefe("carla", KONTEXT, "rueckgabe"))?.art).toBe("kontextrecht");
    expect(await k.lade?.("carla", KONTEXT)).toBeNull();
  });
});
