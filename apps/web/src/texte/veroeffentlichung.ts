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
    "veroeffentlichung.regel.titel": "Nach den Kommunikationsregeln:",
    "veroeffentlichung.regel.sofort": "{{anzahl}} Person(en) sofort in der Glocke",
    "veroeffentlichung.regel.zusammenfassung":
      "{{anzahl}} Person(en) in der täglichen Zusammenfassung (ab dem Folgetag)",
    "veroeffentlichung.regel.abgewaehlt":
      "{{anzahl}} Person(en) haben diese Meldung abgewählt und bekommen keine",
    "veroeffentlichung.regel.mail": "{{anzahl}} davon zusätzlich per Mail",
    "veroeffentlichung.regel.mailNichtEingerichtet": "Mail: nicht eingerichtet",
    "veroeffentlichung.regel.link": "Die Regeln stehen im Profil unter „Meldungen und Kanäle“.",
    "veroeffentlichung.zustellung.zeigen": "Zustellstatus",
    "veroeffentlichung.zustellung.verbergen": "Zustellstatus schließen",
    "veroeffentlichung.zustellung.laedt": "Zustellstatus wird geladen …",
    "veroeffentlichung.zustellung.glocke":
      "Glocke: {{angelegt}} angelegt · {{zugestellt}} zugestellt · {{gelesen}} gelesen",
    "veroeffentlichung.zustellung.mail":
      "Mail: {{angelegt}} angelegt · {{zugestellt}} vom Mailserver angenommen · {{fehlgeschlagen}} fehlgeschlagen · {{entfallen}} entfallen",
    "veroeffentlichung.zustellung.kenntnisnahme":
      "Kenntnisnahme dieser Fassung: {{bestaetigt}} bestätigt · {{offen}} offen",
    "veroeffentlichung.zustellung.belegt":
      "„Zugestellt“ heißt: soweit belegt — die Glocke hat die Meldung ausgeliefert bzw. der Mailserver hat die Mail angenommen.",
    "veroeffentlichung.zustellung.leer": "Niemand wurde benachrichtigt.",
    "veroeffentlichung.zustellung.nichtErfasst":
      "Für diese Veröffentlichung ist kein Zustellstatus erfasst (vor Einführung der Kommunikationsregeln).",
    "veroeffentlichung.zustellung.fortsetzen": "Versand fortsetzen",
    "veroeffentlichung.zustellung.person.glocke": "Glocke",
    "veroeffentlichung.zustellung.person.mail": "Mail",
    "veroeffentlichung.zustellung.person.kenntnisnahme": "Kenntnisnahme",
    "veroeffentlichung.zustellung.status.angelegt": "angelegt",
    "veroeffentlichung.zustellung.status.zugestellt": "zugestellt",
    "veroeffentlichung.zustellung.status.gelesen": "gelesen",
    "veroeffentlichung.zustellung.status.fehlgeschlagen": "fehlgeschlagen",
    "veroeffentlichung.zustellung.status.entfallen": "entfallen",
    "veroeffentlichung.zustellung.status.ausstehend": "offen",
    "veroeffentlichung.zustellung.status.bestaetigt": "bestätigt",
    "veroeffentlichung.zustellung.status.ueberfaellig": "überfällig",
    "veroeffentlichung.zustellung.status.ueberholt": "überholt",
    "veroeffentlichung.zustellung.hinweis.abgewaehlt": "abgewählt",
    "veroeffentlichung.zustellung.hinweis.zusammenfassung": "wartet auf die Zusammenfassung",
    "veroeffentlichung.zustellung.grund.kein_zugriff": "kein Zugriff mehr",
    "veroeffentlichung.zustellung.grund.abgewaehlt": "abgewählt",
    "veroeffentlichung.zustellung.grund.mailserver_abgelehnt": "Mailserver hat abgelehnt",
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
    "veroeffentlichung.regel.titel": "Under the communication rules:",
    "veroeffentlichung.regel.sofort": "{{anzahl}} person(s) immediately in the bell",
    "veroeffentlichung.regel.zusammenfassung":
      "{{anzahl}} person(s) in the daily summary (from the next day)",
    "veroeffentlichung.regel.abgewaehlt":
      "{{anzahl}} person(s) turned this notification off and receive none",
    "veroeffentlichung.regel.mail": "{{anzahl}} of them also by email",
    "veroeffentlichung.regel.mailNichtEingerichtet": "Email: not set up",
    "veroeffentlichung.regel.link":
      "The rules are in your profile under “Notifications and channels”.",
    "veroeffentlichung.zustellung.zeigen": "Delivery status",
    "veroeffentlichung.zustellung.verbergen": "Close delivery status",
    "veroeffentlichung.zustellung.laedt": "Loading delivery status …",
    "veroeffentlichung.zustellung.glocke":
      "Bell: {{angelegt}} created · {{zugestellt}} delivered · {{gelesen}} read",
    "veroeffentlichung.zustellung.mail":
      "Email: {{angelegt}} created · {{zugestellt}} accepted by the mail server · {{fehlgeschlagen}} failed · {{entfallen}} dropped",
    "veroeffentlichung.zustellung.kenntnisnahme":
      "Acknowledgement of this version: {{bestaetigt}} confirmed · {{offen}} open",
    "veroeffentlichung.zustellung.belegt":
      "“Delivered” means: as far as evidenced — the bell has delivered the notification or the mail server has accepted the email.",
    "veroeffentlichung.zustellung.leer": "Nobody was notified.",
    "veroeffentlichung.zustellung.nichtErfasst":
      "No delivery status was recorded for this publication (before the communication rules were introduced).",
    "veroeffentlichung.zustellung.fortsetzen": "Resume delivery",
    "veroeffentlichung.zustellung.person.glocke": "Bell",
    "veroeffentlichung.zustellung.person.mail": "Email",
    "veroeffentlichung.zustellung.person.kenntnisnahme": "Acknowledgement",
    "veroeffentlichung.zustellung.status.angelegt": "created",
    "veroeffentlichung.zustellung.status.zugestellt": "delivered",
    "veroeffentlichung.zustellung.status.gelesen": "read",
    "veroeffentlichung.zustellung.status.fehlgeschlagen": "failed",
    "veroeffentlichung.zustellung.status.entfallen": "dropped",
    "veroeffentlichung.zustellung.status.ausstehend": "open",
    "veroeffentlichung.zustellung.status.bestaetigt": "confirmed",
    "veroeffentlichung.zustellung.status.ueberfaellig": "overdue",
    "veroeffentlichung.zustellung.status.ueberholt": "superseded",
    "veroeffentlichung.zustellung.hinweis.abgewaehlt": "turned off",
    "veroeffentlichung.zustellung.hinweis.zusammenfassung": "waiting for the summary",
    "veroeffentlichung.zustellung.grund.kein_zugriff": "no longer has access",
    "veroeffentlichung.zustellung.grund.abgewaehlt": "turned off",
    "veroeffentlichung.zustellung.grund.mailserver_abgelehnt": "rejected by the mail server",
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
    "veroeffentlichung.regel.titel": "Volgens de communicatieregels:",
    "veroeffentlichung.regel.sofort": "{{anzahl}} persoon/personen direct in de bel",
    "veroeffentlichung.regel.zusammenfassung":
      "{{anzahl}} persoon/personen in de dagelijkse samenvatting (vanaf de volgende dag)",
    "veroeffentlichung.regel.abgewaehlt":
      "{{anzahl}} persoon/personen hebben deze melding uitgezet en krijgen er geen",
    "veroeffentlichung.regel.mail": "{{anzahl}} daarvan ook per e-mail",
    "veroeffentlichung.regel.mailNichtEingerichtet": "E-mail: niet ingericht",
    "veroeffentlichung.regel.link": "De regels staan in je profiel onder „Meldingen en kanalen”.",
    "veroeffentlichung.zustellung.zeigen": "Bezorgstatus",
    "veroeffentlichung.zustellung.verbergen": "Bezorgstatus sluiten",
    "veroeffentlichung.zustellung.laedt": "Bezorgstatus wordt geladen …",
    "veroeffentlichung.zustellung.glocke":
      "Bel: {{angelegt}} aangemaakt · {{zugestellt}} bezorgd · {{gelesen}} gelezen",
    "veroeffentlichung.zustellung.mail":
      "E-mail: {{angelegt}} aangemaakt · {{zugestellt}} door de mailserver aangenomen · {{fehlgeschlagen}} mislukt · {{entfallen}} vervallen",
    "veroeffentlichung.zustellung.kenntnisnahme":
      "Kennisname van deze versie: {{bestaetigt}} bevestigd · {{offen}} open",
    "veroeffentlichung.zustellung.belegt":
      "„Bezorgd” betekent: voor zover aangetoond — de bel heeft de melding afgeleverd of de mailserver heeft de e-mail aangenomen.",
    "veroeffentlichung.zustellung.leer": "Niemand is op de hoogte gebracht.",
    "veroeffentlichung.zustellung.nichtErfasst":
      "Voor deze publicatie is geen bezorgstatus vastgelegd (vóór de invoering van de communicatieregels).",
    "veroeffentlichung.zustellung.fortsetzen": "Verzending hervatten",
    "veroeffentlichung.zustellung.person.glocke": "Bel",
    "veroeffentlichung.zustellung.person.mail": "E-mail",
    "veroeffentlichung.zustellung.person.kenntnisnahme": "Kennisname",
    "veroeffentlichung.zustellung.status.angelegt": "aangemaakt",
    "veroeffentlichung.zustellung.status.zugestellt": "bezorgd",
    "veroeffentlichung.zustellung.status.gelesen": "gelezen",
    "veroeffentlichung.zustellung.status.fehlgeschlagen": "mislukt",
    "veroeffentlichung.zustellung.status.entfallen": "vervallen",
    "veroeffentlichung.zustellung.status.ausstehend": "open",
    "veroeffentlichung.zustellung.status.bestaetigt": "bevestigd",
    "veroeffentlichung.zustellung.status.ueberfaellig": "te laat",
    "veroeffentlichung.zustellung.status.ueberholt": "achterhaald",
    "veroeffentlichung.zustellung.hinweis.abgewaehlt": "uitgezet",
    "veroeffentlichung.zustellung.hinweis.zusammenfassung": "wacht op de samenvatting",
    "veroeffentlichung.zustellung.grund.kein_zugriff": "geen toegang meer",
    "veroeffentlichung.zustellung.grund.abgewaehlt": "uitgezet",
    "veroeffentlichung.zustellung.grund.mailserver_abgelehnt": "door de mailserver geweigerd",
  },
} satisfies Textmodul;
