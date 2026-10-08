// ================================================================================================
// VERÖFFENTLICHUNG · die Texte der Veröffentlichung mit Benachrichtigungswahl.
// ================================================================================================
//
// „Veröffentlicht" heisst hier INTERN für berechtigte Leser, nicht öffentlich im Internet. Die Texte
// halten Sichtbarkeit, fachliche Freigabe und Meldungswirkung auseinander und erklären jede Wahl
// (still, normal, hervorgehoben) mit Zustand, Sichtbarkeit und Empfängern, BEVOR geklickt wird.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "veroeffentlichung.",
  legacySchluessel: [],
  de: {
    "veroeffentlichung.titel": "Veröffentlichung",
    "veroeffentlichung.hinweis":
      "Veröffentlicht heißt hier: intern für alle, die diesen Eintrag lesen dürfen — nicht öffentlich im Internet. Wer lesen darf und ob die Fassung fachlich freigegeben ist, ändert das Veröffentlichen nicht; du wählst nur, wie gemeldet wird.",
    "veroeffentlichung.stand.nie": "Noch nicht veröffentlicht.",
    "veroeffentlichung.stand.veroeffentlicht":
      "Veröffentlicht: Fassung V{{fassung}} am {{datum}} von {{name}}.",
    "veroeffentlichung.stand.aktuellVeroeffentlicht":
      "Die aktuelle Fassung V{{aktuell}} ist die veröffentlichte.",
    "veroeffentlichung.stand.aktuellEntwurf":
      "Die aktuelle Fassung V{{aktuell}} ist noch nicht gültig (Entwurf oder in Prüfung) und nicht veröffentlicht.",
    "veroeffentlichung.stand.aktuellGueltig":
      "Die aktuelle Fassung V{{aktuell}} ist gültig, aber noch nicht veröffentlicht.",
    "veroeffentlichung.wahl.titel": "Benachrichtigung",
    "veroeffentlichung.wahl.still": "Still",
    "veroeffentlichung.wahl.normal": "Normal",
    "veroeffentlichung.wahl.hervorgehoben": "Hervorgehoben",
    "veroeffentlichung.art.neu": "neue Veröffentlichung",
    "veroeffentlichung.art.aktualisierung": "Aktualisierung",
    "veroeffentlichung.wirkung.titel": "Was danach gilt",
    "veroeffentlichung.wirkung.zustand":
      "Zustand: Fassung V{{fassung}} ist danach veröffentlicht ({{art}}). Spätere Überarbeitungen bleiben Entwurf, bis sie geprüft und erneut veröffentlicht sind.",
    "veroeffentlichung.wirkung.sichtbarkeit":
      "Sichtbarkeit: unverändert — lesen dürfen genau {{anzahl}} Person(en) (Stufe: {{stufe}}). Das Veröffentlichen gibt niemandem Zugriff.",
    "veroeffentlichung.wirkung.space":
      "Der Eintrag gehört einem Space; lesen darf nur, wer Zugang zu diesem Space hat.",
    "veroeffentlichung.wirkung.still":
      "Benachrichtigung: niemand. Der Eintrag bleibt für Berechtigte auffindbar, und die Veröffentlichung steht im Verlauf.",
    "veroeffentlichung.wirkung.normal":
      "Benachrichtigung: {{anzahl}} Person(en) bekommen eine Meldung in der Glocke — {{namen}}.",
    "veroeffentlichung.wirkung.hervorgehoben":
      "Benachrichtigung: dieselben {{anzahl}} Person(en) wie bei „Normal“ — {{namen}}. Die Meldung ist als wichtig markiert und steht oben, bis sie gelesen ist. Niemand bekommt dadurch zusätzliche Leserechte.",
    "veroeffentlichung.wirkung.niemandSonst":
      "Benachrichtigung: niemand — außer dir darf niemand diesen Eintrag lesen.",
    "veroeffentlichung.kenntnisnahme.offen":
      "{{anzahl}} angeforderte Kenntnisnahme(n) dieser Fassung sind offen. Sie bleiben bestehen und werden weiter gemeldet — auch bei „Still“.",
    "veroeffentlichung.kenntnisnahme.ueberholt":
      "{{anzahl}} Kenntnisnahme(n) einer früheren Fassung sind durch diese Fassung überholt und werden nicht mehr gemeldet. Fordere sie für V{{fassung}} neu an, wenn sie gelten sollen.",
    "veroeffentlichung.absenden": "Fassung V{{fassung}} veröffentlichen ({{wahl}})",
    "veroeffentlichung.laeuft": "Wird veröffentlicht …",
    "veroeffentlichung.erfolg":
      "Fassung V{{fassung}} ist veröffentlicht. Benachrichtigt: {{anzahl}} Person(en).",
    "veroeffentlichung.verlauf.titel": "Verlauf",
    "veroeffentlichung.verlauf.zeile":
      "Fassung V{{fassung}} · {{art}} · {{wahl}} · {{name}} am {{datum}} · {{anzahl}} benachrichtigt",
    "veroeffentlichung.fehler.keine_gueltige_fassung":
      "Nur eine gültige (geprüfte) Fassung kann veröffentlicht werden. Ein Entwurf wird nicht veröffentlicht.",
    "veroeffentlichung.fehler.bereits_veroeffentlicht": "Diese Fassung ist bereits veröffentlicht.",
    "veroeffentlichung.fehler.fassung_veraltet":
      "Der Eintrag hat sich inzwischen geändert. Bitte neu laden.",
    "veroeffentlichung.fehler.allgemein": "Das hat nicht geklappt. Bitte erneut versuchen.",
    "veroeffentlichung.stufe.intern": "intern",
    "veroeffentlichung.stufe.vertraulich": "vertraulich",
    "veroeffentlichung.stufe.streng_vertraulich": "streng vertraulich",
    "veroeffentlichung.stufe.unbekannt": "nicht eingestuft",
    "veroeffentlichung.meldungNeu": "Neu veröffentlicht",
    "veroeffentlichung.meldungAktualisierung": "Aktualisiert",
    "veroeffentlichung.meldungWichtig": "Wichtig",
    "veroeffentlichung.meldungArt": "Veröffentlichung",
  },
  en: {
    "veroeffentlichung.titel": "Publication",
    "veroeffentlichung.hinweis":
      "Published here means: internally for everyone allowed to read this entry — not public on the internet. Publishing changes neither who may read it nor whether the version is approved; you only choose how people are notified.",
    "veroeffentlichung.stand.nie": "Not published yet.",
    "veroeffentlichung.stand.veroeffentlicht":
      "Published: version V{{fassung}} on {{datum}} by {{name}}.",
    "veroeffentlichung.stand.aktuellVeroeffentlicht":
      "The current version V{{aktuell}} is the published one.",
    "veroeffentlichung.stand.aktuellEntwurf":
      "The current version V{{aktuell}} is not valid yet (draft or in review) and not published.",
    "veroeffentlichung.stand.aktuellGueltig":
      "The current version V{{aktuell}} is valid but not published yet.",
    "veroeffentlichung.wahl.titel": "Notification",
    "veroeffentlichung.wahl.still": "Silent",
    "veroeffentlichung.wahl.normal": "Normal",
    "veroeffentlichung.wahl.hervorgehoben": "Highlighted",
    "veroeffentlichung.art.neu": "new publication",
    "veroeffentlichung.art.aktualisierung": "update",
    "veroeffentlichung.wirkung.titel": "What applies afterwards",
    "veroeffentlichung.wirkung.zustand":
      "State: version V{{fassung}} is published afterwards ({{art}}). Later revisions stay drafts until they are reviewed and published again.",
    "veroeffentlichung.wirkung.sichtbarkeit":
      "Visibility: unchanged — exactly {{anzahl}} person(s) may read it (level: {{stufe}}). Publishing grants nobody access.",
    "veroeffentlichung.wirkung.space":
      "The entry belongs to a space; only people with access to that space may read it.",
    "veroeffentlichung.wirkung.still":
      "Notification: nobody. The entry stays findable for authorised readers, and the publication is recorded in the history.",
    "veroeffentlichung.wirkung.normal":
      "Notification: {{anzahl}} person(s) get a message in the bell — {{namen}}.",
    "veroeffentlichung.wirkung.hervorgehoben":
      "Notification: the same {{anzahl}} person(s) as with “Normal” — {{namen}}. The message is marked as important and stays on top until it is read. Nobody gains additional read access.",
    "veroeffentlichung.wirkung.niemandSonst":
      "Notification: nobody — no one but you may read this entry.",
    "veroeffentlichung.kenntnisnahme.offen":
      "{{anzahl}} requested acknowledgement(s) of this version are open. They remain and keep being notified — also with “Silent”.",
    "veroeffentlichung.kenntnisnahme.ueberholt":
      "{{anzahl}} acknowledgement(s) of an earlier version are superseded by this version and no longer notified. Request them again for V{{fassung}} if they should apply.",
    "veroeffentlichung.absenden": "Publish version V{{fassung}} ({{wahl}})",
    "veroeffentlichung.laeuft": "Publishing …",
    "veroeffentlichung.erfolg":
      "Version V{{fassung}} is published. Notified: {{anzahl}} person(s).",
    "veroeffentlichung.verlauf.titel": "History",
    "veroeffentlichung.verlauf.zeile":
      "Version V{{fassung}} · {{art}} · {{wahl}} · {{name}} on {{datum}} · {{anzahl}} notified",
    "veroeffentlichung.fehler.keine_gueltige_fassung":
      "Only a valid (reviewed) version can be published. A draft is not published.",
    "veroeffentlichung.fehler.bereits_veroeffentlicht": "This version is already published.",
    "veroeffentlichung.fehler.fassung_veraltet":
      "The entry has changed in the meantime. Please reload.",
    "veroeffentlichung.fehler.allgemein": "That did not work. Please try again.",
    "veroeffentlichung.stufe.intern": "internal",
    "veroeffentlichung.stufe.vertraulich": "confidential",
    "veroeffentlichung.stufe.streng_vertraulich": "strictly confidential",
    "veroeffentlichung.stufe.unbekannt": "not classified",
    "veroeffentlichung.meldungNeu": "Newly published",
    "veroeffentlichung.meldungAktualisierung": "Updated",
    "veroeffentlichung.meldungWichtig": "Important",
    "veroeffentlichung.meldungArt": "Publication",
  },
  nl: {
    "veroeffentlichung.titel": "Publicatie",
    "veroeffentlichung.hinweis":
      "Gepubliceerd betekent hier: intern voor iedereen die dit item mag lezen — niet openbaar op internet. Publiceren verandert niet wie mag lezen en niet of de versie inhoudelijk is goedgekeurd; je kiest alleen hoe er gemeld wordt.",
    "veroeffentlichung.stand.nie": "Nog niet gepubliceerd.",
    "veroeffentlichung.stand.veroeffentlicht":
      "Gepubliceerd: versie V{{fassung}} op {{datum}} door {{name}}.",
    "veroeffentlichung.stand.aktuellVeroeffentlicht":
      "De huidige versie V{{aktuell}} is de gepubliceerde.",
    "veroeffentlichung.stand.aktuellEntwurf":
      "De huidige versie V{{aktuell}} is nog niet geldig (concept of in controle) en niet gepubliceerd.",
    "veroeffentlichung.stand.aktuellGueltig":
      "De huidige versie V{{aktuell}} is geldig, maar nog niet gepubliceerd.",
    "veroeffentlichung.wahl.titel": "Melding",
    "veroeffentlichung.wahl.still": "Stil",
    "veroeffentlichung.wahl.normal": "Normaal",
    "veroeffentlichung.wahl.hervorgehoben": "Uitgelicht",
    "veroeffentlichung.art.neu": "nieuwe publicatie",
    "veroeffentlichung.art.aktualisierung": "bijwerking",
    "veroeffentlichung.wirkung.titel": "Wat daarna geldt",
    "veroeffentlichung.wirkung.zustand":
      "Status: versie V{{fassung}} is daarna gepubliceerd ({{art}}). Latere bewerkingen blijven concept tot ze gecontroleerd en opnieuw gepubliceerd zijn.",
    "veroeffentlichung.wirkung.sichtbarkeit":
      "Zichtbaarheid: ongewijzigd — precies {{anzahl}} persoon/personen mogen lezen (niveau: {{stufe}}). Publiceren geeft niemand toegang.",
    "veroeffentlichung.wirkung.space":
      "Het item hoort bij een space; alleen wie toegang tot die space heeft, mag lezen.",
    "veroeffentlichung.wirkung.still":
      "Melding: niemand. Het item blijft vindbaar voor bevoegden, en de publicatie staat in de geschiedenis.",
    "veroeffentlichung.wirkung.normal":
      "Melding: {{anzahl}} persoon/personen krijgen een melding in de bel — {{namen}}.",
    "veroeffentlichung.wirkung.hervorgehoben":
      "Melding: dezelfde {{anzahl}} persoon/personen als bij „Normaal” — {{namen}}. De melding is als belangrijk gemarkeerd en staat bovenaan tot ze gelezen is. Niemand krijgt daardoor extra leesrechten.",
    "veroeffentlichung.wirkung.niemandSonst":
      "Melding: niemand — behalve jij mag niemand dit item lezen.",
    "veroeffentlichung.kenntnisnahme.offen":
      "{{anzahl}} gevraagde kennisname(s) van deze versie staan open. Ze blijven bestaan en worden verder gemeld — ook bij „Stil”.",
    "veroeffentlichung.kenntnisnahme.ueberholt":
      "{{anzahl}} kennisname(s) van een eerdere versie zijn door deze versie achterhaald en worden niet meer gemeld. Vraag ze opnieuw aan voor V{{fassung}} als ze moeten gelden.",
    "veroeffentlichung.absenden": "Versie V{{fassung}} publiceren ({{wahl}})",
    "veroeffentlichung.laeuft": "Wordt gepubliceerd …",
    "veroeffentlichung.erfolg":
      "Versie V{{fassung}} is gepubliceerd. Gemeld aan: {{anzahl}} persoon/personen.",
    "veroeffentlichung.verlauf.titel": "Geschiedenis",
    "veroeffentlichung.verlauf.zeile":
      "Versie V{{fassung}} · {{art}} · {{wahl}} · {{name}} op {{datum}} · {{anzahl}} gemeld",
    "veroeffentlichung.fehler.keine_gueltige_fassung":
      "Alleen een geldige (gecontroleerde) versie kan worden gepubliceerd. Een concept wordt niet gepubliceerd.",
    "veroeffentlichung.fehler.bereits_veroeffentlicht": "Deze versie is al gepubliceerd.",
    "veroeffentlichung.fehler.fassung_veraltet":
      "Het item is intussen gewijzigd. Laad de pagina opnieuw.",
    "veroeffentlichung.fehler.allgemein": "Dat is niet gelukt. Probeer het opnieuw.",
    "veroeffentlichung.stufe.intern": "intern",
    "veroeffentlichung.stufe.vertraulich": "vertrouwelijk",
    "veroeffentlichung.stufe.streng_vertraulich": "strikt vertrouwelijk",
    "veroeffentlichung.stufe.unbekannt": "niet ingedeeld",
    "veroeffentlichung.meldungNeu": "Nieuw gepubliceerd",
    "veroeffentlichung.meldungAktualisierung": "Bijgewerkt",
    "veroeffentlichung.meldungWichtig": "Belangrijk",
    "veroeffentlichung.meldungArt": "Publicatie",
  },
} satisfies Textmodul;
