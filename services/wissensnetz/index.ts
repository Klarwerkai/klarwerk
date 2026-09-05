// Oeffentliche API des Wissensnetz-Moduls — ABSICHTLICH SCHMAL.
//
// WAS HIER NICHT STEHT, IST FUER ANDERE MODULE UNERREICHBAR (`.dependency-cruiser.cjs`, Regel
// `module-boundaries`, severity "error"). Nicht hier stehen deshalb:
//
//   · `LesemodellService`  — sonst koennte ein Consumer `sicht({ sichtbar: () => true })` bauen
//   · `WissensnetzSicht`   — der Eingabetyp jeder Auswertung
//   · `sichtmetrik` und JEDE Huelle darum, gleich wie sie heisst und ob sie sync oder async ist
//
// Ein Consumer kann damit weder eine ungefilterte Sicht erzeugen noch eine vorhandene auswerten.
// Oeffentlich ist nur der ERGEBNISTYP: aus einer `Sichtmetrik` laesst sich keine Sicht
// rekonstruieren.
export { wissensnetzLuecken } from "./src/luecken-einstieg";
export type { Sichtmetrik, ThemenMetrik } from "./src/luecken";
export type { Betrachter } from "./src/policy-naht";

// ================================================================================================
// JOB 2009 · D2 — DREI EINTRAEGE MEHR, UND WARUM KEINER DIE ENGE OBEN AUFHEBT.
// ================================================================================================
//
// Bis D1 war der einzige oeffentliche Weg (`wissensnetzLuecken`) fuer jeden Aufrufer
// UNERREICHBAR: er verlangt ein `LesemodellService`, das absichtlich nicht hier steht. H3 hatte
// deshalb keinen Leser — nicht aus Nachlaessigkeit, sondern weil die Tuer keine Klinke hatte.
//
//   · `wissensnetzMetrikFuer`      — derselbe Weg, aber der Aufrufer bringt die PORTS statt des
//                               Lesemodells mit. Das Lesemodell entsteht modulintern.
//   · `policyNahtSchliessen`  — die Kompositionswurzel reicht die zentrale Policy herein (Weg D).
//
// UND AUSDRUECKLICH KEIN EINZIGER TYP MEHR. Ein erster Entwurf gab die Port-Typen
// (`LesemodellDeps`, `WissensnetzKoLeser` …) mit heraus — bequem, aber **C2 wurde davon rot**:
// ueber die Typkette war `WissensnetzSicht` wieder importierbar, also genau der Eingabetyp jeder
// Auswertung. Der Waechter hat gearbeitet, ich habe ihn NICHT angepasst, sondern den Export
// zurueckgenommen. Er wird auch nicht gebraucht: der Aufrufer uebergibt sein Portobjekt inline
// (`{ kos: { alle: () => ko.list({}) } }`), und TypeScript prueft es STRUKTURELL gegen die
// Signatur — ohne dass der Typ je einen Namen im Index braucht.
//
// WAS WEITERHIN NICHT HIER STEHT, unveraendert:
//   · `LesemodellService`  — ein Consumer kann `sicht({ sichtbar: () => true })` nicht bauen
//   · `WissensnetzSicht`   — der Eingabetyp jeder Auswertung
//   · `sichtmetrik` und jede Huelle darum
// Ein Consumer kann damit weder eine ungefilterte Sicht erzeugen noch eine vorhandene auswerten.
// C1 und C2 bleiben woertlich gruen — nachgemessen in D2.
export { wissensnetzMetrikFuer } from "./src/luecken-einstieg";
export { policyNahtSchliessen } from "./src/policy-naht";

// ================================================================================================
// JOB 2600 · D1 — DIE ERGEBNISTYPEN DER THEMENKARTE, UND KEINE FUNKTION.
// ================================================================================================
//
// Hier stehen ausschliesslich TYPEN, und zwar Ergebnistypen. Die Enge oben bleibt woertlich
// unberuehrt: `themenkarte()` selbst steht NICHT im Index — wer eine getrimmte Menge besitzt, soll
// sie nicht selbst auswerten koennen, genau wie bei `sichtmetrik`. Aus einem `Themenknoten` laesst
// sich keine Sicht rekonstruieren; er traegt einen Namen, eine Zahl sichtbarer Traeger und eine
// Farbe.
//
// Warum ueberhaupt exportiert: Der Client braucht die Form, um sie zu zeichnen. Ohne sie muesste
// `apps/web` die Felder nachbauen — die zweite Wahrheit, diesmal an der Anzeigegrenze.
export type { Themenfarbe, Themenkante, Themenkarte, Themenknoten } from "./src/themenkarte";
export {
  KANTEN_JE_KNOTEN,
  THEMEN_KNOTEN_DECKEL,
  UBIQUITY_MAX_SHARE,
  UBIQUITY_MIN_COUNT,
} from "./src/themenkarte";

// ================================================================================================
// JOB 3075 · P12 — `themenVon` GEHT HERAUS, UND DIE ENGE OBEN BLEIBT WOERTLICH STEHEN.
// ================================================================================================
//
// WARUM DIESE FUNKTION DEN INDEX VERLASSEN DARF, obwohl `themenkarte()` es nicht darf: Sie ist
// eine REINE NAMENSABLEITUNG. Eingang ist eine Schlagwortliste, Ausgang sind ihre Themen — aus
// dem Ergebnis laesst sich keine `WissensnetzSicht` rekonstruieren, so wenig wie aus einem
// `Themenknoten` oder einer `Sichtmetrik`. Sie liest keinen Bestand, sie fragt keine Ports, sie
// trifft keine Sichtbarkeitsentscheidung; wer sie ruft, muss die Objekte, ueber die er sie ruft,
// bereits besitzen. Das ist dasselbe Argument, mit dem die vier Konstanten oben hier stehen.
//
// WARUM SIE HERAUSGEHEN MUSS: `services/library-analytics/src/service.ts` (`graph()`) bildete bis
// heute seine eigenen Themen unmittelbar aus `ko.tags`. Damit trug das Haus ZWEI Antworten auf die
// Frage, was ein Thema ist — gemessen an zwei Objekten mit dem Schlagwort `"   "`: `/graph` zog
// eine Kante mit leerer Beschriftung, `/wissensnetz` kannte dort gar kein Thema. Die Alternative
// zum Export waere eine KOPIE der Regel im Analytics-Modul gewesen, also genau die zweite
// Wahrheit, die JOB 3073 abgeloest hat. Der Import ist die Modulgrenze entlang der erlaubten
// Richtung: dieses Modul importiert `library-analytics` nirgends, es entsteht kein Kreis.
//
// WAS WEITERHIN NICHT HIER STEHT, unveraendert: `LesemodellService`, `WissensnetzSicht`,
// `sichtmetrik` und jede Huelle darum. C1 und C2 bleiben woertlich gruen.
export { themenVon } from "./src/themenkarte";
