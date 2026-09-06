// Reines, DOM-freies, deterministisches Graph-Layout (SCRUM-119 / FR-ANA-03).
// Kreis-Layout (keine Force-Simulation, keine schwere Lib). Gleiche Eingabe →
// gleiche Koordinaten (testbar ohne DOM). Knoten/Kanten kommen aus echten Daten.
import type { Graph, GraphEdge, GraphNode } from "../api/types";

/** Das Rechteck, das eine Beschriftung einnimmt (Koordinaten der viewBox). */
export interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LaidOutNode {
  id: string;
  title: string;
  x: number;
  y: number;
  // UX-07 (JOB 3103): die SICHTBARE Beschriftung ist Teil des Layouts — gekürzt so, dass sie im
  // Bild eindeutig bleibt (siehe `beschriftungen`), samt Anker und Rechteck. Die Zeichnung
  // (GraphView) setzt sie nur noch, sie rechnet nichts mehr.
  label: string;
  labelX: number;
  labelY: number;
  labelAnchor: "start" | "end" | "middle";
  labelBox: LabelBox;
}

export interface LaidOutEdge {
  a: string;
  b: string;
  via: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ConflictPair {
  a: string;
  b: string;
}

export interface LaidOutConflict {
  a: string;
  b: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GraphLayout {
  width: number;
  height: number;
  // Waagerechte Halbachse der Bahn (bei 640×440 der alte Kreisradius 150); die senkrechte Halbachse
  // wächst mit der Knotenzahl, damit die Zeilen einer Seite nicht enger als ZEILE_MIN werden.
  radius: number;
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  positions: Record<string, { x: number; y: number }>;
  // Schriftgrad der Beschriftung — die Zeichnung nimmt ihn von hier, damit Rechteck und Schrift
  // dasselbe Maß haben.
  labelFontSize: number;
}

export interface LayoutOptions {
  width?: number;
  height?: number;
  padding?: number;
}

const DEFAULTS = { width: 640, height: 440, padding: 70 };

// ------------------------------------------------------------------------------------------------
// UX-07 (JOB 3103) — DIE BESCHRIFTUNGEN ÜBERLAPPEN NICHT, UND VERSCHIEDENE NAMEN SEHEN VERSCHIEDEN AUS.
// ------------------------------------------------------------------------------------------------
// Befund N-0011: 28 Knoten auf EINEM Kreis mit Radius 150 lassen zwei Nachbarn 33,6 px Abstand,
// eine Beschriftung von 15 Zeichen bei 9 px ist rund 80 px breit — oben und unten am Kreis, wo die
// Nachbarn fast auf gleicher Höhe liegen, lagen die Schriften übereinander. Die Rechnung hier ist
// bewusst einfach und ohne Kräfte: die Knoten sitzen auf einer Ellipse, aber nicht in gleichen
// WINKELN, sondern in gleichen ZEILEN. Die rechte Hälfte der (nach id sortierten) Knoten läuft von
// oben nach unten die rechte Bahn hinab, die linke Hälfte von unten nach oben die linke hinauf —
// also weiter im Uhrzeigersinn ab oben, wie bisher, und die Tab-Reihenfolge folgt jetzt dem Bild.
// Jede Beschriftung steht waagerecht neben ihrem Knoten und läuft von der Mitte WEG. Damit gilt
// ohne weitere Prüfung: zwei Labels derselben Seite liegen in verschiedenen Zeilen mit Abstand
// ≥ ZEILE_MIN > LABEL_HOEHE, zwei Labels verschiedener Seiten liegen links bzw. rechts der Mitte
// und laufen voneinander weg. Reicht die Höhe für die Zeilen nicht, wächst die Fläche nach unten
// (die Breite bleibt, die Seite scrollt); die Beschriftung darf so breit sein, wie zwischen
// Bahn und Rand Platz ist (`maxBreite`), und wird darüber hinaus EINDEUTIG gekürzt.
const KNOTEN_RADIUS_INTERN = 7;
/** Radius des gezeichneten Knotens — GraphView zeichnet ihn, das Layout hält ihn frei. */
export const KNOTEN_RADIUS = KNOTEN_RADIUS_INTERN;
const LABEL_GRAD = 9;
// Zeilenhöhe bei 9 px: Ober- und Unterlänge zusammen ≈ 1,2 em, aufgerundet.
const LABEL_HOEHE = 11;
// Abstand Knotenmitte → Textanfang: Radius plus 4 px Luft.
const LABEL_VERSATZ = KNOTEN_RADIUS_INTERN + 4;
// Kleinster senkrechter Abstand zweier Knoten einer Seite: mehr als der Knotendurchmesser (14),
// mehr als Zeilenhöhe + Kreisradius/2 — so schneidet auch kein Label den Kreis der Nachbarzeile
// (Rechnung: Kreis y±7, Label y±5,5 → bei 15 bleiben 2,5 px Luft).
const ZEILE_MIN = 15;
// Luft zwischen Beschriftung und Rand der Fläche.
const RAND = 6;
const AUSLASSUNG = "…";

/**
 * Die geschaetzte Breite eines Textes in Pixeln — ohne Messen im Browser (deterministisch,
 * testbar). Runde 2 (BEN): „Name im Kreis" heisst, das ganze Text-Rechteck liegt links, rechts, oben
 * und unten im Kreis-Rechteck. Eine feste Zeichenzahl × 0.6 war dafuer zu grob („Dichtungen" ragte
 * bei r 22 seitlich heraus). Deshalb Zeichenklassen der Schrift (IBM Plex Sans, 600/700):
 * schmal (i l j t f r I . , - ' Leerzeichen) ≈ 0,32 em · breit (m w M W) ≈ 0,9 em · Grossbuchstaben
 * und Ziffern ≈ 0,66 em · sonst ≈ 0,58 em — plus 8 % Sicherheit fuer den fetten Schnitt und die
 * Rundung des Renderers. Kalibriert in Chromium (tests/design/zielbild-wissensnetz.test.ts, N3/R):
 * jeder Name des Bestands liegt mit seinem echten DOMRect im Kreis.
 * Seit UX-07 (JOB 3103) hier statt in pages/Wissensnetz.tsx, unverändert: die Themenkarte und der
 * Wissensgraph (/graph, Schrift 9 px, Schnitt 400) messen mit demselben Maß; für den Graphen
 * prüft tests/wissensgraph-lesbarkeit/graph-treffer-chromium.test.tsx die Schätzung gegen
 * gerenderte Textrechtecke.
 */
const ZEICHEN_SCHMAL = /[iljtfrI.,\-' ]/;
const ZEICHEN_BREIT = /[mwMW]/;
const ZEICHEN_GROSS = /[A-ZÄÖÜ0-9]/;
export function textbreite(text: string, grad: number): number {
  let em = 0;
  for (const z of text) {
    em += ZEICHEN_SCHMAL.test(z)
      ? 0.32
      : ZEICHEN_BREIT.test(z)
        ? 0.9
        : ZEICHEN_GROSS.test(z)
          ? 0.66
          : 0.58;
  }
  return em * grad * 1.08;
}

const passt = (text: string, grad: number, maxBreite: number): boolean =>
  textbreite(text, grad) <= maxBreite;

/**
 * Ein Label aus FENSTERN des Namens: jeder Anker ist eine Stelle, ab der ein Stück des Namens
 * sichtbar ist. Der Kopf (Anker 0) darf leer bleiben, jeder weitere Anker zeigt mindestens ein
 * Zeichen — er steht ja da, weil sich der Name genau dort von einem anderen unterscheidet.
 * Zwischen zwei Fenstern mit Lücke, vor dem ersten (wenn es nicht bei 0 beginnt) und nach dem
 * letzten (wenn es nicht am Ende endet) steht eine Auslassung. Die Fenster wachsen reihum um je
 * ein Zeichen, solange die Zeile passt — so bleibt der Kopf als Zusammenhang stehen UND die
 * Unterscheidungsstellen sind zu sehen (Runde 3, BEN: „…1" gegen „…1" war nicht genug).
 * Deterministisch: gleiche Eingabe, gleiche Fensterlängen.
 */
function zusammensetzen(
  name: string,
  anker: readonly number[],
  laengen: readonly number[],
): string {
  const stuecke: { ab: number; bis: number }[] = [];
  anker.forEach((ab, i) => {
    const laenge = laengen[i] ?? 0;
    if (laenge > 0) {
      stuecke.push({ ab, bis: ab + laenge });
    }
  });
  let out = "";
  let pos = 0;
  stuecke.forEach((s, i) => {
    const luecke = s.ab > pos;
    const naechste = stuecke[i + 1];
    const danachLuecke = naechste ? naechste.ab > s.bis : s.bis < name.length;
    let text = name.slice(s.ab, s.bis);
    // Neben einer Auslassung stehen keine Leerzeichen („Ventil… X" liest sich falsch). Frisst das
    // einen Unterschied („A B" gegen „AB"), rückt `beschriftungen` den Anker zurück, bis er am
    // fertigen Label wieder sichtbar ist — hier wird nichts geschont.
    if (luecke) {
      text = text.trimStart();
    }
    if (danachLuecke) {
      text = text.trimEnd();
    }
    out += `${luecke ? AUSLASSUNG : ""}${text}`;
    pos = s.bis;
  });
  if (pos < name.length || stuecke.length === 0) {
    out += AUSLASSUNG;
  }
  // Ein Fenster, das nur aus Leerzeichen bestand, hinterlässt zwei Auslassungen hintereinander.
  return out.replace(/…{2,}/g, AUSLASSUNG);
}

function rendern(name: string, anker: readonly number[], grad: number, maxBreite: number): string {
  const kappe = anker.map((a, i) => (anker[i + 1] ?? name.length) - a);
  const laengen: number[] = anker.map((_, i) => (i === 0 ? 0 : 1));
  let gewachsen = true;
  while (gewachsen) {
    gewachsen = false;
    for (let i = 0; i < anker.length; i++) {
      if ((laengen[i] ?? 0) < (kappe[i] ?? 0)) {
        laengen[i] = (laengen[i] ?? 0) + 1;
        if (passt(zusammensetzen(name, anker, laengen), grad, maxBreite)) {
          gewachsen = true;
        } else {
          laengen[i] = (laengen[i] ?? 1) - 1;
        }
      }
    }
  }
  return zusammensetzen(name, anker, laengen);
}

/** Länge des längsten gemeinsamen Anfangs aller Namen (ein einzelner Name: 0). */
function gemeinsamerAnfang(namen: readonly string[]): number {
  if (namen.length < 2) {
    return 0;
  }
  const erster = namen[0] ?? "";
  let n = erster.length;
  for (const name of namen) {
    let k = 0;
    while (k < n && k < name.length && name[k] === erster[k]) {
      k++;
    }
    n = k;
  }
  return n;
}

/**
 * DIE BESCHRIFTUNGEN EINES BILDES — eindeutig über alle Labels, nicht nur einzeln gekürzt.
 * Der alte Weg (`title.slice(0, 15) + "…"`, Stufe2.tsx bis JOB 3103) machte aus zwei Titeln mit
 * gleichem Anfang ZWEI GLEICHE Labels — eine Behauptung von Gleichheit, die nicht stimmt. Hier:
 *   1. Jeder Name beginnt vorn (Anker 0) und wird hinten gekürzt, wenn er nicht passt.
 *   2. Sind zwei sichtbare Labels gleich — ALLE Labels zählen, auch ungekürzte volle Titel —,
 *      bekommt jeder veränderbare Name der Gruppe einen Anker an der Stelle, ab der sich die
 *      Gruppe unterscheidet: dort wird ein Fenster sichtbar, der Kopf bleibt stehen. Ein voller
 *      Titel ist nie veränderbar; er ist die Wahrheit, die anderen weichen aus.
 *   3. Das wird gegen sämtliche Labels wiederholt, bis nichts mehr kollidiert oder kein Anker
 *      mehr hinzukommt (jeder Anker ist neu, also endet es). Zwei IDENTISCHE Titel bleiben
 *      ehrlich identisch — sie haben keine Stelle, an der sie sich unterscheiden.
 * Runde 3 (BEN): die Fassung davor verschob den Textanfang und warf den Kopf weg — zwei Familien
 * mit gleicher Endung („Nord … Variante 1", „Sued … Variante 1") wurden beide „…1", und volle
 * Titel nahmen an der Prüfung nicht teil. Beides sind jetzt Fälle in
 * tests/wissensgraph-lesbarkeit/layout-entzerrung.test.ts und graph-lesbarkeit.test.tsx.
 * Dieselbe Zusage gibt die Themenkarte (Wissensnetz.tsx, `beschriftungen`) für zwei Zeilen im
 * Kreis; hier ist es eine Zeile neben dem Knoten, deshalb eine eigene Fassung.
 */
function beschriftungen(titel: readonly string[], grad: number, maxBreite: number): string[] {
  const anker: number[][] = titel.map(() => [0]);
  const label = (i: number): string => rendern(titel[i] ?? "", anker[i] ?? [0], grad, maxBreite);
  let labels = titel.map((_, i) => label(i));
  // Jede Runde setzt mindestens einen neuen Anker (Stellen sind endlich, also endet es);
  // 128 deckt auch Titel, bei denen die Eskalation zeichenweise über ein langes Wort zurückgeht.
  const RUNDEN = 128;
  for (let runde = 0; runde < RUNDEN; runde++) {
    const gruppen = new Map<string, number[]>();
    labels.forEach((l, i) => {
      gruppen.set(l, [...(gruppen.get(l) ?? []), i]);
    });
    let geaendert = false;
    for (const indizes of gruppen.values()) {
      if (indizes.length < 2) {
        continue;
      }
      const stelle = gemeinsamerAnfang(indizes.map((i) => titel[i] ?? ""));
      const setzen = (i: number, a: number): boolean => {
        const meine = anker[i] ?? [0];
        if (a <= 0 || meine.includes(a)) {
          return false;
        }
        meine.push(a);
        meine.sort((x, y) => x - y);
        anker[i] = meine;
        return true;
      };
      // Veränderbar ist, wer nicht seinen vollen Titel zeigt und hinter der Stelle noch Text hat.
      const veraenderlich = indizes.filter(
        (i) => labels[i] !== titel[i] && stelle < (titel[i]?.length ?? 0),
      );
      let frisch = false;
      for (const i of veraenderlich) {
        frisch = setzen(i, stelle) || frisch;
      }
      if (frisch) {
        geaendert = true;
        continue;
      }
      // Runde 4 (BEN): der Anker liegt schon, und die Labels sind TROTZDEM gleich — das
      // Zusammensetzen hat den Unterschied entfernt (ein Leerzeichen neben der Auslassung
      // weggetrimmt: „A B" gegen „AB"; ein originales „…" am Titelende mit der gesetzten
      // Auslassung verschmolzen). Dann rückt das Fenster auf den Anfang des Wortes davor, damit
      // der Unterschied mit Zusammenhang sichtbar wird („…A B" gegen „…AB",
      // „…Einzelheiten…" gegen „…Einzelheiten"). Steht das Fenster schon am Wortanfang, ein
      // Zeichen weiter zurück. Geprüft wird wieder am fertigen Label, nicht am Anker.
      for (const i of veraenderlich) {
        const name = titel[i] ?? "";
        const meine = anker[i] ?? [0];
        // Der Anker dieser Gruppe: der jüngste, der an oder vor der Stelle liegt.
        const alt = Math.max(...meine.filter((a) => a <= stelle));
        let neu = alt;
        while (neu > 0 && !/\s/.test(name[neu - 1] ?? "")) {
          neu--;
        }
        if (neu >= alt || meine.includes(neu)) {
          // Der Wortanfang ist der Anker selbst oder steht schon: zeichenweise weiter zurück,
          // bis eine freie Stelle kommt — jede Runde rückt so mindestens ein Zeichen.
          neu = alt - 1;
          while (neu > 0 && meine.includes(neu)) {
            neu--;
          }
        }
        if (setzen(i, neu)) {
          geaendert = true;
        }
      }
    }
    if (!geaendert) {
      break;
    }
    labels = titel.map((_, i) => label(i));
  }
  return labels;
}

// Deterministische Knotenreihenfolge: stabil nach id sortiert.
function sortedNodes(nodes: readonly GraphNode[]): GraphNode[] {
  return [...nodes].sort((a, b) => a.id.localeCompare(b.id));
}

const rund = (v: number): number => Math.round(v * 100) / 100;

export function layoutGraph(graph: Graph, opts: LayoutOptions = {}): GraphLayout {
  const width = opts.width ?? DEFAULTS.width;
  const grundHoehe = opts.height ?? DEFAULTS.height;
  const padding = opts.padding ?? DEFAULTS.padding;

  const ordered = sortedNodes(graph.nodes);
  const n = ordered.length;
  const rechts = Math.ceil(n / 2);
  const links = n - rechts;
  // Waagerechte Halbachse wie der alte Kreisradius; senkrechte so groß, dass die stärker besetzte
  // Seite ihre Zeilen mit ZEILE_MIN unterbringt. Wächst sie, wächst die Höhe der Fläche mit.
  const radius = Math.max(0, Math.min(width, grundHoehe) / 2 - padding);
  const halbHoehe = Math.max(radius, (Math.max(rechts, links) * ZEILE_MIN) / 2);
  const height = Math.max(grundHoehe, Math.ceil(2 * halbHoehe + 2 * padding));
  const cx = width / 2;
  const cy = height / 2;
  // Was zwischen Bahn und Rand für die Schrift bleibt — darüber wird eindeutig gekürzt.
  const maxBreite = Math.max(0, width / 2 - radius - LABEL_VERSATZ - RAND);
  const labels = beschriftungen(
    ordered.map((nd) => nd.title),
    LABEL_GRAD,
    maxBreite,
  );

  const positions: Record<string, { x: number; y: number }> = {};
  const nodes: LaidOutNode[] = ordered.map((node, i) => {
    const label = labels[i] ?? node.title;
    // Aufgerundet: das Rechteck deckt die Schätzung immer ganz, nie um einen Rundungsrest weniger.
    const w = Math.ceil(textbreite(label, LABEL_GRAD) * 100) / 100;
    if (n <= 1) {
      // Ein einzelner Knoten sitzt mittig, die Beschriftung zentriert darüber — er hat keine Seite.
      positions[node.id] = { x: cx, y: cy };
      return {
        id: node.id,
        title: node.title,
        x: cx,
        y: cy,
        label,
        labelX: cx,
        labelY: cy - 11,
        labelAnchor: "middle",
        labelBox: { x: rund(cx - w / 2), y: cy - 11 - LABEL_GRAD, w, h: LABEL_HOEHE },
      };
    }
    // Zeile `t` in (−1, 1): rechts von oben nach unten, links von unten nach oben — nie genau ±1,
    // damit oben und unten kein Knoten beider Seiten auf denselben Punkt fällt.
    const rechteSeite = i < rechts;
    const t = rechteSeite ? (2 * i + 1) / rechts - 1 : 1 - (2 * (i - rechts) + 1) / links;
    const ausladung = radius * Math.sqrt(Math.max(0, 1 - t * t));
    const x = rund(rechteSeite ? cx + ausladung : cx - ausladung);
    const y = rund(cy + halbHoehe * t);
    positions[node.id] = { x, y };
    const labelX = rund(rechteSeite ? x + LABEL_VERSATZ : x - LABEL_VERSATZ);
    return {
      id: node.id,
      title: node.title,
      x,
      y,
      label,
      labelX,
      labelY: y,
      labelAnchor: rechteSeite ? "start" : "end",
      labelBox: {
        x: rechteSeite ? labelX : rund(labelX - w),
        y: rund(y - LABEL_HOEHE / 2),
        w,
        h: LABEL_HOEHE,
      },
    };
  });

  const edges: LaidOutEdge[] = [];
  for (const e of graph.edges) {
    const pa = positions[e.a];
    const pb = positions[e.b];
    if (pa && pb) {
      edges.push({ a: e.a, b: e.b, via: e.via, x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y });
    }
  }

  return { width, height, radius, nodes, edges, positions, labelFontSize: LABEL_GRAD };
}

// Konfliktkanten auf das Layout abbilden — nur Paare, deren beide Knoten existieren.
export function layoutConflicts(
  pairs: readonly ConflictPair[],
  positions: Record<string, { x: number; y: number }>,
): LaidOutConflict[] {
  const out: LaidOutConflict[] = [];
  for (const p of pairs) {
    const pa = positions[p.a];
    const pb = positions[p.b];
    if (pa && pb) {
      out.push({ a: p.a, b: p.b, x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y });
    }
  }
  return out;
}

// Grad je Knoten (Tag-Kanten), für die ehrliche Anzeige-Begrenzung großer Graphen.
function degrees(graph: Graph): Map<string, number> {
  const deg = new Map<string, number>();
  for (const e of graph.edges) {
    deg.set(e.a, (deg.get(e.a) ?? 0) + 1);
    deg.set(e.b, (deg.get(e.b) ?? 0) + 1);
  }
  return deg;
}

// AUFTRAG-mega68: Stern-Layout der NACHBARSCHAFT eines Objekts — die Mitte sitzt im Zentrum, die
// Nachbarn auf dem Ring. layoutGraph (oben) legt bewusst ALLE Knoten auf den Kreis und kennt keine
// Mitte; statt es mit Sonderfällen zu verbiegen, bekommt die Nachbarschaft ihr eigenes, gleich
// gebautes Layout: DOM-frei, deterministisch, gleiche Eingabe → gleiche Koordinaten. Die
// REIHENFOLGE der ids wird bewusst NICHT umsortiert (anders als sortedNodes oben): der Server
// liefert sie nach Beziehungsstärke, und die Zeichnung soll dieselbe Rangfolge erzählen wie die
// Liste darunter — Platz 1 beginnt oben, dann im Uhrzeigersinn.
export interface NeighborSpot {
  id: string;
  x: number;
  y: number;
  // Anker der Kantenbeschriftung (Mittelpunkt der Kante, leicht über der Linie).
  labelX: number;
  labelY: number;
}

export interface NeighborhoodLayout {
  width: number;
  height: number;
  cx: number;
  cy: number;
  spots: NeighborSpot[];
}

export function layoutNeighborhood(
  ids: readonly string[],
  opts: LayoutOptions = {},
): NeighborhoodLayout {
  const width = opts.width ?? DEFAULTS.width;
  const height = opts.height ?? DEFAULTS.height;
  const padding = opts.padding ?? DEFAULTS.padding;
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.max(0, Math.min(width, height) / 2 - padding);
  const n = ids.length;
  const spots: NeighborSpot[] = ids.map((id, i) => {
    const angle = -Math.PI / 2 + (i / Math.max(n, 1)) * 2 * Math.PI;
    const x = Math.round((cx + radius * Math.cos(angle)) * 100) / 100;
    const y = Math.round((cy + radius * Math.sin(angle)) * 100) / 100;
    return {
      id,
      x,
      y,
      labelX: Math.round(((cx + x) / 2) * 100) / 100,
      labelY: Math.round(((cy + y) / 2 - 4) * 100) / 100,
    };
  });
  return { width, height, cx, cy, spots };
}

// Ehrliche Begrenzung: bei zu vielen Knoten nur die am stärksten verbundenen zeigen
// (keine Fake-Daten — nur Anzeige-Ausschnitt). Kanten zwischen behaltenen Knoten bleiben.
export function limitGraph(graph: Graph, max: number): { graph: Graph; truncated: boolean } {
  if (graph.nodes.length <= max) {
    return { graph, truncated: false };
  }
  const deg = degrees(graph);
  const kept = [...graph.nodes]
    .sort((a, b) => (deg.get(b.id) ?? 0) - (deg.get(a.id) ?? 0) || a.id.localeCompare(b.id))
    .slice(0, max);
  const keptIds = new Set(kept.map((nd) => nd.id));
  const edges: GraphEdge[] = graph.edges.filter((e) => keptIds.has(e.a) && keptIds.has(e.b));
  return { graph: { nodes: kept, edges }, truncated: true };
}
