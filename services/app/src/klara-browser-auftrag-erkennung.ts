// ================================================================================================
// produkt:20261011:assistenz-browser-aktionen (BPA-03) — WAS DIE PERSON AUF DER SEITE BEAUFTRAGT.
// ================================================================================================
//
// Klara 05 erkennt Aufträge über FESTE SATZFORMEN, ohne Sprachmodell (`apps/web/src/lib/
// klaraAuftragErkennung.ts`), getippt wie gesprochen gleich. Dasselbe hier für eine Browserseite —
// mit einem Unterschied, der die Sicherheit trägt: die Wörter, nach denen gesucht wird, kommen aus
// dem SEITENPROFIL des Adapters (Formularnamen, Feldbeschriftungen, Knöpfe), nie aus der Seite.
// Seitentext kann damit weder ein Feld noch einen Knopf in den Auftrag schieben (G07).
//
// DIE SATZFORM: „Fülle den Angebotsentwurf aus: Betreff „Angebot Kühlanlage", Empfänger
// einkauf@kunde.invalid, Nachricht „…" und speichere ihn als Entwurf." Eine Beschriftung leitet
// ihren Wert ein; der Wert reicht bis zur nächsten Beschriftung, bis zum Befehlsteil („und
// speichere …") oder ist in Anführungszeichen eingeschlossen. Gesprochen fehlen die Anführungs-
// zeichen meist — dann trennen die Beschriftungen selbst.
//
// NICHT RATEN: Ein mehrfach genanntes Feld, ein fehlender Wert, ein unklares Formular oder ein
// Auftrag ohne erkennbare Handlung wird eine Klärung, bevor auf der Seite irgendetwas geschieht.
// Ein endgültiges Auslösen steht nur im Auftrag, wenn die Person den Knopf des Profils mit allen
// seinen Wörtern nennt; ein anderes Außenwort (senden, bestellen, kaufen …) ohne passenden
// freigegebenen Knopf macht den GANZEN Auftrag zur Übergabe — kein halber Auftrag ohne den Teil,
// den die Person ausdrücklich wollte.
import type { BrowserFeldwert, BrowserSeitenprofil } from "./klara-browser-aktion";

export const BROWSER_WORTLAUT_MAX = 2000;

export type BrowserErkennung =
  | {
      readonly ok: true;
      readonly formular: string;
      readonly felder: readonly BrowserFeldwert[];
      readonly speichern: boolean;
      readonly ausloesen: string | null;
    }
  | { readonly ok: false; readonly art: "klaerung"; readonly text: string }
  /** Eine Außenhandlung, die das Profil hier nicht freigibt: `was` in Worten der Person. */
  | { readonly ok: false; readonly art: "gesperrt"; readonly was: string };

const ANFUEHRUNG: readonly (readonly [string, string])[] = [
  ["„", "“"],
  ["„", '"'],
  ["“", "”"],
  ['"', '"'],
  ["»", "«"],
  ["«", "»"],
  ["‚", "‘"],
];

/** Wörter, die eine Wirkung nach außen meinen — gesperrt, solange kein Profilknopf sie trägt. */
const AUSSENWORT =
  /(^|[^\p{L}\p{N}])((ab|ver|weiter|zu)?(send|schick)\w*|bestell\w*|kauf\w*|bezahl\w*|zahl(e|en|t)\b|buch(e|en|t)\b|kündig\w*|unterschreib\w*|unterzeichn\w*|akzeptier\w*|zustimm\w*|veröffentlich\w*|lösch\w*)/iu;
const SPEICHERWORT = /(^|[^\p{L}\p{N}])(speicher\w*|sicher(e|n|t)\b|als entwurf)/iu;
/**
 * Wo ein ungeklammerter Wert endet: am Befehlsteil, der nach ihm kommt — „und speichere …",
 * „und dann endgültig senden", „speichere ihn …". Zwischen Bindewort und Befehlswort dürfen
 * Füllwörter stehen.
 */
const BEFEHLSANFANG =
  /[,;]?\s+(und|dann|danach|anschließend)(\s+(dann|danach|anschließend|bitte|noch|gleich|sofort|direkt|endgültig|ihn|es|sie|den|das|die|entwurf|nachricht|formular))*\s+(speicher|sicher|send|schick|bestell|kauf|bezahl|lösch|klick|drück|lös|auslös)\w*|[,;]?\s+(speicher|sicher)\w*\s+(ihn|es|sie|den|das|die|als)\b/iu;

function grenze(muster: string): RegExp {
  const sicher = muster.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${sicher})(?=$|[^\\p{L}\\p{N}])`, "giu");
}

interface Bereich {
  readonly von: number;
  readonly bis: number;
}

interface Zitat extends Bereich {
  /** Der Text zwischen den Anführungszeichen. */
  readonly innen: string;
}

/**
 * Bereiche in Anführungszeichen — Beschriftungen und Befehlswörter darin zählen nicht. Öffnet ein
 * Zeichen mehrere Paare („ schliesst mit “ oder mit "), gilt das NÄCHSTE schliessende Zeichen.
 */
function zitate(text: string): Zitat[] {
  const bereiche: Zitat[] = [];
  let i = 0;
  while (i < text.length) {
    const passend = ANFUEHRUNG.filter(([auf]) => text.startsWith(auf, i))
      .map(([auf, zu]) => ({ auf, zu, ende: text.indexOf(zu, i + auf.length) }))
      .filter((p) => p.ende > i)
      .sort((a, b) => a.ende - b.ende);
    const p = passend[0];
    if (p) {
      bereiche.push({
        von: i,
        bis: p.ende + p.zu.length,
        innen: text.slice(i + p.auf.length, p.ende),
      });
      i = p.ende + p.zu.length;
      continue;
    }
    i++;
  }
  return bereiche;
}

function inZitat(bereiche: readonly Bereich[], pos: number): boolean {
  return bereiche.some((b) => pos >= b.von && pos < b.bis);
}

/** Alle Fundstellen eines Wortes ausserhalb von Zitaten. */
function fundstellen(text: string, wort: string, bereiche: readonly Bereich[]): Bereich[] {
  const treffer: Bereich[] = [];
  for (const m of text.matchAll(grenze(wort))) {
    const von = (m.index ?? 0) + (m[1]?.length ?? 0);
    if (!inZitat(bereiche, von)) {
      treffer.push({ von, bis: von + (m[2]?.length ?? 0) });
    }
  }
  return treffer;
}

function ohneBereiche(text: string, weg: readonly Bereich[]): string {
  let rest = "";
  let pos = 0;
  for (const b of [...weg].sort((a, c) => a.von - c.von)) {
    rest += `${text.slice(pos, b.von)} `;
    pos = Math.max(pos, b.bis);
  }
  return rest + text.slice(pos);
}

const liste = (namen: readonly string[]) => namen.map((n) => `„${n}"`).join(" oder ");

/**
 * Erkennt Formular, Felder mit Werten, Speichern und ein ausdrücklich genanntes Auslösen — allein
 * aus den Worten der Person und dem Profil der Seite.
 */
export function erkenneBrowserAuftrag(
  wortlaut: string,
  profil: BrowserSeitenprofil,
): BrowserErkennung {
  const text = wortlaut.replace(/\s+/g, " ").trim();
  if (!text) {
    return { ok: false, art: "klaerung", text: "Was soll Klara auf dieser Seite tun?" };
  }
  const zit = zitate(text);
  // 1 · DAS FORMULAR: genannt — oder das einzige, in das Klara schreiben darf.
  const schreibbar = profil.formulare.filter((f) =>
    f.handlungen.some((h) => h.art === "entwurf_fuellen"),
  );
  const genannt = profil.formulare.filter((f) => fundstellen(text, f.name, zit).length > 0);
  const formular =
    genannt.length === 1
      ? genannt[0]
      : genannt.length === 0 && schreibbar.length === 1
        ? schreibbar[0]
        : undefined;
  if (!formular) {
    const namen = (genannt.length > 1 ? genannt : schreibbar).map((f) => f.name);
    return {
      ok: false,
      art: "klaerung",
      text:
        namen.length > 0
          ? `Welches Formular ist gemeint: ${liste(namen)}? Nenne es im Auftrag.`
          : "Auf dieser Seite gibt es kein Formular, in das Klara schreiben darf.",
    };
  }
  // 2 · DIE FELDER: jede Beschriftung höchstens einmal, ihr Wert bis zur nächsten.
  const marken: { label: string; stelle: Bereich }[] = [];
  for (const label of formular.felder) {
    const stellen = fundstellen(text, label, zit);
    if (stellen.length > 1) {
      return {
        ok: false,
        art: "klaerung",
        text: `„${label}" steht mehrfach im Auftrag. Welcher Wert ist gemeint? Setze ihn in Anführungszeichen.`,
      };
    }
    const stelle = stellen[0];
    if (stelle) {
      marken.push({ label, stelle });
    }
  }
  marken.sort((a, b) => a.stelle.von - b.stelle.von);
  const felder: BrowserFeldwert[] = [];
  const wertbereiche: Bereich[] = [];
  for (const [i, m] of marken.entries()) {
    const ende = marken[i + 1]?.stelle.von ?? text.length;
    let von = m.stelle.bis;
    const vorspann = /^\s*(:|=|–|-)?\s*((mit|auf|als|lautet|ist)\s+)?/iu.exec(
      text.slice(von, ende),
    );
    von += vorspann?.[0].length ?? 0;
    const zitat = zit.find((z) => z.von === von && z.bis <= ende);
    let wert: string;
    let bis: number;
    if (zitat) {
      wert = zitat.innen;
      bis = zitat.bis;
    } else {
      const abschnitt = text.slice(von, ende);
      const befehl = BEFEHLSANFANG.exec(abschnitt);
      const roh = befehl ? abschnitt.slice(0, befehl.index) : abschnitt;
      wert = roh
        .replace(/[\s,;]+(und)?\s*$/iu, "")
        .replace(/[.!]\s*$/u, "")
        .trim();
      bis = von + roh.length;
      // Steht in einem ungeklammerten Wert noch ein Befehls- oder Außenwort, ist offen, ob es zum
      // Wert gehört oder ein Auftrag ist. Nicht raten: weder still einen Auftrag schlucken noch
      // ihn in ein Feld schreiben.
      const fraglich = AUSSENWORT.exec(wert) ?? SPEICHERWORT.exec(wert);
      if (fraglich) {
        return {
          ok: false,
          art: "klaerung",
          text: `Gehört „${fraglich[2]}" zum Wert von „${m.label}" oder ist es ein Auftrag? Setze den Wert in Anführungszeichen.`,
        };
      }
    }
    if (!wert.trim()) {
      return {
        ok: false,
        art: "klaerung",
        text: `Für „${m.label}" fehlt der Wert. Nenne ihn direkt nach der Beschriftung.`,
      };
    }
    felder.push({ label: m.label, wert });
    wertbereiche.push({ von: m.stelle.von, bis });
  }
  // 3 · DIE HANDLUNGEN stehen im Befehlsteil — nie in einem Wert.
  const befehlsteil = ohneBereiche(text, wertbereiche);
  const speichern = SPEICHERWORT.test(befehlsteil);
  const ausloeser = formular.handlungen.filter((h) => h.art === "ausloesen" && h.knopf !== null);
  const knopf =
    ausloeser.find((h) => {
      const woerter = (h.knopf ?? "").toLowerCase().split(/\s+/u).filter(Boolean);
      const klein = befehlsteil.toLowerCase();
      return woerter.length > 0 && woerter.every((w) => fundstellen(klein, w, []).length > 0);
    })?.knopf ?? null;
  // Jedes Außenwort muss vom genannten Knopf gedeckt sein („sende" von „Endgültig senden");
  // „und bestelle" daneben bleibt gesperrt, statt still wegzufallen.
  const knopfWoerter = (knopf ?? "").toLowerCase().split(/\s+/u).filter(Boolean);
  const gedeckt = (wort: string) => {
    const stamm = wort.toLowerCase().replace(/^(ab|ver|weiter|zu)(?=send|schick)/u, "");
    return knopfWoerter.some((k) => k.slice(0, 4) === stamm.slice(0, 4));
  };
  const aussen = [...befehlsteil.matchAll(new RegExp(AUSSENWORT.source, "giu"))]
    .map((m) => m[2] ?? "")
    .find((w) => w && !gedeckt(w));
  if (aussen) {
    return { ok: false, art: "gesperrt", was: `„${aussen}"` };
  }
  if (felder.length === 0 && !speichern && knopf === null) {
    return {
      ok: false,
      art: "klaerung",
      text: `Was soll Klara im Formular „${formular.name}" tun? Nenne Felder mit Werten, etwa ${liste(formular.felder.slice(0, 2))}.`,
    };
  }
  return { ok: true, formular: formular.name, felder, speichern, ausloesen: knopf };
}
