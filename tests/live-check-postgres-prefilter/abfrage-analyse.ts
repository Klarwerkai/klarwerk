// ================================================================================================
// JOB 3583 · DIE ANALYSE DER ABGESETZTEN ABFRAGE — WAS SIE BEWEIST UND WAS AUSDRÜCKLICH NICHT.
// ================================================================================================
//
// WAS SIE IST: ein STRUKTURWÄCHTER. Sie liest die Zeichenkette, die `PgKoRepo.findCandidates`
// wirklich an den Pool gibt, und sagt, ob deren `ORDER BY` die Term-Trefferzahl VOR der
// Validiert-Stufe führt. Sie beweist damit NICHT, dass Postgres so sortiert — das beweist allein
// der Lauf gegen eine echte Datenbank (`repo-pg-kandidaten.integration.test.ts`). Sie verhindert
// den stillen RÜCKFALL, mehr nicht, und das steht auch im Wächter selbst so.
//
// WARUM SIE NICHT MIT `toContain` ARBEITET (Lehren JOB 3570 R1/R2, JOB 3579 R1): eine
// Zeichenkettensuche zählt einen KOMMENTAR, ein STRINGLITERAL und einen umbenannten ALIAS als
// Erfüllung. Alle drei sind hier ausgeschlossen, und zwar an der Wurzel:
//   · Kommentare (`--`, `/* */`) werden beim Einlesen durch Leerzeichen ERSETZT — sie existieren
//     für jede weitere Frage nicht mehr (die Stellen bleiben erhalten, die Indizes stimmen).
//   · Stringliterale sind maskiert. Ein `$1` oder ein `ILIKE` INNERHALB von Anführungszeichen zählt
//     nirgends mit; ein `ORDER BY 'summe über alle terme' DESC` erfüllt nichts.
//   · Ein Alias wird AUFGELÖST: steht in der Sortierstufe nur ein Bezeichner, wird der Ausdruck aus
//     der SELECT-Liste eingesetzt, an dem er hängt. Ein `0 AS treffer` fällt damit durch, ein
//     ehrlich umbenannter echter Summenausdruck nicht. Der Wächter wird dadurch genauer, nicht
//     milder — die Kalibrierung im Wächter misst beide Richtungen.
//
// DIE FRAGE AN DIE TREFFERSTUFE IST NICHT „steht da eine Summe", sondern die Zusage aus Lieferung 2
// wörtlich: die Trefferzahl entsteht aus GENAU denselben Ausdrücken und GENAU denselben Parametern
// wie die `WHERE`-Bedingung. Deshalb wird gezählt und VERGLICHEN: je Term und je Such-Ausdruck muss
// die Trefferstufe dieselbe Zahl von Vorkommen tragen wie die `WHERE`-Bedingung. Die Such-Ausdrücke
// kommen aus der EINEN Quelle des Produkts (`KO_CANDIDATE_SEARCH_EXPRESSIONS`); hier wird keine
// zweite Liste geführt, die auseinanderlaufen könnte.

/** Ein halboffener Bereich [von, bis) im analysierten Text. */
export interface Bereich {
  readonly von: number;
  readonly bis: number;
}

/**
 * Der eingelesene SQL-Text: Kommentare entfernt, Stringliterale und Klammertiefe je Stelle bekannt.
 * `text`, `klein`, `imLiteral` und `tiefe` sind gleich lang — jede Stelle meint dieselbe Stelle.
 */
export interface Maske {
  readonly text: string;
  readonly klein: string;
  readonly imLiteral: readonly boolean[];
  readonly tiefe: readonly number[];
}

/** Liest den SQL-Text ein: Kommentare raus, Literale und Klammertiefe markiert. */
export function maskiere(sql: string): Maske {
  const zeichen: string[] = [];
  const kleine: string[] = [];
  const imLiteral: boolean[] = [];
  const tiefe: number[] = [];
  let literal = false;
  let ebene = 0;
  let i = 0;
  const nimm = (c: string, inLiteral: boolean): void => {
    zeichen.push(c);
    const kl = c.toLowerCase();
    // Eine Kleinschreibung, die die Länge ändert (z. B. „İ"), würde die Stellen verschieben.
    kleine.push(kl.length === c.length ? kl : c);
    imLiteral.push(inLiteral);
    tiefe.push(ebene);
  };
  while (i < sql.length) {
    const c = sql.charAt(i);
    if (!literal && c === "-" && sql.charAt(i + 1) === "-") {
      while (i < sql.length && sql.charAt(i) !== "\n") {
        nimm(" ", false);
        i += 1;
      }
      continue;
    }
    if (!literal && c === "/" && sql.charAt(i + 1) === "*") {
      const ende = sql.indexOf("*/", i + 2);
      const bis = ende === -1 ? sql.length : ende + 2;
      while (i < bis) {
        nimm(" ", false);
        i += 1;
      }
      continue;
    }
    if (c === "'") {
      if (literal && sql.charAt(i + 1) === "'") {
        // Entwertetes Anführungszeichen INNERHALB eines Literals — es endet nichts.
        nimm("'", true);
        nimm("'", true);
        i += 2;
        continue;
      }
      nimm("'", true);
      literal = !literal;
      i += 1;
      continue;
    }
    if (!literal && c === "(") {
      nimm(c, false);
      ebene += 1;
      i += 1;
      continue;
    }
    if (!literal && c === ")") {
      ebene -= 1;
      // Die schliessende Klammer gehört zur ÄUSSEREN Ebene, wie die öffnende.
      zeichen.push(c);
      kleine.push(c);
      imLiteral.push(false);
      tiefe.push(ebene);
      i += 1;
      continue;
    }
    nimm(c, literal);
    i += 1;
  }
  return { text: zeichen.join(""), klein: kleine.join(""), imLiteral, tiefe };
}

const WORTZEICHEN = /[a-z0-9_$]/i;

function istWort(c: string): boolean {
  return c.length > 0 && WORTZEICHEN.test(c);
}

/**
 * Die Stellen, an denen `nadel` im Bereich steht — NIE innerhalb eines Stringliterals und immer an
 * Wortgrenzen (sonst deckte `$1` das `$10` und `status` das `substatus`).
 */
export function stellen(m: Maske, nadel: string, b: Bereich): number[] {
  const n = nadel.toLowerCase();
  if (n.length === 0) {
    return [];
  }
  const raus: number[] = [];
  let i = m.klein.indexOf(n, b.von);
  while (i !== -1 && i + n.length <= b.bis) {
    const davor = i > 0 ? m.text.charAt(i - 1) : "";
    const danach = m.text.charAt(i + n.length);
    const grenzeVorn = !istWort(n.charAt(0)) || !istWort(davor);
    const grenzeHinten = !istWort(n.charAt(n.length - 1)) || !istWort(danach);
    if (m.imLiteral[i] !== true && grenzeVorn && grenzeHinten) {
      raus.push(i);
    }
    i = m.klein.indexOf(n, i + 1);
  }
  return raus;
}

/** Wie oft steht `nadel` im Bereich (ausserhalb von Literalen)? */
export function zaehle(m: Maske, nadel: string, b: Bereich): number {
  return stellen(m, nadel, b).length;
}

interface Treffer {
  readonly stelle: number;
  readonly laenge: number;
  readonly gruppe: string;
}

/** Regex-Treffer ausserhalb von Literalen, wahlweise auf einer festen Klammertiefe. */
function regexStellen(m: Maske, re: RegExp, b: Bereich, ebene?: number): Treffer[] {
  const raus: Treffer[] = [];
  const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  let treffer = global.exec(m.klein);
  while (treffer !== null) {
    const stelle = treffer.index;
    if (
      stelle >= b.von &&
      stelle + treffer[0].length <= b.bis &&
      m.imLiteral[stelle] !== true &&
      (ebene === undefined || m.tiefe[stelle] === ebene)
    ) {
      raus.push({ stelle, laenge: treffer[0].length, gruppe: treffer[1] ?? "" });
    }
    treffer = global.exec(m.klein);
  }
  return raus;
}

const GANZ = (m: Maske): Bereich => ({ von: 0, bis: m.text.length });

/** Der Text eines Bereichs, ohne Randleerraum. */
export function ausschnitt(m: Maske, b: Bereich): string {
  return m.text.slice(b.von, b.bis).trim();
}

/** Der Bereich der `WHERE`-Bedingung (bis zum `ORDER BY`, sonst bis zum Ende). */
export function whereBereich(m: Maske): Bereich | undefined {
  const wo = regexStellen(m, /\bwhere\b/, GANZ(m), 0);
  const erstes = wo[0];
  if (erstes === undefined) {
    return undefined;
  }
  const ob = orderByStelle(m);
  return { von: erstes.stelle + erstes.laenge, bis: ob ?? m.text.length };
}

function orderByStelle(m: Maske): number | undefined {
  const alle = regexStellen(m, /\border\s+by\b/, GANZ(m), 0);
  return alle[alle.length - 1]?.stelle;
}

/** Der Bereich der `ORDER BY`-Liste (ohne das Schlüsselwort, bis zum `LIMIT`). */
export function orderByBereich(m: Maske): Bereich | undefined {
  const alle = regexStellen(m, /\border\s+by\b/, GANZ(m), 0);
  const letztes = alle[alle.length - 1];
  if (letztes === undefined) {
    return undefined;
  }
  const von = letztes.stelle + letztes.laenge;
  const limit = regexStellen(m, /\blimit\b/, { von, bis: m.text.length }, 0)[0];
  return { von, bis: limit?.stelle ?? m.text.length };
}

/** Die Sortierstufen: an den Kommas der äussersten Ebene geteilt. */
export function sortierstufen(m: Maske): Bereich[] {
  const b = orderByBereich(m);
  if (b === undefined) {
    return [];
  }
  const raus: Bereich[] = [];
  let von = b.von;
  for (const stelle of stellen(m, ",", b)) {
    if (m.tiefe[stelle] === 0) {
      raus.push({ von, bis: stelle });
      von = stelle + 1;
    }
  }
  raus.push({ von, bis: b.bis });
  return raus.filter((s) => ausschnitt(m, s).length > 0);
}

const RICHTUNG = /\s+(asc|desc)\s*$/i;
const NULLSTELLUNG = /\s+nulls\s+(first|last)\s*$/i;

/** Der Ausdruck einer Stufe ohne `ASC`/`DESC` und ohne `NULLS FIRST|LAST`. */
export function stufenkern(m: Maske, stufe: Bereich): Bereich {
  let bis = stufe.bis;
  let roh = m.text.slice(stufe.von, bis);
  const ohneNulls = roh.replace(NULLSTELLUNG, "");
  bis -= roh.length - ohneNulls.length;
  roh = ohneNulls;
  const ohneRichtung = roh.replace(RICHTUNG, "");
  bis -= roh.length - ohneRichtung.length;
  return { von: stufe.von, bis };
}

/** Die Sortierrichtung einer Stufe, wie sie dasteht (`desc`, `asc` oder `""` = Vorgabe). */
export function richtung(m: Maske, stufe: Bereich): string {
  const roh = m.text.slice(stufe.von, stufe.bis).replace(NULLSTELLUNG, "");
  return RICHTUNG.exec(roh)?.[1]?.toLowerCase() ?? "";
}

const BEZEICHNER = /^[a-z_][a-z0-9_]*$/i;

/**
 * Löst einen Alias auf: steht in der Stufe nur ein Bezeichner, wird der Ausdruck der SELECT-Liste
 * eingesetzt, der ihn benennt (`<ausdruck> AS <alias>`). So fällt `0 AS treffer` durch und ein
 * ehrlich umbenannter Summenausdruck nicht.
 */
export function aufgeloest(m: Maske, stufe: Bereich): Bereich {
  const kern = stufenkern(m, stufe);
  const name = ausschnitt(m, kern);
  if (!BEZEICHNER.test(name)) {
    return kern;
  }
  const select = regexStellen(m, /\bselect\b/, GANZ(m), 0)[0];
  const from = regexStellen(m, /\bfrom\b/, GANZ(m), 0)[0];
  if (select === undefined || from === undefined || from.stelle <= select.stelle) {
    return kern;
  }
  const liste: Bereich = { von: select.stelle + select.laenge, bis: from.stelle };
  const alias = regexStellen(m, new RegExp(`\\bas\\s+${name}\\b`), liste, 0)[0];
  if (alias === undefined) {
    return kern;
  }
  const kommas = stellen(m, ",", liste).filter((s) => m.tiefe[s] === 0 && s < alias.stelle);
  const von = kommas[kommas.length - 1];
  return { von: (von ?? liste.von - 1) + 1, bis: alias.stelle };
}

/** Was die Abfrage über ihre Rangfolge halten muss. */
export interface Rangfolgevertrag {
  /** Die Platzhalternummern der Terme, so wie sie die `WHERE`-Bedingung benutzt (1-basiert). */
  readonly termParameter: readonly number[];
  /** Die Platzhalternummer des `LIMIT`. */
  readonly limitParameter: number;
  /** Die Such-Ausdrücke des Produkts (`KO_CANDIDATE_SEARCH_EXPRESSIONS`). */
  readonly ausdruecke: readonly string[];
}

export interface Rangfolgebefund {
  /** Leer = der Vertrag ist gehalten. Sonst je Zeile eine Beanstandung im Klartext. */
  readonly beanstandungen: string[];
  /** Die Stufen, wie sie dastehen (Rohtext) — für die Fehlermeldung. */
  readonly stufen: string[];
  /** Die erste Stufe, Alias aufgelöst. */
  readonly trefferstufe: string;
}

/**
 * Prüft die Rangfolge einer von `findCandidates` abgesetzten Abfrage:
 * Term-Trefferzahl ↓ → validiert ↓ → Trust ↓ (NULLS LAST) → `LIMIT`.
 */
export function pruefeRangfolge(sql: string, vertrag: Rangfolgevertrag): Rangfolgebefund {
  const m = maskiere(sql);
  const beanstandungen: string[] = [];
  const stufenBereiche = sortierstufen(m);
  const stufen = stufenBereiche.map((s) => ausschnitt(m, s));
  const where = whereBereich(m);
  const erste = stufenBereiche[0];
  if (where === undefined) {
    beanstandungen.push("Die Abfrage hat keine WHERE-Bedingung auf der äussersten Ebene.");
  }
  if (erste === undefined) {
    beanstandungen.push("Die Abfrage hat keine ORDER BY-Stufe.");
    return { beanstandungen, stufen, trefferstufe: "" };
  }
  const treffer = aufgeloest(m, erste);
  const trefferstufe = ausschnitt(m, treffer);

  // 1) Die Trefferstufe trägt GENAU die Ausdrücke und Parameter der WHERE-Bedingung.
  if (where !== undefined) {
    for (const nummer of vertrag.termParameter) {
      for (const ausdruck of vertrag.ausdruecke) {
        const nadel = `${ausdruck} ILIKE $${nummer}`;
        const imWhere = zaehle(m, nadel, where);
        const inStufe = zaehle(m, nadel, treffer);
        if (imWhere === 0) {
          beanstandungen.push(`Die WHERE-Bedingung prüft \`${nadel}\` nicht.`);
        } else if (inStufe !== imWhere) {
          beanstandungen.push(
            `Die erste Sortierstufe zählt \`${nadel}\` ${inStufe}-mal, die WHERE-Bedingung ${imWhere}-mal.`,
          );
        }
      }
    }
  }

  // 2) Je Term GENAU ein Summand: n Terme brauchen n-1 Additionen. Ein Term, der in mehreren
  //    Feldern steht, zählt damit einmal — wie im Speicherbestand (repo.ts:261-270).
  const plus = zaehle(m, "+", treffer);
  const erwartet = Math.max(0, vertrag.termParameter.length - 1);
  if (plus !== erwartet) {
    beanstandungen.push(
      `Die erste Sortierstufe summiert mit ${plus} statt ${erwartet} Additionen — je Term genau ein Summand.`,
    );
  }

  // 3) Kein fremder Platzhalter in der Trefferstufe (insbesondere nicht das LIMIT).
  if (zaehle(m, `$${vertrag.limitParameter}`, treffer) > 0) {
    beanstandungen.push("Die erste Sortierstufe benutzt den LIMIT-Platzhalter.");
  }

  // 4) Reihenfolge und Richtung der drei Stufen.
  if (richtung(m, erste) !== "desc") {
    beanstandungen.push("Die Trefferzahl wird nicht absteigend sortiert.");
  }
  // Gesucht wird der VERGLEICH, nicht das Wort: der Treffer beginnt bei `status` und damit
  // ausserhalb jedes Literals — ein blosses „validiert" in einem Kommentar oder in einer
  // Zeichenkette erfüllt das nicht.
  const validiert = stufenBereiche.findIndex(
    (s) => regexStellen(m, /status\s*=\s*'validiert'/, s).length > 0,
  );
  if (validiert === -1) {
    beanstandungen.push("Es gibt keine Stufe, die `status='validiert'` bevorzugt.");
  } else if (validiert !== 1) {
    beanstandungen.push(
      `Die Validiert-Stufe steht an Stelle ${validiert + 1}, erwartet ist die zweite (direkt nach der Trefferzahl).`,
    );
  }
  const trustStufe = stufenBereiche.findIndex(
    (s) => regexStellen(m, /data\s*->>\s*'trust'/, s).length > 0,
  );
  if (trustStufe === -1) {
    beanstandungen.push("Es gibt keine Trust-Stufe.");
  } else {
    if (trustStufe !== 2) {
      beanstandungen.push(
        `Die Trust-Stufe steht an Stelle ${trustStufe + 1}, erwartet ist die dritte.`,
      );
    }
    const roh = stufen[trustStufe] ?? "";
    if (!/nulls\s+last\s*$/i.test(roh)) {
      beanstandungen.push("Die Trust-Stufe hält `NULLS LAST` nicht.");
    }
  }
  return { beanstandungen, stufen, trefferstufe };
}
