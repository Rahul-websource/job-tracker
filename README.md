# Job Tracker

**A Full-Stack Job Application Management Platform**

Job Tracker is a full-stack web application designed to help job seekers organize, monitor, and manage their job applications from a centralized dashboard.

The platform allows users to manage companies, job opportunities, application progress, interview schedules, and application status history through a structured and user-friendly interface.

---

## Live Demo

**[Open Job Tracker](https://mono-comes-addresses-tonight.trycloudflare.com)**

> **Note:** The application is currently accessible through a temporary Cloudflare Quick Tunnel. The URL and availability are not guaranteed and may change.

---

## Key Features

### 1. User Authentication
- User registration and login.
- JWT-based authentication.
- Secure password hashing.
- Protected application routes.

### 2. Company Management
- Add and manage companies.
- Maintain company-related information.
- Organize job opportunities by company.

### 3. Job Management
- Create and manage job opportunities.
- Store job descriptions and relevant details.
- Associate job opportunities with companies.

### 4. Application Tracking
- Track job application progress.
- Manage application statuses.
- Maintain application records.
- Monitor the overall application pipeline.

### 5. Application Status History
- Record application status changes.
- Maintain historical application activity.
- Track progress across different recruitment stages.

### 6. Interview Management
- Manage interview-related information.
- Organize interview schedules.
- Track interview progress.

### 7. Infrastructure & Deployment
- Docker-based application deployment.
- Docker Compose service orchestration.
- Nginx reverse proxy.
- PostgreSQL database integration.
- Backend and database health checks.

---

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React 19 |
| Build Tool | Vite 8 |
| Backend Runtime | Node.js 22 |
| Backend Framework | Express 5 |
| Database | PostgreSQL 18 |
| Authentication | JSON Web Tokens (JWT) |
| Containerization | Docker |
| Orchestration | Docker Compose |
| Web Server | Nginx |
| Version Control | Git |
| Code Hosting | GitHub |

---

## System Architecture

The application follows a frontend-backend architecture with Nginx acting as the entry point and reverse proxy.

```text
                  USER / BROWSER
                         |
                         v
                    NGINX SERVER
                         |
              +----------+----------+
              |                     |
              v                     v
       REACT FRONTEND          /api/*
                                    |
                                    v
                            EXPRESS BACKEND
                                    |
                                    v
                               POSTGRESQL
                                    |
                                    v
                            PERSISTENT STORAGE
```

### Request Flow

1. The user accesses the application through a web browser.
2. Nginx receives incoming HTTP requests.
3. Frontend requests are served by the React application.
4. API requests are forwarded to the Express backend.
5. The backend processes business logic and communicates with PostgreSQL.
6. PostgreSQL stores and retrieves application data.
7. The backend returns responses to the frontend.

---

## Getting Started

Follow these instructions to run the project locally.

### Prerequisites

Make sure the following tools are installed:

- Git
- Node.js 22 or compatible version
- npm
- Docker Engine
- Docker Compose

### 1. Clone the Repository

```bash
git clone https://github.com/Rahul-websource/job-tracker.git

cd job-tracker
```

### 2. Configure Environment Variables

Create a `.env.docker` file in the project root directory.

Add the following configuration:

```env
POSTGRES_DB=your_database_name
POSTGRES_USER=your_database_user
POSTGRES_PASSWORD=your_secure_password

JWT_SECRET=your_long_random_secret
JWT_EXPIRES_IN=1d
```

Replace the placeholder values with your actual configuration.

**Security Note:** Never commit actual database credentials, JWT secrets, or other sensitive environment variables to GitHub.

### 3. Build and Start the Application

Run the following command:

```bash
sudo docker compose --env-file .env.docker up -d --build
```

This command builds the application images and starts the configured services in detached mode.

### 4. Verify Running Services

```bash
sudo docker compose --env-file .env.docker ps
```

### 5. Access the Application

Open your browser and navigate to:

```text
http://localhost:8080
```

---

## Health Checks

The application provides health-check endpoints for monitoring backend and database availability.

| Endpoint | Purpose |
|---|---|
| `/health` | Checks backend service health |
| `/health/db` | Checks database connectivity |

These endpoints help verify whether the backend and database are functioning correctly.

---

## Docker Management Commands

### Check Running Containers

```bash
sudo docker compose --env-file .env.docker ps
```

### View Application Logs

```bash
sudo docker compose --env-file .env.docker logs -f
```

### Stop Application Services

```bash
sudo docker compose --env-file .env.docker down
```

### Rebuild and Restart

```bash
sudo docker compose --env-file .env.docker up -d --build
```

---

## Development Setup

For local development, the frontend and backend can be started independently.

### Frontend Setup

Navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

### Backend Setup

Open another terminal and navigate to the backend directory:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Start the backend development server:

```bash
npm run dev
```

---

## Testing & Code Quality

The following commands can be used to validate the application.

### Frontend Linting

```bash
cd frontend
npm run lint
```

### Frontend Production Build

```bash
npm run build
```

### Backend Tests

```bash
cd backend
npm test
```

---

## Security Considerations

The project incorporates the following security-related mechanisms:

- JWT-based authentication.
- Password hashing.
- Helmet security headers.
- Rate limiting for login and registration endpoints.
- Environment-based application configuration.
- Database credentials managed outside source control.

**Production Recommendations:**

Before handling real user data, ensure:

- Authorization and data ownership checks are implemented across all relevant endpoints.
- HTTPS is configured.
- Database backups are maintained.
- Production secrets are securely managed.
- Application logs and service monitoring are configured.

---

## Project Structure

The project is organized into separate frontend, backend, and deployment components.

```text
job-tracker/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── index.html
│
├── backend/
│   ├── src/
│   ├── package.json
│   └── ...
│
├── docs/
│
├── docker-compose.yml
├── README.md
├── .gitignore
└── ...
```

*Note: The structure above is illustrative. Update it to match the actual repository contents.*

---

## Author

**Rahul Kumar**

- GitHub: [Rahul-websource](https://github.com/Rahul-websource)
- Project Repository: [Job Tracker](https://github.com/Rahul-websource/job-tracker)

---

## License

This project is available for educational and portfolio purposes. Add a LICENSE file to the repository if you intend to distribute it under a specific open-source license.

---

**Built with React, Node.js, Express, PostgreSQL, Docker, and Nginx.**