// PP-06: passende bereits erfasste Daten finden und über PP-02/03 sowie W10 verwenden.
// Kein eigener Datenbestand, keine Recherche, keine fachliche Freigabe durch Vergleichbarkeit.
import { createHash } from "node:crypto";
import type { KnowledgeObject } from "../../knowledge-object";
import type { Nachbearbeitungsauftrag } from "./office-nachbearbeitung";
import {
  DatenFehler,
  type DatenUmgebung,
  type Datenpunkt,
  type DatenpunktSicht,
  type Ort,
  leseOrt,
  sicht,
} from "./praesentation-daten";
import type { DatenpunktAblage } from "./praesentation-daten-ablage";
import { type KontrollierteSicht, kontrollAnschluss } from "./praesentation-pruefung-anschluss";
import { schutzrang } from "./sichtbarkeit";

export interface Datenluecke {
  readonly zeitraum: string;
  readonly einheit: string;
  readonly waehrung: string;
  readonly bezugsgroesse: string;
  readonly verwendung: "beobachtet" | "prognose";
}

export interface ErgaenzungsSuche {
  readonly ort: Ort;
  readonly luecke: Datenluecke;
  readonly quellArtikelIds: readonly string[];
}

export interface ErgaenzungsKandidat {
  readonly datenpunkt: KontrollierteSicht;
  readonly passend: boolean;
  readonly gruende: readonly string[];
  readonly neu: string;
  readonly token: string;
}

export interface ErgaenzungsVorschau {
  readonly offen: boolean;
  readonly gruende: readonly string[];
  readonly alt: string;
  readonly zielFassung: number;
  readonly dateiFassung: string;
  readonly kandidaten: readonly ErgaenzungsKandidat[];
}

function text(roh: unknown, max: number): string {
  if (roh === undefined) return "";
  if (typeof roh !== "string" || roh.length > max) {
    throw new DatenFehler("ungueltig", `Text bis ${max} Zeichen erwartet.`);
  }
  return roh.trim();
}

export function leseErgaenzungsSuche(roh: unknown): ErgaenzungsSuche {
  if (!roh || typeof roh !== "object" || Array.isArray(roh)) {
    throw new DatenFehler("ungueltig", "Die Datenlücke fehlt.");
  }
  const r = roh as Record<string, unknown>;
  const ort = leseOrt(r.ort);
  const l = r.luecke as Record<string, unknown> | undefined;
  if (!ort || !l || typeof l !== "object" || Array.isArray(l)) {
    throw new DatenFehler("ungueltig", "Folienelement und Datenlücke fehlen.");
  }
  if (l.verwendung !== "beobachtet" && l.verwendung !== "prognose") {
    throw new DatenFehler("ungueltig", "Beobachteten Vergleichswert oder Prognose wählen.");
  }
  if (!Array.isArray(r.quellArtikelIds) || r.quellArtikelIds.length > 10) {
    throw new DatenFehler("ungueltig", "Höchstens zehn vorhandene Quellartikel wählen.");
  }
  const ids = r.quellArtikelIds.map((id) => text(id, 200));
  if (ids.some((id) => !id)) throw new DatenFehler("ungueltig", "Quellartikel fehlt.");
  return {
    ort,
    luecke: {
      zeitraum: text(l.zeitraum, 100),
      einheit: text(l.einheit, 100),
      waehrung: text(l.waehrung, 20),
      bezugsgroesse: text(l.bezugsgroesse, 200),
      verwendung: l.verwendung,
    },
    quellArtikelIds: [...new Set(ids)],
  };
}

// Nur Leerraum vereinheitlichen. Keine vermutete Perioden-, Skalen-, Währungs- oder Nennerumrechnung.
const normal = (s: string | undefined) => (s ?? "").normalize("NFC").replace(/\s+/g, " ").trim();

function rahmenGruende(l: Datenluecke, dp: Datenpunkt): string[] {
  const gruende: string[] = [];
  for (const [feld, name] of [
    ["zeitraum", "Zeitraum"],
    ["einheit", "Einheit"],
    ["waehrung", "Währung"],
    ["bezugsgroesse", "Bezugsgröße"],
  ] as const) {
    if (normal(l[feld]) !== normal(dp[feld])) {
      gruende.push(
        `${name} passt nicht: erwartet „${l[feld] || "nicht zutreffend"}“, Quelle „${dp[feld] || "offen"}“.`,
      );
    }
  }
  if (dp.art !== "zahl" || dp.zahl === undefined) gruende.push("Kein numerischer Vergleichswert.");
  return gruende;
}

// Eine sichtbare Quelle darf durch das Einfügen keinen weiteren Leserkreis erhalten.
// Konservativ: Space, Quellleser und Autor-Ausnahme über die gesamte Herkunftskette erhalten.
async function verwendbarIn(
  dp: Datenpunkt,
  ziel: KnowledgeObject,
  u: DatenUmgebung,
  besucht = new Set<string>(),
): Promise<boolean> {
  if (besucht.has(dp.id)) return true;
  if (besucht.size >= 100) return false;
  besucht.add(dp.id);
  const quellen = new Set([dp.heimatKoId]);
  const eingaben = new Set<string>();
  for (const inhalt of [dp, ...dp.korrekturen.map((k) => k.vorher)]) {
    const q = inhalt.quelle as Datenpunkt["quelle"];
    if (q) quellen.add(q.koId);
    const rw = inhalt.rechenweg as Datenpunkt["rechenweg"];
    for (const e of rw?.eingaben ?? []) eingaben.add(e.datenpunktId);
  }
  for (const id of quellen) {
    const q = await u.artikel(id);
    if (!q) return false;
    if (q.spaceId && q.spaceId !== ziel.spaceId) return false;
    if (schutzrang(q.confidentiality) > schutzrang(ziel.confidentiality)) return false;
    if (schutzrang(q.confidentiality) > 0 && q.author !== ziel.author) return false;
    const quellLeser = q.quellrechte?.leser;
    if (quellLeser) {
      const leser = ziel.quellrechte?.leser;
      if (!leser || leser.some((id) => !quellLeser.includes(id))) return false;
    }
  }
  for (const id of eingaben) {
    const e = await u.datenpunkt(id);
    if (!e || !(await verwendbarIn(e, ziel, u, besucht))) return false;
  }
  return true;
}

function hatPrognose(s: DatenpunktSicht): boolean {
  return (
    s.erfassung === "prognose" ||
    !!s.rechenweg?.eingaben.some((e) => e.lesbar && hatPrognose(e.datenpunkt))
  );
}

export async function ergaenzungsVorschau(
  koId: string,
  suche: ErgaenzungsSuche,
  u: DatenUmgebung,
  ablage: DatenpunktAblage,
  jetzt: () => number = Date.now,
): Promise<ErgaenzungsVorschau> {
  const ziel = await u.artikel(koId);
  const folien = await u.folien(koId, suche.ort.anhangId);
  if (!ziel || !folien) throw new DatenFehler("kein_zugriff", "Präsentation nicht verfügbar.");
  const folie = folien.satz.folien.find((f) => f.sldId === suche.ort.sldId);
  const element = folie?.elemente.find((e) => e.shapeId === suche.ort.shapeId);
  if (!element || element.art !== "text" || !element.text.trim() || element.text.length > 2000) {
    throw new DatenFehler(
      "ungueltig",
      "Ein lesbares Textfeld als Platzhalter wählen (höchstens 2000 Zeichen).",
    );
  }
  const gruende: string[] = [];
  if (!suche.luecke.zeitraum) gruende.push("Bezugszeitraum der Lücke ist offen.");
  if (!suche.luecke.einheit && !suche.luecke.waehrung)
    gruende.push("Einheit oder Währung der Lücke ist offen.");
  if (!suche.luecke.bezugsgroesse)
    gruende.push("Bezugsgröße der Lücke ist offen (bei Prozentwerten einschließlich Nenner).");
  const kandidaten: ErgaenzungsKandidat[] = [];
  const kontroll = kontrollAnschluss(u, ablage, jetzt);
  for (const id of new Set([koId, ...suche.quellArtikelIds])) {
    if (!(await u.artikel(id))) continue;
    for (const dp of await ablage.vonArtikel(id)) {
      if (kandidaten.length >= 200)
        throw new DatenFehler(
          "ungueltig",
          "Quellenauswahl eingrenzen: mehr als 200 lesbare Datenpunkte.",
        );
      const s = await sicht(dp, u);
      if (!s) continue;
      const kontrolliert = await kontroll.kontrolliert(dp, s);
      const g = [...gruende, ...rahmenGruende(suche.luecke, dp)];
      const prognose = hatPrognose(kontrolliert);
      if (prognose && suche.luecke.verwendung !== "prognose")
        g.push("Prognose ist kein beobachteter Vergleichswert.");
      if (!prognose && suche.luecke.verwendung === "prognose")
        g.push("Beobachteter Wert ersetzt keine ausdrücklich bestellte Prognose.");
      if (prognose && (!s.annahmen.length || !s.modellbezug))
        g.push("Prognose braucht ausdrückliche Annahmen und einen Modellbezug.");
      if (
        ["klaerung", "ueberpruefung_noetig"].includes(
          kontrolliert.kontrolle?.zustand ?? kontrolliert.pruefstand.zustand,
        )
      )
        g.push("Offene Klärung oder überholte Prüfung zuerst an der Herkunft bearbeiten.");
      if (!(await verwendbarIn(dp, ziel, u)))
        g.push("Quellenrechte lassen die Übernahme in diesen Artikel nicht zu.");
      const wertMitRahmen = `${dp.wert} · ${[dp.einheit, dp.waehrung, dp.zeitraum, dp.bezugsgroesse].filter(Boolean).join(" · ")}`;
      const neu = prognose
        ? `Prognose: ${wertMitRahmen} · Annahmen: ${s.annahmen.join("; ")} · Modell: ${s.modellbezug ?? "offen"}`
        : wertMitRahmen;
      if (neu.length > 2000) g.push("Ergänzung ist zu lang für diesen Textweg.");
      if (normal(element.text) === normal(neu))
        g.push("Der Wert steht bereits am Ziel; keine Datenlücke ersetzt.");
      const token = createHash("sha256")
        .update(
          JSON.stringify([
            ziel.version,
            ziel.spaceId,
            ziel.confidentiality,
            ziel.quellrechte,
            folien.satz.fassung,
            suche,
            element.text,
            dp.id,
            dp.stand,
            dp.fassung,
            neu,
          ]),
        )
        .digest("hex");
      kandidaten.push({
        datenpunkt: kontrolliert,
        passend: g.length === 0,
        gruende: g,
        neu,
        token,
      });
    }
  }
  if (!kandidaten.some((k) => k.passend))
    gruende.push("Keine passende zugängliche Angabe gefunden. Die Lücke bleibt offen.");
  return {
    offen: !kandidaten.some((k) => k.passend),
    gruende,
    alt: element.text,
    zielFassung: ziel.version,
    dateiFassung: folien.satz.fassung,
    kandidaten,
  };
}

export function ergaenzungsAuftrag(
  v: ErgaenzungsVorschau,
  k: ErgaenzungsKandidat,
  suche: ErgaenzungsSuche,
  laufId: string,
): Nachbearbeitungsauftrag {
  return {
    laufId,
    basisFassung: v.zielFassung,
    schritte: [
      {
        id: "pp06",
        art: "text",
        folieId: Number(suche.ort.sldId),
        alt: v.alt,
        neu: k.neu,
        herkunft: { art: "nutzerauftrag", quelle: "PP-06: bewusste Übernahme der Ergänzung" },
        zahlenbeleg: {
          quelle: `Datenpunkt ${k.datenpunkt.id}, Fassung ${k.datenpunkt.fassung}`,
          stelle: JSON.stringify(k.datenpunkt.fundstelle).slice(0, 500),
          werte: [k.neu],
        },
      },
    ],
    sprechernotizen: [],
    folgeprodukte: { handout: false, sprechernotizen: false },
  };
}
