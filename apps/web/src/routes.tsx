import { type ComponentType, Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useRole } from "./app/RoleContext";
import { GUARDED_ITEMS, HOME_ROUTE, type NavItem, roleAllows } from "./app/navigation";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Splash } from "./components/Splash";
// WP-UX-WOW-1 U9: erklärende Karte statt stiller Stufe-2-Umleitung.
// AUFTRAG-mega70 BLOCK A: dieselbe Behandlung für den Rollenfall (RoleNotice, gleicher Rahmen).
import { RoleNotice, Stage2Notice } from "./components/Stage2Notice";
import { CAPTURE_FRONT_DOOR_ROUTE } from "./lib/captureFrontDoor";

// ================================================================================================
// JOB 3030 (U4/SCRUM-543) — JEDE SEITE WIRD NACHGELADEN, KEINE HÄNGT MEHR AM EINTRITT.
// ================================================================================================
//
// Bis hierher standen hier 24 STATISCHE Importe. Weil diese Datei am Eintrittspunkt hängt, lag damit
// der Code ALLER Seiten im Eintritts-Stück — Admin, UiKit, Wissensnetz, Stufe 2, die 1.686 Zeilen der
// Vordertür, die 1.370 Zeilen der Bibliothek — und musste geladen sein, bevor die erste Seite
// erscheinen konnte, obwohl ein Mensch beim ersten Blick genau EINE Seite sieht.
//
// GEMESSEN IM PRODUKTIONSBAU (`NODE_ENV=production`, gegen `tools/build` kalibriert). Die Zahlen
// stammen NICHT aus einer Schätzung, sondern aus zwei Bauläufen DESSELBEN Quellstands, die
// `tests/erstladezeit/eintritt-ohne-seiten.test.ts` bei jedem Lauf neu fährt: einmal wie hier
// aufgeteilt, einmal mit einem Plugin, das GENAU DIESE `lazy`-Zeilen wieder zu statischen Importen
// macht und sonst nichts anfasst — dieser Gegenbau ist das „vorher".
//     05.09.2026, Arbeitsstand `e8116ba`, vorher (Seiten statisch): Eintritt 2.069.266 B ·   6 Stücke · 3.025.986 B gesamt
//     05.09.2026, Arbeitsstand `e8116ba`, nachher (aufgeteilt):     Eintritt 1.285.166 B · 102 Stücke · 3.063.530 B gesamt
// Der Eintritt fällt also um 784.100 B (−37,89 %). Die Gesamtsumme WÄCHST um 37.544 B (+1,24 %).
//
// DIESER ZUWACHS IST ENTSCHIEDEN, NICHT OFFEN — und er ist gemessen, nicht behauptet (JOB 3077).
// Bis zum 05.09.2026 stand hier, Lieferpunkt 3(c) („die Summe wächst nicht") sei wörtlich nicht
// erfüllt und die Entscheidung darüber liege beim Auftraggeber. Sie ist gefallen: Steuerung,
// 05.09.2026, Entscheidung 13 (`UEBERGABE.md`), Zeile U4b in `PRIORITAETEN.md`. 3(c) wird NICHT als
// Nullwachstumsbedingung geführt, sondern als ausdrücklich angenommenes, GEMESSENES
// Verpackungsbudget: 37.544 B mehr Auslieferung gegen 784.100 B weniger Erstlast.
//
// DIE BEDINGUNG DIESER ANNAHME ist, dass der Zuwachs Rahmen ist und nicht Inhalt — und das wird seit
// JOB 3077 bei jedem Testlauf neu erhoben, nicht mehr vermutet. Gemessen wird an den AUSGELIEFERTEN
// Bytes: die Quellkarte des fertigen, minimierten Stücks ordnet jeden Bereich seiner Quelldatei zu.
// Was zu keiner Quelle gehört, ist Rahmen — die Import-Zeilen zwischen den Stücken, die
// Nachlade-Helfer und die erzeugte Ausfuhrliste `export{…}` am Stückende:
//     Zuwachs 37.544 B = RAHMEN +39.256 B (104,6 %) + INHALT −1.712 B (−4,6 %)
// DER AUSGELIEFERTE MODULINHALT WÄCHST ALSO NICHT, ER SCHRUMPFT um 1.712 B: in 102 kleinen Stücken
// muss rollup weniger Namen entkollidieren (`Foo$1`, `Foo$2`) als in sechs großen, und das spart
// mehr, als der Schnitt kostet. Damit ist Lieferpunkt 3(c) für den INHALT sogar wörtlich erfüllt;
// gewachsen ist ausschließlich die Verpackung. Aufgeschlüsselt: 31 von 854 Modulen wachsen (zusammen
// +3.167 B), 254 schrumpfen (zusammen −4.879 B). Der einzige nennenswerte Zuwachs ist DIESE DATEI
// mit +3.037 B (2.325 → 5.362) — die 27 `lazy(() => import(…))`-Ausdrücke unten stehen als
// Laufzeitcode da, wo ein statischer Import beim Bündeln spurlos verschwindet; der zweitgrößte
// Zuwachs im ganzen Baum beträgt 32 B. Am 05.09.2026 wächst KEIN Seitenmodul aus `pages/`; die
// schwersten schrumpfen (Capture −543 B, Admin −311 B). Diese Liste wird bei jedem Testlauf neu
// erhoben und gedruckt, damit der Satz nicht veraltet. Kein Modul liegt doppelt — das hält (c1)
// toleranzfrei fest.
// Die Wächter dazu: (c3) verlangt, dass der ausgelieferte Modulinhalt NICHT wächst (Budget 0),
// (c3r) stellt dieselbe Frage vor der Minimierung aus einer zweiten Quelle, (c4) hält die
// Gesamtsumme unter 2,5 % Zuwachs. Reißt einer, ist die Annahme neu zu treffen — nicht die Schranke
// zu heben. Zum Spielraum von (c3): rund 17 weitere nachgeladene Seiten trägt er, dann kippt er
// (gemessen, siehe Kommentar an `INHALT_BUDGET_BYTES`).
//
// DIE ZAHLEN IN RUNDE 7 WAREN FALSCH und stehen hier korrigiert (ben, R7): dort war das „vorher"
// ein `inlineDynamicImports`-Bau, der auch die FÜNF schon vor JOB 3030 getrennt ausgelieferten
// Stücke einschmolz. Gegen dieses zu große Vergleichsbündel las sich der Gewinn als −58,07 %.
// Bens eigener Produktionsbau des echten Vorstands `9e1e573` — 6 Stücke, Eintritt 2.026.850 B,
// Summe 2.983.570 B — traf den damaligen Gegenbau (04.09., `b203c44`: 2.028.116 B) auf 0,06 % genau
// und bestätigte die −38 %. Beide Zahlen sind Historie: der Gegenbau baut den HEUTIGEN Quellstand,
// steht am 05.09. deshalb schon bei 2.069.266 B und wächst mit dem Produkt weiter. Genau darum
// steht oben ein Verhältnis und keine Byte-Schranke — die wäre über Nacht von selbst rot geworden.
//
// DREI DINGE, DIE HIER BEWUSST SO SIND:
//   · KEINE AUSNAHME. Auch `PlaceholderPage` wird nachgeladen. Sobald eine Seite die Ausnahme wäre,
//     wäre die Regel nicht mehr binär prüfbar — und der Wächter `tests/erstladezeit/` erhebt seine
//     Sollmenge aus dem Dateisystem, kennt also gar keine Ausnahme.
//   · `pages/Stufe2.tsx` LIEFERT VIER SEITEN (Capital, GraphView, ImportReview, Output). Das sind
//     vier `lazy`-Einträge auf DIESELBE Datei; rollup legt sie in EIN gemeinsames Stück. Das ist
//     richtig so: es ist eine Datei, und wer eine der vier öffnet, bekommt genau dieses eine Stück.
//   · `Stage2Notice`, `RoleNotice`, `ErrorBoundary`, `navigation.ts`, `useRole` und `Splash` bleiben
//     STATISCH. Sie sind keine Seiten, sondern werden auf jedem Weg gebraucht — sie nachzuladen
//     hieße, für den Rahmen selbst eine Ladefläche zu zeigen.
//
// DIE RECHTE ÄNDERN SICH NICHT: `Guarded` prüft Rolle und Stufe 2 VOR dem Nachladen — wer nicht darf,
// lädt auch nicht. Und ein fehlgeschlagener Nachlade-Abruf ist keine weiße Seite: die Fehlergrenze
// in `Guarded` (`<ErrorBoundary key={item.id}>`) fängt ihn und zeigt die Karte mit Neu-laden-Knopf.
const Admin = lazy(() => import("./pages/Admin").then((m) => ({ default: m.Admin })));
const Analytics = lazy(() => import("./pages/Analytics").then((m) => ({ default: m.Analytics })));
const Ask = lazy(() => import("./pages/Ask").then((m) => ({ default: m.Ask })));
// R-0443 (Aufnahme gesamt-hilfen): die Seite „So arbeitet Klarwerk“ — nachgeladen wie jede andere.
const Arbeitsweise = lazy(() =>
  import("./pages/Arbeitsweise").then((m) => ({ default: m.Arbeitsweise })),
);
// R-1646: die Ausgangsprüfung — nachgeladen wie jede andere Seite (Regel oben, JOB 3503).
const Ausgangspruefung = lazy(() =>
  import("./pages/Ausgangspruefung").then((m) => ({ default: m.Ausgangspruefung })),
);
const Capture = lazy(() => import("./pages/Capture").then((m) => ({ default: m.Capture })));
const CaptureFrontDoor = lazy(() =>
  import("./pages/CaptureFrontDoor").then((m) => ({ default: m.CaptureFrontDoor })),
);
const Conflicts = lazy(() => import("./pages/Conflicts").then((m) => ({ default: m.Conflicts })));
const Dokumentfragen = lazy(() =>
  import("./pages/Dokumentfragen").then((m) => ({ default: m.Dokumentfragen })),
);
const DuplicateCompare = lazy(() =>
  import("./pages/DuplicateCompare").then((m) => ({ default: m.DuplicateCompare })),
);
// R-1107 (Aufnahme gesamt-dublettenvergleich): der Zusammenführen-Assistent — nachgeladen wie jede
// andere Seite (Regel oben, JOB 3503).
const DuplicateMerge = lazy(() =>
  import("./pages/DuplicateMerge").then((m) => ({ default: m.DuplicateMerge })),
);
const Duplicates = lazy(() =>
  import("./pages/Duplicates").then((m) => ({ default: m.Duplicates })),
);
const Einstieg = lazy(() => import("./pages/Einstieg").then((m) => ({ default: m.Einstieg })));
const ExternalKnowledge = lazy(() =>
  import("./pages/ExternalKnowledge").then((m) => ({ default: m.ExternalKnowledge })),
);
// JOB 4156/4309 (WIKI-GESAMTANWEISUNG-ANSCHLUSS): die Seite der zusammengesetzten Anweisung. Sie
// wird nachgeladen wie jede andere — die Regel oben kennt keine Ausnahme.
//
// SIE WOHNT IN `components/gesamtanweisung/` UND NICHT IN `pages/`, und das ist gemessen, nicht
// Geschmack: der Bereich besteht aus sieben Bauteilen, die JOB 4154 als geschlossenen Ordner
// gebaut hat (`GesamtanweisungSeite`, `LesestandAnsicht`, `VergleichAnsicht`, …). Die Hülle
// daneben in einen zweiten Ordner zu legen hiesse, den Bereich an zwei Orten zu führen. Für die
// Aufteilung des Bündels ändert das nichts: `tests/erstladezeit/` erhebt seine Sollmenge aus den
// `lazy`-Zeilen DIESER Datei, nicht aus dem Verzeichnisnamen.
const Firmenwoerterbuch = lazy(() =>
  import("./pages/Firmenwoerterbuch").then((m) => ({ default: m.Firmenwoerterbuch })),
);
const GesamtanweisungBereich = lazy(() =>
  import("./components/gesamtanweisung/GesamtanweisungBereich").then((m) => ({
    default: m.GesamtanweisungBereich,
  })),
);
const Help = lazy(() => import("./pages/Help").then((m) => ({ default: m.Help })));
// KLARA-VORSCHAU (produkt:20261007:klara-vorschau): der dokumentierte Einstieg `/klara-vorschau`.
const KlaraVorschauSeite = lazy(() =>
  import("./pages/KlaraVorschau").then((m) => ({ default: m.KlaraVorschauSeite })),
);
const KnowledgeDetail = lazy(() =>
  import("./pages/KnowledgeDetail").then((m) => ({ default: m.KnowledgeDetail })),
);
const KnowledgeIntake = lazy(() =>
  import("./pages/KnowledgeIntake").then((m) => ({ default: m.KnowledgeIntake })),
);
const Library = lazy(() => import("./pages/Library").then((m) => ({ default: m.Library })));
// produkt:20261010:wissenskreislauf-schliessen: der Vorgang einer Wissenslücke — nachgeladen wie
// jede andere Seite (Regel oben, JOB 3503).
const LueckeVorgang = lazy(() =>
  import("./pages/LueckeVorgang").then((m) => ({ default: m.LueckeVorgang })),
);
const Lifecycle = lazy(() => import("./pages/Lifecycle").then((m) => ({ default: m.Lifecycle })));
const LiveWallBeamer = lazy(() =>
  import("./pages/LiveWallBeamer").then((m) => ({ default: m.LiveWallBeamer })),
);
// JOB 3503: nachgeladen wie jede andere Seite — die Regel oben kennt keine Ausnahme, und der
// Wächter `tests/erstladezeit/` erhebt seine Sollmenge aus dem Dateisystem.
const MeineEntwuerfe = lazy(() =>
  import("./pages/MeineEntwuerfe").then((m) => ({ default: m.MeineEntwuerfe })),
);
// BILDSCHIRMABLÄUFE: nachgeladen wie jede andere Seite (Regel oben, JOB 3503).
const AblaufUebernahme = lazy(() =>
  import("./pages/AblaufUebernahme").then((m) => ({ default: m.AblaufUebernahme })),
);
const Mobile = lazy(() => import("./pages/Mobile").then((m) => ({ default: m.Mobile })));
const MyTasks = lazy(() => import("./pages/MyTasks").then((m) => ({ default: m.MyTasks })));
const PlaceholderPage = lazy(() =>
  import("./pages/PlaceholderPage").then((m) => ({ default: m.PlaceholderPage })),
);
const Profile = lazy(() => import("./pages/Profile").then((m) => ({ default: m.Profile })));
// ADMIN-10: Qualitätsaufgaben und Rückmeldungen — nachgeladen wie jede andere Seite (JOB 3503).
const Qualitaetsaufgaben = lazy(() =>
  import("./pages/Qualitaetsaufgaben").then((m) => ({ default: m.Qualitaetsaufgaben })),
);
// ADMIN-15: interne Richtlinien (alle Konten) und ihre Verwaltung samt Unternehmensprofil —
// nachgeladen wie jede andere Seite (Regel oben, JOB 3503).
const Richtlinien = lazy(() =>
  import("./pages/Richtlinien").then((m) => ({ default: m.Richtlinien })),
);
const Risk = lazy(() => import("./pages/Risk").then((m) => ({ default: m.Risk })));
// produkt:20261007:spaces: nachgeladen wie jede andere Seite (Regel oben, JOB 3503).
const Spaces = lazy(() => import("./pages/Spaces").then((m) => ({ default: m.Spaces })));
// produkt:20261007:interner-chat: nachgeladen wie jede andere Seite.
const Chat = lazy(() => import("./pages/Chat").then((m) => ({ default: m.Chat })));
// produkt:20261007:artikel-gemeinsam: der gemeinsame Entwurf eines Artikels.
const GemeinsamerEntwurf = lazy(() =>
  import("./pages/GemeinsamerEntwurf").then((m) => ({ default: m.GemeinsamerEntwurfSeite })),
);
// produkt:20261007:templates-default: Vorlagen, Standard, Space-Vorgaben, Begriffspflege.
const Vorlagen = lazy(() => import("./pages/Vorlagen").then((m) => ({ default: m.Vorlagen })));
const Start = lazy(() => import("./pages/Start").then((m) => ({ default: m.Start })));
const Capital = lazy(() => import("./pages/Stufe2").then((m) => ({ default: m.Capital })));
const GraphView = lazy(() => import("./pages/Stufe2").then((m) => ({ default: m.GraphView })));
const ImportReview = lazy(() =>
  import("./pages/Stufe2").then((m) => ({ default: m.ImportReview })),
);
const Output = lazy(() => import("./pages/Stufe2").then((m) => ({ default: m.Output })));
const UiKit = lazy(() => import("./pages/UiKit").then((m) => ({ default: m.UiKit })));
const Unternehmen = lazy(() =>
  import("./pages/Unternehmen").then((m) => ({ default: m.Unternehmen })),
);
const Validation = lazy(() =>
  import("./pages/Validation").then((m) => ({ default: m.Validation })),
);
const Wissensnetz = lazy(() =>
  import("./pages/Wissensnetz").then((m) => ({ default: m.Wissensnetz })),
);

function DuplicateComparePage(): JSX.Element {
  return <DuplicateCompare kind="duplicate" />;
}

function ConflictComparePage(): JSX.Element {
  return <DuplicateCompare kind="conflict" />;
}

const PAGES: Record<string, ComponentType> = {
  start: Start,
  aufgaben: MyTasks,
  erfassen: Capture,
  captureFrontDoor: CaptureFrontDoor,
  // JOB 1972: Seitenauflösung für den bewachten Deep-Link `/erfassen/neu`. Ohne diesen Schlüssel
  // fiele die berechtigte Rolle auf den `PlaceholderPage`-Zweig (:88) statt auf die Erfassung.
  captureIntake: KnowledgeIntake,
  // JOB 3503: der eigene Ort der Entwürfe. Er liest denselben Bestand wie der Editor (`useDrafts`),
  // legt keinen zweiten an.
  entwuerfe: MeineEntwuerfe,
  // BILDSCHIRMABLÄUFE: `/erfassen/ablauf` (bewachter Eintrag `ablauf` in `app/navigation.ts`).
  ablauf: AblaufUebernahme,
  // JOB 4309: der Einstieg der Gesamtanweisung, jetzt über den REGULÄREN Weg. Der Schlüssel heisst
  // wie die `id` des Menüpunkts (`app/navigation.ts`) — `Guarded` schlägt hier genau darunter nach.
  // Ohne diesen Eintrag fiele die berechtigte Rolle auf `PlaceholderPage` statt auf die Fläche.
  gesamtanweisungen: GesamtanweisungBereich,
  fragen: Ask,
  bibliothek: Library,
  extern: ExternalKnowledge,
  validierung: Validation,
  konflikte: Conflicts,
  duplikate: Duplicates,
  duplicateCompare: DuplicateComparePage,
  duplicateMerge: DuplicateMerge,
  conflictCompare: ConflictComparePage,
  risiko: Risk,
  lebenszyklus: Lifecycle,
  analytics: Analytics,
  admin: Admin,
  output: Output,
  import: ImportReview,
  graph: GraphView,
  // JOB 2600 D1: die Themenkarte auf der bestehenden Oberflaeche.
  wissensnetz: Wissensnetz,
  kapital: Capital,
  hilfe: Help,
  profil: Profile,
};

// AUFTRAG-mega51 BLOCK A: die drei bewachten Deep-Link-Routen standen hier als eigene Tabelle —
// unsichtbar für jeden, der „darf diese Rolle dorthin?" an der Navigationsquelle fragt. Sie stehen
// jetzt in app/navigation.ts neben ALL_ITEMS (`GUARDED_ITEMS`); hier wird nur noch darüber geroutet.

// Rollen-Gate (RB-2): der Deep-Link auf Unerlaubtes bleibt zu — aber nicht mehr stumm.
// AUFTRAG-mega70 BLOCK A (bens Befund): der Rückwurf `<Navigate to={HOME_ROUTE}>` war die stille
// Umleitung, die WP-UX-WOW-1 U9 für den Stufe-2-Fall bereits abgeschafft hatte. Jetzt erklärt
// sich auch der Rollenfall: welche Rolle der Bereich braucht, plus Weg zurück (RoleNotice).
function Guarded({ item }: { item: NavItem }): JSX.Element {
  const { role, stufe2 } = useRole();
  if (!roleAllows(item, role)) {
    return <RoleNotice item={item} />;
  }
  // WP-UX-WOW-1 U9: die Rolle würde reichen, nur Stufe 2 ist aus → KEINE stille Umleitung mehr,
  // sondern die erklärende Karte mit Einschalt-Knopf (Admin) bzw. ehrlichem Hinweis + Zurück.
  if (item.stufe2 && !stufe2) {
    return <Stage2Notice />;
  }
  const Page = PAGES[item.id];
  // Bug (Pedi 04.07.): Fehler in EINER Seite dürfen nicht die ganze App weiß ausblenden.
  // key={item.id} → die Fehlergrenze setzt sich beim Seitenwechsel zurück.
  return (
    <ErrorBoundary key={item.id}>{Page ? <Page /> : <PlaceholderPage item={item} />}</ErrorBoundary>
  );
}

// ================================================================================================
// Q3 (b) · `/erfassen/vordertuer` IST EIN ALIAS DES BLATTS, KEIN WEG NACH `/start`.
// ================================================================================================
//
// DER BEFUND: Die Adresse steht in Aufträgen, Lesezeichen und Kommentaren („zeigt dasselbe Blatt
// wie `/erfassen`", `pages/CaptureFrontDoor.tsx:19-21`) — eine Router-Zeile dafür gab es aber nie.
// Die Vordertür liegt unter `CAPTURE_FRONT_DOOR_ROUTE` (`/capture/frontdoor`), und
// `/erfassen/vordertuer` fiel in den `*`-Zweig unten: still nach `/start`, der Entwurf aus
// `?draft=…` verloren.
//
// WIE: KEINE UMLEITUNG, sondern DERSELBE Eintrag der Vordertür (`EXTRA_GUARDED_ITEMS`,
// `app/navigation.ts`) unter einer zweiten Adresse — also dasselbe Rollentor, dieselbe Seite,
// dieselbe Fehlergrenze. Die Abfrage bleibt dadurch von selbst stehen:
// `/erfassen/vordertuer?draft=<id>` öffnet genau diesen Entwurf, und die Stufenpflicht des Blatts
// greift unverändert (gemessen in
// `tests/vertraulichkeit-pflicht/vordertuer-alias-und-altentwurf.test.tsx`). Fehlte der Eintrag
// je, wäre das ein Baufehler — dann lieber laut scheitern als wieder still auf `/start`.
const VORDERTUER_ALIAS = "/erfassen/vordertuer";
function vordertuerEintrag(): NavItem {
  const item = GUARDED_ITEMS.find((g) => g.path === CAPTURE_FRONT_DOOR_ROUTE);
  if (!item) {
    throw new Error(`routes.tsx: kein bewachter Eintrag für ${CAPTURE_FRONT_DOOR_ROUTE}`);
  }
  return item;
}
const VORDERTUER_ITEM = vordertuerEintrag();

export function AppRoutes(): JSX.Element {
  // JOB 3030: GENAU EINE Grenze für alle Routen. Sie steht um `<Routes>` herum und nicht je Route,
  // weil zu jedem Zeitpunkt genau eine Seite gerendert wird — je Route wären es 30 gleiche Grenzen
  // und damit 30 Stellen, an denen jemand `fallback={null}` schreiben könnte. Der Rückfall ist die
  // Ladefläche „Lädt …", nie eine leere Fläche.
  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route path="/" element={<Navigate to={HOME_ROUTE} replace />} />
        {GUARDED_ITEMS.map((item) => (
          <Route key={item.id} path={item.path} element={<Guarded item={item} />} />
        ))}
        <Route path="/wissen/:id" element={<KnowledgeDetail />} />
        {/* produkt:20261007:artikel-gemeinsam: derselbe Entwurf für alle Bearbeitenden, erreichbar
            aus dem Artikelgespräch und dem Artikel. Ohne `Guarded`, wie `/wissen/:id`: die Türen
            dahinter fordern `ko.create` und Sichtbarkeit am Server (`gemeinsam-routes.ts`). */}
        <Route path="/wissen/:id/gemeinsam" element={<GemeinsamerEntwurf />} />
        {/* produkt:20261010:wissenskreislauf-schliessen: der Vorgang einer Wissenslücke für
            Fragende und Fachzuständige. Ohne `Guarded`, wie `/wissen/:id`: die Beteiligung prüft
            der Server (`GET /api/gaps/:id/vorgang`, 404 für Unbeteiligte). Erreichbar aus der
            Glocke und aus der Fragenseite. */}
        <Route path="/luecke/:id" element={<LueckeVorgang />} />
        {/* R-0928 / R-1675 (Folgeauftrag gesamt-erstnutzerfuehrung-quellen): die vier kurzen
            thematischen Einstiege vor den Vollfunktionen (`pages/Einstieg.tsx`, `lib/einstiege.ts`).
            OHNE `Guarded`: die Ansicht erklärt nur und öffnet nichts; das Rollen-Tor sitzt an ihrer
            Übergabe (`RoleLink`) und am Ziel selbst. Ein unbekanntes Thema führt auf die Startseite. */}
        <Route path="/einstieg/:thema" element={<Einstieg />} />
        {/* R-0443 (Aufnahme gesamt-hilfen): „So arbeitet Klarwerk“ — wie das Wissensnetz aufgebaut
            ist und wie gearbeitet wird. OHNE `Guarded`, wie `/einstieg/:thema`: die Seite erklärt
            und öffnet nichts; ihre Wege laufen über `RoleLink`, und die Daten dahinter fordern
            `ko.read` am Server (`/api/graph`). Einstieg: oben auf der Hilfeseite. */}
        <Route path="/so-arbeitet-klarwerk" element={<Arbeitsweise />} />
        {/* SCRUM-527 (Design-Batch B): zuhörende „Wissen erfassen"-Erstversion — Deep-Link zum Browser-
            Check durch Pedi (noch nicht in der Navigation, um die bestehende Erfassung nicht zu berühren). */}
        <Route path="/erfassen/neu" element={<KnowledgeIntake />} />
        {/* Q3 (b): der Alias der Vordertür — Begründung an `VORDERTUER_ALIAS`. */}
        <Route path={VORDERTUER_ALIAS} element={<Guarded item={VORDERTUER_ITEM} />} />
        {/* ==========================================================================================
            JOB 4309 · DIE GEÖFFNETE ANWEISUNG — DIE EINE ZEILE, DIE NICHT AUS `NAV_GROUPS` KOMMT.
            ==========================================================================================

            `/gesamtanweisungen` steht seit JOB 4309 NICHT mehr hier: der Punkt ist ein Menüpunkt
            (`app/navigation.ts`), `GUARDED_ITEMS.map(…)` oben legt seine Route an, und `PAGES`
            unten löst ihn auf. Zwei Definitionen für denselben Pfad hätte der Router beide
            angenommen und die erste gewonnen — eine stille zweite Wahrheit über das Rollen-Gate.

            `/gesamtanweisungen/:id` BLEIBT eine eigene Zeile, und das ist gewollt: ein zweiter
            Navigationseintrag für die Detailseite ist ausdrücklich verworfen (JOB 562, dieselbe
            Lage wie `/wissen/:id` unter der Bibliothek). Ihren Ort im Menü behält sie trotzdem —
            `istAktiverEintrag` zeichnet den Elternpunkt über die Präfixregel aus.

            Beide Adressen zeigen auf DASSELBE Bauteil; welcher Zustand entsteht, entscheidet `:id`
            (`GesamtanweisungBereich` liest ihn über `useParams`). Ohne diese Zeile fiele die
            geöffnete Anweisung in den `*`-Zweig und würde auf die Startseite umgeleitet.

            SIE TRÄGT KEIN `Guarded`, und das ist dieselbe Bauform wie bei `/wissen/:id` darüber:
            die zehn Türen dahinter fordern ihr Recht am Server (`ko.read`/`ko.create`/`ko.validate`,
            `services/app/src/routes/gesamtanweisung-routes.ts`), gemessen in
            `tests/wiki-gesamtanweisung-abnahme/a1-tuer-in-der-gebauten-app.test.ts`. */}
        <Route path="/gesamtanweisungen/:id" element={<GesamtanweisungBereich />} />
        {/* Firmenwörterbuch: Nachschlagen und Pflege des Begriffskatalogs. Ohne `Guarded`, wie
            `/wissen/:id`: die Türen dahinter fordern ihr Recht am Server (`ko.read` zum Lesen,
            `ko.validate` zum Pflegen, `services/app/src/routes/begriffe-routes.ts`). Erreichbar
            aus jedem Begriffshinweis im Editor; ein eigener Menüpunkt ist bewusst nicht Teil
            dieser Lieferung. */}
        <Route path="/begriffe" element={<Firmenwoerterbuch />} />
        {/* KLARA-VORSCHAU: Einstieg und fiktiver Artikel. Ohne `Guarded` und ohne Serverabruf —
            die Seite zeigt nur Demodaten und schaltet Klara für die Sitzung ein
            (docs/klara/klara-vorschau.md). Eigene Fehlergrenze: ein Fehler nimmt die Hülle nicht mit. */}
        <Route
          path="/klara-vorschau"
          element={
            <ErrorBoundary key="klara-vorschau">
              <KlaraVorschauSeite />
            </ErrorBoundary>
          }
        />
        <Route
          path="/klara-vorschau/artikel/:id"
          element={
            <ErrorBoundary key="klara-vorschau-artikel">
              <KlaraVorschauSeite />
            </ErrorBoundary>
          }
        />
        {/* R-0740: die Live-Wand als Beamer-Ansicht. Ohne `Guarded`, wie `/wissen/:id`: die Tür
            dahinter fordert ihr Recht am Server (`ko.read`, `services/app/src/routes/
            livewall-routes.ts`) und filtert nach den Sichtrechten der angemeldeten Person.
            Erreichbar aus dem Blatt „Was gerade passiert". */}
        <Route path="/livewall" element={<LiveWallBeamer />} />
        {/* R-1646 · Ausgangsprüfung: der ausgehende Text vor der Freigabe. Ohne `Guarded`, wie
            `/begriffe`: die Türen dahinter fordern `ko.validate` am Server
            (`services/app/src/routes/ausgangspruefung-routes.ts`). */}
        <Route path="/ausgangspruefung" element={<Ausgangspruefung />} />
        {/* Spaces (produkt:20261007:spaces): Arbeitsräume und ihre Inhalte. Ohne `Guarded`, wie
            `/begriffe`: die Türen dahinter fordern ihr Recht am Server (`ko.read`, `ko.validate`
            zum Anlegen, Zuständigkeit/Schreibrecht am Space, `services/app/src/routes/
            spaces-routes.ts`). Erreichbar über die Spacezeile jedes Artikels und über Klara. */}
        <Route path="/spaces" element={<Spaces />} />
        <Route path="/spaces/:id" element={<Spaces />} />
        {/* Interner Chat (produkt:20261007:interner-chat). Ohne `Guarded`, wie `/spaces`: die
            Türen dahinter fordern ihr Recht am Server (`ko.read`, `ko.create` für die
            Wissensübernahme; Teilnahme, Space- und Artikelrecht je Gespräch,
            `services/app/src/routes/chat-routes.ts`). Erreichbar über das Konto-Menü, den
            Gesprächsknopf an Artikel und Space und Klaras „Als Nachricht entwerfen". */}
        <Route path="/chat" element={<Chat />} />
        <Route path="/chat/:id" element={<Chat />} />
        {/* produkt:20261007:templates-default: Vorlagen. Ohne `Guarded`, wie `/spaces`: die Türen
            dahinter fordern ihr Recht am Server (`ko.read`, `ko.create`, Spacezuständigkeit,
            `users.manage` für Verwaltung und Begriffspflege, `vorlagen-routes.ts`). Erreichbar aus
            der Vorlagenwahl im Editor und aus der Verwaltung („Spaces und Wissensordnung"). */}
        <Route path="/vorlagen" element={<Vorlagen />} />
        {/* R-0347: Fragen an ein hochgeladenes Dokument. Ohne `Guarded` und ohne Server-Tür: die
            Fläche liest die Datei im Browser und sendet nichts (`pages/Dokumentfragen.tsx`).
            Erreichbar von der Fragen-Seite; im Menü markiert die Präfixregel „Fragen". */}
        <Route path="/fragen/dokument" element={<Dokumentfragen />} />
        {/* ADMIN-15: Unternehmensprofil und interne Richtlinien. Ohne `Guarded`, wie `/begriffe`:
            die Türen dahinter fordern ihr Recht am Server (`requireUser` zum Lesen und für die
            eigene Kenntnisnahme/Zustimmung, `users.manage` für die Verwaltung,
            `services/app/src/routes/unternehmen-routes.ts`). Erreichbar über das Konto-Menü
            (`/richtlinien`) und die Verwaltung unter „System" (`/unternehmen`). */}
        <Route path="/richtlinien" element={<Richtlinien />} />
        <Route path="/unternehmen" element={<Unternehmen />} />
        {/* ADMIN-10: Qualitätsaufgaben und Rückmeldungen. Ohne `Guarded`, wie `/unternehmen`: die
            Türen dahinter fordern `users.manage` am Server und filtern jede Zeile über den
            Sichtbarkeitsfilter (`services/app/src/routes/qualitaetsaufgaben-routes.ts`). Ohne
            Recht zeigt die Seite den Hinweis „der Verwaltung vorbehalten". Erreichbar aus der
            Verwaltung, Gruppe „Qualität". */}
        <Route path="/qualitaetsaufgaben" element={<Qualitaetsaufgaben />} />
        <Route path="/mobile" element={<Mobile />} />
        <Route path="/ui-kit" element={<UiKit />} />
        <Route path="*" element={<Navigate to={HOME_ROUTE} replace />} />
      </Routes>
    </Suspense>
  );
}
