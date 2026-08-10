import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import {
  type KnowledgeSpaceNode,
  NO_SPACE,
  spaceResultCount,
  writeSpaceToParams,
} from "../lib/librarySpace";
import { cx } from "./ui";

// ==================================================================================================
// AUFTRAG PRO 390 — DIE ORTSZEILE (`P-1`) UND DIE SERVERZAHL (`P-3`).
// ==================================================================================================
//
// EIN Block mit drei Teilen: der Pfad („wo bin ich"), die Unterraumliste („wohin kann ich") und der
// Umschalter („nur hier oder in allem"). Die drei gehören zusammen — ein Pfad ohne Umschalter ist
// eine Sackgasse, ein Umschalter ohne Pfad benennt nicht, wovon er umschaltet. Getrennt stünden
// drei Ortsaussagen an drei Stellen.
//
// **Diese Komponente ist präsentational und entscheidet nichts.** Sie bekommt Pfad, Räume,
// Geltungsbereich und eine etwaige Serverzahl herein und zeichnet sie. Sie lädt nichts, sie rechnet
// nichts, sie leitet nichts ab. Sie ist in dieser Welle noch NIRGENDS montiert — die Montage in die
// Bibliotheksseite ist ein eigener, späterer Auftrag.
//
// ── DIE VIER REGELN, DIE SIE TRÄGT ───────────────────────────────────────────────────────────────
//
// 1. **Fehlt die Ortsschicht (`available: false`), verschwindet der GANZE Block** — samt seiner
//    Fokusziele. Es bleibt kein leerer, fokussierbarer Rest stehen, in den die Tastaturbedienung
//    laufen könnte. Und `available: false` gewinnt gegen JEDE andere Angabe: liegen Pfad, Räume und
//    Zahl vollständig an, ändert das nichts. Sonst hinge die fail-closed-Zusage daran, dass der
//    Aufrufer zusätzlich alles andere leerräumt — also an Disziplin statt an Bauform.
// 2. **Kein Pfad heisst kein Pfad, nie ein gekürzter.** Die Projektion (`spacePath`) hat das
//    bereits entschieden; hier wird `null` schlicht nicht gezeichnet — kein leerer Rahmen, kein
//    Platzhalter, keine Ellipse. Ein gekürzter Pfad verriete die Tiefe, ein vollständiger die Namen.
// 3. **Keine Räume heisst keine Liste.** Kein Platzhalterraum, kein „Nicht zugeordnet". Ist keiner
//    da, steht dort nichts.
// 4. **Eine Zahl erscheint NUR, wenn der Server sie geschickt hat.** Sie läuft zusätzlich durch
//    `spaceResultCount`, das alles zurückweist, was keine echte Zahl ist — ausdrücklich auch eine
//    Trefferliste. Eine clientseitig gerechnete Zahl wäre über die geladene (nicht die wahre) Menge
//    sofort eine Existenzauskunft über Verborgenes.
//
// ── DER UMSCHALTER IST KEIN AUSWAHLMENÜ ──────────────────────────────────────────────────────────
//
// Zwei nebeneinanderstehende Schaltflächen mit `aria-pressed`, in einer benannten Gruppe. Ein
// `<select>` zeigte den aktuellen Zustand erst beim Öffnen — bei einer Fläche, die den durchsuchten
// Bestand bestimmt, ist das keine Stilfrage. Der gewählte Zustand steht zusätzlich als TEXT im
// Baum und nicht nur als Tönung; das ist ausdrücklicher Hausvertrag.
//
// ── DIE OFFENEN WÖRTER — BEWUSST SICHTBAR GELASSEN ───────────────────────────────────────────────
//
// Für „gesamtes Unternehmen" gibt es keinen servergelieferten Namen; dieser eine Text muss verfasst
// werden. Er ist eine offene Ownerentscheidung (PLAN PRO 378 §9: `B-1`, `B-2`, `B-3`, `B-6`), und
// `i18n.ts` liegt ausserhalb des Schreibscopes dieses Auftrags. Deshalb fragt die Komponente die
// Wörter über die Hausmechanik ab — FÜNF Schlüssel unter `lib.raum.*`, die es noch NICHT gibt:
//
//     lib.raum.pathLabel        — `aria-label` des Pfad-`nav`
//     lib.raum.scopeGroupLabel  — `aria-label` der Umschaltergruppe
//     lib.raum.scopeSpace       — Rückfalltext der Schaltfläche „nur hier“ (ohne benannten Raum)
//     lib.raum.scopeAll         — die Schaltfläche „gesamtes Unternehmen“
//     lib.raum.spacesLabel      — `aria-label` der Unterraumliste
//
// Solange sie fehlen, gibt `i18next` den Schlüssel selbst aus (kein `parseMissingKeyHandler`, s.
// die Notiz zu AUFTRAG-81 in `i18n.ts`). Das ist ein bekannter, ausgewiesener Zwischenzustand und
// ausdrücklich KEIN Endzustand: **diese Komponente darf nicht in eine Seite montiert werden, bevor
// die fünf Schlüssel in DE, EN und NL stehen** — sonst läse ein Nutzer wörtlich „lib.raum.scopeAll".
// In dieser Welle ist die Montage ohnehin verboten, der Zwischenzustand also unerreichbar.
//
// Wo der Server einen Namen liefert, wird er BENUTZT statt erfunden: die Schaltfläche „nur hier"
// trägt den Namen des Raums, in dem man steht. Erfunden werden muss deshalb nur das eine Wort, für
// das es keine Wahrheit vom Server gibt.

export interface LibraryScopeBarProps {
  /**
   * Ist die Ortsschicht bedienbereit? `false` bei fehlender, veralteter oder unbekannter
   * Ortsprojektion — dann verschwindet der ganze Block und die Bibliothek verhält sich wie zuvor.
   */
  available: boolean;
  /** Die fertige, VOLLSTÄNDIGE Pfadkette (Wurzel zuerst) oder `null`. Nie eine Teilkette. */
  path: KnowledgeSpaceNode[] | null;
  /** Die bereits security-getrimmte Liste der Unterräume. Leer heisst: es gibt keine. */
  spaces: readonly KnowledgeSpaceNode[];
  /** Der aktive Geltungsbereich: eine Raumkennung, oder `NO_SPACE` für „gesamtes Unternehmen". */
  scope: string;
  /** Trefferzahl VOM SERVER, oder `null`. Wird nie aus einer Trefferliste gerechnet. */
  serverCount: number | null;
  /** Meldet den gewünschten Geltungsbereich. Die Komponente wechselt ihn nicht selbst. */
  onScopeChange?: (space: string) => void;
}

export function LibraryScopeBar({
  available,
  path,
  spaces,
  scope,
  serverCount,
  onScopeChange,
}: LibraryScopeBarProps): JSX.Element | null {
  const { t } = useTranslation();
  // Die Adresse wird gelesen, NICHT geschrieben: die Verweise auf Räume müssen die übrigen Filter
  // mitnehmen, sonst wäre ein Klick auf einen Raum zugleich ein stilles Zurücksetzen der Suche.
  // Das Fortschreiben selbst tut die Seite, nicht dieser Block.
  const [params] = useSearchParams();

  // Regel 1: fail-closed, und zwar vor allem anderen. Die Haken stehen bewusst darüber — sie dürfen
  // nicht bedingt aufgerufen werden.
  if (!available) {
    return null;
  }

  const count = spaceResultCount(serverCount);
  const inSpace = scope !== NO_SPACE;
  // Der Raum, in dem man steht — das letzte Glied des Pfades. Nur er trägt einen echten Namen.
  const currentSpace = path && path.length > 0 ? path[path.length - 1] : undefined;

  const spaceHref = (id: string): string => `?${writeSpaceToParams(params, id).toString()}`;

  return (
    <div className="mb-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Regel 2: nur ein VOLLSTÄNDIGER Pfad wird gezeichnet — sonst gar keiner. */}
        {path && path.length > 0 ? (
          <nav aria-label={t("lib.raum.pathLabel")} className="min-w-0">
            <ol className="flex flex-wrap items-center gap-1 font-mono text-[11.5px]">
              {path.map((node, index) => {
                const last = index === path.length - 1;
                return (
                  <li key={node.id} className="flex items-center gap-1">
                    {last ? (
                      // Man verlinkt nicht dorthin, wo man steht: das letzte Glied ist kein Link.
                      <span aria-current="page" className="font-semibold text-ink">
                        {node.name}
                      </span>
                    ) : (
                      <>
                        <Link to={spaceHref(node.id)} className="text-muted hover:text-text">
                          {node.name}
                        </Link>
                        <span aria-hidden="true" className="text-muted-2">
                          ›
                        </span>
                      </>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}

        {/* Zwei sichtbare Schaltflächen, nie ein Auswahlmenü.

            EIN ECHTES `fieldset` STATT `role="group"` — und das ist keine Vorliebe, sondern die im
            Haus bereits zweimal getroffene Entscheidung: `RichTextEditor.tsx:1529` hält sie wörtlich
            fest („die Gruppe … bekommt ihren Namen aus dem Element, nicht aus einem ARIA-Nachbau"),
            und `Modal.tsx:61` entscheidet dasselbe für `role="dialog"`. Der Linter erzwingt es über
            `a11y/useSemanticElements`; ein zusätzlich gesetztes `role="group"` wäre am `fieldset`
            redundant und fiele über `a11y/noRedundantRoles`. Die Gruppe ist damit im
            Zugänglichkeitsbaum benannt — über die implizite Rolle plus `aria-label`. */}
        <fieldset
          aria-label={t("lib.raum.scopeGroupLabel")}
          className="flex shrink-0 items-center gap-1.5 border-0 p-0"
        >
          <button
            type="button"
            aria-pressed={inSpace}
            // Ohne benannten Raum gibt es kein Ziel — dann ist die Schaltfläche ehrlich nicht
            // bedienbar, statt beim Drücken stumm nichts zu tun.
            disabled={currentSpace === undefined}
            onClick={() => {
              if (currentSpace) {
                onScopeChange?.(currentSpace.id);
              }
            }}
            className={cx(
              "rounded-pill border px-2.5 py-1 font-mono text-[11px] font-semibold",
              inSpace ? "border-ink bg-ink text-white" : "border-hairline text-muted",
              currentSpace === undefined && "opacity-45",
            )}
          >
            {currentSpace ? currentSpace.name : t("lib.raum.scopeSpace")}
          </button>
          <button
            type="button"
            aria-pressed={!inSpace}
            onClick={() => onScopeChange?.(NO_SPACE)}
            className={cx(
              "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 font-mono",
              "text-[11px] font-semibold",
              inSpace
                ? "border-hairline text-muted hover:text-text"
                : "border-ink bg-ink text-white",
            )}
          >
            {t("lib.raum.scopeAll")}
            {/* Regel 4: die Zahl steht hier NUR, wenn der Server sie geliefert hat. */}
            {count !== null ? (
              <span className="rounded-pill bg-hairline-soft px-1.5 py-0.5 text-[10.5px] text-muted">
                {count}
              </span>
            ) : null}
          </button>
        </fieldset>
      </div>

      {/* Regel 3: keine Räume, keine Liste — und kein Platzhalterraum. */}
      {spaces.length > 0 ? (
        <ul aria-label={t("lib.raum.spacesLabel")} className="flex flex-wrap items-center gap-1.5">
          {spaces.map((space) => (
            <li key={space.id}>
              <Link
                to={spaceHref(space.id)}
                className="inline-block rounded-pill border border-hairline px-2.5 py-1 font-mono text-[11px] text-muted hover:border-ink/30 hover:text-text"
              >
                {space.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
