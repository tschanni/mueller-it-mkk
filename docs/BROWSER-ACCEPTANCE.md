# Browser-Abnahme: zentrales Benutzermodell

Stand 16.10.2026. Diese Liste wurde erstellt, noch nicht manuell im Browser
abgenommen. Keine produktive Veröffentlichung erfolgt.

## Jetzt prüfbar

- [ ] Lokal mit `npm start` öffnen; Desktop und öffentliche Gameserver bleiben
  auch bei nicht erreichbarem Auth-Backend bedienbar.
- [ ] Registrierung enthält Benutzername, E-Mail, Passwort und Passwortbestätigung;
  keine separaten Namen oder Kontaktdaten. Hinweis auf mehrfach erlaubte Namen.
- [ ] Registrierung ist bis zum bestätigten Backend-Vertrag deaktiviert;
  auch Enter erzeugt keinen Registrierungsrequest.
- [ ] Login bietet ausschließlich E-Mail/Passwort und Discord an.
- [ ] Nach Anmeldung steht überall der Better-Auth-Wert `user.name`, auch wenn
  ein alter `username` abweicht. Keine Aufforderung zur Namensvervollständigung.
- [ ] Konto zeigt Benutzername und Benutzer-ID; kein Namenseditor vorhanden.
- [ ] Optionaler Kontaktbereich zeigt Vorname, Nachname, Straße, Hausnummer,
  Postleitzahl und Ort leer/deaktiviert; Speichern deaktiviert, Hinweis sichtbar.
- [ ] Erfolg, Warnung und Fehler erscheinen im klassischen 98.css-Fenster mit
  unterscheidbarem Symbol und Text. Keine Browser-Alerts, kein internes Fehlerdetail.
- [ ] Login-/Logout-Erfolge werden bestätigt. Fehlgeschlagener Logout erhält
  den Benutzerzustand; kein behaupteter Logout bei Transportfehlern.
- [ ] E-Mail-Bestätigung, erneute Verifikationsmail, Passwort-Reset und Discord-
  Abbruch besitzen verständliche Hinweise; ungültiger Link bietet erneuten Login.
- [ ] Tabulator, Enter, OK, Fenster schließen/minimieren/wiederherstellen funktionieren;
  bei 320px Breite und 200% Zoom sind Felder und Aktionen erreichbar.

## Session und Infrastruktur mit Test-Backend

- [ ] Chrome/Edge und Firefox, zusätzlich Safari/WebKit prüfen; Browser/Version,
  Frontend-Commit, Backend-Commit, Test-Origin und Ergebnis protokollieren.
- [ ] Cookie-Session nach Reload, neuem Tab und Discord-Callback wiederhergestellt;
  kein flüchtiges Anzeigen angemeldeter Rechte vor erfolgreicher Prüfung.
- [ ] DevTools Offline einschalten, Fenster fokussieren: getrennte Netzfehlermeldung,
  bekannte Session bis zu ihrem Ablauf erhalten. Online + Fokus erneut: Wiederherstellung.
- [ ] Test-Proxy liefert 503, auch mit HTML-Body: Serverfehlermeldung und Session erhalten.
- [ ] Session-Prüfung liefert 401: Hinweis auf fehlende Anmeldung, Benutzerzustand
  entfernt, Login angeboten. `SESSION_EXPIRED`, 200 `null` nach Anmeldung und lokale
  Ablaufzeit beenden die Session mit Ablaufhinweis.
- [ ] Langsame/nie antwortende Session-Prüfung endet nach 10s, Schreibaktion nach 15s;
  Wiederholung möglich, keine doppelte Submission und keine verspätete Wiederanmeldung
  nach Logout.
- [ ] Produktionstest nur nach Freigabe: HTTPS, API-Cookie host-only/HttpOnly/Secure/
  SameSite=Lax, `credentials: include`, keine Tokens im Local-/SessionStorage.
- [ ] CORS mit konkreter Frontend-Origin, Allow-Credentials und korrektem OPTIONS;
  keine Wildcard, erlaubte Trusted Origins/Callbacks. Cookies werden bei Reload
  mitgesendet. Kein Cache für Auth-Antworten. Retry-After-Header lesbar.
- [ ] HTTP 403, 429 und unbekannte Fehler geben sichere, passende Hinweise;
  429 respektiert die Wartezeit. CORS-Fehler erscheinen als Transportfehler:
  Browser geben dem Frontend keinen zuverlässigen eigenen CORS-Fehlercode.

## Wartet auf Vertrag und Backend-Commit

Repository `tschanni/Gameserver_Dashboard`, Branch `main`, Vertragsdatei
`docs/AUTH_API_CONTRACT.md`. Erst nach Übergabe der aktualisierten Datei **und
Commit-ID** die tatsächlichen Requests implementieren und folgende Punkte prüfen:

- [ ] Zwei verschiedene E-Mails mit gleichem Benutzernamen erfolgreich registrieren;
  verschiedene stabile IDs; `user.name` korrekt und keine erzwungene Kleinschreibung.
- [ ] Registrierung enthält ausschließlich die vertraglich bestätigten Felder;
  E-Mail-Verifikation inklusive abgelaufener und erneut angeforderter Links.
- [ ] Kontakte vollständig leer, teilweise ausgefüllt und vollständig ausgefüllt
  speichern; nach Reload identisch. Vorhandene Werte wieder komplett löschen.
- [ ] Feldvalidierung gemäß bestätigtem Vertrag: Fehler direkt am betroffenen Feld,
  Eingaben erhalten, verständliche Meldung, keine falsche Erfolgsbestätigung.
- [ ] Erfolgreicher Kontakt-Save erscheint erst nach bestätigter Serverantwort.
  Doppelklick, Netzwerkabbruch, 401 und 5xx während Speichern korrekt behandeln.
- [ ] Benutzer A kann keine Kontakte von B lesen/ändern, auch mit manipulierten
  Requests; anonyme und abgelaufene Sessions abweisen. Serverseitige Tests erforderlich.
- [ ] Kontowechsel entfernt vorherige Kontakte/Entwürfe; verspätete Antworten für A
  überschreiben niemals das Profil von B. Name bleibt unveränderbar.

## Automatisierte Prüfung

`npx.cmd tsc --noEmit`, `npm.cmd test -- --watchAll=false --runInBand` und
`npm.cmd run build`. Unit-/Komponententests ersetzen keine Browser-Abnahme von
Cookies, CORS, OAuth, Mailzustellung und serverseitigem Profileigentum.

Lokale Ergebnisse am 16.10.2026: TypeScript erfolgreich, 4 Testsuites mit
90 erfolgreichen Tests, Produktionsbuild inklusive 5 statischer Auth-Einstiege
erfolgreich. Die Toolchain meldet veraltete Browserslist-Daten und eine
Node-punycode-Deprecation; keine fehlgeschlagenen Prüfungen.
