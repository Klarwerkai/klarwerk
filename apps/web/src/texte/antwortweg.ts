// ================================================================================================
// R-0293 / R-0276 / R-0317 / R-0340 · DER WEG ZUR ANTWORT — die Texte der Erklärfläche.
// ================================================================================================
//
// Ein Klick unter der Antwort öffnet den gespeicherten Antwortbeleg: welche Wissenseinheit in
// welcher Fassung, welche Quelle und Fundstelle, welche Freigabe, wer zuständig war, welche
// Konfliktlage heute besteht — und, wenn der Hauptbeleg nicht auflöst, genau einer von fünf
// Gründen. Komponente: `components/AnswerExplanation.tsx`, Ableitung: `lib/answerExplanation.ts`.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "antwortweg.",
  legacySchluessel: [],
  de: {
    "antwortweg.oeffnen": "Wie kam diese Antwort zustande?",
    "antwortweg.schliessen": "Erklärung schließen",
    "antwortweg.laedt": "Der gespeicherte Antwortbeleg wird geladen …",
    "antwortweg.fehler": "Der Antwortbeleg konnte gerade nicht geladen werden.",
    "antwortweg.titel": "Der Weg zu dieser Antwort",
    "antwortweg.hinweis":
      "Gezeigt wird der Beleg, der beim Antworten gespeichert wurde. Es wird nicht neu gesucht, und sichtbar ist nur, was du heute sehen darfst.",
    "antwortweg.keinBeleg": "Zu dieser Antwort wurde kein Beleg gespeichert.",
    "antwortweg.anzahl_one": "{{count}} Beleg gespeichert",
    "antwortweg.anzahl_other": "{{count}} Belege gespeichert",
    "antwortweg.zustand.VALID": "Der Beleg ist vollständig und unverändert.",
    "antwortweg.zustand.DEGRADED":
      "Der Beleg ist unverändert, aber nicht alle Angaben wurden beim Antworten erfasst.",
    "antwortweg.zustand.INVALIDATED":
      "Der Beleg ist entwertet – er trägt diese Antwort nicht mehr. Einzelheiten werden deshalb nicht gezeigt.",
    "antwortweg.zustand.REDACTED": "Teile des Belegs sind für dich geschwärzt.",
    "antwortweg.grundTitel": "Warum der Hauptbeleg nicht auflöst: {{grund}}",
    "antwortweg.grund.unbekannt": "unbekannt – die Wissenseinheit gibt es nicht mehr",
    "antwortweg.grund.technisch":
      "technisch unauflösbar – die gebundene Fassung lässt sich nicht auflösen",
    "antwortweg.grund.beschaedigt":
      "beschädigt – der gespeicherte Beleg passt nicht mehr zu seiner Prüfsumme",
    "antwortweg.grund.keinRecht":
      "kein Zugriffsrecht – du darfst die tragende Quelle heute nicht sehen",
    "antwortweg.grund.geschwaerzt": "geschwärzt – die tragende Quelle ist geschwärzt",
    "antwortweg.entwertetOhneGrund":
      "Für die Entwertung ist kein Grund benannt. Ein Beleg ohne Grund gilt als entwertet.",
    "antwortweg.geprueft.ja": "Alle tragenden Quellen sind geprüft und freigegeben.",
    "antwortweg.geprueft.nein": "Nicht alle tragenden Quellen sind geprüft und freigegeben.",
    "antwortweg.geprueft.unbekannt":
      "Ob alle tragenden Quellen geprüft sind, lässt sich für dich nicht feststellen.",
    "antwortweg.widerspruch.ja": "Zu einer tragenden Quelle ist heute ein Widerspruch offen.",
    "antwortweg.widerspruch.nein": "Zu den tragenden Quellen ist heute kein Widerspruch offen.",
    "antwortweg.widerspruch.unbekannt": "Ob heute ein Widerspruch offen ist, ist nicht bekannt.",
    "antwortweg.erzeugung.model": "Der Antworttext wurde mit einem KI-Modell formuliert.",
    "antwortweg.erzeugung.deterministic":
      "Der Antworttext wurde ohne KI-Modell aus den Quellen zusammengestellt.",
    "antwortweg.zeile.tragend": "Trägt die Antwort – im Antworttext als Quelle belegt",
    "antwortweg.zeile.herangezogen": "Herangezogen, aber im Antworttext nicht zitiert",
    "antwortweg.zeile.fassung": "Fassung {{version}}",
    "antwortweg.zeile.fassungFehlt": "Fassung nicht gebunden",
    "antwortweg.zeile.quelle": "Quelle: {{quelle}}",
    "antwortweg.zeile.quelleFehlt": "Quelle nicht erfasst ({{grund}})",
    "antwortweg.zeile.fundstelle": "Fundstelle: {{fundstelle}}",
    "antwortweg.zeile.fundstelleFehlt": "Fundstelle nicht erfasst ({{grund}})",
    "antwortweg.zeile.freigabe": "Freigabe im Prüfbuch: Eintrag {{seq}}, Prüfsumme {{kurz}}",
    "antwortweg.zeile.freigabeFehlt": "Keine Freigabe gebunden ({{grund}})",
    "antwortweg.zeile.rechte": "Vertraulichkeit beim Antworten: {{stufe}}",
    "antwortweg.zeile.rechteFehlt": "Vertraulichkeit beim Antworten: keine Stufe gesetzt",
    "antwortweg.zeile.zustaendig": "Zuständig beim Antworten: {{name}}",
    "antwortweg.zeile.zustaendigAutor":
      "Zuständig beim Antworten: {{name}} (als Autor – kein Eigentümer benannt)",
    "antwortweg.zeile.widerspruchOffen": "Heute ist ein Widerspruch offen.",
    "antwortweg.zeile.geschwaerzt": "Geschwärzt – diesen Beleg darfst du heute nicht sehen.",
  },
  en: {
    "antwortweg.oeffnen": "How did this answer come about?",
    "antwortweg.schliessen": "Close explanation",
    "antwortweg.laedt": "Loading the stored answer record …",
    "antwortweg.fehler": "The answer record could not be loaded right now.",
    "antwortweg.titel": "The path to this answer",
    "antwortweg.hinweis":
      "This shows the record stored when the answer was given. Nothing is searched again, and you only see what you are allowed to see today.",
    "antwortweg.keinBeleg": "No record was stored for this answer.",
    "antwortweg.anzahl_one": "{{count}} record stored",
    "antwortweg.anzahl_other": "{{count}} records stored",
    "antwortweg.zustand.VALID": "The record is complete and unchanged.",
    "antwortweg.zustand.DEGRADED":
      "The record is unchanged, but not every detail was captured when the answer was given.",
    "antwortweg.zustand.INVALIDATED":
      "The record is invalidated – it no longer supports this answer. Details are therefore not shown.",
    "antwortweg.zustand.REDACTED": "Parts of the record are redacted for you.",
    "antwortweg.grundTitel": "Why the main record does not resolve: {{grund}}",
    "antwortweg.grund.unbekannt": "unknown – the knowledge object no longer exists",
    "antwortweg.grund.technisch": "technically unresolvable – the bound version cannot be resolved",
    "antwortweg.grund.beschaedigt": "damaged – the stored record no longer matches its checksum",
    "antwortweg.grund.keinRecht":
      "no access right – you are not allowed to see the carrying source today",
    "antwortweg.grund.geschwaerzt": "redacted – the carrying source is redacted",
    "antwortweg.entwertetOhneGrund":
      "No reason is given for the invalidation. A record without a reason counts as invalidated.",
    "antwortweg.geprueft.ja": "All carrying sources are reviewed and approved.",
    "antwortweg.geprueft.nein": "Not all carrying sources are reviewed and approved.",
    "antwortweg.geprueft.unbekannt":
      "Whether all carrying sources are reviewed cannot be determined for you.",
    "antwortweg.widerspruch.ja": "A contradiction is open today for a carrying source.",
    "antwortweg.widerspruch.nein": "No contradiction is open today for the carrying sources.",
    "antwortweg.widerspruch.unbekannt": "Whether a contradiction is open today is not known.",
    "antwortweg.erzeugung.model": "The answer text was phrased by an AI model.",
    "antwortweg.erzeugung.deterministic":
      "The answer text was assembled from the sources without an AI model.",
    "antwortweg.zeile.tragend": "Carries the answer – cited as a source in the answer text",
    "antwortweg.zeile.herangezogen": "Consulted, but not cited in the answer text",
    "antwortweg.zeile.fassung": "Version {{version}}",
    "antwortweg.zeile.fassungFehlt": "Version not bound",
    "antwortweg.zeile.quelle": "Source: {{quelle}}",
    "antwortweg.zeile.quelleFehlt": "Source not captured ({{grund}})",
    "antwortweg.zeile.fundstelle": "Location: {{fundstelle}}",
    "antwortweg.zeile.fundstelleFehlt": "Location not captured ({{grund}})",
    "antwortweg.zeile.freigabe": "Approval in the audit log: entry {{seq}}, checksum {{kurz}}",
    "antwortweg.zeile.freigabeFehlt": "No approval bound ({{grund}})",
    "antwortweg.zeile.rechte": "Confidentiality when answered: {{stufe}}",
    "antwortweg.zeile.rechteFehlt": "Confidentiality when answered: no level set",
    "antwortweg.zeile.zustaendig": "Responsible when answered: {{name}}",
    "antwortweg.zeile.zustaendigAutor":
      "Responsible when answered: {{name}} (as author – no owner named)",
    "antwortweg.zeile.widerspruchOffen": "A contradiction is open today.",
    "antwortweg.zeile.geschwaerzt": "Redacted – you are not allowed to see this record today.",
  },
  nl: {
    "antwortweg.oeffnen": "Hoe is dit antwoord tot stand gekomen?",
    "antwortweg.schliessen": "Uitleg sluiten",
    "antwortweg.laedt": "Het opgeslagen antwoordbewijs wordt geladen …",
    "antwortweg.fehler": "Het antwoordbewijs kon nu niet worden geladen.",
    "antwortweg.titel": "De weg naar dit antwoord",
    "antwortweg.hinweis":
      "Getoond wordt het bewijs dat bij het antwoorden is opgeslagen. Er wordt niet opnieuw gezocht, en je ziet alleen wat je vandaag mag zien.",
    "antwortweg.keinBeleg": "Voor dit antwoord is geen bewijs opgeslagen.",
    "antwortweg.anzahl_one": "{{count}} bewijs opgeslagen",
    "antwortweg.anzahl_other": "{{count}} bewijzen opgeslagen",
    "antwortweg.zustand.VALID": "Het bewijs is volledig en ongewijzigd.",
    "antwortweg.zustand.DEGRADED":
      "Het bewijs is ongewijzigd, maar niet alle gegevens zijn bij het antwoorden vastgelegd.",
    "antwortweg.zustand.INVALIDATED":
      "Het bewijs is ongeldig – het draagt dit antwoord niet meer. Details worden daarom niet getoond.",
    "antwortweg.zustand.REDACTED": "Delen van het bewijs zijn voor jou zwartgemaakt.",
    "antwortweg.grundTitel": "Waarom het hoofdbewijs niet oplost: {{grund}}",
    "antwortweg.grund.unbekannt": "onbekend – het kennisobject bestaat niet meer",
    "antwortweg.grund.technisch":
      "technisch niet oplosbaar – de gebonden versie kan niet worden opgelost",
    "antwortweg.grund.beschaedigt":
      "beschadigd – het opgeslagen bewijs past niet meer bij zijn controlesom",
    "antwortweg.grund.keinRecht": "geen toegangsrecht – je mag de dragende bron vandaag niet zien",
    "antwortweg.grund.geschwaerzt": "zwartgemaakt – de dragende bron is zwartgemaakt",
    "antwortweg.entwertetOhneGrund":
      "Voor de ongeldigheid is geen reden genoemd. Een bewijs zonder reden geldt als ongeldig.",
    "antwortweg.geprueft.ja": "Alle dragende bronnen zijn gecontroleerd en vrijgegeven.",
    "antwortweg.geprueft.nein": "Niet alle dragende bronnen zijn gecontroleerd en vrijgegeven.",
    "antwortweg.geprueft.unbekannt":
      "Of alle dragende bronnen gecontroleerd zijn, kan voor jou niet worden vastgesteld.",
    "antwortweg.widerspruch.ja": "Voor een dragende bron staat vandaag een tegenstrijdigheid open.",
    "antwortweg.widerspruch.nein":
      "Voor de dragende bronnen staat vandaag geen tegenstrijdigheid open.",
    "antwortweg.widerspruch.unbekannt":
      "Of er vandaag een tegenstrijdigheid openstaat, is niet bekend.",
    "antwortweg.erzeugung.model": "De antwoordtekst is met een AI-model geformuleerd.",
    "antwortweg.erzeugung.deterministic":
      "De antwoordtekst is zonder AI-model uit de bronnen samengesteld.",
    "antwortweg.zeile.tragend": "Draagt het antwoord – in de antwoordtekst als bron vermeld",
    "antwortweg.zeile.herangezogen": "Geraadpleegd, maar niet geciteerd in de antwoordtekst",
    "antwortweg.zeile.fassung": "Versie {{version}}",
    "antwortweg.zeile.fassungFehlt": "Versie niet gebonden",
    "antwortweg.zeile.quelle": "Bron: {{quelle}}",
    "antwortweg.zeile.quelleFehlt": "Bron niet vastgelegd ({{grund}})",
    "antwortweg.zeile.fundstelle": "Vindplaats: {{fundstelle}}",
    "antwortweg.zeile.fundstelleFehlt": "Vindplaats niet vastgelegd ({{grund}})",
    "antwortweg.zeile.freigabe": "Vrijgave in het auditlogboek: item {{seq}}, controlesom {{kurz}}",
    "antwortweg.zeile.freigabeFehlt": "Geen vrijgave gebonden ({{grund}})",
    "antwortweg.zeile.rechte": "Vertrouwelijkheid bij het antwoorden: {{stufe}}",
    "antwortweg.zeile.rechteFehlt": "Vertrouwelijkheid bij het antwoorden: geen niveau ingesteld",
    "antwortweg.zeile.zustaendig": "Verantwoordelijk bij het antwoorden: {{name}}",
    "antwortweg.zeile.zustaendigAutor":
      "Verantwoordelijk bij het antwoorden: {{name}} (als auteur – geen eigenaar benoemd)",
    "antwortweg.zeile.widerspruchOffen": "Vandaag staat een tegenstrijdigheid open.",
    "antwortweg.zeile.geschwaerzt": "Zwartgemaakt – dit bewijs mag je vandaag niet zien.",
  },
} satisfies Textmodul;
