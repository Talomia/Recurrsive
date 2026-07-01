# Recurrsive Deployment Guide

Deploy Recurrsive in production using Docker, Docker Compose, or manual installation.

---

## Quick Start (Docker Compose)

The fastest way to run Recurrsive with PostgreSQL + Apache AGE:

```bash
git clone https://github.com/Talomia/Recurrsive.git
cd Recurrsive

# Start all services
docker compose -f docker/docker-compose.yml up --build -d

# Verify
curl http://localhost:3000/health
# → { "status": "ok", "uptime": 5.2 }

# Dashboard
open http://localhost:3100
```

This starts three services:

| Service | Port | Description |
|---------|------|-------------|
| `postgres` | 5432 | PostgreSQL with Apache AGE graph extension |
| `server` | 3000 | REST API + WebSocket server |
| `dashboard` | 3100 | Next.js dashboard UI |

### Stopping

```bash
docker compose -f docker/docker-compose.yml down

# Remove data volumes too
docker compose -f docker/docker-compose.yml down -v
```

---

## Manual Installation

### Prerequisites

| Requirement | Minimum Version |
|-------------|----------------|
| Node.js | 20.0.0+ |
| pnpm | 9.0.0+ |
| Git | 2.30+ |

### Build

```bash
git clone https://github.com/Talomia/Recurrsive.git
cd Recurrsive

pnpm install
pnpm build
```

### Run the API Server

```bash
node apps/server/dist/bin.js
```

The server starts on port 3000 by default.

### Run the Dashboard

```bash
cd apps/dashboard
pnpm start --port 3100
```

---

## Environment Variables

### Server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | API server port |
| `HOST` | No | `0.0.0.0` | Bind address |
| `NODE_ENV` | No | `development` | Environment mode |
| `DATABASE_URL` | No | — | PostgreSQL connection string |
| `GRAPH_PROVIDER` | No | `sqlite` | Graph backend: `sqlite` or `postgresql_age` |
| `RECURRSIVE_LOG_LEVEL` | No | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `RECURRSIVE_DATA_DIR` | No | `.recurrsive` | Data directory path |

### LLM Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RECURRSIVE_LLM_PROVIDER` | No | `openai` | LLM provider |
| `RECURRSIVE_LLM_MODEL` | No | `gpt-4.1-mini` | Model name |
| `RECURRSIVE_LLM_API_KEY` | Yes* | — | API key (*required for LLM features) |

### Webhook Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RECURRSIVE_WEBHOOK_SECRET` | No | — | HMAC secret for webhook signatures |
| `RECURRSIVE_WEBHOOK_TIMEOUT_MS` | No | `5000` | Webhook delivery timeout |
| `RECURRSIVE_WEBHOOK_MAX_RETRIES` | No | `3` | Max delivery retries |

### Notification Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SLACK_WEBHOOK_URL` | No | — | Slack incoming webhook URL |

### Dashboard

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:3000` | API server URL |
| `PORT` | No | `3100` | Dashboard port |

### MCP Server

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RECURRSIVE_PROJECT_PATH` | Yes | — | Path to the project to analyze |
| `MCP_PORT` | No | `3001` | MCP server port (SSE mode) |

---

## Docker

### Server Dockerfile

The multi-stage Dockerfile at `docker/Dockerfile`:

1. **Builder stage** — installs deps, builds all packages with Turbo, prunes devDeps
2. **Runner stage** — minimal Node 20 Alpine image, non-root user, health check

```bash
# Build just the server image
docker build -f docker/Dockerfile -t recurrsive-server .
docker run -p 3000:3000 recurrsive-server
```

### Development Mode

```bash
docker compose -f docker/docker-compose.yml -f docker/docker-compose.dev.yml up
```

Development mode mounts source code as volumes for hot reload.

---

## Health Checks

### Liveness Probe

```
GET /health → { "status": "ok", "uptime": <seconds> }
```

### Docker Health Check

The Dockerfile includes a built-in health check:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
```

### Kubernetes

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /api/v1/health-score
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 15
```

---

## Production Hardening Checklist

### Security
- [ ] Set `NODE_ENV=production`
- [ ] Configure TLS/HTTPS via reverse proxy (nginx, Caddy, Traefik)
- [ ] Set strong `RECURRSIVE_WEBHOOK_SECRET`
- [ ] Rotate API keys regularly
- [ ] Run as non-root user (Dockerfile already does this)

### Performance
- [ ] Set `GRAPH_PROVIDER=postgresql_age` for production workloads
- [ ] Configure PostgreSQL connection pooling
- [ ] Set appropriate `RECURRSIVE_LOG_LEVEL` (warn or error in production)
- [ ] Enable gzip compression in reverse proxy

### Monitoring
- [ ] Monitor `/health` endpoint
- [ ] Set up alerts for failed health checks
- [ ] Monitor WebSocket connection count
- [ ] Track API response times via `/api/v1/metrics/performance`

### Data
- [ ] Configure PostgreSQL backups
- [ ] Set `retention_days` in governance config
- [ ] Configure PII detection if handling sensitive codebases

### Networking
- [ ] Place behind a reverse proxy
- [ ] Configure CORS for dashboard domain
- [ ] Set rate limiting in reverse proxy
- [ ] Configure WebSocket upgrade in proxy

---

## Reverse Proxy (nginx)

Example nginx configuration for production:

```nginx
upstream recurrsive_api {
    server 127.0.0.1:3000;
}

upstream recurrsive_dashboard {
    server 127.0.0.1:3100;
}

server {
    listen 443 ssl http2;
    server_name recurrsive.example.com;

    ssl_certificate /etc/ssl/certs/recurrsive.crt;
    ssl_certificate_key /etc/ssl/private/recurrsive.key;

    # API
    location /api/ {
        proxy_pass http://recurrsive_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        proxy_pass http://recurrsive_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Health check (no TLS needed internally)
    location /health {
        proxy_pass http://recurrsive_api;
    }

    # Dashboard
    location / {
        proxy_pass http://recurrsive_dashboard;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Troubleshooting

### Server won't start

```bash
# Check if port is in use
lsof -i :3000

# Check logs
docker logs recurrsive-server

# Verify build
pnpm build 2>&1 | tail -5
```

### PostgreSQL connection fails

```bash
# Verify PostgreSQL is running
docker exec recurrsive-postgres pg_isready -U recurrsive

# Check AGE extension
docker exec recurrsive-postgres psql -U recurrsive -c "CREATE EXTENSION IF NOT EXISTS age;"
```

### Dashboard can't reach API

- Verify `NEXT_PUBLIC_API_URL` points to the correct server address
- Check CORS settings if running on different domains
- Verify the server is healthy: `curl http://localhost:3000/health`
