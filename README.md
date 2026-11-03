# Job Tracker

A full-stack web application for organizing and managing job applications in one place. Track companies, job opportunities, application progress, status history, and interviews through a centralized dashboard.

## Live Demo

[Open Job Tracker](https://mono-comes-addresses-tonight.trycloudflare.com)

> Note: The demo currently uses a temporary Cloudflare Quick Tunnel. Its availability and URL are not guaranteed.

## Features

- User registration and login.
- JWT-based authentication.
- Company management.
- Job opportunity management.
- Job application tracking.
- Application status history.
- Interview management.
- PostgreSQL database.
- Docker-based application deployment.
- Nginx reverse proxy.
- Backend and database health checks.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React 19 |
| Build Tool | Vite 8 |
| Backend | Node.js 22 |
| API Framework | Express 5 |
| Database | PostgreSQL 18 |
| Authentication | JSON Web Tokens (JWT) |
| Containerization | Docker |
| Service Management | Docker Compose |
| Web Server | Nginx |
| Version Control | Git and GitHub |

## Architecture

```text
                 USER / BROWSER
                       |
                       v
                 NGINX SERVER
                       |
              +--------+--------+
              |                 |
              v                 v
         REACT FRONTEND     /api/*
                                |
                                v
                         EXPRESS BACKEND
                                |
                                v
                           POSTGRESQL
                                |
                                v
                         PERSISTENT DATA
cd /home/rahulweb-source/job-tracker

cat > README.md <<'EOF'
# Job Tracker

A full-stack web application to organize and manage job applications in one place. Track companies, job opportunities, application progress, status history, and interviews through a centralized dashboard.

## Live Demo

[Open Job Tracker](https://mono-comes-addresses-tonight.trycloudflare.com)

> Note: The demo uses a temporary Cloudflare Quick Tunnel. Its availability and URL are not guaranteed.

## Features

- User registration and login
- JWT-based authentication
- Company management
- Job opportunity management
- Job application tracking
- Application status history
- Interview management
- PostgreSQL database
- Docker-based deployment
- Nginx reverse proxy
- Backend and database health checks

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React 19 |
| Build Tool | Vite 8 |
| Backend | Node.js 22 |
| API Framework | Express 5 |
| Database | PostgreSQL 18 |
| Authentication | JSON Web Tokens (JWT) |
| Containerization | Docker |
| Service Management | Docker Compose |
| Web Server | Nginx |
| Version Control | Git and GitHub |

## Architecture

```text
                 USER / BROWSER
                       |
                       v
                  NGINX SERVER
                       |
              +--------+--------+
              |                 |
              v                 v
         REACT FRONTEND       /api/*
                                |
                                v
                         EXPRESS BACKEND
                                |
                                v
                           POSTGRESQL
                                |
                                v
                         PERSISTENT DATA
Getting Started
Prerequisites
- Git
- Node.js 22 or compatible version
- npm
- Docker Engine
- Docker Compose
1. Clone the repository
git clone https://github.com/Rahul-websource/job-tracker.git
cd job-tracker

2. Configure environment variables
Create a local .env.docker file and configure your own credentials:
POSTGRES_DB=your_database_name
POSTGRES_USER=your_database_user
POSTGRES_PASSWORD=your_secure_password
JWT_SECRET=your_long_random_secret
JWT_EXPIRES_IN=1d

Never commit actual credentials or secret keys.
3. Build and start the application
sudo docker compose --env-file .env.docker up -d --build
4.. Check running services
sudo docker compose --env-file .env.docker ps

5. Open the application
http://localhost:8080
Health Checks
- /health
- /health/db
Docker Commands
Check services:
sudo docker compose --env-file .env.docker ps

View logs:
sudo docker compose --env-file .env.docker logs -f

Stop services:
sudo docker compose --env-file .env.docker down
Development
Frontend
cd frontend
npm install
npm run dev

Backend
Run in another terminal:
cd backend
npm install
npm run dev
Testing
Frontend lint:
cd frontend
npm run lint

Frontend production build:
npm run build

Backend tests:
cd backend
npm test
Security
The project includes:
- JWT-based authentication
- Password hashing
- Helmet security headers
- Login and registration rate limiting
- Environment-based configuration
- Database credentials kept outside source control
Before using the application with multiple real users, verify authorization and data ownership checks across all data endpoints. Configure production HTTPS, backups, and monitoring before handling real user data.
Author
Rahul Kumar

GitHub: Rahul-websource

Repository: Job Tracker
