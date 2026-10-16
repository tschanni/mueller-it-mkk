# Browser-Abnahme: zentrales Benutzermodell

Stand 16.10.2026. Backend-SHA:
`03030cce4409eec9a347998feeea71062affd5fb`.
Die Liste ist vorbereitet, noch nicht manuell im Browser abgenommen.
Keine produktive Veroeffentlichung erfolgt.

## Registrierung und Login

- [ ] Registrierung enthaelt nur Benutzername, E-Mail, Passwort und lokale
  Passwortbestaetigung. Kein separater Personenname oder Kontaktformular.
- [ ] Namen mit 1/64 Zeichen, Unicode und gemischter Schreibweise akzeptieren;
  leere Namen, Leer-/Steuerzeichen, spitze Klammern und 65 Zeichen ablehnen.
- [ ] Zwei verschiedene E-Mail-Adressen mit gleichem Namen registrieren;
  getrennte IDs, unveraenderte Schreibweise, kein Eindeutigkeitsfehler.
- [ ] Verifikationsmail oeffnen; danach Login erforderlich. Abgelaufene Links
  und erneute Mailanforderung pruefen. Registrierung erzeugt keine lokale Session.
- [ ] SMTP-Ausfall: kein falscher Registrierungserfolg, Hinweis auf bereits
  moeglicherweise angelegtes Konto und erneute Verifikationsmail.
- [ ] Login ausschliesslich mit E-Mail/Passwort oder Discord. Kein Username-Login.
- [ ] Discord-Anlage verwendet Username statt Anzeigename. Abbruch, ungueltiger
  State und unbestaetigte Provider-E-Mail geben passende Hinweise.
- [ ] Im Startmenue/Konto user.name anzeigen; Benutzer-ID sichtbar. Weder Name
  noch Profilbild editierbar. Explizites Discord-Linking bleibt nutzbar.

## Eigenes Kontaktprofil

- [ ] Vor Login keine Kontakte/Felder/Profilrequests, nach Logout sofort entfernt.
  Nicht verifizierte Konten erhalten einen Verifikationshinweis.
- [ ] GET /games/api/v1/me/profile liefert null: sechs leere, optionale Felder.
  Vollstaendig leeres Formular speichern: sechs null-Werte; Erfolgsanzeige erst
  nach 201-Antwort. Reload bestaetigt den Zustand.
- [ ] Vorname, Nachname, Strasse, Hausnummer, PLZ und Ort teilweise und vollstaendig
  speichern; nach Reload identisch. PLZ 01234 und internationale PLZ erhalten.
- [ ] Bereits gespeicherte Werte leeren und speichern: null loescht sie.
  Zusaetzliche bestehende countryCode/phone/contactEmail bleiben unberuehrt.
- [ ] Laengen und Zeichen gemaess DTO testen. Feldfehler sind am Feld lesbar,
  aria-invalid/aria-describedby gesetzt, Eingaben bleiben erhalten.
- [ ] Manipulierter Request mit ungueltigen Daten ergibt 400, allgemeiner
  Validierungshinweis ohne interne Details; kein behaupteter Erfolg.
- [ ] Fehlgeschlagenes Laden sperrt Bearbeiten/Speichern; erneut laden funktioniert.
  Fehlgeschlagenes Speichern durch Netzwerk, 403, 429 oder 503 erhaelt Entwurf
  und bekannte Session; Wiederholung nach Wartezeit funktioniert.
- [ ] Haengende GET-/POST-Anfragen enden nach 10/15 Sekunden. Kein Doppelspeichern.
  Bei verlorener Antwort gespeicherten Serverzustand separat nachpruefen.
- [ ] HTTP 401 und Sessionende entfernen Kontakte und bieten Login.
- [ ] Benutzer A kann B weder lesen noch aendern, auch bei manipulierten Requests.
  Im Browser niemals Admin-Profilpfade oder userId im Save-Body verwenden.
- [ ] Kontowechsel mit gleichem Namen: Entwurf von A entfernt, nur B sichtbar.
  Verzoegerte Lese-/Schreibantworten und 401 von A beeinflussen B nicht.

## Session und Infrastruktur

- [ ] Chrome/Edge, Firefox und Safari/WebKit; Browser-Version, Frontend-Commit,
  Backend-Commit, Origin und Ergebnis protokollieren.
- [ ] Reload, neuer Tab und Discord-Callback stellen Session per Cookie wieder her.
  Keine angemeldeten Rechte vor erfolgreicher Sessionpruefung anzeigen.
- [ ] Offline + Fokus: Netzfehlermeldung, gueltige Session erhalten. Online +
  erneuter Fokus stellt Serverpruefung wieder her. Kein automatischer Logout.
- [ ] 503 (auch HTML-Body) ist Serverfehler; 401 ist fehlende Anmeldung;
  SESSION_EXPIRED, 200 null nach Login und Ablaufzeit beenden die lokale Session.
- [ ] Logout erst nach Bestaetigung; bei Netzfehlern Benutzerzustand behalten.
  Verzoegerte Sessionantwort nach Logout meldet nicht erneut an.
- [ ] Backend-Image entspricht dem geprueften Commit, Migration gemaess Plan
  separat freigegeben/getestet; keine alte Username-API im Mischbetrieb.
- [ ] Proxy erlaubt GET/POST/OPTIONS fuer /games/api/v1/me/profile; keine
  pauschale API-Freigabe. Bestehende Auth-/REST-/SSE-Regeln bleiben funktionsfaehig.
- [ ] HTTPS fuer Frontend/API, konkrete CORS-Origin, Allow-Credentials, OPTIONS
  mit Content-Type; Trusted Origins und Discord-Callbacks stimmen exakt.
- [ ] API-Cookie host-only/HttpOnly/Secure/SameSite=Lax; credentials include,
  no-store, unveraendertes Set-Cookie auch bei Sessionerneuerung ueber Nest.
  Auth/Profile nicht cachen; Retry-After-Header cross-origin lesbar.
- [ ] Keine Tokens, Cookies oder private Kontakte in Local-/SessionStorage,
  Logs oder Fehlerdetails. Keine vollstaendigen Mail-/OAuth-URLs protokollieren.
- [ ] CORS-Verweigerung erscheint als Transportfehler: Browser liefern dem
  Frontend keinen verlaesslichen separaten CORS-Fehlercode.

## Oberflaeche und Regression

- [ ] 98.css-Fensterstil fuer Erfolg/Warnung/Fehler; Symbole und Texte lesbar;
  keine Browser-Alerts. Speichern zeigt eindeutigen Erfolg oder Fehler.
- [ ] Tastatur: Tab, Enter, OK, Fenstersteuerung; 320px Breite und 200% Zoom.
- [ ] Desktop, Taschenrechner und oeffentlicher Gameserver-Manager bleiben auch
  bei Auth-Ausfall nutzbar. Oeffentliche Requests bleiben credentials omit.

## Automatisierte Pruefung

TypeScript: `npx.cmd tsc --noEmit`.

Tests: `node node_modules/react-scripts/bin/react-scripts.js test --watchAll=false --runInBand`.

Build: `npm.cmd run build` einschliesslich statischer Callback-Einstiege.

Am 16.10.2026: 6 Testsuiten, 138 erfolgreiche Tests. Testdaten und HTTP-/Adapter-
Mocks; keine produktiven Registrierungen oder Profile geaendert. Browser-Cookies,
CORS, SMTP und echtes Discord-OAuth sind durch diese Tests nicht abgenommen.
TypeScript-Check und Produktionsbuild mit `CI=true` erfolgreich, einschliesslich
der 5 statischen Auth-Einstiege. Bestehende Toolchain-Hinweise: veraltete
Browserslist-Daten und Node-punycode-Deprecation; keine TypeScript-/ESLint-Fehler.
