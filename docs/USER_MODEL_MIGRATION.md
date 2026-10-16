# Benutzermodell und lokale Untersuchung – 16.10.2026

## Modell und Migration

`user.id` ist die Identität. `name` ist der verpflichtende, nicht eindeutige,
vorerst unveränderliche Benutzername. E-Mail und Passwort dienen zum Login;
Discord-Konten werden über Provider-ID und Account-ID zugeordnet. Kein
automatisches Linking über Namen oder gleiche E-Mail. Explizites Linking bleibt
auf angemeldete, verifizierte Benutzer mit passender E-Mail begrenzt.

Neue Vorwärtsmigration: `202610160001_user_contact_profile`. Keine historische
Migration wurde verändert. Sie übernimmt vorhandene `username`-Werte nach `name`,
ansonsten vorhandene Namen, bei leeren Werten `user-<id>`. Sie entfernt den
Username-Index und beide zusätzlichen Namensspalten und legt `UserProfile` an.
IDs, Rollen, Passworthashes, Sessions und OAuth-Accounts bleiben erhalten.
Der historische DB-Default für `name` bleibt aus Kompatibilitätsgründen bestehen;
die Registrierung erzwingt einen gültigen Namen. Direkte DB-Schreibzugriffe sind
keine unterstützte Registrierungsschnittstelle.

Bestehende Discord-only-Konten können bisherige Anzeigenamen enthalten. Die DB
enthält den tatsächlichen Discord-Username nicht zuverlässig. Vor einer Übernahme
solcher Konten muss ein autorisierter Abgleich anhand der Discord-Account-ID und
eines gültigen Providerprofils stattfinden; Namen niemals aus E-Mail-Adressen
oder Anzeigenamen erraten. Bei der bisherigen Strategie einer neuen leeren DB
entstehen alle Discord-Konten direkt mit richtigem Username. Lokale Konten mit
Discord-Verknüpfung behalten ihren lokalen Benutzernamen.

## Profilvertrag

Basis relativ zur API: `/api/v1`, mit produktivem Präfix `/games/api/v1`.

| Methode | Pfad                           | Zugriff                                | Antwort                                                 |
| ------- | ------------------------------ | -------------------------------------- | ------------------------------------------------------- |
| GET     | `/me/profile`                  | eigene verifizierte Session            | 200 `{ "profile": null }` oder `{ "profile": Profile }` |
| POST    | `/me/profile`                  | eigene Session und Trusted Origin      | 201 `Profile`                                           |
| GET     | `/admin/users/:userId/profile` | verifizierter ADMIN                    | 200 `{ "profile": Profile oder null }`                  |
| POST    | `/admin/users/:userId/profile` | verifizierter ADMIN und Trusted Origin | 201 `Profile`                                           |

POST aktualisiert nur mitgesendete Felder; `null` löscht sie. Alle Felder optional:
`firstName`, `lastName`, `city` bis 100 Zeichen, `street` bis 150,
`houseNumber`, `postalCode` bis 20; PLZ bleibt String. Freitext ohne Steuerzeichen
oder spitze Klammern. Hausnummer/PLZ erlauben internationale Buchstaben/Ziffern
und begrenzte Trennzeichen. `countryCode`: zwei Großbuchstaben (keine Prüfung
gegen Länderliste); `phone`: 3–32 Zeichen aus Ziffern und Telefon-Trennzeichen;
`contactEmail`: validierte E-Mail bis 254 Zeichen, unabhängig von der Login-Mail.
`Profile` enthält außerdem `userId` und `updatedAt`. Unbekannte Felder oder IDs
im Body: 400; fehlende Session: 401; fehlende Rechte/Origin: 403; unbekannte
Admin-Ziel-ID: 404. Profile werden weder in Session noch Benutzerlisten oder
öffentlichen Endpunkten ausgegeben. Profilantworten: `Cache-Control: no-store`.

## Befunde zu gemeldeten Störungen

Gesichert im lokalen Code: Session-Erneuerung über Nest-Guards verwarf bisher
`Set-Cookie`. Jetzt werden die Erneuerungscookies weitergegeben. Datenbank- und
andere technische Fehler wurden als 401 behandelt; jetzt ergibt dieser Pfad
503, ohne Cookies zu löschen. Das Frontend darf bei Netzwerkfehlern, 429 oder
5xx keine Abmeldung auslösen. Auth-Handler-Fehler können weiterhin 500 ergeben.

Keine gesicherte produktive Ursache ohne Laufzeitdaten. Zu prüfen sind:
SQLite-Schreibkonkurrenz und Dateirechte, SMTP-Verfügbarkeit, Proxy-Timeouts,
stabiler `BETTER_AUTH_SECRET`, persistentes DB-Volume, konsistente Basis-URL,
Trusted Origins und tatsächlich registrierter Discord-Callback. Keine Tokens,
Cookies, OAuth-Codes oder Mail-Links in Diagnoseberichte übernehmen.

Verifikation ist absichtlich kein Login (`autoSignInAfterVerification: false`).
Die Webseite benötigt `/auth/verified`, `/auth/error`, `/auth/callback` und
`/reset-password`; erfolgreiche Verifikation führt zur erneuten Anmeldung.
Abgelaufene Links werden als Fehler dargestellt, nicht als Sessionverlust.

API-Cookies bleiben host-only, HttpOnly, produktiv Secure und SameSite=Lax.
HTTPS-Frontend und HTTPS-API unter derselben Domain sind trotz verschiedener
Origins same-site. Browseranfragen müssen `credentials: 'include'` verwenden;
CORS erlaubt exakt die Frontend-Origin und Credentials. Kein Domain-Cookie nötig.
Andere registrierbare Domains sind mit dieser Lax-Strategie nicht unterstützt.
API und Frontend müssen dasselbe HTTPS-Schema nutzen. Caddy muss Set-Cookie
unverändert durchreichen, Auth-/Profilantworten nicht cachen und den konfigurierten
Proxy-Hop-Pfad einhalten. Session: sieben Tage, Erneuerung nach einem Tag;
`rememberMe: false` erzeugt ein Browser-Session-Cookie.

Referenz zur Erneuerung:
[Better Auth Session Management](https://better-auth.com/docs/concepts/session-management).

## Lokale Testergebnisse

Am 16.10.2026: **8 Testsuiten, 58 Tests bestanden**. Zusätzlich Typecheck, ESLint,
Build und Prettier-Prüfung erfolgreich. Tests verwenden ausschließlich lokale
Testdatenbanken und gemockte E-Mail-/Discord-Dienste, keine produktiven Dienste.
Abgedeckt sind Registrierung ohne Kontaktprofil, doppelte E-Mail-Benutzernamen
mit getrennten IDs, Discord-Username statt Anzeigename und doppelte Discord-Namen,
OAuth-State-Replay und Linking-Konflikte, E-Mail-Verifikation, Passwortreset,
Session-Ablauf, Cookie-Erneuerung über Nest-Endpunkte, technische Sessionfehler
ohne Cookie-Löschung, Profilvalidierung, Isolation und Adminzugriff sowie die
bestehenden RBAC-/Bootstrap-Tests. Die Migrationstests prüfen Neuinstallation,
Altbestand, wiederholten Start, Prisma-Schemavergleich und Fremdschlüssel.
Ein echter Browsertest über die produktiven Subdomains wurde nicht durchgeführt;
dieser bleibt Teil des freizugebenden Smoke-Tests.

## OpenClaw: kontrollierter Ablauf nach separater Freigabe

Es wurde ausschließlich lokal entwickelt. Kein Deployment, Push oder Zugriff auf
produktive Datenbanken. Die bestehende Anleitung in
[OPENCLAW_AUTH_DEPLOYMENT.md](OPENCLAW_AUTH_DEPLOYMENT.md) bleibt verbindlich,
insbesondere die Sperre bei fehlender historischer Migration und die Strategie
eines neuen leeren Volumes. Diese Änderung hebt diese Sperre nicht auf.

1. Commit und Image festhalten; Frontend auf `name` und den Profilvertrag
   umstellen. Kein Mischbetrieb mit altem Username-Client oder altem API-Image.
2. Volume/Pfade und vollständige Migrationshistorie read-only prüfen. Bei fehlender,
   unbekannter oder abweichender Migration abbrechen. Keine Historie umschreiben,
   keine Migration als angewendet markieren. Bestehendes Volume erhalten.
3. Für Bestandsübernahme nur nach geklärter Historie: konsistentes SQLite-Backup
   einschließlich WAL-Zustand bei gestoppten Schreibern erstellen und Restore auf
   isolierter Kopie testen. Migration zuerst auf dieser Kopie ausführen, niemals
   gegen Produktion testen. Discord-only-Namen vor Freigabe wie oben abgleichen.
4. Auf leerer Test-DB bzw. Kopie `npm ci`, `npm run db:generate`, `npm run typecheck`,
   `npm run lint`, `npm test`, `npm run build` ausführen. Migration lokal über
   `node scripts/migrate.cjs` oder `npm run db:migrate`; DB-URL bewusst auf die
   isolierte Kopie setzen, ohne sie im Bericht auszugeben. Nicht beide Runner
   gleichzeitig starten. SQLite muss DROP COLUMN unterstützen (ab 3.35).
5. Erst nach gesonderter Betriebsfreigabe neues Image mit dem bestätigten
   Compose-Projekt starten. Der Container migriert beim Start; keine zusätzliche
   parallele Migration. Für die neue DB ein anderes Volume verwenden. Niemals
   `down -v`, `migrate reset` oder `db push` in Produktion verwenden.
6. Browser-Smoke-Test: zwei Konten mit gleichem Namen, Mail-Verifikation,
   E-Mail-Login, Discord (Username gegen Anzeigename prüfen), explizites Linking,
   Reload und Session-Erneuerung über Frontend/API, Passwortreset, Profil-Isolation,
   Adminzugriff und RBAC. Cookies nur auf Attribute prüfen, Werte nicht teilen.
7. Bei Problemen Schreibzugriffe stoppen. Altes Image nur zusammen mit dem
   passenden alten DB-Backup/Volume wiederherstellen; die entfernten Spalten
   verhindern ein reines Image-Rollback. Seit Umschaltung entstandene Daten vor
   Restore sichern und die Übernahme gesondert planen.
