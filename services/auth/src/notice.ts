// ================================================================================================
// AUFTRAG-mega61 BLOCK C — DIE VERSION DES HINWEISTEXTES.
// ================================================================================================
//
// WARUM EINE KONSTANTE IM CODE UND KEINE KONFIGURATION: Die Version gehört zum TEXT, und der Text
// steht im Code (apps/web/src/i18n.ts, `notice.banner.*`). Läge sie in der Umgebung, könnten Text
// und Version auseinanderlaufen — jemand ändert den Wortlaut und vergisst die Variable, und dann
// hat eine Nutzerin einen Hinweis quittiert, den sie nie gesehen hat. Genau das soll der Vermerk
// verhindern, also darf er nicht selbst die Lücke sein.
//
// WANN SIE ZU ERHÖHEN IST: sobald sich der WORTLAUT des Hinweises inhaltlich ändert. Eine
// Übersetzungskorrektur ohne Bedeutungsänderung ist keine neue Version; eine neue Aussage schon.
// Bei einer Erhöhung erscheint der Banner bei allen Konten wieder — das ist der Zweck.
//
// WARUM IM AUTH-MODUL: Der Vermerk ist ein Feld AM KONTO, und die Konten gehören diesem Modul
// (eigene Tabelle, keine geteilten Tabellen über Modulgrenzen). Er wird im selben Prüfprotokoll
// festgehalten, das hier auch Anmeldung und Abmeldung schreibt.
export const HINWEIS_TEXT_VERSION = "2026-07-30.1";

/** Muss dieses Konto den Hinweis (wieder) sehen? Kein Vermerk oder alte Fassung → ja. */
export function hinweisFaellig(vermerkteVersion: string | undefined): boolean {
  return vermerkteVersion !== HINWEIS_TEXT_VERSION;
}
