// ================================================================================================
// R-1630 / R-2176 · ANTWORTEN MIT DEM WISSENSSTAND VOR EINEM JAHR VERGLEICHEN.
// ================================================================================================
//
// Die Sätze des Antwortvergleichs auf der Fragenseite (`components/fragen/WissensstandVergleich.tsx`):
// die Antwort mit dem Wissensstand zum Stichtag neben der heutigen, je Quelle der belegte Grund des
// Unterschieds — und die Grenzen des Vergleichs, ausdrücklich genannt.
//
// ANREDE „du", wie die übrigen Rückmeldungen des Produkts.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "antwortvergleich.",
  legacySchluessel: [],
  de: {
    "antwortvergleich.titel": "Mit früherem Wissensstand vergleichen",
    "antwortvergleich.erklaerung":
      "Klara beantwortet dieselbe Frage noch einmal — nur mit den Fassungen, die am Stichtag galten und damals freigegeben waren — und zeigt, was sich seither geändert hat.",
    "antwortvergleich.stichtag": "Stichtag",
    "antwortvergleich.start": "Vergleichen",
    "antwortvergleich.laeuft": "Vergleicht …",
    "antwortvergleich.fehler":
      "Der Vergleich konnte gerade nicht erstellt werden. Die Antwort oben bleibt unverändert.",
    "antwortvergleich.anders":
      "Mit dem Wissensstand vom {{datum}} hätte diese Frage eine andere Antwort gehabt.",
    "antwortvergleich.gleich":
      "Mit dem Wissensstand vom {{datum}} wäre die Antwort dieselbe gewesen.",
    "antwortvergleich.damals": "Antwort mit Wissensstand vom {{datum}}",
    "antwortvergleich.heute": "Antwort mit heutigem Wissensstand",
    "antwortvergleich.keineGrundlage": "Keine belastbare Grundlage in diesem Wissensstand.",
    "antwortvergleich.warum": "Warum sich die Grundlage unterscheidet",
    "antwortvergleich.verwendung": "Grundlage damals: {{damals}} · heute: {{heute}}",
    "antwortvergleich.ja": "ja",
    "antwortvergleich.nein": "nein",
    "antwortvergleich.titelDamals": "Damaliger Titel: {{titel}}",
    "antwortvergleich.aussageDamals": "Damals:",
    "antwortvergleich.aussageHeute": "Heute:",
    "antwortvergleich.aenderung": "Fassung {{version}} vom {{zeit}}: {{vermerk}}",
    "antwortvergleich.grund.neu_seit_stichtag": "erst nach dem Stichtag erfasst",
    "antwortvergleich.grund.ueberarbeitet": "überarbeitet (Fassung {{damals}} → {{heute}})",
    "antwortvergleich.grund.fassung_unbelegt": "damalige Fassung nicht belegt",
    "antwortvergleich.grund.freigabe_damals_unbelegt": "Freigabe zum Stichtag nicht belegt",
    "antwortvergleich.grund.heute_nicht_freigegeben": "heute nicht freigegeben",
    "antwortvergleich.grund.damals_gesperrt":
      "damalige Fassung gesperrt (Stufe, Sichtbarkeit oder Schutzdaten)",
    "antwortvergleich.grund.unveraendert": "unverändert",
    "antwortvergleich.grenzen":
      "Grenzen: Beide Antworten entstehen jetzt; gespeicherte Antworten von damals gibt es nicht. Gesucht wird im heutigen Bestand — inzwischen gelöschtes Wissen fehlt. Eine damalige Fassung zählt nur, wenn Verlauf, Versionsabbild und Freigabe im Prüfprotokoll belegt sind. Vertrauenswerte werden nicht historisch geführt; beide Seiten tragen den heutigen.",
  },
  en: {
    "antwortvergleich.titel": "Compare with earlier knowledge",
    "antwortvergleich.erklaerung":
      "Klara answers the same question again — using only the versions that applied on the reference date and were approved then — and shows what has changed since.",
    "antwortvergleich.stichtag": "Reference date",
    "antwortvergleich.start": "Compare",
    "antwortvergleich.laeuft": "Comparing …",
    "antwortvergleich.fehler":
      "The comparison could not be created just now. The answer above is unchanged.",
    "antwortvergleich.anders":
      "With the knowledge as of {{datum}}, this question would have had a different answer.",
    "antwortvergleich.gleich":
      "With the knowledge as of {{datum}}, the answer would have been the same.",
    "antwortvergleich.damals": "Answer with knowledge as of {{datum}}",
    "antwortvergleich.heute": "Answer with today's knowledge",
    "antwortvergleich.keineGrundlage": "No reliable basis in this state of knowledge.",
    "antwortvergleich.warum": "Why the basis differs",
    "antwortvergleich.verwendung": "Basis then: {{damals}} · today: {{heute}}",
    "antwortvergleich.ja": "yes",
    "antwortvergleich.nein": "no",
    "antwortvergleich.titelDamals": "Title then: {{titel}}",
    "antwortvergleich.aussageDamals": "Then:",
    "antwortvergleich.aussageHeute": "Today:",
    "antwortvergleich.aenderung": "Version {{version}} of {{zeit}}: {{vermerk}}",
    "antwortvergleich.grund.neu_seit_stichtag": "added after the reference date",
    "antwortvergleich.grund.ueberarbeitet": "revised (version {{damals}} → {{heute}})",
    "antwortvergleich.grund.fassung_unbelegt": "version of that time not documented",
    "antwortvergleich.grund.freigabe_damals_unbelegt":
      "approval on the reference date not documented",
    "antwortvergleich.grund.heute_nicht_freigegeben": "not approved today",
    "antwortvergleich.grund.damals_gesperrt":
      "version of that time blocked (level, visibility or protected data)",
    "antwortvergleich.grund.unveraendert": "unchanged",
    "antwortvergleich.grenzen":
      "Limits: both answers are created now; stored answers from back then do not exist. The search runs on today's content — knowledge deleted since is missing. A version of that time only counts if its history, version snapshot and approval are documented in the audit log. Trust values are not kept over time; both sides use today's.",
  },
  nl: {
    "antwortvergleich.titel": "Vergelijken met eerdere kennis",
    "antwortvergleich.erklaerung":
      "Klara beantwoordt dezelfde vraag opnieuw — alleen met de versies die op de peildatum golden en toen waren vrijgegeven — en laat zien wat er sindsdien is veranderd.",
    "antwortvergleich.stichtag": "Peildatum",
    "antwortvergleich.start": "Vergelijken",
    "antwortvergleich.laeuft": "Bezig met vergelijken …",
    "antwortvergleich.fehler":
      "De vergelijking kon nu niet worden gemaakt. Het antwoord hierboven blijft ongewijzigd.",
    "antwortvergleich.anders":
      "Met de kennis van {{datum}} had deze vraag een ander antwoord gehad.",
    "antwortvergleich.gleich": "Met de kennis van {{datum}} was het antwoord hetzelfde geweest.",
    "antwortvergleich.damals": "Antwoord met kennis van {{datum}}",
    "antwortvergleich.heute": "Antwoord met de kennis van vandaag",
    "antwortvergleich.keineGrundlage": "Geen betrouwbare basis in deze stand van kennis.",
    "antwortvergleich.warum": "Waarom de basis verschilt",
    "antwortvergleich.verwendung": "Basis toen: {{damals}} · vandaag: {{heute}}",
    "antwortvergleich.ja": "ja",
    "antwortvergleich.nein": "nee",
    "antwortvergleich.titelDamals": "Titel toen: {{titel}}",
    "antwortvergleich.aussageDamals": "Toen:",
    "antwortvergleich.aussageHeute": "Vandaag:",
    "antwortvergleich.aenderung": "Versie {{version}} van {{zeit}}: {{vermerk}}",
    "antwortvergleich.grund.neu_seit_stichtag": "pas na de peildatum vastgelegd",
    "antwortvergleich.grund.ueberarbeitet": "herzien (versie {{damals}} → {{heute}})",
    "antwortvergleich.grund.fassung_unbelegt": "versie van toen niet aangetoond",
    "antwortvergleich.grund.freigabe_damals_unbelegt": "vrijgave op de peildatum niet aangetoond",
    "antwortvergleich.grund.heute_nicht_freigegeben": "vandaag niet vrijgegeven",
    "antwortvergleich.grund.damals_gesperrt":
      "versie van toen geblokkeerd (niveau, zichtbaarheid of beschermde gegevens)",
    "antwortvergleich.grund.unveraendert": "ongewijzigd",
    "antwortvergleich.grenzen":
      "Grenzen: beide antwoorden ontstaan nu; opgeslagen antwoorden van toen bestaan niet. Er wordt gezocht in de huidige inhoud — sindsdien verwijderde kennis ontbreekt. Een versie van toen telt alleen als geschiedenis, versiesnapshot en vrijgave in het controleprotocol zijn aangetoond. Vertrouwenswaarden worden niet historisch bijgehouden; beide kanten gebruiken die van vandaag.",
  },
} satisfies Textmodul;
