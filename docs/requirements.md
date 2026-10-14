# Job Tracker — Project Requirements

## 1. Project Overview

Job Tracker is a full-stack web application that helps users
manage their job search in one place.

Users can track companies, job opportunities, applications,
application statuses, interviews, and follow-up dates.

## 2. Problem Statement

Job seekers often manage applications using spreadsheets,
notes, and multiple websites. This makes it difficult to track
application progress, remember follow-ups, and analyze results.

Job Tracker provides a centralized solution.

## 3. Target Users

- Students preparing for placements
- Fresh graduates
- Experienced job seekers

## 4. Core Features

### Authentication
- User registration
- User login and logout
- Protected application data

### Company Management
- Add companies
- View company details
- Update company information
- Delete companies when appropriate

### Job Management
- Record job titles and descriptions
- Store job locations and job URLs
- Record employment type

### Application Tracking
- Create job applications
- Update application details
- Track application status
- View application history

### Interview Management
- Schedule interviews
- Record interview rounds
- Store interview notes and outcomes

### Dashboard and Analytics
- Total applications
- Applications by status
- Upcoming interviews
- Follow-up reminders

## 5. Application Statuses

- Applied
- Assessment
- Interview
- Offer
- Rejected
- Withdrawn

Status changes should be validated and recorded in history.

## 6. Planned Technology Stack

### Frontend
- React
- Vite
- JavaScript
- CSS

### Backend
- Node.js
- Express.js
- REST API

### Database
- PostgreSQL

### Security
- Password hashing
- Authentication
- Authorization
- Input validation
- Parameterized SQL queries

### Development and Quality
- Git and GitHub
- Automated tests
- Docker
- CI/CD
- Deployment

## 7. Initial Database Entities

- users
- companies
- jobs
- applications
- status_history
- interviews
- refresh_sessions

The final schema will be designed and documented before implementation.

## 8. Engineering Principles

- Keep frontend and backend responsibilities separate.
- Validate all incoming data.
- Never store plaintext passwords.
- Never commit secrets or credentials.
- Restrict users to their authorized data.
- Use database transactions for related updates.
- Write tests for critical business logic.
- Document important architectural decisions.

## 9. Initial Milestones

1. Requirements and repository setup
2. Database schema and migrations
3. Express backend foundation
4. Authentication
5. Company and job APIs
6. Application tracking and status history
7. Interview management
8. React frontend
9. Testing and security improvements
10. Docker and deployment
