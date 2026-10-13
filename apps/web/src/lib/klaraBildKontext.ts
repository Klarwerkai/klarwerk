// ================================================================================================
// OCR-03 · ERKANNTES AUS BILDERN IN KLARAS KONTEXT (Auftrag
// produkt:20261012:klara-bildanalyse-ocr-kontext-setup, Integrationsplan §2).
// ================================================================================================
//
// Die Befunde des automatischen Bildlesens (OCR-02, `lib/bildAutomatik.ts`) und der übrige Text
// derselben Quelle werden EIN Kontext für Klara: Fragen und Zusammenfassungen stützen sich auf
// beides, und jedes Bild steht mit seiner Fundstelle (Quelle · Folie/Bild) darin.
//
// DIESE DATEI IST DOM-FREI. Texte und Fundstellen-Namen kommen als Funktionen herein (`t`, `ortVon`).
//
// WAS SIE ZUSAGT:
//   · Nur Befunde der AKTUELLEN Quelle kommen in den Kontext. Wird `aktuell` übergeben, zählt nur ein
//     Befund, dessen Fundstelle (Quelle, Position, Anker) zu einem Bild dieses Eingangs gehört —
//     Ergebnisse einer anderen Quelle oder eines überholten Laufs fallen heraus.
//   · Laufende, fehlgeschlagene und nicht gelesene Bilder stehen als solche im Kontext, nie als Text.
//     Ist eine Quelle nicht vollständig gelesen, sagt die Anweisung an Klara das ausdrücklich, und die
//     Oberfläche zeigt es neben der Antwort.
//   · Unsichere Stellen bleiben gekennzeichnet (`[?wort]`, `[unleserlich]`); nichts wird ergänzt.
//   · Die Fundstellen einer Frage werden zusätzlich DETERMINISTISCH bestimmt (`belegstellen`) — sie
//     hängen nicht davon ab, ob ein Modell sie nennt.
//   · Gelesen wird nur: weder Bild noch Dokument noch Befund werden verändert.

import {
  BILD_HOECHSTZAHL_JE_QUELLE,
  type BildBefund,
  type BildFundstelle,
  type BildQuelleEingang,
  type QuellenBefund,
  type QuellenHinweis,
} from "./bildAutomatik";

export type Uebersetze = (schluessel: string, werte?: Record<string, string | number>) => string;
export type OrtVon = (fundstelle: BildFundstelle, quelle: string) => string;

export interface BildKontextEintrag {
  quelle: string;
  /** Die Fundstelle im Wortlaut der Oberfläche, z. B. „Folie 2, Bild 1“. */
  ort: string;
  fundstelle: BildFundstelle;
  /** Erkannter Text mit gekennzeichneten unsicheren Stellen; leer, wenn keiner vorliegt. */
  text: string;
  /** Beschriebener Bildinhalt (W02); leer, wenn er fehlt. */
  bildinhalt: string;
  /** Text gelesen (auch „kein Text“) — das Bild ist für Klara ausgewertet. */
  textGelesen: boolean;
  /** Läuft oder wartet noch. */
  laeuft: boolean;
  status: BildBefund["status"];
  /** OCR-E02: der Bildtext ist eine Berichtigung (sie hat Vorrang vor jeder anderen Lesung). */
  berichtigt?: boolean;
}

export interface KlaraBildKontext {
  /** Der Text, den Klara bekommt: Dokumenttext, dann der Abschnitt mit den Bildbefunden. */
  kontext: string;
  eintraege: BildKontextEintrag[];
  /** Alle Bilder der Quellen, einschließlich nicht übernommener. */
  gesamt: number;
  /** Bilder mit gelesenem Text. */
  gelesen: number;
  /** Bilder ohne gelesenen Text (läuft, fehlgeschlagen, nicht gelesen, nicht übernommen). */
  offen: number;
  laeuft: boolean;
  /** Nur wenn JEDE Quelle „vollständig“ gelesen ist. */
  vollstaendig: boolean;
}

const HINWEIS_SCHLUESSEL: Record<QuellenHinweis, string> = {
  "pptx-layout-nicht-erfasst": "bildautomatik.hinweis.pptxLayout",
  "grenze-erreicht": "bildautomatik.hinweis.grenze",
  ladefrist: "bildautomatik.hinweis.ladefrist",
  "einstellung-unbekannt": "klarabildkontext.hinweis.einstellungUnbekannt",
};

const STATUS_SCHLUESSEL: Record<BildBefund["status"], string> = {
  wartet: "bildautomatik.status.wartet",
  laeuft: "bildautomatik.status.laeuft",
  gelesen: "bildautomatik.status.gelesen",
  "kein-text": "bildautomatik.status.keinText",
  fehlgeschlagen: "bildautomatik.status.fehlgeschlagen",
  "nicht-verfuegbar": "bildautomatik.status.nichtVerfuegbar",
  "kein-zugriff": "bildautomatik.status.keinZugriff",
  zeitueberschreitung: "bildautomatik.status.zeitueberschreitung",
  "nicht-analysiert": "bildautomatik.status.nichtAnalysiert",
};

/** Gehört dieser Befund zu einem Bild des aktuellen Eingangs (Quelle, Position, Anker)? */
function gehoertZu(b: BildBefund, aktuell: readonly BildQuelleEingang[]): boolean {
  return aktuell.some(
    (e) =>
      e.quelle === b.fundstelle.quelle &&
      e.vorkommen.some(
        (v) =>
          v.fundstelle.bild === b.fundstelle.bild &&
          (v.fundstelle.imageId ?? "") === (b.fundstelle.imageId ?? "") &&
          v.fundstelle.folie === b.fundstelle.folie,
      ),
  );
}

/**
 * Baut Klaras Kontext aus dem Dokumenttext und den Befunden der Quelle(n). `aktuell` (optional) ist
 * der Eingang, aus dem die Befunde stammen MÜSSEN — alles andere bleibt draußen.
 */
export function klaraBildKontext(
  dokumentText: string,
  quellen: readonly QuellenBefund[],
  t: Uebersetze,
  ortVon: OrtVon,
  aktuell?: readonly BildQuelleEingang[],
): KlaraBildKontext {
  const eintraege: BildKontextEintrag[] = [];
  const zeilen: string[] = [];
  let verloren = 0;
  let vollstaendig = true;
  for (const q of quellen) {
    if (aktuell && !aktuell.some((e) => e.quelle === q.quelle)) {
      continue;
    }
    if (q.status !== "vollstaendig" && q.status !== "ohne-bilder") {
      vollstaendig = false;
    }
    for (const b of q.befunde) {
      if (b.fundstelle.quelle !== q.quelle || (aktuell && !gehoertZu(b, aktuell))) {
        continue;
      }
      const ort = ortVon(b.fundstelle, q.quelle);
      const marke = `[${q.quelle} · ${ort}]`;
      const textGelesen = b.status === "gelesen" || b.status === "kein-text";
      const bildinhalt = b.bildinhalt.status === "beschrieben" ? b.bildinhalt.text.trim() : "";
      const text = b.status === "gelesen" ? b.textGekennzeichnet.trim() : "";
      eintraege.push({
        quelle: q.quelle,
        ort,
        fundstelle: b.fundstelle,
        text,
        bildinhalt,
        textGelesen,
        laeuft: b.status === "laeuft" || b.status === "wartet",
        status: b.status,
        ...(b.korrektur ? { berichtigt: true } : {}),
      });
      if (text) {
        // OCR-E02: ein berichtigter Bildtext steht als solcher da (der Rohbefund geht nicht ein).
        const art = b.korrektur
          ? "bildfundstelle.kontext.textBerichtigt"
          : "klarabildkontext.kontext.text";
        zeilen.push(`${marke} ${t(art)}: ${text}`);
      } else if (b.status === "kein-text") {
        zeilen.push(`${marke} ${t("klarabildkontext.kontext.keinText")}`);
      } else {
        const status = t(STATUS_SCHLUESSEL[b.status]);
        zeilen.push(`${marke} ${t("klarabildkontext.kontext.offen", { status })}`);
      }
      if (bildinhalt) {
        // Nacharbeit 4: eine nicht eindeutig angeglichene Beschreibung steht als Stand VOR der
        // Berichtigung da — maßgeblich ist der berichtigte Bildtext.
        const inhalt = b.korrektur?.beschreibungNichtAngeglichen
          ? "bildfundstelle.kontext.inhaltVorBerichtigung"
          : "klarabildkontext.kontext.inhalt";
        zeilen.push(`${marke} ${t(inhalt)}: ${bildinhalt}`);
      }
    }
    for (const x of q.nichtGelesen) {
      verloren += x.anzahl;
      const wo =
        x.folie !== undefined
          ? `${q.quelle} · ${t("klarabildkontext.kontext.folie", { folie: x.folie })}`
          : q.quelle;
      const satz = t("klarabildkontext.kontext.nichtUebernommen", { anzahl: x.anzahl });
      zeilen.push(`[${wo}] ${satz}`);
    }
    for (const h of q.hinweise) {
      zeilen.push(`[${q.quelle}] ${t(HINWEIS_SCHLUESSEL[h], { max: BILD_HOECHSTZAHL_JE_QUELLE })}`);
    }
  }
  const gelesen = eintraege.filter((e) => e.textGelesen).length;
  const gesamt = eintraege.length + verloren;
  const teile = [dokumentText.trim()];
  if (zeilen.length > 0) {
    teile.push([t("klarabildkontext.kontext.kopf"), ...zeilen].join("\n"));
  }
  return {
    kontext: teile.filter((x) => x.length > 0).join("\n\n"),
    eintraege,
    gesamt,
    gelesen,
    offen: gesamt - gelesen,
    laeuft: eintraege.some((e) => e.laeuft),
    vollstaendig: vollstaendig && gesamt === gelesen,
  };
}

export type KlaraAuftrag = "frage" | "zusammenfassung";

/** Die Anweisung an Klara — mit Fundstellenpflicht und, wenn nötig, dem Unvollständig-Hinweis. */
export function klaraAnweisung(
  auftrag: KlaraAuftrag,
  frage: string,
  k: KlaraBildKontext,
  t: Uebersetze,
): string {
  const beispiel = k.eintraege[0] ? `${k.eintraege[0].quelle} · ${k.eintraege[0].ort}` : "";
  const teile = [
    auftrag === "frage"
      ? t("klarabildkontext.anweisung.frage", { frage: frage.trim() })
      : t("klarabildkontext.anweisung.zusammenfassung"),
    t("klarabildkontext.anweisung.fundstellen", { beispiel }),
  ];
  // OCR-E02 (Nacharbeit 3): für berichtigte Bilder gilt allein der berichtigte Bildtext — keine davon
  // abweichende Lesung (etwa aus einer früheren Bildbeschreibung) wiedergeben.
  if (k.eintraege.some((e) => e.berichtigt)) {
    teile.push(t("bildfundstelle.anweisung.berichtigt"));
  }
  if (k.laeuft) {
    teile.push(t("klarabildkontext.anweisung.laeuft"));
  }
  if (!k.vollstaendig) {
    teile.push(
      t("klarabildkontext.anweisung.unvollstaendig", { offen: k.offen, gesamt: k.gesamt }),
    );
  }
  return teile.join(" ");
}

// ------------------------------------------------------------------------------------------------
// Fundstellen einer Frage — deterministisch, ohne Modell
// ------------------------------------------------------------------------------------------------

export interface Belegstelle {
  art: "bild" | "dokument";
  quelle: string;
  /** Fundstelle im Wortlaut der Oberfläche; bei `dokument` leer. */
  ort: string;
  auszug: string;
  treffer: number;
}

/** Füllwörter, die keine Stelle auszeichnen (DE/EN/NL, klein geschrieben). */
const FUELLWOERTER = new Set([
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "ein",
  "eine",
  "einer",
  "und",
  "oder",
  "ist",
  "sind",
  "was",
  "wie",
  "wo",
  "wer",
  "welche",
  "welcher",
  "welches",
  "steht",
  "stehen",
  "auf",
  "mit",
  "von",
  "für",
  "bild",
  "bilder",
  "bildern",
  "folie",
  "seite",
  "the",
  "and",
  "what",
  "which",
  "are",
  "image",
  "slide",
  "page",
  "het",
  "een",
  "wat",
  "welke",
  "staat",
  "afbeelding",
  "dia",
]);

/** Wörter samt Zahlen mit Komma, Punkt oder Bindestrich im Inneren („4,5“, „V-3“). */
const WORT_RE = /[\p{L}\p{N}][\p{L}\p{N},.-]*[\p{L}\p{N}]|[\p{L}\p{N}]/gu;

export function frageBegriffe(frage: string): string[] {
  const woerter = frage.toLowerCase().match(WORT_RE);
  const begriffe = new Set<string>();
  for (const w of woerter ?? []) {
    if (w.length >= 3 && !FUELLWOERTER.has(w)) {
      begriffe.add(w);
    }
  }
  return [...begriffe];
}

function trefferIn(text: string, begriffe: readonly string[]): number {
  const klein = text.toLowerCase();
  return begriffe.filter((b) => klein.includes(b)).length;
}

const AUSZUG_MAX = 280;

function auszug(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > AUSZUG_MAX ? `${t.slice(0, AUSZUG_MAX - 1)}…` : t;
}

/**
 * Die Stellen im Dokumenttext und in den gelesenen Bildern, die die Begriffe der Frage tragen —
 * die besten zuerst, höchstens `max`. Bilder nennen ihre Fundstelle.
 */
export function belegstellen(
  frage: string,
  dokumentText: string,
  k: KlaraBildKontext,
  max = 3,
): Belegstelle[] {
  const begriffe = frageBegriffe(frage);
  if (begriffe.length === 0) {
    return [];
  }
  const kandidaten: Belegstelle[] = [];
  for (const e of k.eintraege) {
    const text = [e.text, e.bildinhalt].filter((x) => x.length > 0).join(" — ");
    const treffer = text ? trefferIn(text, begriffe) : 0;
    if (treffer > 0) {
      kandidaten.push({ art: "bild", quelle: e.quelle, ort: e.ort, auszug: auszug(text), treffer });
    }
  }
  // Absätze bzw. Sätze — der Klartext eines Editors ist eine einzige Zeile.
  for (const absatz of dokumentText.split(/\n+|(?<=[.!?])\s+/)) {
    const treffer = absatz.trim() ? trefferIn(absatz, begriffe) : 0;
    if (treffer > 0) {
      kandidaten.push({ art: "dokument", quelle: "", ort: "", auszug: auszug(absatz), treffer });
    }
  }
  // Stabil nach Trefferzahl: bei Gleichstand bleibt die Reihenfolge (Bilder vor Dokumenttext).
  return kandidaten
    .map((b, i) => ({ b, i }))
    .sort((x, y) => y.b.treffer - x.b.treffer || x.i - y.i)
    .slice(0, max)
    .map((x) => x.b);
}

/** Die Bilder, deren Text bzw. Inhalt in den Kontext eingegangen ist (für die Zusammenfassung). */
export function beruecksichtigteBilder(k: KlaraBildKontext): BildKontextEintrag[] {
  return k.eintraege.filter((e) => e.text.length > 0 || e.bildinhalt.length > 0);
}
