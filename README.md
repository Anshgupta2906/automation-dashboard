# Automation Dashboard

Real-estate broker operations SaaS for lead distribution, campaign scheduling, email delivery, and call workflow management.

## Current product scope

### Lead Distributor
- CSV/XLSX contact import
- Duplicate filtering per broker account
- Staff management
- Up to 300 fresh leads per staff member per day
- Manual distribution
- Daily distribution history
- Today's distribution statistics
- Email delivery of allocated leads

### Message Shooter
- CSV/XLSX contact import
- Campaign creation and recurring schedule
- Campaign listing and statistics
- Provider-independent message queue
- SMS/WhatsApp provider integration intentionally deferred

### Calling
- Staff-specific call queue
- Next-lead retrieval
- Browser/phone `tel:` handoff
- Call outcome logging
- Call statistics and history
- Telephony provider integration intentionally deferred

### Platform
- JWT authentication with Argon2 password hashing
- Broker-scoped data access
- FastAPI + SQLAlchemy + PostgreSQL
- React frontend
- APScheduler
- Docker + Docker Compose
- Production health check

## Architecture

```
React / Nginx
      |
      v
FastAPI
      |
      +---- Authentication
      +---- Lead Distributor
      +---- Message Campaigns ---> Provider Adapter (later)
      +---- Call Queue ---------> Telephony Adapter (later)
      |
      v
PostgreSQL / Supabase
```

The provider boundary is deliberate: business workflows are stored and tracked independently from SMS, WhatsApp, or telephony vendors.

## Local development

### Backend

1. Copy `.env.example` to `.env`.
2. Fill in PostgreSQL, JWT, and optional Gmail settings.
3. Install dependencies:

```bash
pip install -r requirements.txt
```

4. Start the API:

```bash
python -m uvicorn backend.main:app --reload
```

API: http://localhost:8000  
Health: http://localhost:8000/health

### Frontend

```bash
cd frontend
npm ci
npm start
```

Frontend: http://localhost:3000

### Docker

From the repository root:

```bash
docker compose up --build
```

Frontend: http://localhost:3000  
Backend: http://localhost:8000

## Environment variables

See `.env.example`. Never commit real `.env` credentials.

## Production notes

- Use a strong random `SECRET_KEY`.
- Restrict `CORS_ORIGINS` to the deployed frontend origin.
- Rotate any credentials that have previously been exposed.
- Run one backend process while APScheduler is in-process; move scheduling to a dedicated worker before horizontally scaling the API.
- Add the SMS/WhatsApp/telephony provider adapters only after the core workflows are validated.

## Status

Production-hardening sprint in progress.
