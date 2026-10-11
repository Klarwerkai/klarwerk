// ================================================================================================
// Aufnahme gesamt-wissen-herkunft · Entscheidungen 18/19 und 27 (Peter, 11.10.2026).
// ================================================================================================
//
// Die reinen Prüfregeln der beiden Wege, auf denen ein Wissensobjekt OHNE Vier-Augen-Prüfung
// gültig wird. Sie stehen hier, in der Kompositionswurzel, weil sie Konto (Befugnis,
// Zuständigkeit), Wissensobjekt und Konflikte zusammen lesen — kein Fachmodul kennt alle drei.
// Die Route (`routes/ko-routes.ts`, Aktionen `weisung`, `weisung-sichten`, `externe-freigabe`)
// ruft sie; geschrieben wird ausschließlich über `ValidationService` bzw. `KoService`.
//
//   Entscheidung 18 · Weisungsbefugnis ausdrücklich am Konto, mit fachlichem Bereich; technische
//                     Administration genügt nicht → `befugnisDecktBereich` (services/auth).
//   Entscheidung 19 · unmittelbar gültig, nachfolgend zuständig gesichtet → Verantwortliche und
//                     Frist sind PFLICHT beim Setzen; sichten darf nur die benannte Person.
//   R-0573          · vorher jeden betroffenen bestehenden Punkt einzeln sehen und je Punkt
//                     entscheiden → offene Konflikte müssen entschieden ODER ausdrücklich als
//                     „bleibt bestehen" benannt sein; überstimmt wird nur über die
//                     Konfliktentscheidung (geschlossen, nicht gelöscht).
//   Entscheidung 27 · externe Freigabe und Herkunft übernehmen, interne Geltung und Zuständigkeit
//                     bestätigen, keine pauschale zweite Inhaltsprüfung → `externeFreigabeEingabe`.

export type Ergebnis<T> = { ok: true; wert: T } | { ok: false; fehler: string };

const TEXT_MAX = 200;
const NACHWEIS_MAX = 2000;
const VERMERK_MAX = 2000;
const TAG_MS = 86_400_000;

function text(wert: unknown, max = TEXT_MAX): string | undefined {
  if (typeof wert !== "string") {
    return undefined;
  }
  const t = wert.trim();
  return t.length > 0 && t.length <= max ? t : undefined;
}

/** Ein Datum `JJJJ-MM-TT` oder ein vollständiger ISO-Zeitpunkt; sonst `undefined`. */
function zeitpunkt(wert: unknown): { roh: string; ms: number; nurTag: boolean } | undefined {
  if (typeof wert !== "string") {
    return undefined;
  }
  const roh = wert.trim();
  const nurTag = /^\d{4}-\d{2}-\d{2}$/.test(roh);
  if (!nurTag && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(roh)) {
    return undefined;
  }
  const ms = Date.parse(roh);
  return Number.isNaN(ms) ? undefined : { roh, ms, nurTag };
}

// ------------------------------------------------------------------------------------------------
// Entscheidungen 18/19 — die Weisung
// ------------------------------------------------------------------------------------------------

export interface WeisungsEingabe {
  sichtung: { verantwortlich: string; frist: string };
  bestehenLassen: string[];
}

/**
 * Die FORM der Weisung. Verantwortliche und Frist der Sichtung sind Pflicht (Entscheidung 19);
 * die verantwortliche Person darf nicht die weisende selbst sein — eine Sichtung durch sich selbst
 * wäre keine. Die Frist muss in der Zukunft liegen (ein Tag zählt bis zu seinem Ende).
 */
export function weisungEingabe(
  body: { sichtung?: unknown; bestehenLassen?: unknown },
  weisend: string,
  jetzt: number,
): Ergebnis<WeisungsEingabe> {
  const roh = body.sichtung;
  if (typeof roh !== "object" || roh === null || Array.isArray(roh)) {
    return {
      ok: false,
      fehler:
        "Für eine Weisung sind die verantwortliche Person und die Frist der Sichtung Pflicht.",
    };
  }
  const { verantwortlich, frist } = roh as { verantwortlich?: unknown; frist?: unknown };
  const wer = text(verantwortlich);
  if (!wer) {
    return { ok: false, fehler: "Die für die Sichtung verantwortliche Person fehlt." };
  }
  if (wer === weisend) {
    return {
      ok: false,
      fehler: "Die Sichtung muss eine andere Person übernehmen als die, die die Weisung erteilt.",
    };
  }
  const bis = zeitpunkt(frist);
  if (!bis) {
    return { ok: false, fehler: "Die Frist der Sichtung ist kein gültiges Datum." };
  }
  if (bis.ms + (bis.nurTag ? TAG_MS : 0) <= jetzt) {
    return { ok: false, fehler: "Die Frist der Sichtung muss in der Zukunft liegen." };
  }
  const liste = body.bestehenLassen ?? [];
  if (!Array.isArray(liste) || liste.some((k) => typeof k !== "string" || k.length === 0)) {
    return { ok: false, fehler: "bestehenLassen muss eine Liste von Konfliktkennungen sein." };
  }
  return {
    ok: true,
    wert: {
      sichtung: { verantwortlich: wer, frist: bis.roh },
      bestehenLassen: [...new Set(liste as string[])],
    },
  };
}

/** Ein offener Konflikt, an dem das Objekt beteiligt ist — wie ihn die Route vorlegt. */
export interface BetroffenerPunkt {
  conflictId: string;
  koId: string;
  titel: string;
}

/**
 * R-0573 — JEDER BETROFFENE PUNKT EINZELN. Offene Konflikte dieses Objekts, deren Gegenseite die
 * weisende Person sehen darf, müssen in `bestehenLassen` benannt sein; sonst wird nicht gewiesen,
 * und die Antwort legt jeden noch offenen Punkt einzeln vor. Ist eine Gegenseite für sie NICHT
 * sichtbar, kann sie über diesen Punkt nicht entscheiden — dann wird ebenfalls nicht gewiesen
 * (fail-closed), ohne die verborgene Gegenseite zu nennen.
 */
export function offenePunkte(
  betroffen: readonly (BetroffenerPunkt & { sichtbar: boolean })[],
  bestehenLassen: readonly string[],
): { verborgen: number; offen: BetroffenerPunkt[] } {
  const benannt = new Set(bestehenLassen);
  return {
    verborgen: betroffen.filter((p) => !p.sichtbar).length,
    offen: betroffen
      .filter((p) => p.sichtbar && !benannt.has(p.conflictId))
      .map(({ conflictId, koId, titel }) => ({ conflictId, koId, titel })),
  };
}

export function sichtungsVermerk(wert: unknown): Ergebnis<string | undefined> {
  if (wert === undefined || wert === null) {
    return { ok: true, wert: undefined };
  }
  if (typeof wert !== "string" || wert.length > VERMERK_MAX) {
    return { ok: false, fehler: "Der Vermerk zur Sichtung ist zu lang oder kein Text." };
  }
  return { ok: true, wert: wert.trim() || undefined };
}

// ------------------------------------------------------------------------------------------------
// Entscheidung 27 — die externe Freigabe
// ------------------------------------------------------------------------------------------------

export interface ExterneFreigabeEingabe {
  art: "wissen" | "referenz";
  herausgeber: string;
  freigabeKennung?: string;
  freigegebenAm: string;
  freigegebenVon?: string;
  nachweis?: string;
  zustaendig: string;
}

/**
 * Die FORM der Übernahme. Pflicht sind Art, Herausgeber, Datum der externen Freigabe, die intern
 * zuständige Person und die AUSDRÜCKLICHE Bestätigung der internen Anwendbarkeit
 * (`anwendbarBestaetigt: true`) — genau diese Bestätigung ersetzt die zweite Inhaltsprüfung, sie
 * darf deshalb nicht stillschweigend unterstellt werden. Ein Nachweis ist eine http(s)-Adresse.
 */
export function externeFreigabeEingabe(
  roh: unknown,
  jetzt: number,
): Ergebnis<ExterneFreigabeEingabe> {
  if (typeof roh !== "object" || roh === null || Array.isArray(roh)) {
    return { ok: false, fehler: "Die Angaben zur externen Freigabe fehlen." };
  }
  const e = roh as Record<string, unknown>;
  const art = e.art;
  if (art !== "wissen" && art !== "referenz") {
    return { ok: false, fehler: "art muss „wissen“ oder „referenz“ sein." };
  }
  if (e.anwendbarBestaetigt !== true) {
    return {
      ok: false,
      fehler:
        "Die interne Anwendbarkeit (Geltung und Zuständigkeit) muss ausdrücklich bestätigt sein.",
    };
  }
  const herausgeber = text(e.herausgeber);
  if (!herausgeber) {
    return { ok: false, fehler: "Wer extern freigegeben hat (Herausgeber), fehlt." };
  }
  const am = zeitpunkt(e.freigegebenAm);
  if (!am) {
    return { ok: false, fehler: "Das Datum der externen Freigabe ist kein gültiges Datum." };
  }
  if (am.ms > jetzt + TAG_MS) {
    return { ok: false, fehler: "Die externe Freigabe kann nicht in der Zukunft liegen." };
  }
  const zustaendig = text(e.zustaendig);
  if (!zustaendig) {
    return { ok: false, fehler: "Die intern zuständige Person fehlt." };
  }
  const freiwillig = (feld: unknown, max = TEXT_MAX): Ergebnis<string | undefined> => {
    if (feld === undefined || feld === null || feld === "") {
      return { ok: true, wert: undefined };
    }
    const t = text(feld, max);
    if (!t) {
      return { ok: false, fehler: "Eine Angabe ist zu lang oder kein Text." };
    }
    return { ok: true, wert: t };
  };
  const kennung = freiwillig(e.freigabeKennung);
  const von = freiwillig(e.freigegebenVon);
  const nachweis = freiwillig(e.nachweis, NACHWEIS_MAX);
  for (const teil of [kennung, von, nachweis]) {
    if (!teil.ok) {
      return teil;
    }
  }
  if (nachweis.ok && nachweis.wert !== undefined) {
    let adresse: URL | undefined;
    try {
      adresse = new URL(nachweis.wert);
    } catch {
      adresse = undefined;
    }
    if (!adresse || (adresse.protocol !== "https:" && adresse.protocol !== "http:")) {
      return { ok: false, fehler: "Der Nachweis muss eine http(s)-Adresse sein." };
    }
  }
  return {
    ok: true,
    wert: {
      art,
      herausgeber,
      freigegebenAm: am.roh,
      zustaendig,
      ...(kennung.ok && kennung.wert ? { freigabeKennung: kennung.wert } : {}),
      ...(von.ok && von.wert ? { freigegebenVon: von.wert } : {}),
      ...(nachweis.ok && nachweis.wert ? { nachweis: nachweis.wert } : {}),
    },
  };
}
