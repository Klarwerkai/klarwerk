// GRUNDWÖRTERBUCH `de` — I18N-AUFTEILUNG (Aufnahme 20260922, zentrale-module-aufteilen).
//
// Dieser Block stand bis zur Aufteilung in `apps/web/src/i18n.ts`. Er ist Zeile für Zeile hierher
// verschoben; kein Schlüssel und kein Wert ist geändert (Beleg:
// `tests/i18n-woerterbuch/aufteilung-unveraendert.test.ts`). Neue Texte gehören in ein Textmodul
// unter `apps/web/src/texte/` (docs/i18n-textmodule.md), nicht hierher.
import { lesevarianteTexteDe } from "../lib/lesevariante";

const de = {
  // SCRUM-488: erste Tranche kontextueller Hilfetexte (Muster-Beweis, quer über die Bereiche).
  "ask.help.sources.title": "Warum nur belegte Antworten?",
  "ask.help.sources.body":
    "Klarwerk antwortet ausschließlich aus euren eigenen Wissensobjekten — nie aus allgemeinem Modellwissen. Zu jeder Antwort siehst du, welche Quellen sie getragen haben und in welchem Zustand sie sind. Fehlt die Grundlage, sagt es das ehrlich, statt zu raten. Prüfe die genannten Quellen, bevor du dich darauf verlässt.",
  "dup.help.detection.title": "Wie Dubletten erkannt werden",
  "dup.help.detection.body":
    "„Textidentisch“ findet die Heuristik ohne KI; „wahrscheinlich“ beurteilt das Modell inhaltlich. Entscheiden musst du selbst — und deine Entscheidung hält nur einen Abschlussgrund fest: an den beiden Objekten ändert sie nichts, gelöscht wird keines, beide bleiben.",
  "extpage.help.scope.title": "Was die externe Suche darf",
  "extpage.help.scope.body":
    "Externe Treffer sind Recherchehilfe, kein geprüftes Wissen: nichts wird automatisch importiert oder von Kolleg:innen validiert. Ist die externe Abfrage vom Admin gesperrt, bleibt der Bereich leer.",
  "app.name": "KLARWERK",
  "app.subtitle": "Reasoning System",
  "app.staleBundle":
    "Eine neue Version der App ist verfügbar — bitte die Seite neu laden (Cmd+R bzw. Strg+R).",
  // JOB 3268 (D1-R): ZWEI verschiedene Zustände, zwei verschiedene Sätze. Der Satz darüber gehört
  // zum GESCHEITERTEN Nachladen eines Programmstücks (`lib/staleChunk.ts`), dieser hier zur alten
  // Oberfläche, die einwandfrei weiterläuft und nur nicht mehr die aktuelle ist.
  "version.neu.hinweis": "Neue Version verfügbar",
  "version.neu.neuLaden": "Neu laden",
  "nav.group.workspace": "Arbeitsbereich",
  "nav.group.quality": "Qualität & Pflege",
  "nav.group.control": "Steuerung",
  "nav.group.advanced": "Erweitert",
  // JOB 3337: die vier Obergruppen der Vorlage (`app/navigationGliederung.ts`). Sie beschriften
  // Menü UND Direktzugang — die Gruppe „Verwaltung" ist damit für Berechtigte ausdrücklich benannt
  // und nicht mehr nur ein Zahnrad.
  "gliederung.arbeiten": "Arbeiten",
  "gliederung.qualitaet": "Qualität",
  "gliederung.verwaltung": "Verwaltung",
  "gliederung.persoenlich": "Persönlich und Hilfe",
  "nav.start": "Start",
  "nav.tasks": "Offene Aufgaben",
  "nav.capture": "Wissen erfassen",
  "nav.ask": "Fragen",
  "nav.library": "Bibliothek",
  // JOB 2600 D1 — die Themenkarte.
  "nav.wissensnetz": "Themenkarte",
  "wissensnetz.kicker": "Wissensnetz",
  "wissensnetz.title": "Themenkarte",
  "wissensnetz.karte.label": "Themen und ihre Überschneidungen",
  "wissensnetz.karte.alt": "Themenkarte mit {{count}} Themen",
  // JOB 3052 D6: Klick/Enter WAEHLT das Thema (die Leiste zeigt seine Objekte); der Sprung in die
  // Bibliothek ist der Link in der Leiste.
  "wissensnetz.knoten.alt": "{{thema}} — {{count}} sichtbare Wissensobjekte, Thema auswählen",
  "wissensnetz.farbe.belegt": "freigegeben und belegt",
  "wissensnetz.farbe.freigegeben": "freigegeben, ohne Quelle",
  // JOB 3052 D6: der Wortlaut des Zielbilds (Z.64) für den Zustand „kein validierter Träger" — die
  // offenen Objekte liegen im Prüfboard. „freigegeben" (Z.63) allein wäre für Grün UND Weiß wahr
  // und „wenig belegt" (Z.65) sagt weniger als der Zustand hergibt; dort bleibt die Produktwahrheit.
  "wissensnetz.farbe.offen": "in Prüfung",
  // JOB 2600 D4 · BENs Auflage zu D3: „Fassung A ist nicht für alle Zustände wahr." Der alte Satz
  // lautete „kommt fast überall vor und verbindet deshalb nichts" und stand IMMER da — auch wenn
  // kein einziger Knoten gestrichelt war, und auch bei einem Anteil von 51 %, wo „fast überall"
  // schlicht falsch ist. Jetzt gilt: je Zustand ein eigener Satz, und jeder ist für seinen Zustand
  // wahr. Die Regel selbst (>50 % des sichtbaren Bestands, mindestens 5 Träger) steht in
  // `themenkarte.ts:72-73`; „Mehrheit" ist ihre wortgetreue Wiedergabe — keine Prozentanzeige (§4).
  "wissensnetz.legende.ubiquitaer":
    "Gestrichelt umrandet: kommt in der Mehrheit des sichtbaren Bestands vor und bekommt deshalb keine Kanten.",
  // Der Zustand, in dem die Karte ÜBERHAUPT keine Kante trägt. Ohne diesen Satz läse ein Mensch
  // die Strichelung als Grund — dabei verbindet hier nichts irgendetwas.
  "wissensnetz.legende.keineKanten":
    "In diesem Bestand teilt kein freigegebenes Wissensobjekt zwei dieser Themen — deshalb sind keine Linien zu sehen.",
  // JOB 2600 D7 · Der ZWEITE Grund für eine leere Kantenliste, und der Satz, der ihn wahr sagt.
  // Bis D5 stand hier nur der Satz darüber — auch dann, wenn es den gemeinsamen Träger sehr wohl
  // gab und nur die Ubiquitätsregel die Linie verhindert hat. In diesem Zustand log er, und ein
  // Mensch schloss auf „hier hängt nichts zusammen". Dieser Satz behauptet ausschließlich, was
  // `unterdruecktDurchUbiquitaet > 0` belegt: dass es den Träger gibt und was die Linie verhindert.
  // „Mehrheit" ist die wortgetreue Wiedergabe von `UBIQUITY_MAX_SHARE` — keine Prozentanzeige (§4).
  "wissensnetz.legende.kantenUnterdrueckt":
    "Ein freigegebenes Wissensobjekt verbindet hier zwei Themen — aber mindestens eines davon kommt in der Mehrheit des sichtbaren Bestands vor und bekommt deshalb keine Linien.",
  "wissensnetz.alle.schalter": "Alle Themen ({{count}} weitere)",
  "wissensnetz.alle.abgeschnitten": "Die Liste ist gekürzt.",
  "wissensnetz.leer": "Zu diesem Bestand sind keine Schlagwörter vergeben.",
  // JOB 3052 D6 — die Legenden-Karte und die Seitenleiste des Zielbilds (Wissensnetz.dc.html).
  // „gemeinsam freigegeben" statt „gemeinsam belegt" (Z.66): eine Kante entsteht, wenn zwei Themen
  // in demselben FREIGEGEBENEN Objekt vorkommen (themenkarte.ts) — „belegt" hieße „mit Quelle", und
  // das verlangt die Kante nicht.
  "wissensnetz.legende.groesse": "Größe = sichtbares Wissen · Kante = gemeinsam freigegeben",
  "wissensnetz.leiste.alt": "Zum Thema {{thema}}",
  // Die Zahlen stammen aus der Antwort der Bibliothekssuche für dieses Schlagwort — derselbe Weg
  // wie die Facette in der Bibliothek, keine zweite Zählung.
  "wissensnetz.leiste.zaehlung": "{{frei}} freigegebene Wissensobjekte · {{pruefung}} in Prüfung",
  "wissensnetz.leiste.status.validiert": "freigegeben",
  "wissensnetz.leiste.status.offen": "in Prüfung",
  "wissensnetz.leiste.alle": "Alle {{count}} Objekte öffnen",
  "wissensnetz.leiste.oeffnen": "In der Bibliothek öffnen",
  // Leer heißt: die Suche hat für DICH nichts geliefert (Rechte-Naht) — kein Urteil über den Bestand.
  "wissensnetz.leiste.leer": "Zu diesem Thema ist für dich nichts sichtbar.",
  "wissensnetz.leiste.fehler": "Die Objekte zu diesem Thema konnten nicht geladen werden.",
  // Zustandsmodell (REGELN §7, Lehre JOB 3037 R3): scheitert eine Auffrischung, bleibt das zuletzt
  // Geholte sichtbar — mit Stand und dem Wort, dass die Auffrischung fehlschlug.
  "wissensnetz.stand.fehlgeschlagen": "Stand von {{stand}} · Auffrischung fehlgeschlagen",
  // Weder Daten noch Fehler noch Laden (etwa eine pausierte erste Anfrage): kein „Nichts vorhanden",
  // kein Offline-Urteil (Lehre JOB 3037 R4/R5) — nur, was feststeht.
  "wissensnetz.keineAntwort": "Noch keine Antwort vom Server.",
  // JOB 3067 V4 — die Ablesekarte unter dem Netz. Jede Beschriftung sagt im Wort, dass sie das
  // SICHTBARE zählt (`luecken.ts:18-20`): die Sicht ist vor der Zählung getrimmt, ein Thema mit
  // lauter vertraulichen Beitragenden sieht danach aus wie eines ohne. Deshalb steht hier kein
  // Urteilswort — keine „Lücke", kein „fehlt", kein „leer". Die Bewertung bleibt beim Menschen.
  "wissensnetz.metrik.titel": "Sichtbarer Bestand",
  "wissensnetz.metrik.objekte": "Sichtbare Objekte",
  // JEDE der drei Beschriftungen nennt die Sichtbarkeit selbst — nicht nur der Titel darueber und
  // nicht nur der Satz darunter. Wer eine einzelne Zahl liest, liest genau diese eine Zeile; ein
  // blosses „Davon ohne Schlagwort" liesse offen, wovon, und behauptete damit eine Aussage ueber
  // den ganzen Bestand statt ueber den getrimmten (Lehre JOB 3067 R1). Gemessen in
  // `tests/wissensnetz-sichtmetrik/flaeche.test.tsx`, F1 und F1b (de/en/nl).
  "wissensnetz.metrik.ohneThema": "Sichtbare Objekte ohne Schlagwort",
  "wissensnetz.metrik.beitragende": "Sichtbare Beitragende",
  "wissensnetz.metrik.hinweis":
    "Gezählt wurde, was für dich sichtbar ist. Was du nicht sehen darfst, ist vor der Zählung entfernt worden — was diese Zahlen bedeuten, entscheidest du.",
  // Für diese Menge gibt es KEINEN Bibliotheksfilter, der sie genau trifft. Statt eines toten
  // Knopfes steht der Grund da.
  "wissensnetz.metrik.ohneThemaHinweis": "Dafür gibt es keinen Einstieg in die Bibliothek.",
  // Eine LESEREIHENFOLGE, keine Rangfolge von Mängeln — die Überschrift sagt genau das.
  "wissensnetz.metrik.themenTitel": "Themen nach sichtbaren Beitragenden, die wenigsten zuerst",
  "wissensnetz.metrik.zeile.objekte": "{{count}} sichtbare Objekte",
  "wissensnetz.metrik.zeile.beitragende": "{{count}} sichtbare Beitragende",
  // Ist die Beitragendenliste am Deckel beschnitten, ist selbst diese Zahl eine Untergrenze
  // (`luecken.ts:34-38`) — dann sagt die Zeile „mindestens".
  "wissensnetz.metrik.zeile.beitragendeMindestens": "mindestens {{count}} sichtbare Beitragende",
  "wissensnetz.metrik.mehr": "Weitere {{count}} Themen zeigen",
  "wissensnetz.metrik.weniger": "Weitere Themen ausblenden",
  // JOB 3070 V6 — der Leseweg: dieselbe Auskunft wie die Zeichnung, in Sätzen. Auf dem Telefon
  // steht sie AN DER STELLE der Zeichnung (die dort nicht darstellbar ist), am großen Bildschirm
  // führt der Umschalter hinein. Kein neuer Zahlenschlüssel — die Zahlen der Zeile sind die von
  // JOB 3067 und tragen ihr Sichtbarkeitswort schon.
  "wissensnetz.lesen.gruppe": "Darstellung der Themenkarte",
  "wissensnetz.lesen.netz": "Netz",
  "wissensnetz.lesen.lesen": "Lesen",
  // Die Strichelung des Knotens in Worten (`ohneKanten`, Regel in `themenkarte.ts`): >50 % des
  // sichtbaren Bestands, mindestens 5 Träger. Der zweite Halbsatz sagt, warum zu diesem Thema KEIN
  // Zusammen-Satz danebensteht — das ist eine Aussage über die Erhebung, nicht über den Bestand.
  // „Kommt mit keinem Thema zusammen vor" wäre die Behauptung, die hier gerade nicht gilt.
  "wissensnetz.lesen.ubiquitaer":
    "Kommt in der Mehrheit des sichtbaren Bestands vor; gemeinsames Vorkommen wird dafür nicht ausgewiesen.",
  // Die Kante in Worten: zwei Themen in demselben freigegebenen Wissensobjekt. Steht nur, wenn die
  // Karte diesen Knoten führt UND er Nachbarn hat.
  "wissensnetz.lesen.zusammen": "Kommt gemeinsam vor mit {{themen}}.",
  // ================================================================================================
  // JOB 4155 · WG-LUECKEN — DIE GESETZTEN BEZIEHUNGEN, UND WAS IHR FEHLEN NICHT HEISST.
  // ================================================================================================
  //
  // Die Zeile nennt BEIDE Zahlen oder keine. „3 von 10" allein liesse offen, ob die anderen sieben
  // geprüft und unverbunden oder gar nicht angesehen sind — deshalb stehen beide Zahlen da.
  "wissensnetz.lesen.verknuepfung":
    "{{verknuepft}} davon haben eine gesetzte Beziehung, {{unverknuepft}} nicht.",
  // DER GRUNDSATZ. Er steht in jeder Lage und ist der fachliche Kern des Vertrags: dass zu einem
  // Eintrag keine Beziehung gesetzt ist, ist keine Prüfaussage. Ohne ihn liest jemand eine
  // niedrige Zahl als Mangel und eine hohe als Prüfsiegel — beides darf diese Fläche nicht
  // behaupten.
  //
  // DER WORTLAUT UMGEHT DREI WÖRTER, UND ZWAR ABSICHTLICH. Der Urteilswächter dieser Seite
  // (`tests/wissensnetz-sichtmetrik/flaeche.test.tsx`, F4) verbietet „lücke", „fehlt", „fehlend"
  // und „leer" im sichtbaren Text — er hält die Fessel aus `luecken.ts:13-16` fest, dass diese
  // Ebene kein Urteil fällen darf. Ein erster Entwurf begann mit „Eine fehlende Beziehung heißt
  // nicht …" und machte ihn rot. Der Wächter wurde NICHT angepasst: er hat recht, auch wenn der
  // Satz das Gegenteil eines Urteils sagt — und ein Wächter, den man für den eigenen Satz
  // aufweicht, hält beim nächsten Mal nichts mehr. Der Satz sagt jetzt dasselbe ohne diese Wörter.
  "wissensnetz.verknuepfung.grundsatz":
    "Wenn zu einem Eintrag keine Beziehung gesetzt ist, heißt das nicht, dass er geprüft und widerspruchsfrei ist — es heißt nur, dass niemand eine Beziehung gesetzt hat.",
  // DIE ZWEI GRÜNDE EINER AUSLASSUNG, jeder mit seiner eigenen Folge. Statt einer 0, die wie ein
  // Messergebnis aussähe, steht hier, dass nicht gezählt wurde — und warum.
  "wissensnetz.verknuepfung.ausgelassen.kein-kantenport":
    "Die gesetzten Beziehungen wurden für diese Übersicht nicht abgefragt; hier steht deshalb keine Zahl dazu.",
  "wissensnetz.verknuepfung.ausgelassen.zu-viele-objekte":
    "Für diesen Bestand wurden die gesetzten Beziehungen nicht gezählt, weil zu viele Einträge sichtbar sind; hier steht deshalb keine Zahl dazu.",
  // JOB 3070 D2 · Der SATZRAHMEN um das Zustandswort. `wissensnetz.farbe.<zustand>` ist ein
  // Legendenfragment („freigegeben, ohne Quelle") — allein gelesen sagt es nicht, worüber es
  // spricht. Der Rahmen setzt es ein; das Wort selbst behält genau eine Definition (die Legende).
  "wissensnetz.lesen.zustand": "Zustand: {{wort}}.",
  // JOB 3070 D3 · Gezeichnete Themen ohne Zeile werden ANGESAGT, nicht verschwiegen: eine Liste,
  // die „Themen" heißt und gezeichnete Themen nicht enthält, behauptet sonst stumm Vollständigkeit.
  //
  // JOB 3073 · DER GRUND IM SATZ WAR AB HIER FALSCH und ist deshalb WEG, nicht ersetzt. Er lautete
  // „— sie zählt nach Kategorie, die Zeichnung nach Schlagwort" und benannte damit die zweite
  // Themenachse. Die gibt es nicht mehr (`services/wissensnetz/src/lesemodell.ts`). Übrig bleibt
  // genau EIN Weg, auf dem ein gezeichnetes Thema ohne Zeile dasteht: die Themenliste ist am
  // Deckel beschnitten (`?deckel=`), die Zeichnung nicht. Das steht hier trotzdem NICHT im Satz —
  // die Antwort, die diese Seite bekommt (`Sichtmetrik`), führt kein `abgeschnitten`; ein Grund,
  // den die Fläche nicht nachsehen kann, wäre wieder eine Behauptung ohne Beleg. Der Satz nennt
  // deshalb nur, was gemessen ist: die Zahl.
  "wissensnetz.lesen.nichtInListe":
    "Die Zeichnung führt {{count}} Themen, zu denen diese Liste keine Zeile hat.",
  "nav.external": "Externes Wissen",
  "nav.validation": "Validierung",
  "nav.conflicts": "Konflikte",
  "nav.duplicates": "Duplikate",
  // SCRUM-486 E: Sidebar-Badges mit Bedeutung — Zahl + Art (Tooltip/aria-label).
  "nav.badge.tasks": "{{count}} offene Aufgaben",
  "nav.badge.loading": "Zähler wird geladen …",
  // AUFTRAG-mega3 Block B: ehrliche dritte Ladephase „Fehler" (nicht endlos „lädt", keine erfundene 0).
  "nav.badge.error": "Zähler konnte nicht geladen werden – erneut versuchen",
  // AUFTRAG-mega4 Block B: Refetch der vorhandenen Zahl scheiterte — Zahl bleibt sichtbar, gilt aber als veraltet.
  "nav.badge.stale": "Zähler veraltet – Aktualisierung fehlgeschlagen, erneut versuchen",
  "loadstate.error.title": "Konnte nicht geladen werden.",
  "loadstate.error.retry": "Erneut versuchen",
  "loadstate.stale": "Veraltet – Aktualisierung fehlgeschlagen",
  "nav.badge.validation": "{{count}} warten auf Prüfung",
  "nav.badge.conflicts": "{{count}} offene Widersprüche",
  "nav.badge.duplicates": "{{count}} mögliche Dubletten",
  "nav.risk": "Risiko & Lücken",
  "nav.lifecycle": "Lebenszyklus",
  "nav.analytics": "Analytics & Audit",
  "nav.admin": "Admin",
  // AUFTRAG-mega38 BLOCK I: „Output Factory" stand in der Navigation — auf JEDEM Bildschirm.
  "nav.output": "Auswertungen",
  "nav.import": "Import & Quellen",
  "nav.graph": "Wissensgraph",
  "nav.capital": "Kapital-Sichten",
  "nav.help": "Hilfe",
  "nav.profile": "Profil",
  "role.viewAs": "Ansicht als Rolle",
  "role.previewNote": "Vorschau als {{role}} — du bleibst Admin.",
  "role.backToAdmin": "Zur Admin-Ansicht",
  "role.stage2": "Erweiterte Module · Stufe 2",
  // AUFTRAG-mega51 BLOCK G1: „Stufe 2" ist ein Hausbegriff — hier steht, was er bedeutet.
  "role.stage2Hint":
    "Stufe 2 sind zusätzliche Module über den Kernablauf hinaus — Qualitätssicherung, Wissenskapital und Ausgabe-Formate. Eine Admin-Person schaltet sie frei.",
  "role.short.viewer": "Viewer",
  "role.short.experte": "Experte",
  "role.short.controller": "Contr.",
  "role.short.admin": "Admin",
  "role.name.viewer": "Betrachter",
  "role.name.experte": "Experte",
  "role.name.controller": "Controller",
  "role.name.admin": "Administrator",
  "action.logout": "Abmelden",
  // JOB 1119 (D-002): Die globale Suche navigiert ausschließlich nach `/bibliothek?q=…`
  // (`shell/Topbar.tsx:396-400`) — Funktionen und Anlagen findet sie nicht. Die Zusage nennt jetzt,
  // wohin sie wirklich führt. Der Weg selbst bleibt unverändert; nur das Versprechen wird ehrlich.
  "topbar.search": "Wissen in der Bibliothek suchen…",
  "topbar.mobile": "Mobil",
  // mega40 B: Design-Umschalter (zweites, rein optisches Design „Werkbank/Modern").
  "topbar.design.classic": "Klassisch",
  "topbar.design.modern": "Modern",
  // JOB 3060 · H1: das eine Kopfband (Mockup design/klarwerk) und seine Menüs.
  "kopfband.suchen": "Suchen",
  "kopfband.erfassen": "Erfassen",
  "kopfband.pruefen": "Prüfen",
  "kopfband.navigation": "Hauptnavigation",
  "kopfband.menue": "Menü",
  "kopfband.konto": "Konto",
  "kopfband.ungelesen": "{{count}} ungelesene Meldungen",
  "menue.einstellungen": "Einstellungen",
  "menue.status": "Status",
  "menue.seitenhilfe": "Seitenhilfe",
  "menue.seitenhilfe.leer": "Zu dieser Seite gibt es keine Erklärung.",
  // ================================================================================================
  // JOB 3669 — DIE SEITENHILFE DES ERSTEN WEGS: Start → Bibliothek → Aufgaben → Wissensobjekt.
  // ================================================================================================
  // Pedi (11.09.): „damit wir einen Demo-Account aushändigen können und eine Person, die damit noch
  // nie gearbeitet hat, sich relativ schnell einarbeitet." Diese vier Seiten hatten bis hierher
  // GAR KEINE Hilfequelle — kein `HelpTip`, kein Kapitel, nichts. Wer sie zum ersten Mal öffnete,
  // fand im Zahnrad unter „Seitenhilfe" den Leersatz oben.
  //
  // Jeder Text beantwortet DREI Fragen in dieser Reihenfolge: Was ist das hier? Was kann ich tun?
  // Was ist der nächste Schritt? Er beschreibt NUR, was die Seite wirklich hat — der Ort des
  // Suchfelds, der Name des Menüs, der Knopf, der erst im Leerzustand erscheint.
  //
  // /bibliothek und /aufgaben tragen zusätzlich den Nav-Erklärsatz ihres Hilfekapitels
  // (`help.library.*`, `help.tasks.*`), den das Zahnrad-Menü VOR die Tipps setzt
  // (`shell/ZahnradMenue.tsx`, `useNavErklaerung`). Die Texte hier wiederholen ihn deshalb nicht:
  // sie sagen, wo auf der Fläche die Dinge liegen und was als Nächstes zu tun ist.
  //
  // ------------------------------------------------------------------------------------------------
  // RUNDE 2 — BENS ZWEI KORREKTURPFLICHTEN: EIN HILFETEXT GILT FÜR JEDE ROLLE UND JEDE BREITE.
  // ------------------------------------------------------------------------------------------------
  // Ben hat den Text von Runde 1 nicht gelesen, sondern nachgestellt — und zweimal fand die Montage
  // etwas anderes vor, als hier stand:
  //   1. ALS BETRACHTER ist der Knopf „Erfassen" im leeren Bestand KEIN Weg: `RoleLink` rendert
  //      ihn dann als `div` mit `aria-disabled="true"` und dem Wort „Kein Zugriff"
  //      (`components/RoleLink.tsx:88-103`, `/erfassen` verlangt „Experte", `app/navigation.ts`).
  //      Eine uneingeschränkte Handlungszusage war damit für die Hälfte der Demo-Zugänge falsch.
  //   2. SCHMAL GIBT ES DAS NEBENEINANDER NICHT: unter 760 px trägt genau EINE Fläche die Seite
  //      (`components/bibliothek/BibliothekFlaeche.tsx:942`, `zeigeListe`/`zeigeBericht`) — mit
  //      einer Wahl der Bericht, und der Rückweg steht oben als Knopf „Zurück zu Bibliothek".
  //      „Links die Liste" war dort eine Ortsangabe auf eine Fläche, die gar nicht da ist.
  // Beide Texte nennen jetzt die Bedingung MIT der Zusage. Gemessen wird das nicht am Wortlaut,
  // sondern an der Fläche: `tests/seitenhilfe-luecken/…` stellt Rolle und Breite ein und vergleicht
  // die Zusage mit dem, was wirklich im Baum steht.
  //
  // ------------------------------------------------------------------------------------------------
  // RUNDE 3 — BENS DRITTE KORREKTURPFLICHT: „DANEBEN" WAR AUCH FALSCH.
  // ------------------------------------------------------------------------------------------------
  // Runde 2 schrieb über das Tablet-Band (760–899 px): „holt „Trefferliste einblenden" sie daneben".
  // Ben hat den Schalter GEDRÜCKT statt ihn nur zu zählen, und die Liste kommt nicht daneben: sie
  // liegt als Schublade ÜBER dem Eintrag (`BibliothekFlaeche.tsx:947` wählt `darueber`,
  // `BibliothekListe.tsx:96` setzt es um: `absolute bottom-0 left-0 top-12 z-20 w-[380px]` mit
  // Schlagschatten). Der Eintrag rückt also nicht zur Seite, er wird verdeckt.
  //
  // Der Satz sagt das jetzt — und nennt auch den Weg zurück („Trefferliste ausblenden"), denn eine
  // Schublade, die man nicht wieder loswird, wäre eine halbe Auskunft. Gemessen wird er zweimal:
  // gemountet nach dem KLICK (`data-lage="darueber"`, `absolute`, `z-20`, und nach dem zweiten
  // Klick ist die Liste wieder aus dem Baum) und in Chromium an der gebauten Seite, wo sich die
  // Rechtecke von Liste und Bericht wirklich ÜBERLAPPEN — mit der Eichung, dass sie es breit
  // (1620 px, Spaltenlage) NICHT tun.
  "seitenhilfe.start.title": "Startseite: fragen und sehen, was ansteht",
  "seitenhilfe.start.body":
    "Das ist die Startseite: Hier fragst du das Wissen und siehst, was gerade auf dich wartet. Tipp deine Frage in das Feld — die Antwort zeigt dir die Seite „Fragen“; die Karte „FÜR DICH“ listet deine offenen Punkte, „ZULETZT“ die letzten Änderungen im Bestand, der Verweis „Meine Entwürfe“ unter dem Feld führt zu deinen begonnenen Erfassungen (nur wenn du erfassen darfst), und das Menü „…“ oben rechts öffnet weitere Übersichten. Nächster Schritt: Frage eintippen und Eingabetaste drücken — oder eine Zeile in „FÜR DICH“ anklicken, sie führt direkt dorthin, wo die Sache erledigt wird.",
  "seitenhilfe.bibliothek.title": "Bibliothek: der ganze Bestand",
  "seitenhilfe.bibliothek.body":
    "Das ist der gesamte Wissensbestand. Auf einem breiten Bildschirm steht links die Liste und rechts der Eintrag, den du gerade liest; auf einem schmalen Gerät trägt immer nur eines von beiden die Fläche — ohne Wahl die Liste, mit Wahl der Eintrag, und oben bringt dich der Knopf „Zurück zu Bibliothek“ wieder in die Liste (auf dem Tablet legt „Trefferliste einblenden“ sie als Schublade ÜBER den Eintrag, „Trefferliste ausblenden“ nimmt sie wieder weg). Gesucht wird über das Suchfeld oben im Kopfband; Filter, Sortierung, gespeicherte Sichten und Export liegen im Menü „…“ über der Liste. Nächster Schritt: Klick einen Eintrag an und lies ihn — ist die Liste leer, führt der Knopf „Erfassen“ dorthin, wo neues Wissen entsteht, sofern deine Rolle das Erfassen erlaubt; sonst steht dort „Kein Zugriff“.",
  "seitenhilfe.aufgaben.title": "Offene Aufgaben: was hier zu erledigen ist",
  "seitenhilfe.aufgaben.body":
    "Hier steht die offene Arbeit an einer Stelle: Prüfungen, Konflikte, fällige Revalidierungen, offene Wissenslücken und Objekte, die zur Nacharbeit an dich zurückgingen. Der farbige Punkt zeigt die Dringlichkeit (rot „Kritisch“, gelb „Heute“, grün „Später“), die Knopfreihe oben filtert nach Art und nennt die Anzahl, und das „i“ an einer Zeile sagt dir, was dort zu tun ist. Nächster Schritt: Klick die oberste Zeile an — sie führt an die Stelle, an der die Aufgabe erledigt wird, sofern diese Fläche für deine Rolle freigegeben ist; sonst bleibt der Weg zu (Konflikte, Risiko und Lebenszyklus sind nicht für jede Rolle offen). Steht „Nichts offen.“, zeigt „Wie geht es weiter?“ die möglichen nächsten Wege.",
  "seitenhilfe.wissen.title": "Wissensobjekt: eine Aussage und ihre Belege",
  "seitenhilfe.wissen.body":
    "Du liest ein einzelnes Wissensobjekt — dieselbe Fläche wie in der Bibliothek, nur mit diesem Eintrag vorgewählt: auf einem breiten Bildschirm steht die Liste links und seine Aussage mit Status und Quelle rechts, auf einem schmalen Gerät trägt der Eintrag die Fläche allein und der Knopf „Zurück zu Bibliothek“ oben führt in die Liste. Alles Weitere — Quellen und Anhänge, Versionen, Historie, Kommentare, Konflikte — liegt hinter der Zeile „Mehr“; steht deine Oberfläche auf einer anderen Sprache und gibt es eine Leseübersetzung, steht sie oben, ausdrücklich als Übersetzung benannt. Nächster Schritt: Lies die Aussage, sieh auf Status und Quelle, und öffne „Mehr“, wenn du wissen willst, worauf sie sich stützt.",
  // JOB 3768 — die fünfte Seite desselben Wegs. Sie fehlte hier nur, weil ihre Datei während
  // JOB 3669 bei JOB 3668 (Entwurfs-Papierkorb) lag; der Grund ist mit dessen Auslieferung entfallen.
  //
  // JEDER SATZ IST AN DER FLÄCHE GEMESSEN (`pages/MeineEntwuerfe.tsx`, `components/CaptureDraftList.tsx`):
  //   · Entwürfe sind PRIVAT (Entscheidung Pedi `debbb8e8`): jede Rolle, auch der Administrator,
  //     sieht hier nur die eigenen (`canSeeDraft`). Der frühere Satz über „Entwürfe aller Ersteller"
  //     und die Auswahl „Alle Ersteller" ist deshalb fort — die Seite zeigt diese Auswahl nicht mehr
  //     (`MeineEntwuerfe.tsx`, `isAdmin={false}`).
  //   · „Wiederherstellen"/„Endgültig löschen" sind die Wörter, die der Papierkorb wirklich trägt
  //     (`adm.trash.restore`/`adm.trash.purge`) — kein zweites Wort für dieselbe Handlung.
  //   · KEINE Aufbewahrungsfrist: es gibt keine (JOB 3668, Rückgabe R1). „Von selbst leert er sich
  //     nicht" ist die wahre Auskunft, kein Versprechen über die Frist aus `TRASH_RETENTION_DAYS`.
  //   · KEINE Aussage über den BESTAND (§9): nirgends steht, dass Entwürfe oder gelöschte Entwürfe
  //     da sind — nur, was mit ihnen geschieht und wo man nachsieht.
  "seitenhilfe.entwuerfe.title": "Meine Entwürfe: begonnene Erfassungen fortsetzen",
  "seitenhilfe.entwuerfe.body":
    "Hier stehen die Erfassungen, die als Entwurf gespeichert und noch nicht zu einem Wissensobjekt geworden sind — dieselben Entwürfe, die auch der Editor und der Arbeitsraum zeigen, nur an einem eigenen Ort; einen zweiten Entwurfsspeicher gibt es nicht. Hier stehen nur deine eigenen Entwürfe: Sie sind privat, niemand sonst sieht sie, auch kein Administrator. Das Suchfeld über der Liste durchsucht ausschließlich diese Entwürfe und kein Wissen aus der Bibliothek, „Sortieren“ ordnet sie nach Stand oder Titel. Gelöschte Entwürfe gehen in den „Papierkorb“ unter der Liste: „Wiederherstellen“ holt einen zurück, „Endgültig löschen“ entfernt ihn wirklich, und von selbst leert sich der Papierkorb nicht. Nächster Schritt: Klick „Fortsetzen“ an einer Zeile — der Entwurf öffnet sich im Editor, und noch nicht gespeicherte Eingaben werden vorher abgefragt; steht die Liste leer da, führt „Erfassen“ dorthin, wo ein neuer Entwurf entsteht.",
  // JOB 3337: der Zugang heißt jetzt, was er ist. „Weitere Bereiche" war eine Restekiste,
  // „Schnellnavigation" ein Fachwort — Pedi: „Die Direktfunktion ist … schwer zu erkennen."
  // Die SCHLÜSSEL bleiben, damit kein Aufrufer und kein Pin ins Leere greift.
  "menue.weitereBereiche": "Bereiche",
  "menue.schnellnavigation": "Gehe zu …",
  "menue.darstellung": "Darstellung",
  "topbar.design.hint": "Design umschalten — ändert nur das Aussehen, keine Inhalte oder Eingaben.",
  "topbar.openMenu": "Menü öffnen",
  "topbar.closeMenu": "Menü schließen",
  "topbar.menuLabel": "Navigationsmenü",
  // JOB 3525: die SICHTBARE Beschriftung des Menü-Knopfes auf schmaler Breite. Bewusst nur das
  // Substantiv — „Menü öffnen" bleibt der zugängliche Name (`topbar.openMenu`) und enthält dieses
  // Wort, damit Sprachbedienung „Klick Menü" trifft (WCAG 2.5.3).
  "topbar.menuShort": "Menü",
  // B1b: Rückweg aus der schalenlosen /mobile-Ansicht zur Vollversion.
  "topbar.toDesktop": "Zur Vollversion",
  "topbar.notifications": "Meldungen",
  "topbar.notificationsPlaceholder": "Noch keine Benachrichtigungen. Echte Quelle folgt (#63).",
  // AUFTRAG-mega51 BLOCK G1: „Reasoner" ist ein Fachwort — in der Oberfläche steht das, was
  // gemeint ist. Die SCHLÜSSEL und der Bezeichner im Code bleiben unverändert.
  "topbar.reasonerActive": "KI-Modell antwortet",
  "topbar.reasonerOffline": "Kein KI-Modell",
  // PAKET 2 (D-AISTATE, Pedi 23.07.): ehrliche Erreichbarkeit statt bloßer Konfiguration.
  "topbar.reasonerActiveHint": "Ein KI-Modell hat zuletzt erreichbar geantwortet.",
  "topbar.reasonerUnverified": "KI-Modell ungeprüft",
  "topbar.reasonerUnverifiedHint":
    "Ein KI-Modell ist konfiguriert, aber die Erreichbarkeit ist noch nicht geprüft.",
  "topbar.reasonerUnreachable": "KI-Modell nicht erreichbar",
  "topbar.reasonerUnreachableHint":
    "Ein KI-Modell ist konfiguriert, war zuletzt aber nicht erreichbar (z. B. Schlüssel abgelaufen, Dienst aus). Aufrufe laufen deterministisch.",
  "topbar.reasonerOfflineHint":
    "Kein KI-Modell verfügbar — es läuft der deterministische Ersatzmodus.",
  // PAKET 2: Achse 1 — externe Wissensabfrage (Web-Suche), getrennt vom KI-Modell.
  // AUFTRAG-mega51 BLOCK G1: „Extern" allein sagt nicht, was extern ist.
  "topbar.external.blocked": "Web-Suche: gesperrt",
  "topbar.external.search": "Web-Suche: erlaubt",
  "topbar.external.open": "Web-Suche: offen",
  "topbar.external.hint":
    "Externe Wissensabfrage (Web-Suche) — eine EIGENE Achse, nicht das KI-Modell. Steuert nur die Web-Suche/öffentliche Anreicherung, nicht den Reasoner.",
  // Pedi 05.07.: Header-Pille „In welcher KI bin ich?" + Herkunftsland + DSGVO-Bestätigung.
  // DSGVO: ja gibt es NUR bei interner KI aus Europa — alles andere ehrlich „nein".
  // AUFTRAG-mega38 BLOCK H: EIN Satz Klartext, der VOR dem Fachtext steht.
  "topbar.plain.ki":
    "Zeigt, wo die KI rechnet, die Klarwerk benutzt — im eigenen Haus oder bei einem Anbieter im Netz.",
  "topbar.plain.reasoner":
    "Zeigt, ob die KI gerade antwortet. „Ungeprüft“ heißt nur: seit dem Start ist noch keine Antwort zurückgekommen — es ist kein Fehler.",
  "topbar.plain.external":
    "Zeigt, ob Klarwerk beim Antworten auch im offenen Internet nachsehen darf. „Blockiert“ heißt: nein, es bleibt bei eurem eigenen Wissen.",
  // AUFTRAG-mega51 BLOCK G1: „KI-Modus" ist eine Einstellung; gemeint ist der ORT.
  // Auftrag gesamt-ki-freigaberegeln (R-0606): der wirksame Stand der zentralen Adminfreigabe für
  // öffentliche KI, sichtbar über der Kopfzeile (`shell/ExternStatus.tsx`).
  "topbar.extern.blockiert": "Extern: Blockiert",
  "topbar.extern.frei": "Extern: Freigegeben",
  "topbar.extern.freiVertraulich": "Extern: Freigegeben, auch Vertrauliches",
  "topbar.extern.hinweis":
    "Ob Inhalte an eine öffentliche KI gehen dürfen, legt der Administrator fest. Vorgabe: blockiert.",
  "topbar.kiExternal": "KI rechnet in der Cloud",
  "topbar.kiInternal": "KI rechnet im eigenen Haus",
  "topbar.kiMixed": "KI rechnet in der Cloud und im eigenen Haus",
  "topbar.kiNone": "Keine KI",
  "topbar.kiNoneSubtitle": "deterministischer Ersatzmodus",
  "topbar.kiDsgvoYes": "DSGVO: ja",
  "topbar.kiDsgvoNo": "DSGVO: nein",
  "topbar.kiExternalHint":
    "Deine KI-Aufgaben laufen über ein Cloud-Modell außer Haus — DSGVO-Bestätigung daher: nein. Ein Ja gibt es nur für eine interne KI aus Europa. Details je Aufgabe: Verwaltung → KI.",
  "topbar.kiInternalHint":
    "Deine KI-Aufgaben laufen vollständig über ein lokales Modell im Haus. DSGVO: ja gibt es nur hier — und nur, wenn die KI aus Europa stammt. Herkunft derzeit aus der Anbieter-Kennung abgeleitet; künftig übermittelt sie die zentrale KI-Zugangs-Steuerung.",
  "topbar.kiMixedHint":
    "Gemischter Betrieb: einige Aufgaben laufen über die externe Cloud-KI, andere im Haus. Es zählt die strengste Stufe — DSGVO-Bestätigung: nein. Details je Aufgabe: Verwaltung → KI.",
  "topbar.kiNoneHint":
    "Kein KI-Modell ist für eine Aufgabe aktiv. Klarwerk arbeitet im deterministischen Ersatzmodus.",
  // Herkunftsland der KI (Interim aus der Anbieter-Kennung; später aus der KI-Zugangs-Steuerung).
  "country.us": "USA",
  "country.de": "Deutschland",
  "country.fr": "Frankreich",
  "country.cn": "China",
  "country.unknown": "Herkunft unbekannt",
  "country.ownSystem": "eigenes System (EU)",
  "topbar.notificationsEmpty": "Keine Benachrichtigungen.",
  "topbar.notifMarkAll": "Alle gelesen",
  "topbar.notifMarkRead": "Als gelesen markieren",
  // JOB 2709 D4 — die beiden Sätze für einen fehlgeschlagenen Gelesen-Status.
  //
  // `notifSeenFailed` ist die AUFFANGSTELLE: Sie erscheint nur, wenn es gar keine Serverantwort
  // gab (Netzabbruch, Zeitüberschreitung). Antwortet der Server, hat SEIN Satz Vorrang — er nennt
  // den Grund und die Zahlen, und ihn hier nachzubauen hiesse, zwei Wahrheiten über dieselbe
  // Grenze zu führen.
  //
  // `notifSeenReverted` ist der Teil, den der Server NICHT sagen kann: was die Glocke daraufhin
  // getan hat. Sie hat die Markierung zurückgenommen — ohne diesen Satz bliebe offen, ob die
  // Meldungen nun gelesen sind oder nicht, und genau diese Ungewissheit war der Fehler.
  "topbar.notifSeenFailed": "Die Meldungen konnten nicht als gelesen gespeichert werden.",
  "topbar.notifSeenReverted": "Sie bleiben ungelesen.",
  "topbar.notifOpen": "Öffnen",
  "topbar.notifAssignment": "Review für dich",
  "topbar.notifImpact": "Dein Wissen hat geholfen",
  "topbar.notifDuplicate": "Mögliches Duplikat",
  "topbar.notifGapRedacted": "Offene Wissenslücke",
  "cmd.open": "„Gehe zu …“ öffnen",
  "cmd.close": "Schließen",
  "cmd.placeholder": "Gehe zu … (⌘K)",
  "cmd.empty": "Kein Treffer.",
  // JOB 3337: das Suchfeld trägt einen eigenen zugänglichen Namen (bisher nur ein Platzhalter —
  // Codex' Livebefund) und die Liste sagt, wie viele Ziele gerade dastehen.
  "cmd.suchfeld": "Ziel suchen",
  "cmd.treffer_one": "{{count}} Ziel",
  "cmd.treffer_other": "{{count}} Ziele",
  "cmd.audit": "Audit-Log (in Analytics)",
  "toast.dismiss": "Schließen",
  "page.placeholder":
    "Dieser Screen wird in einem späteren Task gebaut. App-Shell, Navigation und Rollenlogik stehen.",
  "status.entwurf": "Entwurf",
  "status.offen": "Offen",
  "status.pruefung": "In Prüfung",
  "status.validiert": "Validiert",
  "status.abgelehnt": "Abgelehnt",
  "status.revalidierung": "Re-Validierung",
  "status.konflikt": "Konflikt",
  "quality.preliminary": "Vorläufig",
  "quality.reliable": "Belastbar",
  "quality.assured": "Gesichert",
  "evidence.percentSure": "Prüfstand: {{pct}} %",
  // AUFTRAG-mega51 BLOCK D1: der Balken sagt jetzt, WAS er zeigt (title + aria-label).
  "evidence.confidenceLabel": "Prüfstand: {{pct}} von 100",
  "evidence.sourceDate": "Quelle vom {{date}}",
  "evidence.noDate": "kein Quelldatum",
  "evidence.noSource": "keine Quelle hinterlegt",
  "evidence.internalSource": "interne Quelle",
  "evidence.more": "+{{count}} weitere",
  "ko.read.evidenceZone": "Beleg",
  "ko.read.released": "Freigabe",
  "ko.read.category": "Kategorie",
  "ko.read.responsible": "Verantwortlich",
  "ko.read.version": "Version",
  "ko.read.captured": "Erfasst am",
  "ko.read.moreDetails": "Weitere Angaben (Bedingungen · Maßnahmen · Tags)",
  "intake.question": "Was weißt du, das andere wissen sollten?",
  "intake.calming": "Schreib einfach drauf los — Klarwerk hilft beim Strukturieren.",
  "intake.fieldPlaceholder": "Schreib einfach drauf los …",
  "intake.removeStarter": "Wissensart entfernen",
  "intake.exampleLabel": "So etwas — aber deins.",
  "intake.sampleBadge": "Beispiel",
  "intake.starter.decision": "Eine Entscheidung, die wir getroffen haben",
  "intake.starter.mistake": "Ein Fehler, den man leicht macht",
  "intake.starter.howItWorks": "Wie etwas bei uns wirklich läuft",
  "intake.starter.changed": "Etwas, das sich geändert hat",
  "intake.prefill.decision": "Wir haben entschieden, ",
  "intake.prefill.mistake": "Ein häufiger Fehler ist, ",
  "intake.prefill.howItWorks": "Bei uns läuft das so: ",
  "intake.prefill.changed": "Geändert hat sich, dass ",
  "intake.sample.title": "Not-Aus vor jeder Wartung ziehen",
  "intake.sample.statement":
    "Vor jeder Wartung an Linie 3 zuerst den Not-Aus ziehen und gegen Wiedereinschalten sichern.",
  "intake.live.idle": "Ich höre zu …",
  "intake.live.checking": "Prüfe gegen euren Wissensstand …",
  "intake.live.new": "Das ist neu — dazu gibt es noch nichts. Du bist die erste Person.",
  "intake.live.similarLead": "Ähnliches existiert schon:",
  "intake.live.similarAsk": "Ergänzen oder neu?",
  "intake.live.conflictLead": "Achtung — könnte widersprechen:",
  // JOB 3045: Label der Fundortzeile. Behauptet nichts über den Inhalt, nennt nur den Ort — was
  // dahinter steht, kommt roh aus dem Bestand (Kategorie) bzw. aus der StatusPill (Zustand).
  "intake.live.fundort": "Liegt in:",
  "intake.live.pruefstand.offen": "noch nicht geprüft",
  "intake.live.pruefstand.validiert": "Validiert",
  "intake.live.openKo": "Ansehen",
  // JOB 3556: Der frühere Satz zur laufenden Widerspruchsprüfung ist hier GESTRICHEN (in allen drei
  // Sprachen). Er behauptete zweierlei in einem — „nichts Ähnliches gefunden" UND „auf Widerspruch
  // noch nicht geprüft" —, und das Erste folgt nicht aus dem Prüfstatus. Seit JOB 3427 sagt das
  // Blatt nur die belegte Hälfte, mit eigenem Satz am Ort des Prüfstatus.
  "intake.live.unavailable": "Prüfung derzeit nicht verfügbar.",
  "intake.structure.heading": "Klarwerk schlägt vor — tipp an, was nicht passt:",
  "intake.structure.title": "Titel",
  "intake.structure.category": "Kategorie",
  "intake.structure.source": "Vermutete Quelle",
  "intake.structure.derived": "aus deinem Text abgeleitet",
  "intake.structure.categoryPlaceholder": "z. B. Wartung, Sicherheit …",
  "intake.done.heading": "Geschafft.",
  "intake.done.checked": "In euren gemeinsamen Wissensstand aufgenommen.",
  "intake.done.credited": "Dein Name ({{name}}) ist als Autor hinterlegt.",
  "intake.done.findable": "Wer das nächste Mal danach fragt, findet es — nicht dich.",
  "intake.done.viewKo": "Wissensobjekt ansehen",
  "intake.done.followUp": "Mich bei Rückfragen dazu benachrichtigen",
  "intake.submit": "Wissen ablegen",
  "dcmp.noValue": "Kein Wert vorhanden",
  "dcmp.none": "keine",
  "dcmp.trustStatus": "Vertrauen {{trust}}; Status {{status}}; benötigte Prüfungen {{needed}}",
  "dcmp.tagsCategory": "Kategorie {{category}}; Wissensart {{type}}; Tags {{tags}}",
  "dcmp.note.koMissing": "Score nicht vorhanden: mindestens ein Wissensobjekt fehlt.",
  "audit.action.ko_created": "Angelegt",
  "audit.action.ko_revised": "Überarbeitet",
  "audit.action.ko_rated": "Bewertet",
  "audit.action.ko_admin_validated": "Admin-validiert",
  "audit.action.ko_deleted": "Gelöscht",
  "audit.action.ko_purged": "Endgültig gelöscht",
  "audit.action.ko_restored": "Wiederhergestellt",
  "audit.action.ko_assigned": "Zugewiesen",
  "audit.action.ko_attached": "Anhang hinzugefügt",
  "audit.action.ko_detached": "Anhang entfernt",
  "audit.action.ko_author_transferred": "Autor übertragen",
  "audit.action.ko_category_changed": "Kategorie geändert",
  "audit.action.ko_commented": "Kommentiert",
  // JOB 4146: die zwei Vorgänge am Diskussionsfaden. Sie stehen in der Herkunftskette wie jeder
  // andere Beleg — und sie heissen dort ebenfalls „geklärt", nicht „freigegeben".
  "audit.action.ko_comment_resolved": "Diskussion geklärt",
  "audit.action.ko_comment_reopened": "Diskussion wieder geöffnet",
  "audit.action.ko_confidentiality": "Vertraulichkeit geändert",
  "audit.action.ko_conflict_review": "Konflikt-Review",
  "audit.action.ko_returned_to_author": "An Autor zurückgegeben",
  // JOB 557 D8: Die Rückgabe zur Nacharbeit trägt seit D8 zwei Namen — je nachdem, wer wirklich
  // zuständig ist. Der Schlüssel darüber bleibt unverändert und gilt für den Autor-Fallback und
  // für alle historischen Ereignisse; dieser hier benennt die Rückgabe an eine BENANNTE
  // Eigentümerin. Ein Protokoll, das beide Fälle gleich beschriftet, sagt der lesenden Person
  // etwas Falsches darüber, wer etwas tun muss.
  "audit.action.ko_returned_to_owner": "An Eigentümer zurückgegeben",
  "audit.action.ko_source_added": "Quelle hinzugefügt",
  "audit.action.ko_source_removed": "Quelle entfernt",
  // ================================================================================================
  // JOB 3384 (UX-26): DIE ACHT KO-EREIGNISSE, DIE DIE HERKUNFTSKETTE ALS PROGRAMMBROCKEN ZEIGTE.
  // ================================================================================================
  //
  // Die Herkunftskette (`MehrAbschnitte.tsx:1066`) beschriftet jede Zeile über `auditActionLabel`.
  // Fehlt der Schlüssel, greift dort der sprachunabhängige Rückfall („Trenner → Leerzeichen",
  // `auditAction.ts:18`) — genau daraus entstand Pedis „ask query" (Nutzungsprüfung 06.09., N-0053).
  //
  // GEMESSEN, NICHT GERATEN: aufgenommen ist nur, was der Dienst nachweislich MIT DEM KO ALS ZIEL
  // schreibt — denn nur solche Ereignisse zeigt `koAuditEvents` (`koLineage.ts:12-14`, Filter
  // `target === ko.id`). Jede Zeile nennt ihre Schreibstelle. Ereignisse mit anderem Ziel
  // (`conflict.*` → Konflikt-Id, `overlap.*` → Überschneidungs-Id, `*.settings.set` → "settings",
  // `library.import` → "library", `demoPackage.*`/`examples.load`/`lesevarianten.load` → Paket-Id)
  // erscheinen hier nie und bekommen deshalb bewusst KEINEN Schlüssel: ein Name für ein Ereignis,
  // das diese Fläche nicht zeigt, wäre eine Behauptung ohne Beleg.
  //
  // Der Rückfall in `auditAction.ts:18` bleibt und wird NICHT entfernt: er ist die ehrliche Antwort
  // auf einen Code, den niemand vorhergesehen hat.
  "audit.action.ask_query": "Frage gestellt",
  "audit.action.answer_helpful": "Antwort als hilfreich bewertet",
  "audit.action.ko_document_appended": "Dokument angefügt",
  "audit.action.ko_ownership": "Zuständigkeiten geändert",
  "audit.action.ko_ownership_role": "Zuständigkeit einer Rolle geändert",
  "audit.action.ko_tags_changed": "Schlagwörter geändert",
  "audit.action.ko_create_followup_failed": "Nacharbeit nach dem Anlegen fehlgeschlagen",
  "audit.action.ko_create_rollback_failed": "Rücknahme des Anlegens fehlgeschlagen",
  // JOB 3140 (UX-11): Die Nutzer-Aktionen des Prüfprotokolls hatten bis hierher KEINEN einzigen
  // Schlüssel — `audit.action.*` gab es nur für Wissensobjekte. Jede Rollenänderung, jede Anmeldung
  // erschien deshalb als roher Code („user.role-change"). Benannt wird genau, was
  // `services/auth/src/service.ts` nachweislich schreibt; für nicht belegte Aktionen bleibt die
  // neutrale Humanisierung aus `lib/auditAction.ts` zuständig.
  "audit.action.user_role_change": "Rolle geändert",
  "audit.action.user_approve": "Konto freigegeben",
  "audit.action.auth_login": "Angemeldet",
  "audit.action.auth_logout": "Abgemeldet",
  "audit.action.notice_acknowledged": "Hinweis zur Kenntnis genommen",
  "audit.action.user_oidc_provisioned": "SSO-Konto angelegt",
  "audit.action.user_role_synced": "Rolle mit dem Anbieter abgeglichen",
  "audit.action.user_role_claim_missing": "Rollen-Angabe des Anbieters fehlt",
  // JOB 3140 (UX-11): die Beschriftungen der Detailzeilen. „nicht gespeichert" ist eine erlaubte,
  // sogar geforderte Antwort — die alte Rolle wurde vor diesem Auftrag nicht mitgeschrieben und
  // wird nicht erfunden. „Konto nicht mehr vorhanden" ist dagegen eine Tatsachenaussage und
  // erscheint nur nach einer erfolgreichen Verzeichnisantwort (s. lib/auditEventDetail.ts §9);
  // solange die aussteht, stehen die beiden schwächeren Sätze da.
  "audit.detail.event": "Ereignis",
  "audit.detail.actor": "Ausgeführt von",
  "audit.detail.target": "Betroffen",
  "audit.detail.targetObject": "Betroffenes Objekt",
  "audit.detail.systemActor": "System (automatisch)",
  "audit.detail.roleBefore": "Rolle vorher",
  "audit.detail.roleAfter": "Rolle nachher",
  "audit.detail.notStored": "nicht gespeichert",
  "audit.detail.accountGone": "Konto nicht mehr vorhanden",
  "audit.detail.nameLoading": "Name wird geladen",
  "audit.detail.nameUnavailable": "Name nicht abrufbar",
  "ktype.bauchgefuehl": "Intuition",
  "ktype.best_practice": "Best Practice",
  "ktype.lernkurve": "Lernkurve",
  "ktype.technik": "Technik",
  "ktype.negativwissen": "Negativwissen",
  // AUFTRAG-mega38 BLOCK I: „Reasoner" ist der Hausname der KI-Maschine — auf den Flaechen,
  // die die Testerin sieht, heisst er schlicht KI. (Die Admin-Flaechen behalten ihn: dort ist
  // er ein Bezeichner mit Wiedererkennungswert. S. Bericht mega38, Block I.)
  "reasoner.draftLabel": "KI-Entwurf · nicht validiert",
  "reasoner.taskInfo.title": "Welche KI arbeitet hier?",
  "reasoner.taskInfo.cloud": "Cloud-KI",
  "reasoner.taskInfo.local": "Lokales Modell",
  "reasoner.taskInfo.rule": "Regelbasiert (ohne KI-Modell)",
  "reasoner.taskInfo.unknown": "Wird ermittelt …",
  "reasoner.taskInfo.bodyCloud":
    "Diese Aufgabe läuft über eine Cloud-KI. Inhalte werden dafür an den externen Anbieter gesendet.",
  "reasoner.taskInfo.bodyLocal":
    "Diese Aufgabe läuft über ein lokales Modell auf eurer eigenen Hardware — die Inhalte verlassen das Haus nicht.",
  "reasoner.taskInfo.bodyRule":
    "Diese Aufgabe läuft rein regelbasiert, ohne KI-Sprachmodell — deterministisch und ohne externen Versand.",
  "reasoner.taskInfo.bodyUnknown":
    "Die aktuelle KI-Zuordnung wird geladen. Details stehen in der KI-Verwaltung.",
  "reasoner.taskInfo.modelLabel": "Modell",
  "reasoner.taskInfo.dsgvoInhouse": "DSGVO-konform",
  "reasoner.taskInfo.dsgvoInhouseBody":
    "Läuft im Haus (lokal bzw. regelbasiert) — die Daten bleiben hier und werden nicht an Dritte übermittelt.",
  "reasoner.taskInfo.dsgvoExternal": "Externe Verarbeitung",
  "reasoner.taskInfo.dsgvoExternalBody":
    "Nutzt einen externen Cloud-Anbieter — die DSGVO-Konformität hängt vom Auftragsverarbeitungsvertrag (AVV) mit dem Anbieter ab.",
  // PAKET 1 (D-AISTATE, Pedi 23.07.): ehrlicher Hinweis am HART ausgegrauten KI-Knopf, wenn für die
  // Aufgabe kein Modell nutzbar ist — kein stiller Fallback, der „KI läuft" vortäuscht.
  "ai.unavailable.hint": "KI nicht verfügbar — für diese Aufgabe ist kein Modell aktiv.",
  "ai.statusUnknown.hint":
    "KI-Status unbekannt — der Statusabruf ist fehlgeschlagen. Deshalb bleibt die KI-Antwort vorsorglich gesperrt.",
  "provenance.original": "ursprünglich",
  "uikit.sampleStatement": "Druckabfall an Presse P2 sitzt meist an Ventil V4, nicht an der Pumpe.",
  "state.loading": "Lädt …",
  "state.error": "Etwas ist schiefgelaufen.",
  // JOB 3034 R2: der Hinweis NEBEN den weiterhin sichtbaren Werten, wenn eine Auffrischung des
  // vorhandenen Standes scheiterte (REGELN Punkt 7). Er ersetzt die Werte nicht.
  "state.staleRefetchFailed": "Stand von {{zeit}} · Auffrischung fehlgeschlagen",
  "modal.close": "Schließen",
  "nav.guard.title": "Ungespeicherte Eingabe",
  "nav.guard.body": "Du hast beim Erfassen noch nicht gespeicherten Inhalt. Was möchtest du tun?",
  "nav.guard.stay": "Hier bleiben",
  "nav.guard.discard": "Verwerfen und wechseln",
  "nav.guard.save": "Entwurf speichern und wechseln",
  "nav.guard.unsavableTitle": "Nicht alles kann gesichert werden",
  "nav.guard.unsavableLead":
    "Diese Inhalte kann der Entwurf nicht sichern — beim Wechsel gehen sie verloren:",
  "nav.guard.unsavableHint":
    "Bleib hier, um sie zu verwenden oder zu entfernen; „Verwerfen und wechseln“ gibt sie bewusst auf. Ein Speichern, das diese Inhalte mitnimmt, gibt es nicht.",
  // Bug (Pedi 04.07.): Fehlergrenze statt weißer Seite.
  "error.title": "Diese Ansicht konnte nicht geladen werden.",
  "error.body":
    "Das ist ein Anzeige-Fehler, kein Datenverlust. Bitte lade die Seite neu. Tritt es erneut auf, hilft der Detailtext unten beim Melden.",
  "error.reload": "Neu laden",
  "error.detail": "Detail",
  "state.empty": "Nichts vorhanden.",
  "auth.tagline": "Erfahrungswissen, das im Unternehmen bleibt.",
  "auth.taglineSub": "Erfassen · Validieren · Klären · Beantworten · Pflegen.",
  "auth.title.login": "Anmelden",
  "auth.title.register": "Konto anlegen",
  "auth.title.waiting": "Fast geschafft",
  "auth.title.setup": "Ersteinrichtung",
  "auth.sub.login": "Melde dich mit deinem Konto an.",
  "auth.sub.register": "Lege ein Konto an — ein Admin gibt dich frei.",
  "auth.sub.waiting": "Dein Konto wartet auf Freigabe.",
  "auth.sub.setup": "Das erste Konto wird Administrator.",
  "auth.waitingNote":
    "Ein Administrator muss deinen Zugang freischalten. Du wirst benachrichtigt, sobald es so weit ist.",
  "auth.backToLogin": "Zurück zur Anmeldung",
  "auth.name": "Name",
  "auth.email": "E-Mail",
  "auth.password": "Passwort",
  // JOB 1097 / D-026: die Längenregel stand bisher nur als `minLength` im Markup — sie EXISTIERTE,
  // wurde aber nirgends angeschrieben, und der Nutzer erfuhr sie erst im Fehlschlag. Auf der
  // Adminseite sagt das Produkt es längst („Passwort (mind. 8 Zeichen)"); auf der öffentlichen
  // Maske nicht. Eigener Schlüssel statt Wiederverwendung von `adm.field.password`: dort ist die
  // Regel Teil der Feldbeschriftung, hier ein Zusatz zu einer bestehenden Beschriftung.
  "auth.passwordRule": "mind. 8 Zeichen",
  "auth.passwordRepeat": "Passwort wiederholen",
  "auth.passwordMismatch": "Die Passwörter stimmen nicht überein.",
  // WP-VIP2-GATE (bens P1): Selbstregistrierung serverseitig abgeschaltet (Einladungs-Betrieb).
  "auth.registrationDisabled":
    "Registrierung nur per Einladung — bitte wende dich an deinen Admin.",
  // JOB 4081: DIE ABSAGE ALS AUSKUNFT STATT ALS SACKGASSE. `auth.registrationDisabled` stand im
  // allgemeinen Fehlerkasten — neben Tippfehlermeldungen, ohne eigene Kennzeichnung, und beim
  // nächsten Moduswechsel war er weg. Diese zwei Sätze stehen auf einer eigenen Fläche und bleiben
  // für den Besuch stehen: erst die Tatsache, dann der Weg. Zwei Schlüssel und nicht einer, weil
  // die Fläche beides getrennt zeigt — was gilt, und was die Person tun soll.
  "auth.registrationClosed.fact":
    "Zugänge werden in dieser Installation vergeben. Ein Konto selbst anzulegen ist hier nicht vorgesehen.",
  "auth.registrationClosed.next":
    "Bitte eine Person mit Administratorrecht in deinem Unternehmen um eine Einladung — sie richtet dir den Zugang ein.",
  // JOB 4105: dieselbe Lage, aber OHNE vorangegangenen Versuch — hier ist nichts abgewiesen worden,
  // über das zu berichten wäre. Gesagt wird der Zustand der Installation und der Ausweg.
  "auth.registrationClosed.upfrontFact":
    "Auf dieser Installation werden Zugänge vergeben, nicht selbst angelegt. Eine Registrierung ist hier nicht möglich.",
  "auth.registrationClosed.upfrontNext":
    "Wende dich an eine Person mit Administratorrecht in deinem Unternehmen — sie legt dein Konto an und lädt dich ein.",
  "auth.submit.login": "Anmelden",
  "auth.submit.register": "Registrieren",
  "auth.submit.setup": "Admin anlegen & starten",
  "auth.toRegister": "Noch kein Konto? Registrieren",
  "auth.toLogin": "Schon ein Konto? Anmelden",
  "auth.toForgot": "Passwort vergessen?",
  "auth.title.forgot": "Passwort zurücksetzen",
  "auth.sub.forgot": "Wir senden dir einen Link zum Zurücksetzen.",
  "auth.submit.forgot": "Link senden",
  "auth.title.forgotSent": "E-Mail unterwegs",
  "auth.sub.forgotSent": "Prüfe dein Postfach.",
  "auth.forgotNote":
    "Falls ein Konto mit dieser E-Mail existiert, haben wir einen Link zum Zurücksetzen gesendet. Der Link ist 1 Stunde gültig.",
  "auth.title.reset": "Neues Passwort",
  "auth.sub.reset": "Wähle ein neues Passwort für dein Konto.",
  "auth.newPassword": "Neues Passwort",
  "auth.submit.reset": "Passwort speichern",
  "auth.resetDone": "Dein Passwort wurde geändert. Du kannst dich jetzt anmelden.",
  "auth.resetInvalid": "Dieser Link ist ungültig oder abgelaufen.",
  "auth.toSignIn": "Zur Anmeldung",
  "auth.or": "oder",
  "auth.ssoButton": "Mit SSO anmelden",
  "auth.ssoUnavailable": "SSO ist für diese Instanz nicht konfiguriert.",
  "auth.ssoTitle": "SSO-Anmeldung",
  "auth.ssoBusy": "Anmeldung wird abgeschlossen …",
  "auth.ssoIncomplete": "Unvollständige SSO-Antwort. Bitte erneut anmelden.",
  "cycle.title": "Der Klarwerk-Wissenskreis",
  // AUFTRAG-mega38 BLOCK G1: „Kein Chatbot: …" definierte ueber eine Verneinung — der Satz
  // sagte zuerst, was Klarwerk NICHT ist. Jetzt sagt er, was es tut.
  "cycle.subtitle": "Wissen wird erfasst, validiert, genutzt und aktuell gehalten.",
  // SCRUM-290: kompakter Stage-1 Demo-/Pilotpfad (Start → Ask → Library/KO-Detail → Validation).
  "demo.title": "Demo-/Pilotpfad in 3 Schritten",
  "demo.subtitle":
    "Ein kleiner realer Ablauf: quellengebunden fragen, Quelle/Vertrauen/Status/Version ansehen, ungeprüftes Wissen zur Validierung geben.",
  // SCRUM-301: sichtbare Pilot-Beweiskette (Start verspricht, Library/KO-Detail lösen ein).
  "demo.proof.label": "Beweiskette",
  "demo.proof.find": "Wissen finden",
  "demo.proof.usability": "Nutzbarkeit erkennen",
  "demo.proof.verify": "Quelle/Vertrauen/Version prüfen",
  // SCRUM-308: Herkunfts-Kennzeichnung für Demo-/Seed-Wissen (nur Kontext, kein Qualitätssignal).
  "demo.badge.label": "Demo-Beispiel",
  "demo.badge.hint":
    "Beispiel-/Pilotwissen aus dem Demo-Seed. Nur Herkunft — ersetzt nicht Status, Vertrauen, Quelle oder Validierung. Validiert bleibt validiert, offen bleibt offen.",
  "ko.externalUnchecked.label": "Enthält externes, ungeprüftes Wissen",
  "ko.externalUnchecked.hint":
    "In diesen Artikel wurde Wissen aus einer öffentlichen KI oder Websuche übernommen. Es ist extern und ungeprüft — bitte fachlich prüfen; Status/Vertrauen/Validierung ersetzt es nicht.",
  // JOB 679 / D2 (K1.2): Herkunfts-Kennzeichnung für Wissen aus dem Word-Add-in. Wie das
  // Demo-Badge NUR Herkunft — kein Qualitäts-, Status- oder Vertrauenssignal.
  "ko.originWordAddin.label": "Aus Word",
  "ko.originWordAddin.hint":
    "Dieser Beitrag wurde über das Word-Add-in erfasst. Nur Herkunft — ersetzt nicht Status, Vertrauen, Quelle oder Validierung.",
  // JOB 3027 · Station 4: die übrigen vier Erfassungswege bekommen ihren Klartext — bis hierher
  // hatte nur `word_addin` einen, und der bleibt unverändert (keine zweite Fassung desselben Satzes).
  "ko.origin.tell": "Aus dem Erzählen",
  "ko.origin.studio": "Aus dem Studio",
  "ko.origin.expert": "Aus dem Expertenformular",
  "ko.origin.frontdoor": "Aus der Erfassung",
  // R-0180/R-2108: aus der Import-Prüfwarteschlange von einem Menschen übernommen.
  "ko.origin.import": "Importiert",
  // JOB 3027 · Station 4: die drei Lagen je Auskunft am Prüfbrett. „nicht eingestuft“ ist eine
  // Aussage über das OBJEKT, „nicht in dieser Antwort“ eine über die ANTWORT — wer beide zusammen-
  // wirft, muss raten (services/validation/src/board-herkunft.ts:10-18).
  "val.stufe.nichtEingestuft": "nicht eingestuft",
  "val.stufe.auskunftFehlt": "Einstufung nicht in dieser Antwort",
  // JOB 3112 · V3 (Pedi, Entscheidung 32 vom 06.09.2026): die Stufenfrage beim Freigeben. Sie
  // FRAGT — sie verlangt nicht. Der Übergeh-Weg steht gleichberechtigt daneben, und die Stufennamen
  // kommen aus `conf.level.*`; hier wird kein zweiter Wortlaut für dieselbe Sache erfunden.
  "val.stufenfrage.frage": "Welche Vertraulichkeitsstufe gilt für diesen Eintrag?",
  "val.stufenfrage.ohneStufe": "Ohne Stufe freigeben",
  "val.stufenfrage.abbrechen": "Abbrechen",
  "val.stufenfrage.fehler":
    "Nicht gespeichert — es wurde nichts freigegeben. Bitte erneut versuchen.",
  // RUNDE 2 (Ben, Korrekturpflicht 2): der Weg hat zwei Serveraufrufe und damit einen dritten
  // Ausgang — die Stufe LIEGT, die Freigabe scheiterte. „Nicht gespeichert“ wäre dort schlicht
  // unwahr; der Zwischenstand bekommt deshalb einen eigenen Wortlaut, der die Stufe beim Namen nennt.
  "val.stufenfrage.nurNochFreigeben": "Die Stufe ist gespeichert — es fehlt nur noch die Freigabe.",
  "val.stufenfrage.fehlerNachStufe":
    "Die Stufe „{{stufe}}“ ist gespeichert. Die Freigabe selbst schlug fehl — der Eintrag ist NICHT freigegeben.",
  "val.stufenfrage.wiederholen": "Freigabe wiederholen",
  // JOB 3112 · V3 (2623 D1 §2 Punkt 3): der Paarhinweis auf der Prüfkarte. Er sagt DASS, nie WAS —
  // Titel und Inhalt der Gegenseite bleiben draußen. Ein Gegensatz-Satz („keine Dublette") ist
  // ausdrücklich NICHT vorgesehen: `/api/duplicates` liefert nur die sichtbaren Paare.
  "val.doppel.satz": "Zu diesem Eintrag liegt ein zweites Exemplar im Bestand: {{beziehung}}.",
  "val.doppel.satzMehrere":
    "Zu diesem Eintrag liegen {{n}} überschneidende Exemplare im Bestand — stärkste Überschneidung: {{beziehung}}.",
  "val.doppel.vergleich": "Vergleich öffnen",
  // R-0247 (Pedis Entscheidung 73b53301, weiche Sperre): die ausdrückliche Bestätigung vor dem
  // Validieren, solange eine offene Dublette vorliegt. Keine Sperre, keine Auflösung der Dublette.
  "val.doppel.bestaetigung.frage":
    "Zu diesem Eintrag liegt eine offene Dublette vor. Bitte bestätigen Sie, dass Sie sie gesehen haben, bevor Sie validieren.",
  "val.doppel.bestaetigung.ja": "Dublette gesehen — trotzdem validieren",
  "val.doppel.bestaetigung.abbrechen": "Abbrechen",
  // Bewusst NICHT „Herkunft“: dieses Wort trägt auf derselben Seite schon der Demo-/Eigenes-Filter
  // (`lib.originLabel`). Zwei Sachen, ein Wort — genau die Verwechslung wird hier vermieden.
  "val.herkunft.label": "Erfassungsweg",
  "val.herkunft.unbekannt": "Herkunft unbekannt",
  "val.herkunft.auskunftFehlt": "Herkunft nicht in dieser Antwort",
  // JOB 3027 R2: der Stand bleibt stehen, wenn eine Auffrischung scheitert — und sagt genau das.
  // Keine Aktualitätsbehauptung, sondern ihr Gegenteil.
  "val.refreshFailed":
    "Die Auffrischung ist gescheitert. Angezeigt wird der zuletzt geladene Stand — er kann veraltet sein.",
  "demo.ask.label": "1 · Fragen",
  "demo.ask.desc":
    "Stell eine belegte Frage (Ventil X / Überdruck) — die Antwort kommt quellengebunden mit Vertrauen und Status, nicht frei erfunden.",
  "demo.library.label": "2 · Wissen ansehen",
  "demo.library.desc":
    "Im Wissensbestand Quelle, Vertrauen, Status und Reife sehen — ein Objekt öffnen zeigt Belege und Version.",
  "demo.validation.label": "3 · Validieren",
  "demo.validation.desc":
    "Offenes/ungeprüftes Wissen gehört in die Validierung — bewerten, bis es gesichert und nutzbar ist.",
  // SCRUM-296: aktiver Erfassungsfluss im Demo-Kontext (Capture → Validation → Use).
  "demo.captureEntry": "Aktiv ausprobieren: Erfassen → Prüfen → Nutzen",
  "demo.banner.capture.title": "Erfahrungsnotiz erfassen",
  "demo.banner.capture.body":
    "Gespeichert wird ein OFFENES Wissensobjekt — noch nicht validiert. Nächster Schritt: zur Prüfung/Validierung. Erst nach ausreichender Bewertung ist es quellengebunden nutzbar; automatisch validiert wird nichts.",
  "demo.banner.capture.next": "Weiter: Zur Prüfung",
  // SCRUM-291: wiedererkennbare Pfad-Hinweisboxen auf den Zielseiten (nur bei ?demo=stage1).
  "demo.banner.tag": "Demo-Pfad",
  "demo.banner.ask.title": "Schritt 1: Quellengebunden fragen",
  "demo.banner.ask.body":
    "Die Antwort kommt mit Vertrauen und Quelle — nicht frei erfunden. Achte auf Status/Vertrauen und sieh dann die Quelle/das Objekt an.",
  "demo.banner.ask.next": "Weiter: Wissen ansehen",
  "demo.banner.library.title": "Schritt 2: Quelle, Vertrauen, Status, Reife ansehen",
  "demo.banner.library.body":
    "Hier siehst du je Objekt Quelle, Vertrauen, Status und Reife/Version. Bei offener/ungeprüfter Quelle geht es weiter zur Validierung.",
  "demo.banner.library.next": "Weiter: Validieren",
  "demo.banner.detail.title": "Wissensobjekt: Status, Vertrauen, Version, Quellen prüfen",
  "demo.banner.detail.body":
    "Hier siehst du, worauf Nutzbarkeit beruht: Status, Vertrauen, Version und Belege. Wenn es nutzbar ist, unten „Wissen nutzen“ — die Frage bleibt quellengebunden, nichts wird automatisch gesichert.",
  "demo.banner.validation.title": "Schritt 3: Offenes Wissen bewerten",
  "demo.banner.validation.body":
    "Hier wird offenes/ungeprüftes Wissen bewertet. Ziel: aus Review-Arbeit gesichertes, nutzbares Wissen machen.",
  "cycle.capture.label": "Erfassen",
  // AUFTRAG-mega38 BLOCK I: „Knowledge Object" — das Produkt sagt ueberall sonst „Wissensobjekt".
  "cycle.capture.desc": "Erfahrungswissen als Wissensobjekt sichern.",
  "cycle.validate.label": "Validieren",
  "cycle.validate.desc": "Im Team prüfen, bis Vertrauen und Status belastbar sind.",
  "cycle.use.label": "Nutzen",
  "cycle.use.desc": "Quellengebunden in Antworten und Output verwenden.",
  "cycle.maintain.label": "Aktuell halten",
  "cycle.maintain.desc": "Bei Änderungen revalidieren — Wissen bleibt gültig.",
  "kg.start.title": "So liest du Klarwerk",
  "kg.start.body":
    "Klarwerk trennt konsequent nutzbares Wissen von Review-Arbeit: Erst prüfen, dann verwenden.",
  "kg.library.title": "Reife der Treffer",
  "kg.library.body":
    "Die Reife-Plakette zeigt, ob ein Treffer direkt nutzbar ist oder in die Prüfung gehört.",
  "kg.ask.title": "Antworten sind quellengebunden",
  "kg.ask.body":
    "Die Fragen-Seite nutzt den Wissensbestand; offene oder ungeprüfte Quellen werden markiert und zur Validierung geführt.",
  "kg.secured.label": "Gesichert",
  "kg.secured.body":
    "Validiertes Wissen ist nutzbar und bleibt über Quellen, Vertrauen und Version nachvollziehbar.",
  "kg.review.label": "Zu prüfen",
  "kg.review.body":
    "Offenes oder in Prüfung befindliches Wissen gehört in die Validierung, nicht in die Nutzung.",
  "kg.sourceBound.label": "Quellengebunden",
  "kg.sourceBound.body":
    "Antworten entstehen aus Wissensobjekten — ohne Grundlage wird eine Lücke angelegt.",
  // JOB 3015 D5 „KonsoleStart": die Startseite beginnt mit der Frage des Zielbilds
  // (KonsoleStart.dc.html Z.27–60). Kicker „Übersicht" und Gruß „Guten Tag, {{name}}." sind mit
  // ihr entfallen — der Name steht in der Seitenleiste (shell/Sidebar.tsx). Wortlaute wörtlich
  // aus dem Zielbild; die Pille trägt die echte Zahl des Prüfboards, kein Platzhalter.
  // JOB 3064 H5: Untertitel, die drei Kartentexte und die Pille „N offen" sind mit den drei
  // Konsolenkarten entfallen — ihre Ziele stehen in Navigation und Kopfband, die offene Zahl im
  // Prüf-Badge der Leiste. Die drei verbliebenen Schlüssel tragen das Zielbild `Main.dc.html`:
  // Überschrift (Z.37), Feldtext (Z.40) und der Leitsatz, der ins „…"-Menü umgezogen ist.
  "start.konsole.frage": "Was möchtest du wissen?",
  "start.konsole.feld": "Frage oder Suchbegriff",
  "start.konsole.leitsatz": "Keine KI-Antwort ohne Beleg · Vertrauliches bleibt vertraulich",
  // JOB 3064 H5: die zwei Karten des Zielbilds und das „…"-Menü.
  "start.fuerdich.kicker": "FÜR DICH",
  "start.fuerdich.art.conflict": "Konflikt",
  "start.fuerdich.art.duplicate": "Duplikat",
  "start.fuerdich.art.gap": "Wissenslücke",
  "start.fuerdich.art.assignment": "Zuweisung",
  "start.fuerdich.art.impact": "Wirkung",
  "start.zuletzt.kicker": "ZULETZT",
  "start.zuletzt.heute": "heute",
  "start.zuletzt.gestern": "gestern",
  "start.zuletzt.leer": "Noch nichts erfasst.",
  // JOB 3762 · Lieferung 2/5: der Satz der LEEREN Instanz. Er sagt genau zwei Dinge, und beide sind
  // gemessen: der Bestand ist leer (`useKos` hat erfolgreich und frisch `[]` geliefert) und wo der
  // erste Schritt liegt. Keine Ursache, keine Vermutung, keine Zahl — das wäre eine Behauptung, die
  // die Fläche nicht messen kann (Lehre JOB 3741 R2 / JOB 3670 R1).
  "start.leer.ersterSchritt": "Noch kein Wissen im Bestand — das erste erfassen",
  // JOB 3762 · Runde 2: die Einordnung DIESER Zeile, solange ein Abruf läuft. Der bestätigte Stand
  // bleibt stehen (§9: „ohne zu flackern"), und daneben steht, dass er gerade nachgeprüft wird —
  // dieselbe Wortwahl wie `editor.imageSearch.refreshing`. Sie behauptet nichts über den Ausgang.
  "start.leer.auffrischung": "wird aufgefrischt …",
  "start.menu.label": "Mehr zu dieser Seite",
  "start.menu.ueber": "Über KLARWERK",
  "start.menu.klara": "Klara in Word",
  "start.menu.kreis": "Wissenskreis",
  "start.menu.demo": "Demo-Pfad",
  "start.menu.erst": "Ersteinrichtung",
  "start.menu.gerade": "Gerade",
  "start.menu.kapital": "Wissenskapital",
  "start.menu.kollision": "Eigene Objekte",
  "start.menu.stufe2": "Stufe 2",
  "start.menu.hilfe": "Hilfe zu dieser Seite",
  // AUFTRAG-mega38 BLOCK G1: der eine Satz — ohne ein einziges Fachwort, bejahend.
  "start.purpose":
    "Klarwerk sammelt, was deine Kolleginnen und Kollegen im Betrieb gelernt haben, damit du danach fragen kannst und siehst, woher jede Antwort stammt.",
  "start.ctaAsk": "Frage stellen",
  "start.ctaCapture": "Wissen erfassen",
  "start.ctaValidate": "Validierung öffnen",
  "klara.path.ariaLabel": "Klara — kommender Assistenzweg",
  "klara.path.kicker": "Mit Klara",
  "klara.path.soon": "Demnächst",
  "klara.path.start.title": "Klara begleitet Wissen von Anfang an.",
  "klara.path.start.body":
    "Bald kannst du Wissen direkt mit Klara festhalten, strukturieren und für die Prüfung vorbereiten.",
  "klara.path.start.cta": "Mit Klara Wissen erfassen",
  "klara.path.capture.title": "Erzähl es Klara — sie macht daraus einen klaren Entwurf.",
  "klara.path.capture.body":
    "Du gibst deine Erfahrung in eigenen Worten ein. Klara hilft beim Strukturieren; du prüfst und entscheidest.",
  "klara.path.capture.cta": "Mit Klara starten",
  "klara.path.import.title": "Klara bereitet importiertes Wissen mit dir auf.",
  "klara.path.import.body":
    "Nach dem Upload hilft Klara künftig beim Ordnen, Klären und Vorbereiten für die Prüfung.",
  "klara.path.import.cta": "Import mit Klara begleiten",
  "klara.path.helpLink": "Klara hilft dir schon heute in der Web-App — hier geht es zur Hilfe.",
  "klara.path.m365.summary": "Was Klara in Microsoft 365 tun wird",
  "klara.path.m365.body":
    "Klara ist als bidirektionales Add-in für Microsoft 365 geplant. Sie soll Wissen dort aufnehmen, wo du ohnehin arbeitest, es strukturiert für Klarwerk vorbereiten und geprüftes Unternehmenswissen aus Klarwerk direkt in Microsoft 365 bereitstellen — prüfen und entscheiden bleibt bei dir. Verfügbar ist das noch nicht.",
  "shelp.cycle.title": "Der Knowledge-OS-Kreis",
  "shelp.cycle.body":
    "Die vier Kacheln sind der Kreislauf deines Wissens: Erfassen → Validieren → Nutzen → Aktuell halten. Jede Kachel bringt dich direkt in den passenden Bereich. Du musst nicht alles auf einmal machen — fang bei dem an, was gerade ansteht. Es startet von selbst nichts.",
  "shelp.work.title": "Deine Arbeitsübersicht",
  "shelp.work.body":
    "Hier steht, was gerade wirklich auf dich wartet — aus echten Daten (offene Prüfungen, Konflikte, Wissenslücken), keine erfundene To-do-Liste. Die Zahl rechts sagt, wie viele es sind. Klick eine Zeile, um direkt dort weiterzuarbeiten. Erledigst du nichts, passiert nichts automatisch.",
  "shelp.severity.title": "Die farbigen Punkte",
  "shelp.severity.body":
    "Der Punkt links zeigt die Dringlichkeit: Rot = jetzt dran (blockiert oder kritisch), Gelb = heute sinnvoll, Grau = kann warten. Das ist nur eine Orientierung, kein Zwang — du entscheidest die Reihenfolge, und es wird nichts automatisch abgearbeitet.",
  "work.conflicts": "Konflikte lösen",
  "work.criticalGaps": "Kritische Wissenslücken",
  "work.revalidation": "Revalidierungen fällig",
  "work.validation": "Offene Validierungen",
  "work.learning": "Offene Lernpfad-Schritte",
  // AUFTRAG-mega51 BLOCK A: was die Rolle nicht öffnen kann, wird als Lage gezeigt — nicht als Weg.
  "roleLink.noReach": "Kein Zugriff",
  "roleLink.noReachHint":
    "Diese Fläche ist für deine Rolle nicht freigegeben. Die Angabe bleibt stehen, weil sie stimmt — nur der Weg dorthin ist für dich zu.",
  "start.stufe2.title": "Erweiterte Funktionen (Stufe 2)",
  "start.stufe2.body":
    "Stufe 2 sind zusätzliche Module über den Kernablauf hinaus. Als Admin stehen dir erweiterte Funktionen zur Verfügung: {{features}}. Schalte dazu „{{toggle}}' unten in der Seitenleiste ein.",
  "task.kicker": "Aufgaben",
  "task.critical": "Kritisch",
  "task.today": "Heute",
  "task.later": "Später",
  // JOB 3064 H5 §4: der Leerzustand ist EINE Zeile — „Nichts offen." — und der Weg dahinter steht
  // hinter dem Knopf „Wie geht es weiter?", nicht als Textwand daneben.
  "task.none": "Nichts offen.",
  "task.noneFiltered": "Kein Eintrag für diesen Filter.",
  "task.weiter": "Wie geht es weiter?",
  "task.erklaerung": "Was ist zu tun?",
  "task.filter.all": "Alle",
  "task.filter.validation": "Validierung",
  "task.filter.returned": "Nacharbeit",
  "task.filter.conflict": "Konflikte",
  "task.filter.gap": "Wissenslücken",
  "task.filter.revalidation": "Revalidierung",
  "task.conflict": "Konflikt",
  "task.validation": "Validierung",
  "task.revalidation": "Re-Validierung",
  "task.gap": "Wissenslücke",
  "task.gapRedacted": "Vertrauliche Wissenslücke",
  "task.returned": "Nacharbeit",
  "task.action.returned": "Entwurf überarbeiten",
  "task.action.conflict": "Konflikt entscheiden",
  "task.action.validation": "Wissen bewerten",
  "task.action.revalidation": "Gültigkeit prüfen",
  "task.action.gap": "Lücke priorisieren",
  "task.action.open": "Öffnen",
  // Pedi 05.07.: Klartext „was ist zu tun" je Aufgabe — ein Satz, direkt auf der Karte.
  "task.explain.returned":
    "Ein Prüfer hat dein Wissen zur Nacharbeit zurückgegeben. Öffne es, arbeite die Rückmeldung ein und reiche es erneut ein.",
  "task.explain.conflict":
    "Zwei Aussagen widersprechen sich. Öffne den Konflikt und entscheide, welche gilt (oder halte beide fest).",
  "task.explain.validation":
    "Prüfe dieses Wissen und gib eine Bewertung ab: Freigeben (grün), Rückfrage (gelb) oder Ablehnen (rot). Ab genug grünen Bewertungen gilt es als validiert.",
  "task.explain.revalidation":
    "Etwas hat sich geändert — bestätige, ob dieses Wissen noch gültig ist, oder gib es zur Überarbeitung.",
  "task.explain.gap":
    "Zu dieser Frage fehlt gesichertes Wissen. Priorisiere die Lücke oder erfasse selbst einen Beitrag dazu.",
  "task.explain.open": "Öffne diese Aufgabe, um den nächsten Schritt zu sehen.",
  // SCRUM-297: Knowledge-OS-Phase je Arbeit (nutzt die Kreis-Labels cycle.*.label).
  "task.phaseLabel": "Phase:",
  // AUFTRAG-mega38 BLOCK I: „Expert Studio" uebersetzt.
  "capture.kicker": "Wissen erfassen",
  "capture.title": "Erfahrungswissen festhalten",
  "capture.rescue.kicker": "Wissen retten",
  "capture.rescue.title": "Sichere Erfahrungswissen, bevor es verloren geht.",
  "capture.rescue.subtitle":
    "Du musst kein Formular perfekt ausfüllen — erzähl einfach, was du weißt. Klarwerk und die KI helfen dir, es klar und nutzbar zu machen.",
  "capture.rescue.step.tell.label": "1. Erzählen",
  "capture.rescue.step.tell.hint":
    "Schreib oder diktier in eigenen Worten, was du aus Erfahrung weißt — roh reicht.",
  "capture.rescue.step.structure.label": "2. KI strukturiert",
  "capture.rescue.step.structure.hint":
    "Die KI macht daraus einen klaren Entwurf; im Knowledge Studio kannst du alles in Ruhe nachbearbeiten.",
  "capture.rescue.step.validate.label": "3. Prüfen lassen",
  "capture.rescue.step.validate.hint":
    "Speichern reicht ein — danach prüfen Kolleg:innen das Wissen, bevor es gesichert genutzt wird.",
  "capture.rescue.impactTitle": "Warum dein Beitrag zählt",
  "capture.rescue.impact.secure": "Rettet Erfahrung, die sonst verloren ginge",
  "capture.rescue.impact.improve": "Verbessert die gemeinsame Wissensbasis",
  "capture.rescue.impact.honest": "Wird erst nach Prüfung als gesichert markiert",
  "capture.rescue.showLess": "Weniger",
  "capture.rescue.showMore": "Anleitung",
  // SCRUM-370: geführter Weg — Rohwissen → im Studio strukturieren (empfohlen) → prüfen & einreichen.
  "capture.flow.railKicker": "So gehst du vor",
  "capture.flow.step.raw.label": "Rohwissen erfassen",
  "capture.flow.step.raw.hint": "Erzähl in eigenen Worten, was du weißt — Stichpunkte reichen.",
  "capture.flow.step.studio.label": "Im Studio strukturieren",
  "capture.flow.step.studio.hint":
    "Der große Arbeitsraum mit KI-Hilfe macht daraus einen klaren Artikel — du übernimmst bewusst.",
  "capture.flow.step.review.label": "Prüfen & einreichen",
  "capture.flow.step.review.hint":
    "Speichern und zur Prüfung geben — gesichert gilt es erst danach.",
  "capture.flow.railKickerHint":
    "Das Knowledge Studio ist der empfohlene Weg — nichts wird erzwungen.",
  "capture.flow.studioRecommended": "Empfohlen",
  "capture.flow.studioLead":
    "Empfohlener nächster Schritt: im Knowledge Studio in Ruhe strukturieren. Das Formular bleibt dir erhalten.",
  "capture.flow.submitValue":
    "Dein Erfahrungswissen wird gesichert, bevor es verloren geht — erst nach der Prüfung gilt es als gesichert. Automatisch validiert wird nichts.",
  // SCRUM-384 (Pedi-Review): Wizard — ein Fokus je Schritt statt zweispaltiger Info-Wand.
  "capture.wizard.back": "Zurück zum Erzählen",
  "capture.wizard.structuring": "Die KI strukturiert dein Wissen …",
  "capture.wizard.condMeasures": "Bedingungen & Maßnahmen",
  "capture.wizard.condMeasuresHint":
    "Strukturiert abgeleitet aus deinem Wissen — wichtig für Prüfung und spätere Nutzung. Hier bei Bedarf anpassen.",
  "capture.wizard.helpers": "Hilfen, Vorlagen & Anhänge-Kontext",
  "capture.wizard.helpersHint": "Optionale Unterstützung — nichts davon ist Pflicht.",
  "capture.wizard.docLabel": "Deine Wissensseite",
  "capture.wizard.pageTitle": "Wissensseite bearbeiten",
  "start.orientation.title": "Orientierung: So liest du Klarwerk & der Demo-Pfad",
  "start.orientation.hint":
    "Beim ersten Besuch offen — danach hier eingeklappt und jederzeit aufklappbar.",
  "capture.wizard.titleLabel": "Titel",
  "capture.wizard.structData": "Kernaussage, Bedingungen & Maßnahmen",
  "capture.wizard.discard": "Verwerfen",
  // ==============================================================================================
  // JOB 1154 D2 — DIE SCHRITTLEISTE SAGT, WARUM EIN SCHRITT ZU IST.
  // ==============================================================================================
  // Bis hierher waren gesperrte Schritte nur ausgegraut. Wer die Bauart nicht kennt, sieht dann
  // drei tote Knoepfe und keinen Weg — besonders der zweite Schritt, der erst nach dem
  // Strukturieren aufgeht. Drei Zustaende, drei eigene Saetze: Es gibt genau drei Gruende, aus
  // denen ein Schritt zu ist, und sie verlangen verschiedene Reaktionen (nichts tun, erst
  // erzaehlen, ueber den Einreichen-Knopf gehen). Ein gemeinsamer Sammelsatz koennte das nicht
  // unterscheiden — deshalb prueft `capture-d030-i18n.test.tsx` (E3) ausdruecklich, dass die drei
  // Texte je Sprache paarweise verschieden bleiben.
  "capture.wizard.step.lockedCurrent": "Du bist bereits in diesem Schritt.",
  "capture.wizard.step.lockedNeedDraft":
    "Noch kein Entwurf: erzähl zuerst dein Wissen und lass es strukturieren.",
  "capture.wizard.step.lockedViaSubmit": "Dieser Schritt öffnet sich über „Prüfen & einreichen“.",
  "ko.couple.title": "Anlagen-Kopplung",
  "ko.deleteButton": "Wissensobjekt löschen",
  "ko.deleteQ":
    "Löschen? Der Beitrag wandert in den Papierkorb und ist dort 30 Tage vom Admin wiederherstellbar. Demo-Daten werden sofort endgültig gelöscht.",
  "ko.deleteKeep": "Behalten",
  "ko.deleteYes": "Ja, löschen",
  "ko.deleteDone": "Wissensobjekt gelöscht.",
  "ko.deleteAlreadyGone": "Wissensobjekt war bereits nicht mehr vorhanden. Liste aktualisiert.",
  "adm.ai.title": "KI-Verwaltung",
  "adm.purgeButton": "Demodaten entfernen",
  "adm.purgeQ":
    "Wirklich ALLE Demodaten löschen (auch von Testern veränderte)? Eigenes Wissen bleibt unberührt.",
  "adm.purgeKeep": "Abbrechen",
  "adm.purgeYes": "Ja, endgültig entfernen",
  "adm.purgeDone":
    "Demodaten entfernt: {{kos}} Wissensobjekte, {{conflicts}} Konflikte + {{duplicates}} Duplikate aufgelöst, {{gaps}} Wissenslücken, {{users}} Demo-Anwender.",
  "adm.seedSkippedInline":
    "Nicht geladen: Der Demo-Bestand ist bereits vorhanden (keine Dubletten). Über „Demodaten entfernen“ kannst du ihn gezielt entfernen und danach neu laden.",
  "adm.seedForce": "Demo-Bestand neu laden",
  // AUFTRAG-mega64 Block A: Bis mega64 standen die Kennwörter der Demo-Konten im Quelltext. Jetzt
  // erzeugt der Server bei jeder Neuanlage frische und nennt sie genau einmal — in der Antwort auf
  // diesen Ladevorgang. Der Text sagt beides ohne Umschweife: dass sie hier stehen, und dass es das
  // einzige Mal ist. Ein „bitte notieren" ohne die Begründung wäre eine Bitte; mit ihr ist es eine
  // Auskunft, aus der die Nutzerin die richtige Handlung selbst ableitet.
  "adm.seedCredsTitle": "Einmalkennwörter der neuen Demo-Konten",
  "adm.seedCredsHint":
    "Diese Kennwörter wurden gerade zufällig erzeugt und werden NUR HIER angezeigt. Der Server bewahrt sie nicht auf und kann sie nicht wiederholen. Notiere oder gib sie jetzt weiter — nach einem Neuladen dieser Seite sind sie weg, und die Konten brauchen dann einen Kennwort-Reset.",
  "adm.factory.title": "Werkseinstellungen",
  "adm.factory.help":
    "Setzt die lokale Instanz vollständig zurück: alle Wissensobjekte, Anwender, Konflikte, Lücken und Einstellungen werden gelöscht. Danach beendet sich das Programm; beim nächsten Start beginnt die Ersteinrichtung und der erste Anwender wird wieder Admin. Nur in der lokalen Desktop-Version verfügbar.",
  "adm.factory.hint":
    "Für wiederholte Tests: alles löschen und das Programm beenden. Nach dem Neustart ist wieder alles wie bei der ersten Einrichtung.",
  "adm.factory.button": "Auf Werkseinstellungen zurücksetzen",
  "adm.factory.confirm1": "Wirklich ALLE Daten löschen und das Programm beenden?",
  "adm.factory.passwordLabel": "Zur Bestätigung dein Admin-Passwort",
  "adm.factory.confirm2": "Letzte Warnung: Dieser Schritt ist unwiderruflich.",
  "adm.factory.warnBody":
    "ALLE Wissensobjekte, Konten und Einstellungen werden gelöscht und das Programm beendet. Das lässt sich nicht rückgängig machen.",
  "adm.factory.wrongPassword": "Falsches Passwort — der Werksreset wurde nicht ausgeführt.",
  "adm.factory.cancel": "Abbrechen",
  "adm.factory.continue": "Weiter",
  "adm.factory.execute": "Zurücksetzen & beenden",
  "adm.factory.restartHint":
    "Zurückgesetzt. Das Programm wird beendet — bitte die KLARWERK-App neu starten. Der erste Anwender wird dann wieder Admin.",
  "adm.factoryDone": "Werksreset ausgelöst — das Programm wird beendet.",
  "capture.tellResetQ": "Text und Anhänge wirklich verwerfen?",
  "capture.diktatListening": "Aufnahme läuft — sprich einfach, der Text erscheint unten im Feld.",
  "capture.diktatIdleHint": "Klick auf den Knopf und erzähl — kein Formular, keine Vorbereitung.",
  "adm.ai.help":
    "Bestimme global oder je Einsatz, welche KI arbeitet. „Auto“ nutzt das Modell, wenn ein Schlüssel hinterlegt ist; „Deterministisch“ arbeitet bewusst ohne Modell. Schlüssel bleiben ausschließlich auf dem Server — nie im Browser.",
  "adm.ai.internExtern":
    "Du kannst intern (On-Premise Enterprise AI, eigener LLM) oder extern (Cloud) arbeiten lassen — global als Standard oder fein je Aufgabe. Die interne Option erscheint, sobald ein eigener LLM erreichbar ist; beide lassen sich mit „Key testen“ / „Lokalen LLM testen“ live prüfen.",
  "adm.ai.status": "Aktiver Provider: {{provider}} · Modus: {{mode}}",
  "adm.ai.modeModel": "Modell",
  "adm.ai.modeDemo": "Deterministisch",
  // JOB 3337: die sieben Themen der Verwaltung (Vorlage, Tabelle „Innerhalb der Verwaltung").
  // „Konten" und „Sicherheit" heißen jetzt, wonach ein Kunde ohne Fachwissen sucht; „Daten" ist
  // ersatzlos weg, weil es vier Dinge aus vier Welten trug (Demodaten, Werk, Papierkorb, Audit).
  "adm.sec.konten": "Benutzer und Rollen",
  "adm.sec.ki": "KI",
  "adm.sec.quellen": "Quellen und Daten",
  "adm.sec.vorfuehrdaten": "Vorführdaten",
  "adm.sec.sicherheit": "Sicherheit und Nachweise",
  "adm.sec.berichte": "Berichte und Analyse",
  "adm.sec.system": "System",
  // JOB 3337: die Namen, unter denen zwei Verwaltungsziele im Menü, im Direktzugang und im Pfad
  // stehen. „Demodaten laden" wäre als Navigationsziel eine Behauptung über die Wirkung des Klicks
  // — geladen wird erst in der Karte. Die Synonyme decken die bisherigen und die englischen Wörter.
  "adm.ziel.demo": "Demodaten",
  "adm.ziel.demo.syn": "Demo, Vorführdaten, Beispieldaten, demo data",
  "adm.ziel.protokoll": "Prüfprotokoll",
  "adm.ziel.papierkorb.syn": "Mülleimer, gelöschte Inhalte, trash",
  "adm.ziel.ki.syn": "KI-Anbieter und Modelle, AI, Modell, Provider",
  // JOB 3065 H6: kein eigener Reiter mehr, sondern die Beschriftung der Zeile unter Sicherheit.
  "adm.sec.bereitschaft": "Bereitschaft",
  "adm.print": "Drucken",
  // JOB 3065 H6: der Werksreset ist nicht in jeder Installation vorhanden (nur Desktop/Dev). Bis
  // hierher fehlte in diesem Fall die ganze Karte; jetzt sagt sie ehrlich, warum sie leer ist.
  "adm.factory.unavailable":
    "In dieser Installation nicht verfügbar — der Werksreset gibt es nur im Desktop-Betrieb.",
  // JOB 3065 H6: das Löschen eines Kontos bekommt die Rückfrage, die es vorher nicht hatte.
  "adm.removeQ": "Konto löschen?",
  "adm.removeKeep": "Behalten",
  "adm.removeYes": "Ja, löschen",
  // ============================================================================================
  // JOB 3065 H6 — DIE FLÄCHE „EINSTELLUNGEN": Zeilen, Werte, Reiter. Kein Erklärtext.
  // ============================================================================================
  "einst.titel": "Einstellungen",
  "einst.zurueck": "Zurück",
  "einst.zeile.nurLesbar": "Nur lesbar",
  "einst.detail.unbekannt": "Diese Karte gibt es nicht.",
  // JOB 3065 R2: der Fehler-/Offline-Zustand IN der Detailkarte — nie ein stehendes „Wird geladen".
  "einst.detail.offline": "Offline — der Stand lässt sich gerade nicht holen.",
  "einst.an": "an",
  "einst.aus": "aus",
  // JOB 3337: der lesbare Pfad über der Detailansicht und die ehrliche Auskunft über ein
  // ausgeschaltetes Modul — Rolle reicht, nur der Schalter steht aus.
  "einst.pfad": "Pfad",
  "einst.modul.aus": "Modul aus",
  "einst.modul.weg": "Einschalten unter System · Erweiterte Module",
  // Das Zustandsmodell der Zeilenwerte (REGELN §7): „–" ist Nichtwissen, nicht Null.
  "einst.wert.unbekannt": "–",
  "einst.wert.nichtAbrufbar": "nicht abrufbar",
  "einst.wert.keine": "keine",
  "einst.wert.stand": "Stand von {{zeit}}",
  "einst.wert.nichtAktualisiert": "nicht aktualisiert",
  "einst.konten.nutzer": "Nutzer",
  "einst.konten.leer": "noch keine Nutzer",
  "einst.konten.wartet": "wartet auf Freigabe",
  // JOB 4103 R2: die Befristung AM LISTENEINTRAG — damit der Admin sie sieht, ohne die Kontokarte
  // zu öffnen (BEN-Korrekturpflicht 1 aus Runde 1).
  //
  // EIGENE WORTE, NICHT DIE DER KARTE. Die Karte sagt „Gültig bis {{datum}}." — eine Aussage über
  // die GELTUNG, und die stimmt nur so lange, wie jemand die Uhr im Blick behält (dafür hat die
  // Karte ihren Wecker, `AdminKontenDetails.tsx`). Die Liste hat keinen Wecker und soll auch keinen
  // zweiten bekommen; sie sagt deshalb, was ohne Uhr wahr bleibt: WORAUF der Zugang befristet IST.
  // Verstreicht der Tag, während die Liste offen steht, bleibt „befristet bis 30.09.2026" richtig —
  // nur die schärfere Auskunft „abgelaufen" kommt später als in der Karte. Keine Zeile behauptet
  // dabei je etwas Falsches.
  "einst.konten.befristet": "befristet bis {{datum}}",
  "einst.konten.abgelaufen": "abgelaufen am {{datum}}",
  // Ein unlesbarer Wert wird BENANNT und nicht verschwiegen: schwiege die Zeile, läse sich das
  // neben befristeten Nachbarzeilen als „dieser Zugang endet nicht" — eine Aussage, für die es
  // keinen Beleg gibt. Der Server sperrt mit einem solchen Wert niemanden aus
  // (`services/auth/src/service.ts`), deshalb steht hier auch kein Ablauf.
  "einst.konten.fristUnlesbar": "Ablaufwert unlesbar",
  "einst.konten.hinzufuegen": "Nutzer hinzufügen",
  "einst.konten.ansichtAus": "aus",
  "einst.konten.nutzerWeg": "Dieses Konto gibt es nicht mehr.",
  "einst.rollen.kicker": "ROLLEN",
  "einst.rollen.kiWahl": "KI-Wahl frei",
  "einst.rollen.wort.fragen": "fragen",
  "einst.rollen.wort.lesen": "lesen",
  "einst.rollen.wort.erfassen": "erfassen",
  "einst.rollen.wort.pruefen": "prüfen",
  "einst.rollen.wort.konflikte": "Konflikte",
  "einst.rollen.wort.duplikate": "Duplikate",
  "einst.ki.grenzen": "Prüfungen und Grenzen",
  "einst.ki.aktivZahl": "{{count}} aktiv",
  "einst.ki.grenzeWert": "{{mb}} MB je Anhang",
  "einst.ki.dupWert": "ab {{prozent}} %",
  "einst.daten.demoDa": "{{count}} Objekte",
  "einst.daten.demoBestand": "Demo-Bestand",
  "einst.daten.werkVerfuegbar": "verfügbar",
  "einst.daten.werkNicht": "nicht verfügbar",
  "einst.sich.punkte": "{{count}} Punkte",
  "einst.sich.bereitWert": "{{ok}} von {{gesamt}} ohne Warnung",
  // SCRUM-429 (Pedi 03.07., VIP): Erststart-Führung für den neuen Admin.
  "adm.firstrun.kicker": "Erststart",
  "adm.firstrun.title": "Willkommen — dein Arbeitsbereich ist startklar.",
  "adm.firstrun.lead":
    "Als erstes Konto bist du Admin. Alles Nötige ist vorbereitet — hier sind drei ruhige erste Schritte. Diese Karte erscheint nur beim ersten Besuch.",
  "adm.firstrun.dismiss": "Ausblenden",
  "adm.firstrun.done": "Verstanden — ausblenden",
  "adm.firstrun.note":
    "Kein Zwang, keine Reihenfolge: Du kannst jederzeit frei loslegen. Ausgeblendet bleibt sie ausgeblendet.",
  "adm.firstrun.ki.loading": "KI-Status wird geprüft …",
  "adm.firstrun.ki.both": "Beide KIs verbunden: Cloud-KI und deine On-Premise Enterprise AI.",
  "adm.firstrun.ki.cloudOnly":
    "Cloud-KI verbunden. Die On-Premise Enterprise AI ist noch nicht angebunden (Admin → KI).",
  "adm.firstrun.ki.localOnly":
    "Lokaler LLM verbunden. Die Cloud-KI ist noch nicht konfiguriert (Admin → KI).",
  "adm.firstrun.ki.none":
    "Noch keine KI verbunden — der deterministische Ersatzmodus arbeitet weiter (Admin → KI).",
  "adm.firstrun.step.capture.t": "Wissen erfassen",
  "adm.firstrun.step.capture.b":
    "Erzähl es der KI oder lade ein Dokument — sie strukturiert, du prüfst.",
  "adm.firstrun.step.validate.t": "Wissen prüfen",
  "adm.firstrun.step.validate.b":
    "Im Prüfbereich wird Erfahrungswissen freigegeben — erst dann ist es „nutzbar“.",
  "adm.firstrun.step.admin.t": "Verwaltung öffnen",
  "adm.firstrun.step.admin.b": "Konten, KI-Anbindung, Daten und Sicherheit an einem Ort.",
  "adm.firstrun.doneBadge": "erledigt",
  // SCRUM-437 (Pedi 03.07., VIP): Bereitschafts-Checkliste — Ein-Blick-Status vor dem Test.
  "adm.ready.title": "VIP-Bereitschaft",
  "adm.ready.help":
    "Ein ehrlicher Ein-Blick-Status vor dem Test: was steht, was fehlt. Jede Zeile aus echten Zahlen, nichts geschönt.",
  "adm.ready.intro": "Schneller Kontroll-Blick vor dem VIP-Test — grün heißt bereit, gelb prüfen.",
  "adm.ready.note":
    "„Offene Prüfungen“ und die externe Wissensabfrage-Stufe sind wertungsfreie Angaben — kein Mangel, nur Kontext.",
  "adm.ready.ki": "Verbundene KIs",
  "adm.ready.ki.both": "Beide verbunden",
  "adm.ready.ki.partial": "Teilweise verbunden",
  "adm.ready.ki.none": "Keine verbunden",
  "adm.ready.validated": "Validiertes Wissen",
  "adm.ready.openReviews": "Offene Prüfungen",
  "adm.ready.count": "{{n}}",
  "adm.ready.upload": "Upload-Grenzen",
  "adm.ready.upload.val": "{{n}} Anhänge · {{mb}} MB",
  "adm.ready.unknown": "unbekannt",
  "adm.ready.loading": "wird geladen …",
  // JOB 4363 (H6-D1b): der Stand der Bereitschaftskarte, wenn die Verbindung unterbrochen war.
  // Drei Lagen, die bis hierher EINEN Satz teilten (`loadstate.stale`, „Aktualisierung
  // fehlgeschlagen") — und zwei davon hat es nie gegeben: ohne Netz RUHT der Abruf, es gab keinen
  // Versuch; nach der Wiederverbindung innerhalb der Frischefrist (30 s, `ZAEHLER_FRISCHE_MS`) holt
  // react-query nichts nach, es ist seither schlicht keine Antwort angekommen. Der GESCHEITERTE
  // Abruf behält seinen vorhandenen Satz `loadstate.stale` — ein zweiter Wortlaut für denselben
  // Zustand wäre die Krankheit, gegen die `Abfragehuelle.tsx:27-35` geschrieben ist. Gerendert wird
  // das in `components/einstellungen/bereitschaftstandhinweis.tsx`, je hinter „Stand von HH:MM ·".
  "adm.ready.stand.offline": "ohne Netzverbindung nicht aktualisiert",
  "adm.ready.stand.netzluecke": "seit der Unterbrechung ist keine neue Antwort angekommen",
  "adm.ready.stand.laeuft": "wird gerade aufgefrischt",
  // AUFTRAG-mega14 Block H (SCRUM-437): die fehlende Zeile. Sie ZEIGT nur — Laden/Entfernen bleibt
  // im Datenbereich, es gibt genau eine Autorität.
  "adm.ready.demo": "Demodaten",
  "adm.ready.demo.loaded": "{{n}} geladen — im Bereich Daten entfernbar",
  "adm.ready.demo.none": "keine geladen",
  "adm.ready.demo.goto": "Zum Datenbereich",
  "adm.ready.external": "Externe Wissensabfrage",
  "adm.ready.ext.blocked": "Blockiert",
  "adm.ready.ext.searchOnClick": "Suche auf Klick",
  "adm.ready.ext.searchAttach": "Suchen & anhängen",
  "adm.ready.ext.open": "Offen",
  // ==============================================================================================
  // JOB 4025 · KUNDENBETRIEB-BACKUP — DIE SICHERUNG BEKOMMT WORTE.
  // ==============================================================================================
  //
  // Ein Beta-Kunde betreibt KLARWERK selbst; sein Backup läuft per Cron über
  // `scripts/backup/backup.sh`. Bis hierher konnte er in der Anwendung nicht nachsehen, ob es je
  // gelaufen ist. Diese Texte sind das sichtbare Ergebnis (Pedi, Startauftrag 14.09., Punkt 3).
  //
  // DREI AUSSAGEN, DIE NIE VERTAUSCHT WERDEN DÜRFEN — daran hängt der ganze Nutzen:
  //   `none`     eine BELEGTE Negativaussage: erfolgreich gelesen, das Verzeichnis ist leer.
  //   `unknown`  nicht feststellbar: kein Verzeichnis oder nicht lesbar. NIEMALS „keine".
  //   `honesty`  was diese Anzeige NICHT tut. Er steht in JEDER Lage da — auch im Leerfall und im
  //              Fehlerfall — und darf deshalb NICHTS voraussetzen, was nur manchmal gilt.
  //
  // RUNDE 6 — DER WORTLAUT SAGT NUR NOCH, WAS GEMESSEN WURDE. Hier stand „beglaubigt" (en: „checksum
  // verified"). Der Prüfer hat dagegengehalten und es gemessen: die Route öffnet den Dump nie, sie
  // sieht nur, ob die Prüfsummendatei danebenliegt und auf genau diesen Namen lautet
  // (`services/app/src/routes/admin-routes.ts`, `pruefsummeAus`). Bei einer formgerechten Sidecar mit
  // FALSCHEM Hash stand deshalb „verified" an einer Datei, deren Prüfsumme niemand verglichen hatte.
  // Seitdem nennen `certified`/`uncertified` in allen drei Sprachen gleichlautend die DATEI, nicht
  // ihren Abgleich. Kein „verified/geprüft" ohne echten Vergleich.
  //
  // RUNDE 7 — DERSELBE FEHLER, EINE ZEILE WEITER, UND DESHALB STEHT DIE REGEL JETZT HIER. Runde 6
  // hatte den fehlenden Abgleich in den FESTEN Satz geschrieben: „… dass Dateien vorliegen UND dass
  // die Prüfsummendatei danebenliegt". Der Prüfer hat einen Eintrag OHNE Sidecar gemountet — und der
  // feste Satz behauptete die Datei trotzdem. Ein Satz, der immer dasteht, darf nur sagen, was immer
  // gilt. Deshalb: `honesty` beschreibt nur noch, WAS DIESE ANZEIGE TUT und was sie nicht tut
  // (kein Hashvergleich, keine Wiederherstellung); jede Aussage über eine EINZELNE Sicherung steht
  // am Eintrag selbst, mit dem gemessenen Zustand — `certified` ODER `uncertified`, nie beides und
  // nie vorweggenommen. Gemessen wird das in `tests/kundenbetrieb-sicherung/
  // admin-sicherung-mounted.test.tsx` (U8) über vier Lagen und drei Sprachen.
  "adm.backup.title": "Sicherung",
  "adm.backup.help":
    "Was liegt im Sicherungsverzeichnis dieser Anlage? Die Karte liest es, sobald du sie öffnest: je Datei ihr Zeitpunkt, ihre Größe und ob die Prüfsummendatei daneben liegt, die das Backup-Skript mitschreibt. Sie startet keine Sicherung, löscht keine und lädt keine herunter — sie sagt nur, was da ist.",
  "adm.backup.honesty":
    "Diese Anzeige nennt je gefundene Sicherungsdatei ihren Prüfsummenstand. Ein Hashvergleich und eine Wiederherstellung finden hier nicht statt — beides prüft der Restore-Drill.",
  "adm.backup.none": "Keine Sicherung im Verzeichnis {{verzeichnis}} gefunden.",
  "adm.backup.unknown": "Nicht feststellbar, ob eine Sicherung vorliegt.",
  "adm.backup.reason.missing": "Das Sicherungsverzeichnis gibt es nicht.",
  "adm.backup.reason.unreadable": "Das Sicherungsverzeichnis war nicht lesbar ({{grund}}).",
  "adm.backup.certified": "Prüfsummendatei vorhanden",
  // „keine GÜLTIGE" und nicht „fehlt": `beglaubigt: false` trifft auch die Sidecar, die sehr wohl
  // danebenliegt, aber leer ist, keine 64 Hex trägt oder auf einen FREMDEN Endnamen lautet
  // (`sicherungen-auskunft.test.ts`, S3/S3b). „fehlt" wäre dort falsch — und damit derselbe Fehler
  // wie in Runde 5 und 6, nur in die andere Richtung.
  "adm.backup.uncertified": "keine gültige Prüfsummendatei — Wiederherstellung nicht belegt",
  "adm.backup.dir": "Verzeichnis: {{verzeichnis}}",
  "adm.backup.readAt": "Gelesen am {{zeit}}",
  "adm.backup.time.unknown": "Zeitpunkt unbekannt",
  "adm.backup.size.unknown": "Größe nicht messbar",
  "adm.backup.size.b": "{{n}} Bytes",
  "adm.backup.size.kb": "{{n}} KB",
  "adm.backup.size.mb": "{{n}} MB",
  "adm.backup.age.now": "vor unter einer Stunde",
  "adm.backup.age.hours_one": "vor {{count}} Stunde",
  "adm.backup.age.hours_other": "vor {{count}} Stunden",
  "adm.backup.age.days_one": "vor {{count}} Tag",
  "adm.backup.age.days_other": "vor {{count}} Tagen",
  // JOB 4109 — mehrere Sicherungen in DERSELBEN SEKUNDE. `backup.sh:413` vergibt dafür `_02`, `_03`;
  // der Satz benennt die TATSACHE und bewertet nicht: kein „doppelt", kein „überzählig", keine
  // Warnung. Zwei Läufe in derselben Sekunde sind normaler Cron-Betrieb, kein Fehler.
  //
  // WARUM NUR DAS DEUTSCHE DIE ORDNUNGSZAHL FÜHRT: „{{n}}." ist im Deutschen für JEDE Zahl richtig.
  // Im Englischen (1st/2nd/3rd/4th) und im Niederländischen (2e, aber 20ste) hängt die Endung an
  // der Zahl; eine feste Endung wäre reihenweise falsch, und i18next-Ordinalformen decken das
  // Niederländische nicht ab (`Intl.PluralRules("nl", {type:"ordinal"})` kennt nur `other`). Beide
  // Sprachen nennen die Nummer deshalb als Nummer — dieselbe Tatsache, ohne falsche Grammatik.
  "adm.backup.seq": "{{n}}. Sicherung derselben Sekunde",
  // Die Zeile im Reiter „System". Sie trägt die Zahl nur, wenn wirklich gelesen wurde.
  "adm.backup.row.none": "keine",
  "adm.backup.row.unknown": "nicht feststellbar",
  // SCRUM-432 (Pedi 03.07., VIP-Investor): Vertrauen & Sicherheit.
  // AUFTRAG-mega15 Block A (bens SB-1, zweiter Durchgang): „manipulationssicher" ist eine STÄRKERE
  // Aussage als „Abweichung erkannt" — sie behauptet, es KÖNNE nichts passieren. Die Kette hat
  // keinen extern verankerten Kopf (s. lib/auditVerifyState.ts:14-16); wer die Datenbank beherrscht,
  // kann einen Eintrag samt aller Folgehashes neu bilden. Belegbar ist deshalb genau eines: die
  // Kette macht eine nachträgliche Änderung rechnerisch auffällig. Das ist stark — nur eben nicht
  // „sicher". Alle Texte dieser Fläche sagen ab hier genau das, in DE/EN/NL.
  "adm.sich.auditTitle": "Prüfprotokoll — hash-verkettet, Abweichungen prüfbar",
  "adm.sich.auditHelp":
    "Jede sicherheitsrelevante Aktion wird nur angefügt und über eine Hash-Kette mit dem vorherigen Eintrag verbunden. Wird ein Eintrag nachträglich geändert oder entfernt, passt sein Hash nicht mehr — die Abweichung ist rechnerisch feststellbar und wird beim Integritätslauf mit Nummer, Datum und Aktion benannt. Die Kette hat dabei keinen extern verankerten Kopf: wer vollen Schreibzugriff auf die Datenbank hat, kann einen Eintrag samt aller Folgehashes neu bilden. Das Protokoll ist also prüfbar (tamper-evident) — die Kette hält eine Änderung nicht auf, sie macht sie auffällig.",
  "adm.sich.auditIntro":
    "Append-only, hash-verkettet: eine prüfbare Spur aller sicherheitsrelevanten Aktionen. Eine nachträgliche Abweichung an einem Eintrag lässt sich rechnerisch feststellen.",
  "adm.sich.auditCount": "{{count}} Einträge in der Kette",
  "adm.sich.verify.button": "Integrität prüfen",
  "adm.sich.verify.ok": "Integrität geprüft ✓ — {{count}} Einträge, Kette lückenlos",
  // AUFTRAG-mega14 Block A-2 (bens SB-1): drei Zustände statt zwei. Das Wort „Manipulation" ist hier
  // bewusst getilgt — in BEIDE Richtungen: die Anzeige behauptet weder, Manipulation sei erkannt,
  // noch, sie sei ausgeschlossen. Die Kette hat keinen extern verankerten Kettenkopf; beide Aussagen
  // wären unbelegt. Gelb sagt „die VORLIEGENDEN Werte passen zum gespeicherten Hash" — eine Aussage
  // über den Befund, nicht über die Vergangenheit.
  "adm.sich.verify.serialisation":
    "Verkettung lückenlos — {{count}} Einträge, kein Bruch. Bei {{n}} Einträgen lässt sich die Nutzdaten-Prüfsumme nicht nachrechnen, weil die Datenbank die Reihenfolge der Nutzdatenfelder normiert. Die vorliegenden Werte passen zum gespeicherten Hash; keine Abweichung bleibt unaufgelöst.",
  "adm.sich.verify.unconfirmed":
    "Kette nicht bestätigt — erste Abweichung bei Eintrag {{seq}} vom {{at}} ({{action}}). Art: {{kind}}. Die Ursache muss geprüft werden.",
  "adm.sich.verify.unconfirmedPlain": "Kette nicht bestätigt — die Ursache muss geprüft werden.",
  "adm.sich.verify.kind.linkage": "Verkettung gebrochen",
  "adm.sich.verify.kind.serialisation": "Feldreihenfolge der Datenbank",
  "adm.sich.verify.kind.unresolved": "Nutzdaten-Prüfsumme nicht auflösbar",
  "adm.sich.verify.kind.unchecked": "Nutzdaten-Prüfsumme nicht geprüft (zu viele Feldreihenfolgen)",
  "adm.sich.dataTitle": "Datenschutz & Sicherheit",
  "adm.sich.dataHelp":
    "Ein ehrlicher Auszug der Systemeigenschaften — keine Versprechen, sondern wie KLARWERK gebaut ist.",
  "adm.sich.keys.t": "Schlüssel bleiben im Schlüsselbund",
  "adm.sich.keys.b":
    "API-Schlüssel liegen ausschließlich serverseitig bzw. im macOS-Schlüsselbund — nie im Browser, nie im Code oder Repository.",
  "adm.sich.localAi.t": "On-Premise Enterprise AI möglich",
  "adm.sich.localAi.b":
    "Neben der Cloud-KI lässt sich ein eigener lokaler LLM anbinden. Die lokale KI ist nur über einen privaten Tunnel erreichbar, nie öffentlich.",
  "adm.sich.external.t": "Externe Wissensabfrage standardmäßig eingeschränkt",
  "adm.sich.external.b":
    "Public-KI und Web-Suche sind admin-gesteuert und standardmäßig nicht offen. Nichts verlässt unkontrolliert das System.",
  "adm.sich.audit.t": "Hash-verkettetes Prüfprotokoll",
  "adm.sich.audit.b":
    "Alle sicherheitsrelevanten Aktionen werden append-only und hash-verkettet festgehalten. Eine nachträgliche Abweichung an einem Eintrag ist rechnerisch prüfbar und wird beim Integritätslauf benannt (tamper-evident).",
  "adm.sich.trash.t": "Löschen mit Papierkorb",
  "adm.sich.trash.b":
    "Gelöschtes geht zuerst in den Papierkorb (wiederherstellbar); die endgültige Löschung erfolgt erst nach 30 Tagen. Kein stiller Datenverlust.",
  "adm.sich.roles.t": "Rollen & minimale Rechte",
  "adm.sich.roles.b":
    "Vier Rollen (Betrachter, Experte, Controller, Admin). Jede Aktion prüft serverseitig das nötige Recht.",
  "adm.sich.noCustomerData.t": "Keine Kundendaten in Tests",
  "adm.sich.noCustomerData.b":
    "Qualitätssicherung und Evaluierungen laufen ohne echte Kundendaten.",
  // SCRUM-444: Evidenz-Rahmung auf dem druckbaren Auszug — Markenkern „Vertrauen ist Evidenz".
  "adm.sich.evidenceNote":
    "Alle Kennzahlen hier sind Live-Werte dieser Instanz — gemessen, nicht behauptet. Zielwerte oder Beispielrechnungen werden immer ausdrücklich als solche gekennzeichnet.",
  "adm.ai.test": "Key testen",
  "adm.ai.testRunning": "teste …",
  "adm.conflictSelfTest.button": "Konflikterkennung testen",
  "adm.conflictSelfTest.running": "teste Erkennung …",
  "adm.conflictSelfTest.ok": "Konflikt + Kollisionsfelder + wörtliche Belege erkannt",
  "adm.conflictSelfTest.noModel": "kein Modell (deterministischer Ersatzmodus) — keine Erkennung",
  "adm.conflictSelfTest.noConflict":
    "Modell aktiv, aber kein Konflikt erkannt (Modellfehler oder Urteil: kein Widerspruch)",
  "adm.conflictSelfTest.noKollision": "Konflikt erkannt, aber Kollisionsfelder leer",
  "adm.conflictSelfTest.provider": "Provider: {{provider}}",
  "adm.conflictSelfTest.streitpunkt": "Streitpunkt: {{streitpunkt}}",
  "adm.conflictSelfTest.label": "Konflikt",
  "adm.selfTest.button": "Erkennung testen (Konflikt + Duplikat)",
  "adm.selfTest.running": "teste Erkennung …",
  "adm.dupSelfTest.label": "Duplikat",
  "adm.dupSelfTest.ok": "Duplikat erkannt (semantisch gleich, lexikalisch verschieden)",
  "adm.dupSelfTest.noModel": "kein Modell (deterministischer Ersatzmodus) — keine Erkennung",
  "adm.dupSelfTest.noDuplicate":
    "Modell aktiv, aber kein Duplikat erkannt (Modellfehler oder Urteil: kein Duplikat)",
  "adm.dupSelfTest.relation": "Beziehung: {{relation}}",
  "adm.ai.testOk": "Verbindung ok — {{provider}} hat geantwortet. Der Schlüssel funktioniert.",
  "adm.ai.testLocal": "Lokalen LLM testen",
  "adm.ai.testLocalOk": "Lokaler LLM hat geantwortet ({{provider}}).",
  // ==============================================================================================
  // JOB 3420 (UX-10b) — DER PAUSCHALE SCHLÜSSELTIPP IST ERSETZT, NICHT ERGÄNZT.
  // ==============================================================================================
  //
  // HIER STAND: „Test fehlgeschlagen: {{detail}} Tipp: Schlüssel im Start-Dialog bzw. Schlüsselbund
  // (Service Klarwerk, Account ANTHROPIC_API_KEY) erneuern, dann App neu starten." — angehängt an
  // JEDES Scheitern, also auch an ein 400 von ChatGPT (bei dem ein neuer Schlüssel nichts ändert),
  // an den eigenen lokalen LLM und an eine Anfrage, die KLARWERK gar nicht erst erreichte.
  //
  // `adm.ai.testFail` trägt jetzt nur noch den NEUTRALEN RAHMEN mit der Rohmeldung. Ursache und Rat
  // kommen aus den `adm.ai.befund.*`/`adm.ai.rat.*`-Schlüsseln unten, ausgewählt von der EINEN
  // Ableitung `apps/web/src/lib/kiTestBefund.ts` aus dem, was der Server GEMESSEN hat. Der
  // Kontoname steht nur noch im Rat des GEPRÜFTEN Anbieters (`adm.ai.rat.zugangKonto.*`, unten),
  // nie mehr im allgemeinen Fehlertext (Wächter:
  // `tests/ki-fehlerhilfe/kein-pauschaler-schluesseltipp-im-text.test.ts`).
  "adm.ai.testFail": "Test fehlgeschlagen: {{detail}}",
  "adm.ai.wiederholen": "Test wiederholen",
  // JOB 3420 Runde 2: läuft eine Wiederholung, bleibt der zuletzt gemessene Befund stehen — aber
  // ausdrücklich als der ÄLTERE, nie als der aktuelle (Auftrag §9).
  "adm.ai.befund.aelter": "Älterer Befund von {{zeit}} · eine neue Prüfung läuft.",
  "adm.ai.befund.aelterOhneZeit": "Älterer Befund · eine neue Prüfung läuft.",
  "adm.ai.befund.zitat": "Begründung des Anbieters (wörtlich): „{{grund}}“",
  "adm.ai.befund.zugang":
    "Der Anbieter hat den Zugang abgelehnt (HTTP {{status}}) — die hinterlegten Zugangsdaten wurden nicht anerkannt.",
  "adm.ai.befund.kontingent":
    "Der Anbieter hat wegen Kontingent oder Anfragerate abgewiesen (HTTP 429).",
  "adm.ai.befund.abgelehnt":
    "Der Anbieter hat die Anfrage abgelehnt (HTTP 400) — beanstandet wurde die Anfrage selbst, nicht der Zugang.",
  "adm.ai.befund.nichtErreichbar":
    "Der Anbieter war nicht erreichbar: Netzfehler oder Störung auf seiner Seite.",
  "adm.ai.befund.zeitlimit": "Das Zeitlimit lief ab, bevor der Anbieter geantwortet hat.",
  "adm.ai.befund.unbrauchbar":
    "Der Anbieter hat geantwortet, aber ohne brauchbaren Inhalt (leer oder abgeschnitten).",
  "adm.ai.befund.unbestimmt":
    "Grund nicht eingeordnet — dieser Fehler ließ sich keiner gemessenen Ursache zuordnen.",
  "adm.ai.befund.anfrage":
    "Die Anfrage an KLARWERK kam nicht durch — es liegt überhaupt kein Prüfergebnis vor.",
  "adm.ai.befund.lokal.zugang": "Der eigene LLM-Server hat den Zugang abgelehnt (HTTP {{status}}).",
  "adm.ai.befund.lokal.kontingent":
    "Der eigene LLM-Server hat wegen Auslastung abgewiesen (HTTP 429).",
  "adm.ai.befund.lokal.abgelehnt":
    "Der eigene LLM-Server hat die Anfrage abgelehnt (HTTP 400) — beanstandet wurde die Anfrage selbst.",
  "adm.ai.befund.lokal.nichtErreichbar":
    "Der eigene LLM-Server war nicht erreichbar: Tunnel oder Server aus, oder ein Netzfehler dazwischen.",
  "adm.ai.befund.lokal.zeitlimit":
    "Das Zeitlimit lief ab, bevor der eigene LLM-Server geantwortet hat.",
  "adm.ai.befund.lokal.unbrauchbar":
    "Der eigene LLM-Server hat geantwortet, aber ohne brauchbaren Inhalt.",
  "adm.ai.befund.lokal.unbestimmt":
    "Grund nicht eingeordnet — dieser Fehler des eigenen LLM-Servers ließ sich keiner gemessenen Ursache zuordnen.",
  "adm.ai.rat.zugang":
    "Nächster Schritt: die hinterlegten Zugangsdaten dieses Anbieters erneuern und die App neu starten.",
  // JOB 3420: je Anbieter ein eigener Satz. Der KONTONAME steht hier als Fließtext und NICHT als
  // Zeichenkette in `kiTestBefund.ts` — `tests/security/egress-chokepoint.test.ts:31-35` verbietet
  // die Code-Form eines Credential-Namens ausserhalb der beiden Chokepoint-Dateien und nimmt genau
  // diesen i18n-Fall aus. Gewählt wird der Schlüssel aus dem GEMESSENEN `anbieter`; ohne Anbieter
  // greift `adm.ai.rat.zugang` ohne jeden Kontonamen.
  "adm.ai.rat.zugangKonto.openai":
    "Nächster Schritt: den Schlüssel im Start-Dialog bzw. Schlüsselbund (Service Klarwerk, Konto OPENAI_API_KEY) erneuern, dann App neu starten.",
  "adm.ai.rat.zugangKonto.anthropic":
    "Nächster Schritt: den Schlüssel im Start-Dialog bzw. Schlüsselbund (Service Klarwerk, Konto ANTHROPIC_API_KEY) erneuern, dann App neu starten.",
  "adm.ai.rat.kontingent":
    "Nächster Schritt: später erneut testen. Ein anderer Schlüssel ändert daran nichts.",
  "adm.ai.rat.abgelehnt":
    "Nächster Schritt: Modell- und Parameterwahl prüfen. Ein neuer Schlüssel hilft in dieser Lage nicht.",
  "adm.ai.rat.nichtErreichbar":
    "Nächster Schritt: noch einmal testen; hält es an, liegt die Störung beim Anbieter oder im Netz.",
  "adm.ai.rat.zeitlimit":
    "Nächster Schritt: den Test erneut starten; bleibt es dabei, Modellgröße und Auslastung prüfen.",
  "adm.ai.rat.unbrauchbar": "Nächster Schritt: erneut testen und die Modellwahl prüfen.",
  "adm.ai.rat.anfrage": "Nächster Schritt: Verbindung prüfen und die Prüfung erneut anstoßen.",
  "adm.ai.rat.lokal.zugang":
    "Nächster Schritt: Adresse und Zugangsdaten des eigenen LLM-Servers prüfen (KLARWERK_LOCAL_LLM_URL/_MODEL).",
  "adm.ai.rat.lokal.kontingent":
    "Nächster Schritt: später erneut testen — der eigene LLM-Server ist gerade ausgelastet.",
  "adm.ai.rat.lokal.abgelehnt":
    "Nächster Schritt: Modellnamen und Parameter des eigenen LLM-Servers prüfen.",
  "adm.ai.rat.lokal.nichtErreichbar":
    "Nächster Schritt: Tunnel und eigenen LLM-Server prüfen, danach erneut testen.",
  "adm.ai.rat.lokal.zeitlimit":
    "Nächster Schritt: erneut testen; antwortet der eigene LLM-Server dauerhaft zu langsam, Modell oder Hardware prüfen.",
  "adm.ai.rat.lokal.unbrauchbar":
    "Nächster Schritt: erneut testen und den Modellnamen des eigenen LLM-Servers prüfen.",
  "adm.ai.global": "Global (Standard für alle Einsätze)",
  "adm.ai.choice.inherit": "— wie global —",
  "adm.ai.choice.auto": "Auto (Modell wenn verfügbar)",
  // JOB 3134 (KI-WAHL): die beiden externen Anbieter sind eigene Einträge; der Name und das Modell
  // kommen aus der Serverkonfiguration (`{{name}}` = „ChatGPT (OpenAI) · gpt-4o-mini"). Der alte
  // Eintrag „Extern · Cloud-LLM (Claude)" nannte fest Claude, während ChatGPT antwortete.
  "adm.ai.choice.anbieter": "Extern · {{name}}",
  "adm.ai.choice.anbieterUnavailable": "Extern · {{name}} (nicht eingerichtet)",
  "adm.ai.choice.autoMit": "derzeit {{name}}",
  "adm.ai.choice.local": "Intern · eigener LLM (On-Prem)",
  "adm.ai.choice.localUnavailable": "Intern · eigener LLM (nicht verbunden)",
  "adm.ai.choice.deterministic": "Deterministisch (ohne Modell)",
  "adm.ai.envLocked":
    "Die KI-Zuordnung ist per Deploy-Konfiguration (KLARWERK_REASONER_POLICY) festgelegt und kann hier nicht geändert werden.",
  "adm.ai.migrated":
    "Alter Wert „{{von}}“ wurde auf {{nach}} überführt — bitte prüfen und „Zuordnung übernehmen“ klicken.",
  "adm.ai.dirtyActive": "Gewählt: {{gewaehlt}} · bis zum Übernehmen bleibt aktiv: {{aktiv}}.",
  "adm.ai.deviation": "Abweichend vom Standard: {{list}}",
  "adm.ai.task.structure": "Strukturieren",
  "adm.ai.task.assist": "Schreib-Palette (KI-Hilfe)",
  "adm.ai.task.interview": "Geführtes Interview",
  "adm.ai.task.answer": "Fragen beantworten",
  "adm.ai.task.select": "Kandidaten-Auswahl",
  "adm.ai.task.extract": "Wissen aus Datei",
  "adm.ai.task.describe": "Bildbeschreibung (Vorschlag)",
  "adm.ai.task.group": "Import-Kandidaten gruppieren",
  "adm.ai.effModel": "Modell",
  "adm.ai.effDet": "deterministisch",
  "adm.ai.eff.cloud": "extern",
  "adm.ai.eff.openai": "extern · ChatGPT (OpenAI)",
  "adm.ai.eff.anthropic": "extern · Claude (Anthropic)",
  "adm.ai.eff.local": "intern",
  "adm.ai.eff.deterministic": "deterministisch",
  "adm.ai.save": "Zuordnung übernehmen",
  "adm.ai.detail": "Feinabstimmung je Einsatz",
  "adm.ai.detailHint": "optional — Standard genügt meist",
  "adm.ai.saved": "KI-Zuordnung übernommen.",
  "adm.ai.dirtyHint": "Noch nicht übernommen — „Zuordnung übernehmen“ klicken.",
  "adm.ai.applied": "Übernommen ✓",
  // JOB 3134: die Zuordnung IST seit SCRUM-525 persistent — der alte Satz („gilt bis zum Neustart")
  // widersprach dem Server.
  "adm.ai.persistNote":
    "Wird auf dem Server gespeichert und gilt ab der nächsten Anfrage — auch nach Neuladen, Neuanmeldung und Neustart.",
  // SCRUM-386: kundeneigene KI-Assist-Funktionen (Presets) — Admin pflegt, Palette zeigt allen.
  "adm.presets.title": "Eigene KI-Funktionen",
  "adm.presets.help":
    "Die KI-Palette im Editor bietet Werks-Funktionen (Klarer, Strukturieren, Erweitern, Rechtschreibung, Formatieren). Hier legst du ZUSÄTZLICHE, eigene Funktionen für deine Organisation an — ein Name für den Knopf und die Anweisung, die die KI bekommt (z. B. „Fasse für die Schichtübergabe in 5 Stichpunkten zusammen“). Die Anweisung ist in der Palette am ?-Zeichen offen sichtbar; wie immer gilt: Die KI macht nur einen Vorschlag zur Vorschau, übernommen wird bewusst per Klick. Werks-Funktionen lassen sich nicht löschen.",
  "adm.presets.hint":
    "Zusätzliche Funktionen für die KI-Palette im Editor — je ein Knopf-Name und eine Anweisung an die KI. Sichtbar für alle Rollen; höchstens 12.",
  "adm.presets.empty": "Noch keine eigenen Funktionen — die Werks-Palette gilt unverändert.",
  "adm.presets.name": "Name des Knopfs (z. B. Schichtübergabe)",
  "adm.presets.instruction": "Anweisung an die KI (z. B. Fasse in 5 Stichpunkten zusammen …)",
  "adm.presets.add": "Funktion hinzufügen",
  "adm.presets.save": "Funktionen speichern",
  "adm.presets.saved": "Eigene KI-Funktionen gespeichert.",
  "adm.val.title": "Prüfungen",
  "adm.val.help":
    "Die Standard-Prüferanzahl gilt für neue Einreichungen ohne eigene Angabe. Erlaubt sind 1 bis 5. Bestehende Beiträge bleiben unverändert; Änderungen landen im Audit-Log.",
  "adm.val.hint":
    "So viele Prüf-Bestätigungen braucht ein neuer Beitrag standardmäßig, bis er als validiert gilt.",
  "adm.val.label": "Standard-Prüferanzahl (1–5)",
  "adm.val.save": "Speichern",
  "adm.val.invalid": "Bitte eine ganze Zahl zwischen 1 und 5 angeben.",
  "adm.val.saved": "Standard-Prüferanzahl gespeichert.",
  "adm.upload.title": "Upload-Grenzen",
  "adm.upload.help":
    "Legt fest, wie viele Anhänge ein Objekt haben darf und wie groß ein einzelner Anhang sein darf. Gilt für neue Anhänge; bestehende bleiben. Änderungen landen im Audit-Log.",
  // AUFTRAG-mega14 Block E (SCRUM-421): der alte Satz behauptete, die Grenzen würden beim Erfassen
  // angezeigt — tatsächlich stand die Zahl an genau EINER von zwölf Auswahlstellen. Das war eine
  // zweite Falschaussage der Oberfläche und wog schwerer als die fehlende Anzeige selbst. Jetzt
  // stimmt der Satz: der Hinweis steht an jeder Auswahlstelle (UploadLimitsHint), und die Anzahl
  // wie die GESPEICHERTE Größe werden beim Anhängen serverseitig geprüft.
  // Die Größe misst die übertragene Daten-URL (Base64) — das steht hier ausdrücklich, statt eine
  // Dateigröße vorzugaukeln.
  // AUFTRAG-mega15 Block E: der Faktor stand selbst falsch da. Base64 belegt 4 Zeichen je 3 Bytes,
  // also das 1,34-Fache; die verbreitete 1,37 gilt für die MIME-Variante mit Zeilenumbrüchen, die
  // eine Daten-URL nicht hat. Zusätzlich nennt `adm.upload.rawHint` jetzt die konkrete Zahl.
  "adm.upload.hint":
    "Diese Grenzen erscheinen an jeder Stelle, an der eine Datei gewählt werden kann, und werden beim Anhängen serverseitig durchgesetzt. Die Größe misst die übertragene Datei einschließlich Transportkodierung (rund das 1,34-Fache der reinen Dateigröße).",
  "adm.upload.maxAttachments": "Anhänge je Objekt (max.)",
  "adm.upload.maxMb": "Größe je Anhang (MB, max.)",
  "adm.upload.rawHint": "entspricht rund {{raw}} MB reiner Dateigröße",
  "adm.upload.save": "Speichern",
  "adm.upload.saved": "Upload-Grenzen gespeichert.",
  "adm.ext.title": "Externe Wissensabfrage",
  "adm.ext.help":
    "Steuert, ob die App externe Quellen (Web) und die Public-KI zur Anreicherung nutzen darf. Vier Stufen von komplett gesperrt bis offen. Standard bewusst restriktiv. Änderungen landen im Audit-Log.",
  "adm.ext.hint":
    "Gilt für die externe Quellensuche beim Erfassen/Prüfen und die Public-KI-Anreicherung.",
  "adm.ext.save": "Speichern",
  "adm.ext.saved": "Regler für externe Wissensabfrage gespeichert.",
  "adm.ext.note": "Wirkt sofort für alle; der Server setzt die Sperre zusätzlich durch.",
  "adm.dup.title": "Duplikat-Erkennung",
  "adm.dup.help":
    "Ab welcher KI-Wahrscheinlichkeit ein vermutliches Duplikat angezeigt wird. Niedriger heißt mehr Treffer, aber auch mehr Fehlalarme zum Wegklicken.",
  "adm.dup.hint":
    "Die KI vergleicht jeden neuen Beitrag inhaltlich mit dem gesamten Bestand. Dieser Wert legt fest, ab welcher Wahrscheinlichkeit ein Treffer auf der Duplikate-Seite erscheint.",
  "adm.dup.threshold": "Schwelle (%)",
  "adm.dup.save": "Speichern",
  "adm.dup.saved": "Duplikat-Schwelle gespeichert.",
  "adm.ext.stage.blocked": "Blockiert",
  "adm.ext.stage.search_on_click": "Nur Suche auf Klick",
  "adm.ext.stage.search_attach": "Suche + Anhängen",
  "adm.ext.stage.open": "Offen",
  "adm.ext.stageHint.blocked":
    "Externe Wissensabfrage komplett gesperrt — nichts sichtbar oder aufrufbar.",
  "adm.ext.stageHint.search_on_click": "Externe Suche nur auf ausdrücklichen Klick (Standard).",
  "adm.ext.stageHint.search_attach": "Externe Suche und Ergebnisse als Quelle anhängen erlaubt.",
  "adm.ext.stageHint.open": "Offen: Suche, Anhängen und Public-KI-Anreicherung erlaubt.",
  "enrich.title": "Public-KI-Anreicherung",
  "enrich.help":
    "Hole zusätzliche Hintergrund-Infos von der Public KI — entweder aus dem Modellwissen oder aus einer belegten Web-Suche. Ergebnisse sind extern und ungeprüft; sie werden nur auf deinen Klick in den Entwurf übernommen und nie automatisch validiert.",
  "enrich.disclaimer": "Extern & ungeprüft — bitte vor der Übernahme fachlich prüfen.",
  "enrich.modeModel": "Modellwissen",
  "enrich.modeWeb": "Web-Suche",
  "enrich.placeholder": "Wonach suchen? (z. B. Begriff, Frage)",
  "enrich.run": "Anreichern",
  "enrich.running": "Suche läuft …",
  "enrich.externBadge": "Extern · ungeprüft",
  "enrich.take": "In Entwurf übernehmen",
  "enrich.noModel":
    "Kein KI-Modell verbunden — die Public-KI-Anreicherung braucht ein aktives Modell.",
  "enrich.empty": "Keine externen Treffer gefunden.",
  // SCRUM-433 (Pedi 03.07., VIP): Anreicherung auch dann auffindbar, wenn (noch) gesperrt —
  // sagt, wo ein Admin sie freischaltet, statt einfach unsichtbar zu sein.
  "enrich.disabledHint":
    "Public-KI-Anreicherung ist verfügbar, sobald ein Admin die externe Wissensabfrage auf „Offen“ stellt (Admin → Externe Wissensabfrage).",
  "enrich.openAdmin": "Zu den Admin-Einstellungen",
  "adm.trash.title": "Papierkorb",
  "adm.trash.help":
    "Gelöschte Beiträge landen hier und bleiben 30 Tage wiederherstellbar. Danach werden sie automatisch endgültig gelöscht. Demo-Daten erscheinen hier nie — sie werden immer sofort endgültig gelöscht.",
  "adm.trash.empty": "Der Papierkorb ist leer.",
  "adm.trash.restore": "Wiederherstellen",
  "adm.trash.purge": "Endgültig löschen",
  "adm.trash.purgeQ": "Diesen Beitrag jetzt endgültig löschen?",
  "adm.trash.keep": "Behalten",
  "adm.trash.restored": "Beitrag wiederhergestellt.",
  "adm.trash.purged": "Beitrag endgültig gelöscht.",
  "adm.trash.deletedMeta": "Gelöscht von {{name}} am {{date}}",
  "adm.trash.expires": "Endgültige Löschung in {{days}} Tagen",
  "adm.presets.remove": "Funktion entfernen",
  "adm.presets.note":
    "Wird auf dem Server gespeichert und überlebt den Neustart; Schlüssel und Modelle bleiben davon unberührt.",
  // SCRUM-413: „Verfügbare KIs" — ehrliche Übersicht aller Zugänge (Metadaten, keine Secrets).
  "adm.ai.accessTitle": "Verfügbare KIs",
  "adm.ai.accessHelp":
    "Zeigt alle KI-Zugänge dieser Instanz mit ehrlichem Status: die beiden externen Anbieter ChatGPT (OpenAI) und Claude (Anthropic) einzeln (Schlüssel nur serverseitig; „Aktiv“ ist der in der KI-Verwaltung gewählte, „Bereit“ ein eingerichteter, nicht gewählter), den deterministischen Ersatzmodus, der ohne Modell einspringt, und den geplanten lokalen LLM-Server aus Team 2. Welcher Zugang je Einsatz wirklich wirkt, steht oben in der KI-Verwaltung.",
  "adm.ai.access.openai": "ChatGPT (OpenAI)",
  "adm.ai.access.anthropic": "Claude (Anthropic)",
  "adm.ai.access.fallback": "Deterministischer Ersatzmodus",
  "adm.ai.access.local": "Lokaler LLM-Server (Team 2)",
  "adm.ai.accessNote":
    "Der Anschluss des lokalen LLM-Servers an die App ist geplant (KLLM-61); bis dahin läuft er nur im Team-2-Prüfstand.",
  "adm.ai.state.active": "Aktiv",
  "adm.ai.state.available": "Bereit",
  "adm.ai.state.missing": "Nicht konfiguriert",
  "adm.ai.state.planned": "Geplant",
  "ko.couple.help":
    "Koppelst du dieses Wissen an eine Anlage, wird es bei „Anlage geändert“ (Lebenszyklus) automatisch zur Prüfung markiert — Wissen bleibt aktuell.",
  "ko.couple.empty": "Noch mit keiner Anlage gekoppelt.",
  "ko.couple.placeholder": "Anlagen-Kennung, z. B. Linie L4",
  "ko.couple.cta": "Mit Anlage koppeln",
  "ko.couple.done": "Anlage gekoppelt — Lebenszyklus überwacht dieses Wissen jetzt gezielt.",
  "capture.wizard.discardQ": "Entwurf wirklich verwerfen? Dein Erzähltext bleibt erhalten.",
  "capture.wizard.discardKeep": "Behalten",
  "capture.wizard.discardYes": "Ja, verwerfen",
  "capture.wizard.discardDone": "Entwurf verworfen — dein Erzähltext ist noch da.",
  "capture.wizard.upload": "Text aus Datei oder Bild einfügen",
  "capture.wizard.attach": "Datei oder Bild beifügen",
  "capture.wizard.attached": "{{count}} Datei(en) beigefügt — sichtbar unter „Erweiterte Details“.",
  "capture.wizard.uploadCount":
    "{{count}} Anhang/Anhänge dabei — Text aus Dokumenten steht schon oben im Feld, Details unter „Erweiterte Details“.",
  "capture.gapContextTitle": "Aus offener Wissenslücke",
  "capture.gapContextBody":
    "Das ist eine offene Frage, noch kein Wissen — sie dient nur als Startkontext. Ergänze deine Erfahrung/Beobachtung; die KI strukturiert daraus einen Entwurf, du prüfst und reichst ein.",
  "capture.gapDraftQuestion": "Offene Frage",
  "capture.gapDraftExperience": "Eigene Erfahrung/Beobachtung ergänzen",
  // SCRUM-369: geführte Schrittfolge im Gap-Kontext (Arbeitsauftrag: Frage → Erfahrung → KI → Prüfung).
  "capture.gapStepsTitle": "Dein Arbeitsauftrag:",
  // SCRUM-369: ehrlicher Anschluss nach dem Speichern aus einer Ask-Lücke — keine Auto-Schließung.
  "capture.gapSavedNote":
    "Nach der Validierung kann die Wissensbasis diese Frage künftig besser beantworten. Die Wissenslücke wird nicht automatisch geschlossen — die Prüfung entscheidet.",
  "capture.savedTitle": "Wissensobjekt gespeichert.",
  // SCRUM-286: ehrlich — gespeichert, aber noch offen/nicht validiert; erst nach Bewertung nutzbar.
  "capture.savedStatusBadge": "Status: offen — noch nicht validiert",
  // AUFTRAG-mega70 BLOCK C: der zweite Satz forderte „bitte zur Prüfung geben" — eine Handlung,
  // die eine Expertin nicht tun kann (/validierung verlangt controller). Er erklärt jetzt den
  // Prozess, ohne zur Handlung aufzufordern; der wahre erste Teil bleibt.
  "capture.savedBody":
    "Gespeichert als dein eigenes Wissen (kein Demo-Beispiel), aber noch nicht validiert. Nutzbares Wissen wird es erst, wenn es in der Validierung ausreichend bewertet wurde. Automatisch validiert wird nichts.",
  "capture.savedFromDraft":
    "Dein fortgesetzter Entwurf wurde als offenes Wissen eingereicht und aus deinen Entwürfen entfernt.",
  // WP-SHIP9-S1 (Pedis B3): der ECHTE Prüf-Status auf der Bestätigungs-Karte — „läuft" nur bis zum
  // tatsächlichen Ergebnis, Fehlschlag ehrlich mit Ursache (val.aiCheck.reason.*), kein stilles Grün.
  // PAKET 1.4 (D-AISTATE, Pedi 23.07.): ehrlicher Name je Modellzustand. OHNE nutzbares Modell trägt
  // allein die deterministische Duplikat-/Überschneidungsebene — dann NICHT „KI-Prüfung" und (bens V3)
  // NICHT „Konflikt" (Konflikte erkennt nur die KI). MIT Modell läuft zusätzlich „(mit KI)" inkl. Konflikt.
  "capture.aiCheck.running":
    "Duplikat-/Überschneidungsprüfung läuft … Das Ergebnis erscheint hier, sobald sie abgeschlossen ist.",
  "capture.aiCheck.runningAi":
    "Duplikat-/Konfliktprüfung (mit KI) läuft … Das Ergebnis erscheint hier, sobald sie abgeschlossen ist.",
  "capture.aiCheck.done":
    "Duplikat-/Überschneidungsprüfung abgeschlossen (ohne KI) — Details in der Validierung.",
  "capture.aiCheck.doneAi":
    "Duplikat-/Konfliktprüfung (mit KI) abgeschlossen — Details in der Validierung.",
  "capture.aiCheck.failed":
    "Prüfung fehlgeschlagen: {{reason}} Neu anstoßen kannst du sie in der Validierung.",
  // SCRUM-373 / AG-02-SESSION: nach dem Speichern haben Bilder/Dateien eine sichere Objekt-Referenz.
  "capture.savedFilesNote":
    "{{count}} Anhang/Anhänge sind jetzt als sichere Objekt-Referenz gespeichert und im Editor des Wissensobjekts als Beleg verlinkbar. Belege sind Kontext — sie ersetzen die Validierung nicht.",
  // SCRUM-374 / AG-02-SESSION: ehrlicher Recovery-Hinweis, wenn das KO gespeichert wurde, aber einzelne
  // Anhänge NICHT hochgeladen/angehängt werden konnten (Teilfehler ≠ Totalfehler).
  "capture.attachTooLarge":
    "„{{name}}“ ist zu groß für den Anhang (Upload-Grenze überschritten) — die Datei wurde nicht gespeichert, der Text-Import bleibt erhalten.",
  "capture.originalAttachFailed":
    "Originaldatei „{{name}}“ konnte nicht als Anhang gesichert werden — der Text-Import bleibt erhalten.",
  "capture.attachFailedTitle": "Nicht alle Anhänge konnten gesichert werden",
  "capture.attachFailedBody":
    "Dein Wissensobjekt ist offen gespeichert. Diese Datei(en) wurden NICHT angehängt: {{names}}. Das gespeicherte Wissen ist davon unberührt — Belege ersetzen die Validierung nicht.",
  "capture.attachFailedNext":
    "Nächster Schritt: Wissensobjekt öffnen und die Datei(en) dort erneut anhängen.",
  // AUFTRAG-mega17 Block A-2: fehlende HERKUNFT beim Namen nennen. Nicht „Anhang fehlgeschlagen“,
  // sondern: der Inhalt ist da, sein Beleg nicht — und wie du das nachholst.
  "capture.sourceMissingTitle": "Übernommener Inhalt ohne Herkunftsvermerk",
  "capture.sourceMissingBody":
    "Dein Wissensobjekt ist gespeichert und enthält den aus dem Dokument übernommenen Text. Der zugehörige Herkunftsvermerk konnte NICHT gesetzt werden ({{count}}): {{names}}. Damit steht dort Inhalt ohne Beleg — genau das, was dieses Produkt nicht stillschweigend hinnimmt.",
  // JOB 4367: `capture.sourceMissingNext` wohnt jetzt in `texte/ux08.ts` — bei seiner Funktion.
  // AUFTRAG-mega18 Block A-3: der DRITTE Ausgang. Er behauptet NICHTS über den Bestand — weder
  // „gespeichert" noch „fehlgeschlagen" —, weil beides eine Lüge wäre, solange der Server nicht
  // geantwortet hat. Die einzige ehrliche Auskunft ist: nachsehen.
  // ============================================================================================
  // AUFTRAG-mega21 Block C-1 — die nach dem Commit gescheiterten Nacharbeiten, beim Namen genannt.
  // ============================================================================================
  // Der erste Satz ist der wichtigste und steht deshalb zuerst: das Wissensobjekt IST gespeichert.
  // Aus einem Eintrag hier darf nie geschlossen werden, der Inhalt sei verloren — das war die
  // Fehlerklasse, die in mega18 zu echtem Datenverlust geführt hat.
  "capture.followUpsFailedTitle": "Gespeichert — aber eine Nacharbeit lief nicht",
  "capture.followUpsFailedBody":
    "Dein Wissensobjekt ist vollständig gespeichert und belegt. NACH dem Speichern ist Folgendes nicht durchgelaufen: {{steps}}. Das ändert nichts am gespeicherten Wissen — es bleibt aber etwas offen, und niemand erfährt es sonst.",
  "capture.followUp.draftDiscard": "Entwurf entfernen",
  "capture.followUp.draftDiscardNext":
    "Der Entwurf steht noch in deiner Entwurfsliste. Du kannst ihn dort löschen — das eingereichte Wissensobjekt ist davon unberührt.",
  "capture.followUp.validationAssign": "Prüfer zuweisen",
  "capture.followUp.validationAssignNext":
    "Es wartet niemand auf dieses Wissensobjekt. Öffne die Validierung und weise die Prüfer dort erneut zu.",
  "capture.followUp.notifyAssignment": "Prüfer benachrichtigen",
  "capture.followUp.notifyAssignmentNext":
    "Die Zuweisung steht, nur die Nachricht ging nicht raus. Sag den zugewiesenen Prüfern kurz Bescheid.",
  "capture.followUp.aiCheck": "Duplikat-/Konfliktprüfung anstoßen",
  "capture.followUp.aiCheckNext":
    "Die Prüfung ist als fehlgeschlagen vermerkt und lässt sich auf der Validierungsseite neu anstoßen.",
  // AUFTRAG-mega23 Block B (bens SB-G): der Satz darüber setzt einen GESCHRIEBENEN Vermerk voraus.
  // Fehlt der Nachweis, gilt dieser hier — er verspricht KEINE Wiederholung, die der Endpunkt
  // ablehnen würde, und benennt die eine Handlung, die dann wirklich hilft.
  "capture.followUp.aiCheckUnrecordedNext":
    "Auch der Fehlschlag-Vermerk selbst konnte nicht gespeichert werden — für dieses Wissensobjekt steht deshalb KEIN wiederholbarer Prüf-Job bereit. Bitte das Objekt in der Validierung von Hand auf Duplikate und Widersprüche ansehen.",
  "capture.followUp.unknown": "ein Schritt, den diese Oberfläche noch nicht kennt",
  "capture.followUp.unknownNext":
    "Diese Fassung der Oberfläche kennt den Schritt nicht beim Namen. Er steht im Prüfprotokoll des Wissensobjekts — bitte dort nachsehen.",
  // ============================================================================================
  // AUFTRAG-mega21 Block C-2 — fehlende Originale beim Fortsetzen eines Entwurfs.
  // ============================================================================================
  // Der Server hat den Entwurf bereits ausgedünnt (übernommener Text und verwaiste Belegstellen
  // kommen nicht zurück). Diese Texte erklären den GRUND — bis mega20 sah der Nutzer nur die Lücke.
  "capture.anchorsMissingTitle":
    "Ein gesichertes Original fehlt — übernommener Text wurde nicht geladen",
  "capture.anchorsMissingBody":
    "Zu diesem Entwurf gehören {{count}} gesicherte Originaldokument(e), die es nicht mehr gibt. Der daraus übernommene Text und die zugehörigen Belegstellen wurden deshalb NICHT geladen: sie wären Inhalt ohne Herkunft, und das speichert dieses Produkt nicht stillschweigend. Deine eigene Arbeit — Titel, Aussage, Bedingungen, Maßnahmen, Prüferauswahl — ist vollständig da.",
  "capture.anchorsMissingNext":
    "Solange dieser Hinweis steht, ist „Als Entwurf speichern“ gesperrt: ein Speichern jetzt würde den ausgedünnten Stand über den gespeicherten schreiben.",
  "capture.anchorsMissingReselect": "Original erneut auswählen",
  "capture.anchorsMissingAck": "Ohne das Original weiterarbeiten",
  // AUFTRAG-mega22 Block E: der Rückweg aus einem 409. Er wird NUR angeboten, wenn ein neuer
  // Vorgang der richtige Ausweg ist (Abdruckkonflikt, belegte Kennung) — nie bei
  // CREATE_REPAIR_REQUIRED, wo ein Objekt auf Prüfung wartet (s. lib/createOperation.ts).
  "capture.restartOfferTitle": "Dieser Vorgang lässt sich nicht wiederholen",
  "capture.restartOfferBody":
    "Der Vorgangsschlüssel dieses Einreichens gehört bereits zu einem abgeschlossenen Vorgang mit anderem Inhalt. Dein aktueller Text ist unverändert da und geht nicht verloren. Um ihn zu speichern, braucht es einen NEUEN Vorgang — das entscheidest du, nicht die Oberfläche.",
  "capture.restartOfferAction": "Neuen Vorgang beginnen",
  "capture.appendUnclearTitle": "Übernahme mit unklarem Ausgang",
  "capture.appendUnclearBody":
    "Dein Wissensobjekt ist gespeichert. Bei der Übernahme aus {{names}} brach die Verbindung ab, bevor der Server geantwortet hat: sie kann vollzogen sein oder nicht. Es wurde NICHTS zurückgenommen — ein blindes Aufräumen hätte hier den Schaden erst angerichtet. Bitte das Wissensobjekt öffnen und nachsehen, ob der übernommene Inhalt samt Herkunft dort steht.",
  "own.empty.title": "Noch kein eigenes Wissen hier",
  "own.empty.hint":
    "Du filterst auf eigenes Wissen (keine Demo-Beispiele). Selbst erfasstes Wissen erscheint hier nach dem Speichern und wartet dann auf die Prüfung.",
  "own.empty.cta": "Eigenes Wissen erfassen",
  "studio.open": "Im Knowledge Studio bearbeiten",
  "studio.title": "Knowledge Studio",
  "studio.subtitle":
    "Großer Arbeitsraum mit KI-Hilfe. Änderungen werden erst beim Übernehmen in den Entwurf geschrieben — kein Auto-Speichern, keine Auto-Validierung.",
  "studio.apply": "In den Entwurf übernehmen",
  "studio.cancel": "Verwerfen",
  "studio.close": "Schließen",
  // SCRUM-458 Stufe 1: „Einfach ↔ Strukturiert" als Ansicht-Schalter (Studio = Ansicht, kein zweiter Ort).
  "studio.viewSimple": "Einfach",
  "studio.viewStructured": "Strukturiert",
  "studio.viewSwitch": "Ansicht: einfach oder strukturiert",
  "studio.attachFromDisk": "Datei/Bild vom Rechner anhängen",
  // D44 Teil 1 (JOB 1832, Chef-Entscheidung 21.08. 21:00): GENAU ZWEI Schlüssel für die
  // Gliederungsleiste — die Beschriftung und der ehrliche Leerzustand. Der Baustein, der sie
  // liest (`components/D44Gliederung.tsx` aus JOB 1612 D1), ist im Produkt noch nicht angekommen;
  // solange niemand sie ruft, sind es vorbereitete Texte und KEIN erledigter Anker.
  "studio.d44.gliederung": "Gliederung",
  "studio.d44.keineUeberschriften": "Keine Überschriften im Beitrag",
  "studio.state.dirty": "Nicht übernommen",
  "studio.state.clean": "Keine Studio-Änderungen",
  "studio.confirmDiscard.q": "Nicht übernommene Änderungen verwerfen?",
  "studio.confirmDiscard.keep": "Weiter bearbeiten",
  "studio.confirmDiscard.discard": "Verwerfen",
  // JOB 3123 (PRIORITAETEN.md Q5c): der Satz für den dritten Fall — im Studio wurde gearbeitet UND
  // draußen hat sich der Rumpf geändert. Die Entscheidung bleibt, wie sie ist (die eigene Eingabe
  // gewinnt); der Satz macht sie nur SICHTBAR, damit der Klick ein informierter ist.
  //
  // ER IST EINE POSITIVE AUSSAGE ÜBER EIN BEOBACHTETES EREIGNIS und kein Urteil über Frische: Es
  // gibt bewusst KEINEN Gegensatz dazu („keine fremden Änderungen", „aktuell") — die Fläche weiß
  // nicht, was sie nie bekommen hat. Sein Fehlen heißt ausschließlich „kein Konflikt beobachtet".
  "studio.fremdfassung.hinweis":
    "Draußen ist eine neuere Fassung entstanden. Übernehmen schreibt deinen Stand darüber.",
  "studio.applied":
    "Ausführlicher Inhalt aus dem Studio in den Entwurf übernommen. Speichern bzw. Revision erfolgt erst über den bestehenden Button — nichts wird automatisch gespeichert oder validiert.",
  "studio.save.capture.title": "Studio-Inhalt im Entwurf — noch nicht gespeichert",
  "studio.save.capture.hint":
    "Der im Studio übernommene Inhalt liegt im Entwurf, ist aber noch nicht gespeichert oder validiert.",
  "studio.save.capture.next":
    "Nächster Schritt: speichern/einreichen — danach folgt die Prüfung (Review/Validierung). Automatisch validiert wird nichts.",
  "studio.save.revision.title": "Studio-Inhalt im Revisionsentwurf — noch nicht gespeichert",
  "studio.save.revision.hint":
    "Der im Studio übernommene Inhalt liegt im Revisionsentwurf, ist aber noch nicht gespeichert.",
  "studio.save.revision.next":
    "Speichern erzeugt eine neue Version und startet die Prüfung neu — keine automatische Freigabe.",
  "studio.fromDraft.cta": "Entwurf als Artikel im Studio strukturieren",
  "studio.fromDraft.hint":
    "Erzeugt aus deinem Entwurf (Aussage, Bedingungen, Maßnahmen, Tags) einen strukturierten Artikel-Vorschlag — bitte prüfen und ergänzen. Vorhandener Inhalt wird angehängt, nicht überschrieben; nichts wird automatisch validiert.",
  "studio.section.context": "Struktur & Kontext",
  "studio.section.editor": "Inhalt bearbeiten",
  "studio.section.assist": "KI-Hilfe",
  "studio.guide.structure.label": "Strukturieren",
  "studio.guide.structure.hint": "Gliedere mit Überschriften, Schritten und Hervorhebungen.",
  "studio.guide.assist.label": "KI prüfen",
  "studio.guide.assist.hint":
    "Lass die KI klarer/strukturieren — Vorschlag prüfen, nicht blind übernehmen.",
  "studio.guide.preview.label": "Vorschau",
  "studio.guide.preview.hint": "Sieh dir an, wie der Beitrag später aussieht.",
  "studio.guide.apply.label": "Übernehmen",
  "studio.guide.apply.hint":
    "Bewusst in den Entwurf übernehmen — nichts wird automatisch gespeichert.",
  "studio.guide.thenSave": "danach speichern & prüfen lassen",
  "studio.coach.story":
    "Du rettest Erfahrungswissen. Die KI hilft beim Strukturieren — gesichert wird es erst durch die Prüfung deiner Kolleg:innen.",
  "studio.coach.firstRun":
    "Start hier: Erzähl dein Wissen in eigenen Worten. Struktur, KI-Hilfe und Vorschau kommen Schritt für Schritt.",
  "studio.coach.nextPrefix": "Nächster Schritt",
  "studio.coach.reason.start":
    "Fang mit deiner Erfahrung an — schon ein roher Anfang ist wertvoll.",
  "studio.coach.reason.improve":
    "Lass die KI beim Gliedern und Schärfen helfen oder ergänze Überschriften und Schritte.",
  "studio.coach.reason.preview": "Sieh dir in der Vorschau an, wie dein Beitrag später wirkt.",
  "studio.coach.reason.apply":
    "Sieht gut aus? Übernimm den Entwurf bewusst — gespeichert und geprüft wird danach.",
  "studio.contrib.title": "Dein Beitrag",
  "studio.contrib.level.empty.label": "Leer",
  "studio.contrib.level.empty.hint": "Fang an zu schreiben — schon ein roher Anfang ist wertvoll.",
  "studio.contrib.level.draft.label": "Entwurf",
  "studio.contrib.level.draft.hint":
    "Guter Anfang. Ein paar Schritte machen ihn klarer und nützlicher.",
  "studio.contrib.level.solid.label": "Solide",
  "studio.contrib.level.solid.hint": "Klar strukturiert — bereit zum Übernehmen und Prüfen lassen.",
  "studio.contrib.strengthsTitle": "Schon gut",
  "studio.contrib.strength.text": "Echter Inhalt vorhanden",
  "studio.contrib.strength.headings": "Mit Überschriften gegliedert",
  "studio.contrib.strength.steps": "Schritte als Liste",
  "studio.contrib.strength.highlights": "Wichtiges hervorgehoben",
  "studio.contrib.strength.links": "Verweise/Links enthalten",
  "studio.contrib.strength.evidence": "Belege/Anhänge vorhanden",
  "studio.contrib.suggestionsTitle": "Macht ihn stärker",
  "studio.contrib.suggestion.detail": "Etwas mehr Detail ergänzen",
  "studio.contrib.suggestion.headings": "Überschriften für Abschnitte",
  "studio.contrib.suggestion.steps": "Schritte als Liste ergänzen",
  "studio.contrib.suggestion.referenceAttachments": "Anhänge im Text erwähnen",
  "studio.contrib.valueNote":
    "Dein Erfahrungswissen zählt — gesichert wird es erst nach der Prüfung durch Kolleg:innen.",
  "studio.tips.title": "So arbeitest du im Studio",
  "studio.tips.select.label": "Markieren → formatieren",
  "studio.tips.select.hint":
    "Text markieren, dann über die Toolbar fett/kursiv setzen — oder die gewohnten Tasten nutzen.",
  "studio.tips.structure.label": "Struktur über H2/H3",
  "studio.tips.structure.hint":
    "Abschnitte mit Überschrift 2 und 3 gliedern, Schritte als Listen — das macht den Inhalt lesbar.",
  "studio.tips.ai.label": "KI-Vorschlag prüfen",
  "studio.tips.ai.hint":
    "KI-Hilfe rechts erzeugt einen Vorschlag — erst prüfen, dann bewusst übernehmen. Nichts wird automatisch gespeichert.",
  "studio.tips.blocks.label": "Templates & Blöcke gezielt",
  "studio.tips.blocks.hint":
    "Vorlagen geben eine Struktur vor; Info-/Hinweis-/Warnung-/Erfolg-Blöcke heben Wichtiges hervor.",
  "studio.view.edit": "Bearbeiten",
  "studio.view.preview": "Vorschau",
  "studio.preview.empty": "Noch kein Inhalt — im Editor schreiben, dann hier die Vorschau prüfen.",
  "studio.preview.note":
    "Vorschau zeigt den aktuellen Entwurf, kein validiertes Wissen. Übernehmen schreibt nur in den lokalen Entwurf; Speichern/Einreichen/Revidieren folgt danach über die bestehenden Buttons.",
  "capture.savedViewKo": "Objekt ansehen",
  // SCRUM-310: in der Bibliothek wiederfinden — Herkunftsfilter „eigenes/nicht-Demo-Wissen"
  // (technisch: ohne Demo-Tag; keine Autor-/User-Zuordnung). Auffinden, keine Validierung.
  "capture.savedViewLibrary": "In der Bibliothek ansehen (eigenes Wissen)",
  "capture.savedValidate": "Zur Prüfung geben",
  "capture.savedAgain": "Weiteres erfassen",
  "capture.mode.freitext": "Freitext",
  "capture.mode.formular": "Formular",
  "capture.mode.diktat": "Diktat",
  "capture.mode.interview": "Geführtes Interview",
  "capture.mode.datei": "Aus Datei",
  // PMO-FEA-0006: Wissen aus Datei — Dokument hochladen, KI-Punkteliste mit Belegstellen,
  // ausgewählte Punkte nacheinander im Wizard prüfen/einreichen. Nichts wird automatisch gespeichert.
  "capture.file.hint":
    "Lade ein Dokument hoch — die KI listet auf, welches Wissen darin steckt, jeweils mit wörtlicher Belegstelle. Du wählst aus, was übernommen wird; gespeichert wird nichts automatisch.",
  // JOB 3196 (UX-19): die Anleitung des GANZDOKUMENT-Wegs. Drei Schritte, die wirklich passieren —
  // einlesen, EIN vollständiger Entwurf, öffnen und selbst prüfen. Keine KI-Auswahl, keine
  // Validierung, keine Einreichung: nichts davon findet auf diesem Weg statt.
  "capture.file.hintWhole":
    "Lade ein Dokument hoch — Klarwerk liest es ein und legt daraus genau einen Entwurf mit dem gesamten Inhalt an. Danach öffnest du den Entwurf und prüfst ihn selbst; es wird nichts automatisch geprüft oder eingereicht.",
  "capture.file.upload": "Dokument auswählen",
  "capture.file.replace": "Anderes Dokument wählen",
  "capture.file.remove": "Dokument entfernen",
  "capture.file.dropHint": "Datei hierher ziehen und ablegen — oder unten auswählen.",
  // AUFTRAG-mega34 D1: der Knopf sagt, was er tut. Kein „Upload", kein „Import" — er öffnet die
  // Dateiauswahl des Rechners, mehr nicht.
  "capture.file.pick": "Datei auswählen",
  "capture.file.dropActive": "Datei hier ablegen …",
  "capture.file.dropReject":
    "„{{name}}“ wird hier noch nicht unterstützt — bitte eine Text-, Word-, PDF-, PPTX- oder Bilddatei ablegen.",
  "capture.file.extracting": "Lese „{{name}}“ …",
  "capture.file.loaded": "„{{name}}“ gelesen — bereit für die Wissenssuche.",
  "capture.file.empty": "In „{{name}}“ wurde kein Text gefunden.",
  "capture.file.emptyPdf":
    "In „{{name}}“ wurde kein Text gefunden — ein gescanntes PDF ohne Textebene wird noch nicht unterstützt.",
  "capture.file.emptyPptx":
    "In „{{name}}“ wurden keine übernehmbaren Texte gefunden (reine Bild-/Grafik-Präsentation). Es wurde nichts gespeichert — das Original kannst du bei Bedarf manuell als Datei anhängen.",
  "capture.file.pdfTruncated": "Nur die ersten {{count}} Seiten importiert.",
  "capture.file.pptxTruncated": "Nur die ersten {{count}} Folien importiert.",
  "capture.slides.toggle": "Folien als Bilder übernehmen.",
  "capture.slides.toggleHint":
    "Bei PowerPoint-Dateien wird zusätzlich jede Folie als Bild an den Beitrag angehängt (Abschnitt Folienansicht). Die Umwandlung läuft auf dem Server und kann einen Moment dauern.",
  "capture.slides.heading": "Folienansicht",
  "capture.slides.converting": "Folien von {{name}} werden auf dem Server in Bilder umgewandelt …",
  "capture.slides.done": "{{count}} Folie(n) als Bild angehängt.",
  "capture.slides.truncated":
    "Es wurden nur die ersten {{max}} Folien umgewandelt (harte Obergrenze).",
  "capture.slides.dropped":
    "{{count}} Folienbild(er) passten nicht mehr ins Beitrags-Budget und wurden weggelassen.",
  "capture.slides.busy":
    "Der Server wandelt gerade eine andere Präsentation um — bitte in einem Moment erneut importieren. Der Text-Import ist vollständig.",
  "capture.slides.unavailable":
    "Die Folien-Ansicht ist auf diesem Server derzeit nicht verfügbar. Der Text-Import ist vollständig.",
  "capture.slides.timeout":
    "Der Server arbeitet noch oder ist nicht erreichbar — die Folien-Konvertierung wurde clientseitig abgebrochen; der Text-Import bleibt vollständig erhalten.",
  "capture.slides.failed":
    "Die Folien konnten nicht in Bilder umgewandelt werden. Der Text-Import ist vollständig.",
  // JOB 2687 D1: „zu lang" und „kaputt" sind zwei Meldungen — jede sagt, was der Mensch tun kann.
  "capture.slides.serverTimeout":
    "Die Konvertierung dauerte zu lange und wurde abgebrochen — bitte ein kleineres Deck versuchen (weniger Folien oder kleinere Bilder). Der Text-Import ist vollständig.",
  "capture.slides.invalid":
    "Die Präsentation konnte nicht als Folienbilder gelesen werden — die Datei ist beschädigt oder kein lesbares .pptx. Bitte eine andere Datei versuchen. Der Text-Import ist vollständig.",
  "capture.file.pptxTooLarge":
    "„{{name}}“ ist zu groß oder zu stark komprimiert für den sicheren Import und wurde NICHT gelesen. Bitte die Präsentation verkleinern oder aufteilen.",
  // JOB 2700 D1: die PDF-Kante vor dem Parser und die Frist des Parsers — beides gesagt, nicht gehangen.
  "capture.file.pdfTooLarge":
    "„{{name}}“ ist mit {{mb}} MB zu groß für den Import (Grenze {{limitMb}} MB) und wurde NICHT gelesen. Bitte das Dokument aufteilen — das Original bleibt unberührt.",
  "capture.file.pdfTimeout":
    "„{{name}}“ konnte in {{s}} Sekunden nicht gelesen werden — der Import wurde abgebrochen. Bitte das Dokument verkleinern oder aufteilen.",
  "capture.file.pptxImagesFormat":
    "{{count}} Bilder konnten nicht übernommen werden — Format nicht unterstützt.",
  "capture.file.pptxImagesBudget":
    "{{count}} Bilder konnten nicht übernommen werden — zu groß für die Einbettung.",
  "capture.file.imagesOnlyNoText":
    "Bilder übernommen — ohne Text sind keine KI-Vorschläge möglich.",
  "capture.file.imagesAllDropped":
    "Die Bilder konnten nicht in den Beitrag übernommen werden (zu groß oder Format nicht unterstützt) — das Original wird beim Speichern als Anhang mitgeführt.",
  // JOB 513/D3B: derselbe Fall OHNE gesichertes Original. Der Satz darüber sagt einen Anhang zu; ohne
  // Original wäre das eine Zusage ohne Deckung. Hier steht deshalb, was wirklich gilt.
  "capture.file.imagesAllDroppedNoOriginal":
    "{{dropped}} Bild(er) konnten nicht in den Beitrag übernommen werden, und das Original konnte NICHT als Anhang gesichert werden — diese Bilder sind verloren.",
  // JOB 513/D3B: defekte/unauflösbare Bildverweise haben jetzt einen echten Grund statt einer Leerstelle.
  "capture.file.imagesDefect":
    "{{count}} Bild(er) konnten nicht gelesen werden — der Verweis in der Datei ist defekt oder die Bilddatei fehlt.",
  "capture.file.imagesOutsidePath":
    "{{count}} Bild(er) liegen außerhalb des übernommenen Folienbereichs (zum Beispiel Hintergrundbilder) und wurden nicht übernommen.",
  // JOB 513/D3B: je Grenzart der reale Wert — nicht mehr für alle drei Kanten dieselbe Begründung.
  "capture.file.imagesBudgetBodyHtml":
    "Grenze „Beitragstext“: {{count}} Bild(er) passten nicht mehr in den Beitrag (höchstens {{limitBytes}} Byte; gebraucht wurden {{actualBytes}}).",
  "capture.file.imagesBudgetSingleImage":
    "Grenze „Einzelbild“: {{count}} Bild(er) sind für sich genommen zu groß (höchstens {{limitBytes}} Byte je Bild; das größte hatte {{actualBytes}}).",
  "capture.file.imagesBudgetTotalImages":
    "Grenze „Bildersumme“: {{count}} Bild(er) hätten die Gesamtgröße aller Bilder gesprengt (höchstens {{limitBytes}} Byte; gebraucht wurden {{actualBytes}}).",
  "capture.file.imageCaptionPlaceholder": "Noch keine Bildbeschreibung",
  // JOB 3254 (M5c-UI): die Bilanz der Word-Bildunterschriften. Drei Sätze, weil eine Null nie
  // genannt wird — „0 unklar" behauptete eine Messung, die niemanden betrifft (Nullregel).
  "capture.file.captionsBalance":
    "{{assigned}} Bildunterschrift(en) aus dem Dokument übernommen · {{ambiguous}} nicht eindeutig zuordenbar (leer gelassen).",
  "capture.file.captionsBalanceAssigned":
    "{{assigned}} Bildunterschrift(en) aus dem Dokument übernommen.",
  "capture.file.captionsBalanceAmbiguous":
    "{{ambiguous}} Bildunterschrift(en) im Dokument gefunden, aber nicht eindeutig zuordenbar (leer gelassen).",
  "capture.file.imagesKept":
    "{{kept}} Bilder übernommen, davon {{compressed}} für die Textansicht komprimiert; das unveränderte Original liegt im Anhang.",
  "capture.file.imagesKeptDropped":
    "{{kept}} Bilder übernommen, davon {{compressed}} komprimiert; {{dropped}} wegen Größe weggelassen. Das unveränderte Original liegt im Anhang.",
  "capture.file.imagesNoOriginal":
    "{{kept}} Bilder übernommen, davon {{compressed}} komprimiert; das Original konnte NICHT als Anhang gesichert werden.",
  "capture.file.imagesLost":
    "{{kept}} Bilder übernommen, davon {{compressed}} komprimiert; {{dropped}} weggelassen. Das Original konnte NICHT gesichert werden — {{dropped}} Bilder sind verloren.",
  "capture.file.tooLargeForImport":
    "Das Dokument ist auch nach Bildkompression zu groß für den Textimport — bitte kleiner aufteilen. Das Original bleibt unberührt.",
  "capture.file.importNote.docx":
    "Struktur und Bilder übernommen (Best-Effort) — exaktes Layout kann abweichen.",
  "capture.file.importNote.pdf":
    "Best-Effort-Textimport — Layout und Bilder wurden nicht übernommen.",
  "capture.file.importNote.pptx":
    "Best-Effort-Import aus PowerPoint — Text, Listen und Tabellen je Folie übernommen, soweit vorhanden; Layout, Animationen, Übergänge und Sprechernotizen gehen verloren.",
  // JOB 4203 D3: die vierte Import-Quittung. Sie spiegelt `noteText` aus SOURCE_LABELS
  // (`lib/captureFromFile.ts`) — Fläche und persistierte Quittung sagen denselben Satz.
  "capture.file.importNote.text":
    "Best-Effort-Textimport — Überschriften, Aufzählungen und einfache Tabellen übernommen; Auszeichnungen (fett, kursiv, Code), Verweise und Bilder bleiben als Zeichen stehen. Überschriften und Aufzählungen brauchen eine Leerzeile darüber, sonst bleiben sie Fließtext.",
  "capture.file.parseError": "„{{name}}“ konnte nicht gelesen werden.",
  "capture.file.unsupported":
    "„{{name}}“ wird hier nicht unterstützt — bitte als TXT/MD, DOCX, PDF oder PPTX bereitstellen. Bilder gehen nur über OCR.",
  "capture.file.ocrCta": "Text im Bild erkennen (OCR)",
  "capture.file.ocrBusy": "Texterkennung läuft …",
  "capture.file.queryLabel": "Wonach soll die KI suchen? (optional)",
  "capture.file.queryPlaceholder":
    "z. B. „Grenzwerte und Prüfintervalle“ — leer lassen, um alles Wissen zu finden",
  "capture.file.queryHelp.title": "Gezielt suchen",
  "capture.file.queryHelp.body":
    "Ohne Angabe listet die KI alle Wissenspunkte im Dokument auf. Mit Suchauftrag beschränkt sie sich auf deinen Fokus. Erfunden wird in beiden Fällen nichts — jeder Punkt trägt eine wörtliche Belegstelle aus dem Dokument.",
  // SCRUM-451 (Pedi 05.07.): Ergebnis-Sprache — Systemsprache oder Original des Dokuments.
  "capture.file.langLabel": "Ergebnis in",
  "capture.file.langSystem": "Systemsprache",
  "capture.file.langSource": "Originalsprache",
  "capture.file.langHelp.title": "Ergebnis-Sprache",
  "capture.file.langHelp.body":
    "Systemsprache: Titel und Zusammenfassungen erscheinen in deiner Oberflächensprache (Deutsch/Englisch) — ein englisches Dokument wird dabei faktisch übersetzt. Originalsprache: Die KI übersetzt nichts, die Punkte bleiben in der Sprache des Dokuments. Wörtliche Belegstellen bleiben in beiden Fällen unverändert.",
  "capture.file.importMode.label": "Importart",
  "capture.file.importMode.points": "In Punkte analysieren",
  "capture.file.importMode.pointsDesc":
    "Klarwerk extrahiert einzelne Aussagen aus der Datei. Bestehender Weg, nichts wird automatisch gespeichert.",
  "capture.file.importMode.whole": "Ganzes Dokument übernehmen",
  "capture.file.importMode.wholeDesc":
    "Klarwerk legt genau einen Entwurf mit dem gesamten Dokument an. Keine automatische Validierung.",
  "capture.file.searchCta": "Datei analysieren",
  "capture.file.searching": "Die KI liest das Dokument …",
  "capture.file.wholeCta": "Ganzes Dokument als Entwurf speichern",
  "capture.file.wholeSaving": "Entwurf wird gespeichert …",
  "capture.file.wholeSaved":
    "„{{name}}“ als ein Entwurf gespeichert — Quelle: Dateiname, gesamtes Dokument.",
  "capture.file.wholeSourceNote":
    "Quelle wird im Entwurf sichtbar vermerkt: {{name}}, gesamtes Dokument. Der Entwurf bleibt offen und ungeprüft.",
  "capture.file.wholeSavedTitle": "Dokument als Entwurf gespeichert",
  // JOB 3196 (UX-19): Ersatz für den nackten Entwickler-String „Frontdoor bereit". Er sagt, was der
  // Zustand IST — und behauptet ausdrücklich keinen Prüf- oder Freigabestand.
  "capture.file.wholeSavedBadge":
    "Zum Öffnen bereit — der Entwurf ist ungeprüft und nicht eingereicht.",
  "capture.file.wholeSavedSource": "Quelle: {{name}}, gesamtes Dokument.",
  "capture.file.wholeOpenDraft": "Entwurf öffnen",
  "capture.file.wholeOpenMissing":
    "Entwurf wurde gespeichert, konnte aber nicht direkt geöffnet werden.",
  "capture.file.wholeImportAnother": "Weiteres Dokument importieren",
  // WP-D10c: Label dient als dezente Aufklapp-Zeile (Info-Icon + Titel, zugeklappt als Start).
  "capture.file.formatTitle": "Informationen zu Dateiformaten und Formatierung",
  // WP-D10c (Ehrlichkeit): seit WP-D9 werden PPTX-FOTOS übernommen (figures) — Vektor-Grafiken/Formen
  // weiterhin nicht. Konsistent zu capture.file.importNote.pptx.
  "capture.file.formatHint":
    "TXT/MD und weitere Textdateien werden als Text übernommen. DOCX: Struktur (Überschriften, Listen, Tabellen) und Bilder werden Best-Effort übernommen; exaktes Layout kann abweichen. PDF läuft als Best-Effort-Textimport; Layout und Bilder gehen verloren. PPTX: Text, Struktur und Fotos je Folie werden Best-Effort übernommen; Layout, Animationen, Vektor-Grafiken/Formen und Notizen gehen verloren.",
  "capture.file.supportedTitle": "Aktiv auswählbar:",
  "capture.file.supportedFormats":
    "TXT, MD/Markdown, CSV, LOG, JSON, DOCX, PDF, PPTX und Bilder für OCR.",
  "capture.file.unsupportedFormats":
    "RTF wird aktuell nicht unterstützt. Bitte als TXT/MD, DOCX, PDF oder PPTX bereitstellen, sofern verfügbar.",
  "capture.file.cancel": "Abbrechen",
  "capture.file.pointsTitle": "Gefundenes Wissen — wähle aus, was übernommen wird",
  "capture.file.pointsHint":
    "Jeder Punkt trägt seine Belegstelle aus dem Dokument. Wähle ab, was du nicht brauchst — übernommen wird erst auf Klick.",
  "capture.file.excerptLabel": "Belegstelle",
  "capture.file.pointCount": "{{selected}} von {{total}} Punkten ausgewählt",
  "capture.file.applyCta": "Ausgewählte übernehmen",
  "capture.file.queueBadge": "Punkt {{current}} von {{total}} aus „{{name}}“",
  "capture.file.queueHint":
    "Jeder Punkt wird einzeln als Wissensseite geprüft und eingereicht — nichts wird automatisch gespeichert.",
  "capture.file.queueSkip": "Punkt überspringen",
  "capture.file.queueDone": "Alle Punkte aus „{{name}}“ sind bearbeitet.",
  "capture.file.sourceNote": "Die Quelle „{{name}}“ wird am Wissensobjekt vermerkt.",
  // SCRUM-409 (PMO-FEA-0008-Delta): Import-Quittung, Mehrpunkt-Entwürfe, Zusammenführen.
  "capture.file.loadedStats":
    "„{{name}}“ eingelesen ({{chars}} Zeichen). Sag optional, wonach gesucht werden soll, und starte die Wissenssuche.",
  // JOB 3196 (UX-19): dieselbe Quittung für den Ganzdokument-Weg — Umfang unverändert ehrlich,
  // aber der nächste Schritt ist der, den es hier gibt.
  "capture.file.loadedStatsWhole":
    "„{{name}}“ eingelesen ({{chars}} Zeichen). Lege daraus jetzt den Entwurf mit dem gesamten Dokument an.",
  "capture.file.saveDraftsCta": "Als Entwürfe speichern",
  "capture.file.draftsSaved":
    "{{count}} Entwürfe aus „{{name}}“ gespeichert — je mit Quellenvermerk. Du findest sie oben unter „Entwürfe fortsetzen“.",
  "capture.file.draftsPartial":
    "Nicht alle Punkte konnten als Entwurf gespeichert werden: {{failed}}. Bereits angelegte Entwürfe bleiben erhalten.",
  "capture.file.mergeCta": "Ausgewählte zu einem Eintrag verbinden",
  "capture.file.mergedNote":
    "{{count}} Punkte aus „{{name}}“ zu einem Eintrag zusammengeführt — alle Belegstellen stehen im Dokument, die Quellen werden beim Einreichen vermerkt.",
  // SCRUM-433 (Pedi 03.07., VIP): die drei Wege aus der Punkteliste jederzeit erklärt.
  "capture.file.connectHint":
    "Mehrere anhaken und „Verbinden“ fasst sie zu EINEM Eintrag zusammen · „Als Entwürfe speichern“ legt je Punkt einen eigenen an · „Übernehmen“ arbeitet sie einzeln ab.",
  "capture.file.connectDisabledHint": "Mindestens 2 Erkenntnisse anhaken, um sie zu verbinden.",
  "capture.file.selectAll": "Alle auswählen",
  "capture.file.deselectAll": "Alle abwählen",
  "capture.file.mergedInList":
    "{{count}} Erkenntnisse zu einem Punkt verbunden — bleibt in der Liste.",
  "capture.file.applyDisabledHint":
    "Genau eine Erkenntnis anhaken — es wird immer nur eine weiterverarbeitet.",
  "capture.file.purgeUnselectedQ":
    "Sollen die {{count}} nicht ausgewählten Erkenntnisse gelöscht werden?",
  "capture.file.purgeUnselectedYes": "Nicht ausgewählte löschen",
  "capture.file.purgeUnselectedKeep": "Behalten",
  // SCRUM-384 / KG-UX-001/002/003/010: Erzähl-Einstieg als Standardweg, Formular als Expertenpfad.
  "capture.entry.narrateKicker": "Erzähl dein Wissen — die KI strukturiert, du prüfst",
  // AUFTRAG-mega51 BLOCK B: der empfohlene Erzählweg ist sichtbar einer — die übrigen bleiben.
  "capture.entry.recommendedBadge": "Empfohlen",
  "capture.entry.expertToggle": "Expertenmodus: Formular direkt ausfüllen",
  "capture.entry.expertHint":
    "Für Routinierte: alle Felder direkt ausfüllen — gleiche Felder, gleicher Prüfweg. Der geführte Erzähl-Einstieg bleibt jederzeit erreichbar.",
  "capture.entry.expertActive":
    "Expertenmodus: Du füllst das Formular direkt aus. Gespeichert und geprüft wird wie im geführten Weg — nichts wird automatisch validiert.",
  "capture.entry.backToGuided": "Zurück zum geführten Weg",
  "capture.raw": "Erfahrungsnotiz",
  "capture.rawPlaceholder":
    "Erfahrung formlos festhalten — die KI strukturiert daraus einen Entwurf. Du prüfst und reichst ein.",
  "capture.structure": "Mit KI strukturieren",
  "capture.assist": "KI-Hilfe",
  // SCRUM-375 / AG-12: erweiterte/technische Felder als Progressive Disclosure (optional, nichts entfernt).
  "capture.advanced.title": "Erweiterte Details (optional)",
  "capture.advanced.hint":
    "Kategorie, Anlage, Prüf-Anzahl, Schlagwörter, Dokumente & Bilder — nichts davon ist Pflicht. Erzähl zuerst dein Wissen; die Details kannst du jederzeit aufklappen und ergänzen.",
  "capture.advanced.filled": "{{count}} ausgefüllt",
  // SCRUM-312: KI-Nachbearbeitung (Beta) — Vorschlag, kein Auto-Submit; Mensch übernimmt bewusst.
  "capture.ai.title": "KI-Nachbearbeitung (Beta)",
  "capture.ai.hint":
    "Die KI macht einen Vorschlag — du prüfst ihn und übernimmst bewusst. Keine automatische Speicherung, keine Validierung; Inhalte/Fakten werden nicht erfunden.",
  "capture.ai.bodyHint":
    "KI-Hilfe für den ausführlichen Inhalt: Vorschlag prüfen und bewusst übernehmen (Ersetzen/Anhängen). Keine automatische Speicherung, keine Validierung; Inhalte und Quellen bitte selbst prüfen.",
  "capture.ai.applyAsLabel": "Als Struktur übernehmen",
  "capture.ai.applyAs.section": "Als Abschnitt anhängen",
  "capture.ai.applyAs.info": "Als Info anhängen",
  "capture.ai.applyAs.note": "Als Hinweis anhängen",
  "capture.ai.applyAs.warning": "Als Warnung anhängen",
  "capture.ai.applyAs.success": "Als Erfolg anhängen",
  "capture.ai.action.clarify": "Klarer",
  "capture.ai.action.structure": "Strukturieren",
  "capture.ai.action.expand": "Erweitern",
  "capture.ai.action.spelling": "Rechtschreibung",
  "capture.ai.action.format": "Formatieren",
  "capture.ai.instr.clarify": "Formuliere klarer und präziser, ohne den Sinn zu verändern.",
  "capture.ai.instr.structure": "Strukturiere den Text in klare, knappe Sätze bzw. Stichpunkte.",
  "capture.ai.instr.expand":
    "Formuliere etwas ausführlicher und vollständiger — ohne neue Fakten zu erfinden.",
  "capture.ai.instr.spelling": "Korrigiere nur Rechtschreibung und Grammatik.",
  "capture.ai.instr.format":
    "Verbessere nur die Lesbarkeit durch saubere Absätze und Zeichensetzung. Verwende KEINE Markdown-Zeichen wie #, ## oder * — keine Überschriften-Zeichen. Inhalt und Wortlaut unverändert lassen, nichts hinzufügen oder weglassen.",
  "capture.ai.help.clarify": "Formuliert verständlicher und präziser — der Sinn bleibt gleich.",
  "capture.ai.help.structure": "Ordnet den Text in knappe Sätze bzw. Stichpunkte.",
  "capture.ai.help.expand": "Formuliert ausführlicher — erfindet dabei keine neuen Fakten.",
  "capture.ai.help.spelling": "Korrigiert nur Rechtschreibung und Grammatik, sonst nichts.",
  "capture.ai.help.format":
    "Verbessert nur die Lesbarkeit (Absätze, Zeichensetzung) — ohne Markdown-Zeichen; der Inhalt bleibt wörtlich.",
  // SCRUM-386: ?-Hilfe für kundeneigene Funktionen — die Anweisung ist offen sichtbar (G-3).
  "capture.ai.customHelp":
    "Eigene KI-Funktion deiner Organisation (vom Admin angelegt). Anweisung an die KI: „{{instruction}}“. Wie bei allen KI-Aktionen entsteht nur ein Vorschlag zur Vorschau — übernommen wird ausschließlich, was du bewusst per Klick übernimmst.",
  // JOB 3566: der Satz für den GESCHEITERTEN Abruf der eigenen KI-Funktionen — er benennt genau
  // sie und sagt nichts über die Seite, die KI oder deinen Text. Ohne ihn sieht „diese Organisation
  // hat keine eigenen Funktionen" genauso aus wie „sie konnten nicht geladen werden".
  "capture.ai.presetsFailed":
    "Die eigenen KI-Funktionen deiner Organisation konnten nicht geladen werden.",
  "capture.ai.freeLabel": "Eigene KI-Anweisung",
  "capture.ai.freePlaceholder": "z. B. „kürzer und sachlicher formulieren“",
  "capture.ai.run": "Ausführen",
  "capture.ai.previewTitle": "KI-Vorschlag (Vorschau)",
  "capture.ai.replace": "Ersetzen",
  "capture.ai.append": "Anhängen",
  "capture.ai.discard": "Verwerfen",
  "capture.author": "Autor",
  "capture.documents": "Dokumente (Kontext / Anhang)",
  "capture.documentsUpload": "Dateien hochladen",
  "capture.uploadLimits":
    "Bis zu {{count}} Dateien, je max. {{mb}} MB Übertragungsgröße (rund {{raw}} MB Rohdatei).",
  "capture.attachLimitReached":
    "{{taken}} von {{total}} Dateien zur Verarbeitung akzeptiert — die Anhang-Grenze liegt bei {{limit}}.",
  "capture.documentsHint":
    "txt, md, csv, json, log, docx, pdf → Volltext · Bilder: optional per OCR",
  "capture.images": "Bilder (Anhang)",
  "capture.imagesUpload": "Bilder anhängen",
  "capture.imagesHint": "Auch aus der Mobile-App. Werden am Objekt angehängt.",
  "capture.videoAdded":
    "{{name}} angehängt. Transkription auf Klick — nichts passiert automatisch.",
  "capture.videoTranscribe": "Transkribieren",
  "capture.videoBusy": "läuft …",
  "capture.videoRunning": "Transkribiere {{name}} — kurze Clips gehen schnell.",
  "capture.videoDone":
    "Transkript von {{name}} übernommen — bitte prüfen (Entwurf, keine Wahrheit).",
  "capture.saveDraft": "Als Entwurf speichern",
  "capture.draftSaved": "Entwurf gespeichert.",
  "capture.draftUpdated": "Entwurf aktualisiert.",
  // LAUF 6 RUNDE 2 (erfassen-doppelklick, bens B7): der Teilerfolg des gemeinsamen Speicherns.
  "capture.teilerfolg.dateiAusstehend":
    "Noch nicht alles gesichert: Der Entwurf ist gespeichert, die Datei „{{name}}“ wird noch gespeichert.",
  "capture.teilerfolg.dateiGescheitert":
    "Nur teilweise gespeichert: Der Entwurf ist gesichert, die Datei „{{name}}“ nicht. Sie liegt weiter hier — „Als Entwurf speichern“ versucht es erneut.",
  "capture.draftDiscarded": "Entwurf gelöscht.",
  // Bugfix (Pedi 04.07.): ehrliche Nachfrage vor dem Löschen, keine Behauptung, die der Zustand
  // nicht hergibt. Bis JOB 3668 stand hier „Entwurf endgültig löschen?" — mit der Begründung,
  // Entwürfe würden endgültig gelöscht, weil es keinen Papierkorb gebe.
  //
  // JOB 3768: DIESE VORAUSSETZUNG IST WEG. Seit JOB 3668 (LIVE am 12.09.2026) legt
  // `DELETE /api/drafts/:id` den Entwurf in den Papierkorb, und „Meine Entwürfe" zeigt ihn dort
  // samt „Wiederherstellen" (`pages/MeineEntwuerfe.tsx:252`). Der alte Satz war damit die stärkere
  // Aussage ohne ihre Voraussetzung — und er widersprach der Seitenhilfe derselben Fläche, die den
  // Papierkorb erklärt. ENDGÜLTIG heisst jetzt nur noch, was es auch ist: der zweite Griff IM
  // Papierkorb (`adm.trash.purge`/`adm.trash.purgeQ`).
  //
  // BAUFORM WÖRTLICH VON `ko.deleteQ` (:995) ÜBERNOMMEN — „Verb? Folge.": Das Wissensobjekt sagt
  // seit langem „Löschen? Der Beitrag wandert in den Papierkorb …". Zwei Gründe, und beide sind
  // gemessen: (1) Gleiche Funktionen heissen gleich (Pedi). (2) Der Sammler
  // `tests/app/mega45-loeschbestaetigung-sammler.test.ts:83` erntet zerstörende Rückfragen aus
  // DIESEM Katalog über ihr VERB (löschen/verwerfen/entfernen/leeren) und hält dann an ihrer
  // Knopfgruppe fest, dass genau ein Knopf die Warnfarbe trägt. Eine Frage ohne Verb („Entwurf in
  // den Papierkorb legen?") fällt aus der Ernte — die Farbregel gälte für diese Fläche dann
  // stillschweigend nicht mehr. Der Ort heisst „Meine Entwürfe" und nicht „unter der Liste": diese
  // Rückfrage steht auch im Editor und im Arbeitsraum, und dort gibt es den Papierkorb-Abschnitt
  // nicht. KEINE FRIST wie beim Wissensobjekt (`TRASH_RETENTION_DAYS`) — der Entwurfs-Papierkorb hat keine.
  "capture.discardDraftQ":
    "Löschen? Der Entwurf wandert in den Papierkorb und ist unter „Meine Entwürfe“ wiederherstellbar.",
  "capture.discardDraftKeep": "Behalten",
  "capture.discardDraftYes": "Löschen",
  "capture.imageError": "„{{name}}“ konnte nicht als Bild gelesen werden.",
  "capture.draftFallbackTitle": "Entwurf",
  "capture.resumeTitle": "Entwürfe fortsetzen",
  "capture.resumeExpand": "Entwürfe anzeigen ({{count}})",
  "capture.resumeCollapse": "Entwürfe einklappen",
  // AUFTRAG-mega38 BLOCK J4: `capture.resumeCollapsedHint` ist ERSATZLOS weg — der Satz erklärte
  // der Leserin unsere Layoutentscheidung („… damit die Erfassungswege darunter erreichbar
  // bleiben"). mega34 F hatte an ihm nur die Einzahlform repariert; die Form war richtig, der Satz
  // gehörte trotzdem nicht auf ihren Bildschirm. Auch in EN und NL entfernt.
  "capture.resume": "Fortsetzen",
  "capture.discardDraft": "Verwerfen",
  // AUFTRAG-sortfilter · Punkt 2: Filter + Sortierung der Entwurfsliste.
  "capture.draftSearch": "Entwürfe durchsuchen",
  "capture.draftSortLabel": "Sortieren",
  "capture.draftSort.recent": "Zuletzt gespeichert (neu→alt)",
  "capture.draftSort.oldest": "Zuletzt gespeichert (alt→neu)",
  "capture.draftSort.title": "Titel A→Z",
  "capture.draftAuthorLabel": "Ersteller",
  "capture.draftAuthorAll": "Alle Ersteller",
  // AUFTRAG-BASIC-u2: die Gegenseite derselben Frage. Diese Suche durchsucht AUSSCHLIESSLICH die
  // gespeicherten Entwürfe; „Keine Entwürfe passen zum Filter." war eine Auskunft über einen
  // Filter, nicht über einen Suchraum, und liess offen, wo das Gesuchte sonst stehen könnte.
  // Die Admin-Ansicht sieht ALLE Entwürfe — sie bekommt deshalb einen eigenen, wahren Satz statt
  // einer Behauptung über „deine" Entwürfe.
  "capture.draftScope.note":
    "Diese Suche durchsucht nur deine gespeicherten Entwürfe — kein Wissen aus der Bibliothek.",
  "capture.draftScope.noteAdmin":
    "Diese Suche durchsucht nur gespeicherte Entwürfe (Admin-Ansicht: alle) — kein Wissen aus der Bibliothek.",
  "capture.draftScope.toLibrary": "Im Klarwerk-Wissen suchen",
  "capture.draftEmptyFiltered":
    "Keine gespeicherten Entwürfe passen zu deiner Suche. Durchsucht wurden nur Entwürfe — validiertes Wissen steht in der Bibliothek.",
  "capture.draftJustSaved": "gerade gespeichert",
  "capture.draftCreatorMeta": "Ersteller: {{name}}",
  "capture.draftSavedMeta": "Gespeichert: {{date}}",
  "capture.draftStatusMeta": "Status: Entwurf",
  "capture.editingDraft": "Entwurf geladen — Änderungen werden im selben Entwurf gespeichert.",
  "capture.editingBadge": "in Bearbeitung",
  "capture.fileImportJump": "Datei importieren",
  "capture.loadExample": "Beispiel laden",
  "capture.exampleLoaded":
    "Erfahrungsnotiz geladen — jetzt mit KI strukturieren und den Entwurf prüfen.",
  "capture.docAdded": "{{name}} als Kontext übernommen.",
  "capture.docExtracting": "{{name}} wird gelesen …",
  "capture.docEmpty":
    "{{name}}: kein Text gefunden — ein gescanntes PDF ohne Textebene wird noch nicht unterstützt.",
  "capture.docParseError": "{{name}} konnte nicht gelesen werden.",
  "capture.docUnsupported":
    "{{name}}: nur txt/md/csv/json/log, docx und pdf werden als Volltext gelesen.",
  "capture.ocr": "OCR → Text",
  "capture.ocrRunningShort": "OCR …",
  "capture.ocrRunning": "Text wird aus {{name}} gelesen … Beim ersten Mal dauert das etwas länger.",
  "capture.ocrDone": "OCR-Text aus {{name}} übernommen.",
  "capture.ocrEmpty": "{{name}}: OCR hat keinen Text erkannt.",
  "capture.ocrFailed": "OCR für {{name}} fehlgeschlagen.",
  "capture.ocrUnavailable": "OCR ist derzeit nicht verfügbar.",
  "capture.help.category.title": "Kategorie & #Tags",
  "capture.help.category.body":
    "Die Kategorie ist eine frei vergebbare fachliche Einordnung (z. B. „Instandhaltung“, „Qualität“, „Einkauf“). Tags sind freie Schlagworte zur Auffindbarkeit.",
  "capture.help.validations.title": "Nötige Validierungen",
  "capture.reviewers.title": "Prüfer vorschlagen (optional)",
  "capture.reviewers.helpTitle": "Prüfer vorschlagen",
  "capture.reviewers.helpBody":
    "Wähle Kolleginnen und Kollegen, die deinen Beitrag prüfen sollen. Sie bekommen die Prüfung als offene Zuweisung und eine Benachrichtigung. Ohne Auswahl bleibt der Beitrag offen für alle Prüfer.",
  "capture.reviewers.none": "Noch keine weiteren Personen im Verzeichnis.",
  "capture.reviewers.selected": "Ausgewählt: {{n}}",
  "capture.reviewers.defaultPlaceholder": "Standard: {{n}}",
  "capture.help.validations.body":
    "Wie viele unabhängige Bestätigungen das Objekt braucht, bevor es als „validiert“ gilt (1–5, Standard 3). Mehr = höhere Hürde, belastbarer.",
  "capture.modeSoon": "Dieser Modus folgt.",
  "capture.fTitle": "Kernaussage",
  "capture.fStatement": "Aussage",
  "capture.fBody": "Ausführlicher Inhalt (optional)",
  "editor.bold": "Fett",
  "editor.bodyLabel": "Wissensseite — Fließtext",
  "editor.italic": "Kursiv",
  "editor.h2": "Überschrift",
  "editor.h3": "Unterüberschrift",
  "editor.ul": "Aufzählung",
  "editor.ol": "Nummerierte Liste",
  "editor.link": "Link",
  "editor.panel": "Panel/Hinweis",
  "editor.guidance.title": "So nutzt du den ausführlichen Inhalt",
  "editor.guidance.structure": "Struktur: Überschriften (H2/H3) und Absätze gliedern den Inhalt.",
  "editor.guidance.action": "Handlungswissen: Listen für Schritte, Links als Beleg.",
  "editor.guidance.blocks": "Blöcke: Wichtiges als Info/Hinweis/Warnung/Erfolg markieren.",
  "editor.guidance.ai":
    "KI-Hilfe: liefert Vorschläge — du prüfst und übernimmst bewusst, keine Auto-Validierung.",
  "editor.attach.title": "Anhänge im Editor",
  "editor.attach.images": "Bild(er)",
  "editor.attach.files": "Datei(en)",
  "editor.attach.imageHint": "über den Bild-Button in den ausführlichen Inhalt einfügbar.",
  "editor.attach.fileHint":
    "bleiben als Anhang/Evidence sichtbar und werden nicht inline eingebettet — bitte im Text referenzieren.",
  // SCRUM-371: object-store-bewusste Media-/Evidence-Führung (Bilder inline · verlinkbare Dateien ·
  // Session-Dateien als Evidence). Ehrlich: Evidence ist kein Ersatz für Validierung.
  "editor.media.title": "Bilder, Dateien & Belege",
  "editor.media.images": "Bild(er)",
  "editor.media.imageHint":
    "illustrieren dein Wissen — über den Bild-Button in den Inhalt einfügbar.",
  "editor.media.linkable": "verlinkbare Datei(en)",
  "editor.media.linkableHint":
    "als Beleg/Kontext sicher im Text verlinkbar (interne Objekt-Referenz, kein Roh-Download-Trick).",
  "editor.media.evidence": "Datei(en) als Anhang",
  "editor.media.evidenceHint":
    "bleiben Beleg/Evidence — nach dem Speichern im Text verlinkbar; bis dahin kein Behelfs-/Fake-Link.",
  "editor.media.note":
    "Belege verbessern die Nachvollziehbarkeit, sind aber keine Freigabe — die Validierung entscheidet.",
  "editor.quality.title": "Inhalts-Check",
  "editor.quality.hint": "Prüft die Struktur, nicht die fachliche Richtigkeit. Keine Validierung.",
  "editor.quality.empty": "Noch kein ausführlicher Inhalt erfasst.",
  "editor.quality.thin": "Sehr kurzer Inhalt — bei Bedarf Kontext oder Schritte ergänzen.",
  "editor.quality.headings": "Überschriften",
  "editor.quality.lists": "Listen",
  "editor.quality.blocks": "Blöcke",
  "editor.quality.links": "Links",
  "editor.quality.attachmentsUnreferenced":
    "Anhänge vorhanden, aber im Text nicht erwähnt — ggf. darauf verweisen.",
  "editor.template.title": "Strukturvorlage starten",
  "editor.template.hint":
    "Vorlage auswählen, Vorschau prüfen und bewusst übernehmen. Startstruktur/Vorschlag — bestehender Inhalt wird beim Anhängen nicht ersetzt; nichts wird automatisch gespeichert oder validiert.",
  "editor.template.selected": "Ausgewählte Vorlage",
  "editor.template.preview": "Vorschau",
  "editor.template.procedure.label": "Vorgehen",
  "editor.template.procedure.description": "Bedingungen und Schritte für wiederholbare Arbeit.",
  "editor.template.troubleshooting.label": "Störung",
  "editor.template.troubleshooting.description":
    "Symptom, Ursache und Maßnahme strukturiert erfassen.",
  "editor.template.safety.label": "Sicherheit",
  "editor.template.safety.description": "Warnung, sichere Prüfung und gewünschter Zustand.",
  "editor.template.checklist.label": "Checkliste",
  "editor.template.checklist.description":
    "Abhakbare Prüfpunkte plus „was tun, wenn nicht erfüllt“.",
  "editor.template.handover.label": "Übergabe/Schulung",
  "editor.template.handover.description":
    "Das Wichtigste für die nächste Person: Kernpunkte, typische Fehler, Ansprechpartner.",
  "editor.template.decision.label": "Entscheidungshilfe",
  "editor.template.decision.description":
    "Wenn-dann-Regeln für eine wiederkehrende Entscheidung, inkl. Eskalationsgrenze.",
  "editor.template.applySet": "Vorlage einsetzen",
  "editor.template.applyAppend": "Vorlage unten anfügen",
  "editor.template.applyHelp":
    "Fügt die gezeigte Startstruktur in die Wissensseite ein: Ist die Seite leer, wird sie eingesetzt; steht schon etwas drin, wird sie UNTEN angehängt — nichts wird ersetzt oder gespeichert. Die Platzhalter („… ergänzen“) ersetzt du danach durch dein Wissen.",
  "editor.template.mode.set": "Leerer Inhalt: Die Vorlage wird eingesetzt.",
  "editor.template.mode.append":
    "Bestehender Inhalt: Die Vorlage wird angehängt, nichts wird ersetzt.",
  "editor.applySafety.replaceWarning":
    "Achtung: Ersetzen überschreibt den aktuellen Inhalt. Anhängen lässt den Bestand stehen.",
  "editor.block.info": "Info",
  "editor.block.note": "Hinweis",
  "editor.block.warning": "Warnung",
  "editor.block.success": "Erfolg",
  "editor.image": "Bild aus Anhang",
  // SCRUM-384: ARGUS-Toolbar — Absatz, Text-Labels, KI-Umschalter.
  "editor.para": "Absatz",
  "editor.imageLabel": "Bild",
  "editor.fileLabel": "Datei",
  "editor.aiLabel": "KI",
  "editor.aiToggle": "KI-Hilfe beim Schreiben — öffnet die KI-Palette",
  "editor.noImages": "Keine Bild-Anhänge vorhanden.",
  // SCRUM-456: Bild direkt vom Rechner einfügen + Überschrift für die vorhandenen Anhänge.
  "editor.imageFromDisk": "Bild vom Rechner …",
  "editor.fileFromDisk": "Datei vom Rechner anhängen …",
  "editor.imageFromAttachment": "Aus Anhängen",
  // JOB 3095 · M5: Bild aus dem Bestand — Suche über die Bildunterschrift, Treffer mit Herkunft,
  // Übernahme an den Cursor. Jede Aussage hängt an ihrer Datengrundlage (Zeit der Prüfung).
  "editor.imageSearch.open": "Bild aus dem Bestand …",
  "editor.imageSearch.title": "Bild aus dem Bestand",
  "editor.imageSearch.label": "Bildunterschrift oder Beschreibung suchen",
  "editor.imageSearch.placeholder": "z. B. Schraubverbindung",
  "editor.imageSearch.submit": "Suchen",
  "editor.imageSearch.idle":
    "Gib ein Stichwort ein — gesucht wird in den Bildunterschriften der Einträge, die du lesen darfst.",
  "editor.imageSearch.loading": "Suche läuft …",
  "editor.imageSearch.refreshing": "Stand von {{zeit}} · Auffrischung läuft …",
  "editor.imageSearch.checked": "geprüft {{zeit}}",
  "editor.imageSearch.empty": "Kein Bild mit dieser Beschreibung im Bestand (geprüft {{zeit}})",
  "editor.imageSearch.error": "Suche nicht möglich",
  "editor.imageSearch.offline": "Suche nicht möglich — keine Verbindung",
  "editor.imageSearch.stale": "Stand von {{zeit}} · Auffrischung fehlgeschlagen",
  "editor.imageSearch.capped": "Mehr Treffer als angezeigt — grenze die Suche ein.",
  "editor.imageSearch.herkunft": "aus „{{quelle}}“, Version {{version}}, {{pruefstand}}",
  // Runde 2: Beschreibung (figcaption) UND Benennung (Dateiname/Anhangsname) sind Suchfelder; die
  // Karte sagt, worüber gefunden wurde, und ein fehlendes Feld wird gesagt, nicht erfunden.
  "editor.imageSearch.noCaption": "ohne Beschreibung",
  "editor.imageSearch.nameLabel": "Benennung: {{name}}",
  "editor.imageSearch.foundVia": "Gefunden über: {{felder}}",
  "editor.imageSearch.via.beschreibung": "Beschreibung",
  "editor.imageSearch.via.name": "Benennung",
  "editor.imageSearch.thumbAlt": "Bild aus dem Bestand: {{caption}}",
  "editor.imageSearch.use": "Übernehmen",
  "editor.imageSearch.useLabel": "Bild „{{caption}}“ mit Unterschrift und Herkunft übernehmen",
  "editor.imageSearch.close": "Schließen",
  // WP-D10: rein VISUELLER Platzhalter der leeren Bild-Fußnote (data-kw-placeholder + CSS ::before) —
  // wird nie als Inhalt gespeichert. Kein Emoji, nur das Stift-Zeichen ✎.
  "editor.captionPlaceholder": "✎ Bildbeschreibung hinzufügen …",
  // JOB 3041 (Register I50, VIERTENS): eine Bildbeschreibung, die zu keinem Bild gehört, sagt es
  // selbst. Der erste Satz ist die SICHTBARE Kennzeichnung (CSS ::after), der zweite die
  // angekündigte Beschriftung. Beide sagen NUR, was der Klick tut — er öffnet das Formular.
  // JOB 3055: IM Formular kann der Autor die Zuordnung seit heute herstellen. Die zwei Sätze hier
  // bleiben trotzdem wörtlich, wie sie sind: sie beschreiben den ZUSTAND der Fußnote, nicht das
  // Angebot dahinter — und der Zustand ist unverändert „gehört noch keinem Bild".
  // JOB 3254 (M5c-UI): die zweite Antwort auf „warum steht hier nichts?". Sie sagt, dass eine
  // Beschriftung im Dokument STAND und bewusst nicht geraten wurde — das ist der Unterschied
  // zwischen „hier fehlt etwas" und „hier ist eine offene Frage, die nur du beantworten kannst".
  "editor.captionAmbiguous": "Beschriftung im Dokument, aber nicht eindeutig zuordenbar",
  "editor.captionUnassigned": "noch keinem Bild zugeordnet",
  "editor.captionUnassignedLabel":
    "Bildbeschreibung, noch keinem Bild zugeordnet — öffnet das Beschreibungsformular",
  // JOB 3055 (PRIORITAETEN.md V7): der Zuordnungs-Abschnitt im Beschreibungsformular. Er erscheint
  // nur, wenn die Fußnote zu keinem Bild gehört, und er sagt in JEDER Lage etwas Wahres:
  // entweder er nennt die Bilder, die noch keine Beschreibung haben, oder er nennt den Grund,
  // warum es keines gibt — und die zwei Gründe sind zwei verschiedene Sätze, keine Sammelaussage.
  "editor.assignHeading": "Zu welchem Bild gehört diese Beschreibung?",
  "editor.assignImageName": "Bild {{n}}",
  "editor.assignOptionLabel": "Diese Bildbeschreibung Bild {{n}} zuordnen",
  "editor.assignNoImage": "In diesem Text gibt es kein Bild, dem sie zugeordnet werden könnte.",
  "editor.assignAllDescribed": "Alle Bilder in diesem Text haben schon eine Bildbeschreibung.",
  // RUNDE 2 (bens Korrekturpflicht 3): der DRITTE Grund. Ein Bild ohne belastbare Kennung oder mit
  // unentscheidbarer Fußnotenlage ist NICHT „schon beschrieben" — diese Aussage wäre falsch. Der
  // Satz sagt nur, was erhoben ist, und behauptet nichts über die übrigen Bilder.
  "editor.assignUnclear_one":
    "Bei {{count}} Bild in diesem Text ist nicht belegt, welche Beschreibung dazugehört — es wird deshalb nicht angeboten.",
  "editor.assignUnclear_other":
    "Bei {{count}} Bildern in diesem Text ist nicht belegt, welche Beschreibung dazugehört — sie werden deshalb nicht angeboten.",
  // RUNDE 3 (bens Korrekturpflicht 1): ein Klick, der nichts bewirkt, muss den Grund nennen. Der
  // Satz behauptet NICHT, woran es lag — er sagt, was gilt: die Auswahl darunter ist neu erhoben.
  "editor.assignFailed":
    "Diese Zuordnung ist nicht mehr möglich; der Text hat sich seit dem Öffnen geändert. Die Auswahl unten ist neu erhoben.",
  // Eine Vorschau, die nicht lädt, ist KEIN fehlendes Bild — das Bild bleibt wählbar, nur sein
  // Aussehen fehlt. Deshalb ein eigener Satz und keine der beiden Verneinungen oben.
  "editor.assignPreviewMissing": "Vorschau nicht verfügbar",
  // AUFTRAG-mega88 Block C: der ehrliche Restfall — zu diesem Bild lässt sich keine Fußnote
  // herstellen. Seit der Bildstruktur-Invariante ist er nicht mehr erreichbar; er schweigt trotzdem
  // nicht mehr, falls er es doch einmal wird.
  "editor.captionNoAnchor":
    "Zu diesem Bild lässt sich gerade keine Bildbeschreibung anlegen. Bitte fügen Sie das Bild erneut ein.",
  // JOB 3051 (PRIORITAETEN.md V8): der Editor hat eine doppelt vergebene Bildkennung getrennt und
  // sagt es. Der Satz behauptet NICHT, welches Bild „das richtige" war — er sagt, was geschehen ist,
  // und bittet um eine Sichtprüfung. Kein Alarm: die Trennung ist eine Reparatur, kein Fehler des
  // Autors. Die Zahl ist die Länge der Trennungsliste aus `editorFigures.ts`, nichts sonst.
  "editor.kennungGetrennt_one":
    "Mehrere Bilder trugen dieselbe Kennung. {{count}} Zuordnung wurde getrennt — bitte prüfen Sie die betroffenen Bildbeschreibungen.",
  "editor.kennungGetrennt_other":
    "Mehrere Bilder trugen dieselbe Kennung. {{count}} Zuordnungen wurden getrennt — bitte prüfen Sie die betroffenen Bildbeschreibungen.",
  "editor.kennungGetrenntClose": "Hinweis zu getrennten Bildkennungen schließen",
  // AUFNAHME 20260922 (R-0090): eine ungültige Bildkennung wurde beim Speichern oder Einfügen
  // verworfen. Der Satz sagt, was geschehen ist, und bittet um eine Sichtprüfung.
  "editor.kennungUngueltig_one":
    "Bei {{count}} Bild oder Bildbeschreibung war die Kennung ungültig. Sie wurde verworfen und neu vergeben — bitte prüfen Sie die Zuordnung.",
  "editor.kennungUngueltig_other":
    "Bei {{count}} Bildern oder Bildbeschreibungen war die Kennung ungültig. Sie wurde verworfen und neu vergeben — bitte prüfen Sie die Zuordnung.",
  "editor.kennungUngueltigClose": "Hinweis zu ungültigen Bildkennungen schließen",
  // JOB 3123 (PRIORITAETEN.md Q5c): eine von außen gekommene, vertagte Fassung wurde verworfen,
  // weil im Editor weitergeschrieben wurde (JOB 3107, `emit()`). Die Entscheidung ist richtig und
  // bleibt; sie war nur stumm. Der Satz sagt, was geschehen ist — er behauptet nicht, welche der
  // beiden Fassungen „die richtige" war, denn das weiß hier niemand.
  "editor.fremdfassungVerworfen":
    "Während des Schreibens ist von außen eine neuere Fassung eingetroffen. Der eigene Text ist geblieben; die fremde Fassung wurde verworfen.",
  "editor.fremdfassungVerworfenClose": "Hinweis zur verworfenen Fassung schließen",
  "editor.captionAi.suggest": "KI-Beschreibung vorschlagen",
  "editor.captionAi.loading": "KI-Beschreibung wird erstellt …",
  "editor.captionAi.panelTitle": "Vorschlag",
  "editor.captionAi.aiBadge": "KI-generiert. Bitte prüfen.",
  "editor.captionAi.withContext":
    "Mit Dokument-Kontext erzeugt (Titel, Überschrift und umgebender Text).",
  "editor.captionAi.apply": "Übernehmen",
  "editor.captionAi.discard": "Verwerfen",
  "editor.captionAi.tooLarge": "Das Bild ist zu groß für den Beschreibungs-Vorschlag (max. 5 MB).",
  "editor.captionAi.imageUnreadable": "Das Bild dieser Fußnote konnte nicht gelesen werden.",
  "editor.captionAi.fallbackNoModel":
    "Kein KI-Modell konfiguriert oder freigegeben — ohne Modell gibt es keinen Beschreibungs-Vorschlag (nichts wird erfunden).",
  "editor.captionAi.fallbackTimeout":
    "Die Cloud-KI hat das Zeitlimit überschritten — es gibt daher keinen Vorschlag. Bitte später erneut versuchen.",
  "editor.captionAi.fallbackError":
    "Die Cloud-KI ist gerade nicht erreichbar oder meldet einen Fehler — es gibt daher keinen Vorschlag. Bitte später erneut versuchen.",
  "editor.captionAi.fallbackConfidential":
    "Das Bild ist als vertraulich eingestuft — die Cloud-KI ist dafür ausgeschlossen und kein lokales Vision-Modell ist verdrahtet. Es gibt daher keinen Vorschlag (nichts verlässt den Server).",
  // AUFTRAG-mega9 Block F (Pedi): Texte des ECHTEN Eingabeformulars für die Bildbeschreibung.
  // JOB 2402 D1 (TV1 Scheibe b): der Titelvorschlag aus demselben describe-Lauf. „Vorschlag" steht
  // im Wortlaut, damit die Fläche nie wie ein gesetzter Titel aussieht — übernommen wird erst auf
  // Klick. Der Negativsatz sagt, dass NICHTS ableitbar war, und tut nicht so, als sei etwas
  // schiefgegangen: ein unscharfes Bild ohne erkennbaren Gegenstand ist kein Fehler.
  "editor.titleSuggest.label": "Titelvorschlag",
  "editor.titleSuggest.apply": "Als Titel übernehmen",
  "editor.titleSuggest.none":
    "Aus diesem Bild ließ sich kein Titel ableiten — dein Titel bleibt, wie er ist.",
  // JOB 2489 D1 (TV1 Rang 1): die Herkunft des Vorschlags. Beide Sätze sagen, WORAUS der Titel
  // entstanden ist — ohne sie wäre „eine Quelle je Objekt" für den Menschen nicht erkennbar.
  "editor.titleSuggest.sourceText": "Aus dem Text dieses Beitrags.",
  "editor.titleSuggest.sourceImage":
    "Aus der Bildbeschreibung — dein Beitrag hat noch keinen Text.",
  "editor.captionForm.open": "Bildbeschreibung bearbeiten",
  "editor.captionForm.title": "Bildbeschreibung",
  "editor.captionForm.label": "Beschreibung des Bildes",
  "editor.captionForm.placeholder": "Was ist auf dem Bild zu sehen, und warum steht es hier?",
  "editor.captionForm.limit": "{{n}} von {{max}} Zeichen",
  "editor.captionForm.limitReached": "Maximale Länge erreicht ({{max}} Zeichen).",
  "editor.captionForm.append": "An den Text anhängen",
  "editor.captionForm.save": "Beschreibung speichern",
  "editor.captionForm.cancel": "Abbrechen",
  "editor.captionForm.imageAlt": "Bild, das beschrieben wird",
  "editor.captionForm.noSuggestionYet":
    "Noch kein Vorschlag angefordert. Der Text bleibt deiner — ein Vorschlag wird nie automatisch übernommen.",
  // AUFTRAG-mega11 Block D (bens SB-4): das Ziel des Formulars hat sich unter ihm verändert.
  "editor.captionForm.stale":
    "Dieses Bild hat sich inzwischen geändert — die Beschreibung wurde NICHT gespeichert, damit sie nicht beim falschen Bild landet. Bitte den Text kopieren, das Formular schließen und am aktuellen Bild erneut öffnen.",
  // AUFTRAG-mega84 Block A: die Bildbeschreibung selbst ist der Einstieg — sie sagt das auch an.
  "editor.captionForm.openLabel": "Bildbeschreibung bearbeiten (öffnet das Eingabeformular)",
  // AUFTRAG-mega84 Block B (Pedi, 31.07.): fett, kursiv, Zeilenumbruch — mehr nicht.
  "editor.captionForm.formatLabel": "Formatierung",
  "editor.captionForm.bold": "Fett (Strg/Cmd + B)",
  "editor.captionForm.italic": "Kursiv (Strg/Cmd + I)",
  "editor.captionForm.lineBreak": "Zeilenumbruch (Umschalt + Eingabe)",
  "editor.captionForm.selectFirst":
    "Markiere zuerst den Text, den du auszeichnen möchtest — dann wirkt Fett oder Kursiv darauf.",
  "editor.file": "Datei verlinken",
  "editor.insertFile": "Datei-Anhang als Link einfügen",
  "editor.noFiles":
    "Noch keine verlinkbaren Dateien — hochgeladene Dateien werden erst nach dem Speichern verlinkbar (mit Objekt-Referenz). Bis dahin bleiben sie als Anhang/Evidence erhalten; kein Behelfs-Link.",
  // SCRUM-372: ruhige Drag&Drop/Einfügen-Führung (nur Bilder inline; Dateien bleiben Evidence).
  "editor.drop.hint":
    "Bilder hierher ziehen oder einfügen (Strg/⌘+V). Dateien bleiben Beleg/Evidence.",
  // JOB 2610 D3: derselbe Satz OHNE die Dateizusage — für Flächen, die keinen Dateiweg haben.
  // Wortgleich die erste Hälfte; kein neuer Wortlaut für dieselbe Sache.
  "editor.drop.hintImagesOnly": "Bilder hierher ziehen oder einfügen (Strg/⌘+V).",
  "editor.drop.imageActive": "Medien loslassen — Bilder werden eingefügt, Dateien bleiben Evidence",
  "editor.drop.fileNotice":
    "Nur Bilder werden inline eingefügt. Dateien bleiben Anhang/Evidence — ein sicherer Body-Link entsteht erst mit gespeicherter Objekt-Referenz (kein Fake-Link). Die Validierung entscheidet.",
  "editor.preview": "Vorschau",
  "editor.edit": "Bearbeiten",
  "editor.previewBadge": "Vorschau — so sehen Leser die Seite",
  "editor.previewEmpty":
    "Noch kein Inhalt — wechsle zu „Bearbeiten“ und schreibe den ersten Abschnitt.",
  "editor.linkPrompt": "Link-URL eingeben:",
  "editor.linkUrl": "URL",
  "editor.linkUrlPlaceholder": "https://… oder interne Route",
  "editor.linkLabel": "Linktext optional",
  "editor.linkLabelPlaceholder": "Wenn leer, wird die URL angezeigt",
  "editor.linkInsert": "Link einfügen",
  "editor.linkCancel": "Abbrechen",
  "editor.linkInvalid": "Bitte eine sichere URL verwenden (https, mailto, / oder #).",
  "capture.fType": "Wissensart",
  "capture.fCategory": "Domäne / Kategorie",
  "capture.submit": "Prüfen & einreichen",
  "capture.submitBusy": "Wird eingereicht … (Entwurf, Anhänge, Einreichung)",
  "capture.submitStageCreating": "Wissensobjekt wird angelegt …",
  "capture.submitStageUploading": "Original & Anhänge werden gesichert ({{mb}} MB) …",
  "capture.submitStageLinking": "Quellen werden verknüpft …",
  // WP-D10 Fix 2: aufklappbare Dauer-Details in der Einreich-Bestätigung — die VORHANDENEN
  // performance.now-Spannen (Anlegen / Upload / Verknüpfen inkl. Quellen), nichts Neues gemessen.
  "capture.submitTiming.title": "Details zur Dauer",
  "capture.submitTiming.create": "Wissensobjekt anlegen",
  "capture.submitTiming.upload": "Original & Anhänge hochladen",
  "capture.submitTiming.link": "Verknüpfen & Quellen",
  "capture.submitTiming.seconds": "{{s}} s",
  "capture.submitTiming.mb": "{{mb}} MB",
  "capture.readyTitle": "Speicher-Check",
  "capture.ready.title": "Titel",
  "capture.ready.content": "Aussage / Inhalt",
  "capture.ready.category": "Kategorie",
  "capture.ready.type": "Wissensart",
  "capture.ready.attachments": "Anhänge",
  "capture.readyDone": "ok",
  "capture.readyMissing": "fehlt",
  "capture.readyOptional": "optional",
  "capture.readyHint": "Titel und Aussage/Inhalt sind nötig, um speichern zu können.",
  "capture.draftHint":
    "Erst Erfahrungsnotiz eingeben und mit KI strukturieren — der Entwurf erscheint hier.",
  "capture.fConditions": "Bedingungen",
  "capture.fMeasures": "Maßnahmen",
  "capture.fTags": "Schlagwörter",
  "capture.fAsset": "Anlage / Gerät",
  "conf.field": "Vertraulichkeit",
  "conf.confirmPending": "— Vertraulichkeit bestätigen —",
  // JOB 3114 (UX-05, Befund N-0017): der Satz, den der abgewiesene Einreichversuch AM FELD zeigt.
  // Er nennt die Handlung, nicht die Feldeigenschaft („Pflichtfeld" sagt niemandem, was zu tun ist).
  // EINE Textquelle für beide Einreichwege — Blatt und Arbeitsraum lesen denselben Schlüssel.
  "conf.requiredHint": "Bitte wählen Sie eine Vertraulichkeitsstufe, bevor Sie einreichen.",
  "conf.help":
    "Wie vertraulich ist dieses Wissen? Öffentlich-intern ist der Standard (keine Einschränkung). Vertraulich und Streng vertraulich markieren sensibles Wissen: solche Objekte werden nie in externe Kontexte gegeben (Output Factory/Export). Die Stufe ist ab dem Erfassen setzbar und später jederzeit änderbar — jede Änderung wird im Audit-Log festgehalten. Hinweis: Diese Kennzeichnung schränkt (noch) nicht ein, WER das Objekt sieht.",
  "conf.level.intern": "Öffentlich-intern",
  "conf.level.vertraulich": "Vertraulich",
  "conf.level.streng_vertraulich": "Streng vertraulich",
  // JOB 3034: die VIERTE Auskunft — kein vierter Stufenwert, sondern die ehrliche Aussage über
  // einen Bestand, den nie jemand eingestuft hat (Server: `confidentialityProvenance: "unknown"`).
  // „Öffentlich-intern“ an dieser Stelle wäre eine erfundene Einstufung.
  "conf.level.nichtEingestuft": "Nicht eingestuft",
  "capture.fRevalidation": "Re-Validierung nach (Anzahl)",
  "capture.listAdd": "Eintrag hinzufügen",
  "capture.listRemove": "Entfernen",
  "capture.tagPlaceholder": "Tag eingeben, Enter zum Übernehmen",
  "capture.formularHint":
    "Kernaussage und Aussage genügen zum Start — die weiteren Angaben unten sind optional.",
  "capture.diktatStart": "Diktat starten",
  "capture.diktatStop": "Diktat stoppen",
  "capture.diktatUnsupported":
    "Spracheingabe wird von diesem Browser nicht unterstützt. Nutze Chrome/Edge oder gib den Text manuell ein.",
  "capture.diktatNa": "nicht verfügbar",
  "capture.ivStep": "Frage {{n}} von {{total}}",
  "capture.ivBack": "Zurück",
  "capture.ivNext": "Weiter",
  "capture.ivFinish": "Entwurf erstellen",
  "capture.ivDone": "Interview abgeschlossen — prüfe den Entwurf rechts und reiche ihn ein.",
  "capture.ivStart": "Interview starten",
  "capture.ivStartLead":
    "Das geführte Interview nutzt die KI, um Rückfragen zu stellen. Erst mit „Interview starten“ geht die erste Frage an das Modell — vorher wird nichts gesendet. Provider und Region siehst du über das (!)-Symbol.",
  "capture.ivTurn": "Frage {{n}}",
  "capture.ivThinking": "Die KI formuliert die nächste Frage …",
  "capture.ivResumeLead":
    "Dein Interviewfortschritt ist wiederhergestellt. Die nächste Frage wird erst auf deinen Klick geladen.",
  "capture.ivResumeLoad": "Nächste Frage laden",
  "capture.unsavable.images_one": "{{count}} eingefügtes Bild",
  "capture.unsavable.images_other": "{{count}} eingefügte Bilder",
  "capture.unsavable.docs_one": "{{count}} angehängte Datei (Dokument/Video/Audio)",
  "capture.unsavable.docs_other": "{{count}} angehängte Dateien (Dokumente/Video/Audio)",
  "capture.unsavable.file":
    "die hochgeladene Datei „{{name}}“ — ihre Auswertung ist noch nicht abgeschlossen",
  "capture.unsavable.fileQueue":
    "die laufende Datei-Verarbeitung aus „{{name}}“ (Punkt {{current}} von {{total}})",
  "capture.unsavable.extResults":
    "die geladene Trefferliste der externen Suche — die Suchanfrage selbst bleibt im Entwurf erhalten",
  // AUFTRAG-mega6 Block A: die http/https-Allowlist der Persistenz wird benannt, statt still zu wirken.
  "capture.unsavable.sourceUrl":
    "die angefangene Web-Adresse „{{urls}}“ — der Entwurf sichert nur vollständige Adressen, die mit https:// oder http:// beginnen; Bezeichnung und Auszug der Quelle bleiben erhalten",
  "capture.sourceUrlLimit":
    "Diese Adresse kann der Entwurf nicht mitsichern. Ergänze https:// oder http:// davor — oder leere das Feld, wenn du sie nicht brauchst.",
  // AUFTRAG-mega6 Block D: sichtbare Entsprechung der serverseitigen Mengen- und Längengrenzen.
  "capture.limit.chars":
    "Maximale Länge erreicht ({{max}} Zeichen) — weiterer Text wird nicht gesichert.",
  "capture.limit.reviewers":
    "Mehr als {{max}} Prüfer kann der Entwurf nicht sichern — wähle jemanden ab, um zu tauschen.",
  "capture.limit.sources":
    "Mehr als {{max}} Quellen kann der Entwurf nicht sichern — entferne eine, um Platz zu machen.",
  "capture.limit.interviewAnswers":
    "Mehr als {{max}} Antworten kann der Entwurf nicht sichern — schließe das Interview ab oder speichere den Entwurf.",
  "capture.saveLimit.title": "Der Entwurf sichert nicht alles",
  "capture.saveLimit.lead":
    "Text, Metadaten und Quellen werden gespeichert. Diese Inhalte kann der Entwurf jedoch nicht sichern — beim Speichern werden sie verworfen:",
  "capture.saveLimit.cancel": "Abbrechen — Inhalte behalten",
  "capture.saveLimit.confirm": "Trotzdem speichern und diese Inhalte verwerfen",
  // JOB 3526 (Pedi, 10.09., 09:08): DER DRITTE WEG AUS EINEM GEÖFFNETEN ENTWURF. Angeboten waren
  // nur „sichern" und „einreichen" — wer weder das eine noch das andere wollte, kam nicht heraus,
  // ohne den Entwurf zu löschen.
  //
  // RUNDE 2: die Rückfrage selbst stellt die GEMEINSAME Wache (`nav.guard.*`) — die vier eigenen
  // Dialogtexte, die hier standen, sind weg (bens Korrekturpflicht 2: kein zweiter Schutzweg).
  // Was bleibt, ist die Beschriftung des Wegs, die Zusage am Knopf und die Meldung danach.
  "capture.leaveDraft.action": "Entwurf verlassen",
  // Die Zusage, die Pedis Sorge beantwortet („nimmt mir das meinen Entwurf?"). Sie steht am Knopf,
  // weil der gemeinsame Dialog seinen Text nicht von hier bezieht — s. ABWEICHUNGEN der Rückgabe.
  "capture.leaveDraft.keepsDraftHint":
    "Verwirft die Änderungen seit dem Öffnen. Der gespeicherte Entwurf bleibt unverändert erhalten.",
  "capture.leaveDraft.busy": "Nicht möglich, solange ein Vorgang an diesem Entwurf läuft.",
  "capture.leaveDraft.done":
    "Entwurf verlassen. Die Änderungen seit dem Öffnen sind verworfen, der gespeicherte Entwurf ist unverändert.",
  // RUNDE 5 (bens Korrekturpflicht 1): der Dialog der Wache hat DREI Antworten, und zwei davon
  // führen weg. Wer „Entwurf speichern und wechseln" wählt, hat NICHTS verworfen — sein Entwurf ist
  // geschrieben. Die Meldung oben stand vorher auch auf diesem Weg da und behauptete das Gegenteil
  // dessen, was gerade geschehen war. Deshalb dieser eigene Satz für den Speicherweg.
  "capture.leaveDraft.doneSaved":
    "Entwurf verlassen. Die Änderungen seit dem Öffnen sind im gespeicherten Entwurf gesichert.",
  // Der unveränderte Entwurf: hier gab es nichts zu verwerfen, und das sagt die Meldung auch so.
  "capture.leaveDraft.doneUnchanged":
    "Entwurf verlassen. Der gespeicherte Entwurf ist unverändert.",
  "capture.ivAnswerHint": "Deine Antwort …",
  "capture.ivSend": "Antwort senden",
  "capture.ivReadAloud": "Vorlesen",
  "capture.ivReadStop": "Stopp",
  "capture.ivDictNa": "Diktat ist in diesem Browser nicht verfügbar — bitte tippen.",
  "capture.ivModel": "KI-Modell",
  // JOB 3276 (Codex-Nutzerbefund 08.09.): „Deterministischer Fallback" sagt einem Menschen nichts —
  // Pedi sah eine sichtbare OpenAI-Anzeige und daneben dieses Wort. Hier steht jetzt in Alltags-
  // sprache, WAS er vor sich hat (feste Ersatzfragen) und WARUM, soweit die Fläche es weiß: der
  // genaue Grund (Statuscode, finish_reason, leere Antwort) steht serverseitig im Laufprotokoll,
  // die Antwort des Servers trägt ihn nicht mit.
  "capture.ivFallback": "Feste Ersatzfragen, ohne Antwort der KI",
  "capture.ivQ.title": "Worum geht es? Formuliere eine kurze Kernaussage.",
  "capture.ivQ.statement": "Beschreibe die Erfahrung/Aussage genauer.",
  "capture.ivQ.conditions": "Unter welchen Bedingungen gilt das? Eine pro Zeile.",
  "capture.ivQ.measures": "Welche konkreten Maßnahmen/Schritte? Eine pro Zeile.",
  "capture.ivQ.tags": "Schlagwörter zur Auffindbarkeit? Kommagetrennt.",
  "capture.ivQHint.title": "z. B. Pumpe P-12 bei Frost vorwärmen",
  "capture.ivQHint.statement": "Was genau, warum, mit welchem Effekt?",
  "capture.ivQHint.conditions": "Eine Bedingung pro Zeile",
  "capture.ivQHint.measures": "Eine Maßnahme pro Zeile",
  "capture.ivQHint.tags": "Frost, Pumpe, Winter",
  // AUFTRAG-mega38 BLOCK I: „Query Console" — englischer Fachbegriff auf deutscher Oberflaeche.
  "ask.kicker": "Fragen und Antworten",
  "ask.title": "Frag das Werkswissen",
  "ask.intro":
    "Die Antwort ist quellengebunden: Du siehst, worauf sie steht — und in welchem Zustand jede dieser Quellen ist. Gibt es keine Grundlage, wird die Lücke offen benannt.",
  "ask.placeholder": "z. B. Wann muss Ventil X bei Überdruck geschlossen werden?",
  "ask.emptyHint": "Bitte gib zuerst eine Frage ein.",
  "ask.submit": "Fragen",
  // JOB 3038: das Diktat am Fragefeld. Eigene `ask.`-Schlüssel, weil sie an DIESER Fläche hängen —
  // die `capture.`-Schlüssel beschreiben das Erzählfeld und bleiben unberührt. Der
  // Nicht-verfügbar-Satz sagt wörtlich „nicht verfügbar": dieselbe Zusage, die
  // `tests/capture/interview-speech-i18n.test.ts` für das Erfassen hält.
  "ask.diktatStart": "Frage sprechen",
  "ask.diktatStop": "Aufnahme beenden",
  "ask.diktatUnsupported":
    "Spracheingabe ist in diesem Browser nicht verfügbar. Nutze Chrome/Edge oder tippe die Frage.",
  // AUFTRAG-mega38 BLOCK A: Warten und Fehlschlag stehen DORT, wo die Antwort erscheint.
  "ask.pending.title": "Die Frage läuft gegen das Werkswissen.",
  "ask.pending.body":
    "Es wird nach passenden Quellen gesucht. Gibt es keine belastbare Grundlage, sagt Klarwerk das offen — es wird nichts erfunden.",
  "ask.error.title": "Die Frage konnte nicht beantwortet werden.",
  "ask.error.body":
    "Die Anfrage ist unterwegs steckengeblieben. Das ist KEINE Aussage über das Wissen — es bedeutet nicht, dass es keine Antwort gibt. Bitte erneut versuchen.",
  "ask.error.retry": "Erneut versuchen",
  // Aufnahme gesamt-integrations-api (R-0842): die KI-Bremse hat abgewiesen — der Satz mit der
  // Wartezeit kommt vom Server (`services/app/src/anfragebremse.ts`), hier steht nur die Überschrift.
  "ask.gebremst.titel": "Bitte kurz warten.",
  // JOB 3064 §9: offline ist KEIN Fehlschlag, sondern ein Nicht-Versuch — die Frage ist nie
  // losgegangen. Der Fehlersatz („steckengeblieben") wäre hier schlicht unwahr.
  "ask.offline": "Keine Verbindung.",
  // Pedi 28.09.2026 · Ergänzung 1: der Hinweis beim Wiederkommen auf die Fragenseite.
  "ask.wiederaufnahme.entwurf":
    "Hier kannst du weitermachen: Dein noch nicht gesendeter Entwurf steht wieder im Fragefeld.",
  "ask.wiederaufnahme.antwort":
    "Hier kannst du weitermachen: Das ist deine zuletzt angezeigte Antwort vom {{zeit}} mit ihren Quellen. Sie wurde nicht neu erzeugt — stelle die Frage erneut, um sie aufzufrischen.",
  "ask.wiederaufnahme.beides":
    "Hier kannst du weitermachen: Dein noch nicht gesendeter Entwurf steht wieder im Fragefeld, darüber deine zuletzt angezeigte Antwort vom {{zeit}}. Sie wurde nicht neu erzeugt.",
  "ask.wiederaufnahme.verwerfen": "Entwurf verwerfen",
  "ask.pruefungGestoert": "Klara konnte das Firmenwissen gerade nicht verlässlich prüfen.",
  // Ben R1, F8: die Rückmeldung zu einer wiederaufgenommenen Antwort.
  "ask.rueckmeldungAbgelaufen":
    "Rückmeldung ist nur bis 30 Minuten nach der Antwort möglich. Stelle die Frage erneut, um sie zu geben.",
  "ask.rueckmeldungAbgelehnt":
    "Deine Rückmeldung wurde nicht angenommen. Stelle die Frage erneut und versuche es dann noch einmal.",
  // JOB 3064 §9: die Antwort steht noch, nur das Auffrischen hat nicht geklappt. Der Satz sagt
  // BEIDES — was gilt und was nicht geklappt hat —, damit niemand die stehende Antwort für frisch
  // hält. Der Fehlersatz oben („steckengeblieben") wäre hier falsch: es gibt ja ein Ergebnis.
  "ask.refreshFailed": "Auffrischung fehlgeschlagen — die Antwort ist von der letzten Anfrage.",
  // SCRUM-295: Hinweis bei vorbefüllter Startfrage (aus KO-Detail „Wissen nutzen") im Demo-Kontext.
  "ask.demoPrefillHint":
    "Startfrage aus dem Wissensobjekt übernommen — auf „Fragen“ klicken. Die Antwort bleibt quellengebunden; Status und Vertrauen entscheiden, nichts wird automatisch gesichert.",
  "ask.examplesLabel": "Beispiele:",
  // AUFTRAG-mega51 BLOCK H: der Klick startet sofort eine echte Anfrage — das steht vorher da.
  // AUFTRAG-mega61 BLOCK H: die zweite Hälfte fehlte. Das Wort „kostenpflichtig“ stand nur im
  // Codekommentar (pages/Ask.tsx), also genau dort, wo der Nutzer es nie liest. Ein Kommentar im
  // Code ist keine Aussage an den Nutzer — und ein Produkt, das mit Ehrlichkeit argumentiert, darf
  // an der Stelle nicht schweigen, an der ein Klick Geld kostet.
  // AUFTRAG-mega69 B1 (bens sammel65-Auflage 1): dieser Satz trägt NUR noch die Sofort-Zusage
  // (mega51 Block H: ein Beispiel sendet direkt, das muss VORHER erkennbar sein). Die Kosten-Hälfte
  // steht jetzt BEDINGT daneben — als zentraler `AiCostHint`, nur wenn `billable` es deckt. Der
  // frühere unbedingte Kostenwortlaut hier war genau die Umgehung der Bedingung.
  "ask.examplesSendHint": "Ein Klick fragt sofort — die Frage wird direkt gesendet.",
  "ask.example.valve": "Was tun, wenn Ventil X bei Überdruck schließen muss?",
  "ask.example.filter": "Wie oft muss Filter F3 geprüft werden?",
  "ask.example.dosing": "Warum schwankt der Dosierwert an Linie L4 nach jedem Schichtwechsel?",
  "ask.expect.answer": "findet passendes Wissen",
  "ask.expect.gap": "zeigt Wissenslücke",
  "ask.reasoner.model": "Modellmodus",
  "ask.reasoner.deterministic": "Deterministischer Modus",
  "ask.reasoner.loading": "Modus lädt …",
  "ask.reasoner.unknown": "Modus unbekannt",
  "ask.reasoner.hint":
    "Zeigt, ob Antworten über ein konfiguriertes Modell oder den regelbasierten Fallback laufen. Quellen und Validierung bleiben gleich.",
  "ask.fromValidated": "Aus quellengebundenem Wissen",
  "ask.evidence": "Evidenz",
  "ask.knowledgeClass.gesichert": "Gesichert",
  "ask.knowledgeClass.ungeprueft": "Ungeprüft",
  "ask.knowledgeClass.meinung": "Meinung/Erfahrung",
  "ask.knowledgeClass.extern": "Externe Quelle",
  "ask.knowledgeClass.annahme": "Annahme",
  "ask.knowledgeClass.unbekannt": "Unbekannt",
  "ask.steps": "Herangezogene Kontextquellen",
  // ============================================================================================
  // AUFTRAG-mega38 BLOCK F — DIE EHRLICHERE BESCHRIFTUNG DER SUMME (Pedis benannter Rückfall).
  // ============================================================================================
  // Getrennt werden konnte die Liste NICHT: `result.sources` und `result.steps` sind im
  // Modell-Weg dieselbe Menge — der komplette Top-K-Treffersatz
  // (services/reasoner/src/provider-model.ts:1016-1021, DEFAULT_TOP_K = 8 in
  // services/reasoner/src/provider.ts:451). Die `[n]`-Ziffern im Antworttext werden nirgends
  // zurückgelesen, und der Systemprompt ERLAUBT das Zitieren nur, er verlangt es nicht
  // (provider-model.ts:79-83). Es gibt heute also keine Information „verwendet vs. nur
  // durchsucht"; s. Bericht mega38, Block F.
  // Was der Code deckt, ist genau dies: das sind die Quellen, die HERANGEZOGEN wurden. Dass jede
  // davon zur Antwort beigetragen hat, deckt er nicht — deshalb steht es hier auch nicht mehr.
  "ask.sources": "Herangezogene Quellen",
  // JOB 3064 H5: das „…"-Menü der Fragenfläche und sein Punkt „Mehr" (Info-Blatt).
  "ask.menu.label": "Mehr zu dieser Antwort",
  "ask.menu.mehr": "Mehr …",
  "ask.export.copy": "Kopieren",
  "ask.export.download": "Als Markdown",
  "ask.export.print": "Drucken / PDF",
  // R-0703: Dateien, die die KI-Kennzeichnung in ihren Eigenschaften tragen.
  "ask.export.docx": "Als Word (.docx)",
  "ask.export.pptx": "Als PowerPoint (.pptx)",
  "ask.export.pdfDatei": "Als PDF-Datei",
  "ask.export.pdfZeichen":
    "Die PDF-Datei kann diese Zeichen nicht unverändert darstellen: {{zeichen}}. Es wurde nichts heruntergeladen — Word oder Markdown geben den Text verlustfrei weiter.",
  "ask.export.copied": "Antwort inkl. Quellen kopiert.",
  "ask.export.answer": "Antwort",
  "ask.export.footer":
    "Quellengebundene Antwort aus KLARWERK · erstellt am {{date}}. Nur so belastbar wie die genutzten Quellen (Status/Vertrauen). Kein Wahrheitsversprechen.",
  "ask.sourcesHint":
    "Diese Antwort ist quellengebunden — sie ist nur so belastbar wie die genutzte Quelle (Status, Vertrauen, Nutzbarkeit). Aufgeführt sind alle Quellen, die für die Frage herangezogen wurden; welche davon die Antwort getragen haben, ist gekennzeichnet. Zum Wissensobjekt für Details.",
  // AUFTRAG-mega52 A3/A5 — die Antwort sagt, worauf sie steht. Die Marken des Modells werden
  // zurückgelesen; ohne verwertbare Marke wird NICHT geraten, sondern gesagt, dass es unbekannt ist.
  "ask.attribution.known":
    "Die zuerst genannten Quellen haben die Antwort getragen; die übrigen wurden herangezogen, aber nicht verwendet.",
  "ask.attribution.unknown":
    "Welche dieser Quellen die Antwort getragen hat, ließ sich nicht zuordnen — die KI hat keine verwertbaren Quellenverweise geliefert. Die Liste zeigt deshalb alle herangezogenen Quellen ohne Kennzeichen, und ein „Hat geholfen“ ist hier nicht möglich.",
  // JOB 3267 Q1 — DREI ZUSTÄNDE, DREI WÖRTER, UND EIN VIERTES FÜR DEN PRÜFSTAND.
  // Bis hierher gab es zwei Wörter („trägt"/„angesehen") für eine Frage, die drei Antworten hat;
  // der dritte Zustand („wir wissen es nicht") stand nur als Satz ÜBER der Liste und fehlte an der
  // einzelnen Quelle. Und der Prüfstand einer Quelle (offen/validiert) borgte sich das Wort der
  // Nichtverwendung — die Ursache des Befunds aus der Vorführung (Codex 037f24c7, Ask.tsx:1208).
  // Die Wörter heißen deshalb ab hier, was sie meinen, und der Prüfstand hat sein eigenes.
  "ask.attribution.carrying.badge": "verwendet",
  "ask.attribution.carrying.hint":
    "Verwendet: Die KI hat sich im Antworttext ausdrücklich auf diese Quelle berufen — ihre Fußnote steht im Text.",
  "ask.attribution.consulted.badge": "nicht verwendet",
  "ask.attribution.consulted.hint":
    "Betrachtet, nicht verwendet: Diese Quelle stand der KI zur Verfügung; im Antworttext steht keine Fußnote zu ihr.",
  "ask.attribution.unclear.badge": "unbekannt",
  "ask.attribution.unclear.hint":
    "Zuordnung unbekannt: Ob diese Quelle die Antwort getragen hat, lässt sich nicht belegen — die KI hat dazu keine verwertbare oder eine widersprüchliche Zuordnung geliefert.",
  // Der PRÜFSTAND ist eine andere Frage als die Verwendung: „geprüft?" statt „verwendet?".
  // `{{stand}}` trägt das kanonische Statuswort (`status.*`), damit hier kein zweites Vokabular
  // für dieselben Zustände entsteht.
  "ask.pruefstand.hint":
    "Prüfstand dieser Quelle: {{stand}}. Das sagt nichts darüber, ob die Antwort sie verwendet hat.",
  "ask.pruefstand.unbekannt": "Prüfstand unbekannt",
  // Paket 4 (nacht24): Quellen wie im Dokument — Status/Trust je Quelle + Auszug im Original-Format.
  "answerSource.trust": "Vertrauen {{n}}",
  "answerSource.excerptShow": "Auszug im Dokument-Format anzeigen",
  "answerSource.excerptHide": "Auszug ausblenden",
  // JOB 4224 D5: der Weg vom Beleg bis zum Original. „Kein Original" ist eine AUSSAGE über diese
  // Quelle, kein Platzhalter — sie wird nur dann gezeigt, wenn wirklich nichts erreichbar ist.
  "answerSource.originalsTitle": "Original",
  "answerSource.noOriginal": "Für diese Quelle liegt kein Original vor.",
  "answerSource.originalFile": "Hinterlegtes Original öffnen",
  "answerSource.originalAddress": "Originaladresse öffnen (neues Fenster)",
  "answerSource.originalReference": "Fundstelle ohne abrufbare Adresse",
  // JOB 4224 R3: die DRITTE Lage. Sie sagt weder „gesperrt" (das wäre aus einem Fehler erfunden)
  // noch „kein Original" (das wäre eine ungeprüfte Tatsache) — sie sagt, was zutrifft: niemand hat
  // den Stand dieser Quelle gerade bestätigt.
  "answerSource.originalUnconfirmed":
    "Der Stand dieser Quelle ist gerade nicht bestätigt — der Beleg wird erst wieder angeboten, wenn die Auffrischung durchkommt.",
  // JOB 4224 D5 (Lieferung 5): ohne Modell nennt die Fläche nicht nur die Lage, sondern auch den
  // erlaubten Weg. Der zweite Halbsatz ist keine Floskel — er hält fest, dass hier nichts
  // stillschweigend freigeschaltet wird.
  "ask.aiUnavailable.adminPfad":
    "Als Administrator kannst du hier ein KI-Modell verbinden oder die KI einschalten:",
  "ask.aiUnavailable.toAdmin": "KI-Einstellungen öffnen",
  "ask.aiUnavailable.path":
    "Ohne Modell bleibt der Bestand offen — nichts wird dafür automatisch freigegeben:",
  "ask.aiUnavailable.toLibrary": "Bestand durchsuchen",
  "ask.aiUnavailable.toCapture": "Wissen erfassen",
  "ask.helpful": "Hat geholfen",
  "ask.thanked": "Danke!",
  "ask.status.verified": "Gesichert",
  "ask.status.unverified": "Noch ungeprüft",
  "ask.reviewGuard.openLabel": "Noch nicht als gesichertes Wissen nutzen",
  "ask.reviewGuard.openHint":
    "Mindestens eine Quelle ist offen oder noch in Prüfung. Erst prüfen/bewerten, bevor diese Aussage als gesichert genutzt wird.",
  "ask.reviewGuard.unverifiedLabel": "Antwort ist noch ungeprüft",
  "ask.reviewGuard.unverifiedHint":
    "Diese Antwort ist nicht als gesichert eingestuft. Prüfe Quellen und Bewertung, bevor du sie weiterverwendest.",
  "ask.reviewGuard.cta": "Zur Validierung",
  "ask.gapBadge": "Wissenslücke",
  // AUFTRAG-mega54 BLOCK E: DER EINE NÄCHSTE SCHRITT ZUR LÜCKE. Bis hierher standen auf demselben
  // Bildschirm ZWEI „Nächster Schritt:"-Sätze mit verschiedenen Antworten — dieser hier schickte
  // zum Risiko-Board, der aus dem Vertragskasten zum kostenlosen Umformulieren. Jetzt gibt es nur
  // noch diesen Schlüssel; der Vertragskasten (askAnswerContract.ts) zeigt auf ihn, die Lückenkarte
  // wiederholt ihn nicht, und Mobile trägt ihn ebenfalls. REIHENFOLGE IST INHALT (E2): zuerst der
  // kostenlose Schritt, dann Wissen erfassen, zuletzt das Risiko-Board — der teuerste nicht vorn.
  "ask.gapNext":
    "Nächster Schritt: die Frage noch einmal mit den Fachwörtern aus eurem Betrieb stellen — sonst Wissen erfassen oder die Lücke im Risiko-Board priorisieren.",
  "ask.noBasisTitle": "Keine belastbare Grundlage.",
  // mega53 C1: der Satz behauptete „Es gibt kein validiertes Wissen zu dieser Frage" — bei den
  // neuen Lücken aus Block A ist das falsch, das Wissen liegt oft daneben. Er sagt jetzt, was
  // wirklich gilt, und nennt beide möglichen Ursachen.
  "ask.noBasisBody":
    "Keine Quelle passt sicher genug zu dieser Frage. Statt einer erfundenen Antwort wurde eine Wissenslücke angelegt. Möglich ist beides: Das Wissen fehlt noch — oder es steht unter anderen Begriffen in der Basis.",
  // SCRUM-369 / AG-12/13/P2-4: Ask-Lücke als geführter „Wissenslücke retten"-Einstieg (kein Chatbot-Ende).
  "ask.gap.rescueTitle": "Wissenslücke retten",
  "ask.gap.rescueImpact":
    "Vielleicht fehlt dieses Erfahrungswissen noch, vielleicht ist es nur nicht auffindbar. Du kannst helfen, es zu sichern — für alle, die die Frage künftig stellen.",
  "ask.gap.noInvent":
    "Es wurde keine Antwort erfunden: Ohne belastbare Quelle bleibt die Frage ehrlich offen.",
  "ask.gap.rescueCta": "Wissen erfassen & retten",
  // AUFTRAG-mega54 BLOCK E3: die Rettungs-Schrittfolge selbst wird NICHT angefasst — sie beginnt
  // richtig mit „Frage beantworten", weil sie den Weg für jemanden beschreibt, der das Wissen HAT
  // und es beisteuern will. Genau das ging aus „So schließt du die Lücke:" nicht hervor: neben dem
  // einen nächsten Schritt gelesen, klang sie wie eine zweite Antwort auf „was mache ich jetzt mit
  // meiner unbeantworteten Frage". Geschärft wurde deshalb die Überschrift, mehr nicht.
  "ask.gap.stepsTitle": "Du kennst die Antwort? So trägst du sie bei:",
  "ask.gap.step.answer.label": "Frage beantworten",
  "ask.gap.step.answer.hint": "Formuliere, was du aus Erfahrung dazu weißt.",
  "ask.gap.step.experience.label": "Eigene Erfahrung ergänzen",
  "ask.gap.step.experience.hint": "Bedingungen, Maßnahmen, Kontext.",
  "ask.gap.step.structure.label": "KI strukturieren lassen",
  "ask.gap.step.structure.hint": "Die KI ordnet nur — sie erfindet nichts dazu.",
  "ask.gap.step.review.label": "Prüfen lassen",
  "ask.gap.step.review.hint": "Erst nach Validierung gilt es als gesichert.",
  // SCRUM-366 / FR-ASK-02 / PI-K2: Antwortvertrag — quellengebunden, ehrlich, kein generischer Chatbot.
  "ask.contract.label": "Antwortbasis",
  // JOB 2626 D1: die Torlage einer Nicht-Antwort. Kurztexte = Station-3-Torbegriffe (JOB 2623),
  // volle Sätze als title-Hinweis — §2 des Auftrags wörtlich.
  // Bewusst eine ZUSTANDSAUSSAGE, keine Kausalbehauptung: gemeldet wird, welche Tore zu sind —
  // nicht, welcher Mechanismus die Antwort verworfen hat (§4: kein falsch benanntes Tor).
  // Der Konsolenweg setzt kein `validatedOnly` (ask-routes.ts, letzter `answer`-Aufruf): auch
  // nicht freigegebene oder nicht eingestufte Dokumente KÖNNEN Antworten tragen. Ein „erst nach
  // Prüfung" wäre deshalb falsch (mega52 C3).
  "ask.verschlossen.titel": "Dazu gibt es Inhalte — Klara konnte darauf keine Antwort stützen.",
  "ask.verschlossen.grund.freigabe":
    "Mindestens eines dieser Dokumente ist noch nicht freigegeben.",
  "ask.verschlossen.grund.stufe":
    "Mindestens eines dieser Dokumente hat noch keine Vertraulichkeitsstufe.",
  "ask.verschlossen.grund.volltext":
    "Aus Dokumenten ohne durchsuchbaren Text kann Klara nichts belegen. Du kannst sie lesen und den Text dort ergänzen.",
  "ask.verschlossen.pruefPfad.beides": "Freigeben oder einstufen:",
  "ask.verschlossen.pruefPfad.freigabe": "Freigeben:",
  "ask.verschlossen.pruefPfad.stufe": "Einstufen:",
  "ask.verschlossen.zurPruefung": "Zur Prüfung",
  "ask.verschlossen.label": "Gefunden — aber diese Tore sind zu:",
  "ask.verschlossen.freigabe": "Freigabe fehlt",
  "ask.verschlossen.freigabeHint": "Das Dokument ist noch nicht freigegeben.",
  "ask.verschlossen.stufe": "Stufe fehlt",
  "ask.verschlossen.stufeHint": "Für das Dokument ist keine Vertraulichkeitsstufe gesetzt.",
  "ask.verschlossen.volltext": "Kein durchsuchbarer Text",
  "ask.verschlossen.volltextHint": "Von diesem Dokument liegt noch kein durchsuchbarer Text vor.",
  // JOB 3109 UX-09: der Leselink am Titel. Sichtbar bleibt der Titel; DIESER Satz ist der
  // zugängliche Name, damit ein Vorleseprogramm sagt, wohin der Link führt, statt nur einen
  // Dokumenttitel vorzulesen. Er behauptet nichts über eine Berechtigung — wer den Titel hier
  // liest, darf das Dokument ohnehin öffnen (die Liste entsteht hinter `darfSehen`).
  "ask.verschlossen.lesen": "Bericht lesen: {{titel}}",
  // JOB 3109 UX-09: die Trennung, ohne die der Leselink wie ein Widerspruch aussieht. EIN Satz,
  // einmal je Liste — nicht je Eintrag, sonst läse er sich als Eigenschaft eines Dokuments.
  "ask.verschlossen.trennung":
    "Fachlich freigegeben und als Antwortgrundlage verwendbar ist nicht dasselbe: ein freigegebenes Dokument kann hier trotzdem nicht tragen — und ein Dokument, das du öffnen darfst, muss diese Frage nicht beantwortet haben.",
  "ask.contract.verified.title": "Quellengebundene Antwort",
  "ask.contract.verified.body":
    "Diese Antwort stützt sich auf validiertes Wissen aus deiner Wissensbasis — keine generische Chatbot-Antwort.",
  "ask.contract.verified.next": "Nächster Schritt: Quelle ansehen oder das Wissen nutzen.",
  "ask.contract.unverified.title": "Quellengebunden, aber noch ungeprüft",
  "ask.contract.unverified.body":
    "Die Antwort stützt sich auf vorhandenes, aber noch nicht gesichertes Wissen. Sie ist als ungeprüft gekennzeichnet, keine Chatbot-Vermutung.",
  "ask.contract.unverified.next":
    "Sicherer nächster Schritt: zur Prüfung geben bzw. in der Validierung prüfen lassen.",
  // ==============================================================================================
  // AUFTRAG-mega53 BLOCK C1 — DIE LÜCKE WIRD HÄUFIGER, ALSO MUSS SIE STIMMEN.
  // ==============================================================================================
  //
  // Block A lässt mehr Fragen ehrlich mit einer Lücke enden (gemessen: 3 von 10 der mega52-Fragen).
  // Damit trägt der bisherige Text nicht mehr: er sagte „Es gibt noch keine belastbare Grundlage in
  // der Wissensbasis" — und genau das ist bei den NEUEN Lücken nachweislich falsch. Bei „Wie oft
  // muss der Filter F3 geprüft werden?" LIEGT das richtige, validierte Wissensobjekt im Bestand;
  // die Frage trifft es nur literal nicht stark genug („geprüft" ≠ „prüfen", „F3" fällt als
  // Zweizeichen-Token aus der Tokenisierung).
  //
  // Einer Testerin zu sagen, ihr Wissen fehle, obwohl es danebenliegt, ist dieselbe Art von
  // Unehrlichkeit, die diese Runde an zwei anderen Stellen beseitigt. Der Text nennt deshalb jetzt
  // BEIDE Ursachen. Kein neuer Weg, keine neue Route — nur ehrlichere Sätze.
  //
  // AUFTRAG-mega54 BLOCK E: der nächste Schritt steht NICHT mehr hier. Er hat genau einen Schlüssel
  // (`ask.gapNext`), auf den `answerContract("gap").nextStepKey` zeigt — ein früherer zweiter Satz
  // an dieser Stelle war der Widerspruch, den mega54 beseitigt hat.
  //
  // Die beiden Ursachen aus mega53 sind mit mega54 übrigens BEHOBEN (Kennungen + Grundform): „F3"
  // überlebt die Zerlegung, „geprüft" trifft „prüfen". Der Text bleibt trotzdem richtig — eine
  // Lücke kann weiterhin daher rühren, dass das Wissen unter anderen Wörtern in der Basis steht.
  "ask.contract.gap.title": "Wissenslücke, keine Chatbot-Antwort",
  "ask.contract.gap.body":
    "Keine Quelle passt sicher genug zu dieser Frage, um eine Antwort zu tragen. Das heißt nicht zwingend, dass das Wissen fehlt — vielleicht steht es nur unter anderen Wörtern in der Basis. Beides ist eine Lücke, die ihr schließen könnt, kein Fehler.",
  "ask.contract.trustNote":
    "Vertrauen und Nutzbarkeit zeigen, wie belastbar eine Quelle ist — kein Wahrheitsversprechen.",
  // ==============================================================================================
  // JOB 3366 · KI-FRAGMENT-SICHTBAR — DER EINE SATZ AN EINER ABGESCHNITTENEN ANTWORT.
  // ==============================================================================================
  // Er steht NUR, wenn der Anbieter den Abbruch am Token-Limit gemeldet hat (Feld `abgeschnitten`,
  // apps/web/src/api/types.ts). Es gibt keinen Gegensatz-Satz: „vollständig" behauptet niemand,
  // weil es niemand festgestellt hat. Der Satz sagt die TATSACHE (am Längenlimit abgebrochen) und
  // ihre Folge (kann unvollständig sein) — er verspricht keine Abhilfe, denn es gibt keine:
  // nachgeladen wird nichts, das Budget bleibt unverändert (Auftrag §10).
  // EIN Schlüssel für alle drei Flächen (/fragen, Erfassen, und wortgleich im Word-Panel), damit
  // derselbe Zustand nicht in drei Fassungen auseinanderläuft.
  "ai.truncated.hint":
    "Diese Antwort wurde am Längenlimit abgeschnitten und kann unvollständig sein.",
  // AUFTRAG-mega38 BLOCK F: „8 Quellen" las sich als „acht Quellen tragen diese Antwort".
  // Gedeckt ist nur „acht wurden herangezogen" — s. den Kommentar bei `ask.sources`.
  "ask.contract.sumTotal_one": "{{count}} Quelle herangezogen",
  "ask.contract.sumTotal_other": "{{count}} Quellen herangezogen",
  "ask.contract.sumValidated": "{{count}} validiert",
  "ask.contract.sumOpen": "{{count}} offen/ungeprüft",
  "ask.contract.sumConflict": "{{count}} mit Konflikt",
  // ==============================================================================================
  // AUFTRAG-mega32 BLOCK E (Pedi 27.07.) — DER PRÜFVORBEHALT DER ANTWORT.
  // ==============================================================================================
  // Er behauptet NICHT, dass ein Konflikt vorliegt — er sagt, dass die Suche danach nicht
  // vollständig belegt ist. Der Unterschied ist der ganze Punkt: eine Antwort darf Sicherheit nur
  // behaupten, wenn jede herangezogene Quelle einen vollständig belegten Lauf hat.
  "ask.checkCaveat.title": "Diese Antwort ist nicht als konfliktfrei belegt.",
  "ask.checkCaveat.badge": "Prüfung unbelegt",
  "ask.checkCaveat.incomplete":
    "Bei {{unproven}} von {{total}} herangezogenen Quellen ist die Konflikt- und Duplikatprüfung nicht vollständig gelaufen. Es wurde also nicht überall gesucht — unbekannte Widersprüche sind damit nicht ausgeschlossen.",
  "ask.checkCaveat.noCoverage":
    "Bei {{unproven}} von {{total}} herangezogenen Quellen ist zwar ein Prüf-Lauf vermerkt, aber seine Reichweite ist nicht belegt. Wie weit gesucht wurde, ist damit unbekannt.",
  "ask.checkCaveat.unchecked":
    "Bei {{unproven}} von {{total}} herangezogenen Quellen ist gar kein Prüf-Lauf vermerkt. Nach Widersprüchen wurde dort nie gesucht.",
  "ask.checkCaveat.unknown":
    "{{unproven}} von {{total}} herangezogenen Quellen sind im Bestand nicht auffindbar. Über ihre Prüfung lässt sich nichts sagen.",
  // AUFTRAG-mega53 B2: der fünfte Grund. Er spricht nicht über einen lückenhaften Prüf-Lauf,
  // sondern darüber, dass gar nicht bekannt ist, WELCHE Quelle diese Antwort trägt. Bewusst ohne
  // Schuldzuweisung an das Modell und ohne Technik-Jargon — und ohne die Antwort zu entwerten:
  // sie ist quellengebunden, nur die Zuordnung fehlt.
  "ask.checkCaveat.unattributed":
    "Diese Antwort nennt keine ihrer {{total}} herangezogenen Quellen als Beleg. Welche davon sie wirklich trägt, ist damit unbekannt — Prüfstand und Vertrauenswert lassen sich keiner Quelle zuordnen.",
  "ask.trust.unattributed": "Vertrauenswert nicht zuordenbar",
  // AUFTRAG-mega34 A2: der Hinweis auf den UNBEKANNTEN Konfliktstand. Er spricht nicht über
  // gefundene Konflikte und nicht über lückenhafte Prüf-Läufe, sondern darüber, dass diese Seite
  // die Konfliktliste gerade gar nicht kennt. Bewusst ohne Schuldzuweisung und ohne Technik-Jargon.
  "ask.conflictCaveat.title": "Der Konfliktstand ist gerade nicht abrufbar.",
  "ask.conflictCaveat.pending":
    "Die bekannten Widersprüche werden noch geladen. Bis sie da sind, gilt diese Antwort als ungeprüft — nicht, weil etwas gefunden wurde, sondern weil noch nicht nachgesehen werden konnte.",
  "ask.conflictCaveat.failed":
    "Die bekannten Widersprüche konnten nicht abgerufen werden. Ob eine der Quellen in einem offenen Konflikt steht, ist damit unbekannt; diese Antwort gilt deshalb als ungeprüft.",
  // SCRUM-283: datensparsamer, ehrlicher Hinweis zur gespeicherten Wissenslücke (Ask + Risk).
  "gap.privacyNotice":
    "Die Frage wird als Wissenslücke gespeichert — keine Antwort und kein validiertes Wissen. Bitte keine sensiblen oder personenbezogenen Details erfassen; ergänze später geprüfte Erfahrung.",
  "ask.toGaps": "Zu den Wissenslücken",
  "ask.toCapture": "Wissen erfassen",
  "ko.use.ready": "Produktionsnah nutzbar",
  "ko.use.in-review": "In Prüfung",
  "ko.use.needs-work": "Noch in Arbeit",
  // SCRUM-293: GETEILTE Use-Readiness-Sprache (KO-Detail + Library identisch) — ehrlich, ohne
  // Fake-Freigabe: „nutzbar" nur, WEIL validiert (Status/Trust tragen).
  "use.ready.label": "Nutzbar",
  "use.ready.hint": "Validiert — quellengebunden nutzbar (Status/Vertrauen tragen).",
  "use.review.label": "In Prüfung",
  "use.review.hint": "Bewertung läuft — noch nicht als gesichert nutzen.",
  "use.open.label": "Zu prüfen",
  "use.open.hint": "Offen/ungeprüft — erst prüfen/bewerten lassen.",
  "ko.ovTrust": "Vertrauen",
  // AUFTRAG-mega34 F: „1 Quellen · 1 Anhänge" stand in der Übersichtszeile jedes KO mit genau
  // einer Quelle — also im Regelfall. Variable von {{n}} auf {{count}}, sonst pluralisiert nichts.
  "ko.ovSources_one": "{{count}} Quelle",
  "ko.ovSources_other": "{{count}} Quellen",
  "ko.ovAttachments_one": "{{count}} Anhang",
  "ko.ovAttachments_other": "{{count}} Anhänge",
  "trust.explain.title": "Wie ist der Prüfstand einzuordnen?",
  "trust.explain.meta":
    "Der Prüfstand ist ein Review-/Evidenzsignal — keine Wahrheitsaussage über den Inhalt.",
  "trust.explain.band.high":
    "Hohes Vertrauen: mehrfach positiv geprüft. Trotzdem mit eigenem Urteil nutzen.",
  "trust.explain.band.mid":
    "Mittleres Vertrauen: erst teils geprüft oder mit Vorbehalten (Gelb). Vor kritischer Nutzung gegenprüfen.",
  "trust.explain.band.low":
    "Niedriges Vertrauen: kaum geprüft oder rote Bewertung/Konflikt. Erst prüfen oder nacharbeiten.",
  "trust.explain.review":
    "Gelb, Rot oder ein offener Konflikt heißt: prüfen oder nacharbeiten, bevor du dich darauf verlässt.",
  "ko.nextLabel": "Nächste Handlung:",
  "ko.next.use": "validiertes Wissen — kann in Antworten/Output verwendet werden.",
  "ko.next.review": "Validierung läuft — offene Bewertung abschließen.",
  "ko.next.addSource": "Quelle/Beleg ergänzen, bevor validiert wird.",
  "ko.next.validate": "zur Freigabe bewerten lassen (Validierung).",
  "ko.cta.use": "In Fragen nutzen",
  "ko.cta.review": "Bewertung abschließen",
  "ko.cta.addSource": "Zu Quellen & Belegen",
  "ko.cta.validate": "Zur Validierung",
  "ko.statement": "Aussage",
  // WP-D10 Fix 4: Erstellungsdatum sichtbar (Validierungs-Karten + Detail) — gleichnamige Beiträge
  // werden unterscheidbar. Nur vorhandene KO-Felder (createdAt), kein Platzhalter-Datum bei Altdaten.
  "ko.createdAt": "Erstellt am",
  // WP-SHIP9-S2 Paket 3 (E2): Kurz-Vorschau-Aufklapper je Wissensobjekt/Kandidat.
  "ko.preview.show": "Kurzvorschau",
  "ko.preview.hide": "Vorschau schließen",
  "ko.preview.label": "Vorschau",
  // JOB 3326 · LESEVARIANTE — die Texte stehen in `lib/lesevariante.ts`, weil diese Datei sonst
  // ueber den 1-MiB-Deckel von Biome waechst (Begruendung und Messung dort, R4).
  ...lesevarianteTexteDe,
  "ko.createdByName": "von {{name}}",
  "ko.gallery": "Bildergalerie",
  "ko.galleryCount": "Bild {{n}} von {{m}}",
  "ko.galleryClose": "Schließen",
  "ko.galleryOpen": "Bild {{n}} vergrößern",
  "ko.galleryPrev": "Vorheriges Bild",
  "ko.galleryNext": "Nächstes Bild",
  // AUFTRAG-mega69 Block A: der Weg vom betrachteten Bild zum Bildbeschreibungs-Formular.
  "ko.galleryEditCaption": "Bildbeschreibung bearbeiten",
  // JOB 512 (R5): Der Text nennt, WAS fehlt und WORAUS — und ausdrücklich keine technische Ursache
  // (kein „Budget", kein „Transfer"). Der Nutzer soll erkennen, dass sein Dokument unvollständig
  // angekommen ist; die Ursache gehört in die Import-Quittung, nicht unter die Galerie.
  "ko.galleryLoss": "{{n}} von {{m}} Bildern aus der Quelldatei fehlen in diesem Entwurf.",
  "ko.body.readTitle": "Ausführlicher Inhalt aus dem Knowledge-Editor",
  "ko.body.readNote":
    "Blöcke und KI-Vorschläge sind redaktionelle Struktur. Maßgeblich bleiben Status, Vertrauen und Quellen dieses Wissensobjekts.",
  "ko.body.readBlocksChip": "strukturierter Inhalt",
  "ko.conditions": "Bedingungen",
  "ko.measures": "Maßnahme",
  "ko.validate": "Positiv bewerten",
  "ko.stillValid": "Noch gültig",
  "ko.conditional": "Rückfrage",
  "ko.reject": "Ablehnen",
  "ko.edit": "Bearbeiten",
  // JOB 3063 · H4 — die dreizehn Abschnitte hinter der Zeile „Mehr". Nur Titel: die Erklärsätze
  // und Hilfe-Tipps der alten Detailseite sind entfallen, die Funktionen darin nicht.
  "ko.mehr.konflikt": "Konflikt",
  "ko.mehr.quellen": "Quellen und Belege",
  "ko.mehr.extern": "Externes Wissen",
  "ko.mehr.beitrag": "Quelle oder Beitrag melden",
  "ko.mehr.provenienz": "Provenienz",
  "ko.mehr.kopplung": "Kopplung und Anlagen",
  "ko.mehr.herkunftskette": "Herkunftskette",
  "ko.mehr.historie": "Historie",
  "ko.mehr.belege": "Belege",
  "ko.mehr.schnappschuesse": "Schnappschüsse",
  // JOB 4146: `ko.mehr.kommentare` stand hier und ist ERSATZLOS entfernt — nicht, weil das Wort
  // falsch geworden wäre, sondern weil der Abschnitt jetzt `ko.diskussion.titel` trägt. Ein
  // Schlüssel, den niemand mehr ruft, wäre ein zweiter Name für dieselbe Überschrift.
  "ko.mehr.anhaenge": "Anhänge",
  "ko.mehr.nachbarschaft": "Nachbarschaft",
  "ko.returnedBanner":
    "Dieses Wissensobjekt wurde aus der Prüfung zur Nacharbeit zurückgegeben. Bitte das Review-Feedback abarbeiten und eine Revision speichern.",
  "ko.rework.title": "Review-Nacharbeit",
  "ko.rework.hint":
    "Aus einer Review-Entscheidung (Rückfrage/Ablehnung) angestoßen. Bearbeiten erzeugt eine neue Version und startet die Prüfung neu — keine automatische Freigabe, keine automatische Rückgabe.",
  "ko.rework.edit": "Bearbeiten / Revision",
  "ko.rework.back": "Zurück zur Validierung",
  "ko.rework.savedTitle": "Revision gespeichert",
  "ko.rework.savedHint":
    "Eine neue Version ist entstanden und geht erneut in die Prüfung — keine automatische Freigabe, keine automatische Rückgabe.",
  "ko.rework.toValidation": "Zur Validierung der Revision",
  "ko.rework.feedbackTitle": "Review-Feedback",
  "ko.rework.feedback.warn": "Rückfrage",
  "ko.rework.feedback.down": "Ablehnung",
  "ko.rework.editTitle": "Nacharbeit: dieses Feedback abarbeiten",
  "ko.rework.editHint":
    "Arbeite das Feedback gezielt ein. Speichern erzeugt eine neue Version und startet die Prüfung neu — keine automatische Freigabe.",
  "ko.rework.stepsTitle": "Nächste Arbeitsschritte",
  "ko.rework.step.feedback": "Review-Feedback abarbeiten",
  "ko.rework.step.revise": "Revision speichern (neue Version, erneute Prüfung)",
  "ko.rework.step.back": "Zurück in den Validation-Fokus „überarbeitet“",
  "ko.saveEdit": "Speichern",
  "ko.cancelEdit": "Abbrechen",
  // JOB 4075 · DER DIREKTE SPEICHERWEG SAGT, WAS GESCHEHEN IST — ODER WARUM NICHTS GESCHAH.
  //
  // EIGENE SCHLÜSSEL NEBEN `ko.propose.*`, KEINE WIEDERVERWENDUNG: dort heisst es „eingereicht",
  // hier „gespeichert". Zwei verschiedene Vorgänge, zwei Sätze — ein geteilter Wortlaut wäre an
  // einem der beiden Orte falsch.
  //
  // KEINE ZAHL OHNE NACHGELESENEN STAND: `stale` ist der zahlenlose Wortlaut und gilt sofort,
  // `staleVersion` erst, wenn das Nachlesen eine Fassung WIRKLICH gezeigt hat (`BibliothekLesen.tsx`,
  // `save.onError`). „Version" steht hier, weil die Nachbarsätze (`ko.propose.staleVersion`,
  // `ko.propose.fromVersion`) es auch tun — zwei Wörter für dieselbe Zahl auf einer Fläche wären die
  // grössere Zumutung als das eine bekannte.
  "ko.revise.saved": "Gespeichert. Der Eintrag trägt jetzt deine Änderung.",
  "ko.revise.stale":
    "Jemand anderes hat diesen Eintrag inzwischen geändert — gespeichert wurde nichts. Dein Text steht unverändert hier.",
  "ko.revise.staleVersion":
    "Jemand anderes hat diesen Eintrag inzwischen geändert, er steht jetzt auf Version {{n}} — gespeichert wurde nichts. Dein Text steht unverändert hier.",
  "ko.revise.reload": "Eintrag neu lesen",
  "ko.revise.again": "Auf dem jetzigen Stand speichern",
  // JOB 4163 · DER SPEICHERVORGANG, DER UNTERWEGS ABBRICHT, SAGT BEIDE HÄLFTEN.
  //
  // Speichern besteht aus drei Schritten (Text, Schlagworte, Kategorie). Reisst die Kette nach dem
  // ersten, IST der Text gespeichert — und bis zu diesem Auftrag stand darüber nur die rohe
  // Servermeldung. DREI FESTE SÄTZE statt einer im Satz gefügten Aufzählung: eine Liste, die aus
  // Einzelteilen zusammengesetzt wird, liest sich in mindestens einer der drei Sprachen falsch.
  //
  // KEINE ZAHL, KEINE URSACHE, KEIN VERSPRECHEN. Was der Server gemeldet hat, steht getrennt in
  // `serverNote` daneben — daneben, nie allein: eine Auskunft über seine Lage ist keine Auskunft
  // über die Arbeit des Menschen.
  "ko.revise.partialTags":
    "Dein Text ist gespeichert. Die Schlagworte sind nicht mehr durchgekommen.",
  "ko.revise.partialTagsCategory":
    "Dein Text ist gespeichert. Die Schlagworte und die Kategorie sind nicht mehr durchgekommen.",
  "ko.revise.partialCategory":
    "Dein Text und die Schlagworte sind gespeichert. Die Kategorie ist nicht mehr durchgekommen.",
  "ko.revise.partialAgain":
    "Drücke noch einmal „{{knopf}}“ — nachgeholt wird nur, was fehlt. Dein Text bleibt, wie er hier steht.",
  "ko.revise.serverNote": "Meldung des Servers: {{text}}",
  // JOB 4163 R2 (BEN2/BEN3) · WER NACH DEM TEILABBRUCH WEITERTIPPT, BEKOMMT NICHT DENSELBEN SATZ.
  // Am Server steht dann ein FRÜHERER Stand des Textes; „dein Text ist gespeichert" wäre unwahr und
  // wiegte den Menschen in Sicherheit. Dieser Satz nennt beide Hälften genauso — nur die andere
  // Grenze zwischen ihnen.
  "ko.revise.partialOlder":
    "Ein früherer Stand deines Textes ist gespeichert — deine letzte Änderung noch nicht. Dein Text steht unverändert hier.",
  // JOB 4163 R2 (BEN, Prüflücke 6) · WURDE DAS RECHT MITTEN IN DER KETTE ENTZOGEN, hilft ein
  // erneuter Griff nicht. Dann steht der Grund da statt der Aufforderung — eine Aufforderung, die
  // nichts einlöst, ist eine Scheinfunktion.
  "ko.revise.partialForbidden":
    "Weiter geht es gerade nicht: du darfst diesen Eintrag nicht mehr ändern. Der Rest wird erst gespeichert, wenn du das Recht wieder hast.",
  // Der 403 OHNE `PROPOSAL_REQUIRED`: das Schreibrecht ist ganz entzogen. Kein Weg wird versprochen
  // — es gibt keinen —, aber die Arbeit wird ausdrücklich für unverloren erklärt.
  "ko.revise.forbidden":
    "Du darfst diesen Eintrag gerade nicht ändern — gespeichert wurde nichts. Dein Text steht unverändert hier.",
  // JOB 4163 R2 (BEN4) · DER FREMDE SCHREIBER, NACHDEM SCHON ETWAS EIGENES DRIN STEHT.
  // `ko.revise.stale` sagt „gespeichert wurde nichts" — nach einem eigenen Teilabbruch ist das
  // falsch, und der bestehende Wortlaut bleibt deshalb unangetastet: für diese Lage steht ein
  // eigener Satz da, der BEIDE Tatsachen nennt.
  "ko.revise.stalePartial":
    "Jemand anderes hat diesen Eintrag inzwischen geändert — deine letzte Änderung wurde nicht gespeichert. Ein früherer Stand deines Textes von vorhin steht bereits im Eintrag. Dein Text steht unverändert hier.",
  "ko.revise.stalePartialVersion":
    "Jemand anderes hat diesen Eintrag inzwischen geändert, er steht jetzt auf Version {{n}} — deine letzte Änderung wurde nicht gespeichert. Ein früherer Stand deines Textes von vorhin steht bereits im Eintrag. Dein Text steht unverändert hier.",
  // JOB 4251 (WIKI-ZUSAMMENARBEIT) · DER KONFLIKT AN DER EINORDNUNG IST EIN ANDERER SATZ.
  //
  // Abgewiesen wurde der Schlagwort- oder Kategorieaufruf, NICHT der Text — der ist in dieser Lage
  // schon gespeichert. „Gespeichert wurde nichts" (`ko.revise.stale`) wäre hier die Unwahrheit.
  //
  // WARUM DER ERSTE HALBSATZ IMMER STIMMT UND KEINE ANNAHME IST: der Speicherweg setzt seine drei
  // Aufrufe in fester Reihenfolge ab (`BibliothekLesen.tsx`, `save`), der `revise` steht am Anfang
  // und läuft bei jedem Griff, solange der Formulartext nicht schon als eigene Marke gebucht ist.
  // Die beiden Einordnungsaufrufe sind also nur erreichbar, NACHDEM der Text dieses Menschen am
  // Server steht — ein Inhaltskonflikt bricht die Kette vorher ab und bekommt `ko.revise.stale`.
  //
  // KEINE FASSUNGSZAHL: die Einordnung hat keine. Eine Metadatenänderung lässt die Version
  // ausdrücklich stehen (KW-ARCH-G27) — eine Zahl hier wäre eine Auskunft neben der Sache. Was als
  // Nächstes zu tun ist, sagen die beiden Knöpfe darunter, nicht dieser Satz.
  //
  // RUNDE 2 · ES SIND DREI SÄTZE GEWORDEN, UND DAS IST DIE KORREKTUR, NICHT EINE VERZIERUNG. Bis
  // dahin stand hier EIN Satz, der „deine Schlagworte und deine Kategorie" pauschal für nicht
  // durchgekommen erklärte. BEN hat den Fall gemessen, in dem das unwahr ist: die Schlagworte gehen
  // durch, jemand Fremdes ändert die Kategorie, der Kategorieaufruf wird abgewiesen — und die
  // Fläche erklärte die soeben gespeicherten Schlagworte für verloren. Jeder dieser drei Sätze
  // nennt deshalb BEIDE Hälften, genau wie die `partial…`-Sätze des Teilabbruchs darüber.
  "ko.revise.staleEinordnungTags":
    "Dein Text ist gespeichert. Jemand anderes hat die Einordnung dieses Eintrags inzwischen geändert — deine Schlagworte sind nicht mehr durchgekommen. Deine Eingabe steht unverändert hier.",
  "ko.revise.staleEinordnungTagsCategory":
    "Dein Text ist gespeichert. Jemand anderes hat die Einordnung dieses Eintrags inzwischen geändert — deine Schlagworte und deine Kategorie sind nicht mehr durchgekommen. Deine Eingabe steht unverändert hier.",
  "ko.revise.staleEinordnungCategory":
    "Dein Text und deine Schlagworte sind gespeichert. Jemand anderes hat die Einordnung dieses Eintrags inzwischen geändert — deine Kategorie ist nicht mehr durchgekommen. Deine Eingabe steht unverändert hier.",
  // JOB 3667 R3 · DER EINREICHWEG IM BROWSER. Jeder Satz sagt die FOLGE, nicht bloss den Vorgang:
  // was mit dem eigenen Text geschieht, was mit dem freigegebenen Stand, und wer als Nächster
  // handelt. „Eingereicht" allein liesse offen, ob der Eintrag jetzt schon anders lautet.
  "ko.propose.mustReview":
    "Dieses Wissensobjekt ist freigegeben. Deine Änderung wird als Vorschlag eingereicht und gilt erst, wenn jemand anderes sie übernimmt.",
  "ko.propose.optIn": "Erst jemand anderen ansehen lassen, statt gleich freizugeben",
  "ko.propose.submit": "Änderung einreichen",
  "ko.propose.done":
    "Eingereicht. Der Eintrag trägt weiter den freigegebenen Stand, bis jemand anderes deinen Vorschlag übernimmt.",
  "ko.propose.stale":
    "Der Eintrag hat sich geändert, während du geschrieben hast — eingereicht wurde nichts. Dein Text steht unverändert hier.",
  "ko.propose.staleVersion":
    "Der Eintrag steht jetzt auf Version {{n}} — eingereicht wurde nichts. Dein Text steht unverändert hier.",
  "ko.propose.reload": "Eintrag neu lesen",
  "ko.propose.again": "Auf dem jetzigen Stand einreichen",
  "ko.propose.openTitle": "Offene Änderungsvorschläge ({{n}})",
  "ko.propose.fromVersion": "aus Version {{n}}",
  "ko.propose.take": "Übernehmen und freigeben",
  "ko.propose.reject": "Ablehnen",
  "ko.propose.rejectReason": "Warum abgelehnt?",
  "ko.propose.rejectConfirm": "Ablehnung speichern",
  "ko.propose.own":
    "Dein eigener Vorschlag — er muss von jemand anders geprüft werden, nicht von dir.",
  // JOB 3667 R4 · BEFUND 1: WAS DIE ÜBERNAHME MIT DEM INHALT TUT — vier Lagen, jede mit ihrer
  // FOLGE. „Der Vorschlag hat einen Inhalt" wäre ein Befund; hier steht, was daraus wird.
  //
  // DIE WÖRTER SIND DIE DES FORMULARS, nicht die des Quelltexts: das Feld `bodyHtml` heisst auf der
  // Fläche „Ausführlicher Inhalt" (`capture.fBody`), `statement` heisst „Aussage", und „Kernaussage"
  // ist der TITEL (`capture.fTitle`). Ein Satz, der hier „Fließtext" oder „Titel" sagte, benennte
  // Felder, die der Mensch unter diesen Namen nirgends sieht.
  "ko.propose.body.neu":
    "Ausführlicher Inhalt des Vorschlags — die Übernahme ersetzt damit den jetzigen:",
  "ko.propose.body.gleich": "Ausführlicher Inhalt des Vorschlags — er gleicht dem jetzigen:",
  // JOB 3667 R5 · AUSGELASSEN IST NICHT GELÖSCHT — und die zwei Fälle heissen jetzt verschieden.
  // „bleibt": der Vorschlag ändert nur die Aussage (so kommt er aus Word); der ausführliche Inhalt
  // des Eintrags steht darunter, weil GENAU ER nach der Übernahme dort steht.
  "ko.propose.body.bleibt":
    "Der Vorschlag ändert nur die Aussage. Der ausführliche Inhalt des Eintrags bleibt unverändert bestehen:",
  // „entfernt": jemand hat den ausführlichen Inhalt AUSDRÜCKLICH geleert — nur dann verschwindet er.
  "ko.propose.body.entfernt":
    "Der Vorschlag LÖSCHT den ausführlichen Inhalt: der Einreicher hat ihn geleert. Die Übernahme entfernt den jetzigen; es bleibt die Aussage.",
  "ko.propose.body.keiner": "Kein ausführlicher Inhalt — weder im Vorschlag noch im Eintrag.",
  // JOB 3667 R4 · BEFUND 2: was dieser Weg trägt, und was er nicht trägt.
  "ko.propose.onlyFields":
    "Eingereicht werden Aussage und ausführlicher Inhalt. Kernaussage, Wissensart, Domäne/Kategorie, Bedingungen, Maßnahmen und Tags lassen sich auf diesem Weg nicht ändern — sie bleiben, wie sie sind.",
  "ko.propose.droppedFields":
    "Diese Änderungen gehen NICHT mit hinaus und bleiben unverändert: {{felder}}.",
  "ko.editNote":
    "Speichern erhöht die Version, setzt die Bewertung zurück und schickt das Objekt erneut in die Prüfung.",
  "ko.revision.title": "Änderungsüberblick",
  "ko.revision.none": "Noch keine Änderungen erkannt.",
  "ko.revision.note":
    "Erkennt geänderte Felder/Struktur, nicht die fachliche Richtigkeit. Revidieren erzeugt eine neue Version und braucht Review — keine automatische Freigabe.",
  "ko.revision.field.title": "Titel",
  "ko.revision.field.statement": "Aussage",
  "ko.revision.field.body": "Ausführlicher Inhalt",
  "ko.revision.field.conditions": "Bedingungen",
  "ko.revision.field.measures": "Maßnahmen",
  "ko.revision.field.tags": "Tags",
  "ko.revision.field.category": "Kategorie",
  "ko.revision.field.type": "Typ",
  "ko.reportConflict": "Konflikt melden",
  "ko.conflictTitle": "Widerspruch zu einem anderen Wissensobjekt melden",
  "ko.conflictTarget": "Widersprechendes Objekt",
  "ko.conflictTargetPlaceholder": "Objekt auswählen …",
  "ko.conflictType": "Konfliktart",
  "ko.conflictDesc": "Worin besteht der Widerspruch?",
  "ko.conflictSubmit": "Konflikt eröffnen",
  "ko.conflictTargetSearch": "Wissensobjekt suchen …",
  "ko.conflictTargetEmpty": "Keine Treffer",
  "ko.conflictTargetChoose": "Auswählen",
  "ko.conflictTargetShow": "Vorschau",
  "ko.conflictTargetHide": "Vorschau schließen",
  "ko.provenance": "Herkunft",
  "ko.helpfulTitle": "Bewährung",
  "ko.helpfulHint": "Hat dir dieses Wissen in der Praxis geholfen?",
  "ko.helpful": "Hat geholfen",
  "ko.helpfulDone": "Danke für dein Signal!",
  "ko.helpfulThanks": "Danke — als hilfreich vermerkt.",
  "ko.sourceTitle": "Quelle/Beitrag melden",
  "ko.sourceContribution": "Dein Beitrag / deine Begründung (Pflicht)",
  "ko.sourceRef": "Quelle / URL / Referenz (optional)",
  "ko.sourceHint":
    "Wird zur Prüfung als Kommentar am Objekt gespeichert — noch keine peer-validierte Quelle.",
  "ko.sourceSubmit": "Beitrag einreichen",
  "ko.sourceSaved": "Beitrag als Kommentar gespeichert.",
  "ko.sourcesTitle": "Quellen",
  "ko.sourcesEmpty": "Noch keine externen Quellen.",
  "ko.sourcesHint": "Externe Quellen sind Stufe 2 und nicht peer-validiert.",
  "ext.title": "Externe Quelle suchen",
  "ext.hint":
    "Server-Proxy-Suche. Treffer werden nie automatisch übernommen; als externe, nicht peer-validierte Quelle anhängen — kein Ersatz für interne Validierung.",
  "ext.placeholder": "Suchbegriff …",
  "ext.search": "Suchen",
  "ext.attach": "Als Quelle anhängen",
  // JOB 4367: `ext.attachBlocked` und `ext.gate.how` wohnen jetzt in `texte/ux08.ts`.
  // AUFTRAG-mega16 Block A (bens SB-4): die Stufe ist jetzt eine echte Grenze — sie gilt für JEDE
  // öffentliche Web-Adresse, nicht nur für erkannte Anbieter. Der Nutzer muss das VOR dem Absenden
  // wissen, mit Grund und mit dem Weg zur Änderung.
  "ext.gate.publicUrl":
    "Auf der eingestellten Stufe kann keine Quelle mit öffentlicher Web-Adresse angehängt werden — das gilt für jede Adresse aus dem Netz, nicht nur für Treffer der Suche.",
  "ext.gate.unanchored":
    "Auf der eingestellten Stufe kann eine Quelle ohne Adresse nur angehängt werden, wenn sie eine Belegstelle aus einem Dokument ist, das an diesem Wissensobjekt hinterlegt ist. Ohne Adresse und ohne hinterlegtes Dokument ist für den Server nicht unterscheidbar, ob es sich um einen externen Treffer handelt.",
  "ext.unavailable": "Externe Suche ist nicht verfügbar.",
  "ext.resumeHint":
    "Die Trefferliste wird im Entwurf nicht mitgespeichert. Deine Suchanfrage ist wieder da — führe die Suche erneut aus, um die Treffer neu zu laden.",
  "extpage.kicker": "Recherche",
  "extpage.title": "Externes Wissen",
  "extpage.intro": "Externe Quellen durchsuchen — ganz ohne vorher ein Wissensobjekt zu öffnen.",
  "extpage.note":
    "Nur-Lese-Recherche über den Server-Proxy. Hier wird nichts angehängt oder importiert; zum Übernehmen eine Quelle im Wissensobjekt-Detail anhängen. Keine Peer-Validierung.",
  "extpage.idle": "Suchbegriff eingeben, um externe Quellen zu finden.",
  "extpage.disabled":
    "Externe Suche ist serverseitig deaktiviert (EXTERNAL_SEARCH=off). Bitte Betrieb/Codex kontaktieren.",
  "extpage.noResults": "Keine Treffer für diese Suche.",
  "extpage.resultsTitle": "{{n}} Treffer",
  "ko.sourceLabel": "Bezeichnung der Quelle (Pflicht)",
  "ko.sourceUrl": "URL / Referenz (optional)",
  "ko.sourceExcerpt": "Auszug / Notiz (optional)",
  "ko.sourceAdd": "Externe Quelle hinzufügen",
  "ko.sourceAdded": "Externe Quelle hinzugefügt.",
  "ko.sourceRemove": "Quelle entfernen",
  "ko.sourceUnvalidated": "extern · nicht peer-validiert",
  "ko.sourceValidated": "peer-validiert",
  // F-0205 (SCRUM-438): der Herkunfts-Hinweis an extern stammenden Quellen. Bewusst ein EIGENER
  // Schlüssel neben `ko.sourceUnvalidated`: Jener ist die Hälfte eines Badge-PAARES
  // (`sourceBadgeKey`, koSource.ts:118) und beschreibt einen Prüfstand. Dieser hier ist ein
  // Herkunfts-Hinweis und steht allein — die geprüfte Quelle bekommt kein Gegenstück.
  "ko.sourceExternUnchecked": "Extern · ungeprüft",
  "ko.lineageTitle": "Herkunft & Verlauf",
  "ko.lineageOrigin": "Ursprung",
  "ko.lineageTransferred": "(übergeben)",
  "ko.lineageVersions": "Version",
  "ko.lineageChanges_one": "{{count}} Änderung",
  "ko.lineageChanges_other": "{{count}} Änderungen",
  "ko.lineageRelated": "Verwandt",
  "ko.lineageAudit": "Letzte Ereignisse",
  // JOB 3384 · UX-26: der Leerzustand der Herkunftskette. Bis hierher stand bei null Ereignissen
  // GAR NICHTS da (`MehrAbschnitte.tsx:1059`, `… : null`) — kein Satz, kein Grund.
  //
  // DER SATZ BEHAUPTET AUSDRÜCKLICH NICHT, es sei nie etwas geschehen. Er sagt „hier … verzeichnet"
  // und meint damit genau das, was diese Fläche wissen kann: das Prüfprotokoll, soweit es abgerufen
  // wurde und für die eigene Rolle sichtbar ist. Ein „an diesem Objekt ist nichts passiert" wäre
  // eine Tatsachenaussage ohne Voraussetzung (REGELN Punkt 7).
  "ko.lineageEventsEmpty": "Für dieses Objekt sind hier keine Ereignisse verzeichnet.",
  "ko.lineageGraphLink": "Im Wissensgraph ansehen",
  // AUFTRAG-mega68: die Nachbarschafts-Sicht ersetzt die SCRUM-130-Liste („Verwandte
  // Wissensobjekte") — gleiche Frage, jetzt aus der begrenzten Server-Auskunft mit sichtbarem
  // Kanten-Warum statt aus der Client-Heuristik über den ganzen Bestand.
  "nb.title": "Wissensnetz — Nachbarschaft",
  "nb.hint":
    "In der Mitte der Beitrag, den du liest; darum herum, was über gemeinsame Schlagwörter dazugehört. Ein Klick macht den Nachbarn zur neuen Mitte.",
  "nb.empty": "Keine Nachbarn über aussagekräftige Schlagwörter.",
  "nb.back": "Zurück zu „{{title}}“",
  "nb.open": "Beitrag öffnen",
  "nb.makeCenter": "„{{title}}“ zur neuen Mitte machen",
  "nb.svgLabel": "Nachbarschaft von „{{title}}“",
  "nb.countAll_one": "{{count}} Nachbar im Netz",
  "nb.countAll_other": "{{count}} Nachbarn im Netz",
  "nb.countTruncated": "Die {{shown}} stärksten von {{total}} Nachbarn",
  "nb.excluded":
    "Ohne Kanten über Allerwelts-Schlagwörter: {{tags}} — mehr als die Hälfte des Bestands trägt sie, die Verbindung sagt nichts.",
  // ==============================================================================================
  // JOB 4153 (WG-ANZEIGE) — DIE AUSDRÜCKLICH GESETZTEN FACHBEZIEHUNGEN.
  // ==============================================================================================
  // Jeder Satz hier hängt an seiner Voraussetzung. Was NICHT vorkommen darf, steht in
  // `tests/wissensgraph-anzeige/beziehungen-anzeige.test.tsx` als Verbotsliste: „aktuell geprüft",
  // „bestätigt", „konfliktfrei" — eine Beziehungsfassung ist keine Inhaltsprüfung (Vertrag Nr. 2).
  "wb.titel": "Gesetzte Fachbeziehungen",
  "wb.hinweis":
    "Von einem Menschen ausdrücklich gesetzt und verantwortet. Nicht aus geteilten Schlagwörtern abgeleitet.",
  "wb.herkunft.gesetzt": "gesetzt",
  "wb.herkunft.abgeleitet": "aus Schlagwörtern abgeleitet",
  "wb.leer": "Für diesen Eintrag sind keine Beziehungen gesetzt.",
  "wb.leerHinweis":
    "Das sagt nichts darüber, ob es Widersprüche gibt — es heißt nur, dass niemand eine Beziehung gesetzt hat.",
  "wb.fehler": "Die gesetzten Beziehungen konnten nicht geladen werden.",
  // JOB 4155: der Weg zurück NEBEN dem Fehlersatz. Er nennt ausdrücklich, was er wiederholt —
  // auf der Lesefläche steht daneben der Wiederholweg des EINTRAGS, und zwei gleich benannte
  // Knöpfe mit verschiedener Wirkung sind für einen Vorleser nicht unterscheidbar.
  "wb.erneut": "Beziehungen erneut laden",
  // Der Fall „gescheiterte Auffrischung" hat im Haus BEREITS einen Satz und eine Bauform
  // (`state.staleRefetchFailed` + `AuffrischungHinweis`). Er wird benutzt, nicht abgeschrieben.
  "wb.standFrisch": "Stand von {{zeit}}",
  "wb.standAuffrischung": "Stand von {{zeit}} · Auffrischung läuft",
  "wb.art.gehoert_zu": "gehört zu",
  "wb.art.ergaenzt": "ergänzt",
  "wb.art.ersetzt": "ersetzt",
  "wb.art.widerspricht": "widerspricht",
  "wb.art.beispiel_fuer": "Beispiel für",
  "wb.satz.gehoert_zu.quelle": "Dieser Eintrag gehört zu „{{title}}“.",
  "wb.satz.gehoert_zu.ziel": "„{{title}}“ gehört zu diesem Eintrag.",
  "wb.satz.ergaenzt.quelle": "Dieser Eintrag ergänzt „{{title}}“.",
  "wb.satz.ergaenzt.ziel": "„{{title}}“ ergänzt diesen Eintrag.",
  "wb.satz.ersetzt.quelle": "Dieser Eintrag ersetzt „{{title}}“.",
  "wb.satz.ersetzt.ziel": "Dieser Eintrag wird ersetzt von „{{title}}“.",
  "wb.satz.widerspricht.quelle": "Dieser Eintrag widerspricht „{{title}}“.",
  "wb.satz.widerspricht.ziel": "„{{title}}“ widerspricht diesem Eintrag.",
  "wb.satz.beispiel_fuer.quelle": "Dieser Eintrag ist ein Beispiel für „{{title}}“.",
  "wb.satz.beispiel_fuer.ziel": "„{{title}}“ ist ein Beispiel für diesen Eintrag.",
  // `ungerichtet` und `symmetrisch` tragen keine Richtungsaussage — hier wird keine erfunden.
  "wb.satz.ohneRichtung": "„{{title}}“ · {{art}} · Beziehung ohne Richtungsangabe",
  // Gerichtet, aber die Rolle dieses Eintrags steht nicht in der Auskunft: dann steht die
  // schwächere Aussage da und nicht die starke.
  "wb.satz.richtungUnbekannt": "„{{title}}“ · {{art}} · Richtung nicht bekannt",
  "wb.urheber": "gesetzt von {{urheber}}",
  "wb.gesetztAm": "am {{zeit}}",
  "wb.gesetztAmUnbekannt": "Zeitpunkt unbekannt",
  // JOB 4336: „dieses Eintrags" ist der GEÖFFNETE Eintrag und nicht die Quelle der gespeicherten
  // Kante — bei `rolle: "ziel"` sind das zwei verschiedene Einträge. Deshalb heißt die zweite Seite
  // „des Gegenstücks" und nicht mehr „des Ziels": aus der Ziel-Sicht wäre „das Ziel" man selbst.
  "wb.fassung.geaendert":
    "Beziehung wurde an Fassung {{beurteiltDieser}} dieses Eintrags und Fassung {{beurteiltGegen}} des Gegenstücks beurteilt; heute ist dieser Eintrag bei Fassung {{aktuellDieser}} und das Gegenstück bei Fassung {{aktuellGegen}}.",
  // Ohne Rolle ist nicht bekannt, welche Fassung zum geöffneten Eintrag gehört (ungerichtete und
  // symmetrische Kanten tragen keine). Dann werden beide genannt und keine zugeordnet.
  "wb.fassung.geaendertOhneRolle":
    "Beziehung wurde an den Fassungen {{beurteiltErste}} und {{beurteiltZweite}} der beiden Einträge beurteilt; heute sind es Fassung {{aktuellErste}} und Fassung {{aktuellZweite}}. Welche Fassung zu welchem der beiden Einträge gehört, steht nicht in der Auskunft.",
  "wb.fassung.unbekannt": "Bezug zur Fassung unbekannt.",
  "wb.fassung.unveraendert":
    "Seit dem Setzen hat sich keine der beiden Fassungen geändert (Fassung {{aktuellDieser}} dieses Eintrags und Fassung {{aktuellGegen}} des Gegenstücks).",
  "wb.fassung.unveraendertOhneRolle":
    "Seit dem Setzen hat sich keine der beiden Fassungen geändert (Fassung {{aktuellErste}} und Fassung {{aktuellZweite}}).",
  "wb.grenze.widerspricht":
    "„widerspricht“ ist ein verantworteter Vermerk eines Menschen und kein Beweis.",
  "wb.grenze.ersetzt": "„ersetzt“ ändert keine Freigabe und veröffentlicht keinen Nachfolger.",
  "wb.widerruf.knopf": "Widerrufen",
  "wb.widerruf.frage": "Diese Beziehung widerrufen?",
  "wb.widerruf.frageText":
    "Die Beziehung bleibt nachvollziehbar erhalten und wird nicht gelöscht. Sie gilt danach als widerrufen.",
  "wb.widerruf.ja": "Ja, widerrufen",
  "wb.widerruf.nein": "Abbrechen",
  "wb.widerruf.laeuft": "Wird gesendet …",
  "wb.widerruf.erfolg": "Widerrufen. Die Beziehung bleibt nachvollziehbar erhalten.",
  "wb.setzen.titel": "Beziehung setzen",
  "wb.setzen.suche": "Ziel suchen",
  // Ein stehender HINWEIS unter dem Feld, kein `placeholder` (Begründung an der Einbaustelle).
  "wb.setzen.sucheHinweis": "Suche nach Titel oder einem Wort aus dem Eintrag.",
  "wb.setzen.sucheLaedt": "Sucht …",
  "wb.setzen.sucheLeer": "Kein Eintrag gefunden, den du sehen darfst.",
  "wb.setzen.sucheFehler": "Die Suche konnte nicht ausgeführt werden.",
  "wb.setzen.zielWaehlen": "„{{title}}“ als Ziel wählen",
  "wb.setzen.zielGewaehlt": "Ziel: „{{title}}“ · Fassung {{version}}",
  "wb.setzen.zielAendern": "Anderes Ziel wählen",
  "wb.setzen.art": "Art der Beziehung",
  "wb.setzen.richtung": "Richtung",
  "wb.richtung.gerichtet": "gerichtet — von diesem Eintrag zum Ziel",
  "wb.richtung.ungerichtet": "ungerichtet — ohne Richtungsangabe",
  "wb.richtung.symmetrisch": "symmetrisch — in beide Richtungen gleich",
  "wb.richtungKurz.gerichtet": "gerichtet",
  "wb.richtungKurz.ungerichtet": "ohne Richtung",
  "wb.richtungKurz.symmetrisch": "symmetrisch",
  "wb.setzen.knopf": "Beziehung setzen",
  "wb.setzen.laeuft": "Wird gesendet …",
  "wb.setzen.erfolg": "Die Beziehung ist gesetzt — der Server hat sie bestätigt.",
  "wb.setzen.fassungUnbekannt":
    "Die Fassung dieses Eintrags ist noch nicht bekannt. Solange sie fehlt, wird nichts gesendet.",
  "wb.setzen.zielFehlt": "Wähle zuerst ein Ziel.",
  "wb.fehler.keinRecht":
    "Du darfst hier nichts setzen, oder einer der beiden Einträge ist für dich nicht sichtbar. Nichts wurde gespeichert, deine Eingabe ist erhalten.",
  "wb.fehler.standVeraltet":
    "Der Stand hat sich geändert: dieser Eintrag ist jetzt Fassung {{quelle}}, das Ziel Fassung {{ziel}}. Nichts wurde gesetzt, deine Eingabe ist erhalten.",
  "wb.fehler.standVeraltetOhneZahlen":
    "Der Stand hat sich geändert. Der neue Stand wird geholt; nichts wurde gesetzt, deine Eingabe ist erhalten.",
  "wb.fehler.konflikt":
    "Die Beziehung wurde zwischenzeitlich verändert. Nichts wurde geschrieben, deine Eingabe ist erhalten.",
  // Eindeutig abgelehnt (400/401/404): der Server hat geantwortet. Hier DARF „nichts gesetzt" stehen.
  "wb.fehler.abgelehnt":
    "Der Server hat den Vorgang abgelehnt. Nichts wurde gesetzt, deine Eingabe ist erhalten.",
  // UNKLARER AUSGANG — der Satz, der in Runde 2 falsch war. Er behauptet NICHTS über den Bestand:
  // ein Transportfehler belegt keine Nicht-Speicherung (BEN1, gemessen: der Server hatte gesetzt).
  // DREI FASSUNGEN, weil auch die Auffrischung ausgehen kann: nur wenn sie ERFOLGREICH zurück war,
  // darf der Satz auf die Liste zeigen (BEN-R3-F, Runde 3: eine ausgelöste Abfrage ist kein Stand).
  "wb.fehler.unklar":
    "Es ist keine Antwort angekommen. Ob die Beziehung gesetzt wurde, ist damit unklar — der Bestand wurde danach neu geladen, die Liste oben zeigt ihn. Deine Eingabe ist erhalten; sendest du sie unverändert erneut, entsteht keine zweite Beziehung.",
  "wb.fehler.unklarLaedt":
    "Es ist keine Antwort angekommen. Ob die Beziehung gesetzt wurde, ist damit unklar. Der Bestand wird gerade neu geladen; bis er da ist, zeigt die Liste oben einen älteren Stand. Deine Eingabe ist erhalten; sendest du sie unverändert erneut, entsteht keine zweite Beziehung.",
  "wb.fehler.unklarNichtGeladen":
    "Es ist keine Antwort angekommen, und der Bestand konnte nicht neu geladen werden. Ob die Beziehung gesetzt wurde, ist damit unklar; die Liste oben zeigt einen älteren Stand. Deine Eingabe ist erhalten; sendest du sie unverändert erneut, entsteht keine zweite Beziehung.",
  "wb.widerruf.unklar":
    "Es ist keine Antwort angekommen. Ob der Widerruf angekommen ist, ist damit unklar — der Bestand wurde danach neu geladen, die Liste oben zeigt ihn.",
  "wb.widerruf.unklarLaedt":
    "Es ist keine Antwort angekommen. Ob der Widerruf angekommen ist, ist damit unklar. Der Bestand wird gerade neu geladen; bis er da ist, zeigt die Liste oben einen älteren Stand.",
  "wb.widerruf.unklarNichtGeladen":
    "Es ist keine Antwort angekommen, und der Bestand konnte nicht neu geladen werden. Ob der Widerruf angekommen ist, ist damit unklar; die Liste oben zeigt einen älteren Stand.",
  // Der Server hat geantwortet, aber einen anderen Auftrag bestätigt als den gegebenen (BEN2).
  "wb.fehler.andereAntwort":
    "Der Server hat eine andere Beziehung zurückgemeldet als angefordert. Dein Auftrag ist damit NICHT bestätigt. Deine Eingabe ist erhalten; sende erneut, wenn du ihn weiter willst.",
  // Die Antwort IST der Auftrag — aber sie kommt als widerrufene Beziehung zurück (BEN-R3-W).
  "wb.fehler.widerrufeneAntwort":
    "Der Server hat zu diesem Versuch eine widerrufene Beziehung zurückgemeldet. Sie gilt damit nicht als gesetzt. Deine Eingabe ist erhalten; sende erneut, wenn die Beziehung gelten soll.",
  "wb.widerruf.nichtBestaetigt":
    "Der Server meldet die Beziehung nach dem Widerruf weiterhin als aktiv. Der Widerruf ist damit nicht bestätigt. Versuche es erneut.",
  "graph.legendKuratiert": "gesetzte Fachbeziehung",
  "graph.kuratiertCount_one": "{{count}} gesetzte Fachbeziehung",
  "graph.kuratiertCount_other": "{{count}} gesetzte Fachbeziehungen",
  "graph.kuratiertKante": "gesetzt: {{art}} · {{richtung}}",
  // JOB 4328: die Kürzung dieser Menge, in Anwendersprache. Er nennt, wie viele Beziehungen
  // GELADEN wurden — nicht, wie viele Linien im Bild stehen: der Knotendeckel des Graphen zeichnet
  // über 60 Knoten nur einen Teil der gelieferten Menge (graphLayout.ts:573-575), und eine
  // Zeichenzahl wäre hier eine dritte Zahl, die niemand zugesagt hat. Der Knotenhinweis
  // (graph.truncated) bleibt daneben sein eigener Satz.
  "graph.kuratiertGeladen":
    "{{geladen}} von {{gesamt}} Fachbeziehungen wurden geladen. Der Graph zeigt einen begrenzten Ausschnitt.",
  "ko.transferTitle": "Autor übergeben",
  "ko.transferOriginal": "Originalautor",
  "ko.author": "Autor",
  // AUFTRAG-mega51 BLOCK F2: ohne Verzeichniseintrag steht eine ehrliche Auskunft statt der
  // rohen Kennung — mit kurzem Merkmal, damit zwei Unbekannte nicht wie eine Person aussehen.
  "ko.authorUnknown": "Unbekannte Person ({{ref}})",
  // AUFTRAG-mega62 Block H: der DRITTE Zustand. Er sagt bewusst nichts über die Person, sondern
  // über uns — das Verzeichnis liegt nicht vor. „Unbekannte Person" an dieser Stelle wäre eine
  // Aussage, die niemand geprüft hat, und genau so sah der Live-Befund aus Register A22 aus.
  // AUFTRAG-mega63 Block B: aus dem einen dritten Zustand werden ZWEI. „Wird geladen" vergeht von
  // selbst und verlangt Warten; „nicht abrufbar" bleibt und gehört gemeldet. Ein gemeinsamer Text
  // machte aus einem Ausfall eine Geduldsfrage.
  "ko.authorLoading": "Autorenname wird geladen …",
  "ko.authorUnavailable": "Autorenname nicht abrufbar",
  "ko.originalAuthor": "Original",
  "ko.transferPick": "Neuen Autor wählen …",
  "ko.transfer": "Übergeben",
  "ko.transferDone": "Autor übergeben. Originalautor bleibt sichtbar.",
  "ko.history": "Versionen",
  "ko.evidenceTitle": "Evidenz",
  // ================================================================================================
  // JOB 3384 · UX-26 — ORIGINAL UND BELEGDATENSATZ HEISSEN AB HIER VERSCHIEDEN.
  // ================================================================================================
  //
  // Die Art-Beschriftung sagte „Quelle" bzw. „Anhang" — dieselben Wörter, mit denen die Fläche das
  // ORIGINAL benennt (Abschnitt 2 „Quellen und Belege", Abschnitt 12 „Anhänge"). Wer die Belegkarte
  // las, sah damit zweimal denselben Namen für zwei verschiedene Dinge: den NACHWEIS und die Sache,
  // auf die er zeigt. Jetzt nennt die Zeile, WAS die Karte ist (ein Beleg) und WORAUF sie zeigt —
  // und der Knopf darunter („Original anzeigen") benennt weiterhin die Sache selbst. Zwei Namen,
  // zwei Dinge. Der Sachinhalt (`record.label` vom Server) wird dabei nicht angetastet.
  //
  // `ko.evidenceEmpty` sagte „Noch keine separaten Evidence-Records vorhanden." — ein Satz aus der
  // Programmsprache, ohne Weg. Der neue Satz ist deutsch und bekommt an der Fläche einen Weg
  // (`MehrAbschnitte.tsx`, Abschnitt 9), der für die eigene Rolle wirklich trägt.
  "ko.evidenceEmpty": "Für dieses Objekt ist noch kein Beleg verzeichnet.",
  "ko.evidenceEmptyCta": "Quelle anlegen",
  // Der Weg ist GEMESSEN, nicht behauptet: `addSource` legt zur Quelle einen Belegdatensatz an
  // (`services/knowledge-object/src/service.ts:2864-2874`, `kind: "source"`). Deshalb entsteht aus
  // diesem Schritt wirklich der erste Beleg — und deshalb ist er der nächste Schritt und nicht der
  // Anhang-Upload, der zusätzlich eine Datei verlangt.
  "ko.evidenceEmptyCtaHint":
    "Im Abschnitt „Quellen und Belege“ anlegen — daraus entsteht der erste Beleg",
  "ko.evidenceKind.source": "Beleg zu einer Quelle",
  "ko.evidenceKind.attachment": "Beleg zu einem Anhang",
  // JOB 3272 · UX-25: der Weg von der Belegkarte zum Original — und der ehrliche Satz, wenn das
  // Original nicht mehr an diesem Objekt hängt (dann steht dort KEIN Knopf, der ins Leere führte).
  "ko.evidenceToOriginal": "Original anzeigen",
  "ko.evidenceToOriginalHint": "Original im Abschnitt „Anhänge“ zeigen",
  // JOB 4367: `ko.evidenceOriginalDetached` wohnt jetzt in `texte/ux26.ts`.
  "ko.evCons.title": "Evidence-Konsistenz",
  "ko.evCons.status.ok": "stimmig",
  "ko.evCons.status.warning": "prüfen",
  // JOB 3384 · UX-26: das englische „Evidence" stand hier als HAUPTAUSSAGE in der deutschen
  // Anzeige — und zwar an Stellen, die Abschnitt 9 wirklich zeichnet (`MehrAbschnitte.tsx:1185`,
  // `:1195`, `:1224`). „Beleg" ist dasselbe Ding in Pedis Sprache; es geht keine Information
  // verloren, nur der Programmbrocken. Die Titelschlüssel darüber (`…title`, `…allOk`) bleiben
  // unverändert: sie werden von keiner Fläche dieses Auftrags gezeichnet.
  "ko.evCons.counts": "Quellen {{sources}} · Anhänge {{attachments}} · Belege {{evidence}}",
  // JOB 4367: `ko.evCons.allOk` wohnt jetzt in `texte/ux26.ts`.
  "ko.evCons.finding.source-without-evidence": "Quelle ohne Beleg",
  "ko.evCons.finding.attachment-without-evidence": "Anhang ohne Beleg",
  "ko.evCons.finding.evidence-without-source": "Beleg ohne Quelle",
  "ko.evCons.finding.evidence-without-attachment": "Beleg ohne Anhang",
  "ko.evCons.finding.legacy-inline-attachment": "Alter Inline-Anhang (ohne Beleg)",
  "ko.evVer.title": "Evidence nach Version",
  "ko.evVer.version": "v{{n}}",
  "ko.evVer.counts": "Quellen {{sources}} · Anhänge {{attachments}}",
  "ko.evVer.latest": "zuletzt {{at}}",
  "ko.evVer.without": "Ohne Beleg: {{versions}}",
  "ko.evFresh.title": "Belegaktualität",
  "ko.evFresh.current": "aktuell belegt",
  "ko.evFresh.outdated": "nur ältere Versionen",
  // JOB 4367: `ko.evFresh.missing` und `ko.evFresh.neutral` wohnen jetzt in `texte/ux26.ts`.
  "ko.evFresh.counts": "v{{version}} · aktuell {{current}} · älter {{older}}",
  // JOB 3627: die Vermerke, die der DIENST fest in Historie und Schnappschüsse schreibt
  // (`services/knowledge-object/src/service.ts`, Fundstellen an der Tabelle in
  // `apps/web/src/lib/koHistoryNote.ts`). Der DEUTSCHE Wert ist Zeichen für Zeichen das Wort, das
  // der Dienst speichert — sonst änderte sich die deutsche Fläche still mit.
  "ko.historyNote.created": "erstellt",
  "ko.historyNote.createdFromDocument": "erstellt (Dokumentinhalt übernommen)",
  "ko.historyNote.createdBackfilled": "erstellt (nachgezogen)",
  "ko.historyNote.revised": "überarbeitet",
  "ko.historyNote.revisedFromDocument": "überarbeitet (Dokumentinhalt übernommen)",
  "ko.snapshotsTitle": "Versions-Snapshots",
  "ko.snapshotsEmpty": "Noch keine gespeicherten Voll-Snapshots vorhanden.",
  "ko.snapshotInitial": "Ausgangsversion — kein Vorgänger-Diff.",
  "ko.snapshotNoChanges": "Keine Änderung in den Hauptfeldern.",
  "ko.snapshotField.title": "Titel",
  "ko.snapshotField.statement": "Aussage",
  "ko.snapshotField.conditions": "Bedingungen",
  "ko.snapshotField.measures": "Maßnahmen",
  "ko.snapshotField.type": "Art",
  "ko.snapshotField.status": "Status",
  // JOB 3475 · UX-28: der ausführliche Bericht als siebtes verglichenes Feld (koVersionDiff.ts) und
  // die Texte, mit denen eine frühere Fassung wirklich lesbar wird.
  "ko.snapshotField.bodyHtml": "Ausführlicher Inhalt",
  "ko.snapshotOpen": "Fassung öffnen",
  "ko.snapshotClose": "Fassung zuklappen",
  "ko.snapshotBodyChars": "{{anzahl}} Zeichen Text",
  "ko.snapshotBodyMissing": "Für diese Fassung ist kein ausführlicher Inhalt gespeichert.",
  // JOB 4213 · EHRLICHKEIT VOR OPTIK: bis hierher stand hier „nur lesbar". Seit ein Mensch den Stand
  // zurückholen kann, wäre das eine Behauptung über einen Weg, den es gibt. Wahr bleibt: DIESE
  // Fassung selbst ändert sich nicht — eine Übernahme kopiert sie, sie bewegt sie nicht.
  "ko.snapshotReadOnly": "Alte Fassung v{{version}} · sie bleibt unverändert stehen",
  "ko.snapshotBackToCurrent": "Zurück zur aktuellen Fassung",
  // ================================================================================================
  // JOB 4213 · WIKI-NACHVOLLZIEHEN — VERGLEICHEN UND ZURÜCKHOLEN.
  // ================================================================================================
  //
  // JEDER SATZ NENNT DIE FOLGE, nicht bloss den Vorgang: was aus dem Klick wird, was mit der alten
  // Freigabe geschieht, und was bei einem Konflikt mit der eigenen Absicht passiert. „Übernommen"
  // allein liesse offen, ob der Eintrag damit auch wieder freigegeben ist.
  "ko.snapshotCompareTitle": "Zwei Fassungen vergleichen",
  "ko.snapshotCompareFrom": "ältere Fassung",
  "ko.snapshotCompareTo": "jüngere Fassung",
  "ko.snapshotCompareNeedsTwo":
    "Zum Vergleichen braucht es zwei gespeicherte Fassungen — bisher gibt es nur eine.",
  // NOCH NICHTS GEWÄHLT ist etwas anderes als „die neueste Fassung": ohne diesen leeren Eintrag
  // stellte der Abschnitt beim blossen Aufklappen ungefragt zwei Fassungsinhalte nebeneinander.
  "ko.snapshotCompareChoose": "bitte wählen",
  "ko.snapshotCompareHint":
    "Wähle zwei Fassungen — dann steht hier Feld für Feld, was sich zwischen ihnen unterscheidet.",
  "ko.snapshotCompareNone":
    "In den verglichenen Feldern unterscheiden sich diese beiden Fassungen nicht.",
  "ko.snapshotCompareSame": "Das ist zweimal dieselbe Fassung — wähle zwei verschiedene.",
  "ko.snapshotCompareUnknown":
    "Eine der beiden Fassungen liegt gerade nicht vor — der Vergleich bleibt offen.",
  "ko.snapshotFieldEmpty": "nichts gespeichert",
  "ko.snapshotRestore": "Als Arbeitsfassung übernehmen",
  "ko.snapshotRestoreHint":
    "erzeugt daraus eine neue, offene Fassung; diese Fassung bleibt unverändert stehen",
  "ko.snapshotRestoreRunning": "Wird übernommen …",
  "ko.snapshotRestoreDone":
    "Übernommen. Der Inhalt von v{{version}} steht jetzt als neueste Fassung — offen und ungeprüft, die frühere Freigabe ist nicht mitgekommen.",
  // KEIN „NEU LADEN" IN DIESEM SATZ (Korrekturpflicht JOB 4146 R6/R7): wer neu lädt, verliert, was
  // er gerade tun wollte. Der Satz sagt, dass nichts überschrieben wurde — der Weg steht daneben.
  "ko.snapshotRestoreStale":
    "Jemand anderes hat diesen Eintrag inzwischen geändert — übernommen wurde nichts, die fremde Arbeit steht unverändert da.",
  "ko.snapshotRestoreAgain": "Trotzdem übernehmen, auf dem jetzigen Stand",
  "ko.snapshotRestoreOffline":
    "Ohne Verbindung lässt sich nichts übernehmen — deine Auswahl bleibt stehen.",
  "ko.snapshotRestoreNoRight":
    "Diese Fassung kannst du lesen, aber nicht zurückholen — dafür fehlt dir das Bearbeitungsrecht.",
  // JOB 4213 R3: der Satz der Rolle, die zwar bearbeiten darf, aber einen FREIGEGEBENEN Stand nicht
  // direkt ersetzen kann (die Route antwortet dort 403 `PROPOSAL_REQUIRED`). Er nennt den Grund UND
  // den Weg, der wirklich offensteht — eine Absage ohne Weg wäre die Sackgasse, die dieser Knopf
  // vorher war.
  "ko.snapshotRestoreNeedsRelease":
    "Dieser Eintrag ist freigegeben — einen früheren Stand kann hier nur zurückholen, wer freigeben darf. Deine Änderung geht als Vorschlag über „Bearbeiten“.",
  "ko.snapshotRestoreIsCurrent": "Das ist der aktuelle Stand — hier gibt es nichts zurückzuholen.",
  "ko.snapshotRestoreNoContent":
    "Zu dieser Fassung liegt kein gespeicherter Stand vor, der übernommen werden könnte.",
  // DIE HERKUNFT EINER ZURÜCKGEHOLTEN FASSUNG — ein EIGENER Satz und kein Dienst-Vermerk: er trägt
  // eine Versionszahl, und der Vermerkkatalog (`koHistoryNote.ts`) vergleicht ZEICHENGENAU; ein für
  // jede Version anderer Vermerk käme dort nie an und stünde deutsch im englischen Text. Er steht
  // NEBEN dem Vermerk, nicht an seiner Stelle: WAS geschah, sagt weiterhin „überarbeitet".
  "ko.snapshotRestoredFrom": "aus Fassung v{{version}} übernommen",
  "ko.comments": "Kommentare",
  "ko.commentsEmpty": "Noch keine Kommentare.",
  "ko.commentPlaceholder": "Kommentar schreiben …",
  "ko.commentAdd": "Kommentieren",
  // JOB 4146 (WIKI-DISKUSSION): der Faden am Dokument. „Geklärt" — NIE „freigegeben" oder
  // „geprüft": der Klärungsstand sagt, dass die Sache besprochen ist, nicht dass der Inhalt gelten
  // darf (`tests/wiki-diskussion/sprachen.test.ts` prüft den Wortlaut in allen drei Sprachen).
  "ko.diskussion.titel": "Diskussion",
  "ko.diskussion.version": "zu Fassung v{{version}}",
  "ko.diskussion.versionVeraltet":
    "zu Fassung v{{version}} · der Eintrag steht inzwischen auf v{{aktuell}}",
  "ko.diskussion.versionUnbekannt": "Fassungsbezug unbekannt",
  "ko.diskussion.antworten": "Antworten",
  "ko.diskussion.antwortAn": "Antwort an {{name}}",
  "ko.diskussion.antwortSenden": "Antwort senden",
  "ko.diskussion.antwortAbbrechen": "Abbrechen",
  "ko.diskussion.erledigtVon": "geklärt · {{name}} · {{datum}}",
  "ko.diskussion.wiederGeoeffnetVon": "wieder offen · {{name}} · {{datum}}",
  "ko.diskussion.alsGeklaertMarkieren": "Als geklärt markieren",
  "ko.diskussion.wiederOeffnen": "Wieder öffnen",
  // R6: KEIN SATZ SCHICKT MEHR INS NEULADEN. Die Entwürfe liegen im Zustand der Lesefläche; wer der
  // alten Aufforderung folgte, verlor genau den Text, den derselbe Satz als erhalten bezeichnete.
  // Der Weg zurück ist jetzt der Knopf „Erneut senden" daneben.
  "ko.diskussion.sendeFehler":
    "Der Beitrag wurde nicht gespeichert. Dein Text steht noch im Feld — mit „Erneut senden“ geht er gleich noch einmal hinaus.",
  "ko.diskussion.sendeFehlerVeraltet":
    "Jemand anderes hat im selben Moment geschrieben. Dein Text steht noch im Feld — „Erneut senden“ hängt ihn an den neuesten Stand an.",
  // R5: die Verbindung ist abgebrochen, bevor eine Antwort kam. Ob der Server geschrieben hat, weiss
  // hier niemand — und was niemand weiss, behauptet dieser Satz auch nicht.
  "ko.diskussion.sendeFehlerUnklar":
    "Ob der Beitrag gespeichert wurde, ist unklar — die Verbindung brach ab, bevor eine Antwort kam. Dein Text steht noch im Feld. „Erneut senden“ legt ihn nicht ein zweites Mal ab.",
  "ko.diskussion.erneutSenden": "Erneut senden",
  "ko.attachments": "Anhänge / Fotos",
  "ko.attachmentsEmpty": "Noch keine Anhänge.",
  "ko.attachmentAdd": "Foto anhängen",
  "ko.attachmentUploading": "Wird hochgeladen …",
  "ko.attachmentRemove": "Anhang entfernen",
  "ko.attachmentOpenNewTab": "Original in neuem Tab öffnen",
  "ko.attachmentPreviewUnavailable": "Keine Vorschau verfügbar",
  "ko.attachmentOriginalUnavailable": "Original nicht verfügbar",
  // JOB 3061 · H2 — die gemeinsame Prüffläche (vier Reiter, vier Menüorte).
  "pruefen.title": "Prüfen",
  "pruefen.handeltAls": "Du prüfst als {{role}}",
  "pruefen.tab.offen": "Offen",
  "pruefen.tab.konflikte": "Konflikte",
  "pruefen.tab.duplikate": "Duplikate",
  "pruefen.tab.erneut": "Erneut",
  "pruefen.menu.actions": "Aktionen",
  "pruefen.menu.filter": "Filter und Fokus",
  "pruefen.menu.help": "Hilfe zu dieser Fläche",
  "pruefen.more": "Mehr",
  "pruefen.images": "{{n}} Bilder",
  "pruefen.kVonN": "{{k}} von {{n}}",
  "pruefen.prev": "Vorheriger Eintrag",
  "pruefen.next": "Nächster Eintrag",
  "pruefen.reload": "Erneut laden",
  "pruefen.loadError": "Konnte nicht geladen werden.",
  "pruefen.refreshFailed": "Angezeigter Stand · Auffrischung fehlgeschlagen.",
  "pruefen.lastDecision": "Zuletzt",
  "pruefen.mehr.status": "Prüfstand",
  "pruefen.mehr.aiCheck": "KI-Prüfung",
  "pruefen.mehr.reviewContext": "Prüfkontext",
  "pruefen.mehr.zustand": "Status",
  "pruefen.mehr.evidence": "Beweislage",
  "pruefen.mehr.effect": "Wirkung der Entscheidung",
  "pruefen.mehr.recommendation": "Empfehlung",
  // JOB 1125 → JOB 3061: die zwei Redaktionshinweise standen als lokale Dreisprachen-Register in
  // `Duplicates.tsx` und `Conflicts.tsx`, weil `i18n.ts` damals nicht im Schreibscope lag. Sie
  // wohnen jetzt hier — WORTGLEICH und weiterhin GETRENNT: „eine Seite dieses Fundes" und „eine
  // der beiden Aussagen" sagen verschiedene Dinge, und ein Zusammenlegen wäre eine Textänderung
  // ohne Auftrag.
  "dup.redacted.title": "Inhalt zurückgehalten",
  "dup.redacted.body": "Mindestens eine Seite dieses Fundes darfst du nicht lesen.",
  "con.redacted.title": "Belege zurückgehalten",
  "con.redacted.body": "Mindestens eine der beiden Aussagen darfst du nicht lesen.",
  "val.kicker": "Validation Board",
  "val.intro":
    "Peer-Bewertung grün / gelb / rot. Ab der Schwelle (Standard 3× grün, 0× rot) gilt ein Objekt als validiert.",
  // ==============================================================================================
  // JOB 3290 — HIER STAND „Volltext filtern …", UND DAS WAR MEHR, ALS DAS FELD KANN.
  // ==============================================================================================
  //
  // Der Filter des Prüfbretts durchsucht Titel, Kernaussage, Bedingungen, Maßnahmen, Kategorie und
  // Schlagwörter — NICHT den ausführlichen Inhalt (`apps/web/src/lib/validationFilters.ts`,
  // `haystack`). Codex hat den Schaden gemessen (review26-bibliothek-pruefen 1/2, Beleg
  // 38-pruefen-volltext-ende.png): der Endmarker `ENDE-REV26-065813` steht im Inhalt, die
  // Bibliothek findet ihn, dieses Feld zweimal nicht — 0 Treffer. Und weil die Beschriftung
  // „Volltext" versprach, war das Ergebnis nicht deutbar: fehlt die Marke, oder liest das Feld sie
  // nur nicht? Genau diese Frage soll eine Beschriftung beantworten, nicht aufwerfen.
  //
  // DIE BESCHRIFTUNG NENNT DESHALB IHRE GRENZE, bis der Filter sie nicht mehr hat. Das ist die
  // ausdrücklich vorgesehene Auflage des Auftrags („ist der Umfang bewusst enger, sagt die
  // Beschriftung das"), keine Notlösung — und sie ist an das VERHALTEN gebunden, nicht an eine
  // Meinung: `tests/pruefen-volltext/pruefen-brett-gemountet.test.tsx` (C4) misst zuerst, ob der
  // Filter den Inhalt findet, und leitet daraus ab, was hier stehen MUSS. Wird der Inhalt eines
  // Tages durchsucht, wird dieser Fall rot und verlangt die Rückkehr zu „Volltext filtern …".
  // NACHTRAG Aufnahme 20260922 · Prüfboard-Bedienung (N-0072): der Inhalt WIRD jetzt durchsucht.
  // Das Feld trägt seitdem `pruefboard.volltextFiltern` (apps/web/src/texte/pruefboard.ts). Dieser
  // Wert bleibt unverändert stehen, weil der Umzugsnachweis (tests/i18n-textmodule) ihn festhält.
  "val.filter": "Filtern (ohne ausführlichen Inhalt) …",
  "val.filterAllTypes": "Alle Wissensarten",
  "val.filterAllCategories": "Alle Kategorien",
  "val.filterAllTags": "Alle Tags",
  "val.filterMine": "Mir zugewiesen",
  // WP-SUBMIT-ASYNC: Status der Hintergrund-KI-Prüfung auf der Karte + Filter „in Prüfung".
  "val.filterAiPending": "In KI-Prüfung",
  // PAKET 1.4 (D-AISTATE, Pedi 23.07.): ehrlich je Modellzustand — OHNE Modell trägt allein die
  // deterministische Ebene (kein „KI"), MIT Modell läuft die Prüfung zusätzlich „(mit KI)".
  // D-AISTATE PAKET 2 (bens V3): OHNE KI läuft NUR die deterministische Duplikat-/Überschneidungs-
  // prüfung — es gibt keine deterministische Konfliktprüfung (Konflikte erkennt nur die KI). Erst die
  // „(mit KI)"-Varianten nennen deshalb den Konflikt.
  "val.aiCheck.pending": "Duplikat-/Überschneidungsprüfung läuft",
  "val.aiCheck.pendingAi": "Duplikat-/Konfliktprüfung (mit KI) läuft",
  "val.aiCheck.pendingHint":
    "Die deterministische Duplikat-/Überschneidungsprüfung läuft im Hintergrund. Das Ergebnis erscheint hier, sobald sie abgeschlossen ist.",
  "val.aiCheck.pendingHintAi":
    "Die Duplikat-/Konfliktprüfung (mit KI) auf Konflikte und Überschneidungen läuft im Hintergrund. Das Ergebnis erscheint hier, sobald sie abgeschlossen ist.",
  "val.aiCheck.failed": "Prüfung fehlgeschlagen",
  "val.aiCheck.retry": "Erneut prüfen",
  "val.aiCheck.retryStarted": "Prüfung neu eingereiht — sie läuft jetzt im Hintergrund.",
  // WP-SHIP9-B3FIX (Pedi 23.07.): Sperr-Hinweis am ausgegrauten Eintrag, solange die Prüfung läuft
  // (aiCheck pending). Prüf-Aktionen sind bis zum Ergebnis gesperrt — kein Schein-Aktiv vor der Freigabe.
  "val.aiCheck.locked":
    "Duplikat-/Überschneidungsprüfung läuft … Prüf-Aktionen sind gesperrt, bis das Ergebnis vorliegt.",
  "val.aiCheck.lockedAi":
    "Duplikat-/Konfliktprüfung (mit KI) läuft … Prüf-Aktionen sind gesperrt, bis das Ergebnis vorliegt.",
  "val.aiCheck.reason.no-model":
    "Kein KI-Modell aktiv — es wurde nichts geprüft. Modell konfigurieren und erneut prüfen.",
  "val.aiCheck.reason.model-error":
    "Die KI-Prüfung ist mit einem Fehler abgebrochen. Erneut prüfen startet einen neuen Lauf.",
  // WP-SHIP8-FINAL (bens Bedingung 2): eigene ehrliche Ursachen für Frist und Warteschlangen-Kappe.
  "val.aiCheck.reason.timeout":
    "Die KI-Prüfung hat die Zeitgrenze überschritten und wurde abgebrochen. Erneut prüfen startet einen neuen Lauf.",
  "val.aiCheck.reason.model-timeout":
    "Das KI-Modell hat nicht rechtzeitig geantwortet. Erneut prüfen startet einen neuen Lauf.",
  "val.aiCheck.reason.queue-overflow":
    "Die Prüf-Warteschlange war voll — dieser Job wurde verdrängt. Erneut prüfen reiht ihn neu ein.",
  // D-AISTATE PAKET 1 (bens V1): vertraulich → Cloud-KI ausgeschlossen, kein lokales Modell.
  "val.aiCheck.reason.confidential":
    "Vertraulich — die Cloud-KI ist ausgeschlossen und kein lokales Modell verfügbar. Nur die deterministische Duplikat-/Überschneidungsprüfung lief; inhaltlich wurde nicht per KI geprüft.",
  // AUFTRAG-mega11 Block A (bens SB-1, sicherheitsrelevant): der mega9-Text hieß „Am Vergleich war
  // vertrauliches Wissen beteiligt …". Er war wahr, verriet aber Existenz UND thematische Relevanz
  // eines vertraulichen Vergleichspartners — an ein Board, das serverseitig schon mit `ko.read`
  // abrufbar ist. Dieser Text nennt nur noch die Wirkung (Cloud gesperrt, nur deterministisch
  // geprüft) und KEINE Aussage über geschützten Bestand: kein „vertraulich", kein
  // „Vergleichspartner", nichts über dessen Existenz oder Relevanz.
  "val.aiCheck.reason.privacy-no-cloud":
    "Für diese Prüfung ist die Cloud-KI aus Datenschutzgründen nicht verfügbar, und es steht kein lokales Modell bereit. Es lief nur die deterministische Duplikat-/Überschneidungsprüfung; inhaltlich wurde nicht per KI geprüft.",
  // RT-001 (Pedi): ehrliche Feinunterscheidung echter Providerfehler — nie Anbietername/Schlüssel/
  // Endpunkt/roher Fehlertext, nur nutzerverständliche Ursache + was der Nutzer tun kann.
  "val.aiCheck.reason.auth":
    "Die KI konnte sich nicht anmelden — die Zugangsdaten fehlen oder wurden abgelehnt. Bitte die Modell-Zugangsdaten in den Einstellungen prüfen und erneut prüfen.",
  "val.aiCheck.reason.rate-limit":
    "Der KI-Anbieter hat die Anfrage wegen einer Ratenbegrenzung abgewiesen. Kurz warten und erneut prüfen.",
  "val.aiCheck.reason.unreachable":
    "Der KI-Anbieter war nicht erreichbar — vermutlich ein Netzwerk- oder Verbindungsproblem. Verbindung prüfen und erneut prüfen.",
  "val.aiCheck.reason.bad-response":
    "Das KI-Modell hat eine unverständliche Antwort geliefert, die sich nicht auswerten ließ. Erneut prüfen startet einen neuen Lauf.",
  // AUFTRAG-mega23 Block B: TECHNISCHE Einreihung fehlgeschlagen — das Modell wurde nie gefragt und
  // hat nichts beanstandet. Der Text sagt genau das und tarnt sich nicht als Modellfehler.
  "val.aiCheck.reason.submit-followup-failed":
    "Die Prüfung konnte beim Einreichen technisch nicht eingereiht werden — das KI-Modell wurde dabei nicht gefragt und hat nichts beanstandet. Erneut prüfen reiht sie neu ein.",
  // AUFTRAG-mega28 A2/A3 (Pedi 26.07.): Seit dem Kandidaten-Deckel darf ein Lauf nicht mehr
  // behaupten, er habe den ganzen Bestand gesehen. Diese Texte nennen die ZAHLEN und sagen
  // ausdrücklich, was ein leeres Ergebnis dann heißt — und was es NICHT heißt.
  "val.aiCheck.reason.capacity":
    "Die Prüfung wurde wegen Auslastung des KI-Modells abgebrochen — sie ist nicht zu Ende gelaufen. Erneut prüfen startet einen neuen Lauf.",
  // AUFTRAG-mega29 B3: die Zahl kommt aus der ZUSAMMENFASSUNG beider Prüfwege und ist dort das
  // Minimum (mergeCoverage) — also eine konservative MINDESTabdeckung, nicht die tatsächliche Zahl
  // geprüfter Paare. Der Text sagt das jetzt selbst, statt eine Untergrenze als Istwert auszugeben.
  // AUFTRAG-mega29 C2 (bens M28-3): „Keine offenen Konflikte" ist wörtlich richtig und lädt trotzdem
  // zu dem Schluss ein, der Bestand sei geprüft und frei. Dieser Satz nimmt genau diese Ergänzung
  // zurück — mit den drei Zahlen der serverseitigen Zusammenfassung, ohne ein einziges Objekt zu nennen.
  "val.aiCheck.boardCaveat":
    "Das heißt nicht „geprüft und frei“: von {{total}} Wissensobjekten tragen {{incomplete}} einen unvollständigen Prüf-Lauf und {{unchecked}} gar keinen. Die Erkennung vergleicht jeden Beitrag nur gegen eine begrenzte Kandidatenmenge.",
  // AUFTRAG-mega31 A4: „gar kein Lauf“ und „keine Abdeckung nachgewiesen“ sind ZWEI Aussagen. Für
  // Altbestand von vor mega28 ist ein Lauf vermerkt — nur seine Reichweite ist nirgends belegt. Ihn
  // als „gar keinen Lauf“ zu bezeichnen wäre die falsche von beiden Ungenauigkeiten.
  "val.aiCheck.boardCaveat.noCoverage":
    "Bei {{noCoverage}} weiteren ist ein Prüf-Lauf vermerkt, aber keine Abdeckung nachgewiesen — über ihre Reichweite ist nichts belegt.",
  "val.aiCheck.coverage.partial": "TEILGEPRÜFT",
  "val.aiCheck.coverage.capped":
    "Geprüft gegen mindestens {{completed}} von {{available}} möglichen Nachbarn — kein vollständiger Abgleich. Die Zahl ist die konservative Mindestabdeckung beider Prüfwege (Widerspruch und Duplikat); der schwächere von beiden bestimmt sie. Ohne Fund heißt das: in dieser Menge nichts gefunden, nicht „frei von Konflikten und Duplikaten“.",
  "val.aiCheck.coverage.skipped":
    "Geprüft gegen mindestens {{completed}} von {{available}} möglichen Nachbarn; {{skipped}} Vergleiche wurden wegen Fehlern ausgelassen — der Lauf ist unvollständig. Ohne Fund heißt das nicht „frei von Konflikten und Duplikaten“.",
  "val.aiCheck.coverage.aborted":
    "Abgebrochen nach mindestens {{completed}} von {{available}} möglichen Nachbarn — der Rest wurde nicht geprüft. Ohne Fund heißt das nicht „frei von Konflikten und Duplikaten“.",
  // AUFTRAG-mega32 A1: die Merker melden keine Einschränkung, die Zahlen tragen die Aussage aber
  // nicht. Der Text behauptet KEINE Ursache — er sagt nur, dass die Vollständigkeit unbelegt ist.
  "val.aiCheck.coverage.unproven":
    "Dieser Lauf ist nicht als vollständig belegt: das Protokoll weist {{completed}} abgeschlossene Vergleiche bei {{available}} möglichen Nachbarn aus. Ohne Fund heißt das nicht „frei von Konflikten und Duplikaten“.",
  "val.feedback.condTitle": "Rückfrage – Begründung für den Autor (Pflicht)",
  "val.feedback.rejTitle": "Ablehnung – Begründung für den Autor (Pflicht)",
  "val.feedback.placeholder": "Was muss überarbeitet werden? …",
  "val.feedback.submit": "Absenden",
  "val.feedback.cancel": "Abbrechen",
  "val.feedback.error": "Konnte nicht gespeichert werden.",
  // SCRUM-365 / AG-12: Feedback enttechnisieren — als Hilfe zur Nacharbeit rahmen.
  "val.feedback.helpHint":
    "Dein Feedback hilft dem Autor, die nächste Version gezielt nachzuarbeiten.",
  "val.empty": "Keine offenen Objekte.",
  "val.target": "Ziel: {{n}}× grün",
  "val.trust": "Vertrauen",
  "val.votes": "{{have}} von {{need}} grün",
  "val.votesTitle": "Validierungs-Fortschritt",
  "val.votesHint":
    "So viele grüne (positive) Bewertungen sind erfasst — von {{need}} nötigen bis zur Validierung. Ab genug grünen und 0 roten gilt das Objekt als validiert; rote Bewertungen blockieren die Freigabe.",
  "val.votesBlocked": "{{count}}× rot",
  "val.staleVotes": "{{count}}× veraltet",
  "val.staleVotesHint":
    "Diese Bewertungen stammen aus einer früheren Revision (vor v{{version}}) und zählen nicht mehr. Das Objekt braucht frische Bewertungen der aktuellen Version.",
  "val.markTrue": "Als wahr kennzeichnen",
  "val.markTrueConfirm": "Als wahr kennzeichnen und komplett validieren?",
  "val.markTrueCancel": "Abbrechen",
  "val.markTrueYes": "Ja, validieren",
  "val.markTrueDone": "Als wahr gekennzeichnet — Objekt ist jetzt validiert.",
  // SCRUM-416: Karten-Dichte — eine ruhige Aufklappung für Signale/Kontext/Führung.
  "val.more": "Signale & Kontext anzeigen",
  // SCRUM-417: Bearbeiten direkt vom Board (führt in den Bearbeiten-Modus des KO-Details).
  "val.editKo": "Bearbeiten",
  "val.transferred": "Autor übertragen",
  "val.assigned": "zugewiesen",
  "val.decisionLabel": "Entscheidung offen:",
  "val.reviewContext.new": "Neu",
  "val.reviewContext.revision": "Überarbeitet",
  "val.reviewContext.hint.new": "Erstbewertung: Quelle, Aussage und Struktur prüfen.",
  "val.reviewContext.hint.revision":
    "Änderung prüfen: Version und Inhalt erneut bewerten — keine automatische Freigabe.",
  "val.reviewFocus.label": "Review-Fokus",
  "val.reviewFocus.all": "Alle",
  "val.reviewFocus.new": "Neu",
  "val.reviewFocus.revision": "Überarbeitet",
  "val.focusActive.label": "Aktive Filter",
  "val.focusReset": "Filter zurücksetzen",
  "val.focusEmpty.filtered": "Keine Treffer mit den aktuellen Filtern.",
  "val.focusEmpty.otherFilters": "Suche, Typ, Kategorie oder Tag anpassen.",
  "val.mineFocus.title": "Dir zugewiesene Review-Arbeit",
  "val.mineFocus.hint": "Das ist deine persönliche Review-Liste. Du kannst sie jetzt abarbeiten.",
  "val.mineFocus.count": "{{n}} für dich",
  "val.mineFocus.reset": "Alle offenen anzeigen",
  "val.mineEmpty.title": "Keine dir zugewiesene Review-Arbeit",
  "val.mineEmpty.hint":
    "Sobald dir etwas zugewiesen wird, erscheint es hier. Bis dahin ist hier nichts für dich offen.",
  "val.mineEmpty.cta": "Alle offenen Objekte ansehen",
  "val.decision.low": "wenig abgesichert — sorgfältig prüfen, Quellen/Belege anschauen.",
  "val.decision.mid": "teilweise abgesichert — Aussage und Quellen gegenprüfen.",
  "val.decision.high": "gut abgesichert — kurze Gegenprüfung genügt meist.",
  "val.reviewState.new": "Neu erfasst · offen",
  "val.reviewState.assigned": "Zugewiesen · Prüfung läuft",
  "val.reviewState.inReview": "Bewertung begonnen",
  "val.reviewState.validated": "Validiert",
  "val.reviewHint.new": "Noch keine Bewertung — jetzt fachlich prüfen.",
  "val.reviewHint.assigned": "Zugewiesen — zuständige Person prüft als Nächstes.",
  "val.reviewHint.inReview": "Bewertung läuft — Quellen und Aussage gegenprüfen.",
  "val.reviewHint.validated": "Bereits validiert.",
  "val.confirm": "Bestätigen",
  "val.conditional": "Bedingt",
  "val.reject": "Ablehnen",
  "val.actionApprove": "Freigeben",
  "val.actionQuery": "Rückfrage",
  "val.actionReject": "Ablehnen",
  "val.feedbackRequiredHint": "* Rückfrage und Ablehnung brauchen eine Begründung.",
  // SCRUM-365 / AG-12: ruhige Review-Führung „Was prüfe ich jetzt?" (progressive disclosure).
  "val.guide.title": "Was prüfe ich jetzt?",
  "val.guide.statement": "Aussage",
  "val.guide.statement.hint": "Stimmt die Kernaussage fachlich?",
  "val.guide.evidence": "Quelle & Belege",
  "val.guide.evidence.hint": "Sind Quelle oder Belege vorhanden und tragfähig?",
  "val.guide.context": "Kontext",
  "val.guide.context.hint": "Ist klar, wann und wo das gilt?",
  "val.guide.traceable": "Nachvollziehbarkeit",
  "val.guide.traceable.hint": "Ist es verständlich und nachvollziehbar beschrieben?",
  "val.guide.focus.revision":
    "Überarbeitet — prüfe gezielt, was sich seit der letzten Version geändert hat.",
  "val.guide.focus.transfer":
    "Autor wurde übertragen — schau besonders genau auf Aussage und Belege.",
  // SCRUM-365 / PI-K2 / AG-P2-3: Trust ist ein Signal, keine Wahrheit — erst das Quorum sichert.
  "val.guide.trustNote":
    "Vertrauen ist ein Review-Signal, keine Wahrheitsgarantie. Erst genug Freigaben — die vereinbarte Mindestzahl von Prüfern — machen Wissen gesichert.",
  // SCRUM-365: Entscheidungswirkung VOR dem Klick — ehrlich, keine Auto-Freigabe.
  "val.guide.impactTitle": "Was bewirkt die Entscheidung?",
  "val.impact.up.title": "Freigeben",
  "val.impact.up.body":
    "Zählt als eine Freigabe-Stimme. Wissen wird nur nutzbar, wenn Status, die Zahl der Freigaben und Vertrauen es tragen — nichts wird automatisch freigegeben.",
  "val.impact.warn.title": "Rückfrage",
  "val.impact.warn.body":
    "Braucht eine kurze Begründung. Bleibt Review-Arbeit und hilft dem Autor, gezielt nachzuarbeiten.",
  "val.impact.down.title": "Ablehnen",
  "val.impact.down.body":
    "Braucht eine kurze Begründung. Führt in die Nacharbeit — es wird nichts automatisch geschlossen.",
  "val.decisionSaved": "Bewertung erfasst.",
  // SCRUM-292: ehrliche Folge-Aussage je Verdict — keine automatische/Fake-Validierung.
  "val.outcome.up":
    "Positiv bewertet. Wenn Status und Vertrauen es tragen, kann es als nächster Schritt quellengebunden genutzt oder geprüft werden — automatisch validiert wird dadurch nichts.",
  "val.outcome.warn":
    "Rückfrage dokumentiert. Bleibt Review-Arbeit, bis die offenen Punkte geklärt sind.",
  "val.outcome.down": "Ablehnung dokumentiert. Bleibt Review-/Feedback-Arbeit.",
  "val.nextViewKo": "Objekt ansehen",
  "val.nextUse": "Wissen nutzen (fragen)",
  "val.nextRework": "Im Objekt nacharbeiten",
  "val.assign": "Zuweisen …",
  "val.openDetails": "Details ansehen — bearbeiten & löschen im Objekt",
  // AUFTRAG-mega38 BLOCK E: die Wand hiess „Frisch gesichert" und zeigte darunter dieselben
  // Einträge, die ihre eigene StatusPill als „Offen" ausweist. Sie sortiert nach `createdAt` und
  // filtert NICHT nach Status (services/app/src/livewall.ts:39-48) — sie zeigt also zuletzt
  // ERFASSTES Wissen, nicht gesichertes. „Gesichert" ist in diesem Produkt das Qualitätswort;
  // es hier für „neu angelegt" zu benutzen, ist dieselbe Wortkollision, die mega33 auf der
  // Antwortkarte geschlossen hat. Ein Wort, eine Bedeutung.
  "start.livewall.title": "Was gerade passiert",
  "start.livewall.subtitle": "Zuletzt erfasstes Wissen und Wissen, das anderen geholfen hat.",
  "start.livewall.saved": "Zuletzt erfasst",
  "start.livewall.helped": "Hat geholfen",
  "start.livewall.helpedToday": "heute geholfen: {{n}}",
  "start.livewall.savedEmpty": "Noch nichts erfasst — der erste Beitrag erscheint hier.",
  "start.livewall.helpedEmpty": "Noch keine „hat geholfen“-Rückmeldung.",
  // PMO-FEA-0003: hier ist „validiert" wörtlich gemeint — der Zweig filtert auf diesen Status.
  "start.livewall.validated": "Neu validiert",
  "start.livewall.validatedEmpty": "Noch kein validiertes Wissen.",
  "start.livewall.nameConsent":
    "Meinen Namen bei meinem validierten Wissen hier zeigen. Freiwillig, jederzeit widerrufbar; ohne Zustimmung erscheint kein Name.",
  "start.livewall.photoConsent":
    "Mein Foto bei meinem validierten Wissen hier zeigen. Freiwillig; „Foto entfernen“ löscht es sofort.",
  "start.livewall.photoAdd": "Foto wählen",
  "start.livewall.photoReplace": "Foto ersetzen",
  "start.livewall.photoRevoke": "Foto entfernen",
  "start.livewall.photoError":
    "Das Foto konnte nicht übernommen werden. Bitte ein PNG-, JPEG- oder WebP-Bild wählen.",
  "start.livewall.photoAlt": "Foto der Autorin oder des Autors",
  "start.livewall.photoOwnAlt": "Mein Foto für die Wand",
  "start.livewall.beamerOpen": "Als Beamer-Ansicht öffnen",
  "start.livewall.beamerFullscreen": "Vollbild",
  "start.livewall.beamerLoading": "Lädt …",
  "start.livewall.beamerError":
    "Die Wand ist gerade nicht abrufbar. Sie versucht es im nächsten Takt erneut.",
  "start.livewall.beamerStale":
    "Keine frische Verbindung — Namen und Fotos sind ausgeblendet, bis die Wand wieder aktuell ist.",
  // AUFTRAG-mega51 BLOCK G1: DE und NL trugen hier die englische Bezeichnung.
  "con.kicker": "Konflikt-Übersicht",
  "con.title": "Konflikte klären — ohne Wissen zu verlieren",
  "con.intro":
    "Widersprüche werden gegenübergestellt und klassifiziert. Nur Wahrheitskonflikte lösen den menschlichen Eskalationspfad aus.",
  "con.empty": "Keine offenen Konflikte.",
  "conflict.impact.title": "Offener Konflikt — Nutzbarkeit eingeschränkt",
  "conflict.impact.hint":
    "Zu diesem Wissen ist ein Konflikt offen. Es ist nicht automatisch falsch, sollte aber vor uneingeschränkter Nutzung geprüft werden.",
  "conflict.impact.truthTitle": "Offener Wahrheitskonflikt — vor Nutzung prüfen",
  "conflict.impact.truthHint":
    "Zu diesem Wissen ist ein Wahrheitskonflikt offen. Bis zur Klärung gilt es als zu prüfen, nicht als uneingeschränkt gesichert.",
  "conflict.impact.badge": "Konflikt offen",
  "conflict.impact.cta": "Konflikt ansehen",
  // JOB 3025 / A27 (OFFEN.md:81): die Auskunft an die AUTORIN über ihr eigenes Objekt. Eigene
  // Schlüssel statt der bis dahin zweckentfremdeten `dup.probable` / `conflict.impact.badge` —
  // jene benennen die Nutzbarkeitswirkung für den Leser, diese die Handlungsmöglichkeit der
  // Verfasserin. Die `kollision.lage.*`-Sätze sind KEINE Störungsmeldungen, sondern Auskunft über
  // die Datengrundlage: sie stehen dort, wo sonst eine Aussage über den Bestand stünde.
  "kollision.detail.title": "Kollision an diesem Objekt",
  "kollision.detail.dublette":
    "Dieses Objekt überschneidet sich mit vorhandenem Wissen. Du kannst deinen Eintrag schärfen oder abgrenzen; ob zusammengeführt wird, entscheidet die Prüfung.",
  "kollision.detail.konflikt":
    "Zu diesem Objekt steht ein Widerspruch offen. Du kannst deine Aussage präzisieren und belegen; die Klärung selbst liegt bei der Prüfung.",
  "kollision.detail.beides":
    "Dieses Objekt überschneidet sich mit vorhandenem Wissen, und es steht ein Widerspruch offen. Du kannst schärfen und belegen; Zusammenführen und Klären liegen bei der Prüfung.",
  "kollision.detail.keine": "Keine offene Kollision an diesem Objekt.",
  "kollision.start.title": "Kollisionen an deinen Objekten",
  "kollision.start.dublette": "{{n}} deiner Wissensobjekte: Überschneidung mit vorhandenem Wissen.",
  "kollision.start.konflikt": "{{n}} deiner Wissensobjekte: offener Widerspruch.",
  "kollision.start.beides": "{{n}} deiner Wissensobjekte: Überschneidung oder offener Widerspruch.",
  "kollision.start.keine": "Keine offene Kollision an deinen Wissensobjekten.",
  "kollision.lage.laedt": "Wird geprüft — die Kollisionsprüfung lädt noch.",
  "kollision.lage.erstfehler": "Nicht aktuell prüfbar: die Daten ließen sich nicht laden.",
  "kollision.lage.auffrischungLaeuft":
    "Stand von zuletzt — die Angaben werden gerade aufgefrischt.",
  "kollision.lage.auffrischungGescheitert": "Stand von zuletzt — die Auffrischung ist gescheitert.",
  "kollision.lage.pausiert": "Stand von zuletzt — ohne Netzverbindung nicht aktuell prüfbar.",
  // Ohne jeden früheren Stand darf hier kein „Stand von zuletzt" stehen: der Satz verneint nichts
  // und behauptet auch keinen Stand, den es nie gab (Ben, JOB 3025 R2, Korrekturpflicht 2).
  "kollision.lage.pausiertOhneStand": "Ohne Netzverbindung nicht prüfbar.",
  "kollision.wiederholen": "Erneut prüfen",
  "kollision.wegKonflikte": "Konflikte ansehen",
  "kollision.wegDuplikate": "Duplikate ansehen",
  "kollision.keineGegenseite": "Das andere Objekt wird hier nicht genannt.",
  // JOB 3068 / N5: „gegen wie viel wurde geprüft". VIER LAGEN, VIER SÄTZE — die Vierteilung von
  // `DeckungsLage` (duplicate-signal.ts:73). Jeder Satz benennt AUSDRÜCKLICH, was gezählt wird:
  // Einträge im Bestand, gegen die dieser Eintrag geprüft wurde (Lehre JOB 3067 R1 — eine Zahl ohne
  // Bezugsgröße ist keine Auskunft). `ohneProtokoll` und `keinLauf` nennen KEINE Zahl und dürfen nie
  // denselben Satz tragen: „ein Lauf, dessen Reichweite unbelegt ist" und „gar kein Lauf" sind zwei
  // verschiedene Aussagen, und keine von beiden heißt „geprüft, nichts gefunden".
  "kollision.deckung.vollstaendig":
    "Gegen {{geprueft}} von {{bestand}} Einträgen im Bestand geprüft — der Lauf ist als vollständig belegt.",
  "kollision.deckung.unvollstaendig":
    "Gegen {{geprueft}} von {{bestand}} Einträgen im Bestand geprüft — der Lauf ist nicht als vollständig belegt.",
  // JOB 3068 R2 (bens Korrekturpflicht 1): derselbe unvollständige Lauf, aber OHNE Abdeckungs-
  // protokoll — ein gültiger Serverzustand (`status: "failed"`/`"pending"`, beide Zahlen `null`).
  // Der Satz oben stand dann mit zwei Löchern da („Gegen  von  Einträgen …"). Hier steht deshalb
  // die schwächere, ganze Aussage: nicht vollständig belegt UND Reichweite unbekannt, ohne Ziffer.
  "kollision.deckung.unvollstaendigOhneZahlen":
    "Der Prüflauf zu diesem Eintrag ist nicht als vollständig belegt; gegen wie viele Einträge im Bestand er ihn geprüft hat, ist unbekannt.",
  "kollision.deckung.ohneProtokoll":
    "Ein Prüflauf hat diesen Eintrag angesehen; gegen wie viele Einträge im Bestand er ihn geprüft hat, ist nicht belegt.",
  "kollision.deckung.keinLauf":
    "Zu diesem Eintrag ist kein Prüflauf vermerkt; gegen wie viele Einträge im Bestand er geprüft wurde, ist damit unbekannt.",
  "con.type.truth": "Wahrheit",
  "con.type.experience": "Erfahrung",
  "con.type.context": "Kontext",
  "con.type.temporal": "Zeit",
  "con.type.role": "Rolle",
  "con.status.offen": "Offen",
  "con.status.eskaliert": "Eskaliert",
  "con.status.zweitmeinung": "Zweitmeinung",
  "con.status.geloest": "Gelöst",
  "con.escPath": "Eskalationspfad",
  "con.escalate": "Eskalieren",
  "con.resolve": "Auflösen",
  "con.origin.auto": "Automatisch erkannt",
  "con.origin.manual": "Manuell angelegt",
  "con.autoConfidence": "Sicherheit {{percent}} %",
  // SCRUM-486 B: der KI-Prozent ist die Erkennungs-Sicherheit, kein Beweis des Widerspruchs.
  "con.autoConfidenceCaption": "KI-Sicherheit der Erkennung — kein bewiesener Widerspruch",
  "con.collision.at": "Kollision bei",
  "con.collision.verbatim": "wörtlich aus dem Beleg",
  "con.collision.point": "Kollisionspunkt",
  "con.autoWhy": "Begründung",
  "con.autoQuoteA": "Beleg A",
  "con.autoQuoteB": "Beleg B",
  "con.dismiss": "Fehlalarm – kein Widerspruch",
  // JOB 3061 · H2 — die vier Knöpfe des Mockups (Konflikte.dc.html:59). Sie führen auf die
  // VORHANDENEN Wege: Links/Rechts/Beide auf `resolve-conflict` (dokumentierend, mit editierbarer
  // Begründung), „Kein Widerspruch" auf `dismiss`. Nichts wird gelöscht oder zusammengeführt.
  "con.side.left": "Links gilt",
  "con.side.right": "Rechts gilt",
  "con.side.both": "Beide gelten, je nach Kontext",
  "con.side.none": "Kein Widerspruch",
  "con.prefill.side": "Maßgeblich ist: {{title}}.",
  "con.prefill.both": "Beide Aussagen gelten, je nach Kontext.",
  "con.resolveConfirm": "Entscheidung speichern",
  "con.decision": "Entscheidung",
  "con.decisionPlaceholder": "Wie wird der Widerspruch aufgelöst? (Begründung/Ergebnis)",
  "con.versus": "vs",
  "con.conditions": "Bedingungen",
  "con.measures": "Maßnahmen",
  "con.sources": "Quellen",
  "con.openKo": "Objekt öffnen",
  "con.compareOpen": "Beide gegenüberstellen",
  "con.readonlyCompare": "Read-only-Vergleich",
  // Aufnahme gesamt-konfliktboard (FR-CON-04): Name des Menüs mit allen offenen Fällen.
  "con.caseList": "Alle offenen Konflikte ({{count}})",
  "con.detectedOn": "Erkannt am {{date}}",
  "con.evidenceSideLabel": "Beleg dieser Seite",
  // ==============================================================================================
  // AUFTRAG-mega32 BLOCK K — DIE BEWEISLAGE, NICHT DAS URTEIL.
  // ==============================================================================================
  // Der Satz sagt, worauf sich die Entscheidung stützen kann. Er sagt NICHT, wer recht hat: eine
  // belegte Aussage kann falsch sein, sie ist nur belegt.
  "con.evidenceBalance.neither":
    "Keine der beiden Aussagen ist mit einer Quelle belegt. Dieser Widerspruch lässt sich deshalb nicht am Wortlaut entscheiden, sondern nur an Belegen — der nächste Schritt ist, für mindestens eine Seite eine Quelle nachzutragen.",
  "con.evidenceBalance.oneSided":
    "Nur eine der beiden Aussagen ist mit einer Quelle belegt: „{{title}}“. Das ist ein Unterschied in der Beweislage, kein Urteil darüber, welche Aussage stimmt — eine belegte Aussage kann falsch sein. Der nächste Schritt ist, die andere Seite zu belegen oder zurückzuziehen.",
  "con.compareTitle": "Gegenüberstellung",
  "con.koMissing": "Beitrag wurde entfernt.",
  "con.resolveEffect":
    "Die Entscheidung wird dokumentiert und protokolliert. Vertrauen/Status der Objekte werden NICHT automatisch geändert (kein stilles Überschreiben).",
  "con.resolveRevalidate": "Betroffene Objekte ggf. manuell re-validieren.",
  "con.secondOpinion": "Zweitmeinung",
  "con.secondOpinionAdd": "Zweitmeinung",
  "con.secondOpinionConfirm": "Zweitmeinung speichern",
  "con.secondOpinionPlaceholder": "Einschätzung einer zweiten Fachperson …",
  "con.nextLabel": "Nächster Schritt",
  "con.next.escalate": "An einen Menschen eskalieren (Wahrheitskonflikt).",
  "con.next.secondOpinion": "Zweitmeinung einer zweiten Fachperson einholen.",
  "con.next.resolve": "Entscheiden und die Auflösung dokumentieren.",
  "con.next.done": "Konflikt ist gelöst — keine offene Handlung.",
  "dup.kicker": "Duplikate-Board",
  "dup.title": "Doppelungen klären — ein Thema, eine Quelle",
  "dup.intro":
    "Automatisch erkannte Überschneidungen zwischen Beiträgen. Sehr hohe Textdeckung wird auch ohne KI gefunden; die feineren Fälle prüft das Modell. Du entscheidest: als verwandt vermerken, getrennt lassen oder als Fehlalarm schließen. (Jede dieser Entscheidungen hält nur ihren Grund fest; an den beiden Beiträgen ändert sie nichts.)",
  "dup.empty": "Keine offenen Überschneidungen.",
  "dup.relation.identisch": "Identisch",
  "dup.relation.a_enthaelt_b": "A enthält B",
  "dup.relation.b_enthaelt_a": "B enthält A",
  "dup.relation.teilweise": "Teilweise Überschneidung",
  "dup.relation.verwandt": "Verwandt",
  "dup.status.offen": "Offen",
  "dup.status.in_bearbeitung": "In Bearbeitung",
  "dup.status.geschlossen": "Geschlossen",
  "dup.method.model": "KI-Prüfung",
  "dup.method.deterministic": "Textabgleich",
  "dup.probable": "Vermutliches Duplikat",
  "dup.textIdentical": "Textgleiches Duplikat",
  "dup.overlap": "{{percent}} % Textdeckung",
  "dup.confidence": "Sicherheit {{percent}} %",
  // REVIEW26 (JOB 3469): Die führende Prozentzahl trägt den NAMEN dessen, was sie misst. Ohne ihn
  // lasen sich 95 % (Brett, KI-Sicherheit) und 26 % (Vergleich, Textdeckung) desselben Paars unter
  // derselben Beschriftung „gleich" wie ein Widerspruch. Es wird nichts gerechnet, nur benannt.
  "dup.lead.modelConfidence": "{{percent}} % KI-Sicherheit",
  "dup.lead.textOverlap": "{{percent}} % Textdeckung",
  "dup.lead.sectionAverage": "{{percent}} % Feldähnlichkeit im Schnitt",
  // SCRUM-486 B: ehrliche Rahmung der führenden Zahl — Ähnlichkeit ist kein Beweis.
  "dup.leadCaptionModel": "KI-Wahrscheinlichkeit — kein bewiesenes Duplikat",
  "dup.leadCaptionText": "Wort-/Text-Ähnlichkeit — kein bewiesenes Duplikat",
  "dup.why": "Begründung",
  "dup.shared": "Gemeinsame Aussagen",
  "dup.quoteA": "In A",
  "dup.quoteB": "In B",
  "dup.onlyA": "Nur in A",
  "dup.onlyB": "Nur in B",
  "dup.recommendation": "Empfehlung",
  // SCRUM-486 D: kein leeres „Zusammenführen"-Versprechen — Empfehlung zeigt auf die real vorhandenen
  // Aktionen (verlinken / getrennt lassen / Fehlalarm). Ein automatischer Merge existiert nicht.
  "dup.rec.zusammenfuehren": "Starke Überschneidung — verlinken oder eine Version pflegen",
  "dup.rec.zusammenfuehren_pruefen": "Überschneidung prüfen — verlinken oder getrennt lassen",
  "dup.rec.getrennt_lassen": "Getrennt lassen",
  "dup.rec.verwandt_verlinken": "Als verwandt verlinken",
  "dup.versus": "vs",
  "dup.openKo": "Objekt öffnen",
  // JOB 2241 (dort als enger Rest mit Startpin benannt) → JOB 3061: der Text des Vergleichslinks
  // stand bis hierher als lokales Dreisprachen-Register in `Duplicates.tsx`, weil `i18n.ts` nicht
  // im Schreibscope jenes Auftrags lag. Er wohnt jetzt hier; der deutsche Wortlaut ist bytegleich.
  "dup.compareReadonly": "Read-only Vergleich",
  "dup.compareOpen": "Beide gegenüberstellen",
  "dup.compareTitle": "Gegenüberstellung",
  "dup.koMissing": "Beitrag wurde entfernt.",
  "dup.closed": "Abgeschlossen",
  // JOB 3061 · H2: „Status setzen" im „···"-Menü der Duplikatkarte (bens Korrekturpflicht 1).
  "dup.setStatus": "Status setzen",
  "dup.closeReasonLabel": "Abschlussgrund (Pflicht)",
  "dup.closeNoteLabel": "Vermerk (freiwillig)",
  "dup.closeSubmit": "Abschliessen",
  "dup.reason.merged": "Zusammengeführt",
  "dup.reason.kept_separate": "Bewusst getrennt gelassen",
  "dup.reason.linked_related": "Als verwandt vermerkt",
  "dup.reason.dismissed": "Fehlalarm — kein Duplikat",
  "dup.reason.participant_deleted": "Beteiligter Beitrag entfernt",
  "dup.reason.superseded": "Gegenstandslos geworden",
  "dup.action.dismiss": "Fehlalarm – kein Duplikat",
  "dup.action.keepSeparate": "Getrennt lassen",
  "dup.action.linkRelated": "Als verwandt verlinken",
  // JOB 3061 · H2 — die vier Knöpfe des Mockups (Duplikate.dc.html:59). „Links/Rechts behalten"
  // ist der vorhandene Weg „Getrennt lassen" MIT Vermerk der maßgeblichen Seite: beide Objekte
  // bleiben bestehen, es wird nichts zusammengeführt und nichts gelöscht.
  "dup.side.left": "Links behalten",
  "dup.side.right": "Rechts behalten",
  "dup.side.both": "Beide behalten, als verwandt vermerken",
  "dup.side.none": "Kein Duplikat",
  // REVIEW26 (JOB 3469): „NN % gleich" ist ERSETZT, nicht ergänzt — die Beschriftung verschwieg,
  // welche Messung dahinterstand. An ihrer Stelle stehen die benannten `dup.lead.*`-Schlüssel.
  "dup.keepNote": "Getrennt lassen; maßgeblich ist: {{title}}.",
  // ==============================================================================================
  // JOB 3671 — DIE SEITENHILFE DER DUBLETTENFLÄCHE (Zahnrad → „Seitenhilfe").
  // ==============================================================================================
  //
  // Pedi 04.09.: „Erklärung gehört hinter Zahnrad/Profil, nicht ins Sichtfeld." Diese zwei Texte
  // melden sich über `HelpTip` bei der Seitenhilfe an und stehen deshalb NICHT auf der Fläche.
  //
  // Jede Zusage hier ist am Quelltext geprüft, und zwar an dieser Stelle:
  //   · nebeneinander / schmal untereinander → `PruefenPaar` ist `flex-col sm:flex-row`
  //     (components/pruefen/PruefenPaar.tsx:138); unter 640 px ist „Links" die OBERE Karte, weil
  //     Karte „a" zuerst gerendert wird und `dup.side.left` genau auf `pair.a` wirkt.
  //   · gelbe Markierung → `teileFuer` (pages/Duplicates.tsx:110-116): Eigenanteil, wenn er
  //     wörtlich im Text steht, sonst der Rest um die gemeinsamen Zitate; sonst gar nichts.
  //   · „schließen mit Grund, nichts am Wissen" → `OverlapService.close`
  //     (services/conflicts/src/overlap-service.ts:732-749) schreibt AUSSCHLIESSLICH `status`,
  //     `resolution` und `closedAt` des Fundes plus einen Audit-Eintrag. Kein Wissensobjekt wird
  //     angefasst — auch „Beide behalten, als verwandt vermerken" legt keine Verknüpfung an.
  //   · „nicht wieder öffnen" → die Statusroute kennt „offen" ausdrücklich NICHT als Ziel
  //     (services/app/src/routes/overlap-routes.ts:204-205); `unresolved()` filtert Geschlossene
  //     hart heraus (overlap-service.ts:933), und der Reiterzähler liest dieselbe Liste.
  //   · „Rolle" → `/duplikate` verlangt `minRole: "controller"` (app/navigation.ts:240) und die
  //     vier Abschlüsse verlangen `ko.validate` (overlap-routes.ts:156/174/219/254), das genau
  //     controller und admin haben (services/rbac/src/policy.ts:14-17). Wer die Fläche also
  //     überhaupt sieht, darf auch entscheiden; schwächere Rollen bekommen `RoleNotice`
  //     (routes.tsx:186) statt der Fläche. Darum verspricht der Text keinen gesperrten Weg.
  "dup.seitenhilfe.flaeche.titel": "Duplikate: was diese Fläche zeigt",
  "dup.seitenhilfe.flaeche.text":
    "Du siehst ein Paar fast gleicher Wissensobjekte nebeneinander; auf schmalen Fenstern stehen die beiden Karten untereinander — dann meint „Links behalten“ die obere Karte und „Rechts behalten“ die untere. Gelb markiert ist der Teil, der nicht zu den gemeinsamen Aussagen gehört: der Eigenanteil, wenn er wörtlich im Text steht, sonst der Rest um die gemeinsamen Zitate herum; findet sich keines von beidem, bleibt der Text unmarkiert statt geraten. Die Prozentpille ist Ähnlichkeit beziehungsweise Modellwahrscheinlichkeit und kein Beweis für ein Duplikat. Zahlen, gemeinsame Aussagen, Eigenanteile, Empfehlung und Status liegen im Aufklapper „{{mehr}}“ an jeder Karte; wie Dubletten überhaupt gefunden werden, erklärt das „?“ neben der Überschrift. Gibt es mehr als ein Paar, blätterst du mit den Pfeilen in der Kopfzeile.",
  "dup.seitenhilfe.entscheidung.titel":
    "Was deine Entscheidung bewirkt — und was, wenn sie falsch war",
  "dup.seitenhilfe.entscheidung.text":
    "Alle vier Knöpfe tun dasselbe eine: sie schließen diesen Fund mit dem gewählten Grund und halten ihn mit deinem Namen und der Zeit fest. An den beiden Wissensobjekten ändert keiner von ihnen etwas — nichts wird zusammengeführt, nichts gelöscht, und auch „Beide behalten, als verwandt vermerken“ legt keine Verknüpfung in den Objekten an, sondern hält diesen Grund fest. Ein geschlossener Fund lässt sich hier nicht wieder öffnen: er verschwindet aus der Liste und aus der Zahl am Reiter. Verloren ist damit nichts, denn beide Objekte stehen unverändert in „{{bibliothek}}“ — wer sich vertan hat, ändert sie dort. Willst du noch nicht entscheiden, wähle im Menü „···“ an der Karte „Status setzen“ → „In Bearbeitung“, solange der Fund noch offen ist; das hält ihn offen. Entscheiden darf, wer Wissen prüfen darf; mit einer schwächeren Rolle führt der Weg hierher nicht auf diese Fläche, sondern auf einen Hinweis, welche Rolle sie braucht.",
  // SCRUM-486 (Entdichtung): Führungszeile pro Karte + neutraler „entfernt"-Hinweis statt Roh-UUID.
  "board.koRemoved": "Objekt entfernt",
  "board.detailsShow": "Details ansehen",
  "con.leadKicker": "Widerspruch",
  "dup.leadKicker": "Überschneidung",
  // D-BIB (nacht24 Paket 5): dynamische Facetten + Untergruppen + gespeicherte Sichten (lokal).
  "lib.facet.category": "Abteilung/Kategorie",
  "lib.facet.language": "Sprache",
  "lib.facet.status": "Status",
  "lib.facet.author": "Autor",
  "lib.facet.age": "Alter",
  "lib.facet.trust": "Vertrauen",
  "lib.facet.maturity": "Reife",
  // AUFTRAG-mega45 Block H (SCRUM-425): Facetten-Schiene der Validierung.
  "val.facet.pruefstand": "Prüfstand",
  "lib.facet.origin": "Herkunft",
  "lib.facet.type": "Wissensart",
  "lib.facet.tag": "Schlagwort",
  "facet.active": "Aktive Filter",
  "facet.reset": "Alle zurücksetzen",
  "facet.remove": "{{label}} entfernen",
  "facet.result": "Treffer: {{shown}} von {{total}}",
  "facet.filtered": "gefiltert",
  "facet.more": "+{{n}} weitere",
  "facet.moreFilters": "Weitere Filter",
  "facet.noMatch": "keine Treffer (widersprüchliche gespeicherte Sicht)",
  "lib.facet.lang.de": "Deutsch",
  "lib.facet.lang.en": "Englisch",
  "lib.facet.lang.nl": "Niederländisch",
  "lib.facet.lang.other": "ohne Sprach-Kennzeichnung",
  "lib.facet.ageBucket.d30": "≤ 30 Tage",
  "lib.facet.ageBucket.d180": "≤ 180 Tage",
  "lib.facet.ageBucket.y1": "≤ 1 Jahr",
  "lib.facet.ageBucket.older": "älter als 1 Jahr",
  "lib.facet.ageBucket.unknown": "Alter unbekannt",
  "lib.facet.trustBucket.t0": "Vertrauen 0",
  "lib.facet.trustBucket.t1": "Vertrauen 1–39",
  "lib.facet.trustBucket.t40": "Vertrauen 40–69",
  "lib.facet.trustBucket.t70": "Vertrauen 70+",
  "lib.facet.more": "+{{n}} weitere",
  "lib.facet.none": "ohne Wert",
  // AUFTRAG-mega10 Block B: aus der Pillenwand wird eine Suchmaske (Schiene, Suche je
  // Dimension, aufmachbarer Deckel, klebender Zaehler, Bereichsfilter, Filterblatt).
  "facet.searchLabel": "In {{label}} suchen",
  "facet.searchPlaceholder": "{{label}} suchen …",
  "facet.searchNoHit": "Kein Wert passt zu „{{query}}“.",
  "facet.showAll": "Alle {{n}} zeigen",
  "facet.showLess": "Weniger zeigen",
  "facet.restricted": "nur Werte aus der gewählten Kategorie",
  // AUFTRAG-mega34 F: derselbe Knopf, derselbe Aufruf — die Variable wechselt für ALLE drei
  // Schlüssel auf `count`, sonst bliebe hier ein rohes {{n}} im Text stehen.
  "facet.showResults_one": "{{count}} Treffer anzeigen",
  "facet.showResults_other": "{{count}} Treffer anzeigen",
  "facet.countFiltered": "von {{total}} gefiltert",
  "facet.countAll": "gesamter Bestand",
  "facet.openFilters": "Filter",
  "facet.closeFilters": "Filter schließen",
  "facet.sheetTitle": "Filter",
  "facet.rangeLabel": "Zeitraum",
  "facet.rangeFrom": "von",
  "facet.rangeTo": "bis",
  "facet.rangeFromPill": "ab {{date}}",
  "facet.rangeToPill": "bis {{date}}",
  "facet.rangeContradictory":
    "Das Anfangsdatum liegt nach dem Enddatum — diese Kombination trifft nichts.",
  "lib.facet.confidentiality": "Vertraulichkeit",
  // AUFTRAG-mega34 F: beim Filtern landet man staendig bei 1 — „1 Beiträge anzeigen".
  "lib.facet.showResults_one": "{{count}} Beitrag anzeigen",
  "lib.facet.showResults_other": "{{count}} Beiträge anzeigen",
  "lib.facet.rangeLabel": "Zuletzt geändert",
  "lib.views.remember": "Diese Suche merken",
  // AUFTRAG-sortfilter · Punkt 1: Sortierung der Trefferliste.
  "lib.sort.label": "Sortieren",
  "lib.sort.relevance": "Relevanz",
  "lib.sort.title": "Titel A→Z",
  "lib.sort.trust": "Vertrauen (hoch→niedrig)",
  "lib.sort.recent": "Zuletzt geändert (neu→alt)",
  "lib.groupBy.label": "Untergruppen",
  "lib.groupBy.none": "keine",
  "lib.views.label": "Sichten",
  "lib.views.pick": "Gespeicherte Sicht laden …",
  "lib.views.namePlaceholder": "Name der Sicht",
  "lib.views.save": "Sicht speichern",
  "lib.views.remove": "Sicht löschen",
  "lib.views.storageHint":
    "Sichten bleiben nur in diesem Browser. {{ownership}} Sie werden nicht auf dem Server gespeichert und nicht auf andere Geräte oder Browser übertragen. Wer Browserdaten löscht, löscht auch die Sichten. Gespeichert: {{dimensions}}. Nicht gespeichert: Sortierung und Fenstergröße („Mehr laden“). Die Sortierung bleibt beim Aufrufen unverändert; die Fenstergröße beginnt neu.",
  "lib.views.ownershipSignedIn": "Sie gehören zu deiner aktuellen Anmeldung.",
  "lib.views.ownershipAnon":
    "Ohne Anmeldung gilt die Liste für alle, die diesen Browser ohne Anmeldung benutzen.",
  "lib.views.dimension.q": "Suchbegriff",
  "lib.views.dimension.facetSel": "Filterauswahl",
  "lib.views.dimension.range": "Zeitraum",
  "lib.views.dimension.groupBy": "Gruppierung",
  "lib.views.dimension.segment": "Segment",
  "lib.views.dimension.scope": "Bereich",
  "imp.select.deselectLang": "Alle {{lang}} abwählen · {{n}}",
  // SCRUM-486 (nacht24 Paket 3): EINE ruhige Befund-Darstellung — WAS, Erkennungsweg (ehrlich),
  // beide Seiten verlinkt, Gruppierung je Beitrag.
  "finding.kind.konflikt": "Konflikt",
  "finding.kind.duplikat": "Duplikat",
  "finding.kind.ueberschneidung": "Überschneidung",
  "finding.way.ki": "mit KI",
  "finding.way.deterministisch": "ohne KI (deterministisch)",
  "finding.way.manuell": "manuell angelegt",
  "finding.versus": "vs",
  "finding.groupKicker": "Beitrag",
  "finding.groupCount": "{{n}} Befund(e)",
  // FUNKE (nacht24 Paket 6): Wirkungs-Schleife — würdevoll, kein Punkte-Zirkus.
  "funke.sourceAuthor": "aus dem Wissen von {{name}}",
  "funke.impact.title": "Meine Wirkung",
  "funke.impact.contributions": "Meine Beiträge",
  "funke.impact.validated": "davon validiert",
  "funke.impact.cited": "in Antworten zitiert",
  "funke.impact.helpful": "als hilfreich markiert",
  "funke.impact.hint":
    "Ehrliche Zählung aus vorhandenen Belegen: „zitiert“ zählt die führende Antwort-Quelle — nichts wird geschätzt oder erfunden.",
  "funke.gaps.title": "Offene Wissenslücken",
  "funke.gaps.count": "{{n}} offen",
  "funke.gaps.answerCta": "In 2 Minuten beantworten",
  "funke.gaps.more": "+{{n}} weitere offene Lücken — vollständige Liste unter Risiko & Lücken.",
  "funke.capital.title": "Wissenskapital",
  // AUFTRAG-mega38 BLOCK E: die Zahl ist `kos.length` — der GESAMTBESTAND, jeder Status
  // (apps/web/src/lib/funke.ts:78). „39 gesicherte Wissensobjekte", von denen 30 offen sind, ist
  // deshalb keine Untertreibung, sondern eine falsche Aussage. EN und NL sagten mit „captured" /
  // „vastgelegde" schon das Richtige; nur DE benutzte das Qualitätswort für den Bestand.
  "funke.capital.secured": "erfasste Wissensobjekte",
  "funke.capital.validated": "davon validiert",
  // AUFTRAG-mega38 BLOCK G2: aus dem gestrichenen doppelten Kennzahlen-Block uebernommen.
  "funke.capital.open": "davon offen",
  "funke.capital.categories": "beantwortbare Themenfelder",
  "funke.capital.authors": "aktive Wissensträger",
  "funke.capital.gaps": "offene Wissenslücken",
  "funke.capital.hint": "Nur echte Zahlen aus dem Bestand — keine Schätzungen.",
  "lib.export": "Export",
  "lib.format.json": "JSON",
  "lib.format.markdown": "Text (Markdown)",
  "lib.format.mediawiki": "MediaWiki",
  "lib.format.html": "HTML (Druck/PDF)",
  // ==============================================================================================
  // JOB 1119 (D-002) — DAS SUCHFELD SAGT OHNE TIPPEN, WORIN ES SUCHT.
  // ==============================================================================================
  //
  // Bis hierher trug das Feld nur den Platzhalter „Volltextsuche …", und sein Label war `sr-only`.
  // „Volltextsuche" ist eine Auskunft über die TECHNIK, nicht über den Inhalt: sie sagt, WIE gesucht
  // wird, nicht WORIN. Das Label sagt jetzt sichtbar, was das Feld ist; der Platzhalter nennt die
  // Felder.
  //
  // DER SUCHRAUM IST GEMESSEN, NICHT GERATEN. Der Treffer-Vertrag prüft `search_text` (Titel,
  // Kernaussage, Fließtext, Bildbeschreibungen) ODER Kategorie ODER Schlagwort
  // (`services/knowledge-object/src/effective-search-document.ts:116-146`; der Postgres-Adapter
  // bildet dieselbe Regel als `COALESCE(md.tag_text,'') ILIKE …` in der WHERE-Bedingung ab,
  // `search-projection-repo-pg.ts:565-592`). SCHLAGWÖRTER WERDEN ALSO DURCHSUCHT — der
  // Katalogvorschlag „Schlagworte durchsucht dieses Feld nicht" stützte sich auf den Kommentar in
  // `search-projection.ts:614-620`, und der sagt nur, was nicht in `search_text` EINFLIESST.
  // Gemessen wird der Vertrag in `tests/app/library-search-truth-mounted.test.tsx`, Block E.
  //
  // `lib.scope.note` (unten, AUFTRAG-BASIC-u2) bleibt daneben stehen und sagt etwas anderes: WELCHER
  // BESTAND durchsucht wird. Feld und Bestand sind zwei Fragen; eine ersetzt die andere nicht.
  "lib.searchLabel": "Bibliothek durchsuchen",
  "lib.ownScope.label": "Geltungsbereich",
  "lib.ownScope.meine": "Meine Ablage",
  "lib.ownScope.alle": "Alle Inhalte",
  // JOB 3063 · H4 — die Fläche „Liste plus Lesefläche": Umschalter, Menüs, Listenzustände.
  // Beschriftungen, keine Erklärsätze (Pedi 04.09.: Erklärtext gehört hinter Menüs, nicht ins
  // Sichtfeld). Das Wort zum Zustand kommt unverändert aus `status.*` — keine zweite Vokabel.
  "lib.segment.label": "Zustand",
  "lib.segment.alle": "Alle",
  "lib.menue.weitere": "Weitere Aktionen",
  "lib.menue.bereich": "Bereich",
  "lib.menue.filter": "Filter",
  "lib.menue.sichten": "Sichten",
  "lib.menue.sichtSpeichern": "Sicht speichern",
  "lib.liste.eintraege_one": "{{count}} Eintrag",
  "lib.liste.eintraege_other": "{{count}} Einträge",
  "lib.liste.eintraegeUnbekannt": "–",
  "lib.liste.leer": "Noch keine Einträge.",
  "lib.liste.leerSuche": "Nichts gefunden.",
  "lib.liste.fehler": "Die Liste ließ sich nicht laden.",
  "lib.liste.erneut": "Erneut versuchen",
  "lib.liste.erfassen": "Erfassen",
  // JOB 3531 · Q6d — die Liste ohne Verbindung. Zwei Sätze, und beide sagen etwas über die
  // MASCHINE, nichts über den Bestand: offline wird gar nicht gerufen, also weiss niemand, ob es
  // Treffer gibt. Sie lösen an ihrer Stelle das Schweigen ab (`BibliothekListe.tsx`, Zweig
  // `pausiert`) — und im Fall des veralteten LEEREN Zwischenspeichers das falsche „Nichts
  // gefunden." (Codex R-1613, 1.0.0-beta.1.110). Kein Knopf dazu: der Abruf ist angehalten, nicht
  // gescheitert, und der zweite Satz sagt genau das (N-0036).
  //
  // NICHT `mob.offlineSearch`/`mob.offlineNeedsConn` mitbenutzt, obwohl sie nah klingen: die sind
  // die Sätze der MOBILEN Fläche („Offline – Suche braucht eine Verbindung.") und werden dort
  // gepinnt; ein geteilter Schlüssel bände zwei Flächen aneinander, deren Wortlaut niemand
  // gemeinsam entschieden hat.
  "lib.liste.offline": "Ohne Verbindung kann gerade nicht gesucht werden.",
  "lib.liste.offlineWeiter":
    "Sobald die Verbindung wieder steht, wird die Suche von selbst fortgesetzt.",
  // JOB 3335 · UX-21: der Schalter „Trefferliste" des Lese-Tablets (760–899 px). Die Beschriftung
  // nennt den ZUSTAND, den ein Klick herstellt — kein Symbol allein, kein Erklärsatz (H4).
  "lib.lesemodus.listeEinblenden": "Trefferliste einblenden",
  "lib.lesemodus.listeAusblenden": "Trefferliste ausblenden",
  "lib.lesen.mehr": "Mehr",
  "lib.lesen.bilder_one": "{{count}} Bild",
  "lib.lesen.bilder_other": "{{count}} Bilder",
  "lib.lesen.fehler": "Der Eintrag ließ sich nicht laden.",
  // JOB 3108 · UX-03: die Beschriftung der zwei Sprungknöpfe am Berichtskopf. Die Zahl steht IM
  // Knopf, und bei null steht dort „keine" — der Knopf verschwindet nicht, er führt zum ehrlichen
  // Leersatz (`ko.sourcesEmpty` / `ko.attachmentsEmpty`).
  "lib.lesen.sprung.quellen": "Quellen und Belege · {{count}}",
  "lib.lesen.sprung.quellenLeer": "Quellen und Belege · keine",
  "lib.lesen.sprung.anhaenge": "Anhänge · {{count}}",
  "lib.lesen.sprung.anhaengeLeer": "Anhänge · keine",
  // JOB 3474 · REVIEW26: die Originaldatei, die IM Bericht hängt (Body-Datei-Referenz aus dem
  // Dateiimport), steht jetzt am Kopf — und zwar mit NAMEN, nicht nur als Zahl: der Prüferbefund
  // verlangt „eindeutig benennen". Das Wort ist dasselbe, das der Dateiimport schon benutzt
  // (`capture.originalAttachFailed`: „Originaldatei"), damit für dieselbe Sache kein zweites
  // Vokabular entsteht. Trägt der Bericht keine, erscheint der Knopf NICHT — eine Leerfassung
  // „Originaldatei · keine" gäbe es hier bewusst nicht.
  "lib.lesen.sprung.originaldatei": "Originaldatei · {{name}}",
  "lib.lesen.sprung.originaldateien": "Originaldateien · {{count}}",
  "lib.lesen.sprung.originaldateienNamen": "Originaldateien · {{count}}: {{names}}",
  // Und der Anhangknopf daneben sagt dann nicht mehr unqualifiziert „keine": solange eine
  // Originaldatei im Text hängt, spricht er ENGER — über die WEITEREN Anhänge, die es wirklich
  // nicht gibt. Ohne Datei im Text bleibt `anhaengeLeer` unverändert stehen.
  "lib.lesen.sprung.anhaengeLeerNebenDatei": "Weitere Anhänge · keine",
  // JOB 4145 · WIKI-ORIENTIERUNG: der zugängliche Name der Gliederung in der Lesespalte — der
  // EINZIGE übersetzte Text dieser Leiste. Die Einträge selbst sind wörtlich die Überschriften des
  // Dokuments und werden nicht übersetzt. Einen Leersatz gibt es hier bewusst NICHT: ohne
  // Überschrift erscheint die Leiste gar nicht.
  "lib.lesen.gliederung.titel": "Gliederung des Dokuments",
  // ==============================================================================================
  // AUFTRAG-BASIC-u2 — DIE SUCHE SAGT, WORIN SIE SUCHT.
  // ==============================================================================================
  // Die Bibliothek durchsucht das für den Actor zugängliche Klarwerk-Wissen — NICHT die eigenen,
  // noch nicht eingereichten Entwürfe. Bis hierher stand über dem breiten Suchfeld nichts davon,
  // und der Nulltreffer sagte „Keine Treffer" — ein Satz, der wie „das gibt es nirgends" klingt,
  // während der gesuchte Entwurf auf /erfassen liegt. Der Suchraum wird jetzt genannt, und die
  // andere Suchwelt bekommt einen Namen und einen Weg. An Query, Filterung und Ranking ändert das
  // nichts: es ist eine AUSKUNFT über den Bestand, keine neue Regel über ihn.
  "lib.allStatus": "Alle Status",
  "lib.allTypes": "Alle Wissensarten",
  "lib.allCategories": "Alle Kategorien",
  "lib.allTags": "Alle Tags",
  "lib.revalidate": "Re-Validierung starten",
  "lib.ask": "Fragen",
  "lib.review": "Prüfen",
  "lib.revalidateDone": "Re-Validierung gestartet.",
  "lib.reimport": "Re-Import (JSON)",
  // AUFTRAG-BASIC-u2: der Nulltreffer nennt den SUCHRAUM. „Keine Treffer." behauptete durch
  // Weglassen, es gebe nichts — hier steht jetzt, worin nichts gefunden wurde und wo das Fehlende
  // sonst noch liegen kann.
  // JOB 1119 (D-002): der Nulltreffer nennt jetzt auch die FELDER. Der Nutzer, der nichts findet,
  // hat genau eine Frage — „wo hat es denn überhaupt gesucht?" —, und der Tipp „anders formulieren"
  // beantwortete sie nicht. Die Aufzählung ist der gemessene Suchraum (s. `lib.search` oben), nicht
  // eine Vermutung darüber.
  // AUFTRAG-mega59 BLOCK D: der stumme Nullzustand. Die Suche hat Treffer, die aktiven Facetten
  // zeigen keinen davon — bis hierher rendert die Bibliothek dafür eine leere Karte ganz ohne Text
  // (bei aktiver Gruppierung ein leeres div). Der Text nennt den GRUND, nicht nur die Zahl.
  "lib.matchIn": "Treffer in",
  "lib.match.title": "Titel",
  // JOB 1119 (D-002): „Schlagwort", wie die Facette daneben (`lib.facet.tag`). Abzeichen und
  // Facette bezeichnen DASSELBE Feld; zwei Wörter dafür auf einer Seite sind für den Leser zwei
  // Dinge. Im englischen Block bleibt „Tag" stehen — dort ist es das richtige Wort.
  "lib.match.tag": "Schlagwort",
  "lib.match.category": "Kategorie",
  "lib.match.type": "Wissensart",
  "lib.match.text": "Text",
  "lib.match.caption": "Bildbeschreibung",
  "lib.maturity.all": "Alle",
  // SCRUM-309: Herkunftsfilter (ergänzend zu Reife/Suche; Herkunft, keine Qualitätsaussage).
  "lib.originLabel": "Herkunft",
  "lib.demoFilter.all": "Alle Herkünfte",
  "lib.demoFilter.demo": "Demo-Beispiele",
  "lib.demoFilter.nonDemo": "Eigenes Wissen",
  "lib.maturity.usable": "Nutzbar",
  "lib.maturity.review": "In Prüfung",
  "lib.maturity.open": "Zu prüfen",
  "lib.resultCount": "Treffer: {{n}}",
  "imp.explore.title": "Quelle erkunden",
  "imp.explore.hint":
    "Sieh dir zuerst an, was in der Quelle steckt — Mengen, Autoren, Themen und Zeitraum. Es wird nichts importiert.",
  "imp.explore.active": "aktiv",
  "imp.explore.soon": "bald",
  "imp.explore.cta": "Weiter: Erkunden",
  "imp.explore.exploring": "Erkunde …",
  "imp.explore.pages": "Seiten",
  "imp.explore.sources": "Quellen",
  "imp.explore.period": "Zeitraum",
  "imp.explore.authors": "Autoren",
  "imp.explore.themes": "Themen",
  "imp.explore.more": "+{{n}} weitere",
  "imp.explore.withImages": "{{n}} Seiten enthalten Bilder.",
  "imp.explore.noAuthor": "(ohne Autor)",
  "imp.explore.noTheme": "(ohne Thema)",
  "imp.explore.empty": "In dieser Quelle wurde nichts gefunden.",
  "imp.explore.truncated": "Nur die ersten {{n}} Seiten gezählt — die Quelle ist größer.",
  "imp.explore.abbruch.timeout":
    "Ergebnis unvollständig: Confluence hat nicht rechtzeitig geantwortet (Zeitüberschreitung). {{n}} Seiten wurden bis dahin gelesen.",
  "imp.explore.abbruch.zu_gross":
    "Ergebnis unvollständig: Eine Antwort von Confluence war zu groß und wurde verworfen. {{n}} Seiten wurden bis dahin gelesen.",
  "imp.explore.abbruch.zeitbudget":
    "Ergebnis unvollständig: Die Lesezeit für den Space war erschöpft. {{n}} Seiten wurden bis dahin gelesen.",
  "imp.explore.failedPages": "{{n}} Seiten konnten nicht gelesen werden.",
  "imp.explore.topOf": "Top {{n}} von {{total}}",
  // WP-IC-PAKET-1 (Teil 2): Herkunfts-Kennzeichnung abgeleiteter Themen (deterministisch aus Titeln).
  "imp.explore.derivedTag": "abgeleitet",
  "imp.explore.derivedHint":
    "Thema deterministisch aus den Seitentiteln abgeleitet — die Quelle hat für diese Seiten keine Labels.",
  // WP-IC-PAKET-1 (Teil 3/4): Space-Filter + ehrlicher Import-Status der Erkundung.
  "imp.explore.spaces": "Bereiche (Spaces)",
  "imp.explore.alreadyImported": "Davon bereits importiert: {{n}}",
  "imp.explore.alreadyQueued": "Davon bereits zur Prüfung vorgemerkt: {{n}}",
  // ================================================================================================
  // AUFTRAG-mega67 BLOCK C+D — DER ZUGANGS-ZUSTAND. VIER ZUSTÄNDE, VIER EIGENE TEXTE.
  // ================================================================================================
  // Kein Text behauptet mehr, als ohne einen Aufruf an Confluence ablesbar ist. Insbesondere sagt
  // „ready" NICHT „verbunden" (das wüsste nur ein echter Aufruf) und „disabled" NICHT
  // „vorübergehend nicht verfügbar" (ausgeschaltet heißt hier: die Route existiert nicht).
  "imp.access.title": "Zugang",
  "imp.access.ready.title": "Eingeschaltet, Zugangsdaten hinterlegt",
  "imp.access.ready.body":
    "Der Import ist für diese Installation eingeschaltet, und alle nötigen Zugangsdaten stehen auf dem Server. Ob sie auch gültig sind, zeigt sich beim ersten Import — das lässt sich von hier aus nicht prüfen, ohne Confluence anzurufen.",
  "imp.access.noCredentials.title": "Eingeschaltet, aber ohne Zugangsdaten",
  "imp.access.noCredentials.body":
    "Der Import ist eingeschaltet, aber es fehlt noch etwas. Solange das so ist, kann kein Import starten.",
  "imp.access.disabled.title": "In dieser Installation nicht eingeschaltet",
  "imp.access.disabled.body":
    "Der Confluence-Import ist hier nicht eingeschaltet. Er wird auf dem Server freigeschaltet; von der Oberfläche aus lässt er sich nicht umlegen.",
  // mega69 B3: „notBuilt" ist mit dem unerreichbaren vierten Zustand entfernt (bens Auflage 3).
  "imp.access.blocker.missing": "Es fehlt mindestens eine der nötigen Angaben.",
  "imp.access.blocker.insecureBaseUrl":
    "Alle Angaben stehen, aber die Adresse ist keine https-Adresse. Zugangsdaten werden nur über verschlüsselte Verbindungen gesendet — deshalb kommt kein Zugang zustande.",
  // Block C: die Variablen BENANNT, mit Ja/Nein — nie ein Wert und nie eine Maske mit Länge (eine
  // Maske verriete die Länge). Es gibt hier bewusst KEIN Eingabefeld.
  "imp.access.varsTitle": "Was dieses System braucht",
  "imp.access.varPresent": "hinterlegt",
  "imp.access.varMissing": "nicht hinterlegt",
  "imp.access.whereSet":
    "Diese Werte werden als Umgebungsvariablen auf dem Server gesetzt — nicht hier. Klarwerk zeigt nur, ob sie stehen, nie ihren Inhalt.",
  "imp.access.whoMay": "Ändern kann das, wer Zugang zum Server dieser Installation hat.",
  // R-0134 / R-1005: der Betreiberschalter — eigener Zustand, eigener Knopf, eigene Fehler.
  "imp.access.switchedOff.title": "Vom Betreiber ausgeschaltet",
  "imp.access.switchedOff.body":
    "Der Confluence-Import ist in dieser Installation freigegeben, aber ausgeschaltet. Solange das so ist, lehnt der Server jeden Import ab. Einschalten lässt er sich mit dem Knopf darunter.",
  "imp.access.schalter.an": "Import einschalten",
  "imp.access.schalter.aus": "Import ausschalten",
  "imp.access.schalter.hinweis":
    "Wirkt sofort und ohne Neustart. Zugangsdaten werden hier nicht eingegeben.",
  "imp.access.schalter.nichtFreigegeben":
    "Der Import ist in dieser Installation nicht freigegeben — der Schalter wirkt erst nach der Freigabe auf dem Server.",
  "imp.access.schalter.fehler":
    "Der Schalter konnte nicht umgelegt werden. Bitte erneut versuchen.",
  // JOB-924 D6: Der frühere Satz („wird nicht festgehalten") ist überholt — es WIRD festgehalten,
  // es gibt nur noch keinen erfolgreichen Lauf. Beide Sätze sind ausdrücklich rückblickend: der
  // Zeitpunkt sagt, dass es damals ging, nicht dass es jetzt geht. Das wüsste nur ein Aufruf, und
  // den macht diese Fläche nicht.
  // Die Wortwahl „ist bisher nicht festgehalten" statt „wird nicht festgehalten" ist der ganze
  // Unterschied: Der Ort EXISTIERT, es steht nur noch nichts darin. `mega67-zugang-flaeche-mounted`
  // pinnt „nicht festgehalten" als Beleg, dass der Unbekannt-Fall BENANNT wird statt zu schweigen —
  // dieser Vertrag bleibt gültig, nur die Behauptung dahinter wird wahr.
  "imp.access.lastConnectedUnknown":
    "Ein erfolgreich abgeschlossener Import ist bisher nicht festgehalten.",
  "imp.access.lastConnected":
    "Zuletzt erfolgreich abgeschlossener Import: {{date}}. Ob es jetzt funktioniert, sagt dieser Rückblick nicht.",
  // ================================================================================================
  // JOB 4086 — SHAREPOINT/ONEDRIVE. DER WEG, UND VIER SÄTZE FÜR DIE VIER FEHLERLAGEN.
  // ================================================================================================
  // Die vier Fehlersätze tragen KEINE Zahl und KEIN Serverwort — kein „503", kein Kürzel, keine
  // englische Durchreiche. Jeder sagt, WAS IST und WAS DER MENSCH TUN KANN, und keiner sagt
  // dasselbe wie ein anderer (das hält `tests/sharepoint-onedrive-import/` fest).
  "imp.sharepoint.titel": "SharePoint / OneDrive",
  "imp.sharepoint.was":
    "Wähle eine Datei aus der angebundenen Bibliothek. Klarwerk holt sie und stellt sie in die Prüfung unten — mit ihrem Namen, ihrer Originaladresse und ihrem Stand.",
  "imp.sharepoint.ohneInhalt":
    "Der Inhalt der Datei wird dabei nicht gelesen. Übernommen werden Name, Adresse und Stand der Quelle; wer den Text braucht, öffnet die Datei über ihre Adresse.",
  "imp.sharepoint.listeTitel": "Dateien, die du sehen darfst",
  "imp.sharepoint.neuLaden": "Liste neu laden",
  "imp.sharepoint.laedt": "Die Dateien werden geladen …",
  "imp.sharepoint.nichtFrisch":
    "Diese Liste ist der Stand von vorhin — sie wird gerade aufgefrischt.",
  "imp.sharepoint.leer": "In dieser Bibliothek liegt gerade keine Datei, die du sehen darfst.",
  "imp.sharepoint.gedeckelt":
    "Es gibt mehr Dateien, als hier stehen — diese Liste ist gekürzt. Grenze die Bibliothek ein, wenn die gesuchte fehlt.",
  "imp.sharepoint.stand": "Stand {{zeit}}",
  "imp.sharepoint.uebernehmen": "Ausgewählte Dateien importieren",
  "imp.sharepoint.uebernahmeLaeuft": "Wird geholt …",
  "imp.sharepoint.ergebnisTitel": "Aus SharePoint geholt",
  "imp.sharepoint.quelleOeffnen": "Quelle öffnen",
  "imp.sharepoint.schonVorgemerkt": "Stand in diesem Stand schon in der Prüfung: {{n}}.",
  "imp.sharepoint.verschwunden": "In SharePoint nicht mehr vorhanden: {{n}}.",
  "imp.sharepoint.gescheitert": "Nicht übernommen: {{n}}.",
  // JOB 4125 — der zweite Weg durch dieselbe Tür. Drei Sätze, die es vorher nicht gab: „nichts
  // Neues" ist eine Aussage statt einer Leerstelle, „neuerer Stand" unterscheidet den zweiten
  // Import einer GEÄNDERTEN Datei vom Erstimport, und der erneute Versuch ist der Weg zurück, wenn
  // die Zugangsauskunft scheitert.
  "imp.sharepoint.nichtsNeu": "Aus dieser Auswahl wurde nichts Neues übernommen.",
  "imp.sharepoint.neuerStand":
    "Neuerer Stand der Quelle: {{n}}. Der ältere Vorgang steht noch in der Prüfung — nimm den neueren an.",
  // JOB 4232 — INHALT ODER NUR MERKMALE. Zehn Sätze, additiv: die REGEL vor dem Import, die
  // VORSCHAU je Zeile (vor der Annahme), das ERGEBNIS je übernommener Datei (danach) und die drei
  // Gründe, aus denen eine gewählte Datei NICHT übernommen wurde. Kein Satz nennt eine Zahl, einen
  // Statuscode oder ein Serverwort — derselbe Vertrag wie bei den vier Fehlerlagen darunter.
  "imp.sharepoint.inhaltRegel":
    "Bei reinen Textdateien (.txt) holt Klarwerk den Text mit. Bei jedem anderen Dateityp werden nur Name, Adresse und Stand übernommen — wer dann den Text braucht, öffnet die Datei über ihre Adresse. Was für welche Datei gilt, steht in der Liste.",
  // JOB 4232 RUNDE 2 — ANKÜNDIGUNG, MESSUNG, MESSWERT. `vorschau.text` („Inhalt kommt mit") ist ab
  // dieser Runde eine ZUSAGE und fällt nur nach einem wirklich gefahrenen Inhaltsabruf; solange nur
  // die Merkmale vorliegen, steht `vorschau.textdatei` da — eine Ankündigung, die nichts verspricht.
  // JOB 4232 R3: Der Übernahmeknopf bleibt zu, solange keine gültige Messung vorliegt. Ein
  // gesperrter Knopf ohne Grund wäre eine Sackgasse — diese zwei Sätze sind der Grund.
  "imp.sharepoint.pruefungLaeuft":
    "Der Inhalt der gewählten Dateien wird gerade geprüft. Die Übernahme wartet darauf — so wird nichts auf einer Grundlage übernommen, die noch niemand kennt.",
  "imp.sharepoint.pruefungFehlt":
    "Zu mindestens einer gewählten Datei liegt kein Prüfergebnis vor. Solange das so ist, wird nichts übernommen. Lade die Liste neu oder wähle eine andere Datei.",
  "imp.sharepoint.vorschau.textdatei": "Textdatei — Inhalt wird vor dem Import geprüft",
  "imp.sharepoint.vorschau.laeuft": "Inhalt wird geprüft …",
  "imp.sharepoint.vorschau.unlesbar": "nicht als Text lesbar",
  "imp.sharepoint.vorschau.text": "Inhalt kommt mit",
  "imp.sharepoint.vorschau.leer": "leer",
  "imp.sharepoint.vorschau.nurMerkmale": "nur Merkmale",
  "imp.sharepoint.vorschau.zuGross": "zu groß für den Inhalt",
  "imp.sharepoint.uebernommen.text": "mit Inhalt",
  "imp.sharepoint.uebernommen.nurMerkmale": "nur Merkmale, kein Volltext",
  "imp.sharepoint.nichtUebernommen.leer":
    "Diese Datei ist leer — es gibt nichts zu übernehmen, also wurde nichts angelegt.",
  "imp.sharepoint.nichtUebernommen.zuGross":
    "Diese Datei ist zu groß für einen Wissenseintrag. Sie wurde nicht übernommen; teile sie auf oder öffne sie über ihre Adresse.",
  "imp.sharepoint.nichtUebernommen.unlesbar":
    "Der Inhalt dieser Datei ließ sich nicht als Text lesen. Sie wurde nicht übernommen — ein halber Text wäre schlimmer als keiner.",
  "imp.sharepoint.zugangErneut": "Zugang neu abfragen",
  "imp.sharepoint.weiterInDerPruefung":
    "Die Dateien liegen jetzt in der Prüfung weiter unten. Erst wenn ein Mensch sie dort annimmt, entsteht daraus ein Wissensobjekt.",
  "imp.sharepoint.zugang.ready.titel": "Eingeschaltet, Zugangsdaten hinterlegt",
  "imp.sharepoint.zugang.ready.text":
    "Der SharePoint-Import ist für diese Installation eingeschaltet, und alle nötigen Zugangsdaten stehen auf dem Server. Ob sie auch gültig sind, zeigt sich beim ersten Abruf — das lässt sich von hier aus nicht prüfen, ohne SharePoint anzurufen.",
  "imp.sharepoint.zugang.ohneDaten.titel": "Eingeschaltet, aber ohne Zugangsdaten",
  "imp.sharepoint.zugang.ohneDaten.text":
    "Der SharePoint-Import ist eingeschaltet, aber es fehlt noch etwas. Solange das so ist, kann keine Datei geholt werden.",
  "imp.sharepoint.zugang.aus.titel": "In dieser Installation nicht eingeschaltet",
  "imp.sharepoint.zugang.aus.text":
    "Der SharePoint-Import ist hier nicht eingeschaltet. Er wird auf dem Server freigeschaltet; von der Oberfläche aus lässt er sich nicht umlegen.",
  "imp.sharepoint.fehler.nichtEingerichtet":
    "Die Verbindung zu SharePoint ist in dieser Installation nicht eingerichtet. Wer Zugang zum Rechner dieser Installation hat, kann sie dort hinterlegen.",
  "imp.sharepoint.fehler.keineBerechtigung":
    "Das hinterlegte Konto darf diese Datei oder Bibliothek nicht lesen. Lass die Freigabe in SharePoint prüfen oder wähle eine andere Datei.",
  "imp.sharepoint.fehler.nichtVorhanden":
    "Diese Datei gibt es in SharePoint nicht mehr. Lade die Liste neu und wähle eine Datei, die noch da ist.",
  "imp.sharepoint.fehler.verbindungWeg":
    "Die Verbindung zu SharePoint gilt nicht mehr — sie ist abgelaufen oder gerade nicht erreichbar. Versuche es später noch einmal; erneuern kann sie, wer Zugang zum Rechner dieser Installation hat.",
  // AUFTRAG-ic7-import-vision: EHRLICHE Quellen-Galerie „wo die Reise hingeht".
  "imp.gallery.planned": "geplant",
  // AUFTRAG-mega32 BLOCK G: EINE aufklappbare Zeile mit ANZAHL. Standard zugeklappt; aufgeklappt
  // verhalten sich die Kacheln genau wie heute (kein Import, nur der ehrliche Hinweis).
  "imp.gallery.plannedGroup": "In Planung ({{count}})",
  "imp.gallery.systemsTitle": "Systeme",
  "imp.gallery.filesTitle": "Dateien",
  "imp.gallery.hintSoon": "In Arbeit — diese Quelle kommt bald.",
  "imp.gallery.hintPlanned": "Geplant — kommt später.",
  // AUFTRAG-mega15 Block D (SCRUM-382): „vorhanden, aber kein Dienst hinterlegt" ist etwas anderes
  // als „geplant". Die Kachel sagt jetzt, was zutrifft.
  "imp.gallery.unconfigured": "nicht konfiguriert",
  "imp.gallery.hintUnconfigured":
    "Vorhanden, aber nicht nutzbar: für die Transkription ist kein Dienst hinterlegt. Ein Administrator kann ihn in der Verwaltung einrichten.",
  // JOB 3190 (UX-18): „bald" war für Word und PDF schlicht falsch — dieselbe Datei wird im Erfassen
  // längst eingelesen. Der Text sagt beides: dass es die Funktion GIBT und WO sie liegt.
  "imp.gallery.elsewhere": "im Erfassen",
  // JOB 3341 (UX-18-R1): Der Satz nennt weiterhin den ORT — die Kachel führt dorthin, sie führt den
  // Import nicht hier aus. Die zwei Restschritte („unter Datei → Datei importieren") sind daraus
  // gestrichen, weil es sie nicht mehr gibt: die Kachel öffnet die Dateiauswahl in einem Schritt.
  // Der Schlüssel `imp.gallery.elsewhereSteps` ist mit derselben Begründung ganz entfallen.
  "imp.gallery.hintElsewhere":
    "Dieses Format wird bereits eingelesen — nicht auf dieser Seite, sondern im Erfassen. Diese Seite selbst importiert nur JSON.",
  "imp.gallery.src.confluence": "Confluence",
  "imp.gallery.src.jsonImport": "JSON-Import",
  "imp.gallery.src.jira": "Jira",
  // JOB 3235 (UX-18-R2): Diese zwei Kacheln stehen in der Gruppe „Systeme" und hiessen „Word-Datei"
  // bzw. „PDF-Datei" — also nach einer DATEI, direkt ueber der Dateikachel desselben Formats. Sie
  // meinen aber die ANBINDUNG an eine Dokumentquelle (Konnektor wie Confluence), und die gibt es
  // gemessen nicht (siehe Kopfkommentar bei SYSTEM_SOURCES in `lib/importSourceGallery.ts`). Der
  // Name sagt das jetzt; die alten Schluessel `src.wordFile`/`src.pdfFile` sind entfernt.
  "imp.gallery.src.wordSource": "Word-Dokumentquelle (Anbindung)",
  "imp.gallery.src.pdfSource": "PDF-Dokumentquelle (Anbindung)",
  "imp.gallery.src.sharepoint": "SharePoint",
  "imp.gallery.src.teams": "MS Teams",
  "imp.gallery.src.gdrive": "Google Drive",
  "imp.gallery.src.dms": "DMS",
  "imp.gallery.src.plm": "PLM",
  "imp.gallery.src.servicenow": "ServiceNow",
  "imp.gallery.src.sap": "SAP",
  "imp.gallery.src.notion": "Notion",
  "imp.gallery.src.slack": "Slack",
  "imp.gallery.src.email": "E-Mail",
  "imp.gallery.file.json": "JSON",
  // JOB 3235: „Word (.docx)" und „PDF" standen unter „Word-Datei"/„PDF-Datei" aus der Systemgruppe.
  // Jetzt tragen beide Gruppen dieselbe Regel im NAMEN: hier „Datei", dort „Anbindung".
  "imp.gallery.file.docx": "Word-Datei (.docx)",
  "imp.gallery.file.pdf": "PDF-Datei (.pdf)",
  "imp.gallery.file.xlsx": "Excel (.xlsx)",
  "imp.gallery.file.pptx": "PowerPoint (.pptx)",
  "imp.gallery.file.csv": "Text/CSV",
  "imp.gallery.file.ocr": "OCR (Scan/Bild)",
  "imp.gallery.file.avtranscript": "Audio-/Video-Transkript",
  "imp.select.title": "Auswahl eingrenzen",
  "imp.select.hint":
    "Klicke Themen an ODER beschreibe in einem Satz, was importiert werden soll — beides zusammen geht auch. Die Vorschau zeigt, was passt — importiert wird noch nichts.",
  "imp.select.promptPlaceholder": "z. B. „alles zum Thema Wartung und Fehlercodes“",
  // WP-VIP2-GATE-2 (bens Fix 1): Pflicht-Eigeneinstufung des Auswahl-Satzes (Vorgabe: Ja/unsicher).
  "imp.select.promptConfidentialLabel": "Enthält dieser Text Vertrauliches?",
  "imp.select.promptConfidentialYes": "Ja/unsicher",
  "imp.select.promptConfidentialNo": "Nein, unbedenklich",
  "imp.select.limit": "Höchstens",
  "imp.select.previewCta": "Weiter: Eingrenzen",
  "imp.select.previewing": "Werte aus …",
  "imp.select.matched": "{{matched}} von {{total}} Treffern",
  "imp.select.limitedNote": "auf das Limit gedeckelt",
  "imp.select.critAll": "Keine Eingrenzung — alles würde passen.",
  "imp.select.critThemes": "Themen",
  "imp.select.critAuthors": "Autoren",
  "imp.select.critKeywords": "Stichworte",
  "imp.select.critYears": "Jahre",
  "imp.select.critLimit": "Limit",
  "imp.select.critSpaces": "Bereiche",
  // JOB 3356 (IMPORT-FREITEXT-TITEL): der Titelweg, wenn die KI-Deutung des Satzes 0 Treffer hat.
  "imp.select.critTitle": "Titel enthält",
  "imp.select.titleFallbackInterpreted":
    "So hat die KI deinen Satz gedeutet (Kriterien oben) — dazu passt keine der geladenen Seiten.",
  "imp.select.titleFallbackFound_one": "1 Seite trägt „{{query}}“ im Titel.",
  "imp.select.titleFallbackFound_other": "{{count}} Seiten tragen „{{query}}“ im Titel.",
  // Runde 2: die Angaben gehören zum vorherigen Lauf — sichtbar zugeordnet statt still veraltet.
  "imp.select.titleFallbackStale": "Ergebnis für: „{{query}}“.",
  "imp.select.titleFallbackStalePending":
    "Die neue Vorschau läuft noch — die Angaben unten stammen vom vorherigen Lauf.",
  "imp.select.titleFallbackStaleError":
    "Die neue Vorschau ist fehlgeschlagen — die Angaben unten stammen vom vorherigen Lauf.",
  "imp.select.titleFallbackStaleChanged":
    "Der Satz im Feld ist inzwischen ein anderer — die Angaben unten stammen vom vorherigen Lauf.",
  "imp.select.titleFallbackNone":
    "Auch im Titel steht „{{query}}“ auf keiner der geladenen Seiten.",
  "imp.select.titleFallbackCta_one": "Diese 1 Seite zeigen",
  "imp.select.titleFallbackCta_other": "Diese {{count}} Seiten zeigen",
  "imp.select.yearFrom": "von (Jahr)",
  "imp.select.yearTo": "bis (Jahr)",
  // WP-IC-PAKET-1 (Teil 4, IC-6a): Import-Status + Auswahl in der Vorschau.
  "imp.select.alreadyImported": "{{n}} bereits importiert",
  // WP-SHIP9-S1b (bens GELB): eigener Zustand — offener Kandidat ist nur vorgemerkt, nicht importiert.
  "imp.select.alreadyQueued": "{{n}} bereits zur Prüfung vorgemerkt",
  "imp.select.selectedCount": "{{n}} angewählt",
  "imp.select.importedDeselected":
    "Bereits importierte Seiten sind abgewählt; bei Bedarf bewusst wieder anwählen.",
  "imp.select.queuedDeselected":
    "Bereits zur Prüfung vorgemerkte Seiten sind abgewählt; bei Bedarf bewusst wieder anwählen.",
  // WP-SHIP9-S2 Paket 2 (D2–D7): Steuerung der Trefferliste.
  "imp.select.searchPlaceholder": "In den Treffern suchen (Titel, Autor) …",
  "imp.select.selectAll": "Alle wählen",
  "imp.select.deselectAll": "Alle abwählen",
  "imp.select.groupBy": "Gruppieren:",
  "imp.select.groupNone": "keine",
  "imp.select.groupTheme": "nach Thema",
  "imp.select.groupLanguage": "nach Sprache",
  // AUFTRAG-mega27 A4: die ECHTE Quell-Ordnerstruktur (Elternkette) statt einer Ableitung.
  "imp.select.groupFolder": "nach Ordner",
  "imp.select.noFolder": "Ohne Quell-Container",
  "imp.select.folderFallbackNoPath":
    "Diese Quelle liefert keine Ordnerstruktur (keine Elternkette) — gezeigt wird die bisherige Ansicht.",
  "imp.select.folderFallbackSingle":
    "Die Quell-Struktur ergibt hier nur einen einzigen Ordner — gezeigt wird die bisherige Ansicht.",
  // AUFTRAG-mega27 Block B: die Trefferliste filtert mit derselben Facetten-Technik wie die Bibliothek.
  "imp.select.facet.folder": "Ordner",
  "imp.select.facet.status": "Status",
  "imp.select.facet.theme": "Thema",
  "imp.select.facet.author": "Autor",
  "imp.select.facet.language": "Sprache",
  "imp.select.facetCount_one": "{{count}} Treffer anzeigen",
  "imp.select.facetCount_other": "{{count}} Treffer anzeigen",
  "imp.select.rangeLabel": "Quell-Datum",
  "imp.select.bulkLabel": "Auswahl",
  "imp.select.groupCount": "{{n}} Treffer",
  "imp.select.langDe": "Deutsch",
  "imp.select.langEn": "Englisch",
  "imp.select.langNl": "Niederländisch",
  "imp.select.langOther": "Ohne Sprachkennzeichen",
  "imp.select.noTheme": "Ohne Thema",
  "imp.select.chipNew": "Neu",
  "imp.select.chipImported": "Bereits importiert",
  "imp.select.chipQueued": "Vorgemerkt",
  "imp.select.summary": "{{selected}} von {{total}} gewählt",
  "imp.select.emptyFiltered": "Kein Treffer für Suche/Filter — Suche oder Filter anpassen.",
  "imp.preview.imported": "bereits importiert",
  "imp.preview.queued": "bereits zur Prüfung vorgemerkt",
  "imp.groups.cta": "Weiter: Gruppieren & Übernehmen",
  "imp.groups.needSelection":
    "Wählen Sie in der Vorschau mindestens einen Eintrag aus, um fortzufahren.",
  "imp.groups.grouping": "Die Beiträge werden thematisch gruppiert …",
  "imp.groups.retry": "Erneut versuchen",
  "imp.groups.willGroupWithoutAi":
    "Kein KI-Modell aktiv — es wird ohne KI nach Themen gruppiert (deterministisch).",
  "imp.groups.noAi": "Ohne KI gruppiert",
  "imp.groups.noAiReason": "Ohne KI gruppiert — {{reason}}",
  "imp.groups.reason.confidential": "vertrauliche Kandidaten — Cloud-KI ausgeschlossen",
  // AUFTRAG-mega59 BLOCK F1: die drei bis hierher stummen Gründe. Ein nacktes „Ohne KI gruppiert"
  // ist für den Nutzer nicht von einem Fehler unterscheidbar — und die vier Gründe verlangen
  // verschiedene Reaktionen (Konfiguration, Geduld, Meldung, keine).
  "imp.groups.reason.noModel": "kein KI-Modell aktiv",
  "imp.groups.reason.timeout": "das KI-Modell hat nicht rechtzeitig geantwortet",
  "imp.groups.reason.error": "das KI-Modell hat einen Fehler gemeldet",
  // AUFTRAG-mega59 BLOCK F2: Vorwarnung bei vertraulichem Stapel — auch bei AKTIVEM Reasoner.
  "imp.groups.willGroupWithoutAiConfidential":
    "Dieser Stapel enthält vertrauliche oder nicht freigegebene Einträge — es wird ohne Cloud-KI nach Themen gruppiert (deterministisch).",
  "imp.groups.aiGrouped": "KI-gruppiert",
  "imp.groups.groupCount": "{{n}} Beiträge",
  "imp.groups.approve": "Freigeben",
  "imp.groups.exclude": "Ausschließen",
  "imp.groups.selectedCount": "{{x}} von {{y}} ausgewählt",
  "imp.groups.catchall": "Weitere Beiträge",
  "imp.groups.noTheme": "Ohne Thema",
  "imp.groups.hintImported": "bereits importiert",
  "imp.groups.hintQueued": "bereits zur Prüfung vorgemerkt",
  "imp.groups.hintStale": "älter als 1 Jahr",
  "imp.groups.hintShort": "wenig Inhalt",
  "imp.groups.applyCta": "Auswahl übernehmen ({{n}})",
  "imp.groups.applying": "Übernehme {{x}} von {{y}} …",
  "imp.groups.bilanzTitle": "Ergebnis der Übernahme",
  "imp.groups.bilanzImported": "{{n}} übernommen",
  "imp.groups.bilanzSkipped": "{{n}} übersprungen (bereits importiert)",
  "imp.groups.bilanzSkippedQueued": "{{n}} übersprungen (bereits zur Prüfung vorgemerkt)",
  "imp.groups.bilanzExcluded": "{{n}} ausgeschlossen",
  "imp.groups.bilanzFailed": "{{n}} fehlgeschlagen",
  "imp.groups.bilanzReview":
    "Die übernommenen Beiträge liegen jetzt im Import-Review — dort entscheidet ein Mensch über jede Übernahme ins Wissen.",
  "imp.groups.toReview": "Weiter zum Import-Review ({{n}} offen)",
  "imp.groups.failNotFound": "nicht mehr in der aktuellen Auswahl",
  "imp.groups.bilanzQueued": "{{n}} bereits eingereiht (war schon im Review)",
  "imp.groups.bilanzNotAttempted": "{{n}} nicht versucht (Lauf nach Fehler abgebrochen)",
  "imp.groups.retryRest": "Rest übernehmen ({{n}})",
  "imp.groups.failHttp": "Übertragung fehlgeschlagen",
  "imp.groups.hintSourceNewer": "Quelle aktualisiert seit Import",
  "imp.groups.bilanzUpdates": "davon Aktualisierungen: {{n}}",
  "imp.groups.expired":
    "Die Datengrundlage der Gruppierung ist inzwischen abgelaufen — die Übernahme wurde gestoppt und die Auswahl zurückgesetzt. Bitte neu gruppieren.",
  "imp.groups.regroup": "Neu gruppieren",
  // AUFTRAG-mega9 Block E-4 (KW-E2E-008): ehrlicher Name nach einer Auswahländerung.
  "imp.groups.refreshGrouping": "Gruppierung aktualisieren",
  // JOB 3357 (Codex-Livebefund 311b601a auf 1.201): „Eine konkrete Laufkennung wird weiterhin nicht
  // sichtbar angeboten." Der Server führt den Lauf und schickt seine Kennung mit; die Bilanz nennt
  // sie ab jetzt, samt Ausgang aus der Laufakte. Der Ausgang selbst spricht das Vokabular der
  // Lauf-Kachel (`w2.run.*`) — dieselbe Sache, dieselben Worte.
  "imp.groups.runHeading": "Lauf dieser Übernahme",
  "imp.groups.runIdLabel": "Lauf-Kennung",
  "imp.groups.runCall": "Aufruf {{n}}",
  // Ehrlichkeit vor Optik: „kein Lauf" wird gesagt, nicht durch einen Strich angedeutet.
  "imp.groups.runIdNone": "Für diesen Aufruf hat der Server keinen Lauf geführt.",
  "imp.groups.runOutcomeLoading": "Der Ausgang dieses Laufs wird geladen …",
  "imp.groups.runOutcomeUnavailable":
    "Der Ausgang dieses Laufs ist gerade nicht abrufbar. Die Kennung oben bleibt gültig.",
  // Der Vorbehalt: EIN Satz für „nicht der aktuelle Stand", danach der Grund. Ohne Verbindung
  // wartet die Abfrage — sie läuft nicht und ist nicht gescheitert; genau dieser Grund fehlte in
  // Runde 1, und der alte Ausgang stand deshalb unmarkiert da (Prüferbefund R1).
  "imp.groups.runOutcomeStale": "Stand der letzten erfolgreichen Abfrage — nicht der aktuelle.",
  "imp.groups.runOutcomeStaleFailed": "Die Auffrischung ist fehlgeschlagen.",
  "imp.groups.runOutcomeStalePaused": "Ohne Verbindung wartet die Auffrischung.",
  "imp.groups.runOutcomeRefreshing": "Die Auffrischung läuft gerade.",
  "imp.groups.runOutcomeOffline":
    "Keine Verbindung — der Ausgang dieses Laufs wurde noch nicht gelesen. Die Kennung oben bleibt gültig.",
  // WP-COCKPIT-LINIE: geführte Fünf-Schritte-Leiste + eingeklappter Verlauf (einfache Sprache).
  "imp.step.barLabel": "Import in fünf Schritten",
  "imp.step.source": "Quelle",
  "imp.step.sourceHint":
    "Wähle aus, woher die Beiträge kommen sollen — heute: Seiten aus Confluence.",
  "imp.step.explore": "Erkunden",
  "imp.step.exploreHint":
    "Sieh dir zuerst an, was in der Quelle steckt — es wird noch nichts übernommen.",
  "imp.step.narrow": "Eingrenzen",
  "imp.step.narrowHint":
    "Klicke Themen an oder beschreibe in einem Satz, was du übernehmen möchtest — die Vorschau zeigt, was passt.",
  "imp.step.groups": "Gruppen freigeben",
  "imp.step.groupsHint":
    "Gib ganze Gruppen frei oder schließe sie aus — einzelne Beiträge kannst du weiter an- und abwählen.",
  "imp.step.apply": "Übernehmen & Bilanz",
  "imp.step.applyHint":
    "Die freigegebenen Beiträge werden zur Prüfung übernommen — die Bilanz zeigt ehrlich, was passiert ist.",
  "imp.step.done": "erledigt",
  "imp.explore.ctaAgain": "Neu erkunden",
  "imp.select.previewAgain": "Vorschau aktualisieren",
  "imp.history.title": "Review-Verlauf: offene und übernommene Beiträge",
  "imp.history.count": "{{open}} offen · {{total}} gesamt",
  "imp.history.hint":
    "Hier liegt der Verlauf früherer Übernahmen — zur Prüfung eingereihte, angenommene und abgelehnte Beiträge. Für den laufenden Import brauchst du diesen Bereich nicht.",
  // WP-UX-WOW-1 (Kopfs Live-UX-Befunde U1-U9): Politur für den ersten VIP2-Eindruck.
  "ask.koQuestion": "Was gilt zu: {{title}}?",
  "ask.confidentialPrefillHint":
    "Vertraulicher Inhalt — prüfe die Frage vor dem Senden. Sie wurde nur vorbefüllt und nicht automatisch gesendet.",
  "ask.expect.neutral": "Beispiel ausprobieren",
  // AUFTRAG-mega51 BLOCK D2: der Sonderfall der Trefferzeile liest jetzt denselben Wert, den er
  // anzeigt (confidence) — deshalb spricht sein Text von der Sicherheit, nicht von Trust.
  "lib.confidenceNone": "Sicherheit noch nicht bewertet",
  "lib.confidenceNoneHint":
    "Die Sicherheit sagt, wie belastbar ein Inhalt eingestuft ist (0 bis 100). 0 heißt: noch nicht bewertet — nicht, dass der Inhalt falsch ist.",
  "con.emptyWhat":
    "Ein Konflikt entsteht, wenn zwei Beiträge sich fachlich widersprechen — zum Beispiel zwei verschiedene Grenzwerte für dieselbe Anlage.",
  "con.emptyHow":
    "Klarwerk erkennt solche Widersprüche beim Prüfen und Vergleichen; hier entscheidet dann ein Mensch, welche Aussage gilt.",
  "con.emptyExamplesHint":
    "Zum Ausprobieren gibt es das Beispielpaket „Widersprüchliche Aussagen“ im Import-Bereich.",
  "con.emptyExamplesCta": "Beispielpakete öffnen",
  "stage2.gate.title": "Erweiterte Funktionen (Stufe 2)",
  "stage2.gate.body":
    "Dieses Modul gehört zu den Erweiterten Funktionen — im Haus „Stufe 2“ genannt: zusätzliche Module über den Kernablauf hinaus. Sie sind gerade ausgeschaltet, deshalb ist dieser Bereich noch nicht sichtbar.",
  "stage2.gate.enable": "Stufe 2 jetzt einschalten",
  "stage2.gate.adminOnly":
    "Stufe 2 kann eine Admin-Person über den Schalter in der Seitenleiste einschalten.",
  "stage2.gate.back": "Zurück zum Start",
  // AUFTRAG-mega70 BLOCK A: der Rollenfall bekommt dieselbe Behandlung wie der Stufe-2-Fall —
  // eine Erklärung statt der stillen Umleitung. Kein Einschalt-Knopf: eine Rolle vergibt der
  // Administrator, nicht die Nutzerin.
  "role.gate.title": "Dieser Bereich gehört einer anderen Rolle",
  "role.gate.body":
    "Dieser Bereich braucht die Rolle {{owner}}. Deine aktuelle Rolle ist {{own}} — darum ist der Weg hierhin für dich zu. Eine Rolle vergibt die Administration; es gibt hier deshalb nichts einzuschalten.",
  "imp.cleanup.title": "Testdaten aufräumen",
  "imp.cleanup.desc":
    "Entfernt alle Einträge aus der Import-Warteschlange und legt alle aus Confluence oder Jira importierten Beiträge in den Papierkorb. Selbst erstellte Beiträge, Nutzer und Einstellungen bleiben unberührt.",
  "imp.cleanup.previewCta": "Vorschau laden",
  "imp.cleanup.previewLoading": "Umfang wird ermittelt …",
  "imp.cleanup.previewResult":
    "Das würde {{n}} Kandidaten und {{m}} importierte Beiträge entfernen.",
  "imp.cleanup.confirmHint":
    "Die Kandidatenliste wird endgültig geleert; die importierten Beiträge wandern in den Papierkorb und können von dort wiederhergestellt werden.",
  "imp.cleanup.confirmCta": "Jetzt aufräumen",
  "imp.cleanup.cancel": "Abbrechen",
  "imp.cleanup.running": "Aufräumen läuft …",
  "imp.cleanup.doneCandidates": "{{n}} Kandidaten entfernt",
  "imp.cleanup.doneKos": "{{n}} importierte Beiträge in den Papierkorb verschoben",
  "imp.cleanup.doneSkipped": "{{n}} übersprungen (Fehler beim Verschieben)",
  "imp.cleanup.drift":
    "Der Bestand hat sich seit der Vorschau geändert — die Vorschau wurde neu geladen, bitte erneut prüfen und bestätigen.",
  "imp.cleanup.auditFailed":
    "Hinweis: Der Abschluss-Eintrag im Audit-Log konnte nicht geschrieben werden — das Aufräumen selbst ist abgeschlossen.",
  "imp.cleanup.newSince": "{{n}} neue Kandidaten seit der Vorschau — nicht angefasst.",
  "imp.cleanup.claimedKos":
    "{{n}} Beitrag/Beiträge in laufender Review-Bearbeitung — vom Aufräumen ausgenommen.",
  "imp.cleanup.auditPendingCandidates":
    "{{n}} Kandidat(en) mit ausstehendem Aktionsbeleg — vom Aufräumen ausgenommen, bis der Beleg nachgezogen ist.",
  "exp.title": "Beispielpakete",
  "exp.hint":
    "Kuratierte kleine Szenarien für Tester — jedes Paket lässt sich einzeln laden und legt klar gekennzeichnete Beispiel-Beiträge an. Das Import-Aufräumen entfernt sie NICHT; sie verschwinden über das Entfernen der Demo-Daten.",
  "exp.load": "Laden",
  "exp.loading": "Wird geladen …",
  "exp.result": "{{created}} angelegt, {{skipped}} übersprungen (schon vorhanden)",
  "exp.pkg.konflikte.title": "Widersprüchliche Aussagen",
  "exp.pkg.konflikte.desc":
    "Sechs Beiträge in drei Paaren, die sich fachlich widersprechen — ideal, um Konfliktprüfung und Validierung auszuprobieren.",
  "exp.pkg.bilder.title": "Wissen mit Bildern",
  "exp.pkg.bilder.desc":
    "Drei Beiträge mit Bildern und beschreibenden Bild-Fußnoten — ideal für Galerie und Fußnoten-Suche.",
  "exp.pkg.qualitaet.title": "Gemischte Qualität",
  "exp.pkg.qualitaet.desc":
    "Fünf Beiträge von gut über zu kurz bis veraltet — ideal, um Review und Qualitätsbewertung zu üben.",
  // JOB 3277: Demopakete — auswählbar, mit Umfang vor dem Laden, einzeln zurücksetzbar/entfernbar.
  "dpk.title": "Demopakete",
  "dpk.hint":
    "Vollständige Vorführ-Bestände: erst lesen, was drin ist, dann laden. Jedes Paket lässt sich einzeln zurücksetzen und einzeln entfernen — andere Demodaten und echte Beiträge bleiben dabei unberührt. Das Entfernen der gesamten Demodaten nimmt die Pakete weiterhin mit.",
  "dpk.fictional": "erfundene Demodaten",
  "dpk.scope": "{{items}} Objekte · {{areas}} · Inhalte in {{language}}",
  "dpk.stateNone": "noch nicht geladen",
  "dpk.stateLoaded": "{{loaded}} von {{items}} geladen",
  "dpk.stateEdited": "{{n}} davon bearbeitet",
  "dpk.load": "Laden",
  "dpk.reset": "Zurücksetzen",
  "dpk.remove": "Paket entfernen",
  "dpk.removeConfirm": "Wirklich entfernen",
  "dpk.cancel": "Abbrechen",
  "dpk.busy": "Läuft …",
  "dpk.resultLoad": "{{created}} angelegt, {{skipped}} unverändert (schon vorhanden)",
  "dpk.resultReset": "{{updated}} aktualisiert, {{skipped}} unverändert, {{created}} neu angelegt",
  "dpk.resultRemove":
    "{{removed}} entfernt · {{conflicts}} Konflikte und {{duplicates}} Doppelungen geschlossen",
  "dpk.resultTrash": "{{n}} im Papierkorb — nicht neu angelegt",
  "dpk.resultFailures": "{{n}} nicht ausgeführt",
  "dpk.stale": "Stand vom letzten Abruf · Auffrischung fehlgeschlagen",
  // JOB 3277 R2: Dubletten benennen, und vor jedem Eingriff die Vorschau der zugeordneten Objekte.
  "dpk.stateDuplicates": "{{n}} überzählige Kopien",
  "dpk.resultDuplicates": "{{n}} überzählige Kopien entfernt",
  "dpk.resetConfirm": "Wirklich zurücksetzen",
  "dpk.previewLoading": "Vorschau wird geholt …",
  "dpk.previewError":
    "Vorschau nicht abrufbar — solange sie fehlt, wird nichts verändert. Erneut versuchen.",
  "dpk.previewNone": "Diesem Paket ist derzeit kein Objekt zugeordnet.",
  "dpk.previewCounts": "Zugeordnet: {{list}}",
  "dpk.previewIds": "Kennungen: {{ids}}",
  "dpk.artSeed": "Grundbestand",
  // JOB 3277 R3: der Eingriff steht vollständig da — beide Gruppen mit ihren Kennungen.
  "dpk.artUnregistered": "ohne Registereintrag",
  "dpk.previewRestore": "wird hergestellt ({{n}}): {{ids}}",
  "dpk.previewRemove": "wird entfernt ({{n}}): {{ids}}",
  "dpk.previewMissing": "{{n}} fehlende Bausteine werden neu angelegt",
  "dpk.resultAssigned": "{{n}} zugeordnete Objekte entfernt",
  "imp.preview.sourceNewer": "Quelle neuer als Import",
  "imp.select.empty": "Kein Treffer für diese Eingrenzung.",
  "imp.select.aiUnavailable":
    "KI-Auswahl derzeit nicht verfügbar — es gelten nur deine Klick-Filter.",
  "imp.select.aiConfidential":
    "Cloud-KI wegen vertraulicher Inhalte ausgeschlossen — der Freitext-Satz wurde nicht ausgewertet; es gelten nur deine Klick-Filter.",
  "imp.uploadTitle": "JSON-Re-Import",
  "imp.uploadHint":
    "JSON-Datei wählen — die Einträge landen als Beiträge in der Prüfliste (keine stille Übernahme).",
  "imp.jsonOnlyReason":
    "Import derzeit nur als JSON. Office-Dateien (DOCX, PDF, PPTX) bitte über „Wissen erfassen → aus Datei“ aufnehmen — dort werden sie real gelesen.",
  "imp.dropHint": "JSON-Datei hierher ziehen und ablegen — oder unten auswählen.",
  "imp.dropActive": "JSON-Datei hier ablegen …",
  "imp.dropReject": "„{{name}}“ ist keine JSON-Datei — Import derzeit nur als JSON möglich.",
  "imp.upload": "JSON-Datei wählen",
  "imp.parsed": "{{n}} Beiträge zur Prüfung eingereiht.",
  "imp.parseError": "Ungültige JSON-Datei.",
  "imp.json.syntax":
    "Die JSON-Syntax ist fehlerhaft. Öffne die Datei in einem Editor, prüfe Klammern, Anführungszeichen und Kommas und wähle die korrigierte Datei erneut.",
  "imp.json.notArray":
    "Das JSON ist gültig, aber keine Liste. Setze die Einträge in eine Liste mit [ und ], auch bei einem einzigen Eintrag; nutze die Vorlage im JSON-Kasten.",
  "imp.json.notObject":
    "Eintrag {{n}} ist kein Objekt. Ersetze ihn durch ein Objekt mit Pflichtfeldern wie in der Vorlage im JSON-Kasten und wähle die Datei erneut.",
  "imp.json.fields":
    "Eintrag {{n}}: {{fields}} fehlen oder passen nicht. Öffne die Datei in einem Editor und ergänze oder korrigiere diese Felder als Text; für type sind erlaubt: {{types}}. Nutze die Vorlage im JSON-Kasten.",
  "imp.json.format":
    "Erwartet wird eine JSON-Liste (Array) mit Objekten. Pflichtfelder je Eintrag, jeweils als Text: {{fields}}.",
  "imp.json.types": "Erlaubte Werte für type: {{types}}.",
  "imp.json.example": "Mindestvorlage für einen Eintrag",
  "imp.json.exampleHint":
    "Markiere und kopiere die Vorlage, ersetze die Beispieltexte in einem Editor und speichere sie als .json-Datei. Wähle die Datei anschließend unten aus.",
  "imp.json.exportPath":
    "Passende Datei aus dem Bestand: Bibliothek → „…“ (Weitere Aktionen) → Export → JSON",
  "imp.queueTitle": "Prüfliste der Importe",
  "imp.queueEmpty": "Keine Beiträge zur Prüfung.",
  // JOB 4293 (§ 9): die Aktualität der Prüfliste — je Karte, und sie sagt AUCH, warum „Annehmen"
  // gerade nicht geht. Eigene Sätze statt `kollision.lage.*`: jene sprechen von der
  // Kollisionsprüfung, hier geht es um die Warteschlange und um eine Entscheidung, die geschrieben
  // wird. `loadstate.stale` („Aktualisierung fehlgeschlagen") passt für den Offlinefall
  // ausdrücklich nicht — ohne Netz hat es gar keinen Versuch gegeben.
  "imp.stand.auffrischungLaeuft":
    "Stand von zuletzt — die Prüfliste wird gerade aufgefrischt. „Annehmen“ ist wieder frei, sobald sie frisch gelesen ist.",
  "imp.stand.auffrischungGescheitert":
    "Stand von zuletzt — die Auffrischung ist gescheitert. „Annehmen“ bleibt gesperrt, bis dieser Beitrag frisch gelesen ist.",
  "imp.stand.pausiert":
    "Stand von zuletzt — ohne Netzverbindung nicht aktuell prüfbar. „Annehmen“ bleibt gesperrt, bis dieser Beitrag frisch gelesen ist.",
  "imp.stand.pausiertOhneStand":
    "Ohne Netzverbindung ist die Prüfliste nicht abrufbar — über offene Beiträge ist damit nichts gesagt.",
  // JOB 4293 R4: Das Netz ist wieder da — gelesen wurde deshalb noch nichts. Der Satz sagt genau
  // das und nicht mehr; „aktuell" wäre hier eine Behauptung ohne Antwort.
  "imp.stand.netzluecke":
    "Stand von vor der Netzunterbrechung — seither ist keine neue Antwort angekommen. „Annehmen“ bleibt gesperrt, bis dieser Beitrag frisch gelesen ist.",
  "ext.pipeline.title": "Import-Pipeline & Befunde",
  "ext.pipeline.upload": "Hochladen",
  "ext.pipeline.extract": "Extrahieren",
  "ext.pipeline.structure": "Strukturieren",
  "ext.pipeline.review": "Prüfen",
  "ext.pipeline.validate": "Validieren",
  "ext.pipeline.release": "Freigeben",
  "ext.pipeline.reuse": "Wiederverwenden",
  "ext.queue.total": "Gesamt: {{n}}",
  "ext.queue.open": "Offen: {{n}}",
  "ext.queue.accepted": "Angenommen: {{n}}",
  "ext.queue.rejected": "Abgelehnt: {{n}}",
  "ext.queue.infoRequested": "Info angefragt: {{n}}",
  "ext.queue.duplicates": "Dubletten: {{n}}",
  "ext.finding.duplicate": "Dublette",
  "ext.finding.missingInfo": "Angaben fehlen",
  "ext.finding.infoRequested": "Info angefragt",
  "ext.finding.acceptedKo": "KO erzeugt",
  // JOB 3116 (Q2c): WORAUF der Wiederimport getroffen ist — mit der Kennung des betroffenen
  // Objekts. Beide treten AN DIE STELLE eines bisherigen Abzeichens: „liegt im Papierkorb" statt
  // „Dublette", „vorhanden … wiederverwendet" statt „KO erzeugt" (dort wurde nichts erzeugt).
  "ext.finding.inTrash": "liegt im Papierkorb, Kennung {{id}}",
  "ext.finding.reusedKo": "vorhanden, Kennung {{id}} wiederverwendet",
  "ext.finding.rejected": "Abgelehnt",
  "ext.validity.title": "Gültigkeit & Schutz",
  "ext.validity.freshness": "Aktualität",
  "ext.validity.outputEligible": "Output-Eignung",
  "ext.validity.recommendation": "Empfehlung",
  "ext.freshness.validiert": "validiert",
  "ext.freshness.revalidierung-faellig": "Revalidierung fällig",
  "ext.freshness.offen": "offen",
  "ext.freshness.konflikt": "Konflikt",
  "ext.freshness.unbekannt": "unbekannt",
  "ext.protection.ip": "IP-Sensitivität",
  "ext.protection.notRated": "nicht bewertet",
  "ext.outputEligible.yes": "ja",
  "ext.outputEligible.no": "nein",
  "ext.recommendation.clarify-conflict": "Konflikt klären",
  "ext.recommendation.start-revalidation": "Revalidierung starten",
  "ext.recommendation.finish-validation": "Validierung abschließen",
  "ext.recommendation.output-ready": "Für Output nutzbar",
  "ext.recommendation.unknown": "unbekannt",
  "imp.duplicate": "Dublette",
  // JOB 3288 · IMPORT-VOLLTEXT: Volltext und Quelle auf der Prüfkarte, vor „Annehmen".
  "imp.fullText.show": "Ganzen importierten Text anzeigen",
  "imp.fullText.hide": "Ganzen Text ausblenden",
  "imp.fullText.label": "Vollständiger importierter Inhalt",
  "imp.fullText.missing":
    "Für diesen Beitrag wurde kein Volltext übertragen — hier steht nur die Kernaussage.",
  "imp.fullText.more": "Mehr anzeigen",
  "imp.fullText.less": "Weniger anzeigen",
  "imp.fullText.truncated": "Gekürzt angezeigt — „Mehr anzeigen“ zeigt den ganzen Text.",
  "imp.source.open": "Quelle öffnen",
  "imp.source.newTab": "öffnet einen neuen Tab",
  "imp.source.space": "Raum {{name}}",
  "imp.source.unlinkable":
    "Die gespeicherte Quelladresse ist keine sichere Webadresse — sie ist deshalb nicht anklickbar.",
  "imp.source.none": "Zu diesem Beitrag ist keine Quelladresse gespeichert.",
  "imp.note": "Notiz",
  "imp.accept": "Annehmen",
  "imp.reject": "Ablehnen",
  "imp.info": "Info anfordern",
  "imp.infoSend": "Senden",
  "imp.notePlaceholder": "Welche Information fehlt?",
  "imp.reviewed": "Beitrag aktualisiert.",
  // AUFTRAG-mega9 Block E-1 (KW-E2E-005): „Neu" beschrieb den Anlagezustand, nicht die Bedeutung
  // für den Nutzer. Der Kandidat wartet auf eine Entscheidung — dieselbe Sprache wie
  // imp.preview.queued / imp.groups.hintQueued.
  "imp.status.neu": "Zur Prüfung vorgemerkt",
  "imp.status.in_bearbeitung": "In Bearbeitung",
  "imp.status.angenommen": "Angenommen",
  "imp.status.abgelehnt": "Abgelehnt",
  "imp.status.info-angefragt": "Info angefragt",
  // Unbekannter/neuer Serverzustand: ehrlich benannt statt roher i18n-Schlüssel in der Oberfläche.
  "imp.status.unknown": "Status unbekannt",
  "risk.kicker": "Risiko & Lücken",
  "risk.summary": "Cockpit-Übersicht",
  "risk.kpiOpenGaps": "Offene Lücken",
  "risk.kpiHigh": "Hohe Priorität",
  "risk.kpiUnassigned": "Unzugewiesen",
  "risk.kpiAssigned": "Zugewiesen",
  "risk.kpiOpenConflicts": "Offene Konflikte",
  "risk.kpiClosedGaps": "Geschlossene Lücken",
  "risk.cockpit": "Risiko-Cockpit nach Domäne",
  "risk.cockpitEmpty": "Keine Domänendaten.",
  "risk.level.kritisch": "kritisch",
  "risk.level.mittel": "mittel",
  "risk.level.gut": "stabil",
  "risk.koCount": "Objekte",
  "risk.validated": "validiert",
  "risk.openKo": "offen",
  "risk.singleSource": "Einzelquelle — Klumpenrisiko",
  "risk.singleSourceExplain":
    "Das gesamte Wissen dieser Domäne stammt von einer einzigen Person. Fällt sie aus (Krankheit, Kündigung, Ruhestand), ist das Wissen weg — das ist das größte Wissensrisiko. Gegenmaßnahme: weitere Personen einbinden, Wissen zweitprüfen (validieren) und Quellen ergänzen.",
  "risk.bearer": "Getragen von: {{names}}",
  "risk.viewObjects": "Objekte dieser Domäne ansehen",
  "risk.vsPlant.above": "Prüfanteil über dem Werksdurchschnitt ({{avg}}%)",
  "risk.vsPlant.below": "Prüfanteil unter dem Werksdurchschnitt ({{avg}}%)",
  "risk.vsPlant.equal": "Prüfanteil gleich dem Werksdurchschnitt ({{avg}}%)",
  "risk.staleByAssetChange_one": "{{count}} Objekt nach Anlagenänderung zu prüfen",
  "risk.staleByAssetChange_other": "{{count}} Objekte nach Anlagenänderung zu prüfen",
  "risk.horizon.title": "Mein Bereich · Wissen vor dem Ruhestand sichern",
  "risk.horizon.filterLabel": "Ruhestandshorizont",
  "risk.horizon.filter": "nächste {{months}} Monate",
  "risk.horizon.notCountable":
    "Was jemand weiß, das noch nicht im System steht, lässt sich nicht zählen. Gezeigt wird, was an der Person hängt — und was bis zur Frist zu sichern ist.",
  "risk.horizon.noAreas": "Es ist noch kein Bereich gepflegt.",
  "risk.horizon.noOwnArea":
    "Ihnen ist noch kein Bereich zugeordnet. Die Zuordnung pflegt die Administration.",
  "risk.horizon.busFactorOne": "Bus-Faktor 1",
  "risk.horizon.criticality": "Kritikalität: {{level}}",
  "risk.horizon.level.niedrig": "niedrig",
  "risk.horizon.level.mittel": "mittel",
  "risk.horizon.level.hoch": "hoch",
  "risk.horizon.noManager": "Noch keine verantwortliche Person eingetragen",
  "risk.horizon.manager": "Verantwortlich: {{name}}",
  "risk.horizon.noneInHorizon":
    "Laut Pflege geht niemand aus diesem Bereich in den nächsten {{months}} Monaten in den Ruhestand.",
  "risk.horizon.bearer":
    "{{name}} · Ruhestand in den nächsten {{months}} Monaten · sichern bis {{due}}",
  "risk.horizon.todo.soleBearer":
    "Einzige Quelle in diesem Bereich — fällt sie aus, ist das Wissen weg.",
  "risk.horizon.todo.openKos_one": "{{count}} eigenes Objekt noch nicht geprüft",
  "risk.horizon.todo.openKos_other": "{{count}} eigene Objekte noch nicht geprüft",
  "risk.horizon.todo.openGaps_one": "{{count}} offene Frage zugewiesen",
  "risk.horizon.todo.openGaps_other": "{{count}} offene Fragen zugewiesen",
  "risk.horizon.todo.koCount_one": "{{count}} Objekt in diesem Bereich erfasst",
  "risk.horizon.todo.koCount_other": "{{count}} Objekte in diesem Bereich erfasst",
  "risk.pflege.title": "Bereichsprofile und Ruhestandshorizonte pflegen",
  "risk.pflege.intro":
    "Je Kategorie: wer den Bereich verantwortet und die Einschätzung von Kritikalität, Prozessnähe, Wiederholhäufigkeit und Schadenspotenzial (leer = keine Eingangsdaten). Je Person: Ruhestand in den nächsten 24 oder 36 Monaten — gespeichert werden nur Horizont und Frist.",
  "risk.pflege.manager": "Verantwortlich für {{category}}",
  "risk.pflege.noManager": "Keine verantwortliche Person",
  "risk.pflege.save": "Speichern",
  "risk.pflege.error": "Speichern ist fehlgeschlagen.",
  "risk.pflege.retirementTitle": "Ruhestandshorizonte",
  "risk.pflege.retirement": "Ruhestandshorizont von {{name}}",
  "risk.pflege.noRetirement": "Kein Ruhestand eingetragen",
  "risk.busLegendSingle": "rot = Einzelquelle (Ausfallrisiko)",
  "risk.busLegendOk": "grün = mehrere Quellen",
  "risk.help.summary":
    "Überblick in Zahlen: Offene Lücken (Fragen ohne gesichertes Wissen), Hohe Priorität (dringend), Unzugewiesen/Zugewiesen (ob jemand die Lücke bearbeitet), Offene Konflikte (widersprüchliche Aussagen) und Geschlossene Lücken (bereits beantwortet). Rote Zahlen zeigen Handlungsbedarf.",
  "risk.help.cockpit":
    "Risiko je Domäne (Kategorie): KRITISCH/MITTEL/GUT fasst zusammen, wie gut die Domäne abgesichert ist. Objekte = wie viel Wissen; validiert % = wie viel davon geprüft ist; offen = noch ungeprüft; Experten = wie viele Personen die Domäne tragen. Ein Experte + wenig validiert = hohes Risiko.",
  "risk.help.busfactor":
    "Wie stark hängt eine Domäne an einzelnen Personen? Ein roter Balken heißt: Das Wissen kommt nur aus EINER Quelle — fällt sie aus, ist es verloren. Grün = mehrere Quellen, also robuster. Der Balken zeigt zusätzlich die Wissensmenge der Domäne.",
  "risk.help.gaps":
    "Offene Wissenslücken sind gestellte Fragen, auf die es (noch) keine gesicherte Antwort gibt. Priorisiere sie, weise sie einer Person zu oder erfasse selbst geprüfte Erfahrung dazu. Aus datenschutzgründen keine sensiblen Details in die Frage schreiben.",
  "health.title": "Knowledge Health",
  "health.band.gut": "gut",
  "health.band.mittel": "mittel",
  "health.band.kritisch": "kritisch",
  "health.explain.gut":
    "Hoher Validierungsstand, wenig veraltetes Wissen und geringe Klumpenrisiken.",
  "health.explain.mittel":
    "Solide Basis, aber offene Lücken/Konflikte oder Revalidierungsbedarf bremsen.",
  "health.explain.kritisch":
    "Niedrige Validierung und/oder viel veraltetes Wissen, offene Konflikte oder Single-Source-Risiken.",
  "health.factor.validatedRatio": "Validierungsquote",
  "health.factor.staleRatio": "Revalidierungsbedarf (stale)",
  "health.factor.singleSourceShare": "Single-Source-Anteil",
  "health.factor.openGaps": "Offene Wissenslücken",
  "health.factor.openConflicts": "Offene Konflikte",
  // AUFTRAG-mega33 BLOCK B (Pedi 27.07.): bei unbelegter Erkennung rechnet die sichtbare Zahl mit
  // dem VOLLEN Konfliktabzug. Die große Zahl ist die schlechtere; der optimistische Rand steht
  // daneben und sagt, was er ist.
  "health.band.unproven": "Einstufung unbelegt",
  "health.unknown": "unbekannt",
  "health.unknownExplain":
    "Für den Wert fehlen gerade Live-Signale (Wissensobjekte, Lücken, Konflikte, Revalidierungen oder Bus-Faktor sind nicht geladen oder nicht erreichbar). Deshalb steht hier keine Zahl — geschätzt wird nicht.",
  "health.range.explain":
    "{{worst}} von 100 im schlechtesten Fall, {{best}} im besten. Solange nicht belegt ist, dass vollständig nach Konflikten gesucht wurde, gilt der schlechtere Wert — deshalb steht hier kein Band.",
  "health.conflictUnproven.title":
    "Die Punktzahl rechnet mit dem vollen Konfliktabzug: {{worst}} statt {{best}} von 100.",
  "health.conflictUnproven.detection-incomplete":
    "Die Konflikt- und Duplikaterkennung ist im Bestand nicht durchgängig vollständig gelaufen. Es ist deshalb nicht ausgeschlossen, dass es mehr Konflikte gibt als gefunden wurden — und ein Abzug von null wäre eine Annahme über etwas Unbekanntes.",
  "health.conflictUnproven.detection-unknown":
    "Über die Reichweite der Konflikt- und Duplikaterkennung liegt keine Aussage vor. Solange nicht belegt ist, dass vollständig geprüft wurde, sagt die Zahl der gefundenen Konflikte nichts über den Bestand.",
  "health.conflictUnproven.known":
    "Bekannt sind {{count}} offene Konflikte ({{penalty}} von höchstens {{max}} Punkten Abzug). Dieser Abzug ist sicher; der Rest bis zum Höchstwert ist die Unsicherheit.",
  // AUFTRAG-mega51 BLOCK G1: die verständliche Bezeichnung führt, der Hausbegriff folgt.
  "risk.busfactor": "Einzelquellen-Risiko (Bus-Faktor)",
  "risk.busEmpty": "Keine Risikodaten.",
  "risk.experts": "Experten",
  // AUFTRAG-mega51 BLOCK F1: gezählte Form — „1 Experte" statt „1 Experten" (Bauform wie
  // lib.facet.showResults aus mega34).
  "risk.expertsCount_one": "{{count}} Experte",
  "risk.expertsCount_other": "{{count}} Experten",
  // Consultant-System (Experten-Matching): entkitschter Ton, kein Hero-Wording, keine Zahlen/Rangfolge.
  "expertise.title": "Wen einbeziehen",
  "expertise.intro":
    "Diese Personen haben schon zu einem Thema beigetragen. Du kannst sie um eine kurze Einordnung bitten — keine Rangfolge, nur wer helfen könnte.",
  "expertise.help":
    "Abgeleitet aus vorhandenen Wissensobjekten (wer zu einem Thema beigetragen hat). Reihenfolge alphabetisch, ohne Bewertung — als Hilfe, wen man ansprechen könnte.",
  "expertise.invite": "Du hast Erfahrung mit {{topic}} — kannst du das kurz einordnen?",
  "expertise.thanks": "Danke, das hilft dem Team.",
  "risk.gaps": "Offene Wissenslücken",
  "risk.gapsEmpty": "Keine offenen Lücken.",
  "risk.gapStatus.offen": "offen",
  "risk.gapStatus.geschlossen": "geschlossen",
  "risk.priorityLabel": "Priorität",
  "risk.priority.hoch": "hoch",
  "risk.priority.mittel": "mittel",
  "risk.priority.niedrig": "niedrig",
  "risk.close": "Schließen",
  "risk.closeWithTitle": "Mit dem Wissensobjekt schließen, das diese Lücke beantwortet",
  "risk.closeFailed": "Nicht geschlossen — das Wissensobjekt fehlt oder liegt im Papierkorb.",
  "risk.assign": "Experte …",
  "risk.delete": "Löschen",
  "risk.gapNextLabel": "Nächster Schritt",
  "risk.gapNext.prioritize": "Dringlichkeit einschätzen und einordnen.",
  "risk.gapNext.assign": "Einer Fachperson zuweisen.",
  "risk.gapNext.capture": "Wissen erfassen, um die Lücke zu schließen.",
  "risk.gapNext.done": "Geschlossen — erledigt.",
  "risk.gapCapture": "Wissen erfassen",
  "risk.gapRedacted": "Vertrauliche Lücke (Fragetext verborgen)",
  "lcy.kicker": "Lebenszyklus",
  "lcy.banner": "„Stimmt das noch?“ — gekoppelte Objekte nach Anlagenänderung prüfen.",
  "lcy.empty": "Nichts zur Re-Validierung.",
  "lcy.stillValid": "Noch gültig → neue Version",
  "lcy.assetTitle": "Anlagenänderung melden",
  // JOB 3061 · H2 — die EINE Zeile unter der Liste, die Feld und Auslöser aufklappt.
  "lcy.assetToggle": "Anlage geändert …",
  "lcy.assetHint":
    "Referenz der geänderten Anlage/Prozess eingeben — gekoppelte Wissensobjekte werden zur Prüfung markiert.",
  "lcy.assetPlaceholder": "Anlagen-/Prozess-Referenz (z. B. Presse-P2)",
  "lcy.assetTrigger": "Revalidierung auslösen",
  "lcy.assetMarked": "{{n}} Objekt(e) für „{{asset}}“ zur Prüfung markiert.",
  "lcy.pendingTitle": "Zur Re-Validierung",
  "lcy.revalAsset": "Anlagenbezug",
  "lcy.revalNextLabel": "Nächster Schritt",
  "lcy.revalNext.review": "Prüfen, ob nach der Änderung noch gültig — dann als geprüft bestätigen.",
  "lcy.revalNext.validate": "Objekt ist nicht freigegeben — zuerst validieren.",
  "lcy.revalCta.review": "Zur Prüfung",
  "lcy.revalCta.validate": "Zur Validierung",
  "lcy.revalNext.openKo": "Objekt öffnen — Details liegen aktuell nicht vor.",
  "lcy.revalMissing": "Objektdetails nicht im geladenen Bestand.",
  "lcy.revalSaved": "Revalidierung erfasst.",
  "lcy.nextViewKo": "Objekt ansehen",
  "lcy.nextUse": "Wissen nutzen (fragen)",
  "lcy.pathTitle": "Lernpfad · {{role}}",
  "lcy.pathEmpty": "Für deine Rolle ist noch kein Lernpfad hinterlegt.",
  "lcy.stepComplete": "Als erledigt markieren",
  "lcy.stepDone": "Erledigt",
  "ana.kicker": "Analytics & Audit",
  "ana.exec.title": "Executive-Blick",
  "ana.exec.validated": "Validiertes Wissen",
  "ana.exec.validatedHint": "geprüfte, gesicherte Objekte",
  "ana.exec.openReviews": "Offene Prüfungen",
  "ana.exec.openReviewsHint": "warten auf Validierung",
  "ana.exec.busFactor": "Einzelquellen-Risiko",
  "ana.exec.busFactorHint": "Kategorien mit nur einer Quelle",
  "ana.exec.rescued": "Gerettete Lücken",
  "ana.exec.rescuedHint": "geschlossene Wissenslücken",
  "ana.help.exec":
    "Vier Kern-Kennzahlen aus Live-Daten: validiertes Wissen, offene Prüfungen, Bus-Faktor-Risiko und gerettete Lücken. Ein ruhiger Überblick für Entscheider — je höher der Validierungsgrad und je niedriger das Risiko, desto gesünder die Wissensbasis.",
  "ana.help.health":
    "Der Health-Score (0–100) fasst Validierungsgrad, Aktualität und Quellenbreite zusammen. Das Band (z. B. gut oder kritisch) zeigt den Zustand auf einen Blick; darunter sehen Sie, welche Faktoren den Wert heben oder senken.",
  "ana.help.impact":
    "Wirkung zeigt, was das System real leistet: validierte Objekte gesamt, gestellte Fragen, ohne Lücke beantwortete Fragen und die daraus errechnete Antwortquote. Der Wochenverlauf macht sichtbar, ob validiertes Wissen wächst.",
  "ana.help.audit":
    "Das Audit-Log hält jede relevante Aktion fest — wer (Actor), was (Aktion) und woran (Ziel). Einträge werden nur angefügt und hash-verkettet; eine nachträgliche Abweichung ist rechnerisch prüfbar. Über die Filter grenzen Sie schnell auf eine Person, eine Aktionsart oder ein Objekt ein.",
  "ana.total": "Gesamt",
  "ana.categories": "Kategorien",
  "ana.byType": "Verteilung nach Wissensart",
  "ana.audit": "Audit-Log (hash-verkettet)",
  "ana.auditEmpty": "Keine Einträge.",
  "ana.avgTrust": "Ø Vertrauen",
  "ana.validationRate": "Validierungsquote",
  "ana.openTasks": "Offene Aufgaben",
  "ana.doneTasks": "Erledigt",
  "ana.impact": "Wirkung",
  "ana.impactValidated": "Validiert gesamt",
  "ana.impactAsk": "Fragen gesamt",
  "ana.impactAnswered": "Ohne Lücke beantwortet",
  "ana.impactRate": "Antwortquote",
  "ana.weekly": "Validiert je Woche",
  "ana.filterActor": "Actor",
  "ana.filterAction": "Aktion",
  "ana.filterTarget": "Ziel filtern …",
  "ana.filterAll": "alle",
  "ana.auditCount": "{{shown}} von {{total}}",
  "ana.auditNoMatch": "Keine Treffer für diesen Filter.",
  "adm.kicker": "Nutzerverwaltung",
  "adm.empty": "Keine Nutzer.",
  "adm.approve": "Freigeben",
  "adm.remove": "Löschen",
  "adm.createTitle": "Nutzer anlegen",
  "adm.name": "Name",
  "adm.email": "E-Mail",
  "adm.password": "Passwort",
  "adm.role": "Rolle",
  "adm.create": "Anlegen",
  "adm.created": "Nutzer angelegt.",
  "adm.createInvalid": "Bitte noch ergänzen:",
  "adm.createHint": "Erforderlich: Name, gültige E-Mail und Passwort (mind. 8 Zeichen).",
  "adm.field.name": "Name",
  "adm.field.email": "gültige E-Mail",
  "adm.field.password": "Passwort (mind. 8 Zeichen)",
  "adm.reset": "Passwort zurücksetzen",
  "adm.newPassword": "Neues Passwort",
  "adm.newPasswordRepeat": "Passwort wiederholen",
  "adm.passwordMismatch": "Die Passwörter stimmen nicht überein.",
  "adm.resetConfirm": "Zurücksetzen",
  "adm.resetCancel": "Abbrechen",
  "adm.resetDone": "Passwort zurückgesetzt; alle Sitzungen beendet.",
  // JOB 4021 (ERSTEINRICHTUNG-GAST T2): die Befristung eines Zugangs — sehen, setzen, verlängern,
  // beenden. Eigenes Präfix, eigene Schlüssel; kein bestehender Satz wird umgewidmet.
  "adm.gastfrist.titel": "Zugang gültig bis",
  "adm.gastfrist.unbefristet": "Unbefristet — dieser Zugang endet nicht von selbst.",
  "adm.gastfrist.gueltigBis": "Gültig bis {{datum}}.",
  "adm.gastfrist.abgelaufen": "Abgelaufen am {{datum}} — dieser Zugang gilt nicht mehr.",
  "adm.gastfrist.unlesbar":
    "Der gespeicherte Ablaufwert ist nicht lesbar; er beendet den Zugang nicht.",
  // WORTLAUT MIT GRUND: hier stand „…und ersetzt sie nicht". Der Autonomiewächter
  // (`tests/app/learning-claim-guard.test.ts:111`, Regel C) bindet an die Phrase „ersetzt sie" und
  // kennt die Verneinung nicht — er war damit rot. Aufgeweicht wird der Wächter dafür NICHT: er
  // hütet Pedis Zusage, dass die Oberfläche keine Ersetzung verspricht, und eine Ausnahme für
  // diesen Satz risse das Loch für den nächsten. Gesagt wird dasselbe, ohne die Phrase.
  "adm.gastfrist.hinweis":
    "Die Befristung gilt zusätzlich zur Freigabe — beide Bedingungen müssen erfüllt sein.",
  "adm.gastfrist.setzen": "Befristung setzen",
  "adm.gastfrist.verlaengern": "Befristung ändern oder verlängern",
  "adm.gastfrist.beenden": "Befristung beenden",
  "adm.gastfrist.datum": "Zugang endet am Ende dieses Tages",
  "adm.gastfrist.speichern": "Befristung speichern",
  "adm.gastfrist.abbrechen": "Abbrechen",
  "adm.gastfrist.gespeichert": "Befristung gespeichert.",
  "adm.gastfrist.beendet": "Befristung beendet; der Zugang ist wieder unbefristet.",
  "adm.gastfrist.datumFehlt": "Bitte zuerst einen Tag wählen.",
  // ZWEI AUSGÄNGE, ZWEI SÄTZE (JOB 4021 R2, BEN-Korrekturpflicht 1). `fehlerHilfe` behauptet, dass
  // nichts geändert wurde — das darf nur dastehen, wenn der Server ABGELEHNT hat. Blieb der
  // Ausgang offen (verlorene Antwort, abgebrochenes Netz), gilt `fehlerOffen`: dort wird nichts
  // über die Daten behauptet, sondern gesagt, dass der Stand neu geholt wird.
  "adm.gastfrist.fehlerHilfe": "Nichts wurde geändert. Wähle einen Tag und speichere erneut.",
  "adm.gastfrist.fehlerOffen":
    "Ob die Befristung gespeichert wurde, ist nicht bestätigt. Der Stand oben wird neu geholt — lies ihn, bevor du erneut speicherst.",
  // JOB 4103 (ERSTEINRICHTUNG-GAST T3): dieselbe Befristung, aber im ANLEGEFORMULAR. Eigene Sätze
  // und keine Zweitverwendung der drei darüber: dort ist ein Konto vorhanden und es geht um eine
  // Änderung daran, hier ist noch gar nichts entstanden — „Nichts wurde geändert." wäre beim
  // Anlegen keine Auskunft, sondern eine Ausweichung.
  "adm.gastfrist.anlageHinweis":
    "Ohne Tag entsteht ein Zugang ohne Ende. Mit Tag entsteht der Zugang befristet — oder, wenn etwas schiefgeht, gar nicht.",
  // ZWEI AUSGÄNGE, ZWEI SÄTZE — wie oben, und aus demselben Grund (BEN-Korrekturpflicht 1 aus
  // JOB 4021 R1). „Es wurde kein Konto angelegt." ist eine Tatsachenaussage über fremde Daten; sie
  // ist nur belegt, wenn der Server ABGELEHNT hat (4xx). Der Dienst prüft die Form VOR `register`
  // (`services/auth/src/routes.ts`, Wache 1 und 2), deshalb ist sie dort wahr.
  "adm.gastfrist.anlageFehlerHilfe":
    "Es wurde kein Konto angelegt. Bitte die Angaben berichtigen und erneut anlegen.",
  "adm.gastfrist.anlageFehlerOffen":
    "Ob das Konto angelegt wurde, ist nicht bestätigt. Sieh in der Kontenliste nach, bevor du es erneut anlegst.",
  "adm.seedTitle": "Demodaten laden",
  "adm.seedHint":
    "Lädt einen kleinen, echten Demo-Bestand (KOs, Validierung, Lücke, Konflikt, Duplikat, Anhang) — auch neben vorhandenen Daten. Dein echter Bestand bleibt unberührt und wird nie überschrieben. Über „Demodaten entfernen“ gezielt wieder entfernbar. (Konflikt-/Duplikat-Befund erscheint mit aktivem KI-Reasoner.)",
  "adm.seedButton": "Demodaten laden",
  "adm.seedDone": "Demodaten geladen: {{kos}} Wissensobjekte, {{users}} Nutzer.",
  "adm.seedSkipped": "Übersprungen: Instanz ist nicht leer (Bestand vorhanden).",
  "empty.cta.capture": "Wissen erfassen",
  "empty.cta.import": "Importieren",
  "empty.cta.admin": "Demodaten (Admin)",
  "empty.cta.library": "Zur Bibliothek",
  "empty.cta.validation": "Zur Validierung",
  "empty.cta.tasks": "Zu meinen Aufgaben",
  "story.rescue.title": "Klarwerk sichert Erfahrungswissen, bevor es verloren geht.",
  "story.honest":
    "Nichts wird automatisch validiert — Wissen gilt erst nach der Prüfung im Team als gesichert.",
  "story.surface.start.lead":
    "Noch nichts offen — keine Sackgasse, sondern der Anfang. Starte den Kreis und erfasse Erfahrungswissen, das sonst mit der Zeit verschwindet.",
  "story.surface.tasks.lead":
    "Gerade nichts zu tun. Sobald Wissen geprüft oder nachgebessert werden muss, landet es hier — oder du erfasst selbst den nächsten Beitrag.",
  "story.surface.library.lead":
    "Noch kein Wissen zum Nachschlagen. Erfasse den ersten Beitrag — nach der Prüfung wird er hier quellengebunden nutzbar.",
  "story.surface.validation.lead":
    "Nichts zu prüfen. Erfasstes Wissen erscheint hier zur Team-Prüfung, bevor es als gesichert gilt und genutzt werden kann.",
  "adm.auditTitle": "Letzte Nutzer-/Auth-Aktivitäten (Audit)",
  "adm.auditEmpty": "Keine Nutzer-Audit-Einträge.",
  "prof.kicker": "Konto",
  "prof.language": "Sprache",
  "prof.passwordTitle": "Passwort ändern",
  "prof.oldPassword": "Aktuelles Passwort",
  "prof.newPassword": "Neues Passwort",
  "prof.passwordSubmit": "Passwort ändern",
  "prof.passwordChanged":
    "Passwort geändert. Aus Sicherheitsgründen wurdest du überall abgemeldet — bitte neu anmelden.",
  "help.kicker": "Hilfe",
  "help.open": "Hilfe öffnen",
  "help.openCenter": "Im Hilfe-Center öffnen",
  "help.search": "Hilfe durchsuchen …",
  "help.intro":
    "Kurze Einstiegshilfe zu den wichtigsten Klarwerk-Abläufen. Suche nach Stichwort oder springe direkt in den passenden Bereich.",
  "help.noResults": "Keine Hilfe zu diesem Stichwort gefunden.",
  "help.openRoute": "Bereich öffnen",
  // R-1064: der vom Betreiber festgelegte Supportweg dieser Installation (Hilfeseite).
  "help.support.title": "Support dieser Installation",
  "help.support.configured": "Der Betreiber dieser Installation hat diesen Supportweg hinterlegt:",
  "help.support.linkDefault": "Supportseite öffnen",
  "help.support.mailDefault": "E-Mail an den Support schreiben",
  "help.support.newTab": "neuer Tab",
  "help.support.notConfigured":
    "Für diese Installation ist noch kein Supportweg hinterlegt. Wende dich mit Fragen an die Administration deiner Instanz.",
  "help.support.invalid":
    "Für diese Installation ist ein Supportweg eingetragen, er ist aber ungültig und wird deshalb nicht angezeigt. Bitte gib der Administration deiner Instanz Bescheid.",
  "help.support.loadError":
    "Der Supportweg konnte gerade nicht geladen werden. Die Hilfe auf dieser Seite funktioniert trotzdem.",
  "help.support.loading": "Supportweg wird geladen …",
  // Klara v1 (Pedi 05.07.): kontextsensitive Hilfe — Panel-Texte + Seiten-Erklärungen.
  "klara.title": "Klara",
  "klara.subtitle": "Deine Hilfe in KLARWERK",
  "klara.open": "Klara öffnen — Hilfe zu dieser Seite",
  "klara.intro":
    "Ich erkläre dir Seiten, Felder und Begriffe. Meine Antworten kommen aus der Hilfe-Bibliothek — was dort fehlt, erfinde ich nicht.",
  "klara.pageLabel": "Du bist hier",
  "klara.fieldLabel": "Aktives Element",
  "klara.fieldHint":
    "Tippe in ein Feld oder einen Bereich mit ?-Hilfe — dann erkläre ich ihn hier automatisch.",
  "klara.aiSearch": "Mit KI-Unterstützung suchen",
  "klara.aiBusy": "Die KI liest die passenden Hilfe-Einträge …",
  "klara.aiAnswerTitle": "KI-Antwort aus der Hilfe",
  "klara.aiDisclaimer": "KI-generiert — nicht zu 100 % geprüft",
  // R-0604 (Aufnahme gesamt-ki-kennzeichnung): die Herkunft der Hilfeantwort beim regelbasierten
  // Rückfall — dort hat kein Modell geschrieben, „KI-Antwort" und „KI-generiert" wären falsch.
  "klara.helpAnswerTitle": "Antwort aus der Hilfe",
  "klara.ohneModell": "Regelbasiert, ohne KI-Modell",
  "klara.aiGoto": "Zum Bereich: {{target}}",
  "klara.aiSources": "Grundlage",
  "klara.aiEmpty":
    "Die KI hat in den passenden Hilfe-Einträgen keine sichere Antwort gefunden — eine ehrliche Hilfe-Lücke. Formuliere die Frage anders oder schau auf der Hilfeseite nach.",
  "klara.speak": "Vorlesen",
  "klara.speakStop": "Vorlesen stoppen",
  "klara.inspect": "Element erklären",
  "klara.inspectHint":
    "Zeige-Modus aktiv: Klicke auf ein beliebiges Element (Knopf, Kennzahl, Überschrift) — die Aktion wird dabei NICHT ausgelöst. Esc beendet den Modus.",
  "klara.inspectFor": "Erklärung zu: {{label}}",
  "klara.selectionExplain": "Markierung erklären",
  "klara.selectionEmpty":
    "Markiere zuerst einen Begriff auf der Seite — dann suche ich die passende Erklärung.",
  "klara.searchPlaceholder": "Hilfe durchsuchen … z. B. Validierung, Bus-Faktor, Entwurf",
  "klara.resultsFor": "Treffer für: {{q}}",
  "klara.noResults":
    "Dazu habe ich noch keinen Eintrag — eine ehrliche Hilfe-Lücke. Die Bibliothek wächst gerade; auf der Hilfeseite findest du die geführten Einstiege.",
  "klara.moreHelp": "Zur Hilfeseite",
  "klara.page.start":
    "Dein Überblick: was frisch gesichert wurde, was heute geholfen hat und was auf dich wartet. Von hier springst du direkt in jeden Bereich.",
  "klara.page.tasks":
    "Offene Aufgaben: fällige Prüfungen, Lücken und Fälligkeiten — mit direktem Absprung zur jeweiligen Arbeit.",
  "klara.page.capture":
    "Hier sicherst du Erfahrungswissen: erzählen, diktieren, im Interview oder aus einer Datei. Die KI strukturiert nur — du prüfst und reichst ein.",
  "klara.page.ask":
    "Stell eine Frage. Die Antwort ist quellengebunden und zeigt dir, worauf sie steht und in welchem Zustand diese Quellen sind — gibt es keine Grundlage, entsteht eine ehrliche Wissenslücke.",
  "klara.page.library":
    "Alle Wissensobjekte mit Status, Vertrauen und Filtern. Von hier geht es in jedes Detail.",
  "klara.page.external":
    "Externes Wissen (z. B. Web-Quellen) — immer Stufe 2: nie peer-validiert und klar getrennt vom geprüften Bestand.",
  "klara.page.validation":
    "Das Prüf-Board: Du bewertest eingereichtes Wissen. Erst mit genug grünen Freigaben (und ohne rote) gilt ein Objekt als validiert.",
  "klara.page.conflicts":
    "Widersprüche zwischen Wissensobjekten: sichten, zweite Meinung holen, auflösen — damit die Bibliothek eindeutig bleibt.",
  "klara.page.duplicates":
    "Mögliche Doppelungen: prüfen und zusammenführen, damit Wissen nicht zersplittert.",
  "klara.page.risk":
    "Wo ist Wissen dünn oder hängt an einer Person? Offene Lücken, Bus-Faktor und Domänen-Risiko — mit Links zu den betroffenen Objekten.",
  "klara.page.lifecycle":
    "Wissen altert: Hier siehst du fällige Re-Validierungen und Lernpfade, damit Geprüftes geprüft bleibt.",
  "klara.page.analytics":
    "Kennzahlen aus echten Daten plus das hash-verkettete Audit-Log — wer hat was wann getan.",
  "klara.page.admin":
    "Konten, KI-Zuordnung, Daten und Sicherheit an einem Ort. Nur für Admins sichtbar.",
  "klara.page.help":
    "Geführte Einstiege, Themen und Suche. Ich bin der schnelle Weg — für die Tiefe lohnt sich diese Seite.",
  "klara.page.profile": "Dein Konto: Name, Sprache, Abmelden.",
  "klara.page.koDetail":
    "Die Detailseite eines Wissensobjekts: Inhalt, Versionen, Quellen, Anhänge, Prüf-Historie und Aktionen je nach Rolle.",
  // ==============================================================================================
  // JOB 1151 (KA3) — DIE ANGEBOTSKARTE. „Die Chefsekretärin klopft an, sie platzt nicht herein."
  // ==============================================================================================
  //
  // Drei Texte für die leise Karte, die Klara im Word-Aufgabenfenster beim Öffnen und nach einer
  // Schreibpause legt. Sie stehen HIER, weil `apps/web/src/i18n.ts` die Produktwörterbuchquelle ist
  // (KA3 nennt sie ausdrücklich) — und sinngleich ein zweites Mal im buildlosen Wörterbuch des
  // Aufgabenfensters (`apps/web/public/word-addin/taskpane.html`, Marker `KW-KA3-KARTEN`). Das ist
  // dasselbe Doppelmuster, das `ai.generatedNotice` ↔ `aiGeneratedNotice` seit mega61 trägt: das
  // Panel hat kein Modulsystem und kann diese Datei nicht importieren. Eine DRITTE Textquelle
  // entsteht dabei nicht.
  "klara.offer.label": "Klaras Angebote",
  "klara.offer.lead": "Dazu gibt es schon:",
  "klara.offer.open": "Ansehen",
  // ==============================================================================================
  // JOB 1153 (KA6 Stufe 1) — DIE SCHREIBFLÄCHE. Vorschlag statt Schreiben.
  // ==============================================================================================
  //
  // Dieselbe Doppelablage wie `klara.offer.*` aus KA3 und `ai.generatedNotice` ↔ `aiGeneratedNotice`
  // seit mega61: hier steht die Produktwörterbuchquelle, sinngleich ein zweites Mal im buildlosen
  // Wörterbuch des Aufgabenfensters (`apps/web/public/word-addin/taskpane.html`, Marker
  // `KW-KA6-SCHREIBEN`). Das Panel hat kein Modulsystem und kann diese Datei nicht importieren;
  // eine DRITTE Textquelle entsteht dabei nicht.
  //
  // `klara.write.provenance` ist die DRITTE Herkunftsklasse. Sie steht bewusst neben „gesichert"
  // (`askEvidenceVerified`) und „ungeprüft" (`askEvidenceUnverified`) und sagt etwas anderes als
  // beide: jene sprechen über QUELLEN, diese über die Entstehung. Der Wortlaut sagt „formuliert",
  // nicht „erzeugt" — das ist der Begriff aus KA6 und zugleich der, den der Wächter
  // `tests/app/mega81-ki-kennzeichnung-am-verhalten.test.ts` von einer dauerhaft sichtbaren
  // Erzeugungsbehauptung unterscheidet.
  "klara.write.title": "Schreiben auf Zuruf",
  "klara.write.hint":
    "Klara formuliert einen Vorschlag. Er landet im Antwortfeld darüber und geht erst auf deinen Klick ins Dokument.",
  "klara.write.create": "Erstellen",
  "klara.write.complete": "Vervollständigen",
  "klara.write.rephrase": "Umformulieren",
  "klara.write.busy": "Klara formuliert einen Vorschlag ...",
  "klara.write.ready": "Vorschlag steht im Antwortfeld — nichts wurde ins Dokument geschrieben.",
  "klara.write.empty": "Markiere zuerst Text im Dokument oder gib oben ein, worum es gehen soll.",
  "klara.write.noBasis":
    "Kein Vorschlag: Es gibt dazu keine belastbare Grundlage. Erfunden wird nichts.",
  "klara.write.insertCta": "Vorschlag in Word einfügen",
  "klara.write.insertOk": "Vorschlag eingefügt — mit Herkunftszeile.",
  "klara.write.provenance":
    "KI-formuliert — kein zitiertes KLARWERK-Wissen. Vor Verwendung fachlich prüfen.",
  // Die beiden Blockgründe bleiben GETRENNT: `external_not_migrated` ist eine Betriebsentscheidung,
  // an der der Anwender nichts ändern kann; `external_consent_missing` ist eine Frage an ihn selbst.
  // Ein gemeinsamer Satz nähme ihm genau diesen Unterschied.
  "klara.write.blockedNotMigrated":
    "Formulieren ist hier ausgeschaltet: Der externe Weg ist noch nicht freigeschaltet. Das ist eine Betriebsentscheidung — du kannst daran nichts ändern.",
  "klara.write.blockedConsentMissing":
    "Formulieren ist gesperrt, weil deine Zustimmung für den externen Weg fehlt. Du kannst sie oben im Zustimmungskasten erteilen.",
  "klara.write.blockedOther":
    "Formulieren ist für diese Sitzung gesperrt. Der Server nennt als Grund: {{grund}}",
  "klara.write.blockedUnknown":
    "Ob formuliert werden darf, ist noch nicht bekannt — der Sitzungsstand wird abgerufen. Solange wird kein Zuruf angeboten.",
  // Sektions-Erklärungen (Berater-Lieferung 05.07.): je Überschrift EIN Erklärtext (shelp.*).
  "shelp.adm.seedTitle":
    "Hier lädst du fertige Beispieldaten, mit denen du KLARWERK gefahrlos ausprobieren kannst. Das geht nur, solange die Instanz noch leer ist — so mischen sich echte Daten und Beispiele nie. Alle Beispieldaten sind als solche markiert und lassen sich später mit einem Klick rückstandslos entfernen.",
  "shelp.adm.createTitle":
    "In diesem Abschnitt legst du ein neues Nutzerkonto an und gibst ihm eine Rolle. Betrachter lesen, Experten erfassen Wissen, Controller prüfen es, und Admins verwalten alles. Die Rolle bestimmt also, welche Knöpfe die Person später sieht. Jede Kontoänderung wird im Prüfprotokoll festgehalten.",
  "shelp.adm.auditTitle":
    "Dieses Protokoll zeigt die letzten Anmeldungen und Nutzeraktionen. Jede Zeile ist per Hash mit der vorherigen verkettet: wird nachträglich etwas geändert oder entfernt, passt der Hash nicht mehr. Mit dem Prüfknopf kannst du die Kette jederzeit nachrechnen lassen; das Ergebnis sagt dir ehrlich, ob eine Abweichung gefunden wurde — und, falls ja, an welchem Eintrag.",
  "shelp.ana.byType":
    "Die Balken zeigen, wie sich euer Wissen auf die fünf Wissensarten verteilt — vom Bauchgefühl über bewährte Vorgehensweisen bis zum Negativwissen, also dem Wissen darüber, was man nicht tun darf. Fehlt eine Art fast ganz, ist das ein Hinweis: Dort wird bisher wenig festgehalten. Nutze das Bild, um gezielt nachzufragen, nicht um Personen zu bewerten.",
  "shelp.ana.weekly":
    "Diese Übersicht zählt, wie viele Wissensobjekte in jeder Woche die Prüfung bestanden haben. Sie zeigt den Takt, in dem gesichertes Wissen entsteht — nicht, wie fleißig einzelne Personen waren. Wird die Kurve flach, bleiben meist Prüfungen liegen; ein Blick in den Prüfbereich zeigt dann, wo es hakt.",
  "shelp.ask.steps":
    "Hier stehen die Wissensobjekte, die für deine Frage aus dem Bestand herangezogen wurden — mit einem Auszug aus dem Fundstück. Es ist KEINE Herleitung: KLARWERK protokolliert nicht, welcher Satz der Antwort aus welcher Quelle stammt. Die Liste sagt dir, worauf gesucht wurde; nachprüfen kannst du, indem du die genannte Quelle öffnest.",
  "shelp.ask.sources":
    "Jede Antwort in KLARWERK stützt sich ausschließlich auf eure eigenen Wissensobjekte — und genau die stehen hier. Die zuerst genannten haben die Antwort getragen; die übrigen wurden herangezogen, aber nicht verwendet. Tippe eine Quelle an, um das vollständige Objekt mit Belegen und Prüfstand zu öffnen. Steht hier nichts, gibt es zu deiner Frage kein passendes Wissen, und KLARWERK sagt das ehrlich, statt etwas zu erfinden.",
  "shelp.capture.resumeTitle":
    "Hier liegen deine gespeicherten Entwürfe — alles, was du angefangen, aber noch nicht eingereicht hast. Nichts davon ist verloren, und nichts davon sehen die Prüfer, solange du es nicht einreichst. Tippe einen Entwurf an, um weiterzuarbeiten, oder verwirf ihn, wenn er sich erledigt hat.",
  "shelp.ext.title":
    "Hier kannst du gezielt nach externen Quellen suchen und sie an dein Wissen anhängen, zum Beispiel einen Fachartikel. Wichtig: Externe Quellen sind Zusatzmaterial der Stufe zwei — sie gelten als ungeprüft und ersetzen nie die Prüfung durch deine Kolleginnen und Kollegen. Ob diese Suche verfügbar ist, entscheidet die Verwaltung über eine eigene Freigabestufe.",
  "shelp.extpage.resultsTitle":
    "Diese Liste zeigt die Treffer der externen Suche. Alles hier stammt von außerhalb und ist ungeprüft — darum wird es deutlich als extern markiert und nie automatisch übernommen. Du entscheidest selbst, ob du einen Treffer als Quelle der Stufe zwei anhängst. Gesichertes Wissen entsteht daraus erst, wenn Menschen es prüfen.",
  "shelp.ko.statement":
    "Das ist der Kern des Wissensobjekts: eine einzelne, klare Aussage darüber, was gilt. Alles andere auf dieser Seite — Bedingungen, Maßnahmen, Belege — hängt an diesem Satz. Lies die Aussage zuerst und prüfe dann darunter, wann sie gilt und worauf sie sich stützt.",
  "shelp.ko.conditions":
    "Bedingungen sagen dir, wann die Aussage gilt — und damit auch, wann nicht. Ein Beispiel: Eine Regel für den Winterbetrieb hilft dir im Sommer nichts. Prüfe vor dem Anwenden immer, ob deine Situation zu den genannten Bedingungen passt.",
  "shelp.ko.measures":
    "Maßnahmen beschreiben, was konkret zu tun ist, wenn die Aussage zutrifft — Schritt für Schritt. Sie sind bewusst knapp gehalten, damit sie im Alltag anwendbar bleiben. Fehlt dir ein Schritt oder ist etwas unklar, hinterlasse einen Kommentar; so wird das Wissen mit der Zeit besser.",
  "shelp.ko.provenance":
    "Hier steht, woher dieses Wissen stammt: wer es erfasst hat, wann es entstanden ist und ob es einmal übertragen wurde. Herkunft ist in KLARWERK keine Nebensache — nachvollziehbare Herkunft ist ein Teil des Vertrauens. Bei Rückfragen weißt du hier, an wen du dich wenden kannst.",
  "shelp.ko.lineageTitle":
    "Dieser Abschnitt zeigt die Verwandtschaft dieses Wissens: woraus es hervorgegangen ist und mit welchen anderen Objekten es zusammenhängt. So erkennst du, ob es Teil eines größeren Themas ist. Nutze die Verknüpfungen, um dich weiterzuhangeln, statt isolierte Einzelstücke zu lesen.",
  "shelp.nb.title":
    "Das Wissensnetz zeigt die Nachbarschaft des Beitrags, den du gerade liest: in der Mitte der Beitrag, darum herum, was über gemeinsame Schlagwörter dazugehört — und an jeder Verbindung steht, warum. Ein Klick auf einen Nachbarn macht ihn zur neuen Mitte; „Beitrag öffnen“ führt zum Artikel. Schlagwörter, die fast alle Beiträge tragen, zählen dabei nicht als Verwandtschaft — das steht dann ehrlich dabei.",
  "shelp.ko.history":
    "Jede inhaltliche Änderung erzeugt eine neue Version, und hier siehst du den Verlauf: wer wann was geändert hat und mit welcher Notiz. Ältere Stände bleiben erhalten, nichts wird still überschrieben. So kannst du nachvollziehen, wie sich das Wissen entwickelt hat.",
  "shelp.ko.evidenceTitle":
    "Evidenz sind die Belege hinter der Aussage: angehängte Quellen, Dokumente und Nachweise, jeweils der Version zugeordnet, zu der sie gehören. Je besser die Beleglage, desto belastbarer das Wissen — Vertrauen entsteht in KLARWERK aus Nachweisen, nicht aus Behauptungen. Ein Objekt ohne Evidenz ist nicht automatisch falsch, verdient aber einen kritischeren Blick.",
  "shelp.ko.snapshotsTitle":
    "Ein Schnappschuss ist der vollständige, eingefrorene Stand einer früheren Version. Hier kannst du nachlesen, wie das Objekt zu einem bestimmten Zeitpunkt genau aussah. Die Schnappschüsse sind nur zum Lesen da — verändern kann sie niemand, und genau das macht sie als Nachweis wertvoll.",
  "shelp.ko.comments":
    "Hier tauschen sich Kolleginnen und Kollegen zu diesem Objekt aus: Rückfragen, Ergänzungen, Einwände. Ein Kommentar ändert das Wissen selbst nicht — er ist ein Gespräch am Rand, das oft zu einer besseren nächsten Version führt. Wenn du etwas weißt, das hier fehlt, schreib es dazu.",
  "shelp.ko.attachments":
    "Hier liegen Dokumente und Bilder, die zu diesem Wissen gehören — etwa ein Foto der Anlage oder eine Anleitung. Anhänge sind Anschauungsmaterial und Belege, keine geprüften Aussagen. Beim Hochladen gelten Größengrenzen, die eure Verwaltung festlegt.",
  "shelp.lcy.assetTitle":
    "Manches Wissen hängt an einer bestimmten Maschine oder Einrichtung. Wenn sich dort etwas ändert — ein Umbau, ein Austausch, eine neue Einstellung — kannst du das hier melden. Die betroffenen Wissensobjekte kommen dann zur erneuten Prüfung, damit niemand mit veraltetem Stand arbeitet.",
  "shelp.lcy.pendingTitle":
    "Wissen altert. In dieser Liste stehen Objekte, deren Prüfung eine Auffrischung braucht — zum Beispiel weil sie lange nicht angefasst wurden oder weil sich ihr Umfeld geändert hat. Erneut geprüftes Wissen bleibt vertrauenswürdig; liegen gebliebene Auffrischungen sind ein stilles Risiko.",
  "shelp.lcy.pathTitle":
    "Ein Lernpfad ist eine sinnvolle Lese-Reihenfolge durch das vorhandene Wissen, zugeschnitten auf eine Rolle. Neue Kolleginnen und Kollegen arbeiten ihn Schritt für Schritt durch und haken ab, was sie gelesen haben. So wird aus einzelnen Wissensobjekten ein geführter Einstieg.",
  "shelp.out.kindTitle":
    "Hier wählst du, welche Art von Dokument aus eurem gesicherten Wissen entstehen soll — zum Beispiel eine Arbeitsanweisung, eine Checkliste oder eine Schulungsunterlage. Der Typ bestimmt Aufbau und Tonfall des Ergebnisses. Erzeugt wird erst, wenn du es auslöst; von selbst passiert hier nichts.",
  "shelp.out.sourcesTitle":
    "Für ein Dokument kommen nur geprüfte Wissensobjekte infrage, und genau die wählst du hier aus. Was nicht validiert ist, steht bewusst nicht zur Auswahl — ein erzeugtes Dokument soll sich nur auf gesichertes Wissen stützen. Wähle die Objekte, die inhaltlich zusammengehören.",
  "shelp.out.composeTitle":
    "Hier bringst du die ausgewählten Wissensobjekte in die Reihenfolge, in der sie im Dokument erscheinen sollen. Die Reihenfolge trägt die Logik des Ergebnisses — vom Überblick ins Detail oder entlang eines Ablaufs. Verschiebe die Einträge, bis der rote Faden stimmt.",
  "shelp.out.previewTitle":
    "Die Vorschau zeigt das Dokument so, wie es aus deinen Bausteinen erzeugt würde, im Textformat Markdown. Prüfe hier in Ruhe, ob Inhalt und Reihenfolge passen, bevor du das Ergebnis herunterlädst oder kopierst. Einen Export als PDF gibt es derzeit nicht.",
  "shelp.out.provenanceTitle":
    "Zu jedem erzeugten Dokument gehört der Nachweis, aus welchen Wissensobjekten es gebaut wurde. Dieser Abschnitt hält die Herkunft fest, damit jede Aussage im Dokument auf ihre Quelle zurückführbar bleibt. Das ist derselbe Grundsatz wie überall in KLARWERK: Erst der Beleg macht eine Aussage belastbar.",
  "shelp.imp.uploadTitle":
    "Hier spielst du einen früher erstellten Export im JSON-Format wieder ein. Die Einträge werden nicht blind übernommen: Sie landen zunächst als Kandidaten zur Durchsicht, damit nichts ungeprüft in den Bestand rutscht. Prüfe die Kandidatenliste, bevor du etwas übernimmst — auch, um Doppelungen zu vermeiden.",
  "shelp.ext.pipeline.title":
    "Dieser Bereich zeigt, was beim Einlesen externer Inhalte passiert ist: was erkannt wurde, was auffällig war und was noch auf eine Entscheidung wartet. Die Pipeline übernimmt nichts von allein — sie bereitet vor, Menschen entscheiden. Arbeite die Befunde am besten von oben nach unten ab.",
  "shelp.imp.queueTitle":
    "In dieser Warteschlange stehen eingelesene Quellen, die noch ein menschliches Urteil brauchen: übernehmen, überarbeiten oder verwerfen. Nichts daraus wird ohne deine Entscheidung Teil des Wissensbestands. Hier trennt sich Rohmaterial von gesichertem Wissen.",
  "shelp.mgmt.jumpTitle":
    "Diese Leiste ist das Inhaltsverzeichnis der Management-Sicht. Ein Tipp auf einen Eintrag springt direkt zum jeweiligen Abschnitt weiter unten. Sie ändert nichts an den Daten — sie hilft nur beim schnellen Navigieren.",
  "shelp.mgmt.overview":
    "Dieser Überblick fasst den aktuellen Zustand eures Wissensbestands in wenigen Kennzahlen zusammen — etwa wie viel Wissen vorhanden, geprüft oder in Arbeit ist. Er ist eine Momentaufnahme zur Orientierung, kein Zeugnis. Für Einzelheiten öffnest du die Abschnitte darunter.",
  "shelp.mgmt.capital":
    "Dieser Wert verdichtet den Zustand eures Wissensbestands zu einer einzigen Zahl — er berücksichtigt zum Beispiel, wie viel Wissen geprüft und wie gut es belegt ist. Lies ihn als grobe Einordnung und beobachte vor allem seine Entwicklung über die Zeit. Eine einzelne Zahl ersetzt nie den Blick in die Details.",
  "shelp.mgmt.valuation":
    "Dieser Abschnitt macht den Wert eures Wissens greifbarer: eine Einordnung, welche Bestände besonders viel zu Sicherheit und Handlungsfähigkeit beitragen. Die Zahlen sind Orientierungswerte aus dem Bestand, keine geprüfte Bilanz. Nutze sie, um Prioritäten zu besprechen, nicht als Buchhaltung.",
  "shelp.mgmt.statement":
    "Das Knowledge Statement ist ein zusammenfassender Bericht über euren Wissensbestand, gedacht für Leitung und Gremien. Er beantwortet in Kurzform: Was haben wir, wie belastbar ist es, und wo sind Lücken. Der Bericht speist sich aus den echten Beständen — was er nicht belegen kann, behauptet er nicht.",
  "shelp.mgmt.maturity":
    "Die Reifereise ordnet ein, wie weit eure Organisation im Umgang mit Wissen ist — von den ersten gesicherten Einträgen bis zum eingespielten Kreislauf aus Erfassen, Prüfen und Pflegen. Sie zeigt die nächste sinnvolle Etappe, keine Note. Reife wächst mit der Nutzung, nicht auf Knopfdruck.",
  "shelp.mgmt.house":
    "Das Wissenshaus ist ein Bild eurer Themenlandschaft: Räume stehen für Wissensgebiete, und du siehst auf einen Blick, welche gut gefüllt und welche fast leer sind. Leere Räume sind keine Schande, sondern eine Einladung — dort lohnt sich das nächste Erfassen. Tippe einen Bereich an, um hineinzuschauen.",
  "shelp.mgmt.recommendations":
    "Hier schlägt KLARWERK nächste Schritte vor, die sich aus eurem Bestand ergeben — zum Beispiel liegen gebliebene Prüfungen oder ein Wissensgebiet, das nur aus einer Quelle gespeist wird. Es sind Vorschläge, keine Aufträge: Du entscheidest, was davon dran ist. Jeder Vorschlag führt dich direkt zur passenden Stelle.",
  "shelp.mgmt.priorities":
    "Diese Liste ordnet Wissensthemen danach, wie dringend sie Aufmerksamkeit brauchen — bewertet über neun Gesichtspunkte, etwa Risiko, Alter und die Abhängigkeit von einzelnen Wissensquellen. Oben steht, was zuerst dran sein sollte. Die Reihenfolge ist eine Empfehlung als Gesprächsgrundlage, keine automatische Entscheidung.",
  "shelp.mgmt.pilot":
    "Dieser Bericht bündelt, was in den ersten dreißig, sechzig und neunzig Tagen eines Pilotbetriebs geschehen ist und was als Nächstes ansteht. Er macht den Fortschritt für alle Beteiligten sichtbar — ehrlich, mit erreichten und offenen Punkten. Gedacht als gemeinsame Grundlage für das Gespräch mit der Leitung.",
  "shelp.mrun.title":
    "Diese Liste protokolliert die letzten Einsätze der KI: welche Aufgabe lief, welches Modell geantwortet hat, wie lange es gedauert hat und ob ein Ersatzweg nötig war. Inhalte deiner Texte stehen hier bewusst nicht — nur technische Eckdaten. So bleibt nachvollziehbar, was die KI wann getan hat.",
  "shelp.rcfg.title":
    "Hier siehst du, welche KI für welche Aufgabe eingestellt ist — die Cloud-KI, eure On-Premise Enterprise AI oder der regelbasierte Modus ganz ohne Modell. Die Zuordnung lässt sich je Aufgabe ändern, und die App zeigt ehrlich an, was gerade wirksam ist. KI-Schlüssel bleiben dabei immer auf dem Server; im Browser landet nie einer.",
  "shelp.evx.title":
    "Der Evidenz-Index ist die Qualitätssicht auf die Beleglage: Er zeigt, welche Wissensobjekte gut belegt sind und wo Nachweise fehlen. Damit findest du gezielt die Einträge, die vor dem nächsten Einsatz Belege brauchen. Gut belegtes Wissen ist das Rückgrat jeder verlässlichen Antwort.",
  "shelp.prov.title":
    "Dieser Index prüft die Herkunftsseite der Qualität: Ist bei jedem Wissensobjekt nachvollziehbar, woher es stammt und wie es entstanden ist? Auffälligkeiten stehen oben, damit du sie zuerst siehst. Lückenlose Herkunft ist die Grundlage dafür, dass man Wissen später noch einordnen kann.",
  "shelp.readiness.title":
    "Dieser Abschnitt schätzt ein, wie startklar euer Wissenssystem als Ganzes ist — von der Datenbasis über die Prüfprozesse bis zur KI-Anbindung. Die Ampeln zeigen, wo es noch hakt und was als Nächstes sinnvoll ist. Es ist eine Standortbestimmung, keine Abnahme.",
  "shelp.kos.hintsTitle":
    "Hier sammelt die Qualitätssicherung konkrete Hinweise aus dem Bestand: Dinge, die auffällig sind und einen Blick verdienen — etwa dünn belegte Objekte oder verwaiste Themen. Jeder Hinweis nennt den Fundort, damit du direkt hinspringen und die Ursache beheben kannst.",
  "shelp.evFresh.title":
    "Belege altern genauso wie Wissen. Diese Sicht zeigt, wie frisch die Nachweise hinter euren Wissensobjekten sind und wo alte Belege eine Auffrischung brauchen. So erkennst du Einträge, die formal belegt, aber inhaltlich womöglich überholt sind.",
  // SCRUM-305: kompakte Einstiegsführung für den ersten echten Nutzerlauf.
  //
  // JOB 4022 (Steuerungs-Nachführung 14.09. 18:16, Codex' Bedienbefund 17:45): Die Karte sprach
  // Systemsprache — „Stage-1, ehrlich", „Review/Entscheidung", „Peers", „Revalidierung". Pedi
  // (16:49): „Es ist ein Unterschied, als wenn ein Anwender daran arbeitet oder du als System."
  // Alle Sätze dieser Karte stehen deshalb in Alltagssprache; die ZUSAGEN bleiben dieselben
  // (offen gespeichert, nichts automatisch freigegeben, nichts erfunden) — es ist eine
  // Übersetzung, keine neue Behauptung. Der alte Titel `pilot.title` ist damit fort.
  "pilot.access.title": "Der erste Arbeitsweg: so fängst du an",
  "pilot.access.subtitle":
    "Die sieben Schritte eines ersten Durchlaufs. Jeder Schritt führt in seinen Bereich oder nennt die Rolle, die er verlangt.",
  "pilot.access.summary":
    "Deine Rolle ({{rolle}}) kann {{offen}} von {{gesamt}} Schritten selbst gehen. Die übrigen stehen hier, damit du den ganzen Weg kennst.",
  "pilot.access.locked": "Nur mit der Rolle {{rolle}}",
  "pilot.access.roleUnknown":
    "Deine Rolle steht noch nicht fest. Welche Schritte für dich offen sind, steht hier, sobald sie bekannt ist.",
  "pilot.check.start":
    "Der Einstieg zeigt, was gerade ansteht — von hier aus beginnt jeder Arbeitsweg.",
  "pilot.check.library":
    "Die Bibliothek zeigt, was schon da ist: mit Quelle, Stand und Verlauf — Lesen steht jeder Rolle offen.",
  "pilot.check.capture":
    "Was du erfasst, wird zunächst offen gespeichert: es ist noch nicht geprüft.",
  "pilot.check.validation":
    "Beim Prüfen bewerten Kolleginnen und Kollegen deinen Eintrag, bis er als gesichert gilt — nichts wird automatisch freigegeben.",
  "pilot.check.use":
    "Fragen und Bibliothek zeigen zu jeder Antwort ihre Quelle und deren Stand — eine Antwort ist nur so verlässlich wie ihre Quelle.",
  "pilot.check.gap":
    "Fehlt die Grundlage, sagt die Antwort das ehrlich und führt zum Erfassen — es wird nichts erfunden.",
  "pilot.check.maintain":
    "„Aktuell halten“ heißt: Einträge, deren Prüfung fällig ist, werden erneut angesehen — nichts bleibt automatisch für immer gültig.",
  // SCRUM-306: der sichtbare nächste Schritt nach dem Demodaten-Start (keine Auto-Weiterleitung).
  //
  // JOB 4067 (Bedienbefund 14.09. 18:16, Rest von JOB 4022): die Karte sagte „Jetzt Stage-1 ansehen
  // oder die Pilot-Checkliste öffnen". „Stage-1" steht nirgends in der Oberfläche, und die Karte auf
  // `/hilfe` heisst seit JOB 4022 `pilot.access.title` — der Link nannte ein Ziel, das es unter
  // diesem Namen nicht gibt. Beides benennt jetzt, was die Fläche selbst zeigt: `nav.start` und den
  // heutigen Kartennamen. Der Ehrlichkeitssatz über Demodaten bleibt Wort für Wort.
  // DIE SCHLÜSSEL HEISSEN WEITER `pilot.next.*` — nur die Texte sind umgestellt. Ein Schlüsselname
  // ist kein angezeigter Text, und ein Umbenennen wäre eine Änderung an `lib/pilotNextSteps.ts`.
  "pilot.next.title": "Nächster Schritt",
  "pilot.next.hint":
    "Demodaten sind Beispiele, kein produktiver Beweis. Sieh dir jetzt den Start an oder öffne in der Hilfe den ersten Arbeitsweg.",
  "pilot.next.start": "Start öffnen",
  "pilot.next.checklist": "„Der erste Arbeitsweg: so fängst du an“ öffnen",
  "pilot.next.ask": "Beispiel-Frage öffnen",
  // SCRUM-307: einordnen, was im Alltag hakt — in die BESTEHENDEN Bereiche (kein Backend, keine
  // Speicherung, keine Jira-/Task-Automatik). Der Eintrag zur Bedienung bleibt bewusst ohne Link.
  //
  // JOB 4067: dieselbe Zuordnung, in denselben Worten, die die Oberfläche selbst benutzt (die
  // Navigationsnamen `nav.*` sind die Quelle, nicht die eigene Wortwahl). Die drei Zusagen der
  // Karte stehen unverändert: nichts wird gespeichert · kein Vorgang wird ausgelöst · reine
  // Bedienhinweise gehören nicht ins Produkt. Auch hier bleiben die SCHLÜSSELNAMEN `pilot.obs.*`.
  "pilot.obs.title": "Wenn etwas hakt: hier steht, wo es hingehört",
  "pilot.obs.subtitle":
    "Fünf Fälle aus dem Alltag — daneben steht, in welchem Bereich du weiterkommst. Nichts wird gespeichert, kein Vorgang wird ausgelöst; reine Bedienhinweise gehören nicht ins Produkt.",
  "pilot.obs.mapLabel": "Gehört in",
  "pilot.obs.missing.label": "Es fehlt ganz: zu der Frage gibt es noch keinen Eintrag.",
  "pilot.obs.missing.map":
    "Risiko & Lücken — dort steht, was fehlt und wie dringend es ist; danach erfassen.",
  "pilot.obs.unverified.label": "Ein Eintrag ist noch nicht fertig oder noch nicht geprüft.",
  "pilot.obs.unverified.map": "Validierung — dort wird er bewertet, bis er als gesichert gilt.",
  "pilot.obs.outdated.label": "Ein Eintrag wirkt veraltet oder gilt so nicht mehr.",
  "pilot.obs.outdated.map": "Lebenszyklus — dort wird er erneut angesehen („Aktuell halten“).",
  "pilot.obs.source.label":
    "Bei einem Eintrag ist unklar, woher er stammt oder wie verlässlich er ist.",
  "pilot.obs.source.map":
    "Bibliothek — dort stehen zu jedem Eintrag Quelle, Stand, Version und Status.",
  "pilot.obs.uxnote.label": "Es geht um die Bedienung selbst: Wortwahl, Ablauf, Weg.",
  "pilot.obs.uxnote.map":
    "Kein Bereich — das notierst du außerhalb; es wird nicht im Produkt gespeichert und löst keinen Vorgang aus.",
  "pilot.obs.openFlow": "Bereich öffnen",
  // ================================================================================================
  // JOB 4071 · DIE ZEHN ALTKAPITEL SPRECHEN ANWENDERSPRACHE (SCRUM-219/JOB 3468 abgelöst).
  // ================================================================================================
  //
  // Bis hierher stand hier „Bus-Faktor und Single-Source-Bereiche", „Evidence- und Provenance-Index,
  // ModelRun-Protokoll", „fällige Revalidierungen (z. B. nach Asset-Änderungen)" und „Nach dem
  // Demo-Seed" — Wörter, die nur die Bauleute kennen, auf einer Fläche, die Pedi als Demo-Zugang
  // aushändigt. Die Texte sind ERSETZT, nicht ergänzt; die Schlüssel bleiben, damit keine Fläche
  // ihren Erklärsatz verliert (`shell/ZahnradMenue.tsx:39-48` holt denselben Satz je Seite).
  //
  // DER MASSSTAB IST DER DER JOB-3741-KAPITEL WEITER UNTEN (`:5073-5076`): was ist das hier, was
  // kann ich tun, was ist der nächste Schritt — ohne Fachwort, ohne Zahl und ohne eine Aussage über
  // den Datenstand. Die Kapitel sind statische Sätze ohne Abruf und ohne Cache; in JEDEM Zustand
  // (laden, leer, Fehler, alter Cache, offline) steht dasselbe da, und genau deshalb darf keiner
  // von ihnen behaupten, was gerade im Bestand liegt.
  //
  // JEDE GENANNTE BESCHRIFTUNG IST DIE ECHTE: „Demodaten laden"/„Demodaten entfernen"
  // (`adm.seedButton` `:4710`, `adm.purgeButton` `:1011`), „Rohwissen erfassen"/„Prüfen & einreichen"
  // (`capture.flow.step.raw.label` `:957`, `capture.submit` `:2412`), „Freigeben"/„Rückfrage"/
  // „Ablehnen" (`val.actionApprove`/`.actionQuery`/`.actionReject` `:3395-3397`), „Wissen erfassen"
  // (`risk.gapCapture` `:4584`), „Anlage geändert …"/„Noch gültig → neue Version"/„Als erledigt
  // markieren" (`lcy.assetToggle` `:4592`, `lcy.stillValid` `:4589`, `lcy.stepComplete` `:4612`),
  // „Erweiterte Module" (`role.stage2` `:197`), „Auswertungen" (`nav.output` `:188`), die drei
  // Reiter der Handyfläche (`mob.tabCapture`/`.tabAsk`/`.tabLookup` `:5173-5175`) und „Zur
  // Vollversion" (`topbar.toDesktop` `:323`).
  //
  // WAS `help.risk.body` NICHT MEHR SAGT, und warum (Prüfer BEN, Runde 1). Dort stand „rot bedeutet
  // Einzelquelle: fällt dieser eine Mensch aus, ist das Wissen weg". Das ist mehr, als die Rechnung
  // hergibt: `LibraryService.busFactor` (`services/library-analytics/src/service.ts:2072-2087`)
  // zählt je Kategorie die verschiedenen `originalAuthor`-Werte der sichtbaren Wissensobjekte und
  // setzt `singleSource: true` bei `authors.size <= 1`. Belegt ist damit „alles kam von einer
  // einzigen Person" — eine ABHÄNGIGKEIT. Ob mit dieser Person Wissen verschwände, sagt die Zahl
  // nicht; das Festgehaltene bleibt ja stehen. Der Text nennt jetzt genau die Abhängigkeit und
  // verweist für die Gegenmaßnahmen auf die rote Zeile selbst, wo sie stehen
  // (`risk.singleSourceExplain` `:4557`). Diese Fläche behauptet weiterhin mehr; sie zu ändern ist
  // ein eigener Schnitt und liegt ausserhalb der Zielpfade dieses Auftrags.
  //
  // DER WÄCHTER dazu ist `tests/hilfe-altkapitel-anwendersprache/altkapitel-sprechen-anwendersprache.test.ts`:
  // er erhebt die Kapitelmenge aus `HELP_TOPICS`, hält Titel und Text aller drei Sprachen gegen die
  // erhobene Fachwortliste, misst die Länge gegen den Schnitt der Klara-Kante (700 Zeichen,
  // `components/KlaraAssistant.tsx:310` — siehe auch den Block bei `:5108-5111`) und pinnt in
  // Gruppe D mit der echten `filterHelpTopics`, dass die Umformulierung keinen Suchweg gekostet
  // hat. Die abgelösten Fachwörter leben als Suchmerkmale in `lib/helpTopics.ts` weiter; der Block
  // dort schreibt aus, was das kostet (die Merkmale sind auf der Karte SICHTBAR).
  "help.firststart.title": "Erststart & Demodaten",
  "help.firststart.body":
    "Eine frisch aufgesetzte Installation bringt kein Wissen mit — es gibt dann nichts zu lesen, nichts zu prüfen und nichts zu finden. Damit trotzdem sichtbar wird, wie KLARWERK arbeitet, legt „Demodaten laden“ unter Admin einen Beispielbestand an: Wissensobjekte, offene Prüfungen auf der Validierung, Wissenslücken und Widersprüche, an denen sich jeder Bereich gefahrlos ausprobieren lässt. „Demodaten entfernen“ nimmt ihn wieder weg; dein echter Bestand bleibt unberührt. Beides kann nur, wer Verwaltungsrechte hat. Nächster Schritt: Admin öffnen, „Demodaten laden“ anklicken und danach mit „Wissen erfassen“ weitermachen.",
  "help.library.title": "Bibliothek & Wissensobjekt",
  "help.library.body":
    "Die Bibliothek ist der gesamte Wissensbestand an einem Ort. Über das Suchfeld oben findest du einen Eintrag; Filter, Sortierung, gespeicherte Sichten und Export liegen im Menü „…“ über der Liste. Ein Klick öffnet das Wissensobjekt: seine Aussage, sein Stand und seine Quelle stehen sofort da; Quellen und Anhänge, Versionen, Historie, Kommentare und gemeldete Widersprüche liegen hinter „Mehr“. Auf einem schmalen Gerät trägt immer nur eines von beiden die Fläche — entweder die Liste oder der Eintrag. Nächster Schritt: einen Eintrag anklicken, die Aussage lesen und „Mehr“ öffnen.",
  "help.tasks.title": "Offene Aufgaben",
  "help.tasks.body":
    "Hier steht die offene Arbeit an einer Stelle: Objekte, die auf deine Prüfung in der Validierung warten, Rückfragen an dich, gemeldete Widersprüche, offene Wissenslücken und Objekte, die nach einer Anlagenänderung noch einmal bestätigt werden sollen. Ein farbiger Punkt zeigt die Dringlichkeit, die Knopfreihe darüber grenzt die Liste auf eine Art ein, und das „i“ an einer Zeile sagt, was dort zu tun ist. Jede Zeile führt genau dorthin, wo die Sache erledigt wird — sofern deine Rolle diesen Bereich sehen darf. Nächster Schritt: die oberste Zeile anklicken und sie abarbeiten.",
  "help.risk.title": "Risiko & Lücken",
  "help.risk.body":
    "Diese Seite zeigt, wo Wissen fehlt und wo es an einem einzigen Menschen hängt. Zu jeder offenen Wissenslücke steht der nächste Schritt dabei: die Dringlichkeit einschätzen, sie einer Fachperson zuweisen oder sie mit „Wissen erfassen“ schließen. Daneben sind die Fachgebiete danach eingefärbt, von wie vielen Personen das dort festgehaltene Wissen stammt — rot heißt: alles kam von einer einzigen Person, niemand sonst hat bisher dazu beigetragen. Was dagegen hilft, steht an der roten Zeile selbst. Nächster Schritt: eine rote Zeile ansehen, ihre Objekte öffnen und die dringendste Lücke jemandem zuweisen.",
  "help.lifecycle.title": "Lebenszyklus & Lernpfade",
  "help.lifecycle.body":
    "Wissen veraltet, wenn sich die Anlage ändert. Mit „Anlage geändert …“ meldest du eine solche Änderung und nennst die Anlagen- oder Prozess-Referenz; alle Objekte, die daran hängen, werden zur erneuten Prüfung markiert und erscheinen in der Liste der anstehenden Prüfungen. Wer sie durchgeht, entscheidet je Objekt: „Noch gültig → neue Version“ — oder es geht in die Nacharbeit; ist ein Objekt noch gar nicht freigegeben, führt der Weg zuerst zur Validierung. Daneben steht der Lernpfad deiner Rolle: Schritte zum Einarbeiten, die du mit „Als erledigt markieren“ abhakst. Nächster Schritt: eine Anlagenänderung melden oder den obersten Punkt deines Lernpfads abhaken.",
  "help.validation.title": "Validierung",
  "help.validation.body":
    "Hier liegen die Wissensobjekte, die auf eine Prüfung warten. Du liest die Aussage und entscheidest: „Freigeben“, „Rückfrage“ oder „Ablehnen“ — die letzten beiden verlangen eine Begründung, und das Objekt geht zurück in die Nacharbeit, statt freigegeben zu werden. Validiert ist ein Objekt erst, wenn genug grüne Bewertungen zusammengekommen sind und keine rote dagegensteht; wie viele noch fehlen, steht an jeder Karte. Nächster Schritt: das oberste Objekt öffnen, die Aussage lesen und dich entscheiden — bist du unsicher, ist die Rückfrage der richtige Weg.",
  "help.stufe2.title": "Erweiterte Module (Stufe 2): Kapital-Sichten & Auswertungen",
  "help.stufe2.body":
    "Über den Kernablauf hinaus gibt es zusätzliche Bereiche. Eine Admin-Person schaltet sie mit „Erweiterte Module“ frei; ohne diesen Schalter bleiben sie auch dann unsichtbar, wenn deine Rolle reichen würde. Die Kapital-Sichten lesen den Bestand als Zahlen: wie viel Wissen da ist, wie viel davon geprüft wurde, was offen ist — dazu eine Schätzung des Werts, deren Annahmen du selbst einträgst. Die Zahlen zeigen nur an; am Wissen ändert sich dadurch nichts. Unter „Auswertungen“ entsteht aus validierten Wissensobjekten ein Dokument. Nächster Schritt: eine Kennzahl ansehen oder eine Dokumentart wählen.",
  "help.mobile.title": "Mobil & Offline",
  "help.mobile.body":
    "Die mobile Ansicht zeigt KLARWERK in Telefonbreite, mit den Reitern „Erfassen“, „Fragen“ und „Suchen“: unterwegs etwas festhalten, etwas wissen wollen, etwas nachschlagen. Einen Entwurf anlegen darf nur, wer die Berechtigung dazu hat; wer lesen darf, kann hier fragen und suchen. Ohne Verbindung wird allein das Speichern eines Entwurfs vorgemerkt und später nachgetragen — Fragen und Suchen sagen dann offen, dass sie eine Verbindung brauchen. Prüfen, Freigeben und Widersprüche klären gibt es hier nicht; dafür führt oben „Zur Vollversion“ zurück. Nächster Schritt: einen Reiter antippen.",
  "help.capture.title": "Wissen erfassen",
  "help.capture.body":
    "Hier hältst du fest, was du weißt: tippen, diktieren, fotografieren oder eine vorhandene Datei mitbringen. Die KI bringt das Rohe in Form — sie schlägt vor, du entscheidest, und gespeichert wird nichts von allein. Der Weg führt in Schritten von „Rohwissen erfassen“ über das Strukturieren bis zu „Prüfen & einreichen“; fertige Schritte kannst du wieder anklicken, ohne etwas zu verlieren. Was du einreichst, wird ein Wissensobjekt, das Kollegen prüfen — bis dahin bleibt es dein Entwurf. Nächster Schritt: „Wissen erfassen“ öffnen und in eigenen Worten anfangen; Stichpunkte reichen.",
  // JOB 3468 (REVIEW26-HILFE-IMPORT): Die Hilfesuche „import" blieb leer, obwohl der Weg existiert.
  // Der Text ist eine ANLEITUNG und nennt Fläche, Modus und Knopf mit ihren echten Beschriftungen
  // (`nav.capture`, `erfassen.weg.datei`, `capture.file.pick`, `capture.file.importMode.*`) — wer
  // einen davon umbenennt, macht `tests/review26-hilfe-import/hilfe-karte-dateiimport.test.tsx`
  // (D3) rot. KEINE ZAHL steht darin: Anzahl und Größe kommen vom Server und werden auf der Karte
  // von `UploadLimitsHint` gezeigt. Keine zeitabhängige Aussage („derzeit", „aktuell") — die
  // Formatliste ist aus `lib/extract.ts` erhoben und wird von Q1/Q2 dort festgehalten.
  "help.fileimport.title": "Datei importieren: Word, PDF, PowerPoint, Text und Bild",
  "help.fileimport.body":
    "Der Weg beginnt unter „Wissen erfassen“: im Werkzeug „Datei“ den Eintrag „Datei importieren“ wählen und dort mit „Datei auswählen“ ein Dokument öffnen — oder es auf die Ablagefläche ziehen.\n\nDanach entscheidest du, was daraus wird: „In Punkte analysieren“ schlägt einzelne Wissenspunkte mit Belegstelle vor, und du wählst aus, was übernommen wird; „Ganzes Dokument übernehmen“ legt genau einen vollständigen Entwurf an. Gespeichert wird nichts ohne dein Zutun; ein angelegter Entwurf ist ungeprüft und nicht eingereicht.\n\nAngenommen werden Textdateien (.txt, .md, .markdown, .csv, .log, .json), Word (.docx), PDF, PowerPoint (.pptx) und Bilder.",
  "help.validate.title": "Validieren",
  "help.validate.body":
    "Bewerte Objekte grün/gelb/rot. Ab der Schwelle gilt ein Objekt als validiert; rote Bewertungen gehen zurück an den Autor.",
  "help.ask.title": "Fragen stellen",
  "help.ask.body":
    "Stell deine Frage in eigenen Worten. Die Antwort wird aus dem vorhandenen Wissen zusammengestellt und nennt die Wissensobjekte, auf die sie sich stützt. An jedem steht sein Stand, du siehst also, wie belastbar die Grundlage ist. Fehlt eine Grundlage, wird nichts erfunden: es entsteht eine Wissenslücke, die unter „Risiko & Lücken“ auftaucht und dort jemandem zugewiesen werden kann. Nächster Schritt: eine Frage eintippen und von der Antwort aus in eines der genannten Wissensobjekte springen.",
  "help.conflict.title": "Konflikte",
  "help.conflict.body":
    "Widersprüche werden sichtbar gemacht und geführt aufgelöst. Nur Wahrheitskonflikte eskalieren an einen Menschen.",
  "help.roles.title": "Rollen",
  "help.roles.body":
    "Viewer liest und fragt, Experte erfasst, Controller validiert und klärt, Admin verwaltet. Du siehst nur, was deine Rolle erlaubt.",
  "help.trust.title": "Vertrauen",
  "help.trust.body":
    "Jede Aussage trägt einen Reifegrad aus Validierung und Nutzung. Vertrauen ist Evidenz, nicht Wahrheit.",
  // JOB 3741 (SEITENHILFE-LUECKEN): die zehn Menüpunkte, die im Zahnrad unter „Seitenhilfe" bis
  // hierher nur die Leermeldung trugen. Jeder Text beantwortet drei Fragen — was ist das hier, was
  // kann ich tun, was ist der nächste Schritt — ohne Fachwort, ohne Zahl und ohne eine Aussage über
  // den Datenstand (die wäre ohne Abruf unwahr; siehe Kopf von `lib/helpTopics.ts`).
  "help.wissensnetz.title": "Themenkarte",
  // RUNDE 2, Korrekturpflicht 1 (Codex/BEN): Runde 1 beschrieb ausschließlich die Zeichnung. Die
  // gibt es auf schmalen Fenstern GAR NICHT — unter 900 px (`pages/Wissensnetz.tsx`, `LESEN_UNTER`)
  // tritt die Leseansicht an ihre Stelle, und den Umschalter gibt es dann auch nicht. Der Text
  // nennt jetzt beide Darstellungen mit ihrem echten nächsten Schritt und beschriftet den
  // Umschalter mit seinen echten Wörtern (`wissensnetz.lesen.netz`/`.lesen`) — wer sie umbenennt,
  // macht `tests/seitenhilfe-navkapitel/die-texte-stimmen-mit-der-seite.test.tsx` (K1) rot.
  "help.wissensnetz.body":
    "Die Themenkarte zeigt den Wissensbestand von oben: welche Themen es gibt und welche davon zusammen in denselben freigegebenen Wissensobjekten vorkommen. Auf einem breiten Fenster wählst du oben zwischen „Netz“ und „Lesen“ — das Netz zeichnet jedes Thema als Kreis und legt dir die Wissensobjekte dazu an die Seite, sobald du einen Kreis anklickst; ist das Fenster schmal, gibt es die Zeichnung nicht und auch nichts zu wählen, sondern gleich die Leseansicht. In beiden Fällen steht darunter zu jedem Thema ein Satz mit dem Weg zu seinen Objekten: such dir das Thema, das dich betrifft, und geh von dort weiter.",
  "help.extern.title": "Externes Wissen",
  "help.extern.body":
    "Hier durchsuchst du Quellen außerhalb von Klarwerk, ohne vorher ein Wissensobjekt öffnen zu müssen. Du gibst einen Suchbegriff ein und bekommst die Treffer mit ihrer Adresse zurück; ist die externe Suche abgeschaltet oder nicht erreichbar, sagt die Seite das offen, statt eine leere Liste zu zeigen. Gefundenes wandert nicht von selbst in den Bestand — was du brauchst, erfasst du anschließend als eigenes Wissensobjekt.",
  "help.konflikte.title": "Konflikte",
  "help.konflikte.body":
    "Ein Konflikt ist ein Widerspruch: zwei Wissensobjekte sagen etwas über dieselbe Sache, und beides zusammen kann nicht stimmen. Die Seite stellt die zwei Aussagen nebeneinander und lässt dich wählen, welche gilt, ob beide je nach Zusammenhang gelten oder ob gar kein Widerspruch vorliegt. Deine Wahl wird als Vermerk festgehalten, gelöscht wird nichts; nimm dir ein Paar vor und lies beide Aussagen, bevor du entscheidest.",
  "help.duplikate.title": "Duplikate",
  // JOB 3890 — DER HALBSATZ SAGT JETZT, WAS DER KNOPF SAGT. Bis hierher versprach das Kapitel „ob
  // beide bleiben und verknüpft werden" — verknüpft wird nichts: `linkRelated` ruft
  // `close(id, by, note, "linked_related", …)` (services/conflicts/src/overlap-service.ts:673-675),
  // und `close` schreibt AUSSCHLIESSLICH `status`, `resolution` und `closedAt` plus einen
  // Audit-Eintrag (`:732-749`). Der Text trägt darum die Worte des Knopfes selbst (`dup.side.both`,
  // `:3655`) und die Verneinung des Zahnradtextes darunter (`:3691`); wohin der entschiedene Fund
  // geht, sagt `unresolved()` (`:933`, auf der Fläche gemessen in DU4b).
  //
  // DER ORT STEHT HIER NICHT, UND ZWAR GEMESSEN (Runde 3, zwei fremde Wächter im Tor rot):
  //   (1) Die Hilfe-Suche ist eine Teilstring-Suche über Titel + Text + Merkmale
  //       (`lib/helpTopics.ts:318-330`). Sobald das Kapitel „Bibliothek" wörtlich nannte, fand die
  //       Suche nach „bibliothek" auch dieses Kapitel — und
  //       `tests/review26-hilfe-import/hilfe-findet-dateiimport.test.ts:311` hält fest, dass sie
  //       GENAU `["library"]` liefert („expected [ 'library', 'duplikate' ] to deeply equal
  //       [ 'library' ]"). Dieser Test liegt außerhalb der Zielpfade dieses Jobs.
  //   (2) Klara reicht jeden Hilfetext bei 700 Zeichen beschnitten an die Modellkante
  //       (`components/KlaraAssistant.tsx:310`); mit dem Ortssatz war dieser Wert 714 Zeichen lang
  //       und ging gekürzt hinaus (`tests/app/f0304-klara-assistenzflaeche.test.tsx`, A3:
  //       „topic:duplikate: Text beschnitten (700/714)"). Die Länge hält jetzt DU5g fest.
  // WO die beiden Objekte danach stehen, sagt auf `/duplikate` weiterhin der Zahnradtext darunter
  // (`dup.seitenhilfe.entscheidung.text`, `:3691`, gemessen in DU5c); auf `/hilfe` steht das
  // Kapitel ohne ihn (`pages/Help.tsx:163`) — dort fehlt die Auskunft. Das ist offen gemeldet.
  "help.duplikate.body":
    "Zwei Wissensobjekte, die weitgehend dasselbe sagen, landen hier als Paar. Anders als beim Konflikt widersprechen sie sich nicht, sie doppeln sich. Du entscheidest, welche Seite maßgeblich ist, ob beide bleiben und als verwandt vermerkt werden oder ob es gar kein Duplikat ist; zusammengeführt und gelöscht wird dabei nichts, es entsteht ein Vermerk, und auch „als verwandt vermerken“ legt keine Verknüpfung in den Objekten an. Der entschiedene Fund verschwindet aus der Liste und aus der Zahl am Reiter; verloren ist damit nichts, denn beide Wissensobjekte bleiben unverändert bestehen. Nimm dir ein Paar vor und vergleiche die beiden Texte.",
  "help.analytics.title": "Analytics & Audit",
  "help.analytics.body":
    "Diese Seite bündelt die Auswertung über den gesamten Bestand und daneben das Protokoll der Vorgänge: Kennzahlen zu Validierung, Vertrauen, Lücken und Auslastung auf der einen Seite, die nachvollziehbare Liste dessen, was geschehen ist, auf der anderen. Du kannst das Protokoll nach Art des Vorgangs und nach handelnder Person filtern, um einer einzelnen Frage nachzugehen. Such dir eine Kennzahl aus und geh ihrer Herkunft im Protokoll nach.",
  "help.output.title": "Auswertungen",
  "help.output.body":
    "Aus vorhandenem Wissen entsteht hier ein Dokument. Du wählst die Art des Dokuments, stellst die Wissensobjekte zusammen, die hineingehören, und bringst sie in die Reihenfolge, in der sie erscheinen sollen; eine Vorschau zeigt die Zusammenstellung, bevor das Dokument erzeugt wird. Beginne mit der Art des Dokuments, danach wählst du die Quellen dazu aus.",
  "help.import.title": "Import & Quellen",
  // RUNDE 2, Korrekturpflicht 3 (Codex/BEN): „danach rückt der nächste nach" war falsch. Die
  // Prüfliste zeigt JEDEN Kandidaten, auch den entschiedenen (`listImportCandidates` filtert nicht,
  // `services/library-analytics/src/service.ts`; `pages/Stufe2.tsx` rendert `candidates.map`), und
  // sie liegt in einem standardmäßig ZUGEKLAPPTEN Bereich (`components/ImportHistory.tsx`: ein
  // `<details>` ohne `open`). Beides steht jetzt im Text und wird von K3 gemessen.
  "help.import.body":
    "Hier läuft der Import fremder Quellen: oben wählst du eine Quelle, siehst nach, was in ihr steht, und legst daraus Vorschläge an — hineingelesen wird nur, was du auswählst. Die Vorschläge selbst liegen darunter im zugeklappten Bereich „Review-Verlauf“, dessen Zähler nennt, wie viele davon offen sind; klapp ihn auf und entscheide einen mit „Annehmen“ oder „Ablehnen“, oder hinterlege eine Notiz. Entschiedene Vorschläge verschwinden nicht und schieben nichts nach — sie bleiben mit ihrem Stand in der Liste stehen, den nächsten offenen suchst du dir selbst.",
  "help.graph.title": "Wissensgraph",
  // JOB 3889, Korrektur (Bestellung: `archiv/3795/runde-5/RUECKGABE.md:67`): der mittlere Satz
  // versprach Klick und Tastatur OHNE Bedingung, während die Seitenhilfe derselben Seite
  // (`seitenhilfe.graph.text`) sie nennt — im Zahnrad standen beide untereinander. Navigierbar ist
  // ein Knoten nur, wenn sein Objekt im Bestand liegt (`lib/graphNav.ts:12`); sonst trägt er weder
  // Rolle noch Tabstopp (`pages/Stufe2.tsx:2157`, `:2159`). DE/EN/NL gemessen in GF3d und GF3g.
  "help.graph.body":
    "Der Wissensgraph zeichnet die einzelnen Wissensobjekte und ihre Verbindungen als Netz — näher am Objekt als die Themenkarte, die nach Themen zusammenfasst. Gehört ein Knoten zu einem Objekt aus dem Bestand, führt ein Klick auf ihn zu diesem Wissensobjekt, und mit der Tastatur erreichst du ihn ebenso; ein Knoten ohne solches Objekt ist kein Link und liegt nicht in der Tastatur-Reihenfolge. Fang bei einem Objekt an, das du kennst, und folge seinen Linien.",
  // JOB 4309: das Kapitel zum neuen Menüpunkt „Gesamtanweisungen". Der Titel trägt den ANGEZEIGTEN
  // Namen des Punkts (`ga.bereich.titel`), damit die Suche auf `/hilfe` unter genau dem Wort
  // anschlägt, das im Menü steht. Der Text verspricht NICHTS, was die Seite nicht kann.
  // FE-001: der frühere Satz „eine Liste aller Anweisungen gibt es nicht" ist seit JOB 4357 falsch
  // (die Übersicht zeigt den Bestand) und ist ersetzt; nutzerseitig heisst der Bereich jetzt
  // „Arbeitsanleitungen". Die Hilfe beschreibt die heutige Bedienung und braucht kein Modell.
  "help.gesamtanweisungen.title": "Arbeitsanleitungen zusammenstellen",
  "help.gesamtanweisungen.body":
    "Arbeitsanleitungen sind lesbare Schritt-für-Schritt-Dokumente aus vorhandenem Wissen – zum Beispiel für die Einarbeitung neuer Mitarbeitender. Die Übersicht zeigt alle Anleitungen, die du lesen darfst; ein Klick auf den Titel öffnet eine. Neu beginnst du mit einem Titel und „Neue Arbeitsanleitung erstellen“. In der geöffneten Anleitung beschreibst du Zweck, Geltungsbereich und Voraussetzungen, suchst vorhandene Einträge nach Titel und nimmst je eine feste Fassung als Abschnitt auf – eine spätere Änderung am Eintrag verändert den Abschnitt nicht still. Die Lesefassung zeigt das Ergebnis; die Reihenfolge änderst du mit „Nach oben“ und „Nach unten“. Zum Schluss legst du die ganze Anleitung zur Entscheidung vor; entscheiden können Personen mit Prüfrecht. „Was hat sich geändert?“ vergleicht zwei gespeicherte Stände. Eine automatische fachliche Prüfung ist noch nicht angebunden, und für all das wird keine KI gebraucht.",
  "help.hilfe.title": "Hilfe",
  "help.hilfe.body":
    "Auf dieser Seite stehen alle Hilfekapitel beieinander, mit einem Suchfeld darüber; jedes Kapitel trägt einen Link auf die Seite, um die es geht. Gesucht wird in Titel, Text und Schlagwörtern der Kapitel — tipp also ruhig das Wort ein, mit dem du dein Problem beschreiben würdest. Gibt es dazu nichts, sagt die Seite das offen, statt ein unpassendes Kapitel zu zeigen.",
  "help.profil.title": "Profil",
  // RUNDE 2, Korrekturpflicht 2 (Codex/BEN): „liegt das an deiner Rolle" war falsch — `canSee`
  // (`app/navigation.ts`) blendet einen Bereich AUCH bei ausreichender Rolle aus, wenn die
  // erweiterten Module ausgeschaltet sind. Der Text nennt jetzt beide Gründe; K2 belegt sie an
  // derselben Funktion mit unveränderter Rolle.
  "help.profil.body":
    "Im Profil stehen deine eigenen Angaben: Name und Rolle, E-Mail-Adresse, die Sprache der Oberfläche und der Weg zum Abmelden. Du kannst die Sprache hier umstellen und dein Passwort ändern; unter „Meine Wirkung“ siehst du Zahlen ausschließlich zu deinen eigenen Beiträgen. Fehlen dir Bereiche im Menü, kann das an deiner Rolle liegen — sie steht hier neben deinem Namen — oder daran, dass die erweiterten Module ausgeschaltet sind; diesen Schalter führt „Einstellungen“, und er braucht Verwaltungsrechte.",
  "mob.title": "Schnell festhalten",
  "mob.sub": "An der Anlage. In unter zwei Minuten.",
  "mob.dictate": "Diktat aufnehmen",
  "mob.dictateSub": "Sprechen — die KI strukturiert",
  "mob.note": "Notiz",
  "mob.photo": "Foto",
  "mob.interview": "Interview",
  "mob.lookup": "Nachschlagen",
  // FR-MOB-02 / FR-CAP-04: Erfassungsart Notiz/Interview und Fotos am Handy. Die Interviewfragen
  // sind wörtlich die feste Folge des Servers (services/reasoner/src/provider.ts, INTERVIEW_QUESTIONS).
  "mob.modusGruppe": "Erfassungsart",
  "mob.modusGesperrt": "Erst speichern oder leeren, dann die Erfassungsart wechseln.",
  "mob.iv.frage1": "Worum geht es? Formuliere die Kernaussage in einem Satz.",
  "mob.iv.frage2": "Unter welchen Bedingungen oder ab wann gilt das?",
  "mob.iv.frage3": "Welche Maßnahme oder Konsequenz folgt daraus?",
  "mob.iv.frage4": "Welche Stichworte/Tags helfen beim Wiederfinden? (kommagetrennt)",
  "mob.iv.fortschritt": "Frage {{nummer}} von {{gesamt}}",
  "mob.iv.weiter": "Nächste Frage",
  "mob.iv.zurueck": "Vorige Frage",
  "mob.iv.hinweis": "Jede Antwort steht sofort im Entwurf — speichern geht nach jeder Frage.",
  "mob.foto.kamera": "Kamera",
  "mob.foto.mediathek": "Mediathek",
  "mob.foto.entfernen": "Foto entfernen",
  "mob.foto.fehler": "Das Foto konnte nicht gelesen werden.",
  "mob.foto.max": "Höchstens {{max}} Fotos je Entwurf.",
  "mob.foto.inArbeit": "Foto wird vorbereitet … gespeichert werden kann gleich.",
  "mob.editing": "Entwurf wird fortgesetzt.",
  "mob.formTitle": "Kernaussage",
  "mob.formStatement": "Was ist passiert / was gilt?",
  "mob.save": "Als Entwurf speichern",
  "mob.saved": "Entwurf gespeichert.",
  "mob.update": "Entwurf aktualisieren",
  "mob.updated": "Entwurf aktualisiert.",
  "mob.new": "Neu",
  "mob.drafts": "Meine Entwürfe",
  "mob.draftsEmpty": "Noch keine Entwürfe.",
  "mob.resume": "Fortsetzen",
  "mob.discard": "Verwerfen",
  "mob.discarded": "Entwurf verworfen.",
  "mob.discardConfirmHint": "Verwerfen?",
  "mob.confirmDiscard": "Ja, verwerfen",
  "mob.cancelDiscard": "Abbrechen",
  "mob.tabCapture": "Erfassen",
  "mob.tabAsk": "Fragen",
  "mob.tabLookup": "Suchen",
  "mob.searchPlaceholder": "Wissen durchsuchen …",
  "mob.searchEmpty": "Keine Treffer.",
  "mob.online": "online",
  "mob.offline": "offline",
  "mob.queued": "Offline gespeichert – wird synchronisiert.",
  "mob.queue": "Warteschlange",
  "mob.syncNow": "Synchronisieren",
  "mob.syncOk": "Synchronisiert",
  "mob.syncFail": "Sync fehlgeschlagen",
  "mob.offlineSaveHint": "Offline – Speichern wird lokal vorgemerkt.",
  "mob.offlineAsk": "Offline – Fragen brauchen eine Verbindung.",
  "mob.offlineSearch": "Offline – Suche braucht eine Verbindung.",
  "mob.offlineNeedsConn": "Sobald wieder Verbindung besteht, ist dies verfügbar.",
  "mob.status.queued": "wartet",
  "mob.status.pending": "läuft",
  "mob.status.synced": "fertig",
  "mob.status.failed": "Fehler",
  // JOB 4354 — NUR DER NAME DER MELDUNG, NICHT IHR INHALT. Der Grund selbst ist der Satz des
  // Servers (`op.error`, Katalog `services/auth/src/meldungen.ts`); hier steht ausschliesslich,
  // WOZU er gehört — für alle, die die Titelzeile darüber nicht sehen. Ein übersetzter Grund an
  // dieser Stelle wäre ein zweiter Meldungskatalog neben der Antwort.
  "mob.vorgang.grund": "Abgewiesen — {{titel}}",
  // JOB 4193 — DIE RÜCKFRAGE BEI VERALTETEM STAND (Mobil). Sie sagt, was los ist, welches FELD
  // auseinanderläuft und welche zwei Wege es gibt. Keine rohe Servermeldung, kein „gespeichert".
  "mob.stand.laedt": "Der gespeicherte Stand wird geholt …",
  "mob.stand.pruefungFehlt":
    "Der gespeicherte Stand lässt sich gerade nicht prüfen. Dein Text bleibt stehen — versuche es noch einmal, bevor du speicherst.",
  "mob.stand.erneutPruefen": "Noch einmal prüfen",
  "mob.stand.titelSpeichern":
    "Dieser Entwurf wurde inzwischen woanders geändert. Dein Stand wurde NICHT gespeichert, und überschrieben wurde nichts.",
  "mob.stand.titelOffline":
    "Von diesem Entwurf liegt eine offline gespeicherte Fassung — und auf dem Server steht inzwischen eine andere.",
  "mob.stand.felder": "Unterschiedlich",
  "mob.stand.feld.title": "Titel",
  "mob.stand.feld.statement": "Kernaussage",
  "mob.stand.feld.body": "Text",
  "mob.stand.holen": "Neuen Stand holen",
  "mob.stand.behalten": "Meine Fassung behalten",
  "mob.stand.offlineFassung": "Offline gespeichert",
  "mob.stand.serverFassung": "Aktueller Serverstand",
  "mob.stand.meineFassung": "Deine vorherige Fassung — nicht gespeichert",
  "mob.stand.verwerfen": "Verwerfen",
  "mob.stand.offlineHinweis":
    "Ohne Verbindung wird nichts abgeglichen. Ob jemand anders diesen Entwurf geändert hat, zeigt sich beim Wiederöffnen mit Verbindung.",
  "mob.stand.syncAbgewiesen":
    "Nicht nachgesendet: der Entwurf wurde woanders geändert. Öffne ihn, um zu entscheiden, welche Fassung gilt.",
  // JOB 4193 R5 (BENs Befund): zwei Sätze für zwei Sperren, die beide Datenverlust verhindern.
  "mob.stand.erstAufloesen":
    "Erst die Rückfrage auflösen: für diesen Entwurf steht noch offen, welche Fassung gilt. Wähle „Neuen Stand holen“ oder „Meine Fassung behalten“ — solange wird nichts gespeichert.",
  "mob.stand.syncBrauchtStand":
    "Nicht nachgesendet: zu diesem älteren Eintrag fehlt der Stand, gegen den er gelten soll. Er bleibt liegen — öffne den Entwurf, dann wird verglichen und gesendet.",
  "mob.ausgangUnklar":
    "Die Antwort ist ausgeblieben — ob gespeichert wurde, ist unklar. Lade die Entwürfe neu und sieh nach, bevor du erneut speicherst.",
  // JOB 4249 — DIE WARTESCHLANGE LIEGT AM GERÄT, SIE GEHÖRT ABER EINEM KONTO.
  // Sechs Sätze für sechs Lagen. Keiner behauptet etwas über einen Bestand, der gerade nicht
  // feststeht, und keiner verspricht, dass etwas verschwunden sei.
  "mob.konto.laedt": "Hier liegen noch Vorgänge. Wem sie gehören, wird gerade geprüft …",
  "mob.konto.unbekannt":
    "Hier liegen noch Vorgänge. Wer angemeldet ist, lässt sich gerade nicht feststellen — deshalb wird nichts gesendet und nichts gelöscht. Melde dich neu an, dann geht es weiter.",
  "mob.konto.eigeneLeer": "Von dir wartet nichts.",
  "mob.konto.fremdeWarten":
    "Von einem anderen Konto liegen hier Vorgänge. Sie werden nicht gesendet und nicht gelöscht — sie warten, bis sich dieses Konto wieder anmeldet.",
  "mob.konto.ohneBindungWarten":
    "Zu diesen älteren Vorgängen ist kein Konto hinterlegt. Sie werden niemandem zugeordnet und nicht gelöscht — melde dich mit dem Konto an, von dem sie stammen.",
  "mob.konto.fremdeNichtGesendet": "Nicht gesendet: gehört einem anderen Konto.",
  "mob.konto.ohneBindungNichtGesendet":
    "Nicht gesendet: zu diesen älteren Vorgängen ist kein Konto hinterlegt. Sie bleiben liegen.",
  "mob.konto.syncWartet":
    "Es wurde nichts gesendet: wer angemeldet ist, steht gerade nicht fest. Alles bleibt liegen.",
  "mob.konto.speichernWartet":
    "Noch nicht gespeichert: wer angemeldet ist, steht gerade nicht fest. Dein Text bleibt stehen — versuche es gleich noch einmal.",
  "mob.konto.laufAngehalten":
    "Das Senden wurde angehalten, weil das Konto gewechselt hat. Die übrigen Vorgänge bleiben liegen und gehören weiter dem Konto, das sie erfasst hat.",
  "mob.konto.auffrischung":
    "Wer angemeldet ist, wird gerade bestätigt. Bis die Antwort da ist, wird nichts gesendet — es geht von selbst weiter.",
  // JOB 4333 — DIE SITZUNGSFRAGE BLIEB OHNE ANTWORT. Der Satz sagt ausdrücklich NICHT, dass jemand
  // angemeldet sei, und verspricht keine Übertragung: er nennt den Ort der Arbeit (dieses Gerät)
  // und die Bedingung, unter der es weitergeht (wieder Netz, wieder eine Antwort). Die Zeile über
  // die Warteschlange selbst bleibt `mob.konto.unbekannt` — sie sagt schon das Richtige.
  "mob.sitzung.unbeantwortet":
    "Ohne Netz — die Anmeldung konnte nicht geprüft werden. Was du hier erfasst hast, liegt weiter auf diesem Gerät. Gesendet wird erst, wenn wieder Netz da ist und feststeht, wer angemeldet ist.",
  // JOB 4333 R2: Der Satz an jeder Stelle, an der sonst SERVERINHALT stünde. Er behauptet
  // ausdrücklich NICHT, es gebe nichts („keine Entwürfe" wäre hier gelogen) — er sagt, dass nichts
  // gezeigt WIRD, und warum.
  "mob.sitzung.nurLokal":
    "Ohne bestätigte Anmeldung wird hier nichts vom Server gezeigt — auch nichts aus einem früheren Abruf. Sichtbar ist nur, was auf diesem Gerät liegt.",
  "s2.kicker": "Erweitert · Stufe 2",
  "s2.output":
    "Aus validierten Objekten Arbeitsanweisungen/Checklisten erzeugen — aktiv, sobald die Output-Logik steht.",
  "out.kindTitle": "Output-Typ",
  "out.sourcesTitle": "Validierte Quellen",
  "out.noValidated": "Noch keine validierten Wissensobjekte vorhanden.",
  "out.generate": "Output erzeugen",
  "out.composeTitle": "Reihenfolge & Komposition",
  "out.composeHint":
    "Reihenfolge der Bausteine festlegen — sie wird beim Generieren genau so übernommen.",
  "out.moveUp": "Nach oben",
  "out.moveDown": "Nach unten",
  "out.removeFromOrder": "Aus Auswahl entfernen",
  "out.previewCompositionTitle": "Kompositionsvorschau",
  "out.previewSummary": "{{kind}} aus {{n}} validierten Bausteinen in dieser Reihenfolge.",
  "out.previewProvenance": "Volle Herkunft je Baustein wird im erzeugten Dokument ausgewiesen.",
  "out.previewUncertain":
    "{{n}} Baustein(e) mit niedrigem Vertrauen — im Dokument als unsicher markiert.",
  "out.previewDisclaimer":
    "Vorschau der Komposition, nicht das fertige Dokument. Erzeugung erfolgt beim Generieren.",
  "out.previewTitle": "Vorschau (Markdown)",
  "out.copy": "Kopieren",
  "out.copied": "Markdown kopiert.",
  "out.download": "Download .md",
  "out.provenanceTitle": "Herkunft & Nachweis",
  "out.uncertain": "niedriges Vertrauen",
  "out.genError": "Output konnte nicht erzeugt werden.",
  "out.kind.instruction": "Arbeitsanweisung",
  "out.kind.checklist": "Checkliste",
  "out.kind.troubleshooting": "Störungshilfe",
  "out.kind.training": "Schulung",
  "out.kind.management_summary": "Management-Summary",
  "out.kindDesc.instruction": "Schritt-für-Schritt-Anleitung (SOP).",
  "out.kindDesc.checklist": "Abhakbare Punkte für die Praxis.",
  "out.kindDesc.troubleshooting": "Symptom → Ursache → Maßnahme.",
  "out.kindDesc.training": "Lerneinheiten mit Kernaussagen.",
  "out.kindDesc.management_summary": "Verdichteter Überblick mit Vertrauen.",
  "s2.import":
    "Dokumente importieren und prüfen — aktiv, sobald die Import-/Source-Review-API steht.",
  "s2.capital":
    "Wissenskapital-Kennzahlen auf echten Live-Daten — aktiv, sobald die Kennzahlen-Logik steht.",
  "mgmt.jumpTitle": "Abschnitte",
  "mgmt.overview": "Operativer Snapshot",
  "mgmt.kpiTotal": "Objekte",
  "mgmt.kpiValidated": "Validiert",
  "mgmt.kpiOpen": "Offen",
  "mgmt.kpiGaps": "Lücken",
  "mgmt.kpiConflicts": "Konflikte",
  "mgmt.kpiTrust": "Ø Vertrauen",
  "mgmt.capital": "Wissenskapital-Wert",
  "mgmt.band.gut": "gut",
  "mgmt.band.mittel": "mittel",
  "mgmt.band.kritisch": "kritisch",
  "mgmt.part.validatedRatio": "Validierungsquote",
  "mgmt.part.avgTrust": "Ø Vertrauen",
  "mgmt.part.coverage": "Abdeckung Domänen",
  "mgmt.part.singleSourceInv": "Quellen-Streuung",
  "mgmt.part.freshnessInv": "Aktualität",
  "mgmt.valuation": "Wissensbewertung",
  "mgmt.valuationDisclaimer":
    "Schätzmodell auf Basis transparenter Annahmen — keine Bilanzbewertung.",
  "mgmt.assumeRate": "€ pro Stunde",
  "mgmt.assumeHours": "Std./Objekt gespart",
  "mgmt.assumeReuse": "Wiederverwendung",
  "mgmt.basis": "Basis: {{n}} validierte Objekte · Ø Vertrauen {{trust}}",
  "mgmt.statement": "Wissensbilanz",
  "mgmt.assets": "Aktiva",
  "mgmt.risks": "Risiken",
  "mgmt.net": "Netto-Index",
  "mgmt.riskBreakdown":
    "Single-Source-Domänen: {{ss}} · veraltet: {{stale}} · offene Lücken: {{gaps}} · Konflikte: {{conf}}",
  "mgmt.maturity": "Reifegrad-Pfad",
  "mgmt.stage": "Stufe",
  "mgmt.stageName.leer": "Kein Bestand",
  "mgmt.stageName.erfassen": "Erfassen",
  "mgmt.stageName.strukturieren": "Strukturieren",
  "mgmt.stageName.validieren": "Validieren",
  "mgmt.stageName.wiederverwenden": "Wiederverwenden",
  "mgmt.stageName.skalieren": "Skalieren",
  "mgmt.house": "Wissenshaus",
  "mgmt.fragile": "fragil",
  "mgmt.stable": "gesichert",
  "mgmt.empty": "Noch kein Bestand — Kennzahlen erscheinen, sobald Wissen erfasst ist.",
  "mrun.title": "Reasoner-Läufe (zuletzt)",
  "mrun.empty": "Noch keine Reasoner-Läufe protokolliert.",
  "mrun.total": "Gesamt: {{n}}",
  "mrun.errors": "Fehler: {{n}}",
  "mrun.fallbacks": "Fallbacks: {{n}}",
  "mrun.demo": "Demo: {{n}}",
  "mrun.fallback": "Fallback",
  "mrun.demoTag": "Demo",
  // JOB 3044: Modell, Dauer und Laufzeitsumme. Zahl und Einheit kommen aus `formatiereDauer`,
  // nicht aus dem Satz — deshalb steht hier nur {{d}}. Die Summenzeile nennt IMMER ihre
  // Grundmenge ({{n}} von {{total}}), damit sie nichts über den Gesamtbestand behauptet.
  "mrun.model": "Modell: {{m}}",
  "mrun.duration": "Dauer: {{d}}",
  "mrun.runtimeTotal": "Laufzeit gesamt: {{d}} (aus {{n}} von {{total}} Läufen)",
  // JOB 3074 (V9 Scheibe 3): der von der Modell-API SELBST gemeldete Tokenverbrauch. Bewusst „Token"
  // und ausdrücklich KEIN Preis und keine Währung — dafür bräuchte es eine Preisliste je Modell, die
  // es nicht gibt. Beide Sätze nennen Eingabe UND Ausgabe getrennt, weil sie verschieden teuer sind;
  // die Summenzeile nennt zusätzlich ihre Grundmenge, genau wie „Laufzeit gesamt" darüber.
  "mrun.tokens": "Token: {{ein}} ein · {{aus}} aus",
  "mrun.tokensTotal": "Token gesamt: {{ein}} ein · {{aus}} aus (aus {{n}} von {{total}} Läufen)",
  "mrun.refreshFailed": "Auffrischung fehlgeschlagen — gezeigt wird der zuletzt geladene Stand.",
  // JOB 3044 R2: offline ist kein Fehlschlag, sondern ein Nicht-Versuch. Der Satz sagt beides:
  // warum nichts nachkommt UND dass der sichtbare Bestand deshalb nicht als aktuell gilt.
  "mrun.offline": "Keine Verbindung — gezeigt wird der zuletzt geladene Stand.",
  "evx.title": "Evidence-Index (QM)",
  "evx.empty": "Noch keine Evidence-Records vorhanden.",
  "evx.total": "Gesamt: {{n}}",
  "evx.sources": "Quellen: {{n}}",
  "evx.attachments": "Anhänge: {{n}}",
  "evx.kos": "Wissensobjekte: {{n}}",
  "evx.kind.source": "Quelle",
  "evx.kind.attachment": "Anhang",
  "evx.koRef": "KO {{id}}",
  "evx.providerPill": "Anbieter: {{v}}",
  "evx.objectPill": "Objekt: {{v}}",
  "prov.title": "Provenance-Index (QM)",
  "prov.empty": "Noch keine Wissensobjekte vorhanden.",
  "prov.total": "KOs: {{n}}",
  "prov.transfer": "Transfer: {{n}}",
  "prov.multiVersion": "Mehrfach-Version: {{n}}",
  "prov.withEvidence": "mit Evidence: {{n}}",
  "prov.noEvidence": "ohne Evidence: {{n}}",
  "prov.version": "v{{n}}",
  "prov.counts": "Q {{sources}} · A {{attachments}} · Ev {{evidence}}",
  "prov.badge.no-evidence": "keine Evidence",
  "prov.badge.transferred-author": "Autorentransfer",
  "prov.badge.multi-version": "Mehrfach-Version",
  "kos.hintsTitle": "Knowledge-OS QM-Hinweise",
  "kos.sevCount.critical": "kritisch: {{n}}",
  "kos.sevCount.warning": "Warnungen: {{n}}",
  "kos.sevCount.info": "Hinweise: {{n}}",
  "kos.sev.critical": "kritisch",
  "kos.sev.warning": "Warnung",
  "kos.sev.info": "Info",
  "kos.sev.ok": "OK",
  "kos.hints.none": "Keine Hinweise aus den geladenen Signalen.",
  "kos.hints.unknown": "Nicht geladen (unbekannt, kein Fehler): {{sources}}",
  "kos.hint.modelrun-errors.title": "ModelRun-Fehler ({{n}})",
  "kos.hint.modelrun-errors.detail": "Reasoner-Aufrufe mit Fehlerstatus — Protokoll prüfen.",
  "kos.hint.modelrun-fallbacks.title": "ModelRun-Fallbacks ({{n}})",
  "kos.hint.modelrun-fallbacks.detail":
    "Läufe nutzten den deterministischen Ersatz statt eines Modells.",
  "kos.hint.reasoner-demo.title": "Reasoner im Demo-/Fallback-Modus",
  "kos.hint.reasoner-demo.detail":
    "Kein echtes Modell konfiguriert — Antworten sind deterministisch.",
  "kos.hint.provenance-no-evidence.title": "KOs ohne Evidence ({{n}})",
  "kos.hint.provenance-no-evidence.detail":
    "Quellen/Anhänge vorhanden, aber keine Evidence-Records.",
  "kos.hint.evidence-outdated.title": "Evidence veraltet ({{n}})",
  "kos.hint.evidence-outdated.detail":
    "Aktuelle KO-Version ohne Evidence — nur ältere Versionen belegt.",
  "kos.hint.evidence-missing.title": "Evidence fehlt ({{n}})",
  "kos.hint.evidence-missing.detail":
    "Quellen/Object-Anhänge vorhanden, aber keine Evidence für irgendeine Version.",
  "kos.hint.provenance-lineage.title": "Transfer/Mehrfach-Version ({{n}})",
  "kos.hint.provenance-lineage.detail": "KOs mit Autorentransfer oder mehreren Versionen.",
  "kos.hint.evidence-empty.title": "Keine Evidence-Records",
  "kos.hint.evidence-empty.detail": "Bisher wurden keine Quellen/Anhänge als Evidence erfasst.",
  // AUFTRAG-mega34 G: der Zustand, in dem sich gar kein Grad ableiten lässt — die
  // Konflikterkennung ist nicht vollständig belegt. Das ist keine schlechte Note, sondern
  // eine fehlende: der angezeigte Wert ist der schlechtestmögliche, nicht der gemessene.
  "kos.hint.health-detection-unproven.title": "Knowledge-Health nicht belegt ({{n}})",
  "kos.hint.health-detection-unproven.detail":
    "Die Konflikterkennung ist nicht vollständig belegt. Der angezeigte Wert ist deshalb der ungünstigste mögliche, kein gemessener Grad — solange das so ist, lässt sich weder Entwarnung noch Alarm ehrlich geben.",
  "kos.hint.health-critical.title": "Knowledge-Health kritisch ({{n}})",
  "kos.hint.health-critical.detail": "Gesamt-Score im kritischen Bereich.",
  "kos.hint.health-mittel.title": "Knowledge-Health mittel ({{n}})",
  "kos.hint.health-mittel.detail": "Gesamt-Score im mittleren Bereich.",
  "kos.hint.all-clear.title": "Keine Auffälligkeiten",
  "kos.hint.all-clear.detail": "Die geladenen Foundation-Signale zeigen keine Warnungen.",
  "evFresh.title": "Evidence-Aktualität (QM)",
  "evFresh.subtitle": "KOs, deren aktuelle Version keine Evidence hat.",
  "evFresh.empty": "Keine KOs mit veralteter oder fehlender Evidence.",
  "evFresh.summary.outdated": "veraltet: {{n}}",
  "evFresh.summary.missing": "fehlend: {{n}}",
  "evFresh.summary.current": "aktuell: {{n}}",
  // UX-26 (arbeit:ux26-beleg-original-20260921): `evFresh.summary.neutral` wohnt jetzt in `texte/ux26.ts`.
  "evFresh.version": "v{{n}}",
  "evFresh.counts": "aktuell {{current}} · älter {{older}}",
  "evFresh.openKo": "KO öffnen",
  "qmWindow.within": "innerhalb des geladenen Fensters",
  "qmWindow.limited": "möglicherweise abgeschnitten",
  "qmWindow.modelRuns": "Fenster: {{n}} jüngste ModelRuns",
  "qmWindow.evidence": "Fenster: {{n}} jüngste EvidenceRecords",
  "readiness.title": "Knowledge-OS Readiness",
  "readiness.ready": "bereit",
  "readiness.attention": "aufmerksam",
  "readiness.critical": "kritisch",
  "readiness.incomplete": "unvollständig geladen",
  "readiness.reason.critical": "kritische Hinweise",
  "readiness.reason.warning": "Warnungen",
  "readiness.reason.window": "Datenfenster möglicherweise abgeschnitten",
  "readiness.reason.unknown": "Signale nicht geladen",
  "mrun.task.structure": "Strukturieren",
  "mrun.task.assist": "Glätten",
  "mrun.task.interview": "Interview",
  "mrun.task.answer": "Antworten",
  "mrun.task.select": "Auswählen",
  // JOB 3069: die drei jüngeren Aufgabenarten des Servers (services/model-runs/src/types.ts:13-15).
  // Ohne sie gab i18next den Schlüssel selbst zurück — es stand `mrun.task.extract` in der Pille.
  "mrun.task.extract": "Extrahieren",
  "mrun.task.describe": "Bild beschreiben",
  "mrun.task.group": "Gruppieren",
  // JOB 3069 R2 (BEN, Korrekturpflicht 1): eine Aufgabenart, die diese Oberfläche nicht führt
  // (neuerer Server, älterer Bestand). BEWUSST NICHT unter `mrun.task.*` — dieser Namensraum ist
  // genau die acht Arten, und ein Wert vom Draht darf nie in einen Schlüssel eingesetzt werden.
  // Bauform wie `imp.status.unknown`: ehrlich benannt statt roher Schlüssel in der Oberfläche.
  // Aufnahme gesamt-ki-laufprotokoll: vier Modellwege mit eigenem Lauf, Kosten, Erzeugnis, Auswertung.
  "mrun.task.enrich": "Anreichern",
  "mrun.task.conflict": "Konfliktprüfung",
  "mrun.task.duplicate": "Dublettenprüfung",
  "mrun.task.probe": "Anbieterprobe",
  "mrun.cost": "Kosten: {{k}}",
  "mrun.costStand": "Preisstand: {{s}}",
  "mrun.produced": "Erzeugt: {{n}} × {{art}}",
  "mrun.erzeugnis.vorschlag": "Vorschlag",
  "mrun.erzeugnis.text": "Text",
  "mrun.erzeugnis.frage": "Frage",
  "mrun.erzeugnis.antwort": "Antwort",
  "mrun.erzeugnis.punkt": "Punkt",
  "mrun.erzeugnis.beschreibung": "Beschreibung",
  "mrun.erzeugnis.gruppe": "Gruppe",
  "mrun.erzeugnis.kriterien": "Auswahlkriterien",
  "mrun.erzeugnis.urteil": "Urteil",
  "mrun.report.title": "KI-Auswertung (Zeitraum)",
  "mrun.report.period": "Zeitraum:",
  "mrun.report.days": "Letzte {{n}} Tage",
  "mrun.report.costSum": "Kosten gesamt: {{k}} (aus {{n}} von {{total}} Läufen)",
  "mrun.report.priceList": "Preisliste: Stand {{s}}, {{w}}",
  "mrun.report.noPriceList": "Keine Preisliste hinterlegt — Kosten werden nicht berechnet.",
  "mrun.report.withoutPrice":
    "{{n}} Läufe mit Modellaufruf ohne berechenbare Kosten (Preis oder Verbrauch fehlt)",
  "mrun.report.capped": "Sehr viele Läufe — gerechnet wurde über die jüngsten 10000.",
  "mrun.report.empty": "Keine KI-Läufe in diesem Zeitraum.",
  "mrun.taskUnknown": "Aufgabenart unbekannt",
  "mrun.status.success": "OK",
  "mrun.status.error": "Fehler",
  "rcfg.title": "Reasoner-Konfiguration",
  "rcfg.mode": "Modus",
  "rcfg.modeLabel.model": "Modell aktiv",
  "rcfg.modeLabel.fallback": "Fallback",
  "rcfg.modeLabel.demo": "Demo (deterministisch)",
  "rcfg.provider": "Provider",
  "rcfg.model": "Modell",
  "rcfg.notConfigured": "nicht konfiguriert",
  "rcfg.locales": "Sprachen",
  "rcfg.tasks": "Aufgaben",
  "rcfg.fallbackHint": "Kein Modell konfiguriert — deterministischer Fallback ist aktiv.",
  "mgmt.recommendations": "Empfehlungen",
  "mgmt.noRecs": "Keine dringenden Maßnahmen.",
  "mgmt.sev.hoch": "hoch",
  "mgmt.sev.mittel": "mittel",
  "mgmt.rec.secureSingleSource": "{{count}} Single-Source-Domäne(n) absichern (Wissen verteilen).",
  "mgmt.rec.revalidate": "{{count}} fällige Revalidierung(en) bearbeiten.",
  "mgmt.rec.closeGaps": "{{count}} offene Wissenslücke(n) schließen.",
  "mgmt.rec.resolveConflicts": "{{count}} offene(n) Konflikt(e) lösen.",
  "mgmt.rec.validateBacklog": "{{count}} offene Objekte validieren.",
  "mgmt.priorities": "Wissens-Priorisierung (9 Faktoren)",
  "mgmt.prio.filterLabel": "Priorisierung filtern",
  "mgmt.prio.filter.all": "Alles",
  "mgmt.prio.filter.busFactorOne": "Bus-Faktor 1",
  "mgmt.prio.filter.stale": "Veraltet",
  "mgmt.prio.filter.highProtection": "Hoher Schutzwert",
  "mgmt.prio.flag.busFactorOne": "Bus-Faktor 1",
  "mgmt.prio.flag.stale": "veraltet",
  "mgmt.prio.flag.highProtection": "hoher Schutzwert",
  "mgmt.prio.factor.busFactor": "Bus-Faktor",
  "mgmt.prio.factor.criticality": "Kritikalität",
  "mgmt.prio.factor.processProximity": "Prozessnähe",
  "mgmt.prio.factor.age": "Alter",
  "mgmt.prio.factor.sourceQuality": "Quellenqualität",
  "mgmt.prio.factor.conflictDensity": "Konfliktdichte",
  "mgmt.prio.factor.repetition": "Wiederholhäufigkeit",
  "mgmt.prio.factor.damagePotential": "Schadenspotenzial",
  "mgmt.prio.factor.protection": "Schutzwert",
  "mgmt.prio.noData": "keine Eingangsdaten",
  "mgmt.prio.noDataNote":
    "Für {{factors}} gibt es im Bestand keine Eingangsdaten. Diese Faktoren werden nicht geschätzt; der Score stammt aus den übrigen.",
  "mgmt.prio.detail": "Faktor-Detail · aus {{known}} von 9 Faktoren berechnet",
  "mgmt.prio.emptyFilter": "Keine Kategorie in diesem Filter.",
  "mgmt.pilot": "Pilot-Bericht 30/60/90",
  "mgmt.print": "Drucken / PDF",
  "mgmt.pilotNote": "Druck-/HTML-Ansicht (über Browser-Druck), kein zertifiziertes PDF.",
  "mgmt.window": "Fenster",
  "mgmt.created": "Erfasst",
  "mgmt.validatedCol": "Validiert",
  "mgmt.days": "Tage",
  "s2.graphEmpty": "Keine Graph-Daten.",
  "s2.graphCount": "{{nodes}} Knoten · {{edges}} Kanten",
  "graph.truncated": "Anzeige auf die {{n}} am stärksten verbundenen Knoten begrenzt",
  "graph.legendValidated": "validiert",
  "graph.legendOpen": "offen / in Prüfung",
  "graph.legendTag": "Tag-Relation",
  "graph.legendConflict": "Konflikt",
  "graph.clickHint": "Knoten anklicken, um das Wissensobjekt zu öffnen",
  "graph.openNode": "Wissensobjekt öffnen: {{title}}",

  // SCRUM-406: ausführliche ?-Hilfen im Prüfbereich (Schema: Was? · Wann? · Was passiert danach?).
  "vhelp.originFilter.title": "Herkunft filtern",
  "vhelp.originFilter.body":
    "Blendet die Liste nach Herkunft ein: Demo-Beispiele oder eigenes Wissen deiner Organisation. Das ist nur eine Ansicht zum Auffinden — es ändert keinen Prüfstatus und verwirft nichts. Die Zahl hinter jedem Filter zeigt, wie viele Einträge er enthält.",
  "vhelp.reviewFocus.title": "Review-Fokus",
  "vhelp.reviewFocus.body":
    "Unterscheidet neue Einreichungen von überarbeiteten (Version größer 1). Überarbeitete Objekte lohnen einen gezielten Blick auf die Änderung — was war die Rückfrage, was wurde angepasst? Auch das ist nur eine Ansicht: Es ändert keinen Status und ersetzt keine Entscheidung.",
  "vhelp.filters.title": "Suchen & filtern",
  "vhelp.filters.body":
    "Grenzt die Prüfliste nach Volltext, Wissensart, Kategorie oder Schlagwort ein. Nutze das, wenn die Liste lang ist und du gezielt dein Fachgebiet prüfen willst. Es geht nichts verloren: Filter ändern nur, was du gerade siehst — alle Objekte bleiben in der Prüfung.",
  "vhelp.mineOnly.title": "Nur mir zugewiesene",
  "vhelp.mineOnly.body":
    "Zeigt deine persönliche Review-Liste: Objekte, die dir jemand bewusst zugewiesen hat. Nutze sie, um zuerst die Arbeit zu erledigen, auf die Kollegen warten. Die Zuweisung ist eine Bitte, keine Pflichtprüfung — entschieden wird erst, wenn du selbst bewertest.",
  "vhelp.signals.title": "Review-Signale lesen",
  "vhelp.signals.body":
    "Die Zeile zeigt, wie belastbar das Objekt JETZT ist: Vertrauensbalken und Vertrauenswert (aus Prüfstimmen und Bewährung), Version, „Ziel n“ (so viele Freigaben braucht es bis VALIDIERT), dazu Marker wie ÜBERTRAGEN (Autor gewechselt — extra Blick) oder ZUGEWIESEN. Nichts davon ist eine Bewertung durch dich — es ist die ehrliche Ausgangslage für deine Entscheidung.",
  "vhelp.approve.title": "Freigeben",
  "vhelp.approve.body":
    "Du bestätigst nach eigener Prüfung: Diese Aussage ist fachlich richtig und so anwendbar. Nutze das erst, wenn du Kernaussage, Bedingungen und Maßnahmen wirklich beurteilt hast — deine Freigabe zählt als eine von mehreren nötigen Prüfstimmen. Danach steigt das Vertrauen des Objekts; VALIDIERT wird es erst, wenn genug Prüfer freigegeben haben. Nichts wird automatisch veröffentlicht oder verändert — deine Stimme wird gezählt, mehr nicht.",
  "vhelp.query.title": "Rückfrage stellen",
  "vhelp.query.body":
    "Du hältst das Wissen für brauchbar, aber etwas ist unklar, unvollständig oder nur unter Bedingungen richtig. Ein kurzer Kommentar ist Pflicht — er ist deine Hilfe an den Autor: Was genau fehlt, was soll er nachtragen? Danach bleibt das Objekt in Prüfung und der Autor sieht deine Rückfrage als Kommentar am Wissensobjekt. Es wird nichts abgelehnt, nichts freigegeben und nichts automatisch geändert — die Überarbeitung macht der Autor bewusst selbst.",
  "vhelp.reject.title": "Ablehnen",
  "vhelp.reject.body":
    "Du hältst die Aussage für falsch, veraltet oder riskant. Auch hier ist die Begründung Pflicht — ohne sie kann der Autor nichts lernen und nichts korrigieren. Danach fließt deine Ablehnung in den Prüfstand des Objekts ein; es wird dadurch NICHT gelöscht und NICHT gesperrt, sondern bleibt sichtbar in Prüfung, bis Autor oder Controller reagieren. Wenn zwei gesicherte Aussagen einander widersprechen, ist „Konflikt melden“ der bessere Weg als eine Ablehnung.",
  "vhelp.feedbackForm.title": "Begründung (Pflicht)",
  "vhelp.feedbackForm.body":
    "Rückfrage und Ablehnung brauchen immer eine Begründung — sie wird als Kommentar am Wissensobjekt gespeichert, sichtbar für Autor und Prüfer. Schreib konkret, was fehlt oder falsch ist und was der Autor nachtragen soll. Erst mit Text lässt sich absenden; Abbrechen verwirft nur deine Eingabe, keine Bewertung.",
  "vhelp.assign.title": "Prüfer zuweisen",
  "vhelp.assign.body":
    "Du bittest eine bestimmte Kollegin oder einen Kollegen um die Prüfung dieses Objekts. Die Person sieht es danach in ihrer persönlichen Review-Liste („Mir zugewiesen“) und bekommt eine Benachrichtigung über die Glocke. Die Zuweisung ist eine Einladung, keine Bewertung: Sie ändert weder Status noch Vertrauen, und geprüft wird erst, wenn die Person selbst entscheidet.",
  "vhelp.markTrue.title": "Als wahr kennzeichnen (nur Admin)",
  "vhelp.markTrue.body":
    "Als Admin schließt du die Validierung dieses Objekts in einem Schritt ab — unabhängig von den Peer-Bewertungen. Der Status wird auf „validiert“ gesetzt und das Vertrauen auf die höchste Stufe gehoben. Nutze das bewusst und nur, wenn du die Aussage wirklich verantworten kannst, denn du überspringst damit die mehrfache Gegenprüfung durch andere. Der Vorgang wird im Audit-Log mit deinem Namen festgehalten und lässt sich später über eine erneute Bearbeitung/Revision wieder in die Prüfung zurückholen.",
  "vhelp.stillValid.title": "Noch gültig",
  "vhelp.stillValid.body":
    "Du bestätigst, dass dieses bereits geprüfte Wissen aus deiner Sicht weiterhin stimmt — ein Frische-Signal, kein neues Prüfverfahren. Nutze es, wenn du das Wissen gerade angewendet oder bewusst gegengelesen hast. Danach wird die Bestätigung mit Datum vermerkt und das Objekt gilt als kürzlich bestätigt. Es ersetzt keine Peer-Prüfung und hebt keine Rückfragen oder Konflikte auf.",
  "vhelp.reportConflict.title": "Konflikt melden",
  "vhelp.reportConflict.body":
    "Du zeigst an, dass dieses Wissen einem ANDEREN Wissensobjekt widerspricht — etwa zwei unterschiedliche Grenzwerte für denselben Fall. Danach erscheint der Fall auf der Konflikte-Seite und wird dort bewusst aufgelöst (Zweitmeinung, Eskalation, dokumentierte Entscheidung). Beide Objekte bleiben unverändert bestehen — es wird nichts automatisch korrigiert, überschrieben oder gelöscht.",
  "vhelp.conflictForm.title": "Konflikt beschreiben",
  "vhelp.conflictForm.body":
    "Drei Angaben machen die Meldung auflösbar: das GEGEN-Objekt (womit widerspricht sich dieses Wissen?), die KONFLIKTART (z. B. Widerspruch in der Sache oder in der Zuständigkeit) und eine kurze BESCHREIBUNG des Widerspruchs mit deinem Kontext. Nach dem Absenden entsteht ein offener Konfliktfall — beide Objekte bleiben nutzbar markiert, bis der Konflikt bewusst aufgelöst ist.",
  "vhelp.sourcesLevel2.title": "Externe Quellen (Stufe 2)",
  "vhelp.sourcesLevel2.body":
    "Hier hängen externe Belege am Wissensobjekt: Normen, Handbücher, Artikel, interne Dokumente. Das Badge „Stufe 2“ bedeutet ehrlich: Diese Quelle wurde NICHT von Kollegen peer-geprüft — sie stützt das Wissen, ersetzt aber keine einzige Prüfstimme. Auf der Fragen-Seite zählt eine Stufe-2-Quelle deshalb nicht als Prüfstimme; sie kann eine Antwort stützen, aber nicht absichern. Das X entfernt nur die Verknüpfung — Wissen, Status und Vertrauen bleiben unverändert.",
  "vhelp.sourceFields.title": "Quelle beschreiben",
  "vhelp.sourceFields.body":
    "Drei Angaben machen eine Quelle brauchbar: Die BEZEICHNUNG sagt, was es ist („DIN EN 1090, Abschnitt 7“), die URL führt hin (leer lassen bei Papier- oder internen Quellen), der AUSZUG zitiert die eine entscheidende Stelle wörtlich — so muss niemand das ganze Dokument lesen, um die Aussage zu prüfen. Je konkreter der Auszug, desto mehr hilft die Quelle den Prüfern.",
  "vhelp.sourceAdd.title": "Quelle hinzufügen",
  "vhelp.sourceAdd.body":
    "Hängt die beschriebene Quelle als Stufe-2-Beleg an dieses Wissensobjekt. Sie bleibt über Versionen hinweg erhalten und ist für alle sichtbar. Es passiert nichts weiter automatisch: Der Inhalt der Quelle wird nicht ins Wissen übernommen, nicht geprüft und nicht bewertet — sie steht als Beleg daneben.",
  "vhelp.sourceSearch.title": "Quellen suchen",
  "vhelp.sourceSearch.body":
    "Sucht nach externen Belegen zu diesem Thema. Die Suche läuft über den KLARWERK-Server — deine Anfrage geht nicht direkt von deinem Browser an externe Dienste. Die Treffer sind unverbindliche Vorschläge: Nichts davon wird automatisch angehängt. Prüfe Titel und Ausschnitt, öffne im Zweifel den Link — und erst „Anhängen“ übernimmt einen Treffer bewusst als Stufe-2-Quelle.",
  "vhelp.contribution.title": "Beitrag oder Fundstelle melden",
  "vhelp.contribution.body":
    "Du kennst eine Ergänzung, Korrektur oder Fundstelle, willst aber nicht selbst am Objekt arbeiten? Beschreibe sie hier — dein Hinweis wird als Kommentar am Wissensobjekt gespeichert, sichtbar für Autor und Prüfer. Anders als „Quelle hinzufügen“ entsteht dabei KEIN Quellen-Eintrag; es ist eine Nachricht an die Menschen, kein Beleg am Objekt.",
  "vhelp.helpful.title": "Hat geholfen",
  "vhelp.helpful.body":
    "Ein Bewährungssignal aus der Praxis: Du hast dieses Wissen angewendet, und es hat funktioniert. Das stärkt das Vertrauen des Objekts ein Stück und wird im Verlauf vermerkt. Es ist KEINE Prüfstimme — Validierung entsteht weiterhin nur durch bewusste Prüfentscheidungen von Kollegen.",
  "vhelp.validity.title": "Gültigkeit & Schutz",
  "vhelp.validity.body":
    "Diese Werte werden ehrlich aus dem aktuellen Zustand ABGELEITET, nicht gespeichert: Frische (wann zuletzt bestätigt oder geändert), Output-Eignung (dürfte dieses Wissen in erzeugte Dokumente?) und eine Empfehlung, was als Nächstes sinnvoll ist. Ändern kannst du sie nur indirekt — durch Prüfen, Bestätigen oder Überarbeiten des Wissens selbst.",
  "vhelp.transfer.title": "Autor übertragen",
  "vhelp.transfer.body":
    "Übergibt die Verantwortung für dieses Wissen an eine andere Person — etwa wenn jemand das Unternehmen verlässt oder die Zuständigkeit wechselt. Der ursprüngliche Autor bleibt dauerhaft sichtbar (Herkunft geht nie verloren). Übertragene Objekte bekommen im Review einen Extra-Blick, weil das Wissen nun jemand verantwortet, der es nicht selbst erfasst hat.",
  "vhelp.deleteKo.title": "Wissensobjekt löschen",
  "vhelp.deleteKo.body":
    "Entfernt dieses Wissensobjekt endgültig — erlaubt nur für den Autor selbst sowie Controller und Admin; der Server erzwingt dieselbe Regel. Vor dem Löschen fragt die Inline-Bestätigung bewusst nach. Die Löschung wird im Audit protokolliert. Wenn das Wissen nur veraltet ist, ist Überarbeiten oder ein Konflikt der ehrlichere Weg als Löschen.",
  "vhelp.conflictEscalate.title": "Eskalieren",
  "vhelp.conflictEscalate.body":
    "Hebt einen offenen Sach-Konflikt eine Stufe höher, wenn die Beteiligten ihn nicht selbst klären können — dann entscheidet die fachlich zuständige Instanz. Nutze das, wenn zwei validierte Aussagen einander hart widersprechen und keine Seite nachgeben kann. Der Konflikt bleibt offen und sichtbar, bis eine dokumentierte Entscheidung fällt.",
  "vhelp.conflictSecondOpinion.title": "Zweitmeinung einholen",
  "vhelp.conflictSecondOpinion.body":
    "Bittet eine weitere fachkundige Person um ihre Einschätzung zum Konflikt und hält sie schriftlich fest. Eine gute Zweitmeinung nennt Fakten und Quellen, nicht nur ein Bauchgefühl. Sie entscheidet den Konflikt nicht automatisch — sie ist Material für die spätere Auflösung.",
  "vhelp.conflictResolve.title": "Konflikt auflösen",
  "vhelp.conflictResolve.body":
    "Hält die Entscheidung fest, wie mit dem Widerspruch umzugehen ist — welche Aussage gilt, unter welchen Bedingungen, und warum. Die Auflösung DOKUMENTIERT nur: Sie ändert keines der beteiligten Wissensobjekte automatisch. Wenn ein Objekt danach überarbeitet oder neu bestätigt werden sollte, zeigt die App eine Revalidierungs-Empfehlung — auch das bleibt eine bewusste menschliche Handlung.",

  // SCRUM-407: ausführliche ?-Hilfen im Erfassen-Weg (Schema: Was? · Wann? · Was passiert danach?).
  "chelp.modes.title": "Die vier Erzähl-Wege",
  "chelp.modes.body":
    "Vier Wege führen zum selben Ziel: FREITEXT (einfach drauflos schreiben), DIKTAT (sprechen statt tippen), INTERVIEW (die KI stellt dir gezielte Fragen) und AUS DATEI (Wissenspunkte aus einem Dokument ziehen). Wähle, was sich für dich natürlich anfühlt — alle Wege münden in denselben Entwurf auf der Wissensseite, und beim Wechseln geht nichts verloren.",
  "chelp.expertPath.title": "Formular direkt (Expertenpfad)",
  "chelp.expertPath.body":
    "Das klassische Formular mit allen Feldern auf einen Blick — für alle, die genau wissen, was sie eintragen wollen. Es ist derselbe Datenstand wie der geführte Weg, kein Extra-Feature und keine Abkürzung an der Prüfung vorbei. Der Rückweg auf den geführten Weg ist jederzeit einen Klick entfernt.",
  "chelp.wizardSteps.title": "Die drei Schritte",
  "chelp.wizardSteps.body":
    "Erfassen läuft in drei Schritten: SCHREIBEN (Titel und Text aufs Blatt — oder über „Datei“ als Interview, aus einer Datei oder im Formular; „Diktieren“ schreibt mit), SICHERN (als Entwurf, nur für dich sichtbar) und EINREICHEN (in die Peer-Prüfung geben). Du kannst jederzeit weiterschreiben — dabei geht nichts verloren. Erst das Einreichen macht aus deinem Entwurf ein Wissensobjekt für die Kollegen.",
  "chelp.loadExample.title": "Beispiel laden",
  "chelp.loadExample.body":
    "Füllt die Felder mit einem Demo-Beispiel, damit du den kompletten Weg gefahrlos ausprobieren kannst. Achtung: Es überschreibt deine aktuellen Eingaben — nutze es auf leerer Seite. Eingereicht wird auch ein Beispiel erst, wenn du es bewusst einreichst.",
  "chelp.tellRaw.title": "Einfach erzählen",
  "chelp.tellRaw.body":
    "Schreib dein Wissen so auf, wie du es einem neuen Kollegen erzählen würdest — unsortiert ist völlig in Ordnung. Struktur (Titel, Kernaussage, Bedingungen, Maßnahmen) macht im nächsten Schritt die KI als VORSCHLAG, den du prüfst und änderst. Nichts wird automatisch gespeichert oder eingereicht.",
  "chelp.dictate.title": "Diktieren",
  "chelp.dictate.body":
    "Sprechen statt tippen: Dein Browser wandelt Sprache lokal in Text um, der hier ins Feld fließt. Starte und stoppe bewusst; danach kannst du den Text ganz normal korrigieren. Wenn dein Browser keine Spracherkennung kann, sagt dir die App das ehrlich, statt still zu scheitern.",
  "chelp.tellUpload.title": "Datei anhängen beim Erzählen",
  "chelp.tellUpload.body":
    "Lädst du hier Dokumente hoch (PDF, Word, Text), fließt ihr Text direkt in dein Erzählfeld; Bilder und Videos werden Anhänge des späteren Wissensobjekts. Bei Bildern startet Texterkennung (OCR) nur auf deinen Klick. Es wird nichts hochgeladen, das du nicht siehst — alles bleibt Teil deines Entwurfs.",
  "chelp.structureNow.title": "Struktur vorschlagen",
  "chelp.structureNow.body":
    "Die KI liest deinen Rohtext und schlägt Titel, Kernaussage, Bedingungen und Maßnahmen vor — als ENTWURF auf der Wissensseite, violett gekennzeichnet. Sie erfindet nichts dazu; ohne KI-Schlüssel arbeitet ein ehrlicher, regelbasierter Ersatz und sagt das klar. Du prüfst, änderst und entscheidest — automatisch gespeichert wird nie.",
  "chelp.interview.title": "Das Wissens-Interview",
  "chelp.interview.body":
    "Die KI stellt dir eine Frage nach der anderen und bohrt gezielt nach — nach Grenzwerten, Ausnahmen, Gründen. Antworte in deinen Worten (tippen oder diktieren); die Frage kannst du dir vorlesen lassen. Erst wenn du das Interview abschließt, wird aus allen Antworten ein Entwurf für die Wissensseite gebaut — nichts davon ist vorher gespeichert.",
  "chelp.filePoints.title": "Wissen aus Datei",
  "chelp.filePoints.body":
    "Du lädst ein Dokument hoch, die KI extrahiert daraus einzelne Wissenspunkte — jeder MIT wörtlicher Belegstelle aus dem Dokument (erfundene Punkte sind damit ausgeschlossen; findet sie nichts Belastbares, sagt sie das ehrlich). Du wählst per Häkchen aus, was übernommen wird: Nur ausgewählte Punkte werden Entwürfe. Alternativ kannst du einen Suchauftrag an einen Experten formulieren.",
  "chelp.captureTitle.title": "Der Titel",
  "chelp.captureTitle.body":
    "Der Titel ist das Erste, was Kollegen in Bibliothek und Antworten sehen — er entscheidet, ob dein Wissen gefunden wird. Gut: konkret und handlungsnah („Schweißnaht bei Aluminium unter 5 mm prüfen“). Du kannst ihn jederzeit ändern, auch der KI-Vorschlag ist nur ein Startpunkt.",
  "chelp.saveDraftHelp.title": "Entwurf speichern",
  // AUFNAHME gesamt-entwurf-einreichen · Entscheidung Pedi `debbb8e8` („Beides“): Standardfall ist
  // der PRIVATE Entwurf am Server, NUR für die Autorin sichtbar (auch kein Administrator,
  // `canSeeDraft`), auf allen eigenen Geräten fortsetzbar — deshalb „Nur du siehst ihn“ statt
  // „Niemand sieht ihn“ (`tests/entwurf-einreichen/hilfetext-entwurf-am-server.test.ts`). Der Weg
  // „Mehr“ → Entwürfe stammt aus `gesamt-erfassung-einstieg` (R-1000: jedes Zitat ist eine
  // Beschriftung des Blattes); der Menüpunkt `mob.drafts` steht ohne Anführungszeichen daneben.
  "chelp.saveDraftHelp.body":
    "Sichert deinen Zwischenstand privat auf dem Server — du kannst jederzeit weitermachen, auf jedem deiner Geräte und auch nach einem Neustart. Ein Entwurf ist NICHT eingereicht: Nur du siehst ihn, er taucht in keiner Prüfung und keiner Antwort auf. Deine gespeicherten Entwürfe findest du zum Fortsetzen unter „Mehr“ → Entwürfe und im Menü unter Meine Entwürfe.",
  "chelp.discardHelp.title": "Verwerfen",
  "chelp.discardHelp.body":
    "Verwirft die aktuelle Eingabe — Text, Struktur und Anhänge dieser Erfassung. Es betrifft NUR diese Eingabe: Bereits eingereichte Wissensobjekte und gesicherte Entwürfe bleiben unberührt. Vorher fragt die App bewusst nach.",
  "chelp.submitReview.title": "Prüfen & einreichen",
  "chelp.submitReview.body":
    "Macht aus deinem Entwurf ein Wissensobjekt und gibt es in die Peer-Prüfung: Kollegen prüfen, stellen Rückfragen oder geben frei. Ab jetzt ist es für andere sichtbar — aber ehrlich als „in Prüfung“ markiert, NICHT als gesichert. Validiert wird es durch genug Freigaben. Für Antworten nutzbar ist es schon vorher — dann aber sichtbar als ungeprüft gekennzeichnet.",
  "chelp.readiness.title": "Speicher-Check",
  "chelp.readiness.body":
    "Zeigt ehrlich, was zum Einreichen noch fehlt: Pflichtfelder (ohne sie bleibt der Knopf aus) und Optionales, das dein Wissen stärkt (z. B. Kategorie oder Anhänge). Grün heißt bereit — nicht perfekt: Verbessern kannst du auch nach dem Einreichen noch, dann als neue Version.",
  "chelp.savedNext.title": "Gespeichert — was jetzt?",
  "chelp.savedNext.body":
    "Dein Wissen ist als Objekt angelegt und wartet auf die Peer-Prüfung — es ist SICHTBAR, aber ehrlich als offen markiert, nicht als gesichert. Du musst nichts weiter tun: Prüfer finden es auf dem Validierungs-Board. Willst du es ansehen oder ergänzen, führt der Link direkt hin.",
  "chelp.advancedDetails.title": "Erweiterte Details",
  "chelp.advancedDetails.body":
    "Alles hier ist OPTIONAL — dein Wissen wird auch ohne eingereicht. Es lohnt sich trotzdem: Kategorie und Schlagwörter machen es auffindbar, die Anlage koppelt es an Maschinen/Objekte, die Prüf-Anzahl steuert, wie viele Freigaben nötig sind, Dokumente und Bilder liefern Beweismaterial. Das Badge zeigt, wie viel schon ausgefüllt ist.",
  "chelp.knowledgeType.title": "Wissensart",
  "chelp.knowledgeType.body":
    "Ordnet dein Wissen ein: Erfahrungswissen, Prozesswissen, Faktenwissen — und besonders wertvoll: NEGATIVWISSEN („das haben wir probiert, es funktioniert NICHT, weil …“). Die Wissensart hilft Prüfern und Suchenden, dein Wissen richtig einzuordnen; sie ändert nichts am Prüfweg.",
  "chelp.assetField.title": "Anlage / Objekt",
  "chelp.assetField.body":
    "Koppelt dein Wissen an eine konkrete Anlage, Maschine oder ein Objekt („Presse 3“, „Mandant XY“). Ändert sich später etwas an dieser Anlage, findet der Lebenszyklus genau die gekoppelten Wissensobjekte zur Überprüfung. Freitext genügt — Hauptsache, Kollegen erkennen die Anlage wieder.",
  "chelp.tagsField.title": "Schlagwörter",
  "chelp.tagsField.body":
    "Kurze Stichworte, über die dein Wissen in Suche und Filtern auftaucht („aluminium“, „frist“, „hygiene“). Nutze Begriffe, nach denen Kollegen wirklich suchen würden, und bleib konsistent mit vorhandenen Schlagwörtern. Sie sind jederzeit änderbar und beeinflussen die Prüfung nicht.",
  "chelp.docsImages.title": "Dokumente & Bilder",
  "chelp.docsImages.body":
    "Hängt Beweismaterial an dein Wissen: Fotos vom Ergebnis, das Prüfprotokoll, die Arbeitsanweisung. Anhänge wandern beim Einreichen mit ans Wissensobjekt und sind dort für Prüfer sichtbar. Ihr Inhalt wird nicht automatisch zu Wissen — was in den Text soll, entscheidest du.",
  "chelp.expertForm.title": "Das Experten-Formular",
  "chelp.expertForm.body":
    "Hier trägst du alle Felder direkt ein: Titel, Wissensart, Inhalt, Kernaussage, Bedingungen (wann gilt es?) und Maßnahmen (was ist zu tun?). Es gelten dieselben Regeln wie im geführten Weg — gleicher Speicher-Check, gleiche Prüfung. Die KI hilft auf Wunsch am Text, entscheidet aber nichts.",
  "chelp.sourcesPanel.title": "Externe Quellen (Stufe 2)",
  "chelp.sourcesPanel.body":
    "Hängt externe Belege an dein Wissen — Norm, Handbuch, Herstellerseite. Von Hand (Bezeichnung, Link, Auszug) oder über die Quellen-Suche, genau wie im Prüfbereich. Beim Erfassen sammelst du sie in einer sichtbaren Warteliste; angehängt werden sie erst beim Einreichen, zusammen mit deinem Wissensobjekt. Wichtig: Externe Quellen sind Stufe 2 — sie gelten nie als peer-validiert und ersetzen keine Prüfung durch Kollegen. Nichts wird automatisch übernommen.",
  "capture.sourcesTitle": "Externe Quellen",
  "capture.sourcesHint":
    "Quellen landen zuerst in dieser Warteliste. Beim Einreichen werden sie ans gespeicherte Wissensobjekt gehängt — als Stufe 2, nie peer-validiert.",
  "xtr.title": "Aus Dokument ergänzen",
  "xtr.hint":
    "Lade ein weiteres Dokument hoch — die KI liest es und schlägt Wissenspunkte MIT Belegstelle vor. Nur was du ankreuzt, wird als Abschnitt ans Ende deines Artikels angefügt; nichts wird ersetzt.",
  "xtr.applyCta": "Ausgewählte anfügen",
  // AUFTRAG-mega18 Block A-3: die Übernahme ist EIN serverseitiger Vorgang — der Text sagt, was er
  // gemeinsam committet (Inhalt UND Herkunft), damit niemand „angefügt" für „gespeichert" hält.
  "xtr.applying": "{{count}} Punkt(e) werden übernommen — Inhalt und Herkunft zusammen …",
  "xtr.appended":
    "{{count}} Punkt(e) aus „{{name}}“ übernommen — Inhalt UND Herkunft sind gemeinsam gespeichert; bestehender Inhalt blieb unverändert.",
  "xtr.append.button": "An bestehenden Artikel anhängen",
  "xtr.append.title": "An bestehenden Artikel anhängen",
  "xtr.append.intro":
    "{{count}} ausgewählte Erkenntnis(se) aus „{{name}}“ als Abschnitt an einen bestehenden Artikel anhängen. Der Zielartikel wird überarbeitet (danach neu zu prüfen); die Quelle wird je Punkt vermerkt.",
  "xtr.append.searchPlaceholder": "Artikel suchen (Titel) …",
  "xtr.append.none": "Kein passender Artikel gefunden.",
  "xtr.append.busy": "Wird angehängt …",
  "xtr.append.done":
    "{{count}} Erkenntnis(se) an „{{title}}“ angehängt — der Artikel ist jetzt neu zu prüfen.",
  // AUFTRAG-mega18 Block A: die Übernahme ist EINE serverseitige Operation. Es gibt genau drei
  // Ausgänge und für jeden einen eigenen, ehrlichen Text — kein „Fehler", aus dem der Nutzer raten
  // muss, was jetzt im Artikel steht.
  // (1) Die INTERNE BELEGPFLICHT hat abgelehnt: ohne gesichertes Original wird nichts übernommen —
  //     auf JEDER Stufe, nicht nur auf den restriktiven.
  "xtr.append.missingAnchor":
    "Ohne das Originaldokument als Beleg wird der Inhalt nicht übernommen. Der Artikel wurde NICHT verändert. Das gilt unabhängig von der Einstellung „Externes Wissen“: übernommener Dokumentinhalt muss an seinem Original hängen.",
  // (2) Die EXTERNE STUFENREGEL hat abgelehnt (eigene Regel, eigener Grund).
  "xtr.append.blockedByStage":
    "Auf der eingestellten Stufe „Externes Wissen“ darf diese Quelle nicht an ein Wissensobjekt angehängt werden. Der Artikel wurde NICHT verändert. Ein Administrator kann die Stufe unter Verwaltung → Externes Wissen ändern.",
  // (3) Der Ausgang ist UNKLAR. Hier stand früher die Kompensation — sie hat den Schaden erst
  //     angerichtet. Jetzt wird nichts angefasst und ehrlich zum Nachsehen aufgefordert.
  "xtr.append.unclear":
    "Der Ausgang ist unklar — die Verbindung brach ab, bevor der Server geantwortet hat. Es wurde NICHTS zurückgenommen: die Übernahme kann vollzogen sein oder nicht. Bitte den Artikel öffnen und nachsehen; ein erneuter Versuch mit demselben Vorgang legt nichts doppelt an.",
  "xtr.append.stateUnchanged":
    "Der Artikel wurde NICHT verändert — es wurde kein Inhalt ohne Herkunft gespeichert. Du kannst die Übernahme unverändert erneut versuchen.",
  // Folgeschritte NACH dem Commit (Konflikt-/Überschneidungs-Entwertung, KI-Prüfung) sind nicht
  // gelaufen. Die Übernahme GILT trotzdem — das ist die entscheidende Aussage, und sie steht zuerst.
  "xtr.append.followUpsFailed":
    "Die Übernahme ist gespeichert (Inhalt und Herkunft). Ein nachgelagerter Schritt lief nicht: {{steps}}. Die erneute KI-Prüfung kann dadurch fehlen — sie lässt sich auf der Validierungsseite neu anstoßen.",
  "xtr.help.title": "Aus Dokument ergänzen",
  "xtr.help.body":
    "Die KI liest ein von dir hochgeladenes Dokument und schlägt Wissenspunkte vor — jeder Punkt trägt seine Belegstelle aus dem Dokument (ohne Beleg keine Übernahme). Du wählst per Häkchen aus; Ausgewähltes wird als Abschnitt an deinen Artikel ANGEHÄNGT, nichts wird ersetzt oder überschrieben. Die Herkunft (Dateiname + Belegstelle) wird als Stufe-2-Quelle am Wissensobjekt vermerkt — sie gilt nicht als peer-validiert und ersetzt keine Prüfung.",
  "fd.kicker": "Erfassen",
  // AUFTRAG-mega38 BLOCK I: „Canvas" uebersetzt.
  "fd.title": "Dokument-Editor",
  "fd.backToCapture": "Zurück zu Wissen erfassen",
  "fd.allModes": "Alle Erfassungs-Modi",
  "fd.submitted": "Zur Prüfung eingereicht:",
  "fd.submittedBody":
    "Der Editor ist abgeschlossen und geleert. Speichern oder erneutes Einreichen desselben Inhalts ist gesperrt; ein neuer Eintrag startet nur bewusst über den Button.",
  "fd.openValidation": "Validierung öffnen",
  "fd.viewObject": "Objekt ansehen",
  "fd.newEntry": "Neuer Eintrag",
  "fd.titleOptional": "Titel optional",
  "fd.content": "Inhalt",
  "fd.draftLoading": "Entwurf wird geladen ...",
  "fd.draftOpen": "Vordertür-Entwurf geöffnet. Änderungen bleiben in diesem Entwurf.",
  "fd.editorPlaceholder":
    "Beschreibe hier dein Wissen, wie du es einem Kollegen erklären würdest — die KI strukturiert daraus einen Entwurf, den du prüfst und einreichst.",
  "fd.structureSuggest": "KI-Struktur vorschlagen",
  "fd.needContentFirst": "Schreibe zuerst Inhalt, dann kann ein Vorschlag erzeugt werden.",
  "fd.optionalAiHint": "Optionaler KI-Vorschlag. Nichts wird automatisch gespeichert.",
  "fd.aiHelp": "KI-Hilfe",
  "fd.aiHelpApply": "KI-Hilfe anwenden",
  "fd.aiHelpModes": "Klarer, strukturieren, erweitern, Rechtschreibung oder formatieren.",
  "fd.structureGenerating": "KI-Vorschlag wird erzeugt ...",
  "fd.assistGenerating": "KI-Hilfe-Vorschlag wird erzeugt ...",
  "fd.originalUnchanged": "Originaltext bleibt unverändert.",
  "fd.structureAccepted":
    "KI-Vorschlag übernommen. Bitte prüfen; gespeichert wird erst mit deiner nächsten Aktion.",
  "fd.structureKeptRichBodyTitle":
    "Struktur-Vorschlag: Titel übernommen. Der formatierte Inhalt mit Bildern und Formatierung bleibt unverändert erhalten.",
  "fd.structureKeptRichBodyNoTitle":
    "Der formatierte Inhalt bleibt erhalten; der Struktur-Vorschlag wurde nicht in den Inhalt übernommen.",
  "fd.structureRichTitleOnly":
    "Formatierter Inhalt mit Bildern bleibt erhalten — die KI schlägt nur einen Titel vor.",
  "fd.assistAccepted":
    "KI-Hilfe übernommen. Bitte prüfen; gespeichert wird erst mit deiner nächsten Aktion.",
  "fd.aiProposal": "KI-Vorschlag",
  "fd.aiProposalCheck": "KI-generiert. Bitte prüfen, bevor du etwas übernimmst.",
  "fd.fallback": "Fallback",
  "fd.fallbackNoModel":
    "KI ist nicht konfiguriert oder deaktiviert — dieser Vorschlag ist eine einfache automatische Ableitung, keine Modell-Antwort.",
  "fd.fallbackModelError":
    "KI meldete einen Fehler oder war nicht erreichbar — dieser Vorschlag ist eine einfache automatische Ableitung, keine Modell-Antwort.",
  // WP-D10 Fix 3: Zeitüberschreitung als EIGENE, ehrliche Ursache (nicht mehr im Sammelbegriff Fehler).
  "fd.fallbackModelTimeout":
    "KI hat nicht rechtzeitig geantwortet (Zeitüberschreitung) — dieser Vorschlag ist eine einfache automatische Ableitung, keine Modell-Antwort.",
  // WP-SHIP9-S2 (bens Folgeschnitt B4): vertraulichkeitsbedingter Cloud-Ausschluss als eigener, wahrer Grund.
  "fd.fallbackConfidential":
    "Der Text ist als vertraulich eingestuft — die Cloud-KI ist dafür ausgeschlossen und kein lokales Modell ist verdrahtet. Dieser Vorschlag ist eine einfache automatische Ableitung, keine Modell-Antwort.",
  "fd.fieldTitle": "Titel",
  "fd.fieldStatement": "Aussage / Kernaussage",
  "fd.fieldConditions": "Bedingungen",
  "fd.noConditions": "Keine Bedingungen vorgeschlagen.",
  "fd.fieldMeasures": "Maßnahmen",
  "fd.noMeasures": "Keine Maßnahmen vorgeschlagen.",
  "fd.fieldTags": "Hinweise / Tags",
  "fd.aiHelpProposal": "KI-Hilfe-Vorschlag",
  "fd.assistProposalCheck": "{{action}}: KI-generiert. Bitte prüfen, bevor du etwas übernimmst.",
  "fd.accept": "Übernehmen",
  "fd.discardProposal": "Vorschlag verwerfen",
  "fd.submitReview": "Prüfen & einreichen",
  "fd.saveDraft": "Als Entwurf speichern",
  "fd.discardInput": "Eingabe verwerfen",
  "fd.back": "Zurück",
  "fd.writeToSubmit": "Schreibe oder füge Inhalt ein, dann kannst du prüfen und einreichen.",
  // AUFTRAG-mega9 Block A (KW-E2E-001): sichtbare Feldvalidierung beim Einreichversuch — statt eines
  // still deaktivierten Knopfes wird die Bedingung benannt und ein Weg genannt.
  "fd.validate.lead": "Einreichen ist so noch nicht möglich:",
  "fd.validate.needBody": "Der Inhalt ist leer. Zum Einreichen braucht das Wissensobjekt Text.",
  "fd.validate.hint":
    "Du kannst den leeren Stand weiterhin als Entwurf speichern und später fortsetzen.",
  // AUFTRAG-mega9 Block B (KW-E2E-002): was ein Vordertür-Entwurf NICHT sichern kann — beim Wechsel
  // namentlich benannt, damit kein „Speichern" etwas still fallen lässt.
  "fd.unsavable.proposal":
    "Der angezeigte KI-Vorschlag ist noch nicht übernommen und wird nicht mitgespeichert.",
  "fd.unsavable.confidentialityOnly":
    "Die gewählte Vertraulichkeit ohne Titel und ohne Inhalt — dazu gibt es noch keinen Entwurf, der sie halten könnte.",
  "fd.statusLabel": "Status",
  "fd.titleOnSave": "Titel beim Speichern",
  "fd.author": "Autor",
  "fd.whatOnSave": "Was beim Speichern passiert",
  "fd.whatOnSaveBody":
    "Wird als Entwurf gesichert — jederzeit fortsetzbar. Zur Prüfung geht er erst, wenn du „Einreichen“ wählst; nichts wird automatisch validiert.",
  "fd.moreWays": "Mehr Erfassungswege",
  "fd.moreWaysBody":
    "Brauchst du das klassische Formular, Diktat oder das geführte Interview? Der vollständige Erfassen-Bereich hat alle Wege — diese Fläche hier ist der schnelle Einstieg.",
  // JOB 530: die weiteren Eingabeoptionen hinter dem Aufklappmuster — je Weg ein ehrlicher Satz,
  // wofür er da ist. Kein Versprechen, das der Weg nicht hält.
  "fd.options.show": "Weitere Eingabeoptionen anzeigen",
  "fd.options.hide": "Weitere Eingabeoptionen einklappen",
  "fd.options.hint.freitext":
    "Frei erzählen, die KI macht daraus einen Strukturvorschlag, den du prüfst.",
  "fd.options.hint.diktat": "Sprechen statt tippen — der Text landet im selben Erzählfeld.",
  "fd.options.hint.interview": "Geführte Rückfragen, wenn du nicht weißt, wo du anfangen sollst.",
  "fd.options.hint.datei": "Wissen aus einer vorhandenen Datei übernehmen.",
  "fd.options.hint.formular":
    "Expertenmodus: dieselben Felder direkt ausfüllen, ohne Erzählschritt.",
  "fd.toastSaved": "Entwurf gespeichert.",
  // JOB 3106 (UX-01): die bleibende Bestätigung unter den Knöpfen. Sie sagt genau das, was der
  // Server quittiert hat — der Entwurf liegt unter diesem Titel, und das Blatt schreibt in ihn
  // weiter (die Adresse trägt seine Kennung). Keine Zusage über die Entwurfsliste daneben.
  "fd.saved.line": "Entwurf gesichert: {{titel}} — du schreibst hier in diesem Entwurf weiter.",
  "fd.saved.toDrafts": "Meine Entwürfe",
  "fd.toastSubmitted": "Zur Prüfung eingereicht.",
  "fd.confirmDiscard": "Eingabe verwerfen? Nicht gespeicherte Inhalte gehen verloren.",
  // JOB 3256 (CAP-P1-R): EIGENER SATZ, kein zweckentfremdeter `fd.confirmDiscard`. Der spricht vom
  // Verwerfen; hier wird ein anderer Entwurf GEÖFFNET, und der Mensch muss wissen, wodurch sein
  // Text ersetzt wird. Leser: `components/erfassen/Blatt.tsx`, `entwurfOeffnen`.
  "fd.confirmOpenDraft":
    "Anderen Entwurf öffnen? Der nicht gespeicherte Inhalt dieses Blatts wird dabei ersetzt.",
  "fd.errSaveFailed": "Speichern fehlgeschlagen.",
  "fd.errLoadFailed": "Der Entwurf konnte nicht geladen werden. Es wurde nichts gespeichert.",
  // JOB 3141 (CAP-P1): Der Satz, der an der Stelle der Schreibfläche steht, solange ein Entwurf
  // geholt wird — und über `aria-describedby` auch am gesperrten Titelfeld. Er sagt zweierlei, weil
  // beides zusammen den Menschen nicht ratlos stehen lässt: WAS gerade läuft und WARUM das Blatt so
  // lange nichts annimmt. Ohne den zweiten Halbsatz wäre eine stumme Fläche nur begründet, nicht
  // erklärt (Auftrag §8.1).
  "erfassen.laden.nichtBereit":
    "Der Entwurf wird geholt. Bis er da ist, nimmt dieses Blatt nichts an — sonst würde der geladene Text dein Geschriebenes überschreiben.",
  "fd.draftStale":
    "Dieser Entwurf wurde inzwischen an anderer Stelle geändert — zum Beispiel in einem zweiten Tab. Dein Stand hier wurde NICHT gespeichert und nichts wurde überschrieben. „Neu laden“ holt die andere Fassung; was du hier getippt hast, geht dabei verloren — kopiere es vorher, wenn du es behalten willst.",
  "fd.draftStaleReload": "Neu laden",
  "fd.errAssist": "Ich kann diese KI-Hilfe gerade nicht verlässlich ausführen.",
  "fd.errSpelling": "Rechtschreibprüfung kann Formatierung aktuell nicht sicher erhalten.",

  // ==============================================================================================
  // JOB 3062 · H3 — DAS BLATT. Die WÖRTER der Werkzeugzeile und ihrer Untermenüs.
  // ==============================================================================================
  // Pedis Maßstab (04.09.): „Knopf und Feld erklären sich selbst." Deshalb steht hier kein einziger
  // Erklärsatz — nur die Wörter, die auf der Fläche stehen. Die Erklärungen leben unverändert in
  // `chelp.*` und erscheinen im „?"-Menü.
  "erfassen.werkzeug.diktieren": "Diktieren",
  "erfassen.werkzeug.bild": "Bild",
  "erfassen.werkzeug.datei": "Datei",
  "erfassen.werkzeug.ki": "KI",
  "erfassen.werkzeug.bereich": "Bereich",
  "erfassen.werkzeug.vertraulichkeit": "Vertraulichkeit",
  "erfassen.werkzeug.hilfe": "?",
  // JOB 3266 (D1): der NAME des „…"-Werkzeugs. Er steht nicht auf der Fläche (dort bleibt das
  // Symbol), sondern als `aria-label` am Knopf — bis hierher war er für Tastatur und Screenreader
  // eine namenlose Schaltfläche.
  "erfassen.werkzeug.mehr": "Mehr",
  "erfassen.weg.datei": "Datei importieren",
  "erfassen.weg.interview": "Interview führen",
  "erfassen.weg.formular": "Formular (Experten)",
  "erfassen.ki.struktur": "Struktur vorschlagen",
  "erfassen.ki.pille": "KI",
  "erfassen.mehr.entwuerfe": "Entwürfe",
  "erfassen.mehr.anhaenge": "Anhänge",
  "erfassen.mehr.status": "Status",
  "erfassen.mehr.beispiel": "Beispiel ansehen",
  "erfassen.mehr.klara": "Klara in Word",
  "erfassen.mehr.zurueck": "Zurück",
  "erfassen.bereich.leeren": "Kein Bereich",
  "erfassen.entwuerfe.keine": "Noch keine Entwürfe.",
  "erfassen.anhaenge.keine": "Noch keine Anhänge im Text.",
  "erfassen.anhaenge.anzahl": "{{n}} Bild(er) im Text.",
  "erfassen.anhaenge.verwalten": "Anhänge verwalten",
  "erfassen.beispiel.keins": "Im Bestand liegt noch kein passendes Beispiel.",
  "erfassen.platzhalter.titel": "Titel",
  "erfassen.platzhalter.text": "Text",
  "erfassen.entwurfSichern": "Entwurf sichern",
  "erfassen.einreichen": "Einreichen",
  "erfassen.eingereicht": "Eingereicht:",
  "erfassen.live.aehnlich": "Ähnlich:",
  "erfassen.live.widerspruch": "Könnte widersprechen:",
  "erfassen.live.neu": "Das ist neu",
  "erfassen.status.livePruefung": "Live-Prüfung",
  "erfassen.hilfe.bilder": "Bilder einfügen",
  "erfassen.erneutVersuchen": "Erneut versuchen",
  "dcmp.kicker": "Read-only Vergleich",
  "dcmp.titleDuplicate": "Duplikate vergleichen",
  "dcmp.titleConflict": "Konflikt vergleichen",
  "dcmp.back": "Zurück",
  "dcmp.loading": "Vergleich wird geladen.",
  "dcmp.loadError": "Vergleich konnte nicht geladen werden.",
  "dcmp.notFound": "Vergleich nicht gefunden oder bereits geschlossen.",
  "dcmp.textSimilarity": "Text-Ähnlichkeit",
  "dcmp.noProvenContradiction": "kein bewiesener Widerspruch — nur Wort-/Feldähnlichkeit",
  // REVIEW26 (JOB 3469): der Brückensatz. Er steht NUR, wenn Brett und Vergleichsseite für
  // dasselbe Paar wirklich verschiedene Metriken führen — sonst behauptete er einen Sprung,
  // den es nicht gibt.
  "dcmp.metricBridge":
    "Dasselbe Paar, zwei Messungen: Auf dem Brett „Duplikate“ steht {{board}}, hier {{compare}}. Kein Widerspruch — die beiden Zahlen messen Verschiedenes.",
  "dcmp.moreValues": "Weitere Werte",
  "dcmp.uncertainty": "Unsicherheit",
  "dcmp.textDifference": "Textunterschied",
  "dcmp.similarity": "Ähnlichkeit",
  "dcmp.scoresHint": "Scores sind Entscheidungshilfe, keine Wahrheit. Kein automatischer Merge.",
  "dcmp.viewDetails": "Details ansehen",
  "dcmp.objectRemoved": "Objekt entfernt",
  "dcmp.left": "Links",
  "dcmp.right": "Rechts",
  "dcmp.koA": "Wissensobjekt A",
  "dcmp.koB": "Wissensobjekt B",
  "dcmp.sectionSignals": "Abschnittsampeln",
  "dcmp.compareByAreas": "Vergleich nach Wissensbereichen",
  "dcmp.legendHelpTitle": "Was bedeuten die Ampelfarben?",
  "dcmp.legendHelpBody":
    "Jeder Abschnitt bekommt eine Farbe aus dem Textabgleich: Grün = die Inhalte decken sich weitgehend, Gelb = teilweise oder unklar (genauer ansehen), Rot = die Texte weichen ab. Rot bedeutet nur Unterschied, kein bewiesener Widerspruch — die Farben sind eine Lesehilfe, kein Urteil, und es wird nichts automatisch zusammengeführt.",
  "dcmp.onlyForComparison":
    "Nur zum Vergleich: Es wird nichts zusammengeführt, gelöscht oder validiert, und keine Entscheidung wird gespeichert.",
  // ==============================================================================================
  // JOB 3671 — DIE SEITENHILFE DER VERGLEICHSSEITE (Zahnrad → „Seitenhilfe").
  // ==============================================================================================
  //
  // DIESE SEITE HAT SCHON EINE HILFE: die Legende „Was bedeuten die Ampelfarben?" steht als Block
  // im Aufklapper „Mehr" (pages/DuplicateCompare.tsx:341). Sie wird hier NICHT wiederholt — der
  // Text VERWEIST auf sie und trägt ihren Titel per Einsetzung, damit keine zweite Wahrheit
  // entsteht (Auftrag §4.3). Was die Legende nicht sagt, steht hier: wo man ist, dass nichts
  // gespeichert wird, und wo entschieden wird.
  //
  // `{{brett}}` ist die Reiterbeschriftung der aufrufenden Fläche (`pruefen.tab.*`) — die Seite
  // dient Duplikaten UND Konflikten, und der Text muss für beide stimmen.
  //
  // „nichts gespeichert" ist am Quelltext geprüft: `DuplicateCompare` ruft keine Mutation auf; die
  // Seite liest `useDuplicates`, `useConflicts`, `useKos` und sonst nichts.
  "dcmp.seitenhilfe.titel": "Vergleichen, nicht entscheiden",
  "dcmp.seitenhilfe.text":
    "Hier stehen dieselben zwei Objekte wie auf dem Brett einander gegenüber; auf schmalen Fenstern untereinander — die obere Karte ist die, die im Vergleich Feld für Feld „Links“ heißt. Im Aufklapper „{{mehr}}“ liegen Ähnlichkeit, Unsicherheit, Textunterschied und dieser Feldvergleich; was die drei Ampelfarben bedeuten, erklärt dort die Legende „{{legende}}“ — sie wird hier nicht wiederholt. Gespeichert wird auf dieser Seite nichts: sie führt nicht zusammen, löscht nicht, validiert nicht und hält keine Entscheidung fest. Falsch machen kannst du hier also nichts; entschieden wird auf dem Brett „{{brett}}“, und der gleichnamige Reiter oben führt dorthin zurück.",
  "dcmp.sourceDuplicate": "Duplikatvergleich: {{relation}}",
  "dcmp.sourceConflict": "Konfliktvergleich: {{type}}",
  "dcmp.sectionCompareUnavailable":
    "Abschnittsvergleich nicht möglich, weil ein Wissensobjekt fehlt.",
  "dcmp.relation.identisch": "identisch",
  "dcmp.relation.a_enthaelt_b": "A enthält B",
  "dcmp.relation.b_enthaelt_a": "B enthält A",
  "dcmp.relation.teilweise": "teilweise Überschneidung",
  "dcmp.relation.verwandt": "verwandt",
  "dcmp.conflictType.truth": "Wahrheitskonflikt",
  "dcmp.conflictType.experience": "Erfahrungskonflikt",
  "dcmp.conflictType.context": "Kontextkonflikt",
  "dcmp.conflictType.temporal": "zeitlicher Konflikt",
  "dcmp.conflictType.role": "Rollenkonflikt",
  "dcmp.tone.green.label": "Übereinstimmung",
  "dcmp.tone.green.meaning": "Text und Felder decken sich weitgehend.",
  "dcmp.tone.yellow.label": "Unsicher",
  "dcmp.tone.yellow.meaning": "Teilweise oder unklar — genauer ansehen.",
  "dcmp.tone.red.label": "Unterschied",
  "dcmp.tone.red.meaning": "Text weicht ab — nur ein Unterschied, kein bewiesener Widerspruch.",
  "dcmp.section.title": "Titel",
  "dcmp.section.statement": "Kernaussage / Inhalt",
  "dcmp.section.conditions": "Bedingungen",
  "dcmp.section.measures": "Maßnahmen",
  "dcmp.section.hints": "Hinweise",
  "dcmp.section.sources": "Quellen / Evidence",
  "dcmp.section.tags": "Tags / Kategorie",
  "dcmp.section.trust": "Vertrauen / Validierungsstatus",
  // SCRUM-487 (i18n): reason/note-Heuristiktexte als Keys aus der Lib (duplicateCompare.ts).
  "dcmp.note.bothEmpty":
    "Vorläufige Feldheuristik; keine echten Detector-Scores für diesen Abschnitt.",
  "dcmp.note.exactMatch": "Vorläufige Feldheuristik; exakte Feldgleichheit.",
  "dcmp.note.oneMissing": "Vorläufige Feldheuristik; ein Wert fehlt.",
  "dcmp.note.heuristic": "Vorläufige Feldheuristik; keine fachliche Wahrheit.",
  "dcmp.note.noScore":
    "Score nicht vorhanden: Gesamtwerte sind vorläufige Feldheuristik ohne Detector-Prozent.",
  "dcmp.note.mixedOverlap":
    "Übereinstimmung aus bestehendem Detector; Konflikt/Unsicherheit bleiben vorläufige Anzeigehilfe.",
  "dcmp.note.mixedConflict":
    "Konfliktwert aus bestehendem Detector; Übereinstimmung bleibt vorläufige Feldheuristik.",
  "dcmp.reason.bothEmpty": "Beide Seiten haben keinen verwertbaren Wert.",
  "dcmp.reason.identical": "Die Werte sind identisch.",
  "dcmp.reason.oneMissing": "Ein Wert fehlt, daher ist kein echter Konflikt ableitbar.",
  "dcmp.reason.strongDiff":
    "Die Feldwerte unterscheiden sich stark und müssen fachlich geprüft werden.",
  "dcmp.reason.partialDiff":
    "Die Feldwerte unterscheiden sich teilweise und müssen geprüft werden.",
  // SCRUM-487 (i18n): Front-Door-Lib-Konstanten (captureFrontDoor.ts).
  "cfd.fallbackTitle": "Unbenanntes Wissensobjekt",
  "cfd.structuringUnavailable": "Ich kann das gerade nicht verlässlich ordnen.",

  // ==============================================================================================
  // AUFTRAG-mega61 — RECHT UND TRANSPARENZ.
  // ==============================================================================================
  //
  // Die Texte sind NICHT neu formuliert. Sie stammen wörtlich aus den rechtlich abgewogenen
  // Entwürfen des Kopfes (_relay/kopf/RECHT-Entwuerfe-und-Overview.md Teil 1 und 2,
  // RECHT-KI-Verordnung-Umsetzung.md Abschnitt 8, RECHT-Klaerung-und-Bannerkonzept.md Teil B) und
  // sind sinngleich nach EN und NL übersetzt. Wer sie ändert, ändert eine Rechtsaussage.
  //
  // DIE `legal.tbd.*`-SCHLÜSSEL SIND EINE EIGENE KLASSE: Angaben, die niemand im Code kennt
  // (Firmenname, Anschrift, Aufsichtsbehörde, Löschfristen, Anbieter). Sie tragen AUSNAHMSLOS den
  // Wert von `legal.pending` — nichts wird erfunden, auch nicht plausibel. Der Sammler
  // tests/legal/mega61-rechtsseiten.test.tsx hält das fest und wird rot, sobald einer von ihnen
  // einen ausgedachten Wert trägt.
  "legal.pending": "— wird ergänzt —",
  "legal.tbd.company": "— wird ergänzt —",
  "legal.tbd.address": "— wird ergänzt —",
  "legal.tbd.representative": "— wird ergänzt —",
  "legal.tbd.email": "— wird ergänzt —",
  "legal.tbd.phone": "— wird ergänzt —",
  "legal.tbd.register": "— wird ergänzt —",
  "legal.tbd.vatId": "— wird ergänzt —",
  "legal.tbd.responsible": "— wird ergänzt —",
  "legal.tbd.supervisoryAuthority": "— wird ergänzt —",
  "legal.tbd.dataProtectionContact": "— wird ergänzt —",
  "legal.tbd.dataProtectionOfficer": "— wird ergänzt —",
  "legal.tbd.retention": "— wird ergänzt —",
  "legal.tbd.serverLogs": "— wird ergänzt —",
  "legal.tbd.modelProvider": "— wird ergänzt —",
  "legal.tbd.mailProvider": "— wird ergänzt —",
  "legal.tbd.hostingProvider": "— wird ergänzt —",
  "legal.tbd.thirdCountry": "— wird ergänzt —",
  "legal.tbd.version": "— wird ergänzt —",

  // Der Vermerk am Anfang beider Seiten. Ohne ihn sieht ein „— wird ergänzt —“ wie ein Fehler aus,
  // mit ihm wie eine Absicht — das ist der Unterschied zwischen schlampig und bewusst.
  "legal.draftNotice.title": "Entwurfsstand",
  "legal.draftNotice.body":
    "Diese Anwendung befindet sich in einer geschlossenen Testphase und ist nicht öffentlich zugänglich. Die noch offenen Angaben werden vor der Veröffentlichung ergänzt.",
  "legal.footer.title": "Rechtliches",
  "legal.footer.imprint": "Impressum",
  "legal.footer.privacy": "Datenschutz",
  "legal.back": "Zurück zur Anwendung",

  "legal.imprint.title": "Impressum",
  "legal.imprint.ddg": "Angaben gemäß § 5 DDG",
  "legal.imprint.representedBy": "Vertreten durch",
  "legal.imprint.contact": "Kontakt",
  "legal.imprint.contactEmail": "E-Mail",
  "legal.imprint.contactPhone": "Telefon",
  "legal.imprint.register": "Registereintrag",
  "legal.imprint.registerNote":
    "Dieser Abschnitt entfällt vollständig, solange kein Registereintrag besteht. Er wird dann gestrichen und nicht mit einem Ersatzwert gefüllt.",
  "legal.imprint.vat": "Umsatzsteuer-Identifikationsnummer",
  "legal.imprint.vatText": "Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:",
  "legal.imprint.responsible": "Verantwortlich für den Inhalt",
  "legal.imprint.supervisory": "Aufsichtsbehörde",
  "legal.imprint.supervisoryNote":
    "Dieser Abschnitt entfällt. Er ist nur bei erlaubnispflichtigen Tätigkeiten anzugeben; die Bereitstellung einer Wissensmanagement-Software ist nach heutigem Stand nicht erlaubnispflichtig.",
  "legal.imprint.status": "Hinweis zum Stand dieses Angebots",
  "legal.imprint.statusBody":
    "Dieses Angebot befindet sich in einer geschlossenen Testphase und ist ausschließlich für eingeladene Benutzerinnen und Benutzer bestimmt. Es richtet sich nicht an Verbraucher und stellt kein öffentliches Angebot dar.",

  "legal.privacy.title": "Datenschutzerklärung",
  "legal.privacy.label.purpose": "Zweck",
  "legal.privacy.label.basis": "Rechtsgrundlage",
  "legal.privacy.label.retention": "Speicherdauer",
  "legal.privacy.label.recipient": "Empfänger",
  "legal.privacy.s1.title": "1. Verantwortlicher",
  "legal.privacy.s1.body":
    "Verantwortlich für die Verarbeitung personenbezogener Daten im Sinne der Datenschutz-Grundverordnung ist:",
  "legal.privacy.s1.dpo": "Datenschutzbeauftragter:",
  "legal.privacy.s2.title": "2. Grundsatz",
  "legal.privacy.s2.body":
    "Wir verarbeiten personenbezogene Daten nur, soweit dies für den Betrieb dieser Anwendung erforderlich ist. Wir setzen keine Analyse-, Tracking- oder Werbedienste ein, laden keine Inhalte von fremden Servern in Ihren Browser und verwenden keine Zählpixel. Die Sicherheitsrichtlinie unseres Servers unterbindet Verbindungen Ihres Browsers zu fremden Anbietern technisch.",
  "legal.privacy.s3.title": "3. Nutzerkonto und Anmeldung",
  "legal.privacy.s3.body":
    "Um die Anwendung zu nutzen, benötigen Sie ein Konto. Dabei verarbeiten wir Ihren Namen, Ihre E-Mail-Adresse und Ihr Passwort. Das Passwort wird ausschließlich in einer nicht rückrechenbaren Form gespeichert.",
  "legal.privacy.s3.purpose":
    "Bereitstellung des Zugangs, Zuordnung Ihrer Beiträge, Sicherheit des Zugangs.",
  "legal.privacy.s3.basis":
    "Erfüllung des Vertrags beziehungsweise des Nutzungsverhältnisses, Artikel 6 Absatz 1 Buchstabe b DSGVO.",
  "legal.privacy.s3.retention": "Für die Dauer des Nutzungsverhältnisses.",
  "legal.privacy.s3.reset":
    "Wenn Sie Ihr Passwort zurücksetzen, erzeugen wir eine einmalige Kennung, die eine Stunde gültig ist und danach verfällt.",
  "legal.privacy.s4.title": "4. Speicherung in Ihrem Endgerät",
  "legal.privacy.s4.p1":
    "Beim Anmelden setzen wir ein Cookie mit dem Namen kw_session. Es enthält ausschließlich eine Zufallskennung, keine Angaben über Sie. Es ist für Skripte im Browser nicht lesbar, wird nur über eine verschlüsselte Verbindung übertragen, gilt vierzehn Tage und wird beim Abmelden gelöscht. Auf unserem Server ist dazu nur ein Prüfwert gespeichert, nicht die Kennung selbst.",
  "legal.privacy.s4.p2":
    "Ohne dieses Cookie ist eine angemeldete Nutzung technisch nicht möglich. Es ist damit für den von Ihnen ausdrücklich gewünschten Dienst unbedingt erforderlich; eine Einwilligung ist dafür nach § 25 Absatz 2 TDDDG nicht erforderlich.",
  "legal.privacy.s4.p3":
    "Melden Sie sich über das Anmeldeverfahren Ihrer Organisation an, setzen wir für die Dauer dieses Vorgangs drei weitere Kennungen, die zehn Minuten gelten und unmittelbar nach dem Abschluss gelöscht werden.",
  "legal.privacy.s4.p4":
    "Zusätzlich merkt sich die Anwendung in Ihrem Browser Ihre Ansichtseinstellungen — etwa Sortierung, gewählte Filter, gespeicherte Ansichten, das gewählte Erscheinungsbild und die Information, welche Einführungshinweise Sie bereits gesehen haben. Diese Angaben verlassen Ihren Browser nicht und werden nicht an uns übertragen. Sie entstehen erst, wenn Sie die betreffende Funktion verwenden. Die Anwendung funktioniert auch dann vollständig, wenn Ihr Browser diese Speicherung unterbindet.",
  "legal.privacy.s4.p5":
    "Ein Hinweis, der Ihnen wichtig sein kann: Erfassen Sie Inhalte, während keine Verbindung zu unserem Server besteht, bewahrt die Anwendung diese Entwürfe in Ihrem Browser auf, bis sie übertragen werden können. In dieser Zwischenspeicherung können daher von Ihnen verfasste Inhalte liegen. Sie werden nach der Übertragung dort entfernt.",
  "legal.privacy.s4.p6":
    "Wenn Sie die Anwendung als installierte Anwendung nutzen, legt Ihr Browser Programmdateien in einem Zwischenspeicher ab, damit sie schneller startet. Antworten unseres Servers und Ihre Inhalte werden dort nicht abgelegt.",
  // AUFTRAG-mega63 Block D: Block A führt einen NEUEN Browser-Token ein (kw_signout_pending). Diese
  // Aufzählung ist eine Tatsachenaussage über unser Produkt — fehlte der Merker darin, wäre sie ab
  // heute unvollständig. Zweck, Ort, Lebensdauer und die Einordnung als technisch notwendig stehen
  // ausdrücklich dabei; eine darüber hinausgehende rechtliche Bewertung wird hier nicht getroffen.
  //
  // AUFTRAG-mega64 Block B — DIESER ABSATZ IST ERSETZT, NICHT ERGÄNZT.
  // Er beschrieb bis mega63 einen Merker, der nur in EINEM Tab galt und beim Schließen des Tabs
  // verschwand. Beides trifft ab mega64 nicht mehr zu: Der Merker liegt im dauerhaften
  // Browserspeicher (`localStorage`) und gilt in allen Tabs desselben Browsers. Einen zweiten Absatz
  // DANEBEN zu stellen wäre der schlimmere Fehler — es gäbe dann zwei Aussagen über denselben
  // Merker, und die Nutzerin müsste raten, welche gilt.
  //
  // AUFTRAG-mega65 BLOCK B — DIE FRIST VERSCHWINDET AUS DIESEM ABSATZ, WEIL SIE AUS DEM CODE
  // VERSCHWINDET.
  //
  // Hier stand bis mega64: „kommt beides nicht zustande, verfällt er spätestens nach vierundzwanzig
  // Stunden von selbst." Das war eine falsche Tatsachenaussage in einer Rechtsfläche, und ben hat sie
  // am Code belegt (sammel62, ROT-2): `abmeldeschuldGesetzt()` las die gespeicherte Frist in dem Tab,
  // in dem die Abmeldung scheiterte, überhaupt nicht, und ein beschädigter Eintrag sperrte über
  // Neustarts hinweg unbegrenzt.
  //
  // Der Code führt seit mega65 KEINE Frist mehr (Begründung in `app/abmeldeschuld.ts`), und dieser
  // Satz sagt jetzt, was wirklich geschieht: Der Merker bleibt, bis die Beendigung bestätigt ist
  // oder feststeht, dass die Sitzung nicht mehr besteht — und die Anwendung arbeitet von sich aus
  // darauf hin, bei zurückkehrender Verbindung UND bei jedem neuen Aufbau. Das ist der ehrlichere
  // Text: Er verspricht keinen Automatismus mit Uhr, sondern benennt die Bedingung und den Weg
  // dorthin. Der Sammler `tests/legal/mega63-speicher-aufzaehlung.test.ts` hält beide Seiten
  // zusammen — führt der Code keine Frist, darf hier keine stehen.
  //
  // Die vier Pflichtangaben stehen weiterhin vollständig darin: Zweck (Nutzung gesperrt bis zur
  // Bestätigung), Ort (dauerhafter Browserspeicher, nicht Tab), Lebensdauer (bis zur Bestätigung
  // bzw. bis feststeht, dass die Sitzung fort ist — ohne Frist), Einordnung (technisch notwendig).
  "legal.privacy.s4.p7":
    "Schlägt das Beenden Ihrer Sitzung fehl, merkt sich die Anwendung das in Ihrem Browser unter dem Namen kw_signout_pending, damit die Nutzung gesperrt bleibt, bis unser Server die Beendigung bestätigt hat. Weil Ihre Sitzung für alle Fenster und Tabs desselben Browsers gilt, liegt dieser Merker im dauerhaften Browserspeicher und wirkt ebenfalls in allen Fenstern und Tabs — ein zweites, schon offenes Fenster würde sonst weiter Inhalte zeigen, obwohl die Beendigung offen ist. Der Merker enthält keine Angaben über Sie und wird nicht an uns übertragen. Er bleibt, bis unser Server die Beendigung bestätigt hat oder feststeht, dass Ihre Sitzung nicht mehr besteht; dann wird er gelöscht. Von selbst verfällt er nicht. Damit das nicht an Ihnen hängen bleibt, versucht die Anwendung die Beendigung von sich aus erneut — sobald Ihre Verbindung wieder besteht und bei jedem neuen Aufbau der Anwendung; außerdem können Sie es jederzeit selbst auslösen. Er ist für die von Ihnen gewünschte Abmeldung technisch notwendig.",
  // Pedi 28.09.2026 · Ergänzung 1: der Arbeitsstand der Fragenseite liegt im Browser
  // (`lib/fragenArbeitsstand.ts`) und enthält Inhalte — die Aufzählung nennt ihn deshalb eigens.
  "legal.privacy.s4.p8":
    "Auf der Seite „Fragen“ merkt sich die Anwendung in Ihrem Browser Ihren noch nicht gesendeten Entwurf sowie die zuletzt angezeigte Frage und Antwort mit ihren Quellenangaben, damit Sie nach dem Verlassen der Seite, einem Neuladen oder einer erneuten Anmeldung weiterarbeiten können. Der Eintrag ist Ihrem Benutzerkonto zugeordnet; wer sich im selben Browser mit einem anderen Konto anmeldet, bekommt ihn nicht angezeigt. Er kann Inhalte aus dem Wissensbestand Ihrer Organisation enthalten und bleibt auch nach dem Abmelden in diesem Browser gespeichert. Ein verworfener Entwurf wird sofort entfernt, die angezeigte Antwort wird ersetzt, sobald Sie eine neue Frage stellen. Der Eintrag selbst wird nicht an uns übertragen; Sie können ihn jederzeit löschen, indem Sie die Websitedaten dieser Anwendung in Ihrem Browser löschen.",
  "legal.privacy.s5.title": "5. Ihre Inhalte",
  "legal.privacy.s5.body":
    "Die Anwendung dient dazu, Wissen zu erfassen, zu prüfen und wiederzufinden. Die Inhalte, die Sie eingeben oder hochladen, werden zusammen mit dem Zeitpunkt und Ihrer Kennung als Urheber gespeichert, damit Beiträge nachvollziehbar bleiben und Rückfragen möglich sind.",
  "legal.privacy.s5.basis": "Vertragserfüllung, Artikel 6 Absatz 1 Buchstabe b DSGVO.",
  "legal.privacy.s6.title": "6. Nachvollziehbarkeit von Änderungen",
  "legal.privacy.s6.body":
    "Um Änderungen an geprüftem Wissen nachvollziehbar zu halten, führen wir ein fortlaufendes, gegen nachträgliche Veränderung gesichertes Protokoll. Darin stehen der Zeitpunkt, die Kennung der handelnden Person, die Art der Handlung und das betroffene Objekt. IP-Adresse und Browserkennung werden in diesem Protokoll nicht gespeichert. Auch Anmeldung und Abmeldung werden auf diese Weise vermerkt.",
  "legal.privacy.s6.basis":
    "Berechtigtes Interesse an der Integrität und Nachvollziehbarkeit geprüften Wissens, Artikel 6 Absatz 1 Buchstabe f DSGVO.",
  "legal.privacy.s7.title": "7. Schutz vor Missbrauch",
  "legal.privacy.s7.body":
    "Um automatisierte Anmeldeversuche abzuwehren, zählen wir fehlgeschlagene Versuche kurzzeitig im Arbeitsspeicher, bezogen auf die IP-Adresse und die eingegebene E-Mail-Adresse. Diese Zähler werden nicht dauerhaft gespeichert.",
  "legal.privacy.s7.basis":
    "Berechtigtes Interesse an der Sicherheit der Anwendung, Artikel 6 Absatz 1 Buchstabe f DSGVO.",
  "legal.privacy.s7.logs": "Betriebsprotokolle des Webservers:",
  "legal.privacy.s8.title": "8. Künstliche Intelligenz",
  "legal.privacy.s8.p1":
    "Bestimmte Funktionen der Anwendung nutzen ein KI-Modell — etwa das Beantworten von Fragen, das Strukturieren von Notizen, das Vorschlagen von Bildbeschreibungen und das Gruppieren importierter Inhalte. Damit ein solches Ergebnis entstehen kann, werden die dafür benötigten Inhalte an den Betreiber des Modells übermittelt und dort verarbeitet.",
  "legal.privacy.s8.p2":
    "Die Anwendung zeigt Ihnen an jeder betroffenen Stelle an, dass ein KI-Modell arbeitet und welche Art von Modell das ist. Ergebnisse eines KI-Modells können unzutreffend sein und ersetzen keine fachliche Prüfung.",
  // AUFTRAG-mega61 Block G: dieser Absatz ist die einzige Tatsachenzusicherung der Erklärung, die
  // am Code hängt. Sie steht hier NUR, weil sie einen Test hat, der rot wird, wenn sie fällt
  // (tests/ask/mega61-vertraulich-kein-cloud-kontext.test.ts). Und sie behauptet ausdrücklich
  // NICHT mehr, als sie deckt: der Fragetext selbst wird übermittelt.
  "legal.privacy.s8.p3":
    "Wissensobjekte, die als vertraulich oder streng vertraulich eingestuft sind, werden aus dem Zusammenhang entfernt, bevor eine Frage an ein Modell geht — sie erreichen das Modell nicht. Der Text Ihrer Frage wird dagegen übermittelt: Bitte geben Sie dort keine vertraulichen Inhalte ein.",
  "legal.privacy.s8.thirdCountry": "Übermittlung in ein Drittland:",
  "legal.privacy.s9.title": "9. E-Mail-Versand",
  "legal.privacy.s9.body":
    "Für Einladungen und das Zurücksetzen von Passwörtern versenden wir E-Mails.",
  "legal.privacy.s9.basis": "Vertragserfüllung, Artikel 6 Absatz 1 Buchstabe b DSGVO.",
  "legal.privacy.s10.title": "10. Hosting",
  "legal.privacy.s10.body": "Die Anwendung wird auf gemieteten Servern betrieben.",
  "legal.privacy.s10.basis":
    "Berechtigtes Interesse am wirtschaftlichen Betrieb, Artikel 6 Absatz 1 Buchstabe f DSGVO.",
  "legal.privacy.s11.title": "11. Anbindung weiterer Systeme",
  "legal.privacy.s11.body":
    "Wenn Ihre Organisation den Import aus einem eigenen System einrichtet, werden die dafür nötigen Inhalte von dort abgerufen. Welche Systeme das sind, entscheidet Ihre Organisation.",
  "legal.privacy.s12.title": "12. Keine automatisierte Entscheidung im Einzelfall",
  "legal.privacy.s12.body":
    "Es findet keine automatisierte Entscheidungsfindung einschließlich Profilbildung statt, die Ihnen gegenüber rechtliche Wirkung entfaltet oder Sie in ähnlicher Weise erheblich beeinträchtigt. Vorschläge des KI-Modells sind Vorschläge; über die Aufnahme und Prüfung von Wissen entscheiden Menschen.",
  "legal.privacy.s13.title": "13. Ihre Rechte",
  "legal.privacy.s13.body":
    "Sie haben das Recht auf Auskunft über die zu Ihrer Person gespeicherten Daten, auf Berichtigung unrichtiger Daten, auf Löschung, auf Einschränkung der Verarbeitung, auf Datenübertragbarkeit und auf Widerspruch gegen eine Verarbeitung, die auf einem berechtigten Interesse beruht. Haben Sie eine Einwilligung erteilt, können Sie diese jederzeit mit Wirkung für die Zukunft widerrufen; die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung bleibt unberührt.",
  "legal.privacy.s13.contact": "Kontakt für alle diese Anliegen:",
  "legal.privacy.s13.authority":
    "Unabhängig davon haben Sie das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, insbesondere bei der Behörde Ihres Aufenthaltsorts oder der für uns zuständigen Behörde:",
  "legal.privacy.s14.title": "14. Erforderlichkeit der Angaben",
  "legal.privacy.s14.body":
    "Die Angabe von Name, E-Mail-Adresse und Passwort ist für die Einrichtung eines Zugangs erforderlich. Ohne diese Angaben können wir keinen Zugang bereitstellen. Eine gesetzliche Pflicht zur Bereitstellung besteht nicht.",
  "legal.privacy.s15.title": "15. Änderungen",
  "legal.privacy.s15.body":
    "Wir passen diese Erklärung an, wenn sich die Anwendung oder die Rechtslage ändert. Stand dieser Fassung:",

  // ==============================================================================================
  // AUFTRAG-mega61 BLOCK B/D — DER HINWEISBANNER UND DIE FOLGE EINER ABLEHNUNG.
  // ==============================================================================================
  //
  // WORTLAUT IST HIER RECHTLICH BINDEND. Die Wörter „Zustimmung“ und „Einwilligung“ kommen in
  // diesen Texten NICHT vor, und das ist keine Stilfrage: Eine Auswahl, die man nicht folgenlos
  // verweigern kann, wäre als Einwilligung unwirksam — eine Scheineinwilligung täuscht eine
  // Rechtsgrundlage vor, die sie nicht hat. Was hier stattfindet, ist eine KENNTNISNAHME.
  // Der Sammler tests/legal/mega61-banner-wortlaut.test.ts hält das über alle drei Sprachen fest.
  // JOB 3761: EIN Schlüssel für BEIDE Flächen (Anmeldemaske und Kopfband), weil es dieselbe
  // Aussage ist — zwei Schlüssel liefen beim nächsten Umformulieren auseinander. Der Text sagt NUR,
  // was feststeht: dass diese Instanz die Vorführinstanz ist. Er sagt NICHTS über den Bestand
  // (eine Vorführinstanz muss keine Demodaten geladen haben), und es gibt bewusst keinen
  // Gegentext für die echte Instanz („Produktivsystem", „keine Demo") — der wäre zeitabhängig und
  // nicht belegbar, und die echte Instanz schreibt deshalb gar nichts.
  "demo.kennzeichen": "Demo-Instanz",
  "notice.banner.aria": "Hinweis zur Nutzung dieser Anwendung",
  "notice.banner.title": "Kurz zur Kenntnis",
  "notice.banner.ai":
    "Diese Anwendung arbeitet mit künstlicher Intelligenz. Wenn Sie eine Frage stellen, Notizen strukturieren lassen oder eine Bildbeschreibung vorschlagen lassen, wird ein KI-Modell verwendet, und die dafür benötigten Inhalte werden an dessen Betreiber übermittelt. Ergebnisse eines KI-Modells können unzutreffend sein und ersetzen keine fachliche Prüfung. An jeder betroffenen Stelle sehen Sie, welches Modell arbeitet.",
  "notice.banner.cookie":
    "Für die Anmeldung wird ein technisch notwendiges Sitzungscookie gesetzt. Ohne dieses Cookie ist eine angemeldete Nutzung nicht möglich.",
  "notice.banner.ack": "Verstanden — weiter",
  "notice.banner.decline": "Nicht einverstanden",
  "notice.decline.title": "Ihre Sitzung wird beendet",
  "notice.decline.body":
    "Das Sitzungscookie ist bereits gesetzt — ohne es ist eine angemeldete Nutzung technisch nicht möglich. Wir beenden deshalb jetzt Ihre Sitzung und löschen das Cookie. Sie können sich jederzeit wieder anmelden.",
  "notice.decline.confirm": "Sitzung jetzt beenden",
  "notice.decline.cancel": "Zurück zum Hinweis",
  "notice.decline.loginHint":
    "Ihre Sitzung wurde beendet, weil Sie mit dem Hinweis nicht einverstanden waren. Sie können sich jederzeit wieder anmelden.",

  // AUFTRAG-mega62 Block C: Der Wortlaut behauptet NICHTS, was nicht feststeht. Er sagt nicht
  // „Sie sind noch angemeldet" (das wissen wir nicht) und nicht „es hat geklappt" (das hat es
  // nicht) — er sagt, dass die Beendigung unbestätigt ist, und was das bedeutet.
  //
  // AUFTRAG-mega64 BLOCK C — DIE SICHTBARE ZUSAGE SAGT, WAS DAS PRODUKT TUT.
  //
  // Hier stand bis mega63 unqualifiziert: „Solange das nicht geklärt ist, zeigen wir Ihnen keine
  // Inhalte." Die Datenschutzerklärung nannte gleichzeitig die Tab-Grenze ehrlich (§ 4). Zwei Texte
  // im selben Produkt, die verschieden viel versprachen — und der weitergehende stand dort, wo die
  // Nutzerin ihn liest. ben hat das als Zusagenkante gemeldet (sammel61, Finding 2).
  //
  // Block B hat die Grenze beseitigt, statt den Text zu beschneiden: die Sperre gilt jetzt wirklich
  // in allen Fenstern und Tabs. Der Satz darf deshalb stehen bleiben — und weil er das jetzt
  // wirklich leistet, sagt er es auch AUSDRÜCKLICH. Dazu kommt der zweite Satz, den mega63 noch
  // nicht sagen konnte: dass die Anwendung es von selbst erneut versucht. Das ist keine neue
  // Zusicherung, sondern die Beschreibung des Nachholers in `AuthContext` — ohne ihn wüsste die
  // Nutzerin nicht, dass Warten ein gangbarer Weg ist, und der Knopf wäre der einzige.
  //
  // AUFTRAG-mega65 Block B: Der Nachholer greift seit dieser Scheibe auch beim AUFBAU der Anwendung
  // (bens GELB-1) — und das steht jetzt dabei. Es ist der Anlass, auf den die Nutzerin am ehesten
  // selbst kommt („ich lade die Seite neu"); ihn zu verschweigen hieße, den Knopf als einzigen Weg
  // erscheinen zu lassen. Eine Frist nennt dieser Text weiterhin nicht, denn das Produkt führt
  // keine (s. `app/abmeldeschuld.ts` und § 4 der Datenschutzerklärung).
  "notice.signOutFailed.title": "Ihre Sitzung wurde nicht bestätigt beendet",
  "notice.signOutFailed.body":
    "Sie haben dem Hinweis nicht zugestimmt, und wir wollten Ihre Sitzung beenden — der Server hat das aber nicht bestätigt. Möglicherweise besteht Ihre Sitzung noch. Solange das nicht geklärt ist, zeigen wir Ihnen keine Inhalte, und zwar in allen Fenstern und Tabs dieses Browsers. Die Anwendung versucht die Beendigung von selbst erneut — sobald Ihre Verbindung wieder besteht und bei jedem neuen Aufbau; Sie können es auch sofort erneut versuchen.",
  "notice.signOutFailed.retry": "Beendigung erneut versuchen",
  "notice.signOutFailed.again":
    "Auch dieser Versuch kam nicht durch. Bitte prüfen Sie Ihre Netzverbindung.",

  // ==============================================================================================
  // AUFTRAG-mega61 BLOCK E — DER DAUERHAFT SICHTBARE SATZ AN JEDER KI-FLÄCHE.
  // ==============================================================================================
  //
  // EIN Schlüssel für ALLE Modellflächen, und das ist Absicht: Artikel 50 Absatz 5 der
  // KI-Verordnung verlangt die Information „klar und deutlich unterscheidbar“. Was auf jeder
  // Fläche anders formuliert wäre, wäre weder klar noch unterscheidbar — und ein zweiter Wortlaut
  // wäre eine zweite Wahrheit über dasselbe Produkt.
  "ai.generatedNotice": "Von künstlicher Intelligenz erzeugt — bitte fachlich prüfen.",
  // R-0603 / R-0604: der DAUERHAFTE Satz an Auslösern und KI-Flächen. Er sagt, dass hier eine KI
  // mitarbeiten kann — nicht, dass etwas erzeugt wurde. Das sagt `ai.generatedNotice`, und zwar
  // nur am Ergebnis, das ein Modell wirklich geschrieben hat.
  "ai.surfaceNotice":
    "Hier kann eine KI mitarbeiten — von ihr erzeugte Inhalte sind gekennzeichnet.",
  // R-1020 / R-1695 (Grundsatz G-3): die drei Stufen jedes Ergebnisses. Der Entwurf trägt den
  // Wortlaut der Quelle. `reasoner.draftLabel` bleibt als Bestandstext unverändert stehen.
  // Die Empfehlung sagt „ungeprüft" statt „nicht validiert": JOB 2660 hält fest, dass auf einer
  // Fläche ohne geprüfte Quelle das Wort „validiert" GAR NICHT steht — auch nicht verneint.
  "ergebnisStufe.entwurf": "Reasoner-Entwurf, nicht validiert",
  "ergebnisStufe.empfehlung": "Empfehlung, ungeprüft",
  "ergebnisStufe.validiert": "Validiert",

  // ==============================================================================================
  // AUFTRAG-mega62 BLOCK F — DER KOSTENHINWEIS AN JEDER AUSLÖSESTELLE.
  // ==============================================================================================
  //
  // EIN Schlüssel für ALLE Auslösestellen, aus demselben Grund wie oben: Sechs verschieden
  // formulierte Warnungen über dieselbe Tatsache wären sechs Wahrheiten. Der Wortlaut ist an
  // `ask.examplesSendHint` angelehnt, der diese Zusage seit mega51 an der Fragenfläche trägt —
  // aber allgemein gehalten, weil er auch an Knöpfen steht, die nicht „fragen“.
  //
  // EIN HALBSATZ, KEINE BELEHRUNG: Er sagt, was der Klick auslöst, nicht was man tun soll.
  //
  // AUFTRAG-mega69 B2 (bens sammel65-Auflage 2): „kann … auslösen", nicht „startet". `billable`
  // sagt „die Cloud KANN für diese Aufgabe kostenpflichtig genutzt werden" — nicht „dieser Klick
  // kostet sicher Geld": `unverified` gilt vorsorglich als erreichbar, die Vertraulichkeit der
  // konkreten Eingabe nimmt die Cloud ggf. aus der Kette, und ein Laufzeitfehler mit lokalem
  // Rückfall kostet ebenfalls nichts. Der alte Wortlaut „startet … eine echte, kostenpflichtige"
  // war dafür zu absolut — eine Tatsachenbehauptung ohne Deckung.
  "ai.costHint": "Ein Klick kann eine echte, kostenpflichtige Cloud-KI-Anfrage auslösen.",

  // ==============================================================================================
  // AUFTRAG-mega62 BLOCK E — DIE KENNZEICHNUNG, DIE MIT DER DATEI DAS HAUS VERLÄSST.
  // ==============================================================================================
  //
  // Der Wortlaut steht so in Abschnitt 8 von `_relay/kopf/RECHT-KI-Verordnung-Umsetzung.md`. Er
  // nennt das System, die Aufgabe und das Datum — ohne diese drei Angaben wäre „von KI erzeugt“
  // eine Behauptung ohne Bezug, und in einer weitergereichten Datei ist der Bezug alles, was
  // bleibt. Der Bildschirmhinweis (`ai.generatedNotice`) kann das nicht leisten: er reist nicht mit.
  "ai.exportNotice":
    "Von künstlicher Intelligenz erzeugt (KLARWERK, {{task}}, {{date}}). Inhaltlich zu prüfen.",
  // Die Aufgabe im Klartext. Nur `answer` ist bisher nötig — die anderen beiden
  // kennzeichnungspflichtigen Aufgaben (interview, describe) haben heute keinen eigenen Exportweg.
  "ai.task.answer": "Frage beantwortet",

  // ==============================================================================================
  // AUFTRAG-BASIC-W2-RESULTAT-VIEW-KERN-23 — Importresultat: Original und Wissen getrennt.
  // ==============================================================================================
  //
  // Die Texte tragen die Aussage; die Farbe ist die zweite Spur, nie die einzige. Jeder Laufzustand
  // hat deshalb einen eigenen Namen UND einen eigenen Hinweis, was er für das Gezeigte bedeutet —
  // „teilweise" und „fehlgeschlagen" dürfen nie wie ein Erfolg klingen (`KW-W2-17`).
  "w2.result.heading": "Importergebnis",
  "w2.run.heading": "Lauf",
  // F-0140 / K-20 (JOB 2970 D1): die zwei Texte der Lauf-Fläche auf der Import-Seite.
  "w2.run.start": "Import starten",
  // JOB 3288: Diese Kachel kennt NUR den Gesamtlauf, den dieses Fenster gestartet hat. Der alte
  // Satz („Kein Lauf gestartet.") las sich als Aussage über den Bestand und war es nie.
  "w2.run.idle":
    "In diesem Fenster wurde kein Gesamtlauf gestartet. Der Startknopf legt einen an; sein Zustand steht dann hier. Ein Import über „Auswahl übernehmen“ wird ebenfalls festgehalten, erscheint aber nicht hier, sondern oben in der Zeile „Zuletzt erfolgreich abgeschlossener Import“.",
  // JOB 2970 D2: Fortschritt als Zahl — die Zähler kommen fertig vom Server.
  "w2.run.progress": "{{verarbeitet}} von {{gesamt}} Elementen verarbeitet",
  "w2.run.status.QUEUED": "In der Warteschlange",
  "w2.run.status.FETCHING": "Quelle wird abgerufen",
  "w2.run.status.PERSISTING_SOURCE": "Original wird gesichert",
  "w2.run.status.EXTRACTING": "Aussagen werden entnommen",
  "w2.run.status.CREATING_KNOWLEDGE": "Wissenseinheiten entstehen",
  "w2.run.status.ANALYZING": "Prüfung läuft",
  "w2.run.status.COMPLETED": "Abgeschlossen",
  "w2.run.status.PARTIAL": "Teilweise fehlgeschlagen",
  "w2.run.status.FAILED": "Fehlgeschlagen",
  "w2.run.status.unknown": "Zustand unbekannt",
  "w2.run.hint.QUEUED": "Der Lauf hat noch nicht begonnen. Es liegt noch kein Ergebnis vor.",
  "w2.run.hint.FETCHING": "Der Lauf ist unterwegs. Was hier steht, ist ein Zwischenstand.",
  "w2.run.hint.PERSISTING_SOURCE": "Der Lauf ist unterwegs. Was hier steht, ist ein Zwischenstand.",
  "w2.run.hint.EXTRACTING": "Der Lauf ist unterwegs. Was hier steht, ist ein Zwischenstand.",
  "w2.run.hint.CREATING_KNOWLEDGE":
    "Der Lauf ist unterwegs. Was hier steht, ist ein Zwischenstand.",
  "w2.run.hint.ANALYZING": "Der Lauf ist unterwegs. Was hier steht, ist ein Zwischenstand.",
  "w2.run.hint.COMPLETED": "Der Lauf ist vollständig durchgelaufen.",
  "w2.run.hint.PARTIAL":
    "Ein Teil des Laufs ist fehlgeschlagen. Das Gezeigte ist unvollständig — es ist kein abgeschlossener Import.",
  "w2.run.hint.FAILED":
    "Der Lauf ist fehlgeschlagen. Was unten steht, ist deshalb nicht das beabsichtigte Ergebnis.",
  "w2.run.hint.unknown":
    "Der Server hat einen Zustand gemeldet, den diese Version nicht kennt. Das Gezeigte ist deshalb nicht als abgeschlossen zu lesen.",
  "w2.run.failureCode": "Fehlercode",
  "w2.run.failureReason": "Grund",
  // R-0134 / R-1005: warum der Start gesperrt ist — derselbe Zustand wie im Zugangskasten.
  "w2.run.gesperrt.disabled":
    "Der Confluence-Import ist in dieser Installation ausgeschaltet. Deshalb lässt sich hier kein Lauf starten. Eingeschaltet wird er auf dem Server (siehe Zugang oben).",
  "w2.run.gesperrt.noCredentials":
    "Der Confluence-Import ist eingeschaltet, aber die Zugangsdaten sind nicht vollständig oder nicht brauchbar. Erst wenn sie stehen, lässt sich ein Lauf starten (siehe Zugang oben).",
  // R-0159: der Grund einer abgelehnten Startanfrage — aus Status und Code abgeleitet.
  "w2.run.startFehler.zeitlimit":
    "Confluence hat nicht rechtzeitig geantwortet (Zeitüberschreitung). Bitte später erneut versuchen.",
  "w2.run.startFehler.nichtKonfiguriert":
    "Der Import ist nicht startbereit: Die Zugangsdaten zu Confluence fehlen oder sind nicht brauchbar.",
  "w2.run.startFehler.ausgeschaltet":
    "Der Confluence-Import ist in dieser Installation ausgeschaltet — der Start ist nicht verfügbar.",
  "w2.run.startFehler.keinRecht": "Für den Start eines Imports fehlt die Berechtigung.",
  "w2.run.startFehler.betreiberAus":
    "Der Confluence-Import ist vom Betreiber ausgeschaltet — einschalten lässt er sich oben im Bereich Zugang.",
  "w2.run.gesperrt.switchedOff":
    "Der Confluence-Import ist vom Betreiber ausgeschaltet. Einschalten lässt er sich oben im Bereich Zugang.",
  // R-0159: die verständliche Erklärung neben einem eindeutigen Fehlercode eines Laufs.
  "w2.run.failureText.CONFLUENCE_TIMEOUT":
    "Confluence hat nicht rechtzeitig geantwortet (Zeitüberschreitung). Der Lauf wurde abgebrochen; ein erneuter Start ist möglich.",
  "w2.run.failureText.CONFLUENCE_BUDGET":
    "Das Zeitbudget für das Lesen des Bereichs war erschöpft. Der Bereich wurde nicht vollständig gelesen.",
  "w2.run.failureText.CONFLUENCE_RESPONSE_TOO_LARGE":
    "Eine Antwort von Confluence war zu groß und wurde nicht gelesen.",
  "w2.run.failureText.IMPORT_UNAVAILABLE":
    "Der Import war nicht startbereit: Die Zugangsdaten zu Confluence fehlen oder sind nicht brauchbar.",
  // Das ORIGINAL — der eine Block links. Er ist das Dokument, nicht das Wissen.
  "w2.source.heading": "Original",
  "w2.source.lead": "Das importierte Dokument in genau der Fassung, aus der das Wissen entstand.",
  "w2.source.missing": "Zu diesem Lauf wurde kein Original geliefert.",
  "w2.source.missingRequired": "Zu diesem Original fehlen Pflichtangaben.",
  "w2.source.title": "Titel",
  "w2.source.system": "System",
  "w2.source.version": "Version",
  "w2.source.url": "Adresse",
  "w2.source.importedAt": "Importiert am",
  "w2.source.externalId": "Kennung im Quellsystem",
  // Das WISSEN — der andere Block. Bewusst eigene Überschrift, eigener Rahmen, eigene Sprache.
  "w2.knowledge.heading": "Wissenseinheiten",
  "w2.knowledge.lead": "Aus diesem einen Original entstandene, eigenständige Einheiten.",
  "w2.knowledge.count": "{{count}} Einheiten",
  "w2.knowledge.empty":
    "Aus diesem Lauf ist keine Wissenseinheit entstanden. Das ist kein erfolgreicher Import.",
  "w2.item.position": "Einheit {{position}}",
  "w2.item.statementMissing": "Zu dieser Einheit wurde keine Aussage geliefert.",
  "w2.item.locator": "Fundstelle",
  "w2.item.locatorMissing": "Fundstelle fehlt",
  "w2.item.status": "Validierung",
  "w2.item.statusMissing": "Validierungsstatus fehlt",
  "w2.item.conflicts": "Konflikte: {{count}}",
  "w2.item.conflictsNone": "Keine Konflikte gemeldet",
  "w2.item.gaps": "Wissenslücken: {{count}}",
  "w2.item.gapsNone": "Keine Wissenslücken gemeldet",
  // AUFTRAG-81 (Befund aus Preflight 78): Diese zwei Schlüssel wurden von `importResultView.ts`
  // erzeugt und in `SourceRecordCard.tsx` an `t()` gereicht — standen aber in keinem Wörterbuch.
  // i18next gibt ohne `parseMissingKeyHandler` den Schlüssel selbst aus; eine fehlende Angabe am
  // Original hätte dem Nutzer wörtlich „w2.value.missing" gezeigt.
  // Die Unterscheidung spiegelt `f.required` an der Erzeugungsstelle: fehlt eine PFLICHTangabe,
  // ist das ein Mangel; fehlt eine freiwillige, hat die Quelle schlicht nichts geliefert. Beides
  // als „fehlt" zu benennen wäre eine Behauptung über die Quelle, die niemand belegen kann.
  "w2.value.missing": "Pflichtangabe fehlt",
  "w2.value.none": "Nicht geliefert",
  // JOB 3511 — Demo-Erscheinungsbild (Firmen-CI). Der Erklärsatz nennt die drei Dinge, die Pedi
  // wissen muss, bevor er schaltet: für wen es gilt, wovon es unabhängig ist, was es NICHT tut.
  "einst.marke.titel": "Demo-Erscheinungsbild",
  "einst.marke.erklaerung":
    "Die Wahl gilt für alle Anwender dieser Installation und ist unabhängig von den Demo-Datenpaketen. Umschalten lädt keine Daten, löscht keine Daten und startet keine KI-Verarbeitung.",
  "einst.marke.profil": "Firmenprofil",
  "einst.marke.profilKeines": "Kein Firmenprofil",
  "einst.marke.profilAdvisor": "Advisor",
  "einst.marke.schalter": "Firmen-CI verwenden",
  "einst.marke.ohneProfil": "Ohne Firmenprofil gibt es nichts zu verwenden.",
  "einst.marke.gespeichert": "Erscheinungsbild übernommen.",
  // ==============================================================================================
  // JOB 3742 — DIE SEITENHILFE DER SECHS STILLEN FLÄCHEN.
  // ==============================================================================================
  //
  // Wissensnetz, Profil und die vier Stufe-2-Seiten (Wissenskapital, Wissensgraph, Import, Output)
  // zeigten im Zahnrad unter „Seitenhilfe" die Leermeldung. Jeder Satz hier beantwortet die Frage
  // „WAS KANN ICH HIER TUN und was ist der nächste Schritt?" — nicht „was ist diese Seite?": die
  // zweite Frage gehört ins Hilfekapitel (`lib/helpTopics.ts`), das der Nav-Erklärsatz eine Zeile
  // darüber in dieselbe Liste bringt (`ZahnradMenue.tsx:50`).
  //
  // KEIN SATZ BEHAUPTET EINEN ZUSTAND. Die Seitenhilfe hat keine Daten: sie beschreibt die Seite,
  // nicht ihren Inhalt, und steht deshalb auch da, wenn nichts geladen ist. „Hier siehst du, dass
  // alles geprüft ist" wäre eine Aussage über den Bestand ohne frische Grundlage — verboten.
  // Wo eine Möglichkeit an einer Berechtigung hängt (Confluence-Import) oder an der Datenlage
  // (ein Graphpunkt ohne Objekt im Bestand), sagt der Satz das, statt es zu versprechen.
  "seitenhilfe.wissensnetz.titel": "Ein Thema wählen und seine Objekte ansehen",
  "seitenhilfe.wissensnetz.text":
    "Wähle ein Thema aus: daneben erscheint, welche Wissensobjekte dazugehören, und ein Link öffnet sie alle in der Bibliothek. Ist das Fenster zu schmal für die Zeichnung, steht dieselbe Auskunft in Sätzen. Nächster Schritt: ein Thema anwählen und eines der genannten Objekte öffnen.",
  "seitenhilfe.profil.titel": "Sprache, Passwort und Abmelden",
  "seitenhilfe.profil.text":
    "Hier stehen dein Name, deine E-Mail-Adresse und deine Rolle. Du kannst die Sprache der Oberfläche umstellen, dein Passwort ändern, deine eigenen Beiträge nachsehen und dich abmelden. Nächster Schritt: die Zeile anklicken, die du ändern willst — die Sprache wechselst du direkt in ihrer Zeile.",
  "seitenhilfe.kapital.titel": "Den Bestand in Zahlen lesen",
  "seitenhilfe.kapital.text":
    "Diese Seite fasst zusammen, wie viel Wissen vorhanden ist, wie viel davon geprüft wurde und was noch offen ist — dazu eine Schätzung, welchen Wert das bedeutet. Die Annahmen dieser Schätzung trägst du selbst ein. Nächster Schritt: eine Annahme ändern und ablesen, wie sich die Schätzung mitbewegt.",
  "seitenhilfe.graph.titel": "Vom Punkt zum Wissensobjekt springen",
  "seitenhilfe.graph.text":
    "Jeder Punkt ist ein Wissensobjekt; eine graue Linie heißt, dass zwei dasselbe Schlagwort tragen, eine rote gestrichelte Linie steht für einen gemeldeten Widerspruch. Nächster Schritt: einen Punkt anklicken — gehört er zu einem Objekt aus dem Bestand, führt er dich dorthin.",
  "seitenhilfe.import.titel": "Wissen von außen hereinholen und prüfen",
  "seitenhilfe.import.text":
    "Hier bringst du Wissen aus anderen Systemen herein: eine JSON-Datei auswählen oder auf die Fläche ziehen; mit der nötigen Berechtigung lässt sich auch ein Confluence-Import starten. Jeder Beitrag landet als Vorschlag in der Prüfliste, mit Volltext und Quelle. Nächster Schritt: einen Vorschlag lesen und ihn annehmen, ablehnen oder eine Rückfrage stellen.",
  "seitenhilfe.output.titel": "Ein Dokument aus geprüftem Wissen erzeugen",
  "seitenhilfe.output.text":
    "Wähle die Art des Dokuments, kreuze die Wissensobjekte an, die hineingehören, und bring sie in die Reihenfolge, in der sie stehen sollen. Das erzeugte Dokument kannst du kopieren oder als Markdown-Datei laden; darunter steht, aus welchen Objekten es entstanden ist. Nächster Schritt: eine Art wählen und die erste Quelle ankreuzen.",
  // ================================================================================================
  // JOB 3670 — DIE SEITENHILFE DER VIER VERWALTUNGSFLÄCHEN.
  // ================================================================================================
  //
  // Wer einen Demo-Zugang herrichtet, arbeitet zuerst im Admin. Im Zahnrad stand unter
  // „Seitenhilfe" bis hierher die Leermeldung; die Mechanik (JOB 3060, `components/HelpTip.tsx`)
  // war fertig, sie war auf diesen Flächen nur nie benutzt worden. Je Bildschirm EIN Eintrag, der
  // drei Fragen beantwortet: Was stelle ich hier ein? Was bewirkt es? Was ist der nächste Schritt?
  //
  // JEDE ZUSAGE IST NACHGESEHEN, nicht erinnert — an drei Fallen, an denen JOB 3669 und JOB 3741
  // am selben Vormittag gescheitert sind:
  //   ROLLE   `/admin` trägt `minRole: "admin"` (`app/navigation.ts:283-288`); jede andere Rolle
  //           bekommt `RoleNotice` statt der Seite (`routes.tsx:184-187`). Diese zwölf Texte
  //           sprechen also ausschliesslich zu Administratoren — das ist die einzige Rolle, die
  //           sie je zu Gesicht bekommt.
  //   BREITE  Die Themenspalte VERSCHWINDET schmal nicht, sie wandert nach oben
  //           (`components/einstellungen/Seite.tsx:41-44`: `flex-row flex-wrap` bis `sm`, darüber
  //           `sm:w-[200px] sm:flex-col`). Deshalb steht in der Übersichtshilfe „über dem Inhalt
  //           statt links daneben" und nicht „links".
  //   URSACHE Ein fehlender Bereich liegt hier NICHT an der Rolle: `canSee`
  //           (`app/navigation.ts:492-497`) blendet auch bei ausreichender Rolle aus, wenn Stufe 2
  //           aus ist. Genau das sagen die Übersichts- und die Rollenhilfe.
  "seitenhilfe.admin.uebersicht.titel": "Verwaltung — was hier eingestellt wird",
  "seitenhilfe.admin.uebersicht.text":
    "Sieben Themen: Benutzer und Rollen, KI, Quellen und Daten, Vorführdaten, Sicherheit und Nachweise, Berichte und Analyse, System. Jede Zeile nennt rechts ihren heutigen Wert; ein Klick öffnet die Karte dazu, und Thema und Karte stehen danach in der Adresse — ein Lesezeichen oder ein Neuladen kommt genau hierher zurück. Auf schmalen Fenstern steht die Themenleiste über dem Inhalt statt links daneben. Steht bei einem Bereich „Modul aus“, liegt das nicht an deiner Rolle, sondern am Schalter „Erweiterte Module“ unter System. Für einen Demo-Zugang fängst du bei Benutzer und Rollen an und lädst danach unter Vorführdaten die Demodaten.",
  "seitenhilfe.admin.nutzer.titel": "Ein Konto verwalten",
  "seitenhilfe.admin.nutzer.text":
    "Hier gehört dieses eine Konto dir: Wartet es noch auf Freigabe, steht der Freigabe-Knopf da; ist es freigegeben, stattdessen die Rollenauswahl. Dazu ein neues Passwort und das Löschen. Ein neues Passwort beendet alle offenen Sitzungen dieses Menschen — er muss sich danach neu anmelden. Den letzten freigegebenen Administrator schützt der Server: Herabstufen und Löschen weist er ab, damit sich niemand selbst aussperrt. Was eine Rolle überhaupt darf, steht in der Übersicht unter „Benutzer und Rollen“ in ihrer eigenen Karte.",
  "seitenhilfe.admin.nutzerNeu.titel": "Ein Konto anlegen",
  "seitenhilfe.admin.nutzerNeu.text":
    "Name, E-Mail, Passwort mit mindestens acht Zeichen samt Wiederholung gegen Vertipper, und die Rolle. Ein hier angelegtes Konto ist sofort freigegeben und kann sich anmelden — anders als eines, das sich selbst registriert hat und auf deine Freigabe wartet. Fehlt etwas, nennt ein Klick auf „Anlegen“ die fehlenden Felder beim Namen; der Knopf ist nie stumm ausgegraut. Danach steht das Konto in der Liste unter „Benutzer und Rollen“.",
  "seitenhilfe.admin.ansichtRolle.titel": "Ansicht als Rolle",
  "seitenhilfe.admin.ansichtRolle.text":
    "Du siehst die Oberfläche so, wie eine andere Rolle sie sieht; deine echten Rechte am Server bleiben unverändert Administrator. Die Folge, mit der niemand rechnet: Die Verwaltung ist nur für Administratoren sichtbar. Wählst du hier eine andere Rolle, verschwindet sie im selben Augenblick, und diese Karte schliesst sich mit. Zurück kommst du deshalb nicht über diese Karte, sondern über „Zur Admin-Ansicht“ im Zahnradmenü.",
  "seitenhilfe.admin.rolle.titel": "Was diese Rolle darf",
  "seitenhilfe.admin.rolle.text":
    "Eine Auskunft, kein Schalter: oben die Freiheiten dieser Rolle in Worten, darunter je Gruppe die Bereiche, die ihre Rolle freigibt. Ein „·2“ markiert einen Bereich, der zusätzlich den Schalter „Erweiterte Module“ unter System braucht — ohne ihn bleibt er auch dann unsichtbar, wenn die Rolle reicht. Die Rolle eines Menschen änderst du nicht hier, sondern in seinem Konto unter „Benutzer und Rollen“.",
  "seitenhilfe.admin.demo.titel": "Vorführdaten laden und entfernen",
  "seitenhilfe.admin.demo.text":
    "Zwei Knöpfe, zwei verschiedene Bestände: „Demodaten laden“ legt den allgemeinen Demo-Bestand an, der Paketknopf darunter lädt genau das benannte Demopaket. Legt der allgemeine Lauf neue Konten an, stehen deren Einmalkennwörter genau einmal hier — ein Neuladen verliert sie, der Server nennt sie kein zweites Mal. „Alle Demodaten entfernen“ räumt beides zugleich weg, auch die Bausteine des Pakets. Das Demo-Erscheinungsbild ganz unten wechselt nur Logo und Farben, für alle Anwender dieser Installation; es lädt und löscht keine Daten.",
  "seitenhilfe.admin.werk.titel": "Werkseinstellungen",
  "seitenhilfe.admin.werk.text":
    "Der Werksreset löscht alle Daten und beendet danach den Server; die Anwendung muss von Hand neu gestartet werden. Deshalb zwei Stufen: erst dein eigenes Passwort, dann die ausdrückliche Warnung. Es gibt ihn nicht in jeder Installation — steht hier „In dieser Installation nicht verfügbar“, ist der Weg auf diesem Server nicht eingebaut, und daran ändert kein Schalter etwas. Nur die Vorführdaten wirst du stattdessen unter Vorführdaten los.",
  "seitenhilfe.admin.papierkorb.titel": "Papierkorb",
  "seitenhilfe.admin.papierkorb.text":
    "Gelöschte Wissensobjekte liegen hier zwischen. Je Eintrag stehen der Mensch, der gelöscht hat, das Datum und die Zahl der verbleibenden Tage. „Wiederherstellen“ holt das Objekt zurück in die Bibliothek; „Endgültig löschen“ fragt einmal nach und ist danach nicht mehr rückgängig zu machen. Tust du nichts, entfernt der Server den Eintrag nach Ablauf der Frist von selbst — beim nächsten Aufräumlauf, nicht auf die Minute genau.",
  "seitenhilfe.admin.audit.titel": "Benutzeränderungen",
  "seitenhilfe.admin.audit.text":
    "Eine reine Auskunft ohne Bedienelemente: die jüngsten Einträge zu Konten und Anmeldung, je Zeile Zeitpunkt, Aktion und die Kennung des Ausführenden. Hier lässt sich nichts ändern und nichts löschen — die Liste ist das Ergebnis dessen, was anderswo getan wurde. Die vollständige, hash-verkettete Kette samt Prüfknopf steht unter „Sicherheit und Nachweise“ im Prüfprotokoll.",
  "seitenhilfe.admin.protokoll.titel": "Prüfprotokoll",
  "seitenhilfe.admin.protokoll.text":
    "Das hash-verkettete Protokoll dieser Anlage, hier mit den jüngsten Einträgen im Klartext: Ereignis, ausgeführt von, betroffen. „Kette prüfen“ rechnet die Verkettung wirklich nach und meldet eines von drei Ergebnissen — bestätigt, lückenlos aber nicht nachrechenbar, oder nicht bestätigt; „Drucken“ gibt genau diesen Auszug aus. Steht statt eines Namens nur eine Kennung, sagt die Zeile daneben warum — und die Gründe bedeuten Verschiedenes: „Konto nicht mehr vorhanden“ ist eine Aussage über das Konto, sie fällt erst nach einem vollständig geladenen Verzeichnis, in dem die Kennung fehlt. „Name wird geladen“ und „Name nicht abrufbar“ sagen dagegen nichts über das Konto, sondern nur über den Abruf. Bei einem betroffenen Objekt steht die Kennung ganz ohne Zusatz: dort wird im Kontoverzeichnis gar nicht nachgeschlagen.",
  "seitenhilfe.admin.datenschutz.titel": "Datenschutz und Sicherheit",
  "seitenhilfe.admin.datenschutz.text":
    "Eine Liste der Eigenschaften, die diese Anlage wirklich hat — kein Versprechen und kein Schalter; einstellen lässt sich hier nichts. Der Kasten am Fuss trennt ausdrücklich gemessene Werte von Ziel- und Beispielwerten, damit im Gespräch niemand das eine für das andere hält. „Drucken“ gibt die Liste als Auszug aus, etwa für eine Rückfrage aus der Rechtsabteilung.",
  "seitenhilfe.admin.bereitschaft.titel": "Bereitschaft",
  "seitenhilfe.admin.bereitschaft.text":
    "Die Checkliste vor einer Vorführung: KI, validierte Objekte, offene Prüfungen, Uploadgrenzen, externe Recherche und Demodaten — je Zeile eine Ampel aus echten Zahlen. Sie stellt nichts ein, sie liest sechs Quellen und sagt, was fehlt. Fällt eine davon aus, steht statt einer geratenen Null „nicht abrufbar“ mit einem Knopf, der alle sechs neu abruft. Die Zeile „Demodaten“ führt direkt auf die Karte, auf der du sie lädst.",
  // JOB 4025 — die Seitenhilfe der Sicherungskarte.
  "seitenhilfe.admin.sicherung.titel": "Sicherung",
  "seitenhilfe.admin.sicherung.text":
    "Die Auskunft über das Sicherungsverzeichnis dieser Anlage: welche Dumps dort liegen, wann sie entstanden, wie groß sie sind und ob die Prüfsummendatei danebenliegt, die das Backup-Skript mitschreibt. Nur eine Auskunft — hier wird keine Sicherung gestartet, gelöscht oder heruntergeladen. Fehlt das Verzeichnis oder ist es nicht lesbar, steht „nicht feststellbar“ mit dem Grund; das ist ausdrücklich etwas anderes als „keine Sicherung“. Und auch eine volle Liste sagt nichts darüber, ob sich daraus wiederherstellen lässt: das prüft allein der Restore-Drill.",
  // ==============================================================================================
  // JOB 3786 — DIE SEITENHILFE DER HANDYFLÄCHE (/mobile).
  // ==============================================================================================
  //
  // EIN Eintrag, der die drei Fragen beantwortet: Was ist diese Fläche? Was kann ich hier tun? Was
  // geht hier NICHT und wo geht es? Auf dem Telefon ist die dritte die wichtigste — deshalb steht
  // sie ausgeschrieben da und wird nicht verschwiegen.
  //
  // JEDE ZUSAGE IST AM STAND d449e9b NACHGESEHEN, nicht erinnert — an den drei Fallen, an denen
  // JOB 3669 und JOB 3741 am 12.09. gescheitert sind:
  //   ROLLE   `/mobile` ist NICHT rollengesichert (`routes.tsx:218` steht ausserhalb
  //           `GUARDED_ITEMS`) — jede Rolle kommt hier an, auch der Betrachter. Und die drei
  //           Reiter können NICHT dasselbe: alle Entwurfsrouten verlangen `ko.create`
  //           (`services/app/src/routes/capture-routes.ts:839`, `:1139`, `:1281`), Fragen und
  //           Suchen nur `ko.read` (`ask-routes.ts:307`, `library-routes.ts:541`). Ein Betrachter
  //           hat nach `services/rbac/src/policy.ts:14` ausschliesslich `ko.read`. Deshalb nennt
  //           der Satz die Berechtigung AUSDRÜCKLICH und sagt, was der Betrachter hier kann —
  //           statt „erfassen" pauschal zu versprechen (Korrekturpflicht aus JOB 3669 R1).
  //   ANORDNUNG Beschrieben ist nur, was diese Fläche wirklich trägt: drei Reiter nebeneinander
  //           (`Mobile.tsx:329-347`) in einem Telefonrahmen von 340 px (`:312`) und der Ausgang
  //           „Zur Vollversion" ÜBER dem Rahmen (`:304-311`, `self-start`). Kein Wort über eine
  //           Seitenleiste oder ein Kopfband — beides gibt es auf dieser Route nicht
  //           (`shell/AppShell.tsx:65-79` kehrt vor dem Kopfband zurück).
  //   URSACHE Offline ist NICHT alles vorgemerkt: die Warteschlange nimmt ausschliesslich das
  //           Speichern von Entwürfen (`Mobile.tsx:164-179`), Fragen und Suchen melden ehrlich
  //           eine fehlende Verbindung (`:520-527`, `:681-688`). Genau so steht es hier.
  //
  // Der Satz über die festen Blöcke ist die zweite ehrlich benannte Grenze: ein fortgesetzter
  // Entwurf mit Rumpf zeigt seinen Fliesstext, Bilder und Tabellen aber nur als nummerierte
  // Platzhalter an ihrer Stelle (`Mobile.tsx:361-365`, `draftBodyFromText`).
  "seitenhilfe.mobil.titel": "Unterwegs erfassen, fragen und nachschlagen",
  "seitenhilfe.mobil.text":
    "Diese Fläche zeigt KLARWERK in Telefonbreite und hat drei Reiter: „Erfassen“ legt aus einem Titel und einem Text einen Entwurf an — dafür braucht man die Berechtigung zum Anlegen, ein Betrachter kann hier nur lesen; „Fragen“ und „Suchen“ stehen jeder Rolle offen und führen von einer Antwort oder einem Treffer in das Wissensobjekt. Ohne Verbindung wird allein das Speichern eines Entwurfs vorgemerkt und später nachgetragen; Fragen und Suchen sagen dann, dass sie eine Verbindung brauchen. Prüfen, Freigeben, Widersprüche klären und Textgestaltung mit Bildern und Tabellen gibt es hier NICHT — ein fortgesetzter Entwurf zeigt seine festen Blöcke nur als nummerierte Platzhalter. Nächster Schritt: einen Reiter antippen; für alles Übrige führt oben „Zur Vollversion“ zurück an das grosse Fenster.",
  // ============================================================================================
  // JOB 3863 — DIE SEITENHILFE DER KI-FREIGABE (Karte `detail-ki`, zwei Einträge).
  // ============================================================================================
  //
  // Seit JOB 3783 (LIVE 1.0.0-beta.1.360) trägt die KI-Karte die zentrale Freigabe mit zwei
  // Schaltern; im Zahnrad stand dazu nichts, weil JOB 3670 genau diese Datei ausgelassen hat.
  // Der Weg ist derselbe wie dort: `HelpTip` meldet Titel und Text bei der Seitenhilfe an. Das
  // „?"-Menü der Karte (`hilfe`-Prop der `Detailkarte`) bleibt unangetastet — zwei Orte mit zwei
  // Umfängen, keine zweite Mechanik (die Begründung steht in `AdminKontenDetails.tsx:279-284`).
  //
  // JEDE ZUSAGE IST NACHGESEHEN, nicht erinnert:
  //   SCHALTER    „nur `true` zählt, ‚fehlt' sperrt wie ‚nein'" — `oeffentlicheKiErlaubt`
  //               (`services/reasoner/src/service.ts:658-664`), wortgleich in der Karte
  //               (`AdminKiDetails.tsx:400-408`). Der zweite Schalter erweitert den ersten und
  //               ersetzt ihn nie (`service.ts:663`).
  //   WIRKUNGSLOS Ohne Grundfreigabe schreibt die Karte es unter den zweiten Schalter
  //               (`AdminKiDetails.tsx:956-963`, `ki-freigabe-wirkungslos`).
  //   RÜCKFRAGE   Einschalten fragt (`:940-945` mit dem Kasten `:964-992`), Zurücknehmen nicht
  //               (`:946-949`) — die Rücknahme führt in die sichere Richtung.
  //   ROLLE       Geschrieben wird mit `users.manage` (`reasoner-routes.ts:753`), und das hat nur
  //               `admin` (`services/rbac/src/policy.ts:17`). `/admin` sieht ohnehin nur er
  //               (`app/navigation.ts:282-289`, `minRole: "admin"`).
  //   PROTOKOLL   Die Hilfe sagt hier DREI Dinge, und jedes hat seinen eigenen gemessenen Fall in
  //               `tests/seitenhilfe-ki-freigabe/…`, Gruppe P — am ECHTEN Adminweg, mit dem Rumpf,
  //               den die echte Karte selbst geschrieben hat:
  //                 (1) Eine ERWEITERUNG wird nur erteilt, wenn sie sich protokollieren lässt —
  //                     sonst 503 und NICHTS erteilt (Route `reasoner-routes.ts:766-791`; P1).
  //                 (2) Eine RÜCKNAHME braucht keinen Beleg im Voraus: die Fail-closed-Prüfung
  //                     oben läuft NUR `if (erweiterung)` (`:767`), der Rücknahmezweig hat keinen
  //                     503-Ausgang (`:845-861`) — gemessen in P2.
  //                 (3) Scheitert die Protokollierung NACH einer erfolgreichen Rücknahme, bleibt
  //                     die Rücknahme TROTZDEM wirksam — ihr `audit?.record` hängt in einem
  //                     `.catch()`, das nur noch ins Log schreibt (`:849-861`), und die Antwort
  //                     danach ist 200 (`:863`); P2 zählt die Protokolleinträge vorher/nachher.
  //                 (4) Lässt sich die Rücknahme GAR NICHT SPEICHERN, wird sie abgewiesen und der
  //                     bisherige Stand gilt weiter: `setTaskConfig` schreibt ZUERST ins Repo und
  //                     setzt die Laufzeit erst nach Erfolg (`service.ts:1032-1033`, WRITE-THEN-
  //                     RUNTIME); die Route fängt den Wurf (`:803`) und antwortet 409 bei
  //                     ENV-Sperre (`:821-822`) bzw. sonst 400 (`:825-829`) — gemessen in P4.
  //               DREI VORGÄNGER-IRRTÜMER STEHEN HIER ALS MAHNUNG, alle drei derselbe Fehler: eine
  //               Zusage, die WEITER reicht als die Stelle, die sie tragen soll.
  //                 Runde 1: „jede Änderung geht ins Prüfprotokoll — eine Freigabe, die sich nicht
  //                 protokollieren lässt, wird abgelehnt" — gilt nur für die Erweiterung (BEN_ROT
  //                 R1, Pflicht 2).
  //                 Runde 3: „eine Rücknahme wird ebenso protokolliert" — schwächer, aber immer
  //                 noch eine Garantie, die der `.catch()` nicht hergibt (BEN_ROT R3, Pflicht 1:
  //                 „Rücknahme HTTP 200; Freigabe entfernt; Audit vorher=1 nachher=1").
  //                 Runde 4: „eine Rücknahme wird NIE abgewiesen und gilt sofort" — belegt war nur
  //                 der AUDIT-Ausfall (P2/P3); den Fehler der PERSISTENZ SELBST deckte kein Fall,
  //                 und dort ist „nie" falsch (BEN_ROT R4, Pflicht 1+3, mit `:795-829` als
  //                 Gegenbeispiel). Seither trennt der Text die beiden Fälle, und P4 misst den
  //                 zweiten. „Nie abgewiesen" ist in allen drei Sprachen verboten (F4b).
  //   STANDZEILE  Sie liest den bestätigten Stand, nicht das Kästchen (`AdminKiDetails.tsx:993-1003`).
  //   OHNE        Web — KORREKTUR AUS RUNDE 1 (BEN_ROT, Pflicht 1): dort stand „die Knöpfe bleiben
  //               bedienbar". Falsch, wenn NUR die öffentliche KI eingerichtet ist. Ohne Freigabe
  //               fällt die Cloud aus der Kette (`service.ts:680-686`); bleibt danach kein
  //               Modell-Glied übrig, meldet `taskModelUsable` false (`service.ts:1464-1470`),
  //               `publicStatus().tasks[task]` trägt dieses false, `deriveAiAvailable` gibt false
  //               (`lib/aiAvailability.ts:44-47`) und der Knopf ist AUSGEGRAUT mit
  //               `ai.unavailable.hint` (`components/AiAssistBox.tsx:63-64,121`). Ist dagegen ein
  //               interner Secondary verbunden, bleibt er in der Kette (`service.ts:694-700`) und
  //               die Knöpfe bleiben bedienbar. Beide Fälle stehen so im Text und werden in
  //               `tests/seitenhilfe-ki-freigabe/…` (Gruppe V) am echten `publicStatus()` einer
  //               echten `Reasoner`-Verdrahtung und an der montierten Fläche gemessen.
  //               Klara im Word-Fenster: `zentralFreigegeben` false ⇒ `blockedReason:
  //               "policy_incomplete"`, `executionAllowed: false`
  //               (`services/reasoner/src/klara-policy.ts:453-468`) — der eine Grund, den keine
  //               Zustimmung wegklickt; das Aufgabenfenster nennt ihn
  //               (`apps/web/public/word-addin/taskpane.html:2817`).
  //   ENV         `policySource === "env"` sperrt JEDEN Schreibweg (`service.ts:1026`, Route 409)
  //               und die ENV-Zuordnung trägt selbst keine Freigabe (`service.ts:1057`) — deshalb
  //               ist die öffentliche KI dann gesperrt UND hier nicht freizugeben. Ohne die
  //               Variable gilt wieder die persistierte Wahl (`service.ts:1068-1069`).
  "seitenhilfe.admin.kiFreigabe.titel": "Die zwei Schalter der KI-Freigabe",
  "seitenhilfe.admin.kiFreigabe.text":
    "Zwei Schalter, und der zweite hängt am ersten. „Öffentliche KI erlauben“ ist die Grundfreigabe: erst sie lässt überhaupt Text an einen externen Anbieter gehen, und es zählt nur ein ausdrückliches Ja — „nicht gesetzt“ sperrt genauso wie Nein. „Auch vertrauliche Inhalte an die öffentliche KI“ erweitert sie um Texte, die als vertraulich eingestuft sind; ohne die Grundfreigabe bleibt dieser zweite Schalter wirkungslos, und die Karte schreibt das dann auch unter ihn. Vor dem Einschalten fragt die Fläche einmal ausdrücklich nach, weil damit vertrauliche Texte an den externen Anbieter gehen; das Zurücknehmen führt in die sichere Richtung und fragt nicht. Schalten darf nur ein Administrator. Eine Erweiterung wird nur erteilt, wenn sie sich auch protokollieren lässt — sonst weist der Server sie ab, statt sie still zu erteilen. Eine Rücknahme braucht keinen Beleg im Voraus: scheitert nach einer erfolgreichen Rücknahme deren Protokollierung, bleibt die Rücknahme trotzdem wirksam. Lässt sich die Rücknahme dagegen gar nicht speichern, meldet der Server den Fehler, und der bisher gespeicherte Stand gilt weiter. Was gilt, steht in der Zeile unter den Schaltern: sie zeigt den vom Server bestätigten Stand, nicht das eben angeklickte Kästchen.",
  "seitenhilfe.admin.kiOhneFreigabe.titel": "Solange nichts freigegeben ist",
  "seitenhilfe.admin.kiOhneFreigabe.text":
    "Auf der Web-Fläche hängt es daran, ob ein eigenes internes Modell verbunden ist. Ist eines verbunden, rechnet es weiter, und die KI-Knöpfe bleiben bedienbar. Ist nur die öffentliche KI eingerichtet, fällt sie ohne Freigabe aus der Kette, und für die Aufgabe bleibt kein Modell übrig: die KI-Knöpfe sind dann ausgegraut und tragen den Satz „KI nicht verfügbar — für diese Aufgabe ist kein Modell aktiv.“ Kein stiller Ersatzlauf täuscht ein Modell vor. Klara im Word-Fenster geht den externen Weg gar nicht erst: sie meldet die Sperre als unvollständig hinterlegte Regel, und keine Zustimmung des Nutzers hebt sie auf — eine Entscheidung des Administrators kann niemand wegklicken. Ist die KI-Zuordnung per Deploy-Konfiguration (KLARWERK_REASONER_POLICY) festgelegt, sind auch diese beiden Schalter ohne Wirkung: sie sind gesperrt, ein Speichern würde der Server abweisen, und weil die Deploy-Zuordnung selbst keine Freigabe trägt, bleibt die öffentliche KI so lange gesperrt. Der nächste Schritt führt dann nicht über diese Karte, sondern über die Deploy-Konfiguration des Servers; ohne die Variable gilt wieder die hier gespeicherte Wahl.",
  // ================================================================================================
  // JOB 4154 · WIKI-GESAMTANWEISUNG — die Sätze der zusammengesetzten Anweisung.
  // ================================================================================================
  //
  // ZWEI SÄTZE SIND VERTRAG UND KEIN TEXTVORSCHLAG, sie stehen wörtlich so im Auftrag:
  //   "ga.leer"    — „Diese Anweisung hat noch keine Bausteine."   (nie „vollständig"/„unverändert")
  //   "ga.unvollstaendig" — „Teile dieser Anweisung sind für Sie nicht zugänglich."
  //
  // UND EINE VOKABELREGEL: „unverändert" heisst unverändert. Es gibt hier bewusst keinen Satz mit
  // „richtig", „geprüft", „bestätigt" oder „freigegeben" über die Gesamtfassung — ein gleicher
  // Nachweis belegt Unverändertheit, nicht Richtigkeit (Startvertrag).
  "ga.titel": "Arbeitsanleitung",
  "ga.laedt": "Lädt …",
  "ga.leer":
    "Diese Arbeitsanleitung hat noch keine Abschnitte. Füge oben den ersten aus vorhandenem Wissen hinzu.",
  "ga.fehler":
    "Die Arbeitsanleitung konnte nicht geladen werden. Lade die Seite neu oder versuche es später erneut.",
  // JOB 4156 R3: der Satz zur abgelehnten Anlage, wenn diese Instanz nichts dauerhaft ablegen kann.
  // Er sagt, was ist, und verspricht nichts: kein „später erneut versuchen" (der nächste Versuch
  // scheitert gleich), keine internen Begriffe (Journal, In-Memory, Repo).
  "ga.ablageFluechtig":
    "Diese Installation kann Arbeitsanleitungen nicht dauerhaft speichern. Es wurde nichts angelegt – bitte wende dich an deine Systembetreuung.",
  "ga.offline": "Keine Verbindung. Deine Eingaben bleiben erhalten; gespeichert ist nichts.",
  "ga.standVon": "Stand von {{zeit}}",
  "ga.auffrischungLaeuft": "Stand von {{zeit}} · wird aufgefrischt",
  "ga.auffrischungGescheitert": "Stand von {{zeit}} · Auffrischung fehlgeschlagen",
  "ga.gesperrt":
    "Vorlegen und Entscheiden sind gesperrt: der angezeigte Stand ist nicht gesichert.",
  "ga.unvollstaendig": "Teile dieser Arbeitsanleitung sind für dich nicht zugänglich.",
  "ga.verborgene": "Nicht zugängliche Abschnitte: {{anzahl}}",
  "ga.pruefanbindung":
    "Prüfanbindung: noch nicht angebunden – eine automatische fachliche Prüfung dieser Anleitung findet nicht statt.",
  "ga.stand.entwurf": "Entwurf",
  "ga.stand.vorgelegt": "Vorgelegt",
  "ga.stand.entschieden": "Freigegeben",
  "ga.stand.abgelehnt": "Abgelehnt",
  "ga.bausteine": "Abschnitte",
  "ga.baustein.fassung": "Gebundene Fassung {{version}}",
  "ga.baustein.herkunft": "{{titel}} · {{autor}}",
  "ga.baustein.herkunftUnbekannt": "Die gebundene Fassung ist nicht auffindbar.",
  "ga.baustein.fassungAmUnbekannt": "Fassungsdatum unbekannt",
  "ga.baustein.aktualisierung":
    "Es gibt eine neuere Fassung ({{version}}). Die gebundene Fassung bleibt bestehen.",
  "ga.baustein.nachweisFehlt": "Zu dieser Fassung liegt kein Nachweis vor.",
  "ga.baustein.tabellen": "Tabellenüberschriften: {{werte}}",
  "ga.baustein.abbildungen": "Abbildungen: {{werte}}",
  "ga.baustein.unbekannt": "nicht bestimmbar",
  "ga.baustein.keine": "keine",
  // JOB 4233 · der Text der gebundenen Fassung. „nicht belegt" ist ausdrücklich NICHT „leer":
  // entweder gibt es die Fassung nicht mehr, oder sie trägt keinen Rumpf — beides ist Unwissen.
  "ga.baustein.textUnbelegt": "Der Inhalt dieser Fassung ist nicht belegt.",
  "ga.baustein.gliederung": "Gliederung dieser Fassung",
  "ga.aufnahme.titel": "Abschnitt aus vorhandenem Wissen hinzufügen",
  "ga.aufnahme.koId": "Eintrag",
  "ga.aufnahme.koVersion": "Fassung",
  "ga.aufnahme.nachweis": "Nachweis (optional)",
  "ga.aufnahme.knopf": "Aufnehmen",
  // JOB 4233 · die Absage an eine Fassung, die es nicht gibt. Sie sagt, was zu tun ist, und nennt
  // NICHTS über fremde Einträge — die Liste der vorhandenen Fassungen steht in der Serverantwort
  // für den, der den Eintrag ohnehin sehen darf, nicht in diesem Satz.
  "ga.aufnahme.fassungUnbekannt":
    "Diese Fassung gibt es nicht (mehr). Wähle eine der angezeigten Fassungen.",
  "ga.ordnen.hoch": "Nach oben",
  "ga.ordnen.runter": "Nach unten",
  "ga.voraussetzung.label": "Voraussetzung",
  "ga.voraussetzung.knopf": "Voraussetzung übernehmen",
  "ga.vergleich.titel": "Was hat sich geändert?",
  "ga.vergleich.von": "Älterer Stand",
  "ga.vergleich.bis": "Neuerer Stand",
  "ga.vergleich.knopf": "Vergleichen",
  "ga.vergleich.unveraendert": "Unverändert. Das ist keine Aussage über Richtigkeit.",
  "ga.vergleich.geaendert": "Geändert.",
  "ga.vergleich.unbekannt": "Auswirkung nicht bestimmbar — fachlich zu klären.",
  "ga.vergleich.unbekannte": "Nicht bestimmbare Befunde: {{anzahl}}",
  "ga.vergleich.keineAussage": "Kein Vergleich möglich — es wird keine Gleichheit behauptet.",
  // Die Beschriftung der acht Vergleichsfelder. Sie stehen hier, weil in einem Nutzertext kein
  // Maschinenschlüssel auftauchen darf (Nutzerbefunde N-0053, N-0057 zu technischen Begriffen in
  // Herkunfts- und Änderungsangaben). Der Schlüssel `tabellenueberschriften` bleibt der Draht.
  "ga.feld.kopf": "Titel und Zweck",
  "ga.feld.geltung": "Geltung",
  "ga.feld.voraussetzungen": "Voraussetzungen",
  "ga.feld.bausteinbestand": "Bausteinbestand",
  "ga.feld.reihenfolge": "Reihenfolge",
  "ga.feld.fassung": "Gebundene Fassung",
  "ga.feld.tabellenueberschriften": "Tabellenüberschriften",
  "ga.feld.abbildungen": "Abbildungen",
  "ga.entscheidung.titel": "Zur Entscheidung vorlegen",
  "ga.entscheidung.vorlegen": "Vorlegen",
  "ga.entscheidung.annehmen": "Annehmen",
  "ga.entscheidung.ablehnen": "Ablehnen",
  "ga.entscheidung.konflikt":
    "Die Arbeitsanleitung wurde zwischenzeitlich geändert. Bitte lade die Seite neu und versuche es erneut.",
  "ga.kopf.titel": "Titel",
  "ga.kopf.zweck": "Zweck",
  "ga.kopf.geltungsbereich": "Geltungsbereich",
  "ga.kopf.voraussetzungen": "Voraussetzungen",
  // JOB 4156 — DER EINSTIEG. Die Einleitung sagte bis JOB 4357 ausdrücklich NICHT „es ist noch keine
  // Gesamtanweisung angelegt": es gab keinen Endpunkt, der die vorhandenen aufzählt, also hatte diese
  // Fläche keine Grundlage für eine Aussage über den Bestand.
  //
  // JOB 4357 · DIE GRUNDLAGE GIBT ES JETZT (`GET /api/gesamtanweisungen`), und die Einleitung ist
  // NACHGEFÜHRT statt danebengelassen: ihr letzter Satz nannte die Adresse als EINZIGEN Weg zu einer
  // vorhandenen Anweisung, und das ist seit dieser Lieferung falsch. Ein Satz, der einen abgelösten
  // Weg als den einzigen ausgibt, schickt den Menschen an die Stelle, an der er vorher nichts fand.
  // Der Leersatz selbst steht weiterhin NICHT hier, sondern unter `ga.liste.leer` — und er erscheint
  // nur auf einer erfolgreichen, leeren Antwort (`GesamtanweisungBereich.tsx`).
  "ga.bereich.titel": "Arbeitsanleitungen",
  "ga.bereich.einleitung":
    "Stelle vorhandenes Wissen zu einer lesbaren Schritt-für-Schritt-Anleitung zusammen – zum Beispiel für die Einarbeitung neuer Mitarbeitender.",
  "ga.bereich.anlegen": "Neue Arbeitsanleitung erstellen",
  // JOB 4357 — DIE BESTANDSLISTE. Der Leersatz sagt „nichts gespeichert" und NICHT „konnte nicht
  // nachsehen"; der Fehlersatz sagt das Gegenteil und keines von beiden das andere. Beide Sätze
  // dürfen nie zusammenfallen (`GesamtanweisungBereich.tsx`, Abschnitt zu den vier Lagen).
  "ga.liste.titel": "Vorhandene Arbeitsanleitungen",
  "ga.liste.laedt": "Die vorhandenen Arbeitsanleitungen werden geladen …",
  "ga.liste.fehler":
    "Die vorhandenen Arbeitsanleitungen konnten nicht geladen werden. Lade die Seite neu oder versuche es später erneut – eine neue Anleitung kannst du trotzdem erstellen.",
  "ga.liste.leer":
    "Es gibt noch keine Arbeitsanleitung. Erstelle unten deine erste – sie erscheint danach hier.",
  "ga.liste.stand": "Status",
  "ga.liste.urheber": "Erstellt von",
  "ga.liste.geaendert": "Zuletzt geändert",
  "ga.liste.bausteine": "Abschnitte: {{anzahl}}",
  // DIE ZAHL GEHÖRT IN DEN SATZ: „unvollständig" allein lässt offen, ob ein Satz oder ein halbes
  // Dokument fehlt. Titel und Kennung des geschützten Eintrags stehen ausdrücklich nicht dabei.
  "ga.liste.unvollstaendig": "Unvollständig für dich – nicht zugängliche Abschnitte: {{anzahl}}",
};

export { de };
