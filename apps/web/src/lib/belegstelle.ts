// ================================================================================================
// Aufnahme 20260922 · antwort-quellenanzeige (R-0326) — DIE BELEGSTELLE EINES ZITATS.
// ================================================================================================
//
// „Ein Zitat merkt sich, an welcher Stelle im Quelldokument die tragende Passage steht. Ein Klick
// auf das Zitat springt an genau diese Stelle und hebt sie hervor."
//
// DATENMODELL (Entscheidung dieses Auftrags): die Stelle ist ein TEXTANKER, keine Zeichenzahl.
//   · Objekt   — die Kennung des Wissensobjekts (Pfad `/wissen/:id`).
//   · Fassung  — die Inhaltsversion, an der die Passage gilt (`fassung`), sofern bekannt.
//   · Passage  — der wörtliche Text der tragenden Stelle (`stelle`); bei einer Antwort ist das die
//                Aussage, die der Server als `steps[].snippet` der Quelle führt.
// Aufgelöst wird die Position BEIM ÖFFNEN, im gezeichneten Text genau dieser Fassung. Warum kein
// Zeichenversatz: der Lesetext entsteht aus bereinigtem HTML (`SanitizedHtml`), seine Zeichen-
// positionen sind keine stabile Größe über Bereinigung und Darstellung hinweg; ein wörtlicher
// Anker ist es (dieselbe Bauform wie ein Textzitat-Selektor). Steht die Passage in dieser Fassung
// nicht im Text, oder ist die Fassung eine andere, sagt die Fläche das — sie markiert NICHTS, was
// sie nicht wörtlich gefunden hat.
//
// Der Anker reist in der Adresse (`?stelle=…&fassung=…`): so tragen ihn der Quellenchip der
// Fragenseite und der Quellenlink im Word-Panel gleich, ohne neue Route und ohne neuen Abruf.

export const STELLE_PARAM = "stelle";
export const FASSUNG_PARAM = "fassung";

/** Längste Passage, die als Anker in die Adresse reist — längere werden nicht abgeschnitten. */
export const STELLE_MAX = 600;

export interface Belegstelle {
  passage: string;
  /** Inhaltsversion des Objekts, an der die Passage gilt — `null`, wenn sie nicht bekannt ist. */
  fassung: number | null;
}

/** Leerraum zusammenfassen: der Anker gilt unabhängig von Zeilenumbrüchen und Mehrfachleerzeichen. */
export function passageNormal(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Wörtliches Klara-Zitat als Fragment: Es erreicht weder HTTP-Zugriffslog noch Referrer. */
export function zitatFragment(text: string): string {
  const stelle = passageNormal(text);
  return stelle && stelle.length <= STELLE_MAX ? `#${new URLSearchParams({ zitat: stelle })}` : "";
}

export function zitatAusFragment(hash: string): string {
  const werte = new URLSearchParams(hash.slice(1)).getAll("zitat");
  const zitat = werte.length === 1 ? passageNormal(werte[0] ?? "") : "";
  return zitat.length <= STELLE_MAX ? zitat : "";
}

/**
 * Die Adresse des Objekts samt Belegstelle. Ohne verwertbare Passage (leer oder länger als
 * `STELLE_MAX`) bleibt es die blosse Objektadresse — ein abgeschnittener Anker fände nichts
 * Wörtliches und wäre eine Scheingenauigkeit.
 */
export function belegstelleHref(koId: string, stelle: Belegstelle | null): string {
  const pfad = `/wissen/${encodeURIComponent(koId)}`;
  const passage = stelle ? passageNormal(stelle.passage) : "";
  if (!stelle || passage.length === 0 || passage.length > STELLE_MAX) {
    return pfad;
  }
  const p = new URLSearchParams();
  p.set(STELLE_PARAM, passage);
  if (stelle.fassung !== null && Number.isInteger(stelle.fassung) && stelle.fassung > 0) {
    p.set(FASSUNG_PARAM, String(stelle.fassung));
  }
  return `${pfad}?${p.toString()}`;
}

/** Die Belegstelle aus der Adresse — `null`, wenn keine (verwertbare) dasteht. */
export function belegstelleAusAdresse(params: URLSearchParams): Belegstelle | null {
  const passage = passageNormal(params.get(STELLE_PARAM) ?? "");
  if (passage.length === 0 || passage.length > STELLE_MAX) {
    return null;
  }
  const roh = params.get(FASSUNG_PARAM);
  const zahl = roh !== null && /^\d+$/.test(roh) ? Number(roh) : null;
  return { passage, fassung: zahl !== null && zahl > 0 ? zahl : null };
}

/** Wo die Passage im Text eines Knotens beginnt und endet — je Textknoten und Versatz. */
export interface Fundstelle {
  start: { knoten: Text; versatz: number };
  ende: { knoten: Text; versatz: number };
}

/**
 * Sucht die Passage wörtlich (Leerraum zusammengefasst, Gross-/Kleinschreibung GENAU) im Text unter
 * `wurzel`. Liefert die erste Fundstelle oder `null`. Nichts wird geraten: kein Teiltreffer, keine
 * Ähnlichkeit.
 */
export function findePassage(wurzel: Node, passage: string): Fundstelle | null {
  return fundstellen(wurzel, passage, false)[0] ?? null;
}

/** Der Originalkörper ist maßgeblich. Oft wiederholt die Kernaussage denselben ganzen Text. */
export function eindeutigeZitatstelle(
  koerper: Node,
  aussage: Node,
  zitat: string,
): Fundstelle | null {
  const imKoerper = fundstellen(koerper, zitat, true);
  const treffer = imKoerper.length ? imKoerper : fundstellen(aussage, zitat, true);
  return treffer.length === 1 ? (treffer[0] ?? null) : null;
}

const TEXTBLOCK = "p,li,dt,dd,h1,h2,h3,h4,h5,h6,td,th,blockquote,pre,div,figcaption";
const WORTZEICHEN = /[\p{L}\p{M}\p{N}_]/u;

function lesetext(wurzel: Node, mitBlockgrenzen: boolean) {
  const doc = wurzel.ownerDocument ?? (wurzel as Document);
  const gang = doc.createTreeWalker(
    wurzel,
    mitBlockgrenzen ? 5 : 4 /* SHOW_TEXT [+ SHOW_ELEMENT] */,
  );
  // Der normalisierte Gesamttext und je Zeichen seine Herkunft (Knoten, Versatz).
  let normal = "";
  const herkunft: Array<Fundstelle["start"] | undefined> = [];
  let letztesLeer = true;
  let letzterBlock: Element | null = null;
  for (let n = gang.nextNode(); n !== null; n = gang.nextNode()) {
    if (n.nodeType === 1) {
      if (n.nodeName === "BR" && !letztesLeer) {
        normal += " ";
        herkunft.push(undefined);
        letztesLeer = true;
      }
      continue;
    }
    const knoten = n as Text;
    if (mitBlockgrenzen) {
      const block = knoten.parentElement?.closest(TEXTBLOCK) ?? null;
      if (normal && block !== letzterBlock) {
        // Ein Zitat darf nicht durch das Zusammenkleben verschiedener Absätze entstehen.
        normal += "\n";
        herkunft.push(undefined);
        letztesLeer = true;
      }
      letzterBlock = block;
    }
    const text = knoten.data;
    for (let i = 0; i < text.length; i += 1) {
      const zeichen = text[i] ?? "";
      if (/\s/.test(zeichen)) {
        if (letztesLeer) {
          continue;
        }
        normal += " ";
        letztesLeer = true;
      } else {
        normal += zeichen;
        letztesLeer = false;
      }
      herkunft.push({ knoten, versatz: i });
    }
  }
  return { normal, herkunft };
}

function fundstellen(wurzel: Node, passage: string, zitat: boolean): Fundstelle[] {
  const ziel = passageNormal(passage);
  if (!ziel) return [];
  const { normal, herkunft } = lesetext(wurzel, zitat);
  const funde: Fundstelle[] = [];
  for (let beginn = normal.indexOf(ziel); beginn >= 0; beginn = normal.indexOf(ziel, beginn + 1)) {
    const ende = beginn + ziel.length;
    const erstes = herkunft[beginn];
    const letztes = herkunft[ende - 1];
    if (!erstes || !letztes) continue;
    if (zitat && WORTZEICHEN.test(ziel.charAt(0)) && WORTZEICHEN.test(normal.charAt(beginn - 1)))
      continue;
    if (
      zitat &&
      WORTZEICHEN.test(ziel.charAt(ziel.length - 1)) &&
      WORTZEICHEN.test(normal.charAt(ende))
    )
      continue;
    funde.push({ start: erstes, ende: { knoten: letztes.knoten, versatz: letztes.versatz + 1 } });
    if (!zitat || funde.length === 2) break;
  }
  return funde;
}

/**
 * Hebt die Fundstelle hervor: je berührtem Textknoten wird genau der getroffene Teil in ein
 * `<mark data-bib-belegstelle>` gelegt (über Elementgrenzen hinweg, ohne die Struktur zu brechen).
 * Liefert die gesetzten Marken in Lesereihenfolge.
 */
export function markiereFundstelle(wurzel: Node, fund: Fundstelle): HTMLElement[] {
  const doc = wurzel.ownerDocument ?? (wurzel as Document);
  const gang = doc.createTreeWalker(wurzel, 4 /* NodeFilter.SHOW_TEXT */);
  const knoten: Text[] = [];
  let drin = false;
  for (let n = gang.nextNode(); n !== null; n = gang.nextNode()) {
    if (n === fund.start.knoten) {
      drin = true;
    }
    if (drin) {
      knoten.push(n as Text);
    }
    if (n === fund.ende.knoten) {
      break;
    }
  }
  const marken: HTMLElement[] = [];
  for (const k of knoten) {
    const von = k === fund.start.knoten ? fund.start.versatz : 0;
    const bis = k === fund.ende.knoten ? fund.ende.versatz : k.data.length;
    if (bis <= von) {
      continue;
    }
    const mitte = von > 0 ? k.splitText(von) : k;
    if (bis - von < mitte.data.length) {
      mitte.splitText(bis - von);
    }
    const mark = doc.createElement("mark");
    mark.setAttribute("data-bib-belegstelle", "");
    mitte.parentNode?.insertBefore(mark, mitte);
    mark.appendChild(mitte);
    marken.push(mark);
  }
  return marken;
}
