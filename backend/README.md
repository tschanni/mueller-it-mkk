# Mueller IT Backend

Professionelles NestJS Backend mit User Authentication und Ticket/Chat System.

## 🚀 Features

- ✅ User Authentication (JWT + argon2)
- ✅ Refresh Token Mechanismus
- ✅ Rollen-System (Admin, User, Guest)
- ✅ Ticket/Chat System
- ✅ Swagger API Dokumentation
- ✅ Rate Limiting (Brute Force Protection)
- ✅ CORS & Security (Helmet)
- ✅ MongoDB + Mongoose

## 📋 Voraussetzungen

- Node.js (v18 oder höher)
- MongoDB (lokal oder MongoDB Atlas)
- npm oder yarn

## 🛠️ Installation

### 1. Dependencies installieren

```bash
npm install
```

### 2. Environment Variablen konfigurieren

Kopiere `.env.example` zu `.env` und passe die Werte an:

```bash
cp .env.example .env
```

**Wichtig:** Ändere die `JWT_SECRET` und `JWT_REFRESH_SECRET` Werte zu sicheren, zufälligen Strings!

```env
MONGODB_URI=mongodb://localhost:27017/mueller-it-backend
JWT_SECRET=DEIN_SICHERER_GEHEIMER_STRING_HIER
JWT_REFRESH_SECRET=DEIN_ANDERER_SICHERER_STRING_HIER
PORT=3000
CORS_ORIGIN=https://yourusername.github.io
```

### 3. MongoDB starten

**Lokal (wenn MongoDB installiert):**
```bash
mongod
```

**Oder MongoDB Atlas verwenden** (empfohlen für Production)

## 🏃 Starten

### Development Mode
```bash
npm run start:dev
```

### Production Build
```bash
npm run build
npm run start:prod
```

## 📚 API Dokumentation

Nach dem Start erreichst du die Swagger-Dokumentation unter:

```
http://localhost:3000/api
```

## 🔐 API Endpoints

### Authentication

- `POST /auth/register` - Neuen User registrieren
- `POST /auth/login` - User anmelden
- `POST /auth/refresh` - Access Token erneuern
- `POST /auth/logout` - User abmelden

### Tickets (Authentifiziert)

- `POST /tickets` - Neues Ticket erstellen
- `GET /tickets` - Eigene Tickets abrufen
- `GET /tickets/:id` - Ticket-Details
- `POST /tickets/:id/messages` - Nachricht hinzufügen
- `PATCH /tickets/:id/status` - Status ändern

### Admin (nur Admin-Rolle)

- `GET /admin/tickets` - Alle Tickets
- `GET /admin/tickets/:id` - Ticket-Details
- `POST /admin/tickets/:id/messages` - Admin-Antwort
- `PATCH /admin/tickets/:id/status` - Status ändern

## 🏗️ Projekt-Struktur

```
backend/
├── src/
│   ├── auth/              # Authentication Module
│   │   ├── decorators/    # Custom Decorators (@CurrentUser, @Roles)
│   │   ├── dto/           # Data Transfer Objects
│   │   ├── guards/        # JWT & Roles Guards
│   │   └── strategies/    # Passport JWT Strategy
│   ├── users/             # User Module
│   │   └── schemas/       # User Schema (Mongoose)
│   ├── tickets/           # Ticket/Chat System
│   │   ├── dto/           # Ticket DTOs
│   │   ├── schemas/       # Ticket & Message Schemas
│   │   ├── tickets.service.ts
│   │   └── tickets.controller.ts
│   ├── admin/             # Admin Module
│   ├── database/          # Database Configuration
│   └── main.ts            # Application Entry Point
├── .env                   # Environment Variables (nicht in Git!)
├── .env.example           # Environment Template
└── package.json
```

## 🔒 Security Features

- **Passwort-Hashing**: argon2 (stärker als bcrypt)
- **JWT Authentication**: Access Token (15min) + Refresh Token (7 Tage)
- **Rate Limiting**: Max. 10 Requests pro Minute
- **Helmet**: HTTP Security Headers
- **CORS**: Konfigurierbar für Frontend-Domain
- **Validation**: Automatische DTO-Validierung
- **Guards**: Rollen-basierte Zugriffskontrolle

## 🎯 Ticket Status

- `open` - Neu erstellt
- `in_progress` - In Bearbeitung
- `waiting_for_user` - Wartet auf User-Antwort
- `waiting_for_admin` - Wartet auf Admin-Antwort
- `closed` - Geschlossen

## 👥 User Rollen

- **admin** - Voller Zugriff auf alle Tickets und Admin-Funktionen
- **user** - Kann eigene Tickets erstellen und verwalten
- **guest** - Eingeschränkter Zugriff (für zukünftige Erweiterungen)

## 🚢 Deployment auf IONOS VPS

### 1. VPS vorbereiten

```bash
# Node.js installieren
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# MongoDB installieren
sudo apt-get install -y mongodb

# PM2 für Prozessverwaltung
sudo npm install -g pm2
```

### 2. Projekt hochladen

```bash
# Git Repository klonen
git clone <dein-repo-url>
cd backend

# Dependencies installieren
npm install

# Production Build
npm run build
```

### 3. Mit PM2 starten

```bash
pm2 start dist/main.js --name mueller-it-backend
pm2 save
pm2 startup
```

### 4. Nginx Reverse Proxy (optional)

```nginx
server {
    listen 80;
    server_name api.deine-domain.de;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🧪 Testing

```bash
# Unit Tests
npm run test

# E2E Tests
npm run test:e2e

# Test Coverage
npm run test:cov
```

## 📝 Erster Admin User erstellen

Nach dem ersten Start musst du manuell einen Admin-User in der Datenbank anlegen:

1. Registriere einen normalen User über `/auth/register`
2. Ändere die `role` in MongoDB zu `admin`:

```javascript
db.users.updateOne(
  { email: "admin@example.com" },
  { $set: { role: "admin" } }
)
```

## 🔧 Troubleshooting

### MongoDB Connection Error
- Prüfe ob MongoDB läuft: `sudo systemctl status mongodb`
- Prüfe `MONGODB_URI` in `.env`

### JWT Fehler
- Stelle sicher, dass `JWT_SECRET` in `.env` gesetzt ist
- Secrets müssen in Production geändert werden!

### CORS Fehler
- Setze `CORS_ORIGIN` in `.env` auf deine Frontend-URL

## 📞 Support

Bei Problemen erstelle ein Ticket in diesem Repository.

---

**Entwickelt mit ❤️ für Mueller IT**
