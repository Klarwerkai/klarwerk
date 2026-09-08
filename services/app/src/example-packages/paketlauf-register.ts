// ================================================================================================
// JOB 3277 · RUNDE 2 — DAS PAKETLAUF-REGISTER.
// ================================================================================================
//
// DER BEFUND, DER ES ERZWUNGEN HAT (Codex-Nachführung 08.09. 07:50, BEN-Korrekturpflicht 1 zu
// Runde 1): in Runde 1 war die Paketzugehörigkeit REKONSTRUIERT — ein Objekt galt als Teil des
// Pakets, wenn seine Quelle zufällig den richtigen Provider und ein passendes externalId-Präfix
// trug. Das reicht für die sechs selbst angelegten Bausteine und für sonst nichts. Was am Freitag
// während der Vorführung ENTSTEHT — über den Confluence-Import angenommene Objekte, Entwürfe,
// Entscheidungen — trägt dieses Präfix nie und wäre beim Zurücksetzen unsichtbar gewesen. Eine
// Aufräumung „nach Ähnlichkeit" oder nach Titelsuche ist ausdrücklich verboten: sie träfe fremde
// Daten. Also muss die Zugehörigkeit AUFGESCHRIEBEN werden, im Augenblick, in dem sie entsteht.
//
// WAS EIN EINTRAG SAGT: „Objekt X gehört zu Paket P, hineingekommen als ART A im LAUF R." Genau
// diese drei Angaben verlangt die Nachführung (`package_id` + `run_id`, „Anzahl je Art"), und genau
// sie stehen im Eintrag — nicht mehr.
//
// ================================================================================================
// WO DAS REGISTER LIEGT — UND WARUM NICHT IN EINER EIGENEN TABELLE.
// ================================================================================================
//
// Es liegt AM OBJEKT, als Merker in `tags`. Das ist eine Entscheidung mit Preis, deshalb hier die
// Gründe und der Preis:
//
//  1. EIN EIGENES REPOSITORY GEHT IN DIESEM AUFTRAG NICHT. Ein neuer Bestand braucht Repo-Interface,
//     In-Memory- und Pg-Adapter, die Verdrahtung in `build-app.ts` UND einen Eintrag in
//     `MUTATING_METHODS` (dev-persist.ts) — sonst überlebt er den Neustart der Desktop-App nicht.
//     Keiner dieser Pfade steht in den ZIELPFADEN dieses Auftrags. Ungeprüfter Code an fünf fremden
//     Stellen wäre der teurere Fehler; die Abweichung ist in der RUECKGABE benannt.
//  2. AM OBJEKT IST DAS REGISTER AUTOMATISCH PERSISTENT UND AUTOMATISCH KONSISTENT. Das KO liegt als
//     Voll-JSONB (`kos.data`) bzw. im Dev-Journal (`koRepo.update` ist journaliert); der Merker
//     überlebt damit Neustart und Deploy ohne eigene Migration. Und er kann nicht verwaisen: wird
//     das Objekt gelöscht, ist auch sein Registereintrag weg — ein separater Bestand hätte hier
//     eine eigene Aufräumpflicht und damit eine eigene Fehlerquelle.
//  3. `tags` UND NICHT `sources`. Der Merker muss auch an Objekte gehen, die über den Confluence-
//     Import entstanden sind, OHNE deren Herkunft anzurühren (Nachführung: „Provider bleibt
//     Confluence, Zuordnung ist ein zusätzlicher Paketmerker"). Eine Quelle nachzutragen ginge nur
//     über `revise` — das erhöht die Version, setzt das Objekt auf „offen" und entwertet seine
//     Bewertungen. Eine Zuordnung, die das Objekt beschädigt, ist keine. `updateTags` ist ein reiner
//     Metadaten-Schreibvorgang: keine neue Version, kein Statuswechsel (service.ts:4030).
//
// DER PREIS, EHRLICH: Merker in `tags` sind SICHTBAR und von Hand ÄNDERBAR.
//
// WAS EIN GELÖSCHTER MERKER BEWIRKT — und was NICHT (Bens Gegenprobe zu Runde 2 hat die frühere
// Behauptung an dieser Stelle widerlegt, sie stand hier falsch):
//   · Trägt das Objekt noch den PAKETANKER (Beispiel-Provider + externalId `<paket>/<schlüssel>`),
//     ändert das Löschen des Merkers an der Zugehörigkeit NICHTS. Der Anker allein genügt für die
//     Auswahl (`bestandVon` ist eine VEREINIGUNG aus beidem); das Objekt steht dann in der Vorschau
//     als „nicht registriert", wird aber weiterhin zurückgesetzt bzw. entfernt — und der nächste
//     Lauf trägt den Merker wieder nach. Für die sechs Bausteine ist eine Abmeldung von Hand also
//     gar nicht möglich, und das ist richtig so: sie SIND das Paket.
//   · Nur bei Objekten OHNE Paketanker — den über den Import oder als Entwurf zugeordneten — ist
//     der Merker die einzige Zugehörigkeit. Dort, und nur dort, meldet sein Löschen das Objekt
//     wirklich ab, und der Reset fasst es nicht mehr an.
// Die Fehlerrichtung bleibt in beiden Fällen die sichere: ein verlorener Merker lässt ein Objekt
// STEHEN, er löscht nie ein fremdes.
import { randomUUID } from "node:crypto";

/** Der Namensraum aller Registermerker. Ein Schlagwort ohne dieses Präfix ist kein Registereintrag. */
export const PAKETLAUF_PRAEFIX = "paketlauf";

/**
 * Die Arten, in denen ein Objekt zu einem Paket kommt.
 *
 * DER LADEWEG SCHREIBT `seed` — die sechs Bausteine, die das Paket selbst anlegt. `import` (über
 * den selektiven Confluence-Import angenommene Objekte) und `entwurf` (Browser-/Chat-/Word-Entwürfe
 * der Vorführung) sind die Arten, die während der Vorführung dazukommen.
 *
 * RUNDE 3 — WAS SICH HIER GEÄNDERT HAT: bis Runde 2 wies der Reset einen Eintrag der Arten
 * `import`/`entwurf` als Fehlschlag AB, statt ihn zu behandeln. Das war die halbe Zusage, die Ben
 * aufgedeckt hat: registriert, aber nicht zurücksetzbar. Seit Runde 3 behandelt der Reset JEDES
 * zugeordnete Objekt — die sechs Bausteine werden wiederhergestellt, alles andere entfernt, weil
 * der Ausgangszustand es nicht kennt (`planeZuruecksetzen` in demo-pakete.ts). Die ART entscheidet
 * dabei nicht mehr über das Ob, sondern nur noch über die Auskunft in der Vorschau („Anzahl je
 * Art") und über die getrennte Zählung `removedAssigned` in der Bilanz.
 *
 * OFFEN BLEIBT NUR DAS SCHREIBEN dieser beiden Arten: dass der Admin einen Confluence-Importlauf
 * oder einen Entwurf dem Paket ZUORDNEN kann, ist die UI-Arbeit von Teil 2. Der Reset kann sie
 * bereits, sobald der Eintrag da ist — nachgemessen in tests/demopaket-advisor.
 */
export type PaketlaufArt = "seed" | "import" | "entwurf";

export interface PaketlaufEintrag {
  /** `package_id` — welches Paket. */
  readonly paket: string;
  /** Wie das Objekt hereinkam. Ein unbekannter Wert bleibt als Text stehen, statt still `seed` zu werden. */
  readonly art: string;
  /** `run_id` — welcher Lauf es hereingebracht hat. */
  readonly lauf: string;
}

/** Eine neue Laufkennung. Enthält keinen Doppelpunkt und bleibt damit im Merker zerlegbar. */
export function neueLaufKennung(): string {
  return randomUUID();
}

/** Der Merker in seiner gespeicherten Form: `paketlauf:<paket>:<art>:<lauf>`. */
export function paketlaufMerker(eintrag: PaketlaufEintrag): string {
  return `${PAKETLAUF_PRAEFIX}:${eintrag.paket}:${eintrag.art}:${eintrag.lauf}`;
}

/**
 * Der Registereintrag dieses Objekts für DIESES Paket — oder `null`, wenn es keinen trägt.
 *
 * Bewusst streng: nur ein Merker mit genau vier Teilen und nicht leerer Art und Laufkennung zählt.
 * Ein halb geschriebenes Schlagwort ist kein Eintrag, und „irgendwie zugehörig" gibt es nicht.
 */
export function lesePaketlauf(
  tags: readonly string[] | undefined,
  paket: string,
): PaketlaufEintrag | null {
  for (const tag of tags ?? []) {
    const teile = tag.split(":");
    if (teile.length !== 4 || teile[0] !== PAKETLAUF_PRAEFIX || teile[1] !== paket) {
      continue;
    }
    const art = teile[2] ?? "";
    const lauf = teile[3] ?? "";
    if (!art || !lauf) {
      continue;
    }
    return { paket, art, lauf };
  }
  return null;
}

/**
 * Die Schlagworte ohne die Registermerker DIESES Pakets.
 *
 * Zwei Aufgaben in einer Zeile: der Vergleich „trägt das Objekt noch seine Ausgangs-Schlagworte?"
 * darf nicht an der wechselnden Laufkennung scheitern, und das Wiederherstellen darf den Merker
 * nicht mit wegräumen. Merker FREMDER Pakete bleiben stehen — sie gehören nicht uns.
 */
export function ohnePaketlauf(tags: readonly string[] | undefined, paket: string): string[] {
  return (tags ?? []).filter((tag) => {
    const teile = tag.split(":");
    return !(teile.length === 4 && teile[0] === PAKETLAUF_PRAEFIX && teile[1] === paket);
  });
}

/**
 * Die Schlagwortliste, die den Registereintrag trägt — genau einen. Ein bereits vorhandener
 * Eintrag desselben Pakets wird ERSETZT und nicht danebengelegt, sonst hinge ein Objekt nach zwei
 * Läufen an zwei Laufkennungen und die Vorschau zählte es doppelt.
 */
export function mitPaketlauf(
  tags: readonly string[] | undefined,
  eintrag: PaketlaufEintrag,
): string[] {
  return [...ohnePaketlauf(tags, eintrag.paket), paketlaufMerker(eintrag)];
}
