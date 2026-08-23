# AnyFile Convert - Web Backend & API Specifications

Hello! You are building the web backend and administrative dashboard for the AnyFile Convert project. This document outlines the API specifications, authentication requirements, and the expected architecture to seamlessly integrate with the Windows desktop application.

## 1. Project Overview
AnyFile Convert is a privacy-first, offline-first desktop application. However, we collect **anonymous usage analytics** (e.g., number of conversions, types of tools used) to improve the product. The Windows application has a built-in offline queue that aggregates these events and occasionally `POST`s them to the web API when an internet connection is available.

Your job is to:
1. Build the REST API endpoint to ingest these events.
2. Build a secure administrative dashboard to visualize this data (downloads, tool usage, etc.).
3. Build the public website (download links, info, contributor credits).

---

## 2. API Contract: Analytics Ingestion

The Windows desktop application will send an array of JSON event objects to your endpoint.

- **Endpoint**: `POST /api/analytics` (or `/api/analytics/ingest`)
- **Headers**: `Content-Type: application/json`
- **Authentication**: None required for ingestion (this is public, anonymous telemetry). **However**, you must implement basic rate limiting (e.g., by IP) to prevent spam/DDoS.

### Payload Structure
The payload will ALWAYS be a JSON Object containing the unique `client_id` (a UUID representing the installation) and an array of `events`.

```json
{
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "events": [
    {
      "event": "operation_completed",
      "category": "tool",
      "operation": "jpg_to_png",
      "platform": "windows",
      "app_version": "0.1.0",
      "timestamp": 1692801234
    }
  ]
}
```

### 🛑 Security & Anti-Spam (CRITICAL)
Because the app is fully offline and open-source, the API endpoint will be visible to the public. Malicious actors could try to spam the endpoint with fake data. **Do NOT rely on a static API key** (it will be extracted from the binary).

Instead, implement these protections:
1. **IP Rate Limiting**: Limit ingestion to ~1 request per hour per IP. The app batches events offline and only flushes every 5+ minutes, so legitimate traffic is very low-frequency.
2. **Client ID Throttling**: The `client_id` is persistent per installation. Reject requests if a single `client_id` submits more than 100 events a day.
3. **Payload Validation**: Strictly validate the `operation` and `category` fields against a known whitelist. Reject absurd `timestamp` values (e.g., in the future or years in the past).
4. **WAF (Web Application Firewall)**: Place the API behind Cloudflare to absorb basic DDoS attacks automatically.

### Response Expected
- **Success**: Return HTTP `200 OK` (The desktop app will delete its local queue upon seeing this).
- **Failure**: Return HTTP `400` or `500` (The desktop app will keep the queue and try again later).

---

## 3. Database Recommendations

Because this app prioritizes Cyber Security and Privacy, **you must never store IP addresses, file names, or personal identifiers** alongside the analytics data.

**Suggested Schema (PostgreSQL/MySQL)**:
```sql
CREATE TABLE analytics_events (
    id SERIAL PRIMARY KEY,
    event_name VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    operation VARCHAR(50) NOT NULL,
    platform VARCHAR(20) NOT NULL,
    app_version VARCHAR(20) NOT NULL,
    client_timestamp BIGINT NOT NULL,
    server_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE app_downloads (
    id SERIAL PRIMARY KEY,
    platform VARCHAR(20) NOT NULL,
    version VARCHAR(20) NOT NULL,
    download_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Administrative Dashboard

The owner requires a private, secure dashboard to view the analytics. 

**Security & Authentication:**
- **Fixed Keys**: The dashboard should be protected by hardcoded/fixed keys (environment variables) so that *only the owner* can log in. Do not build a complex multi-user registration system. A simple password/key check that issues an HTTP-only secure cookie or JWT is sufficient.
- **Cyber Security Focus**: Ensure the login form is protected against brute force attacks (rate limiting) and SQL injection (use an ORM or parameterized queries).

**Dashboard Features:**
1. **Total Downloads**: Tracked via clicks on the public website download buttons.
2. **Tool Usage**: A bar chart or table showing which `operation` (e.g., `jpg_to_png`, `merge_pdf`) is used most frequently.
3. **Active Versions**: A breakdown of the `app_version` being used in the wild.

---

## 5. Public Website Requirements

- **Design**: Clean, modern, reflecting the app's premium native feel.
- **Content**: 
  - Hero section with Download button (track these clicks in your DB!).
  - Feature list (Images, PDFs, Videos, Offline-first, Privacy-first).
  - "How to use" section.
  - **Contributors Section**: A dedicated section to give due credit to open-source contributors. You can dynamically fetch this using the GitHub API (`https://api.github.com/repos/anyfile-converter/Anyfile-Converter-windows/contributors`).

Please ensure all website traffic is forced over HTTPS and appropriate security headers (HSTS, CSP) are configured.
