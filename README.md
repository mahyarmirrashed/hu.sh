# Smol: Secret Sharing Service

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Setup Instructions](#setup-instructions)
- [Services Overview](#services-overview)
  - [Backend](#backend)
  - [Frontend](#frontend)
  - [Database](#database)
- [Local Access Links](#local-access-links)
- [Development Commands](#development-commands)

## Overview

- **Backend:** An API built with **Express.js**.
- **Frontend:** A user interface built with **React.js**.
- **Database:** A **PostgreSQL** database with query operations powered by
  **Knex.js**.
- **Docker Compose:** Used to orchestrate all services in the development
  environment.

## Services Overview

### Backend

- **Description:** The backend is built with **Express.js**
- **Code Directory:** `./server`
- **Port Mapping:**  
  Externally accessible on `http://localhost:8000`
- **Database Integration:**  
  The backend connects to the PostgreSQL database using **Knex.js** for query
  operations.
- **Environment Variables:**
  - `NODE_ENV=development`
  - `DB_CONNECTION_URI=postgres://infisical:infisical@localhost/infisical?sslmode=disable`

### Frontend

- **Description:** The frontend is a **React.js** application.
- **Code Directory:** `./client`
- **Port Mapping:**  
  Externally accessible on `http://localhost:3000`

### Database

- **Description:** The database is **PostgreSQL**, used to store and manage
  persistent data.
- **Image:** `postgres:16-alpine`
- **Port Mapping:**  
  Externally accessible on `localhost:5432`
- **Query Builder:**  
  **Knex.js** is used to manage migrations and queries in the backend.
- **Credentials:**
  - **Username:** `infisical`
  - **Password:** `infisical`
  - **Database Name:** `infisical`
- **Volume:**  
  Data is persisted in the `postgres-data` volume.

### Other helpful Services

#### pgAdmin

- **Description:** A web-based management tool for PostgreSQL. This will help
  you quickly view your DB tables.
- **Port Mapping:**  
  Accessible on `http://localhost:5050`
- **Default Credentials:**
  - **Email:** `admin@example.com`
  - **Password:** `pass`

## Local Access Links

| Service    | URL                                            |
| ---------- | ---------------------------------------------- |
| Frontend   | [http://localhost:3000](http://localhost:3000) |
| Backend    | [http://localhost:8000](http://localhost:8000) |
| PostgreSQL | `localhost:5432` (via psql or client tools)    |
| pgAdmin    | [http://localhost:5050](http://localhost:5050) |

---

## Development Commands

Many of the common development commands are documented in the
[Justfile](./Justfile).

### Install Dependencies

```bash
just install
```

### Build and Start Services

```bash
just up
```

### Stop and Remove Services

```bash
just down
```

Default Ports

1. Frontend (React): 3000
2. Backend (Express): 8000
3. PostgreSQL: 5432
