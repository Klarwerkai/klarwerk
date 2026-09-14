// ================================================================================================
// JOB 3084 (Q6) — DIE EINE QUELLE DES ONLINEZUSTANDS FÜR DIE KOLLISIONSAUSKUNFT.
// ================================================================================================
//
// WARUM ES SIE GEBEN MUSS. Die Regel in `eigeneKollision.ts` liest vier Skalare aus TanStack Query.
// Keiner davon sagt „offline": `fetchStatus: "paused"` entsteht NUR an einem Abruf, der gewollt ist.
// Innerhalb der `staleTime` von 30 s (`main.tsx:21`) will nach dem Zurückkommen auf die Seite aber
// niemand einen Abruf — die Abfrage steht auf `idle`, und die Regel las daraus „frisch". So kam es
// zu Codex' Befund R-1585 (05.09.2026, https://app.klarwerk.ai, 1.0.0-beta.1.92): „navigator.onLine
// =false und echter /health-Abruf scheitert, dennoch ‚Keine offene Kollision an diesem Objekt‘ ohne
// Aktualitätshinweis. Zweimal reproduziert."
//
// WARUM AUSGERECHNET DER `onlineManager` UND NICHT `navigator.onLine`. Der `onlineManager` ist
// DIESELBE Quelle, aus der TanStack Query sein `paused` ableitet. Läse die Fläche stattdessen
// `navigator.onLine`, gäbe es zwei Wahrheiten über denselben Sachverhalt, und sie könnten
// auseinanderlaufen — genau die Drift, gegen die der Kopfkommentar von `eigeneKollision.ts:15-17`
// geschrieben ist. Zusätzlich lässt sich der `onlineManager` in Tests wirklich stellen
// (`onlineManager.setOnline(false)`), während `navigator.onLine` in jsdom nur behauptet werden kann.
//
// WARUM NICHT `useOfflineQueue` (`app/useOfflineQueue.ts:62-64`). Der Hook hält zwar auch einen
// Onlinezustand, aber er STÖSST SYNCHRONISIERUNGEN AN (`:86-120`, `:153-180`). Eine Auskunftsfläche
// darf nichts auslösen: sie soll sagen, was sie weiß, und nicht durch das Hinsehen Schreibvorgänge
// starten. Deshalb ist er hier bewusst nicht die Quelle, und deshalb bleibt er unangetastet.
//
// DIE EINZIGE VERDRAHTUNG, seit JOB 3879: `shell/Meldungen.tsx` (`useOnline`),
// `components/einstellungen/zeilenWert.ts` (`useIstOnline`) und `pages/Stufe2.tsx` haben den
// `onlineManager` bis dahin je selbst verdrahtet — die Restschuld, die JOB 3084 hier benennen
// musste, weil sie außerhalb seiner Zielpfade lag. Sie ist abgetragen: die beiden Namen bestehen
// weiter (ihre Aufrufstellen in `shell/KopfbandPunkte.tsx` und `pages/Admin.tsx` bleiben
// unverändert) und reichen jetzt diesen Hook durch; `Stufe2.tsx` ruft ihn unmittelbar.
// `tests/kollision-netztrennung/eine-quelle-waechter.test.ts` (W-4) hält fest, dass es bei EINER
// Verdrahtung bleibt, `eine-verdrahtung-je-hook.test.tsx` misst, dass je Hookinstanz genau einmal
// abonniert wird. Offen bleibt allein `navigator.onLine` in `app/AuthContext.tsx` und
// `app/useOfflineQueue.ts` — das sind Handlungen und keine Auskünfte (W-5 hält sie auf zwei fest).
import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

// Beide Funktionen stehen auf Modulebene und nicht im Hook: `useSyncExternalStore` meldet sich neu
// an, sobald sich die Identität von `subscribe` ändert. Als Pfeilfunktionen im Rumpf wäre das bei
// JEDEM Rendervorgang der Fall — ein Ab- und Anmelden je Bild, für einen Wert, der sich fast nie
// ändert.
const abonnieren = (melden: () => void): (() => void) => onlineManager.subscribe(melden);
const lesen = (): boolean => onlineManager.isOnline();

/**
 * Ohne `window` gibt es keinen Browser, der offline sein könnte.
 *
 * Der dritte Parameter von `useSyncExternalStore` greift beim Rendern auf dem Server (und in
 * Tests ohne DOM). Dort ist „offline" keine Messung, sondern eine Erfindung — und sie wäre die
 * teurere: sie würde die Auskunft grundlos verstummen lassen. `true` heißt hier nicht „online",
 * sondern „über das Netz dieses Geräts ist nichts bekannt, also wird die Aussage nicht an ihm
 * aufgehängt" — die Lage entsteht dann wie vor diesem Auftrag allein aus den vier Query-Skalaren.
 */
// Klein geschrieben wie `abonnieren` und `lesen` daneben, und das ist hier keine Geschmacksfrage:
// der Bildbeschreibungs-Sammler (`tests/app/mega84-bildbeschreibungsweg-sammler.test.tsx:453-468`)
// zählt JEDE Pfeilfunktion mit großem Anfangsbuchstaben als React-Komponente. `OHNE_FENSTER` hätte
// seine Auflage um eine Komponente erhöht, die es gar nicht gibt — gemessen, nicht vermutet.
const ohneFenster = (): boolean => true;

/**
 * Ist der Browser gerade online? Reaktiv, ohne einen Abruf, ohne eine Synchronisierung.
 *
 * Der einzige Zweck: den Wert an `eigeneKollisionDetail`/`eigeneKollisionStart` weiterzureichen.
 * Die Flächen deuten ihn nicht — was dasteht, entscheidet weiterhin allein `eigeneKollision.ts`.
 */
export function useNetzOnline(): boolean {
  return useSyncExternalStore(abonnieren, lesen, ohneFenster);
}
