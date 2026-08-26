// ================================================================================================
// JOB 2408 · D1 · TEIL 2 — DER SAMMLER FÜR EINE FEHLERKLASSE, DIE NIEMAND SIEHT
// ================================================================================================
//
// DIE KLASSE. Eine Transaktionsklammer garantiert Alles-oder-Nichts. Sie garantiert NICHT, dass
// das Alles das Richtige ist. Stehen in einer `SET`-Liste zwei GLEICHARTIGE Parameter
// nebeneinander — zwei Zeitstempel, zwei Kennungen, zwei Versionen —, dann committet die Klammer
// einen Dreher zwischen ihnen sauber: kein Typfehler, kein Rollback, kein rotes Tor. Nur ein
// dauerhaft falscher Bestand ohne jedes Signal.
//
// EIN FALL DIESER KLASSE IST BELEGT. `services/app/src/db.migrate.integration.test.ts:610-624`
// haelt BEN-Bericht 17 ROT-1 fest: eine SET-Liste fuehrte eine Spalte nicht, der Wert verschwand,
// und der Server bestaetigte dem Client trotzdem die Aenderung.
//
// WOZU DIESER SAMMLER. Einzelne Stellen zu decken schuetzt die gedeckten Stellen. Er beantwortet
// die andere Frage: WIE VIELE solche Stellen gibt es ueberhaupt, und welche davon sieht heute
// niemand? Die Bauart ist die aus dem Transaktionsstellen-Sammler: Erhebung aus dem Quelltext,
// ein davon unabhaengiger Textzaehler als Kalibrierung, ein gepinntes Register, und Grenzen, die
// als Zahl sichtbar sind statt als Schweigen.
//
// GEMESSEN AM 26.08.2026 (Klon `a02b4ce`): 17 SET-Listen mit Parametern im Produktcode, davon
// SECHS mit mindestens zwei gleichartigen Parametern. Fuenf liegen in einer einzigen Datei, die
// sechste in einem ganz anderen Dienst.
//
// ZWEI GRENZEN, ausdruecklich, weil ein Sammler ohne benannte Grenzen mehr verspricht als er haelt:
//
//   (1) NUR `SET`-LISTEN. `INSERT ... VALUES` traegt dieselbe Gefahr und wird hier NICHT erhoben.
//       Fall S5 meldet die Zahl der uebergangenen VALUES-Listen, damit die Luecke eine Zahl hat.
//
//   (2) DIE GLEICHARTIGKEIT IST EINE HEURISTIK UEBER SPALTENNAMEN, kein Typsystem. Erkannt werden
//       gemeinsame Endungen (`_at`, `_id`, `_version`, `_state`/`_status`) und gemeinsame Praefixe
//       (`password_salt`/`password_hash`). NICHT erkannt wird ein Paar wie `name`/`email`: zwei
//       freie Zeichenketten ohne gemeinsame Struktur. Die Erhebung UNTERSCHAETZT die Klasse also;
//       sie ist eine Untergrenze, nie eine Freisprechung. Fall S4 haelt das an einem echten
//       Beispiel fest, damit die Schwaeche nicht in Vergessenheit geraet.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = resolve(__dirname, "../..");
const BEREICHE = ["services", "apps"] as const;

interface Paar {
  spalte: string;
  stelle: number;
}

interface Fund {
  datei: string;
  spalten: string[];
  gruppen: string[];
}

function* quelldateien(ordner: string): Generator<string> {
  for (const eintrag of readdirSync(join(WURZEL, ordner))) {
    if (eintrag === "node_modules" || eintrag === "dist" || eintrag === ".git") {
      continue;
    }
    const rel = `${ordner}/${eintrag}`;
    if (statSync(join(WURZEL, rel)).isDirectory()) {
      yield* quelldateien(rel);
    } else if (eintrag.endsWith(".ts") && !eintrag.includes(".test.")) {
      yield rel;
    }
  }
}

/** Die Typklasse einer Spalte, aus ihrem Namen geschlossen. `null` = keine erkannte Klasse. */
function endungsklasse(spalte: string): string | null {
  if (/_at$/.test(spalte)) return "zeitstempel";
  if (/_id$/.test(spalte)) return "kennung";
  if (/_version$/.test(spalte)) return "version";
  if (/_state$|_status$/.test(spalte)) return "zustand";
  return null;
}

/** Die zweite Achse: gemeinsames Praefix vor dem letzten Unterstrich. */
function praefixklasse(spalte: string): string | null {
  const i = spalte.lastIndexOf("_");
  if (i <= 2) return null;
  return `praefix:${spalte.slice(0, i)}`;
}

/** Alle `spalte=$n`-Paare einer SET-Liste, in Textreihenfolge. */
function paare(setTeil: string): Paar[] {
  return [...setTeil.matchAll(/(\w+)\s*=\s*\$(\d+)/g)].map((t) => ({
    spalte: t[1] ?? "",
    stelle: Number(t[2]),
  }));
}

/** Die drehbaren Gruppen einer SET-Liste: je Klasse zwei oder mehr Parameter. */
function drehbareGruppen(ps: readonly Paar[]): string[] {
  const nachKlasse = new Map<string, Paar[]>();
  for (const p of ps) {
    for (const k of [endungsklasse(p.spalte), praefixklasse(p.spalte)]) {
      if (!k) continue;
      const bisher = nachKlasse.get(k) ?? [];
      bisher.push(p);
      nachKlasse.set(k, bisher);
    }
  }
  const raus: string[] = [];
  for (const [k, v] of nachKlasse) {
    if (v.length >= 2) {
      raus.push(`${k}: ${v.map((p) => `${p.spalte}=$${p.stelle}`).join(", ")}`);
    }
  }
  return raus.sort();
}

const SET_LISTE = /\bSET\b([\s\S]*?)(?:\bWHERE\b|\bRETURNING\b|`|")/g;

// Eine SET-Liste muss nicht an ihrer Verwendungsstelle stehen. In
// `services/knowledge-object/src/search-projection-repo-pg.ts` ist sie in die Konstante
// `CONTROL_SETZEN` ausgelagert und wird als `SET ${CONTROL_SETZEN}` eingesetzt — mit zwölf
// Parametern, darunter drei Zeitstempel und zwei Generationen.
//
// DIESE BAUFORM WAR DER ERSTE BLINDE FLECK DER ERHEBUNG, und sie ist nicht selbst aufgefallen:
// der unabhaengige Textzaehler aus S3 hat die Datei gemeldet, die Haupterhebung nicht. Genau
// dafuer gibt es den zweiten Maszstab. Wer ihn weglaesst, haelt eine Luecke fuer eine Null.
const SET_INTERPOLIERT = /\bSET\s*\$\{(\w+)\}/g;

/** Loest `SET ${NAME}` auf: sucht die Konstante NAME in derselben Datei und gibt ihren Inhalt. */
function interpolierteListe(text: string, name: string): string | null {
  const treffer = new RegExp(`\\b${name}\\s*=\\s*\`([\\s\\S]*?)\``).exec(text);
  return treffer?.[1] ?? null;
}

function erhebung(): { funde: Fund[]; setListenGesamt: number; parsefehler: string[] } {
  const funde: Fund[] = [];
  const parsefehler: string[] = [];
  let setListenGesamt = 0;

  for (const bereich of BEREICHE) {
    for (const rel of quelldateien(bereich)) {
      let text: string;
      try {
        text = readFileSync(join(WURZEL, rel), "utf8");
      } catch (err) {
        // Sichtbar machen statt überspringen: eine Datei, die nicht gelesen werden kann, ist eine
        // Lücke in der Erhebung — und eine stille Lücke macht jedes Grün wertlos.
        parsefehler.push(`${rel}: ${String(err)}`);
        continue;
      }
      // Beide Bauformen: die SET-Liste am Ort, und die ausgelagerte, die dort eingesetzt wird.
      const listen: string[] = [...text.matchAll(SET_LISTE)].map((t) => t[1] ?? "");
      const schonGesehen = new Set<string>();
      for (const t of text.matchAll(SET_INTERPOLIERT)) {
        const name = t[1] ?? "";
        if (schonGesehen.has(name)) continue;
        schonGesehen.add(name);
        const inhalt = interpolierteListe(text, name);
        if (inhalt === null) {
          // Ein `SET ${NAME}`, dessen Konstante nicht auffindbar ist, ist eine Lücke — und die
          // gehört gemeldet, nicht übergangen.
          parsefehler.push(`${rel}: SET \${${name}} — Konstante nicht auflösbar`);
          continue;
        }
        listen.push(inhalt);
      }

      for (const liste of listen) {
        const ps = paare(liste);
        if (ps.length === 0) continue;
        setListenGesamt += 1;
        const gruppen = drehbareGruppen(ps);
        if (gruppen.length > 0) {
          funde.push({ datei: rel, spalten: ps.map((p) => p.spalte), gruppen });
        }
      }
    }
  }
  return { funde, setListenGesamt, parsefehler };
}

const schluessel = (f: Fund): string =>
  `${f.datei} | ${f.spalten.join(",")} | ${f.gruppen.join(" · ")}`;

// ------------------------------------------------------------------------------------------------
// DAS REGISTER — gepinnt am 26.08.2026, JOB 2408 D1.
//
// Die letzte Spalte ist der GEMESSENE Deckungsstand, nicht ein geschaetzter. „gedeckt" heisst: ein
// laufender Test loest die SET-Liste gegen die Parameterliste auf und wuerde einen Dreher melden.
// „ungedeckt" heisst: gemessen, dass es einen solchen Test nicht gibt.
// ------------------------------------------------------------------------------------------------
const REGISTER: readonly string[] = [
  // UPDATE users — PgUserRepo.update, neun Parameter. UNGEDECKT: kein laufender Test loest diese
  // SET-Liste auf. Die Praefix-Achse meldet hier `password_salt`/`password_hash` — ein Dreher
  // zwischen diesen beiden waere still und schwer.
  "services/auth/src/repo-pg.ts | name,email,password_salt,password_hash,role,approved,created_at,notice_ack_at,notice_ack_version | praefix:notice_ack: notice_ack_at=$9, notice_ack_version=$10 · praefix:password: password_salt=$4, password_hash=$5 · zeitstempel: created_at=$8, notice_ack_at=$9",
  // touchSession — laeuft ueber `cas()`, nicht ueber `casMitConsent`. UNGEDECKT.
  "services/reasoner/src/klara-policy-store.ts | last_activity_at,expires_at | zeitstempel: last_activity_at=$3, expires_at=$4",
  // rebindSession — drei drehbare Gruppen auf einmal, die dichteste Stelle im Baum. Gedeckt durch
  // JOB 2384 D1; jene Datei ist in diesem Baumstand (`a02b4ce`) noch nicht enthalten.
  "services/reasoner/src/klara-policy-store.ts | document_context_id,resolution_id,policy_version,configuration_version,last_activity_at,expires_at,consent_state | kennung: document_context_id=$3, resolution_id=$4 · version: policy_version=$5, configuration_version=$6 · zeitstempel: last_activity_at=$7, expires_at=$8",
  // revokeConsent — gedeckt in diesem Durchgang (Fall D1 der Nachbardatei aus JOB 2408).
  "services/reasoner/src/klara-policy-store.ts | last_activity_at,expires_at | zeitstempel: last_activity_at=$3, expires_at=$4",
  // closeSession — gedeckt in diesem Durchgang (Fall D2 der Nachbardatei aus JOB 2408).
  "services/reasoner/src/klara-policy-store.ts | closed_at,last_activity_at | zeitstempel: closed_at=$3, last_activity_at=$4",
  // refreshResolution — laeuft ueber `cas()`. UNGEDECKT.
  "services/reasoner/src/klara-policy-store.ts | resolution_id,policy_version,configuration_version | version: policy_version=$4, configuration_version=$5",
  // `CONTROL_SETZEN` — die ausgelagerte SET-Liste der Projektionssteuerung, zwoelf Parameter und
  // die dichteste Stelle im ganzen Baum: DREI Zeitstempel, zwei Versionen, ein Praefixpaar.
  // UNGEDECKT, und zweifach: (a) kein laufender Test loest diese SET-Liste gegen ihre
  // Parameterliste auf; (b) die Fixture des Nachbartests (`search-projection-repo-pg.test.ts:102`)
  // gibt FUENF Zeitfeldern denselben Wert `AT` und beiden Generationen denselben Wert — ein Dreher
  // zwischen ihnen bliebe selbst dann unsichtbar, wenn die Bindung geprueft wuerde. Gleiche
  // Sentinels machen jede Vertauschungsprobe blind.
  "services/knowledge-object/src/search-projection-repo-pg.ts | active_projection_version,target_projection_version,projection_state,last_successful_rebuild,last_reconcile,last_failure,build_started_at,build_finished_at,build_generation,active_generation,integrity_marker,activated_at | praefix:last: last_reconcile=$5, last_failure=$6 · version: active_projection_version=$1, target_projection_version=$2 · zeitstempel: build_started_at=$7, build_finished_at=$8, activated_at=$12",
];

describe("JOB 2408 · Sammler: SET-Listen mit gleichartigen Parametern", () => {
  it("S1 · die Erhebung findet überhaupt etwas — sonst wäre jedes Grün wertlos", () => {
    const { funde, setListenGesamt, parsefehler } = erhebung();

    // Kalibrierung gegen den Totalausfall: falscher Arbeitsordner, umbenannte Bereiche, kaputter
    // Ausdruck. Ohne diesen Fall wären S2 und S3 trivial grün, wenn die Erhebung nichts findet.
    expect(setListenGesamt, "keine einzige parametrisierte SET-Liste gefunden").toBeGreaterThan(10);
    expect(funde.length, "keine einzige drehbare Stelle gefunden").toBeGreaterThan(0);

    // Eine unlesbare Datei ist eine Lücke, kein Grund zum Schweigen.
    expect(parsefehler, "Dateien, die nicht gelesen werden konnten").toEqual([]);
  });

  it("S2 · die erhobene Menge ist exakt das gepinnte Register", () => {
    const erhoben = erhebung().funde.map(schluessel).sort();
    const gepinnt = [...REGISTER].sort();

    const neu = erhoben.filter((e) => !gepinnt.includes(e));
    const weg = gepinnt.filter((g) => !erhoben.includes(g));

    // KEIN Defekt, sondern die Nachführpflicht. Wer eine SET-Liste um eine zweite gleichartige
    // Spalte erweitert, schafft eine neue drehbare Stelle — und die muss hier ankommen, nicht
    // still entstehen. Genau das ist der Zweck des Sammlers.
    expect(
      neu,
      "NEUE drehbare Stelle im Baum, nicht im Register. Prüfen, ob sie gedeckt ist, dann eintragen.",
    ).toEqual([]);
    expect(weg, "im Register gepinnt, im Baum nicht mehr gefunden").toEqual([]);
    expect(erhoben.length, "die Zahl der drehbaren Stellen hat sich geändert").toBe(7);
  });

  it("S3 · ein UNABHÄNGIGER Textzähler bestätigt die Größenordnung", () => {
    // Zweiter Weg zum selben Ergebnis, bewusst gröber: er zählt Dateien, die mindestens zwei
    // `_at=$n`-Zuweisungen führen. Stimmen Erhebung und Zähler nie überein, ist einer von beiden
    // kaputt — und das fällt hier auf, statt in einem stillen Grün zu verschwinden.
    let dateienMitZweiZeitstempeln = 0;
    for (const bereich of BEREICHE) {
      for (const rel of quelldateien(bereich)) {
        const text = readFileSync(join(WURZEL, rel), "utf8");
        if ([...text.matchAll(/\w+_at\s*=\s*\$\d+/g)].length >= 2) {
          dateienMitZweiZeitstempeln += 1;
        }
      }
    }

    const dateienLautErhebung = new Set(
      erhebung()
        .funde.filter((f) => f.gruppen.some((g) => g.startsWith("zeitstempel:")))
        .map((f) => f.datei),
    );

    expect(dateienMitZweiZeitstempeln, "der unabhängige Zähler findet nichts").toBeGreaterThan(0);
    expect(
      dateienLautErhebung.size,
      "Erhebung und unabhängiger Zähler weichen voneinander ab",
    ).toBe(dateienMitZweiZeitstempeln);
  });

  it("S4 · GRENZE 2, an einem echten Beispiel: die Heuristik unterschätzt die Klasse", () => {
    // `UPDATE users SET name=$2,email=$3,...` — zwei freie Zeichenketten nebeneinander, ein Dreher
    // zwischen ihnen wäre still. Die Erhebung sieht sie NICHT, weil die Namen keine gemeinsame
    // Endung und kein gemeinsames Präfix teilen.
    //
    // Dieser Fall hält die Schwäche fest, statt sie zu verschweigen: Er zeigt, dass die Spalten in
    // derselben SET-Liste stehen, und dass die Erhebung sie trotzdem nicht als Gruppe meldet. Wer
    // die Heuristik später verschärft, sieht hier zuerst, was sie bisher nicht konnte.
    const ps = paare("SET name=$2,email=$3,password_salt=$4,password_hash=$5");
    expect(ps.map((p) => p.spalte)).toEqual(["name", "email", "password_salt", "password_hash"]);

    const gruppen = drehbareGruppen(ps);
    // Was sie kann: das Präfixpaar.
    expect(gruppen).toContain("praefix:password: password_salt=$4, password_hash=$5");
    // Was sie nicht kann: `name`/`email` als gleichartig erkennen.
    expect(
      gruppen.some((g) => g.includes("name=") && g.includes("email=")),
      "die Heuristik erkennt name/email als Gruppe — dann ist dieser Grenzfall überholt und der " +
        "Kommentar im Dateikopf muss nachgeführt werden",
    ).toBe(false);
  });

  it("S5 · GRENZE 1 als Zahl: wie viele VALUES-Listen die Erhebung übergeht", () => {
    // `INSERT ... VALUES ($1,$2,...)` trägt dieselbe Gefahr und wird nicht erhoben. Eine Lücke,
    // die man beziffern kann, ist eine Aufgabe; eine, über die geschwiegen wird, ist ein Irrtum
    // in Grün. Die Zahl ist bewusst nicht gepinnt — sie soll wachsen dürfen, ohne rot zu werden,
    // aber sie soll sichtbar sein.
    let valuesListen = 0;
    for (const bereich of BEREICHE) {
      for (const rel of quelldateien(bereich)) {
        const text = readFileSync(join(WURZEL, rel), "utf8");
        for (const t of text.matchAll(/\bVALUES\s*\(([^)]*)\)/gi)) {
          if ([...(t[1] ?? "").matchAll(/\$\d+/g)].length >= 2) {
            valuesListen += 1;
          }
        }
      }
    }

    expect(valuesListen, "der VALUES-Zähler findet nichts — dann ist er kaputt").toBeGreaterThan(0);
    console.info(
      `\nJOB 2408 · Sammler — Reichweite: ${erhebung().funde.length} drehbare SET-Listen erhoben; ` +
        `${valuesListen} VALUES-Listen mit mindestens zwei Parametern NICHT erhoben (Grenze 1).\n`,
    );
  });

  it("S6 · KALIBRIERUNG: die Gruppenerkennung greift und meldet keine Gruppe, wo keine ist", () => {
    // Positivprobe: zwei Zeitstempel sind eine Gruppe.
    expect(drehbareGruppen(paare("SET closed_at=$3, last_activity_at=$4"))).toEqual([
      "zeitstempel: closed_at=$3, last_activity_at=$4",
    ]);

    // Gegenprobe: EIN Zeitstempel ist keine Gruppe — sonst meldete der Sammler alles und wäre
    // wertlos. Genau diese Richtung fehlte den vier Wächtern, die in diesem Zyklus gescheitert sind.
    expect(drehbareGruppen(paare("SET last_activity_at=$3"))).toEqual([]);
    expect(drehbareGruppen(paare("SET consent_state=$3"))).toEqual([]);

    // Und eine SET-Liste ganz ohne Parameter erzeugt keinen Fund.
    expect(paare("SET consent_state='revoked'")).toEqual([]);
  });
});
