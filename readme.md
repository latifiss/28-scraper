<div style={{ textAlign: 'center' }}>
  <Image
    style={{ width: 150, height: 100 }}
    src="/android-chrome-192x192.png"
    alt="28 Scraper Logo"
    width={150}
    height={100}
  />
  <p style={{ marginTop: 14 }}>28 Scraper</p>
</div>

A production-ready market intelligence scraper service built with Node.js. This project collects, normalizes, and syncs financial market data from multiple sources into a central API/database system.

It is designed to run continuously as a background service, using scheduled jobs to fetch and update live market information including:

- **Forex exchange rates**
- **Interbank rates**
- **Cryptocurrency prices**
- **Commodities data**
- **Market indices**
- **GSE stocks (live + fundamentals)**
- **Market status updates**

---

## Overview

`28-scraper` acts as an automated data ingestion layer for a broader financial platform.

Instead of exposing public endpoints directly, this service focuses on:

- Scraping data from multiple external sources
- Cleaning and validating records
- Synchronizing updates with a target API
- Maintaining historical entries for trend tracking
- Running scheduled background jobs at defined intervals

This makes it ideal for dashboards, finance apps, market trackers, and analytics systems.

---

## Key Features

### Automated Scheduling

Uses **node-cron** to run scraping jobs at fixed intervals.

Examples:

- Forex updates every **5 minutes**
- Crypto updates every **10 minutes**

---

### Historical Data Tracking

Before updating current values, the system stores historical entries for:

- Forex pairs
- Cryptocurrencies
- Other supported market instruments

This enables charting, performance analysis, and long-term insights.

---

### API Synchronization

Scraped records are pushed to a connected backend API for storage and management.

Supports:

- Create if record does not exist
- Update if record exists
- Append historical entries

---

### Modular Scraper Architecture

Each market type is separated into dedicated jobs and scripts for maintainability.

This makes it easy to:

- Add new scrapers
- Replace data providers
- Scale individual modules independently

---

## Project Structure

```bash
28-scraper/
│
├── app.js                  # Application entry point
├── jobs/                   # Scheduled scraper jobs
│   ├── forex.job.js
│   ├── interbank.job.js
│   ├── commodities.job.js
│   ├── crypto.job.js
│   ├── indice.job.js
│   ├── marketStatus.job.js
│   └── stocks/
│       ├── base.js
│       └── caps.js
│
├── scripts/                # Individual scraping logic / providers
├── seed/                   # Seed data / bootstrap helpers
├── public/                 # Static assets (favicon, images)
└── package.json
```

---

## Tech Stack

- **Node.js**
- **Express.js**
- **Axios**
- **Cheerio**
- **Puppeteer**
- **Puppeteer Extra + Stealth Plugin**
- **Node-Cron**
- **Redis**
- **MongoDB / Mongoose**

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/latifiss/28-scraper.git
cd 28-scraper
```

---

### 2. Install Dependencies

```bash
npm install
```

---

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
PORT=9000
API_BASE_URL=http://localhost:6060/api
```

Add any additional credentials required by your scraper providers.

---

## Running the Project

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

---

## How It Works

When the server starts:

1. Express initializes middleware and logging
2. All scraper jobs are loaded automatically
3. Cron schedules begin execution
4. Data is fetched from configured providers
5. Records are validated and normalized
6. Data is pushed to the connected API
7. Historical snapshots are saved

---

## Example Workflow

### Crypto Job

- Fetches data from configured crypto providers
- Checks if asset exists in target API
- Creates asset if missing
- Updates pricing if found
- Saves historical price entry

---

### Forex Job

- Runs every 5 minutes (weekdays only)
- Skips weekends automatically
- Syncs exchange pair data
- Stores pricing history before updates

---

## Scalability Notes

This project is structured for long-term expansion.

Recommended improvements for production:

- Docker containerization
- CI/CD deployment pipeline
- Centralized logging
- Retry queues for failed jobs
- Monitoring dashboards
- Proxy rotation for scraping resilience

---

## Use Cases

- Financial dashboards
- Currency converters
- Crypto trackers
- Market analytics platforms
- Stock monitoring tools
- Investment research systems

---

## Security & Reliability

Built with:

- Request timeouts
- Error handling middleware
- Validation checks
- Graceful shutdown support
- Rate limiting dependencies available
- Stealth scraping support for anti-bot environments

---

## Future Enhancements

- WebSocket live feeds
- Alerting engine
- Multi-region scraping nodes
- AI-powered anomaly detection
- Public API gateway

---

## License

ISC License

---

## Author

Developed by **Latif Issaka**

If you found this project useful, consider starring the repository.
