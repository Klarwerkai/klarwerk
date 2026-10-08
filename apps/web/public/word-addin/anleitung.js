// ================================================================================================
// KLARA · ANLEITUNG IN WORD — DER BLOCK KW-ANLEITUNG, ALS EIGENE DATEI.
// ================================================================================================
//
// AUFTRAG `aufnahme:20260922:gesamt-dokumenterzeugung`, Ergänzung Pedi 28.09.2026 (Nutzerliste
// Auftrag 6): „Eine vollständige Anleitung in der vertrauten Word-Oberfläche erstellen und
// vorhandenes Wissen wiederverwenden." Umfang ZUNÄCHST: eine Anleitungsvorlage (Zweck,
// Voraussetzungen, Arbeitsschritte, gegebenenfalls Warnhinweise) und ein wiederverwendbarer
// Inhaltsbaustein, in EINEM Word-Host. Der Rückweg nach Klarwerk ist der bestehende aus Auftrag 4
// (`rueckweg.js`, Block KW-RUECKWEG) — dieser Block ändert an ihm nichts.
//
// WAS DER BLOCK TUT, und an welcher Stelle:
//   · VORLAGE (`anleitungVorlageEinfuegen`): setzt hinter den Absatz am Cursor vier Überschriften
//     (Formatvorlage „Überschrift 2") mit je einem Hinweis in eckigen Klammern. Der Hinweis sagt,
//     ob der Abschnitt Pflicht oder optional ist und was hineingehört; die Zeile über den Knöpfen
//     sagt dasselbe für alle vier.
//   · PRÜFEN (`anleitungPruefen`): liest die Absätze des Dokuments und meldet JE ABSCHNITT, ob die
//     Pflichtangabe fehlt — mit einer Handlungsempfehlung und einem Knopf, der in Word genau an
//     diese Stelle springt. Geprüft wird nur die FORM. Deshalb stehen zwei getrennte Zeilen da:
//     „Formal vollständig" und „Fachlich geprüft oder freigegeben: nicht festgestellt". Das zweite
//     entscheidet Klarwerk nach der Rückgabe, nicht dieses Fenster.
//   · BAUSTEIN (`anleitungBausteinEinfuegen`): ein vorhandenes, geprüftes Wissensobjekt wird am
//     Cursor eingefügt, mit einer Herkunftszeile (Titel, Fassung, Prüfstand, Vertrauenswert,
//     Kennung). Die Auswahl kommt aus `GET /api/output/sources`, und VOR dem Einfügen fragt der
//     Block `POST /api/output/generate` — die Output Factory weist Ungeprüftes und Vertrauliches
//     serverseitig ab (NOT_VALIDATED / CONFIDENTIAL) und liefert die Herkunft. Der Inhalt selbst
//     kommt aus `GET /api/kos/:id`; weicht dessen Fassung von der Herkunft ab, wird nichts
//     eingefügt. Recht: `ko.read` an allen drei Routen — der Server entscheidet, wer berechtigt ist.
//     Die Herkunftszeile trägt seit Nacharbeit 4 auch Gültigkeitsbereich, Verantwortung,
//     Fassungsdatum, letzte Prüfung und die offenen Unsicherheiten (R-0337/R-1739) — aus der
//     Herkunft der Factory, Fehlendes ausdrücklich als „nicht angegeben/benannt/festgehalten".
//   · DOKUMENT ERZEUGEN (`anleitungDokumentErzeugen`, Nacharbeit 4, R-0288/R-0414/R-0732): Dokumentart
//     (Arbeits-/Verfahrensanweisung, Checkliste, Störungsleitfaden, Schulungsunterlage, FAQ,
//     Zusammenfassung für die Führung), Zielrolle und mehrere geprüfte Quellen wählen; die Output
//     Factory erzeugt das Dokument, und sein VOLLSTÄNDIGES Ergebnis — Titel, Adressat, Prüfhinweis,
//     Rumpf, Herkunftsblock — kommt als Word-Absätze hinter den Cursor (Überschriften als Vorlage).
//
// RÜCKWEG: Überschriften stehen als Word-Formatvorlage im Dokument; der Rückweg liest sie seit
// Nacharbeit 9 aus Word (`rwStrukturLesen`) und gibt sie als <hN> zurück. Herkunftszeilen sind
// gewöhnliche Absätze und reisen als Text mit. So bleiben Gliederung und Quellenbezug in Klarwerk
// nachvollziehbar (`tests/anleitung-word/anleitung-word.test.tsx`, Teil R).
//
// WARUM EINE EIGENE DATEI: dieselbe Bauform wie `begriffe.js` — `taskpane.js` ist in seiner Grösse
// bewacht (`tests/klara-zerlegung/schnittflaechen.test.ts` B3). Klassisches Skript, ES5 wie das
// Fenster, auf der Ignorierliste von Biome, im KOPF von `taskpane.html` geladen; es schliesst sich
// erst bei `DOMContentLoaded` an. Das Markup baut der Block selbst (hinter `#begriffe-block`), damit
// `taskpane.html` nur um den Verweis wächst. Er nutzt die Globalen des Fensters (`lang`,
// `signedIn`, `officeUsable`, `bestandRuheSichtbar`, `bestandSitzung`, `checkSession`) und hängt
// sich an `bestandZeichnen` und `setLang`. Fehlen sie, bleibt der Block verborgen.
//
// DATENFLUSS (ausgewiesen): Gelesen werden die Absatztexte und Formatvorlagen des offenen Dokuments
// — sie verlassen Word NICHT; die Prüfung läuft hier im Fenster. Zum Server gehen nur Kennungen der
// gewählten Quellen, die Dokumentart und die eingetippte Zielrolle (Output Factory, Wissensobjekt)
// an dieselbe Klarwerk-Instanz. Seit Nacharbeit 5 zusätzlich: das GETIPPTE Vorhaben samt früherer
// Fragen an den Fragenweg (`/api/ask`, wie eine Konsolenfrage — kein Dokumenttext), und nur auf
// ausdrücklichen Klick „Mit Klara ausformulieren" der Auftrag an den Zuruf-Weg (KA6) — der geht
// nur mit gültiger Einwilligung hinaus und kann ein Modell nutzen; sein Ergebnis ist als
// KI-Entwurf gekennzeichnet. Alle übrigen Wege nutzen weder ein Modell noch einen externen Dienst.
// Geschrieben wird ins Dokument nur auf Klick, und nur an der Cursorposition (Absatz wird geteilt).
// ================================================================================================
"use strict";

    // KW-ANLEITUNG-START
    var ANLEITUNG_TEXTE = {
      de: {
        vorlage: "Anleitungsvorlage einfügen",
        pruefen: "Vollständigkeit prüfen",
        erklaerung: "Pflicht: Zweck, Voraussetzungen, Arbeitsschritte. Optional: Warnhinweise. Die Hinweise in eckigen Klammern sagen, was in den Abschnitt gehört; sie werden beim Ausfüllen ersetzt.",
        bausteinWahl: "Baustein wählen …",
        bausteinEinfuegen: "Baustein einfügen",
        bausteinGrenze: "Zur Auswahl steht nur geprüftes, nicht vertrauliches Wissen. Eingefügt wird am Cursor, mit Herkunft und Fassung.",
        bausteinOption: "{titel} · Fassung {version}",
        bausteinKeine: "Kein geprüftes Wissen verfügbar.",
        bausteinBedingung: "Gilt, wenn: {liste}",
        herkunft: "Baustein aus Klarwerk: „{titel}“ · Fassung {version} · Prüfstand {status} · Vertrauenswert {trust} · Kennung {id}",
        herkunftPflicht: " · Geltung: {geltung} · Verantwortliche Rolle: {rolle} · Verantwortung: {verantwortung} · Fassung vom {fassung} · Letzte Prüfung: {pruefung}",
        nichtBelegt: "nicht belegt",
        u_rolle_fehlt: "verantwortliche Rolle nicht benannt",
        u_pruefnachweis_fremde_fassung: "Prüfnachweis gilt einer früheren Fassung",
        u_pruefnachweis_ungueltig: "Prüfnachweis hält der Auditprüfung nicht stand",
        art_betriebsmitteilung: "Betriebsmitteilung",
        fadenTitel: "Was haben Sie vor?",
        vorhabenPlatzhalter: "z. B. „Ich muss eine Betriebsmitteilung zu Urlaubstagen schreiben – was haben wir dazu?“",
        recherche: "Was haben wir dazu?",
        fadenSie: "Sie: {text}",
        fadenAntwort: "Klara: {text}",
        fadenPunkte: "Klara: {n} Fundstelle(n) im Haus",
        fadenPunkt: "„{titel}“ · Fassung {version} · Stand {stand} · Reifegrad: {reife} · Vertrauenswert {trust}",
        reifeGeprueft: "geprüft",
        reifeUngeprueft: "nicht geprüft ({status}) – kommt nicht in den Entwurf",
        fadenFehltAlles: "Was fehlt: Dazu gibt es im Haus kein geprüftes Wissen.",
        fadenFehltTeil: "Was fehlt: {n} Fundstelle(n) sind nicht geprüft und bleiben draußen.",
        fadenFehltNichts: "Was fehlt: nichts Erkennbares – alle Fundstellen sind geprüft.",
        fadenLeer: "Bitte zuerst beschreiben, was Sie vorhaben.",
        fadenKeineQuellen: "Im Gesprächsfaden steht noch kein geprüfter Punkt.",
        entwurf: "Entwurf aus diesen Punkten erzeugen",
        kiEntwurf: "Mit Klara ausformulieren (KI-Entwurf)",
        kiKennzeichnung: "KI-Entwurf – formuliert von {wer}. Nicht geprüft: vor Verwendung lesen, kürzen und verantworten.",
        kiAnbieterUnbekannt: "einem Modell (Anbieter vom Server nicht genannt)",
        kiHerkunft: "Quelle: „{titel}“ · Fassung {version} · Prüfstand {stufe} · Kennung {id}",
        kiAuftrag: "Formuliere eine {textsorte} zu: {vorhaben}. {form}",
        kiForm_betriebsmitteilung: "Form: Betreff, Anrede an die Belegschaft, sachlich-freundlicher Ton in Sie-Form, Anlass, geltende Punkte, was zu tun ist, Ansprechpartner, Gruß. Verwende nur Aussagen aus den angegebenen Quellen.",
        kiForm_allgemein: "Verwende nur Aussagen aus den angegebenen Quellen.",
        kiNichtMoeglich: "Mit KI gerade nicht möglich: {grund}",
        kiNichtVerfuegbar: "Der KI-Weg ist in diesem Fenster nicht verfügbar – nichts gesendet.",
        kiUnbrauchbar: "Der Server hat keinen KI-Entwurf mit Herkunft geliefert – nichts eingefügt.",
        kiEingefuegt: "KI-Entwurf eingefügt – oben gekennzeichnet, mit Herkunft je Quelle.",
        herkunftUnsicherheiten: " · Offene Unsicherheiten: {liste}",
        validiertVon: " (validiert von {liste})",
        nichtAngegeben: "nicht angegeben",
        nichtBenannt: "nicht benannt",
        nichtFestgehalten: "nicht festgehalten",
        u_niedriger_trust: "niedriger Vertrauenswert",
        u_geltung_fehlt: "Gültigkeitsbereich nicht angegeben",
        u_verantwortung_fehlt: "Verantwortung nicht benannt",
        u_pruefdatum_fehlt: "kein Prüfnachweis – Datum der letzten Prüfung nicht belegt",
        erzeugenTitel: "Dokument aus geprüftem Wissen erzeugen",
        art: "Dokumentart",
        art_instruction: "Arbeitsanweisung / Verfahrensanweisung",
        art_checklist: "Checkliste",
        art_troubleshooting: "Störungsleitfaden",
        art_training: "Schulungsunterlage",
        art_faq: "FAQ",
        art_management_summary: "Zusammenfassung für die Führung",
        zielrolle: "Zielrolle (z. B. Schichtleitung)",
        quellenWaehlen: "Quellen wählen",
        erzeugen: "Dokument erzeugen und einfügen",
        erzeugenGrenze: "Erzeugt wird nur aus den gewählten geprüften, nicht vertraulichen Wissensobjekten – mit Titel, Zielrolle und Herkunftsnachweis je Quelle. Eingefügt wird das vollständige Ergebnis hinter dem Cursor.",
        keineQuellen: "Bitte mindestens eine Quelle wählen.",
        nurGeprueftQuelle: "Nur geprüftes, nicht vertrauliches Wissen kann als Quelle dienen – nichts eingefügt.",
        ohneRolle: "keine Zielrolle",
        dokumentEingefuegt: "Eingefügt: „{titel}“ ({rolle}) aus {n} Quelle(n) – mit Herkunftsnachweis.",
        abschnitt_zweck: "Zweck",
        abschnitt_voraussetzungen: "Voraussetzungen",
        abschnitt_schritte: "Arbeitsschritte",
        abschnitt_warnhinweise: "Warnhinweise",
        vorlage_zweck: "[Pflichtangabe: Wozu dient diese Anleitung, und für wen gilt sie? Ein bis zwei Sätze.]",
        vorlage_voraussetzungen: "[Pflichtangabe: Was muss vor dem ersten Schritt erfüllt sein – Berechtigungen, Werkzeuge, Unterlagen? Gibt es nichts, „Keine“ eintragen.]",
        vorlage_schritte: "[Pflichtangabe: Jeden Arbeitsschritt als eigenen Absatz, in der Reihenfolge der Ausführung, z. B. „1. Anlage ausschalten.“]",
        vorlage_warnhinweise: "[Optional: Gefahren und typische Fehler, die man vor oder bei den Schritten kennen muss. Gibt es keine, diesen Abschnitt löschen.]",
        rat_zweck: "Schreiben Sie in ein bis zwei Sätzen, wozu die Anleitung dient und für wen sie gilt.",
        rat_voraussetzungen: "Nennen Sie, was vor dem ersten Schritt erfüllt sein muss. Gibt es nichts, schreiben Sie „Keine“.",
        rat_schritte: "Tragen Sie mindestens einen Arbeitsschritt ein – jeden als eigenen Absatz, in der Reihenfolge der Ausführung.",
        rat_warnhinweise: "Tragen Sie Gefahren oder typische Fehler ein – oder löschen Sie den Abschnitt samt Hinweis, wenn es keine gibt.",
        statusFehlt: "„{name}“ (Pflicht): Abschnitt fehlt. Fügen Sie die Überschrift „{name}“ ein oder setzen Sie die Vorlage neu ein.",
        statusLeer: "„{name}“ (Pflicht): Angabe fehlt. {rat}",
        statusOk: "„{name}“ (Pflicht): ausgefüllt.",
        statusOptionalVorlage: "„{name}“ (optional): Es steht noch der Vorlagenhinweis. {rat}",
        statusOptionalOk: "„{name}“ (optional): ausgefüllt.",
        statusOptionalFehlt: "„{name}“ (optional): nicht enthalten – das ist zulässig.",
        zumAbschnitt: "Zum Abschnitt",
        formalJa: "Formal vollständig: ja – alle Pflichtangaben sind ausgefüllt.",
        formalNein: "Formal vollständig: nein – {n} von {gesamt} Pflichtangaben fehlen.",
        fachlich: "Fachlich geprüft oder freigegeben: nicht festgestellt. Diese Prüfung sieht nur auf die Form. Fachlich geprüft und freigegeben ist die Anleitung erst, wenn sie unter „Erfassen“ an Klarwerk zurückgegeben und dort von einer berechtigten Person freigegeben wurde.",
        bausteineImDokument: "Bausteine aus Klarwerk im Dokument: {n}. Ihr Prüfstand steht in der jeweiligen Herkunftszeile und gilt nur für den Baustein, nicht für die ganze Anleitung.",
        keineVorlage: "Im Dokument steht keine Anleitungsvorlage (Überschriften Zweck, Voraussetzungen, Arbeitsschritte). Zuerst „Anleitungsvorlage einfügen“.",
        laeuft: "Einen Moment …",
        vorlageEingefuegt: "Vorlage eingefügt. Ersetzen Sie die Hinweise in eckigen Klammern durch Ihren Text.",
        bausteinEingefuegt: "Eingefügt: „{titel}“, Fassung {version} – mit Herkunftszeile.",
        nurGeprueft: "Nur geprüftes, nicht vertrauliches Wissen kann als Baustein eingefügt werden – nichts eingefügt.",
        standGeaendert: "Der Baustein hat sich gerade geändert – nichts eingefügt. Bitte erneut wählen.",
        keineAuswahl: "Bitte zuerst einen Baustein wählen.",
        keinWord: "Word hat nicht geantwortet – nichts geändert.",
        verschoben: "Das Dokument hat sich seit der Prüfung geändert. Bitte erneut prüfen.",
        fehler: "Das ging nicht. Bitte erneut versuchen.",
        anmeldung: "Bitte erneut anmelden.",
        recht: "Dafür fehlt das Recht."
      },
      en: {
        vorlage: "Insert instruction template",
        pruefen: "Check completeness",
        erklaerung: "Required: Purpose, Prerequisites, Steps. Optional: Warnings. The hints in square brackets say what belongs in each section; replace them as you fill it in.",
        bausteinWahl: "Choose a building block …",
        bausteinEinfuegen: "Insert building block",
        bausteinGrenze: "Only reviewed, non-confidential knowledge can be chosen. It is inserted at the cursor, with source and version.",
        bausteinOption: "{titel} · version {version}",
        bausteinKeine: "No reviewed knowledge available.",
        bausteinBedingung: "Applies when: {liste}",
        herkunft: "Building block from Klarwerk: “{titel}” · version {version} · review status {status} · trust {trust} · ID {id}",
        herkunftPflicht: " · scope: {geltung} · responsible role: {rolle} · responsible: {verantwortung} · version of {fassung} · last review: {pruefung}",
        nichtBelegt: "not evidenced",
        u_rolle_fehlt: "responsible role not named",
        u_pruefnachweis_fremde_fassung: "review record refers to an earlier version",
        u_pruefnachweis_ungueltig: "review record fails the audit check",
        art_betriebsmitteilung: "Staff notice",
        fadenTitel: "What are you planning?",
        vorhabenPlatzhalter: "e.g. “I need to write a staff notice about holidays – what do we have on this?”",
        recherche: "What do we have on this?",
        fadenSie: "You: {text}",
        fadenAntwort: "Klara: {text}",
        fadenPunkte: "Klara: {n} finding(s) in-house",
        fadenPunkt: "“{titel}” · version {version} · as of {stand} · maturity: {reife} · trust {trust}",
        reifeGeprueft: "reviewed",
        reifeUngeprueft: "not reviewed ({status}) – stays out of the draft",
        fadenFehltAlles: "What is missing: there is no reviewed knowledge on this in-house.",
        fadenFehltTeil: "What is missing: {n} finding(s) are not reviewed and stay out.",
        fadenFehltNichts: "What is missing: nothing apparent – all findings are reviewed.",
        fadenLeer: "Please describe what you are planning first.",
        fadenKeineQuellen: "The conversation does not contain a reviewed point yet.",
        entwurf: "Create a draft from these points",
        kiEntwurf: "Let Klara phrase it (AI draft)",
        kiKennzeichnung: "AI draft – phrased by {wer}. Not reviewed: read, shorten and take responsibility before use.",
        kiAnbieterUnbekannt: "a model (provider not named by the server)",
        kiHerkunft: "Source: “{titel}” · version {version} · review status {stufe} · ID {id}",
        kiAuftrag: "Draft a {textsorte} on: {vorhaben}. {form}",
        kiForm_betriebsmitteilung: "Form: subject, greeting to the staff, factual and friendly formal tone, occasion, applicable points, what to do, contact, closing. Use only statements from the given sources.",
        kiForm_allgemein: "Use only statements from the given sources.",
        kiNichtMoeglich: "AI not possible right now: {grund}",
        kiNichtVerfuegbar: "The AI path is not available in this pane – nothing sent.",
        kiUnbrauchbar: "The server did not return an AI draft with sources – nothing inserted.",
        kiEingefuegt: "AI draft inserted – marked at the top, with source per point.",
        herkunftUnsicherheiten: " · open uncertainties: {liste}",
        validiertVon: " (validated by {liste})",
        nichtAngegeben: "not specified",
        nichtBenannt: "not named",
        nichtFestgehalten: "not recorded",
        u_niedriger_trust: "low trust",
        u_geltung_fehlt: "scope not specified",
        u_verantwortung_fehlt: "responsibility not named",
        u_pruefdatum_fehlt: "no review record – date of last review not evidenced",
        erzeugenTitel: "Create a document from reviewed knowledge",
        art: "Document type",
        art_instruction: "Work instruction / procedure",
        art_checklist: "Checklist",
        art_troubleshooting: "Troubleshooting guide",
        art_training: "Training material",
        art_faq: "FAQ",
        art_management_summary: "Management summary",
        zielrolle: "Target role (e.g. shift lead)",
        quellenWaehlen: "Choose sources",
        erzeugen: "Create and insert document",
        erzeugenGrenze: "Only the chosen reviewed, non-confidential knowledge objects are used – with title, target role and source record per source. The complete result is inserted after the cursor.",
        keineQuellen: "Please choose at least one source.",
        nurGeprueftQuelle: "Only reviewed, non-confidential knowledge can be used as a source – nothing inserted.",
        ohneRolle: "no target role",
        dokumentEingefuegt: "Inserted: “{titel}” ({rolle}) from {n} source(s) – with source record.",
        abschnitt_zweck: "Purpose",
        abschnitt_voraussetzungen: "Prerequisites",
        abschnitt_schritte: "Steps",
        abschnitt_warnhinweise: "Warnings",
        vorlage_zweck: "[Required: What is this instruction for, and who does it apply to? One or two sentences.]",
        vorlage_voraussetzungen: "[Required: What must be in place before the first step – permissions, tools, documents? If nothing, enter “None”.]",
        vorlage_schritte: "[Required: Each step as its own paragraph, in the order it is carried out, e.g. “1. Switch off the machine.”]",
        vorlage_warnhinweise: "[Optional: Hazards and typical mistakes people need to know before or during the steps. If there are none, delete this section.]",
        rat_zweck: "Write one or two sentences on what the instruction is for and who it applies to.",
        rat_voraussetzungen: "State what must be in place before the first step. If nothing, write “None”.",
        rat_schritte: "Enter at least one step – each as its own paragraph, in the order it is carried out.",
        rat_warnhinweise: "Enter hazards or typical mistakes – or delete the section and its hint if there are none.",
        statusFehlt: "“{name}” (required): section missing. Add the heading “{name}” or insert the template again.",
        statusLeer: "“{name}” (required): content missing. {rat}",
        statusOk: "“{name}” (required): filled in.",
        statusOptionalVorlage: "“{name}” (optional): the template hint is still there. {rat}",
        statusOptionalOk: "“{name}” (optional): filled in.",
        statusOptionalFehlt: "“{name}” (optional): not included – that is allowed.",
        zumAbschnitt: "Go to section",
        formalJa: "Formally complete: yes – all required sections are filled in.",
        formalNein: "Formally complete: no – {n} of {gesamt} required sections are missing.",
        fachlich: "Reviewed or released: not established. This check only looks at the form. The instruction is reviewed and released only once it has been returned to Klarwerk under “Capture” and released there by an authorised person.",
        bausteineImDokument: "Building blocks from Klarwerk in the document: {n}. Their review status is in each source line and applies to the block only, not to the whole instruction.",
        keineVorlage: "The document contains no instruction template (headings Purpose, Prerequisites, Steps). Use “Insert instruction template” first.",
        laeuft: "One moment …",
        vorlageEingefuegt: "Template inserted. Replace the hints in square brackets with your text.",
        bausteinEingefuegt: "Inserted: “{titel}”, version {version} – with source line.",
        nurGeprueft: "Only reviewed, non-confidential knowledge can be inserted as a building block – nothing inserted.",
        standGeaendert: "The building block has just changed – nothing inserted. Please choose again.",
        keineAuswahl: "Please choose a building block first.",
        keinWord: "Word did not respond – nothing changed.",
        verschoben: "The document has changed since the check. Please check again.",
        fehler: "That did not work. Please try again.",
        anmeldung: "Please sign in again.",
        recht: "You do not have permission for this."
      },
      nl: {
        vorlage: "Instructiesjabloon invoegen",
        pruefen: "Volledigheid controleren",
        erklaerung: "Verplicht: Doel, Voorwaarden, Werkstappen. Optioneel: Waarschuwingen. De aanwijzingen tussen vierkante haken zeggen wat in de sectie hoort; vervang ze bij het invullen.",
        bausteinWahl: "Bouwsteen kiezen …",
        bausteinEinfuegen: "Bouwsteen invoegen",
        bausteinGrenze: "Alleen gecontroleerde, niet-vertrouwelijke kennis is te kiezen. Invoegen gebeurt bij de cursor, met herkomst en versie.",
        bausteinOption: "{titel} · versie {version}",
        bausteinKeine: "Geen gecontroleerde kennis beschikbaar.",
        bausteinBedingung: "Geldt als: {liste}",
        herkunft: "Bouwsteen uit Klarwerk: ‘{titel}’ · versie {version} · controlestatus {status} · betrouwbaarheid {trust} · kenmerk {id}",
        herkunftPflicht: " · geldigheid: {geltung} · verantwoordelijke rol: {rolle} · verantwoordelijk: {verantwortung} · versie van {fassung} · laatste controle: {pruefung}",
        nichtBelegt: "niet aangetoond",
        u_rolle_fehlt: "verantwoordelijke rol niet benoemd",
        u_pruefnachweis_fremde_fassung: "controlebewijs betreft een eerdere versie",
        u_pruefnachweis_ungueltig: "controlebewijs doorstaat de auditcontrole niet",
        art_betriebsmitteilung: "Personeelsmededeling",
        fadenTitel: "Wat bent u van plan?",
        vorhabenPlatzhalter: "bijv. „Ik moet een personeelsmededeling over vakantiedagen schrijven – wat hebben we daarover?“",
        recherche: "Wat hebben we daarover?",
        fadenSie: "U: {text}",
        fadenAntwort: "Klara: {text}",
        fadenPunkte: "Klara: {n} vindplaats(en) in huis",
        fadenPunkt: "‘{titel}’ · versie {version} · stand {stand} · rijpheid: {reife} · betrouwbaarheid {trust}",
        reifeGeprueft: "gecontroleerd",
        reifeUngeprueft: "niet gecontroleerd ({status}) – blijft buiten het concept",
        fadenFehltAlles: "Wat ontbreekt: hierover is in huis geen gecontroleerde kennis.",
        fadenFehltTeil: "Wat ontbreekt: {n} vindplaats(en) zijn niet gecontroleerd en blijven buiten.",
        fadenFehltNichts: "Wat ontbreekt: niets zichtbaars – alle vindplaatsen zijn gecontroleerd.",
        fadenLeer: "Beschrijf eerst wat u van plan bent.",
        fadenKeineQuellen: "Het gesprek bevat nog geen gecontroleerd punt.",
        entwurf: "Concept maken uit deze punten",
        kiEntwurf: "Laat Klara het formuleren (AI-concept)",
        kiKennzeichnung: "AI-concept – geformuleerd door {wer}. Niet gecontroleerd: lezen, inkorten en verantwoorden vóór gebruik.",
        kiAnbieterUnbekannt: "een model (aanbieder niet genoemd door de server)",
        kiHerkunft: "Bron: ‘{titel}’ · versie {version} · controlestatus {stufe} · kenmerk {id}",
        kiAuftrag: "Formuleer een {textsorte} over: {vorhaben}. {form}",
        kiForm_betriebsmitteilung: "Vorm: onderwerp, aanhef aan het personeel, zakelijk-vriendelijke toon met u, aanleiding, geldende punten, wat te doen, contactpersoon, groet. Gebruik alleen uitspraken uit de opgegeven bronnen.",
        kiForm_allgemein: "Gebruik alleen uitspraken uit de opgegeven bronnen.",
        kiNichtMoeglich: "AI nu niet mogelijk: {grund}",
        kiNichtVerfuegbar: "De AI-weg is in dit venster niet beschikbaar – niets verzonden.",
        kiUnbrauchbar: "De server leverde geen AI-concept met herkomst – niets ingevoegd.",
        kiEingefuegt: "AI-concept ingevoegd – bovenaan gemarkeerd, met herkomst per bron.",
        herkunftUnsicherheiten: " · open onzekerheden: {liste}",
        validiertVon: " (gevalideerd door {liste})",
        nichtAngegeben: "niet opgegeven",
        nichtBenannt: "niet benoemd",
        nichtFestgehalten: "niet vastgelegd",
        u_niedriger_trust: "lage betrouwbaarheid",
        u_geltung_fehlt: "geldigheid niet opgegeven",
        u_verantwortung_fehlt: "verantwoordelijkheid niet benoemd",
        u_pruefdatum_fehlt: "geen controlebewijs – datum van laatste controle niet aangetoond",
        erzeugenTitel: "Document maken uit gecontroleerde kennis",
        art: "Documentsoort",
        art_instruction: "Werkinstructie / procedure",
        art_checklist: "Checklist",
        art_troubleshooting: "Storingsgids",
        art_training: "Trainingsmateriaal",
        art_faq: "FAQ",
        art_management_summary: "Samenvatting voor het management",
        zielrolle: "Doelrol (bijv. ploegleider)",
        quellenWaehlen: "Bronnen kiezen",
        erzeugen: "Document maken en invoegen",
        erzeugenGrenze: "Alleen de gekozen gecontroleerde, niet-vertrouwelijke kennisobjecten worden gebruikt – met titel, doelrol en herkomst per bron. Het volledige resultaat wordt na de cursor ingevoegd.",
        keineQuellen: "Kies minstens één bron.",
        nurGeprueftQuelle: "Alleen gecontroleerde, niet-vertrouwelijke kennis kan als bron dienen – niets ingevoegd.",
        ohneRolle: "geen doelrol",
        dokumentEingefuegt: "Ingevoegd: ‘{titel}’ ({rolle}) uit {n} bron(nen) – met herkomst.",
        abschnitt_zweck: "Doel",
        abschnitt_voraussetzungen: "Voorwaarden",
        abschnitt_schritte: "Werkstappen",
        abschnitt_warnhinweise: "Waarschuwingen",
        vorlage_zweck: "[Verplicht: Waarvoor dient deze instructie, en voor wie geldt ze? Een of twee zinnen.]",
        vorlage_voraussetzungen: "[Verplicht: Wat moet vóór de eerste stap geregeld zijn – rechten, gereedschap, documenten? Is er niets, vul dan „Geen“ in.]",
        vorlage_schritte: "[Verplicht: Elke werkstap als eigen alinea, in de volgorde van uitvoering, bijv. „1. Installatie uitschakelen.“]",
        vorlage_warnhinweise: "[Optioneel: Gevaren en typische fouten die men vóór of tijdens de stappen moet kennen. Zijn er geen, verwijder dan deze sectie.]",
        rat_zweck: "Schrijf in een of twee zinnen waarvoor de instructie dient en voor wie ze geldt.",
        rat_voraussetzungen: "Noem wat vóór de eerste stap geregeld moet zijn. Is er niets, schrijf dan „Geen“.",
        rat_schritte: "Vul minstens één werkstap in – elk als eigen alinea, in de volgorde van uitvoering.",
        rat_warnhinweise: "Vul gevaren of typische fouten in – of verwijder de sectie met de aanwijzing als er geen zijn.",
        statusFehlt: "‘{name}’ (verplicht): sectie ontbreekt. Voeg de kop ‘{name}’ toe of voeg het sjabloon opnieuw in.",
        statusLeer: "‘{name}’ (verplicht): gegevens ontbreken. {rat}",
        statusOk: "‘{name}’ (verplicht): ingevuld.",
        statusOptionalVorlage: "‘{name}’ (optioneel): de sjabloonaanwijzing staat er nog. {rat}",
        statusOptionalOk: "‘{name}’ (optioneel): ingevuld.",
        statusOptionalFehlt: "‘{name}’ (optioneel): niet opgenomen – dat is toegestaan.",
        zumAbschnitt: "Naar sectie",
        formalJa: "Formeel volledig: ja – alle verplichte gegevens zijn ingevuld.",
        formalNein: "Formeel volledig: nee – {n} van {gesamt} verplichte gegevens ontbreken.",
        fachlich: "Inhoudelijk gecontroleerd of vrijgegeven: niet vastgesteld. Deze controle kijkt alleen naar de vorm. Inhoudelijk gecontroleerd en vrijgegeven is de instructie pas als ze onder „Vastleggen“ aan Klarwerk is teruggegeven en daar door een bevoegd persoon is vrijgegeven.",
        bausteineImDokument: "Bouwstenen uit Klarwerk in het document: {n}. Hun controlestatus staat in de herkomstregel en geldt alleen voor de bouwsteen, niet voor de hele instructie.",
        keineVorlage: "Het document bevat geen instructiesjabloon (koppen Doel, Voorwaarden, Werkstappen). Gebruik eerst „Instructiesjabloon invoegen“.",
        laeuft: "Een moment …",
        vorlageEingefuegt: "Sjabloon ingevoegd. Vervang de aanwijzingen tussen vierkante haken door je eigen tekst.",
        bausteinEingefuegt: "Ingevoegd: ‘{titel}’, versie {version} – met herkomstregel.",
        nurGeprueft: "Alleen gecontroleerde, niet-vertrouwelijke kennis kan als bouwsteen worden ingevoegd – niets ingevoegd.",
        standGeaendert: "De bouwsteen is net gewijzigd – niets ingevoegd. Kies opnieuw.",
        keineAuswahl: "Kies eerst een bouwsteen.",
        keinWord: "Word heeft niet gereageerd – niets gewijzigd.",
        verschoben: "Het document is sinds de controle gewijzigd. Controleer opnieuw.",
        fehler: "Dat lukte niet. Probeer het opnieuw.",
        anmeldung: "Meld je opnieuw aan.",
        recht: "Daarvoor heb je geen recht."
      }
    };

    // Die vier Abschnitte der Vorlage in ihrer Reihenfolge. `pflicht`: ohne eigenen Inhalt ist die
    // Anleitung formal unvollständig. Warnhinweise sind „gegebenenfalls" (Pedi 28.09.) — optional.
    var ANLEITUNG_ABSCHNITTE = [
      { schluessel: "zweck", pflicht: true },
      { schluessel: "voraussetzungen", pflicht: true },
      { schluessel: "schritte", pflicht: true },
      { schluessel: "warnhinweise", pflicht: false }
    ];
    // Dieselbe Erkennung einer Überschriften-Formatvorlage wie der Rückweg (`RW_UEBERSCHRIFT_RE`):
    // Word im Web meldet den Namen lokalisiert („Überschrift 2", „Heading 2", „Kop 2" …).
    var ANLEITUNG_UEBERSCHRIFT_RE = /^(?:heading|überschrift|kop|titre|titolo|título|encabezado)\s*([1-6])$/i;
    // Ein Vorlagenhinweis ist ein Absatz, der ganz in eckigen Klammern steht.
    var ANLEITUNG_HINWEIS_RE = /^\[[\s\S]*\]$/;
    // Fehlermeldungen der Output Factory, die „kein geprüftes, teilbares Wissen" bedeuten.
    var ANLEITUNG_NICHT_GEPRUEFT = ["NOT_VALIDATED", "CONFIDENTIAL", "UNKNOWN_KO"];
    // Die Dokumentarten der Output Factory (`OUTPUT_KINDS`, services/output/src/types.ts), in der
    // Reihenfolge von R-0732. Verfahrensanweisung = derselbe Renderer wie die Arbeitsanweisung (SOP).
    var ANLEITUNG_ARTEN = ["instruction", "checklist", "troubleshooting", "training", "faq", "management_summary", "betriebsmitteilung"];
    // Die Schrift, die der Text HINTER dem Cursor beim Teilen des Absatzes behält (Word.Font, 1.1).
    var ANLEITUNG_SCHRIFT = ["bold", "italic", "underline", "strikeThrough", "color", "highlightColor", "name", "size"];
    // Wie viele frühere Fragen `/api/ask` als Gesprächsfaden annimmt (GESPRAECHSFADEN_MAX_FRAGEN).
    var ANLEITUNG_FADEN_MAX = 3;

    var anleitungLage = "ruhe";     // ruhe | laden
    var anleitungMeldung = "";
    var anleitungWarn = false;
    var anleitungLauf = 0;
    var anleitungErgebnis = null;   // { sitzung, gefunden, abschnitte, fehlend, bausteine }
    var anleitungQuellen = null;    // null: noch nicht geladen
    var anleitungQuellenLaedt = false;
    var anleitungQuellenSitzung = null;
    var anleitungGewaehlt = {};     // Kennung → true: die Quellen des Erzeugungswegs (Häkchen)
    var anleitungFaden = [];        // [{ frage, antwort, punkte: [{ id, title, version, stand, status, trust, geprueft }] }]
    var anleitungFadenSitzung = null;

    function anleitungT(schluessel, werte) {
      var tabelle = ANLEITUNG_TEXTE[typeof lang === "string" && ANLEITUNG_TEXTE[lang] ? lang : "de"];
      var satz = tabelle[schluessel] || ANLEITUNG_TEXTE.de[schluessel] || schluessel;
      if (werte) {
        for (var name in werte) {
          if (Object.prototype.hasOwnProperty.call(werte, name)) {
            satz = satz.split("{" + name + "}").join(String(werte[name]));
          }
        }
      }
      return satz;
    }

    function anleitungSitzung() {
      return typeof bestandSitzung === "undefined" ? null : bestandSitzung;
    }

    /** Ist ein Word-Dokument nutzbar? Ohne das Fensterskript (Ladefehler) schlicht nein. */
    function anleitungOffice() {
      return typeof officeUsable === "function" && Boolean(officeUsable()) &&
        typeof Word !== "undefined" && Boolean(Word) && typeof Word.run === "function";
    }

    function anleitungSichtbar() {
      var angemeldet = typeof signedIn !== "undefined" && Boolean(signedIn);
      var ruhe = typeof bestandRuheSichtbar === "function" ? bestandRuheSichtbar() : false;
      return angemeldet && ruhe && anleitungOffice();
    }

    function anleitungKnoten(tag, klasse, text) {
      var el = document.createElement(tag);
      if (klasse) { el.className = klasse; }
      if (text !== undefined) { el.textContent = text; }
      return el;
    }

    function anleitungNorm(text) {
      return String(text || "")
        .replace(/[\u0000-\u001f ￼]/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^\s+|\s+$/g, "");
    }

    // ---- Das Markup ------------------------------------------------------------------------------

    /** Baut den Block EINMAL hinter `#begriffe-block` (sonst hinter `#bestand-block`). */
    function anleitungBlockBauen() {
      if (document.getElementById("anleitung-block")) { return true; }
      var anker = document.getElementById("begriffe-block") || document.getElementById("bestand-block");
      if (!anker || !anker.parentNode) { return false; }
      var block = anleitungKnoten("div", "hidden");
      block.id = "anleitung-block";
      var zeile = function (id) {
        var z = anleitungKnoten("div", "");
        z.id = id;
        z.style.display = "flex";
        z.style.gap = "6px";
        z.style.alignItems = "center";
        z.style.flexWrap = "wrap";
        return z;
      };
      var knopf = function (id) {
        var k = anleitungKnoten("button", "ghost");
        k.type = "button";
        k.id = id;
        return k;
      };
      var absatz = function (id, klasse) {
        var p = anleitungKnoten("p", klasse);
        p.id = id;
        return p;
      };
      var kopf = zeile("anleitung-kopf");
      kopf.appendChild(knopf("anleitung-vorlage-btn"));
      kopf.appendChild(knopf("anleitung-pruefen-btn"));
      block.appendChild(kopf);
      block.appendChild(absatz("anleitung-erklaerung", "muted"));
      var bausteinZeile = zeile("anleitung-baustein-zeile");
      var auswahl = anleitungKnoten("select", "");
      auswahl.id = "anleitung-baustein";
      bausteinZeile.appendChild(auswahl);
      bausteinZeile.appendChild(knopf("anleitung-baustein-btn"));
      block.appendChild(bausteinZeile);
      block.appendChild(absatz("anleitung-baustein-grenze", "muted"));
      // DER GESPRÄCHSFADEN (R-0349 / R-0426): Vorhaben → Recherche → Entwurf.
      var faden = anleitungKnoten("div", "");
      faden.id = "anleitung-faden-block";
      faden.appendChild(absatz("anleitung-faden-titel", ""));
      var vorhaben = anleitungKnoten("textarea", "");
      vorhaben.id = "anleitung-vorhaben";
      vorhaben.rows = 2;
      vorhaben.maxLength = 2000;
      faden.appendChild(vorhaben);
      var fadenKopf = zeile("anleitung-faden-kopf");
      fadenKopf.appendChild(knopf("anleitung-recherche-btn"));
      faden.appendChild(fadenKopf);
      var fadenListe = anleitungKnoten("ul", "");
      fadenListe.id = "anleitung-faden";
      fadenListe.setAttribute("aria-live", "polite");
      faden.appendChild(fadenListe);
      var fadenFuss = zeile("anleitung-faden-fuss");
      fadenFuss.appendChild(knopf("anleitung-entwurf-btn"));
      fadenFuss.appendChild(knopf("anleitung-ki-btn"));
      faden.appendChild(fadenFuss);
      block.appendChild(faden);
      // DER ERZEUGUNGSWEG (R-0288 / R-0414 / R-0732): Dokumentart, Zielrolle, Quellenwahl — das
      // vollständige Ergebnis der Output Factory kommt nach Word.
      var erzeugen = anleitungKnoten("div", "");
      erzeugen.id = "anleitung-erzeugen";
      erzeugen.appendChild(absatz("anleitung-erzeugen-titel", ""));
      var erzeugenZeile = zeile("anleitung-erzeugen-zeile");
      var art = anleitungKnoten("select", "");
      art.id = "anleitung-art";
      erzeugenZeile.appendChild(art);
      var rolle = anleitungKnoten("input", "");
      rolle.id = "anleitung-zielrolle";
      rolle.type = "text";
      rolle.maxLength = 80;
      erzeugenZeile.appendChild(rolle);
      erzeugenZeile.appendChild(knopf("anleitung-quellen-btn"));
      erzeugen.appendChild(erzeugenZeile);
      var quellenListe = anleitungKnoten("ul", "");
      quellenListe.id = "anleitung-quellen";
      erzeugen.appendChild(quellenListe);
      erzeugen.appendChild(knopf("anleitung-erzeugen-btn"));
      erzeugen.appendChild(absatz("anleitung-erzeugen-grenze", "muted"));
      block.appendChild(erzeugen);
      var stand = absatz("anleitung-stand", "muted");
      stand.setAttribute("aria-live", "polite");
      block.appendChild(stand);
      var ergebnis = anleitungKnoten("div", "hidden");
      ergebnis.id = "anleitung-ergebnis";
      ergebnis.setAttribute("aria-live", "polite");
      ergebnis.appendChild(absatz("anleitung-formal", ""));
      ergebnis.appendChild(absatz("anleitung-fachlich", "muted"));
      ergebnis.appendChild(absatz("anleitung-bausteine", "muted"));
      var liste = anleitungKnoten("ul", "");
      liste.id = "anleitung-liste";
      ergebnis.appendChild(liste);
      block.appendChild(ergebnis);
      anker.parentNode.insertBefore(block, anker.nextSibling);
      return true;
    }

    function anleitungAuswahlZeichnen(auswahl) {
      var gewaehlt = auswahl.value;
      while (auswahl.firstChild) { auswahl.removeChild(auswahl.firstChild); }
      var quellen = anleitungQuellen || [];
      var leer = anleitungKnoten("option", "", anleitungQuellen !== null && quellen.length === 0
        ? anleitungT("bausteinKeine")
        : anleitungT("bausteinWahl"));
      leer.value = "";
      auswahl.appendChild(leer);
      var kennungen = [];
      for (var i = 0; i < quellen.length; i += 1) {
        var o = anleitungKnoten("option", "", anleitungT("bausteinOption", { titel: quellen[i].title, version: quellen[i].version }));
        o.value = quellen[i].id;
        kennungen.push(quellen[i].id);
        auswahl.appendChild(o);
      }
      auswahl.value = kennungen.indexOf(gewaehlt) === -1 ? "" : gewaehlt;
      auswahl.setAttribute("aria-label", anleitungT("bausteinWahl"));
    }

    /** Dokumentart, Zielrolle und die Quellen mit Häkchen — die gewählten bleiben beim Neuzeichnen. */
    function anleitungErzeugenZeichnen(beschaeftigt) {
      var art = document.getElementById("anleitung-art");
      var gewaehlteArt = art.value || ANLEITUNG_ARTEN[0];
      while (art.firstChild) { art.removeChild(art.firstChild); }
      for (var a = 0; a < ANLEITUNG_ARTEN.length; a += 1) {
        var o = anleitungKnoten("option", "", anleitungT("art_" + ANLEITUNG_ARTEN[a]));
        o.value = ANLEITUNG_ARTEN[a];
        art.appendChild(o);
      }
      art.value = gewaehlteArt;
      art.setAttribute("aria-label", anleitungT("art"));
      var rolle = document.getElementById("anleitung-zielrolle");
      rolle.placeholder = anleitungT("zielrolle");
      rolle.setAttribute("aria-label", anleitungT("zielrolle"));
      document.getElementById("anleitung-erzeugen-titel").textContent = anleitungT("erzeugenTitel");
      document.getElementById("anleitung-erzeugen-grenze").textContent = anleitungT("erzeugenGrenze");
      var quellenKnopf = document.getElementById("anleitung-quellen-btn");
      var erzeugenKnopf = document.getElementById("anleitung-erzeugen-btn");
      quellenKnopf.textContent = anleitungT("quellenWaehlen");
      erzeugenKnopf.textContent = anleitungT("erzeugen");
      quellenKnopf.disabled = beschaeftigt;
      erzeugenKnopf.disabled = beschaeftigt;
      var liste = document.getElementById("anleitung-quellen");
      while (liste.firstChild) { liste.removeChild(liste.firstChild); }
      var quellen = anleitungQuellen || [];
      var bekannt = {};
      for (var i = 0; i < quellen.length; i += 1) {
        var q = quellen[i];
        bekannt[q.id] = true;
        var li = anleitungKnoten("li", "anleitung-quelle");
        var label = anleitungKnoten("label", "");
        var haken = anleitungKnoten("input", "");
        haken.type = "checkbox";
        haken.value = q.id;
        haken.checked = anleitungGewaehlt[q.id] === true;
        haken.addEventListener("change", function () { anleitungGewaehlt[this.value] = this.checked; });
        label.appendChild(haken);
        label.appendChild(document.createTextNode(" " + anleitungT("bausteinOption", { titel: q.title, version: q.version })));
        li.appendChild(label);
        liste.appendChild(li);
      }
      // Eine Wahl, die es in der Liste nicht mehr gibt, reist nicht still mit.
      for (var id in anleitungGewaehlt) {
        if (Object.prototype.hasOwnProperty.call(anleitungGewaehlt, id) && !bekannt[id]) { delete anleitungGewaehlt[id]; }
      }
    }

    function anleitungZeichnen() {
      var block = document.getElementById("anleitung-block");
      if (!block) { return; }
      // Was eine andere oder keine Sitzung gesehen hat, sieht diese nie.
      if (anleitungErgebnis && anleitungErgebnis.sitzung !== anleitungSitzung()) { anleitungErgebnis = null; }
      if (anleitungQuellenSitzung !== anleitungSitzung()) { anleitungQuellen = null; }
      block.className = anleitungSichtbar() ? "" : "hidden";
      var beschaeftigt = anleitungLage === "laden";
      var vorlage = document.getElementById("anleitung-vorlage-btn");
      var pruefen = document.getElementById("anleitung-pruefen-btn");
      var baustein = document.getElementById("anleitung-baustein-btn");
      vorlage.textContent = anleitungT("vorlage");
      pruefen.textContent = anleitungT("pruefen");
      baustein.textContent = anleitungT("bausteinEinfuegen");
      vorlage.disabled = beschaeftigt;
      pruefen.disabled = beschaeftigt;
      baustein.disabled = beschaeftigt;
      document.getElementById("anleitung-erklaerung").textContent = anleitungT("erklaerung");
      document.getElementById("anleitung-baustein-grenze").textContent = anleitungT("bausteinGrenze");
      anleitungAuswahlZeichnen(document.getElementById("anleitung-baustein"));
      anleitungErzeugenZeichnen(beschaeftigt);
      anleitungFadenZeichnen(beschaeftigt);
      var stand = document.getElementById("anleitung-stand");
      stand.textContent = beschaeftigt ? anleitungT("laeuft") : anleitungMeldung;
      stand.className = !beschaeftigt && anleitungWarn ? "warn" : "muted";
      anleitungErgebnisZeichnen();
    }

    function anleitungErgebnisZeichnen() {
      var kasten = document.getElementById("anleitung-ergebnis");
      var liste = document.getElementById("anleitung-liste");
      while (liste.firstChild) { liste.removeChild(liste.firstChild); }
      var e = anleitungErgebnis;
      if (!e || !e.gefunden) {
        kasten.className = "hidden";
        return;
      }
      kasten.className = "";
      var formal = document.getElementById("anleitung-formal");
      formal.textContent = e.fehlend === 0
        ? anleitungT("formalJa")
        : anleitungT("formalNein", { n: e.fehlend, gesamt: e.pflichtGesamt });
      formal.className = e.fehlend === 0 ? "" : "warn";
      // Immer da, auch bei „formal vollständig: ja" — die Form ist keine fachliche Prüfung.
      document.getElementById("anleitung-fachlich").textContent = anleitungT("fachlich");
      var bausteine = document.getElementById("anleitung-bausteine");
      bausteine.textContent = e.bausteine > 0 ? anleitungT("bausteineImDokument", { n: e.bausteine }) : "";
      bausteine.className = e.bausteine > 0 ? "muted" : "hidden";
      for (var i = 0; i < e.abschnitte.length; i += 1) {
        liste.appendChild(anleitungAbschnittZeile(e.abschnitte[i]));
      }
    }

    function anleitungStatusText(a) {
      var werte = { name: anleitungT("abschnitt_" + a.schluessel), rat: anleitungT("rat_" + a.schluessel) };
      if (a.pflicht) {
        if (a.zustand === "fehlt") { return anleitungT("statusFehlt", werte); }
        return a.zustand === "ok" ? anleitungT("statusOk", werte) : anleitungT("statusLeer", werte);
      }
      if (a.zustand === "fehlt") { return anleitungT("statusOptionalFehlt", werte); }
      return a.zustand === "ok" ? anleitungT("statusOptionalOk", werte) : anleitungT("statusOptionalVorlage", werte);
    }

    /** Je Abschnitt eine Zeile — der Hinweis steht AM Abschnitt, der Knopf springt in Word dorthin. */
    function anleitungAbschnittZeile(a) {
      var offen = a.zustand !== "ok" && !(a.zustand === "fehlt" && !a.pflicht);
      var li = anleitungKnoten("li", "anleitung-abschnitt" + (offen && a.pflicht ? " warn" : ""));
      li.setAttribute("data-abschnitt", a.schluessel);
      li.setAttribute("data-zustand", a.zustand);
      li.appendChild(anleitungKnoten("div", "", anleitungStatusText(a)));
      if (offen && a.ziel >= 0) {
        var springen = anleitungKnoten("button", "ghost anleitung-springen", anleitungT("zumAbschnitt"));
        springen.type = "button";
        springen.addEventListener("click", function () { anleitungZumAbschnitt(a); });
        li.appendChild(springen);
      }
      return li;
    }

    function anleitungMelden(text, warn) {
      anleitungMeldung = text || "";
      anleitungWarn = Boolean(warn);
    }

    // ---- Die Auswertung (rein, ohne Word) --------------------------------------------------------

    /** Welcher Abschnitt ist diese Überschrift? Erkannt wird sie in jeder Sprache des Fensters. */
    function anleitungAbschnittVon(text) {
      var norm = anleitungNorm(text).toLowerCase();
      if (norm.length === 0) { return null; }
      for (var i = 0; i < ANLEITUNG_ABSCHNITTE.length; i += 1) {
        var s = ANLEITUNG_ABSCHNITTE[i].schluessel;
        for (var code in ANLEITUNG_TEXTE) {
          if (Object.prototype.hasOwnProperty.call(ANLEITUNG_TEXTE, code) &&
              ANLEITUNG_TEXTE[code]["abschnitt_" + s].toLowerCase() === norm) {
            return s;
          }
        }
      }
      return null;
    }

    /** Eine Herkunftszeile eines Bausteins — in jeder Sprache an ihrem festen Anfang erkannt. */
    function anleitungIstHerkunft(text) {
      for (var code in ANLEITUNG_TEXTE) {
        if (Object.prototype.hasOwnProperty.call(ANLEITUNG_TEXTE, code)) {
          var vorlage = ANLEITUNG_TEXTE[code].herkunft;
          var anfang = vorlage.slice(0, vorlage.indexOf("{"));
          if (text.indexOf(anfang) === 0) { return true; }
        }
      }
      return false;
    }

    /**
     * Die Absätze `[{ text, stil }]` des Dokuments → je Abschnitt ein Zustand:
     *   fehlt    — keine Überschrift dieses Abschnitts im Dokument;
     *   vorlage  — darunter steht nur der Hinweis in eckigen Klammern;
     *   leer     — darunter steht nichts;
     *   ok       — darunter steht eigener Text.
     * Ein Abschnitt endet an der nächsten erkannten Abschnittsüberschrift oder an jeder anderen
     * Überschrift (Formatvorlage). `ziel` ist der Absatz, an den „Zum Abschnitt" springt: der erste
     * Absatz unter der Überschrift, sonst die Überschrift selbst.
     */
    function anleitungAuswerten(absaetze) {
      var funde = {};
      var aktuell = null;
      var bausteine = 0;
      var texte = [];
      for (var i = 0; i < absaetze.length; i += 1) {
        var text = anleitungNorm(absaetze[i].text);
        texte.push(text);
        if (anleitungIstHerkunft(text)) { bausteine += 1; }
        var s = anleitungAbschnittVon(text);
        if (s !== null && !funde[s]) {
          aktuell = { index: i, inhalt: 0, hinweis: 0, erster: -1 };
          funde[s] = aktuell;
          continue;
        }
        if (s !== null || ANLEITUNG_UEBERSCHRIFT_RE.test(anleitungNorm(absaetze[i].stil))) {
          aktuell = null;
          continue;
        }
        if (!aktuell || text.length === 0) { continue; }
        if (aktuell.erster < 0) { aktuell.erster = i; }
        if (ANLEITUNG_HINWEIS_RE.test(text)) { aktuell.hinweis += 1; } else { aktuell.inhalt += 1; }
      }
      var ergebnis = { gefunden: false, abschnitte: [], fehlend: 0, pflichtGesamt: 0, bausteine: bausteine };
      for (var j = 0; j < ANLEITUNG_ABSCHNITTE.length; j += 1) {
        var def = ANLEITUNG_ABSCHNITTE[j];
        var f = funde[def.schluessel];
        var zustand = !f ? "fehlt" : f.inhalt > 0 ? "ok" : f.hinweis > 0 ? "vorlage" : "leer";
        var ziel = !f ? -1 : f.erster >= 0 ? f.erster : f.index;
        if (f) { ergebnis.gefunden = true; }
        if (def.pflicht) {
          ergebnis.pflichtGesamt += 1;
          if (zustand !== "ok") { ergebnis.fehlend += 1; }
        }
        ergebnis.abschnitte.push({
          schluessel: def.schluessel,
          pflicht: def.pflicht,
          zustand: zustand,
          ziel: ziel,
          zielText: ziel >= 0 ? texte[ziel] : ""
        });
      }
      return ergebnis;
    }

    // ---- Word ------------------------------------------------------------------------------------

    /** Die Absätze des ganzen Dokuments mit Formatvorlage — frisch bei jedem Klick. */
    function anleitungAbsaetzeLesen(done) {
      if (!anleitungOffice()) { done(null); return; }
      Word.run(function (context) {
        var absaetze = context.document.body.paragraphs;
        absaetze.load("items/text,items/style");
        return context.sync().then(function () {
          var raus = [];
          for (var i = 0; i < absaetze.items.length; i += 1) {
            raus.push({ text: String(absaetze.items[i].text || ""), stil: String(absaetze.items[i].style || "") });
          }
          done(raus);
        });
      }).catch(function () { done(null); });
    }

    /** Formatvorlagen über `styleBuiltIn` (WordApi 1.3, sprachunabhängig) — sonst bleibt der Absatz, wie Word ihn anlegt. */
    function anleitungStileMoeglich() {
      try {
        return Boolean(Office && Office.context && Office.context.requirements &&
          Office.context.requirements.isSetSupported("WordApi", "1.3"));
      } catch (err) {
        return false;
      }
    }

    /**
     * Setzt die Zeilen `[{ text, ueberschrift }]` AN DIE CURSORPOSITION (R-0414/R-0426, Nacharbeit 5).
     *
     * Steht der Cursor (bzw. das Ende der Markierung) am Absatzende, kommen die Zeilen als eigene
     * Absätze direkt dahinter — derselbe Weg wie das Einfügen eines Bildes. Steht er MITTEN im
     * Absatz, wird der Absatz dort geteilt: der Text vor dem Cursor bleibt stehen, die Zeilen folgen,
     * und der Text hinter dem Cursor steht danach als eigener Absatz — mit der Formatvorlage des
     * Absatzes und der Schrift, die Word für ihn meldet (gemischte Werte meldet Word als `null`;
     * die bleiben ungesetzt). Nichts wird überschrieben. Das Teilen braucht `Range.getRange`/
     * `expandTo` (WordApi 1.3); meldet der Host 1.3 nicht, bleibt es beim Einfügen hinter dem Absatz.
     * `done(true|false)`.
     */
    function anleitungEinfuegen(zeilen, done) {
      if (!anleitungOffice()) { done(false); return; }
      var stile = anleitungStileMoeglich();
      Word.run(function (context) {
        var auswahl = context.document.getSelection();
        var absaetze = auswahl.paragraphs;
        absaetze.load("items");
        var setzen = function (nach) {
          var letzter = nach;
          for (var i = 0; i < zeilen.length; i += 1) {
            letzter = letzter.insertParagraph(zeilen[i].text, "After");
            // Ausdrücklich setzen: ein neuer Absatz hinter einer Überschrift erbte sonst deren Vorlage.
            // `ueberschrift`: true = Stufe 2 (Vorlage), eine Zahl 1–3 = diese Stufe (erzeugtes Dokument).
            var stufe = zeilen[i].ueberschrift === true ? 2 : typeof zeilen[i].ueberschrift === "number" ? zeilen[i].ueberschrift : 0;
            if (stile) { letzter.styleBuiltIn = stufe > 0 ? "Heading" + stufe : "Normal"; }
          }
          return letzter;
        };
        return context.sync().then(function () {
          var items = absaetze.items || [];
          if (items.length === 0) { throw new Error("keine Einfuegestelle"); }
          var absatz = items[items.length - 1];
          if (!stile) {
            setzen(absatz);
            return context.sync();
          }
          // Der Text vom Cursor bis zum Absatzende — er muss HINTER die eingefügten Zeilen.
          var rest = auswahl.getRange("End").expandTo(absatz.getRange("End"));
          rest.load("text");
          rest.font.load(ANLEITUNG_SCHRIFT.join(","));
          absatz.load("style");
          return context.sync().then(function () {
            var restText = String(rest.text || "").replace(/[\r\n]+$/, "");
            if (restText.length === 0) {
              setzen(absatz);
              return context.sync();
            }
            var schrift = {};
            for (var s = 0; s < ANLEITUNG_SCHRIFT.length; s += 1) {
              var wert = rest.font[ANLEITUNG_SCHRIFT[s]];
              if (wert !== null && wert !== undefined) { schrift[ANLEITUNG_SCHRIFT[s]] = wert; }
            }
            var stil = absatz.style;
            rest.delete();
            var nachher = setzen(absatz).insertParagraph(restText, "After");
            if (stil) { nachher.style = stil; }
            for (var name in schrift) {
              if (Object.prototype.hasOwnProperty.call(schrift, name)) { nachher.font[name] = schrift[name]; }
            }
            return context.sync();
          });
        });
      }).then(function () { done(true); }, function () { done(false); });
    }

    function anleitungVorlageZeilen() {
      var zeilen = [];
      for (var i = 0; i < ANLEITUNG_ABSCHNITTE.length; i += 1) {
        var s = ANLEITUNG_ABSCHNITTE[i].schluessel;
        zeilen.push({ text: anleitungT("abschnitt_" + s), ueberschrift: true });
        zeilen.push({ text: anleitungT("vorlage_" + s), ueberschrift: false });
      }
      return zeilen;
    }

    function anleitungVorlageEinfuegen() {
      if (anleitungLage === "laden") { return; }
      anleitungLage = "laden";
      anleitungZeichnen();
      anleitungEinfuegen(anleitungVorlageZeilen(), function (ok) {
        anleitungLage = "ruhe";
        // Das Dokument hat sich geändert — ein früheres Prüfergebnis gilt nicht mehr.
        anleitungErgebnis = null;
        anleitungMelden(anleitungT(ok ? "vorlageEingefuegt" : "keinWord"), !ok);
        anleitungZeichnen();
      });
    }

    function anleitungPruefen() {
      if (anleitungLage === "laden") { return; }
      anleitungLauf += 1;
      var lauf = anleitungLauf;
      var sitzung = anleitungSitzung();
      anleitungLage = "laden";
      anleitungZeichnen();
      anleitungAbsaetzeLesen(function (absaetze) {
        if (lauf !== anleitungLauf) { return; }
        anleitungLage = "ruhe";
        if (!absaetze) {
          anleitungErgebnis = null;
          anleitungMelden(anleitungT("keinWord"), true);
        } else {
          anleitungErgebnis = anleitungAuswerten(absaetze);
          anleitungErgebnis.sitzung = sitzung;
          anleitungMelden(anleitungErgebnis.gefunden ? "" : anleitungT("keineVorlage"), !anleitungErgebnis.gefunden);
        }
        anleitungZeichnen();
      });
    }

    /** Springt in Word an den Abschnitt — nur, wenn dort noch derselbe Absatz steht wie bei der Prüfung. */
    function anleitungZumAbschnitt(a) {
      if (!anleitungOffice()) { return; }
      var ergebnis = "keinWord";
      Word.run(function (context) {
        var absaetze = context.document.body.paragraphs;
        absaetze.load("items/text");
        return context.sync().then(function () {
          var ziel = absaetze.items[a.ziel];
          if (!ziel || anleitungNorm(ziel.text) !== a.zielText) {
            ergebnis = "verschoben";
            return null;
          }
          ziel.select();
          return context.sync().then(function () { ergebnis = ""; });
        });
      }).then(function () {
        anleitungMelden(ergebnis ? anleitungT(ergebnis) : "", Boolean(ergebnis));
        anleitungZeichnen();
      }, function () {
        anleitungMelden(anleitungT("keinWord"), true);
        anleitungZeichnen();
      });
    }

    // ---- Bausteine aus geprüftem Wissen ----------------------------------------------------------

    /**
     * Die wählbaren Bausteine — erst auf Bedienung geholt (Auswahl angefasst); das Fenster ruft ohne
     * Zutun des Nutzers nichts zusätzlich ab. Die Liste ist die der Output Factory: nur validiert,
     * nichts Vertrauliches (`OutputService.listEligible`).
     */
    function anleitungQuellenLaden() {
      if (anleitungQuellen !== null || anleitungQuellenLaedt || !anleitungSichtbar()) { return; }
      anleitungQuellenLaedt = true;
      var sitzung = anleitungSitzung();
      var fertig = function (liste, meldung) {
        anleitungQuellenLaedt = false;
        if (sitzung !== anleitungSitzung()) { return; }
        anleitungQuellen = liste;
        anleitungQuellenSitzung = liste === null ? null : sitzung;
        if (meldung) { anleitungMelden(meldung, true); }
        anleitungZeichnen();
      };
      fetch("/api/output/sources", { credentials: "include" })
        .then(function (res) {
          if (!res || !res.ok) {
            var status = res && typeof res.status === "number" ? res.status : 0;
            if (status === 401 && typeof checkSession === "function") { checkSession(); }
            fertig(null, anleitungT(status === 401 ? "anmeldung" : status === 403 ? "recht" : "fehler"));
            return null;
          }
          return res.json().then(function (koerper) {
            var roh = Array.isArray(koerper) ? koerper : [];
            var liste = [];
            for (var i = 0; i < roh.length; i += 1) {
              var q = roh[i];
              if (q && typeof q.id === "string" && typeof q.title === "string" && typeof q.version === "number") {
                liste.push({ id: q.id, title: q.title, version: q.version });
              }
            }
            fertig(liste, "");
          });
        })
        .catch(function () { fertig(null, anleitungT("fehler")); });
    }

    function anleitungFehlerAus(res) {
      var status = res && typeof res.status === "number" ? res.status : 0;
      if (status === 401) {
        if (typeof checkSession === "function") { checkSession(); }
        return Promise.resolve("anmeldung");
      }
      if (status === 403) { return Promise.resolve("recht"); }
      var lesen = res && typeof res.json === "function" ? res.json() : Promise.resolve(null);
      return lesen.then(function (koerper) {
        var code = koerper && (koerper.error || koerper.code);
        return ANLEITUNG_NICHT_GEPRUEFT.indexOf(code) !== -1 || status === 404 ? "nurGeprueft" : "fehler";
      }, function () { return "fehler"; });
    }

    /** Die Zeilen eines Bausteins: Aussage, Bedingungen, Maßnahmen, zuletzt die Herkunftszeile. */
    function anleitungBausteinZeilen(ko, herkunft) {
      var zeilen = [{ text: String(ko.statement || ko.title || ""), ueberschrift: false }];
      var bedingungen = Array.isArray(ko.conditions) ? ko.conditions : [];
      if (bedingungen.length > 0) {
        zeilen.push({ text: anleitungT("bausteinBedingung", { liste: bedingungen.join("; ") }), ueberschrift: false });
      }
      var massnahmen = Array.isArray(ko.measures) ? ko.measures : [];
      for (var i = 0; i < massnahmen.length; i += 1) {
        zeilen.push({ text: (i + 1) + ". " + massnahmen[i], ueberschrift: false });
      }
      zeilen.push({ text: anleitungHerkunftZeile(herkunft), ueberschrift: false });
      return zeilen;
    }

    /**
     * R-0337 / R-1739: die Herkunftszeile eines Bausteins — Titel, Fassung, Prüfstand, Vertrauenswert,
     * Kennung, Gültigkeitsbereich, Verantwortung, Fassungsdatum, letzte Prüfung und die offenen
     * Unsicherheiten, alles aus der Herkunft der Output Factory (`toProvenance`). Was dort fehlt,
     * steht als „nicht angegeben/benannt/festgehalten" da — nichts wird ergänzt.
     */
    function anleitungHerkunftZeile(h) {
      var zeile = anleitungT("herkunft", {
        titel: h.title,
        version: h.version,
        status: h.status,
        trust: h.trust,
        id: h.koId
      });
      var validiert = Array.isArray(h.validiertVon) && h.validiertVon.length > 0
        ? anleitungT("validiertVon", { liste: h.validiertVon.join(", ") })
        : "";
      zeile += anleitungT("herkunftPflicht", {
        geltung: h.geltungsbereich ? h.geltungsbereich : anleitungT("nichtAngegeben"),
        rolle: h.verantwortlicheRolle ? h.verantwortlicheRolle : anleitungT("nichtBenannt"),
        verantwortung: h.verantwortlich ? h.verantwortlich : anleitungT("nichtBenannt"),
        fassung: h.fassungVom ? String(h.fassungVom).slice(0, 10) : anleitungT("nichtFestgehalten"),
        pruefung: (h.letztePruefungAm ? String(h.letztePruefungAm).slice(0, 10) : anleitungT("nichtBelegt")) + validiert
      });
      var offen = Array.isArray(h.unsicherheiten) ? h.unsicherheiten : [];
      if (offen.length > 0) {
        var texte = [];
        for (var i = 0; i < offen.length; i += 1) { texte.push(anleitungT("u_" + offen[i])); }
        zeile += anleitungT("herkunftUnsicherheiten", { liste: texte.join("; ") });
      }
      return zeile;
    }

    /** Inline-Auszeichnung des Factory-Markdowns zu Klartext (Fett, Code, ganzzeilig kursiv). */
    function anleitungMarkdownText(text) {
      return String(text)
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/^_(.+)_$/, "$1")
        .replace(/^\s+|\s+$/g, "");
    }

    /**
     * Das VOLLSTÄNDIGE Ergebnis der Output Factory als Word-Absätze: jede nichtleere Zeile wird ein
     * Absatz, `#`–`###` werden Überschriften der Stufe 1–3, Listen bleiben als „•"/„☐"/„1." lesbar.
     * Der Herkunftsblock und der Prüfhinweis gehören zum Ergebnis und kommen mit.
     */
    function anleitungMarkdownZeilen(markdown) {
      var roh = String(markdown || "").split("\n");
      var zeilen = [];
      for (var i = 0; i < roh.length; i += 1) {
        var z = roh[i];
        if (!/\S/.test(z)) { continue; }
        var kopf = /^(#{1,6})\s+(.*)$/.exec(z);
        if (kopf) {
          zeilen.push({ text: anleitungMarkdownText(kopf[2]), ueberschrift: Math.min(kopf[1].length, 3) });
          continue;
        }
        var haken = /^\s*- \[ \] (.*)$/.exec(z);
        if (haken) {
          zeilen.push({ text: "☐ " + anleitungMarkdownText(haken[1]), ueberschrift: false });
          continue;
        }
        var punkt = /^\s*- (.*)$/.exec(z);
        zeilen.push({ text: punkt ? "• " + anleitungMarkdownText(punkt[1]) : anleitungMarkdownText(z), ueberschrift: false });
      }
      return zeilen;
    }

    /**
     * R-0288 / R-0414 / R-0732: aus den gewählten geprüften Quellen erzeugt die Output Factory das
     * Dokument der gewählten Art mit Titel und Zielrolle; das GANZE Ergebnis kommt hinter den Cursor.
     * Welche Quelle zulässig ist, entscheidet der Server (nur validiert, nichts Vertrauliches).
     */
    function anleitungDokumentErzeugen() {
      if (anleitungLage === "laden") { return; }
      var ids = [];
      var quellen = anleitungQuellen || [];
      for (var i = 0; i < quellen.length; i += 1) {
        if (anleitungGewaehlt[quellen[i].id] === true) { ids.push(quellen[i].id); }
      }
      if (ids.length === 0) {
        anleitungMelden(anleitungT("keineQuellen"), true);
        anleitungZeichnen();
        return;
      }
      anleitungErzeugenMit(ids, null);
    }

    /** Laufklammer: Lage „laden", und eine `ende`-Funktion, die nur für DIESEN Lauf meldet. */
    function anleitungLaufStarten() {
      anleitungLauf += 1;
      var lauf = anleitungLauf;
      anleitungLage = "laden";
      anleitungZeichnen();
      return function (schluessel, werte, warn) {
        if (lauf !== anleitungLauf) { return; }
        anleitungLage = "ruhe";
        anleitungMelden(anleitungT(schluessel, werte), warn);
        anleitungZeichnen();
      };
    }

    /**
     * Erzeugt mit der Output Factory ein Dokument der gewählten Art aus `ids` und fügt sein
     * vollständiges Ergebnis an der Cursorposition ein. `anlass` (das Vorhaben aus dem
     * Gesprächsfaden) wird Betreff/Anlass einer Betriebsmitteilung.
     */
    function anleitungErzeugenMit(ids, anlass) {
      var art = document.getElementById("anleitung-art").value || ANLEITUNG_ARTEN[0];
      var rolle = anleitungNorm(document.getElementById("anleitung-zielrolle").value);
      var ende = anleitungLaufStarten();
      fetch("/api/output/generate", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: art, koIds: ids, audienceRole: rolle || null, anlass: anlass || null })
      }).then(function (res) {
        if (!res || !res.ok) {
          return anleitungFehlerAus(res).then(function (s) {
            ende(s === "nurGeprueft" ? "nurGeprueftQuelle" : s, null, true);
            return null;
          });
        }
        return res.json().then(function (dokument) {
          if (!dokument || typeof dokument.markdown !== "string" || !Array.isArray(dokument.provenance) ||
              dokument.provenance.length !== ids.length) {
            ende("fehler", null, true);
            return null;
          }
          anleitungEinfuegen(anleitungMarkdownZeilen(dokument.markdown), function (ok) {
            if (!ok) { ende("keinWord", null, true); return; }
            anleitungErgebnis = null;
            ende("dokumentEingefuegt", {
              titel: dokument.title,
              rolle: dokument.audienceRole ? dokument.audienceRole : anleitungT("ohneRolle"),
              n: ids.length
            }, false);
          });
          return null;
        });
      }).catch(function () { ende("fehler", null, true); });
    }

    function anleitungBausteinEinfuegen() {
      if (anleitungLage === "laden") { return; }
      var auswahl = document.getElementById("anleitung-baustein");
      var id = auswahl ? auswahl.value : "";
      if (!id) {
        anleitungMelden(anleitungT("keineAuswahl"), true);
        anleitungZeichnen();
        return;
      }
      anleitungLauf += 1;
      var lauf = anleitungLauf;
      anleitungLage = "laden";
      anleitungZeichnen();
      var ende = function (schluessel, werte, warn) {
        if (lauf !== anleitungLauf) { return; }
        anleitungLage = "ruhe";
        anleitungMelden(anleitungT(schluessel, werte), warn);
        anleitungZeichnen();
      };
      var herkunft = null;
      // 1. Die Output Factory ist das Tor: sie weist Ungeprüftes und Vertrauliches serverseitig ab
      //    und liefert die Herkunft. Ihr Markdown wird hier nicht gebraucht.
      fetch("/api/output/generate", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "instruction", koIds: [id] })
      }).then(function (res) {
        if (!res || !res.ok) { return anleitungFehlerAus(res).then(function (s) { ende(s, null, true); return null; }); }
        return res.json().then(function (dokument) {
          var p = dokument && Array.isArray(dokument.provenance) ? dokument.provenance[0] : null;
          if (!p || p.koId !== id || p.status !== "validiert" || typeof p.version !== "number") {
            ende("nurGeprueft", null, true);
            return null;
          }
          herkunft = p;
          // 2. Der Inhalt — und er muss DIESELBE Fassung sein, die die Herkunft nennt.
          return fetch("/api/kos/" + encodeURIComponent(id), { credentials: "include" }).then(function (antwort) {
            if (!antwort || !antwort.ok) { return anleitungFehlerAus(antwort).then(function (s) { ende(s, null, true); return null; }); }
            return antwort.json().then(function (ko) {
              if (!ko || ko.version !== herkunft.version || ko.status !== "validiert") {
                ende("standGeaendert", null, true);
                return null;
              }
              anleitungEinfuegen(anleitungBausteinZeilen(ko, herkunft), function (ok) {
                if (ok) { anleitungErgebnis = null; }
                if (ok) {
                  ende("bausteinEingefuegt", { titel: herkunft.title, version: herkunft.version }, false);
                } else {
                  ende("keinWord", null, true);
                }
              });
              return null;
            });
          });
        });
      }).catch(function () { ende("fehler", null, true); });
    }

    // ==========================================================================================
    // R-0349 / R-0426 (Nacharbeit 5) — DER GESPRÄCHSFADEN: VORHABEN → RECHERCHE → ENTWURF.
    // ==========================================================================================
    //
    // Der Mensch sagt in Alltagssprache, was er vorhat. Klara recherchiert über den BESTEHENDEN
    // Fragenweg (`POST /api/ask`, Konsolenzweig mit Gesprächsfaden `thread`, R-0348 — nur die
    // getippten Fragen reisen, kein Dokumenttext), legt die Fundstellen mit Fassung, Stand und
    // Reifegrad vor und sagt, was fehlt. Nachfragen tragen die früheren Fragen mit. Auf Zuruf
    // entsteht daraus der Entwurf:
    //   · „Entwurf aus diesen Punkten" — die Output Factory, regelbasiert, ohne Modell; das Vorhaben
    //     wird Betreff/Anlass (Betriebsmitteilung), jede Passage trägt ihre Quellenmarke;
    //   · „Mit Klara ausformulieren (KI-Entwurf)" — der BESTEHENDE Zuruf-Weg (KA6,
    //     `POST /api/klara/sessions/{id}/zuruf`) über die Sitzungsfunktionen des Fensters
    //     (`ka6Lage`, `klaraS4AbrufDieserSitzung`); ohne Einwilligung geht nichts hinaus, und der
    //     eingefügte Text ist oben als KI-Entwurf gekennzeichnet, mit Herkunft je Quelle.
    // Nur GEPRÜFTE Fundstellen gehen in einen Entwurf; die übrigen stehen als „was fehlt" da.

    /** Stand einer Fundstelle: der jüngste History-Eintrag, sonst `createdAt`. */
    function anleitungStandVon(ko) {
      var stand = null;
      var eintraege = ko && Array.isArray(ko.history) ? ko.history : [];
      for (var i = 0; i < eintraege.length; i += 1) {
        if (eintraege[i] && typeof eintraege[i].at === "string") { stand = eintraege[i].at; }
      }
      if (!stand && ko && typeof ko.createdAt === "string") { stand = ko.createdAt; }
      return stand ? String(stand).slice(0, 10) : anleitungT("nichtFestgehalten");
    }

    /** Die geprüften Kennungen aller Fundstellen des Fadens, ohne Doppelte, in Fundreihenfolge. */
    function anleitungFadenIds() {
      var ids = [];
      for (var i = 0; i < anleitungFaden.length; i += 1) {
        var punkte = anleitungFaden[i].punkte;
        for (var j = 0; j < punkte.length; j += 1) {
          if (punkte[j].geprueft && ids.indexOf(punkte[j].id) === -1) { ids.push(punkte[j].id); }
        }
      }
      return ids;
    }

    function anleitungFadenZeichnen(beschaeftigt) {
      document.getElementById("anleitung-faden-titel").textContent = anleitungT("fadenTitel");
      var feld = document.getElementById("anleitung-vorhaben");
      feld.placeholder = anleitungT("vorhabenPlatzhalter");
      feld.setAttribute("aria-label", anleitungT("fadenTitel"));
      var knoepfe = [["anleitung-recherche-btn", "recherche"], ["anleitung-entwurf-btn", "entwurf"], ["anleitung-ki-btn", "kiEntwurf"]];
      for (var k = 0; k < knoepfe.length; k += 1) {
        var knopf = document.getElementById(knoepfe[k][0]);
        knopf.textContent = anleitungT(knoepfe[k][1]);
        knopf.disabled = beschaeftigt;
      }
      if (anleitungFadenSitzung !== anleitungSitzung()) { anleitungFaden = []; }
      var liste = document.getElementById("anleitung-faden");
      while (liste.firstChild) { liste.removeChild(liste.firstChild); }
      for (var i = 0; i < anleitungFaden.length; i += 1) {
        var e = anleitungFaden[i];
        liste.appendChild(anleitungKnoten("li", "anleitung-faden-sie", anleitungT("fadenSie", { text: e.frage })));
        if (e.antwort) {
          liste.appendChild(anleitungKnoten("li", "anleitung-faden-klara", anleitungT("fadenAntwort", { text: e.antwort })));
        }
        liste.appendChild(anleitungKnoten("li", "anleitung-faden-klara", anleitungT("fadenPunkte", { n: e.punkte.length })));
        var ungeprueft = 0;
        for (var j = 0; j < e.punkte.length; j += 1) {
          var p = e.punkte[j];
          if (!p.geprueft) { ungeprueft += 1; }
          var li = anleitungKnoten("li", "anleitung-faden-punkt", anleitungT("fadenPunkt", {
            titel: p.title,
            version: p.version,
            stand: p.stand,
            reife: p.geprueft ? anleitungT("reifeGeprueft") : anleitungT("reifeUngeprueft", { status: p.status }),
            trust: p.trust
          }));
          li.setAttribute("data-id", p.id);
          li.setAttribute("data-geprueft", p.geprueft ? "ja" : "nein");
          liste.appendChild(li);
        }
        var fehlt = e.punkte.length - ungeprueft === 0
          ? anleitungT("fadenFehltAlles")
          : ungeprueft > 0 ? anleitungT("fadenFehltTeil", { n: ungeprueft }) : anleitungT("fadenFehltNichts");
        liste.appendChild(anleitungKnoten("li", "anleitung-faden-fehlt", fehlt));
      }
    }

    function anleitungRecherche() {
      if (anleitungLage === "laden") { return; }
      var feld = document.getElementById("anleitung-vorhaben");
      var frage = anleitungNorm(feld.value);
      if (!frage) {
        anleitungMelden(anleitungT("fadenLeer"), true);
        anleitungZeichnen();
        return;
      }
      var vorher = [];
      for (var i = 0; i < anleitungFaden.length; i += 1) { vorher.push(anleitungFaden[i].frage); }
      vorher = vorher.slice(-ANLEITUNG_FADEN_MAX);
      var sitzung = anleitungSitzung();
      var ende = anleitungLaufStarten();
      fetch("/api/ask", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: frage,
          questionSource: "manual",
          thread: vorher,
          locale: typeof lang === "string" ? lang : "de"
        })
      }).then(function (res) {
        if (!res || !res.ok) {
          return anleitungFehlerAus(res).then(function (s) { ende(s === "nurGeprueft" ? "fehler" : s, null, true); return null; });
        }
        return res.json().then(function (koerper) {
          var r = koerper && koerper.result ? koerper.result : koerper || {};
          var roh = Array.isArray(r.sources) ? r.sources : [];
          var ids = [];
          for (var s = 0; s < roh.length; s += 1) {
            if (typeof roh[s] === "string" && ids.indexOf(roh[s]) === -1) { ids.push(roh[s]); }
          }
          return Promise.all(ids.map(function (id) {
            return fetch("/api/kos/" + encodeURIComponent(id), { credentials: "include" }).then(function (a) {
              return a && a.ok ? a.json() : null;
            }, function () { return null; });
          })).then(function (kos) {
            if (sitzung !== anleitungSitzung()) { ende("", null, false); return; }
            var punkte = [];
            for (var k = 0; k < kos.length; k += 1) {
              var ko = kos[k];
              if (!ko || typeof ko.id !== "string") { continue; }
              var vertraulich = ko.confidentiality === "vertraulich" || ko.confidentiality === "streng_vertraulich";
              punkte.push({
                id: ko.id,
                title: String(ko.title || ko.id),
                version: typeof ko.version === "number" ? ko.version : "?",
                stand: anleitungStandVon(ko),
                status: String(ko.status || "?"),
                trust: typeof ko.trust === "number" ? ko.trust : "?",
                geprueft: ko.status === "validiert" && !vertraulich
              });
            }
            anleitungFaden.push({
              frage: frage,
              antwort: r.answered === true && typeof r.answer === "string" ? r.answer : null,
              punkte: punkte
            });
            anleitungFadenSitzung = sitzung;
            feld.value = "";
            ende("", null, false);
          });
        });
      }).catch(function () { ende("fehler", null, true); });
    }

    /** „Entwurf aus diesen Punkten" — die Output Factory mit den geprüften Fundstellen des Fadens. */
    function anleitungFadenEntwurf() {
      if (anleitungLage === "laden") { return; }
      var ids = anleitungFadenIds();
      if (ids.length === 0) {
        anleitungMelden(anleitungT("fadenKeineQuellen"), true);
        anleitungZeichnen();
        return;
      }
      anleitungErzeugenMit(ids, anleitungFaden[0].frage);
    }

    /** Der KI-Entwurf als Word-Absätze: Kennzeichnung zuerst, dann Text, dann Herkunft je Quelle. */
    function anleitungKiZeilen(body) {
      if (!body || typeof body.entwurf !== "string" || !/\S/.test(body.entwurf)) { return null; }
      if (!Array.isArray(body.herkunft) || body.herkunft.length === 0) { return null; }
      var wer = typeof body.anbieter === "string" && body.anbieter
        ? body.anbieter + (typeof body.modell === "string" && body.modell ? " (" + body.modell + ")" : "")
        : anleitungT("kiAnbieterUnbekannt");
      var zeilen = [{ text: anleitungT("kiKennzeichnung", { wer: wer }), ueberschrift: false }];
      var teile = body.entwurf.split(/\r?\n/);
      for (var i = 0; i < teile.length; i += 1) {
        var z = anleitungNorm(teile[i]);
        if (z) { zeilen.push({ text: z, ueberschrift: false }); }
      }
      for (var j = 0; j < body.herkunft.length; j += 1) {
        var h = body.herkunft[j];
        if (!h || typeof h.koId !== "string" || typeof h.titel !== "string") { return null; }
        zeilen.push({
          text: anleitungT("kiHerkunft", {
            titel: h.titel,
            version: typeof h.version === "number" ? h.version : "?",
            stufe: typeof h.stufe === "string" ? h.stufe : "?",
            id: h.koId
          }),
          ueberschrift: false
        });
      }
      return zeilen;
    }

    /** „Mit Klara ausformulieren" — der bestehende Zuruf-Weg (KA6), nur mit Einwilligung. */
    function anleitungKiEntwurf() {
      if (anleitungLage === "laden") { return; }
      var ids = anleitungFadenIds();
      if (ids.length === 0) {
        anleitungMelden(anleitungT("fadenKeineQuellen"), true);
        anleitungZeichnen();
        return;
      }
      if (typeof ka6Lage !== "function" || typeof klaraS4AbrufDieserSitzung !== "function") {
        anleitungMelden(anleitungT("kiNichtVerfuegbar"), true);
        anleitungZeichnen();
        return;
      }
      var lage = ka6Lage();
      var sitzungId = typeof klaraS4SessionId === "undefined" ? null : klaraS4SessionId;
      if (!lage || lage.erlaubt !== true || !sitzungId) {
        var grund = typeof ka6GrundText === "function" ? ka6GrundText(lage ? lage.grundKey : null) : "";
        anleitungMelden(anleitungT("kiNichtMoeglich", { grund: grund }), true);
        anleitungZeichnen();
        return;
      }
      var art = document.getElementById("anleitung-art").value || ANLEITUNG_ARTEN[0];
      var auftrag = anleitungT("kiAuftrag", {
        textsorte: anleitungT("art_" + art),
        vorhaben: anleitungFaden[0].frage,
        form: anleitungT(art === "betriebsmitteilung" ? "kiForm_betriebsmitteilung" : "kiForm_allgemein")
      });
      var ende = anleitungLaufStarten();
      klaraS4AbrufDieserSitzung(
        "/api/klara/sessions/" + encodeURIComponent(sitzungId) + "/zuruf",
        "POST",
        { art: "erstellen", text: auftrag, koIds: ids }
      ).then(function (body) {
        var zeilen = anleitungKiZeilen(body);
        if (!zeilen) { ende("kiUnbrauchbar", null, true); return; }
        anleitungEinfuegen(zeilen, function (ok) {
          if (!ok) { ende("keinWord", null, true); return; }
          anleitungErgebnis = null;
          ende("kiEingefuegt", null, false);
        });
      }, function (err) {
        var treffer = /^HTTP (\d{3})$/.exec(err && err.message ? err.message : "");
        var status = treffer ? Number(treffer[1]) : 0;
        if (status === 403) {
          var nein = typeof ka6GrundText === "function" ? ka6GrundText("s4ReasonExternalConsentMissing") : "";
          ende("kiNichtMoeglich", { grund: nein }, true);
        } else {
          ende(status === 401 ? "anmeldung" : "fehler", null, true);
        }
      });
    }

    function anleitungAnschliessen() {
      if (!anleitungBlockBauen()) { return; }
      document.getElementById("anleitung-vorlage-btn").addEventListener("click", anleitungVorlageEinfuegen);
      document.getElementById("anleitung-pruefen-btn").addEventListener("click", anleitungPruefen);
      document.getElementById("anleitung-baustein-btn").addEventListener("click", anleitungBausteinEinfuegen);
      document.getElementById("anleitung-baustein").addEventListener("focus", anleitungQuellenLaden);
      document.getElementById("anleitung-baustein").addEventListener("mousedown", anleitungQuellenLaden);
      document.getElementById("anleitung-quellen-btn").addEventListener("click", anleitungQuellenLaden);
      document.getElementById("anleitung-erzeugen-btn").addEventListener("click", anleitungDokumentErzeugen);
      document.getElementById("anleitung-recherche-btn").addEventListener("click", anleitungRecherche);
      document.getElementById("anleitung-entwurf-btn").addEventListener("click", anleitungFadenEntwurf);
      document.getElementById("anleitung-ki-btn").addEventListener("click", anleitungKiEntwurf);
      // Jede Lage, in der das Fenster den Bestandsblock neu zeichnet (Sitzung, Office-Erkennung,
      // Flächenwechsel), gilt auch für diesen Block — derselbe Anschluss wie KW-BEGRIFFE.
      if (typeof bestandZeichnen === "function") {
        var anleitungBestandZeichnen = bestandZeichnen;
        bestandZeichnen = function () {
          anleitungBestandZeichnen.apply(this, arguments);
          anleitungZeichnen();
        };
      }
      if (typeof setLang === "function") {
        var anleitungSetLang = setLang;
        setLang = function () {
          anleitungSetLang.apply(this, arguments);
          anleitungZeichnen();
        };
      }
      anleitungZeichnen();
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", anleitungAnschliessen);
    } else {
      anleitungAnschliessen();
    }
    // KW-ANLEITUNG-END
