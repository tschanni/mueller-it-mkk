# 📐 UML Diagramme - Mueller IT Backend

## 1. Klassendiagramm (Class Diagram)

```mermaid
classDiagram
    %% Entities/Schemas
    class User {
        +ObjectId _id
        +string username
        +string email
        +string password
        +string? firmenname
        +UserRole role
        +string? refreshToken
        +boolean isActive
        +Date createdAt
        +Date updatedAt
    }

    class Ticket {
        +ObjectId _id
        +ObjectId userId
        +string title
        +TicketStatus status
        +Date lastMessageAt
        +boolean isClosedByUser
        +boolean isClosedByAdmin
        +Date createdAt
        +Date updatedAt
    }

    class Message {
        +ObjectId _id
        +ObjectId ticketId
        +ObjectId senderId
        +string content
        +boolean isAdminMessage
        +boolean isRead
        +Date createdAt
        +Date updatedAt
    }

    %% Enums
    class UserRole {
        <<enumeration>>
        ADMIN
        USER
        GUEST
    }

    class TicketStatus {
        <<enumeration>>
        OPEN
        IN_PROGRESS
        WAITING_FOR_USER
        WAITING_FOR_ADMIN
        CLOSED
    }

    %% Controllers
    class AuthController {
        -AuthService authService
        +register(RegisterDto) AuthResponseDto
        +login(LoginDto) AuthResponseDto
        +refresh(RefreshTokenDto) AuthResponseDto
        +logout(user) void
    }

    class TicketsController {
        -TicketsService ticketsService
        +createTicket(user, CreateTicketDto) Ticket
        +getUserTickets(user) Ticket[]
        +getTicket(id, user) Ticket
        +addMessage(id, user, CreateMessageDto) Message
        +updateStatus(id, user, UpdateTicketStatusDto) Ticket
    }

    class AdminController {
        -TicketsService ticketsService
        +getAllTickets() Ticket[]
        +getTicket(id) Ticket
        +replyToTicket(id, user, CreateMessageDto) Message
        +updateTicketStatus(id, user, UpdateTicketStatusDto) Ticket
    }

    %% Services
    class AuthService {
        -Model~User~ userModel
        -JwtService jwtService
        -ConfigService configService
        +register(RegisterDto) AuthResponseDto
        +login(LoginDto) AuthResponseDto
        +refreshToken(string) AuthResponseDto
        +logout(userId) void
        -generateTokens(User) AuthResponseDto
    }

    class TicketsService {
        -Model~Ticket~ ticketModel
        -Model~Message~ messageModel
        +createTicket(userId, CreateTicketDto) Ticket
        +getUserTickets(userId) Ticket[]
        +getTicketById(ticketId, userId) Ticket
        +addMessage(ticketId, userId, CreateMessageDto, isAdmin) Message
        +updateTicketStatus(ticketId, userId, UpdateTicketStatusDto, isAdmin) Ticket
        +getAllTickets() Ticket[]
        +getTicketByIdAdmin(ticketId) Ticket
    }

    %% Guards
    class JwtAuthGuard {
        +canActivate(context) boolean
    }

    class RolesGuard {
        -Reflector reflector
        +canActivate(context) boolean
    }

    %% Strategies
    class JwtStrategy {
        -Model~User~ userModel
        -ConfigService configService
        +validate(payload) User
    }

    %% DTOs
    class RegisterDto {
        +string username
        +string email
        +string password
        +string? firmenname
    }

    class LoginDto {
        +string usernameOrEmail
        +string password
    }

    class AuthResponseDto {
        +string accessToken
        +string refreshToken
        +string role
        +string username
    }

    class CreateTicketDto {
        +string title
        +string initialMessage
    }

    class CreateMessageDto {
        +string content
    }

    class UpdateTicketStatusDto {
        +TicketStatus status
    }

    %% Relationships
    User "1" --> "0..*" Ticket : creates
    User "1" --> "0..*" Message : sends
    Ticket "1" --> "0..*" Message : contains
    User --> UserRole : has
    Ticket --> TicketStatus : has

    AuthController --> AuthService : uses
    TicketsController --> TicketsService : uses
    AdminController --> TicketsService : uses

    AuthService --> User : manages
    TicketsService --> Ticket : manages
    TicketsService --> Message : manages

    AuthController --> RegisterDto : receives
    AuthController --> LoginDto : receives
    AuthController --> AuthResponseDto : returns

    TicketsController --> CreateTicketDto : receives
    TicketsController --> CreateMessageDto : receives
    TicketsController --> UpdateTicketStatusDto : receives

    JwtAuthGuard --> JwtStrategy : uses
    RolesGuard ..> UserRole : checks
```

---

## 2. Komponentendiagramm (Component Diagram)

```mermaid
graph TB
    subgraph "Frontend (React)"
        FE[React Application<br/>GitHub Pages]
    end

    subgraph "Backend (NestJS)"
        subgraph "API Gateway Layer"
            MAIN[Main.ts<br/>Entry Point]
            CORS[CORS Middleware]
            HELMET[Helmet Security]
            THROTTLE[Rate Limiter]
            SWAGGER[Swagger Docs]
        end

        subgraph "Application Modules"
            AUTH[AuthModule<br/>Authentication & JWT]
            USERS[UsersModule<br/>User Management]
            TICKETS[TicketsModule<br/>Ticket/Chat System]
            ADMIN[AdminModule<br/>Admin Functions]
        end

        subgraph "Cross-Cutting Concerns"
            GUARDS[Guards<br/>JwtAuthGuard, RolesGuard]
            DECORATORS[Decorators<br/>@CurrentUser, @Roles]
            PIPES[Validation Pipes<br/>DTO Validation]
        end

        subgraph "Database Layer"
            DB_MODULE[DatabaseModule<br/>Mongoose Connection]
        end
    end

    subgraph "External Services"
        MONGO[(MongoDB<br/>Local/Atlas)]
    end

    %% Connections
    FE -->|HTTP/REST + JWT| MAIN
    MAIN --> CORS
    MAIN --> HELMET
    MAIN --> THROTTLE
    MAIN --> SWAGGER

    CORS --> AUTH
    CORS --> TICKETS
    CORS --> ADMIN

    AUTH --> GUARDS
    TICKETS --> GUARDS
    ADMIN --> GUARDS

    GUARDS --> DECORATORS
    AUTH --> PIPES
    TICKETS --> PIPES

    AUTH --> USERS
    TICKETS --> DB_MODULE
    ADMIN --> TICKETS
    USERS --> DB_MODULE

    DB_MODULE -->|Mongoose| MONGO

    style FE fill:#61dafb,stroke:#000,stroke-width:2px
    style MONGO fill:#4db33d,stroke:#000,stroke-width:2px
    style AUTH fill:#e53935,stroke:#000,stroke-width:2px
    style ADMIN fill:#ffa726,stroke:#000,stroke-width:2px
```

---

## 3. Sequenzdiagramm - Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant AC as AuthController
    participant AS as AuthService
    participant DB as MongoDB
    participant JWT as JwtService

    Note over C,JWT: User Registration Flow

    C->>+AC: POST /auth/register<br/>{username, email, password}
    AC->>+AS: register(registerDto)
    AS->>DB: findOne({email OR username})
    DB-->>AS: null (user not exists)
    AS->>AS: hash password (argon2)
    AS->>DB: save new User
    DB-->>AS: user saved
    AS->>JWT: generate accessToken
    JWT-->>AS: accessToken
    AS->>JWT: generate refreshToken
    JWT-->>AS: refreshToken
    AS->>DB: save refreshToken to user
    AS-->>AC: AuthResponseDto
    AC-->>-C: 201 Created<br/>{accessToken, refreshToken}

    Note over C,JWT: Login Flow

    C->>+AC: POST /auth/login<br/>{usernameOrEmail, password}
    AC->>+AS: login(loginDto)
    AS->>DB: findOne({email OR username})
    DB-->>AS: user found
    AS->>AS: verify password (argon2)
    AS->>JWT: generate tokens
    JWT-->>AS: accessToken, refreshToken
    AS->>DB: update refreshToken
    AS-->>AC: AuthResponseDto
    AC-->>-C: 200 OK<br/>{accessToken, refreshToken}
```

---

## 4. Sequenzdiagramm - Ticket Creation Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant G as JwtAuthGuard
    participant TC as TicketsController
    participant TS as TicketsService
    participant DB as MongoDB

    C->>+G: POST /tickets<br/>Authorization: Bearer <JWT>
    G->>G: validate JWT
    G->>DB: findById(userId)
    DB-->>G: user found
    G->>TC: inject user to request
    TC->>+TS: createTicket(userId, createTicketDto)
    TS->>DB: create new Ticket<br/>{userId, title, status: 'open'}
    DB-->>TS: ticket saved
    TS->>DB: create initial Message<br/>{ticketId, senderId, content}
    DB-->>TS: message saved
    TS->>DB: populate ticket with messages
    DB-->>TS: ticket with messages
    TS-->>TC: ticket object
    TC-->>-C: 201 Created<br/>{ticket with messages}
```

---

## 5. Deployment Diagramm

```mermaid
graph TB
    subgraph "Client Tier"
        BROWSER[Web Browser]
    end

    subgraph "CDN / Static Hosting"
        GITHUB[GitHub Pages<br/>Frontend Hosting]
    end

    subgraph "IONOS VPS Server"
        subgraph "Web Server"
            NGINX[Nginx<br/>Reverse Proxy<br/>Port 80/443]
        end

        subgraph "Application Server"
            PM2[PM2 Process Manager]
            NODE1[NestJS Instance 1<br/>Port 3000]
            NODE2[NestJS Instance 2<br/>Port 3001]
            NODE3[NestJS Instance 3<br/>Port 3002]
        end

        subgraph "Database Server"
            MONGODB[(MongoDB<br/>Port 27017)]
        end

        subgraph "System Services"
            SYSTEMD[systemd<br/>Auto-start]
        end
    end

    BROWSER -->|HTTPS| GITHUB
    BROWSER -->|API Requests<br/>HTTPS/REST| NGINX
    GITHUB -.->|Load Static Assets| BROWSER

    NGINX -->|Load Balance| PM2
    PM2 --> NODE1
    PM2 --> NODE2
    PM2 --> NODE3

    NODE1 -->|Mongoose| MONGODB
    NODE2 -->|Mongoose| MONGODB
    NODE3 -->|Mongoose| MONGODB

    PM2 --> SYSTEMD
    MONGODB --> SYSTEMD

    style BROWSER fill:#f9f,stroke:#333,stroke-width:2px
    style GITHUB fill:#000,stroke:#fff,stroke-width:2px,color:#fff
    style NGINX fill:#009639,stroke:#333,stroke-width:2px
    style MONGODB fill:#4db33d,stroke:#333,stroke-width:2px
    style NODE1 fill:#e53935,stroke:#333,stroke-width:2px
    style NODE2 fill:#e53935,stroke:#333,stroke-width:2px
    style NODE3 fill:#e53935,stroke:#333,stroke-width:2px
```

---

## 6. Zustandsdiagramm - Ticket Status

```mermaid
stateDiagram-v2
    [*] --> open: Ticket erstellt

    open --> in_progress: Admin übernimmt
    open --> closed: User schließt

    in_progress --> waiting_for_user: Admin antwortet
    in_progress --> waiting_for_admin: User antwortet
    in_progress --> closed: Admin schließt

    waiting_for_user --> in_progress: User antwortet
    waiting_for_user --> closed: Timeout/Admin schließt

    waiting_for_admin --> in_progress: Admin antwortet
    waiting_for_admin --> closed: User schließt

    closed --> open: Wiederöffnen (Admin)
    closed --> [*]
```

---

## 7. Datenbank ER-Diagramm

```mermaid
erDiagram
    USER ||--o{ TICKET : creates
    USER ||--o{ MESSAGE : sends
    TICKET ||--o{ MESSAGE : contains

    USER {
        ObjectId _id PK
        string username UK
        string email UK
        string password
        string firmenname
        enum role
        string refreshToken
        boolean isActive
        date createdAt
        date updatedAt
    }

    TICKET {
        ObjectId _id PK
        ObjectId userId FK
        string title
        enum status
        date lastMessageAt
        boolean isClosedByUser
        boolean isClosedByAdmin
        date createdAt
        date updatedAt
    }

    MESSAGE {
        ObjectId _id PK
        ObjectId ticketId FK
        ObjectId senderId FK
        string content
        boolean isAdminMessage
        boolean isRead
        date createdAt
        date updatedAt
    }
```

---

## Legende

### Diagramm-Typen
- **Klassendiagramm**: Zeigt Klassen, Attribute, Methoden und Beziehungen
- **Komponentendiagramm**: Zeigt Module und ihre Abhängigkeiten
- **Sequenzdiagramm**: Zeigt zeitliche Abfolge von Interaktionen
- **Deployment Diagramm**: Zeigt physische Verteilung auf Server
- **Zustandsdiagramm**: Zeigt Zustandsübergänge
- **ER-Diagramm**: Zeigt Datenbank-Entitäten und Relationen

### Symbole
- `+` = public
- `-` = private
- `~` = protected
- `*` = multiplicity (many)
- `?` = optional
- `PK` = Primary Key
- `FK` = Foreign Key
- `UK` = Unique Key

---

**Hinweis:** Diese Diagramme können in GitHub/GitLab mit Mermaid-Support direkt gerendert werden.

**Tools zum Bearbeiten:**
- [Mermaid Live Editor](https://mermaid.live)
- VS Code Extension: "Markdown Preview Mermaid Support"
- Draw.io für detailliertere UML-Diagramme
