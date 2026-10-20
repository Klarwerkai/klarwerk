// PP-05: Deckvertrag für PP-07/08. Daten und Prüfungen bleiben ausschließlich bei PP-02/03.
import { createHash } from "node:crypto";
import type { KnowledgeObject } from "../../knowledge-object";
import {
  DatenFehler,
  type DatenUmgebung,
  type Datenpunkt,
  type DatenpunktSicht,
  inFassung,
  sicht,
} from "./praesentation-daten";
import type { DatenpunktAblage } from "./praesentation-daten-ablage";
import { kontrollAnschluss } from "./praesentation-pruefung-anschluss";
import { schutzrang } from "./sichtbarkeit";

export interface AufbauAuftrag {
  expectedVersion: number;
  titel: string;
  ziel: string;
  publikum: string;
  dauerMinuten: number;
  datenpunkte: { id: string; fassung: number }[];
  design: "vorlage" | "betont";
  diagramm: boolean;
}
export interface AufbauFakt {
  id: string;
  fassung: number;
  label: string;
  wert: string;
  zahl?: number;
  einheit: string;
  waehrung?: string;
  prognose: boolean;
  zeitraum: string;
  zustand: string;
  belege: string[];
}
export interface AufbauPlan {
  vertrag: "klara-pp05-v1";
  planId: string;
  kontrolliertAm: string;
  basis: { koId: string; anhangId: string; artikelFassung: number; dateiFassung: string };
  auftrag: AufbauAuftrag;
  fakten: AufbauFakt[];
  diagramm: null | { minimum: number; maximum: number; einheit: string };
  hinweise: string[];
}

function quellbeleg(s: DatenpunktSicht): string {
  const q = s.quelle;
  const quelle = q?.lesbar
    ? `Quelle „${q.titel}“, Artikel ${q.koId}, verwendete Fassung ${q.koFassung}${q.dateiFassung ? `, Dateifassung ${q.dateiFassung}` : ""}`
    : "Keine Originalquelle gebunden";
  const f = s.fundstelle;
  switch (f.art) {
    case "artikel":
      return `${quelle}. Fundstelle: ${f.zitat}`;
    case "eingabe":
      return `${quelle}. Manuelle Eingabe: ${f.beleg ?? "Beleg fehlt"}`;
    case "rechenweg":
      return "Berechneter Wert: Die Originalquellen stehen bei den tatsächlich verwendeten Eingaben.";
    case "tabellenzelle":
      return `${quelle}. Folie ${f.folienPosition} „${f.folienTitel}“, ${f.elementName}, Zeile ${f.zeile} „${f.zeilenkopf}“, Spalte ${f.spalte} „${f.spaltenkopf}“: ${f.zitat}`;
    case "folienelement":
      return `${quelle}. Folie ${f.folienPosition} „${f.folienTitel}“, ${f.elementName}: ${f.zitat}`;
    case "bild":
      return `${quelle}. Bild auf Folie ${f.folienPosition} „${f.folienTitel}“, ${f.elementName}, ${f.bildKennung}. OCR-Text: ${f.ocrText}`;
  }
}

function text(v: unknown, name: string, max = 200): string {
  if (
    typeof v !== "string" ||
    !v.trim() ||
    v.length > max ||
    [...v].some((c) => c.charCodeAt(0) < 32 && ![9, 10, 13].includes(c.charCodeAt(0)))
  ) {
    throw new DatenFehler("ungueltig", `${name} fehlt oder ist zu lang.`);
  }
  return v.trim();
}
export function leseAufbau(roh: unknown): AufbauAuftrag {
  const r = roh as Partial<AufbauAuftrag> | null;
  if (
    !r ||
    !Number.isInteger(r.expectedVersion) ||
    (r.expectedVersion ?? 0) < 1 ||
    !Number.isInteger(r.dauerMinuten) ||
    (r.dauerMinuten ?? 0) < 1 ||
    (r.dauerMinuten ?? 0) > 120 ||
    !Array.isArray(r.datenpunkte) ||
    r.datenpunkte.length < 1 ||
    r.datenpunkte.length > 12 ||
    !["vorlage", "betont"].includes(r.design ?? "") ||
    typeof r.diagramm !== "boolean"
  ) {
    throw new DatenFehler(
      "ungueltig",
      "Ziel, Publikum, Dauer, Gestaltung und 1 bis 12 Datenpunkte mit Fassungen angeben.",
    );
  }
  const datenpunkte = r.datenpunkte.map((d) => {
    if (!d || !Number.isInteger(d.fassung) || d.fassung < 1)
      throw new DatenFehler("ungueltig", "Datenfassung fehlt.");
    return { id: text(d.id, "Datenpunkt", 200), fassung: d.fassung };
  });
  if (new Set(datenpunkte.map((d) => d.id)).size !== datenpunkte.length)
    throw new DatenFehler("ungueltig", "Datenpunkt mehrfach ausgewählt.");
  return {
    expectedVersion: r.expectedVersion as number,
    titel: text(r.titel, "Titel", 100),
    ziel: text(r.ziel, "Ziel"),
    publikum: text(r.publikum, "Publikum", 100),
    dauerMinuten: r.dauerMinuten as number,
    datenpunkte,
    design: r.design as AufbauAuftrag["design"],
    diagramm: r.diagramm,
  };
}

// Der Zielartikel darf den Leserkreis der Herkunft nicht erweitern. Bei komplexeren
// Rechtekombinationen bleibt der Aufbau offen, statt eine Weitergabefreigabe zu erfinden.
function gleicherLeserkreis(ziel: KnowledgeObject, quelle: KnowledgeObject): boolean {
  const leser = (k: KnowledgeObject) => JSON.stringify([...(k.quellrechte?.leser ?? [])].sort());
  return (
    ziel.spaceId === quelle.spaceId &&
    ziel.confidentiality === quelle.confidentiality &&
    (schutzrang(ziel.confidentiality) === 0 || ziel.author === quelle.author) &&
    leser(ziel) === leser(quelle)
  );
}

/** Nur echte PP-02-Sichten, einschließlich der tatsächlich verwendeten Eingabefassungen. */
export async function planeAufbau(args: {
  ziel: KnowledgeObject;
  anhangId: string;
  dateiFassung: string;
  auftrag: AufbauAuftrag;
  u: DatenUmgebung;
  ablage: DatenpunktAblage;
  jetzt: () => number;
}): Promise<AufbauPlan> {
  const { ziel, auftrag, u, ablage } = args;
  if (ziel.version !== auftrag.expectedVersion)
    throw Object.assign(new Error("Die Vorlage wurde geändert. Vorschau erneut erstellen."), {
      code: "KO_STALE",
    });
  const k = kontrollAnschluss(u, ablage, args.jetzt);
  const abhaengigkeiten = new Map<string, unknown>();
  const weitergabeGeprueft = new Set<string>();
  // Lesen allein erlaubt noch keine Vervielfältigung in einen breiteren Zielartikel. Auch
  // frühere Quellen/Eingaben in der Korrekturhistorie müssen zum Ziel-Leserkreis passen.
  async function pruefeWeitergabe(dp: Datenpunkt, tiefe = 0): Promise<void> {
    const key = `${dp.id}@${dp.fassung}`;
    if (weitergabeGeprueft.has(key)) return;
    if (tiefe > 8 || weitergabeGeprueft.size >= 80)
      throw new DatenFehler("ungueltig", "Zu umfangreiche Herkunft für die Weitergabe.");
    weitergabeGeprueft.add(key);
    for (const id of new Set([dp.heimatKoId, ...(dp.quelle ? [dp.quelle.koId] : [])])) {
      const q = await u.artikel(id);
      if (!q) throw new DatenFehler("kein_zugriff", "Datenpunkt nicht verfügbar.");
      if (!gleicherLeserkreis(ziel, q))
        throw new DatenFehler(
          "ungueltig",
          "Der Leserkreis der Herkunft passt nicht zum Zielartikel. Keine Weitergabe erfolgt.",
        );
      abhaengigkeiten.set(`quelle:${id}`, [
        q.version,
        q.confidentiality,
        q.spaceId,
        q.author,
        q.quellrechte,
      ]);
    }
    for (const c of dp.korrekturen) {
      const alt = inFassung(dp, c.fassung - 1);
      if (alt) await pruefeWeitergabe(alt, tiefe);
    }
    for (const e of dp.rechenweg?.eingaben ?? []) {
      const aktuell = await ablage.lesen(e.datenpunktId);
      const alt = aktuell ? inFassung(aktuell, e.fassung) : undefined;
      if (!alt) throw new DatenFehler("kein_zugriff", "Eingabe nicht verfügbar.");
      await pruefeWeitergabe(alt, tiefe + 1);
    }
  }
  let budget = 80;
  let selbstQuelle = false;
  async function belege(dp: Datenpunkt, tiefe = 0): Promise<string[]> {
    if (tiefe > 8 || --budget < 0)
      throw new DatenFehler("ungueltig", "Zu umfangreiche Herkunft für diesen Folienaufbau.");
    const s = await sicht(dp, u);
    if (!s) throw new DatenFehler("kein_zugriff", "Datenpunkt nicht verfügbar.");
    const kontrolliert = await k.kontrolliert(dp, s);
    const kontrolle = kontrolliert.kontrolle;
    if (!kontrolle) throw new DatenFehler("ungueltig", "Die Datenkontrolle fehlt.");
    await pruefeWeitergabe(dp);
    if (dp.quelle?.koId === ziel.id) selbstQuelle = true;
    const { gepruefAm: _zeit, ...stabil } = kontrolle;
    abhaengigkeiten.set(`${dp.id}@${dp.fassung}`, [dp, stabil]);
    const lines = [
      `${dp.id} · Datenfassung ${dp.fassung}: ${dp.wert}`,
      `Herkunft: ${dp.erfassung}; ${dp.einheit ?? dp.waehrung ?? "Einheit offen"}; ${dp.zeitraum ?? "Zeitraum offen"}; Bezug: ${dp.bezugsgroesse ?? "offen"}`,
      quellbeleg(s),
      `Prüfstand der Ausgangsfassung vor Übernahme: ${kontrolle.zustandName}. ${kontrolle.grund}`,
      ...kontrolle.dimensionen.map(
        (d) =>
          `${d.name}: ${d.standName}. ${d.grund}${d.pruefung ? ` (${d.pruefung.von}, ${d.pruefung.am})` : ""}`,
      ),
      ...(dp.annahmen?.map((a) => `Annahme: ${a}`) ?? []),
      ...(dp.modellbezug ? [`Modell: ${dp.modellbezug}`] : []),
      ...(dp.erfassung === "prognose" ? ["Prognose: kein beobachteter Ist-Wert"] : []),
      ...dp.korrekturen.map(
        (c) =>
          `Korrektur ${c.fassung}: ${c.grund} (${c.von}, ${c.am}); ${JSON.stringify(c.vorher)}`,
      ),
    ];
    if (dp.rechenweg) {
      lines.push(
        `Rechenweg: ${dp.rechenweg.formel}; Rundung ${dp.rechenweg.stellen} Stellen; ungerundet ${dp.rechenweg.roh}; Ergebnis ${dp.rechenweg.ergebnis}`,
      );
      for (const e of dp.rechenweg.eingaben) {
        const aktuell = await ablage.lesen(e.datenpunktId);
        const eingabe = aktuell ? inFassung(aktuell, e.fassung) : undefined;
        if (!eingabe) throw new DatenFehler("kein_zugriff", "Eingabe nicht verfügbar.");
        lines.push(
          `Eingabe ${e.datenpunktId}, Fassung ${e.fassung}, Wert ${e.wert}:`,
          ...(await belege(eingabe, tiefe + 1)),
        );
      }
    }
    return lines;
  }
  const fakten: AufbauFakt[] = [];
  for (const ref of auftrag.datenpunkte) {
    const dp = await ablage.lesen(ref.id);
    if (!dp || !(await sicht(dp, u)))
      throw new DatenFehler("kein_zugriff", "Datenpunkt nicht verfügbar.");
    if (dp.fassung !== ref.fassung)
      throw Object.assign(new Error("Daten wurden geändert. Vorschau erneut erstellen."), {
        code: "KO_STALE",
      });
    selbstQuelle = false;
    const lines = await belege(dp);
    if (selbstQuelle)
      lines.unshift(
        "Überprüfung nach Übernahme nötig: Der Zielartikel ist zugleich Quelle. Die Übernahme erzeugt eine neue Quellfassung. Die folgenden Prüfungen belegen nur die genannte Ausgangsfassung.",
      );
    if (
      dp.wert.length > 80 ||
      (dp.bezugsgroesse?.length ?? 0) > 80 ||
      (dp.zeitraum?.length ?? 0) > 60
    )
      throw new DatenFehler(
        "ungueltig",
        "Für diese Folienvorlage Wert und Bezugsrahmen kürzer fassen; es wird nichts abgeschnitten.",
      );
    const s = await sicht(dp, u);
    const kontrolle = s ? (await k.kontrolliert(dp, s)).kontrolle : undefined;
    fakten.push({
      id: dp.id,
      fassung: dp.fassung,
      label: dp.bezugsgroesse ?? "Aussage",
      wert: dp.wert,
      ...(dp.zahl !== undefined ? { zahl: dp.zahl } : {}),
      einheit: dp.einheit ?? dp.waehrung ?? "offen",
      ...(dp.waehrung ? { waehrung: dp.waehrung } : {}),
      prognose: dp.erfassung === "prognose",
      zeitraum: dp.zeitraum ?? "offen",
      zustand: selbstQuelle
        ? "Überprüfung nach Übernahme nötig"
        : (kontrolle?.zustandName ?? "Prüfung offen"),
      belege: lines,
    });
  }
  let diagramm: AufbauPlan["diagramm"] = null;
  const hinweise = [
    "Die bestehende Präsentation bleibt erhalten. Neue Folien werden angefügt. Rücknahme über den Fassungsverlauf.",
    "Die Ausgabe ist eine Momentaufnahme. Externe Empfänger erhalten keine Klarwerkrechte; interne Quellen können für sie unzugänglich sein.",
  ];
  if (auftrag.diagramm) {
    const n = fakten[0];
    const vergleichbar =
      n &&
      fakten.length > 1 &&
      fakten.every(
        (f) =>
          f.zahl !== undefined &&
          Number.isFinite(f.zahl) &&
          f.einheit !== "offen" &&
          f.zeitraum !== "offen" &&
          f.einheit === n.einheit &&
          f.waehrung === n.waehrung &&
          f.zeitraum === n.zeitraum,
      ) &&
      (!n.einheit.includes("%") || fakten.every((f) => f.label === n.label));
    if (vergleichbar && n) {
      const zahlen = fakten.map((f) => f.zahl as number);
      const minimum = Math.min(0, ...zahlen);
      const maximum = Math.max(0, ...zahlen);
      diagramm = {
        minimum,
        maximum: maximum === minimum ? maximum + 1 : maximum,
        einheit: n.einheit,
      };
      hinweise.push(
        "Säulenskala enthält Null und alle Werte. Einheit und Zeitraum sind gleich. Die Vergleichbarkeit der Definitionen bleibt fachlich zu prüfen.",
      );
    } else
      hinweise.push(
        "Kein Diagramm: Zahlen, Einheiten, Zeiträume oder Prozentbezüge sind nicht vergleichbar. Die Tabelle zeigt die Angaben unverändert.",
      );
  }
  const plan = {
    vertrag: "klara-pp05-v1" as const,
    basis: {
      koId: ziel.id,
      anhangId: args.anhangId,
      artikelFassung: ziel.version,
      dateiFassung: args.dateiFassung,
    },
    auftrag,
    fakten,
    diagramm,
    hinweise,
  };
  const planId = createHash("sha256")
    .update(JSON.stringify([plan, [...abhaengigkeiten]]))
    .digest("hex");
  return { ...plan, planId, kontrolliertAm: new Date(args.jetzt()).toISOString() };
}
