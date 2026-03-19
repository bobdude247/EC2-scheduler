# EC2 Scheduler

Lightweight starter project for scheduling Amazon EC2 instances to start/stop on a recurring schedule.

## Current GUI capabilities
- Browser-based Vue calendar interface
- Select a day and define start/stop windows
- Build multiple schedule entries for EC2 targets
- Export schedule definitions as YAML
- Import basic iCalendar (`.ics`) VEVENT entries into the schedule table

## Quick start
1) Install dependencies

- Preferred in this repo: `corepack pnpm install`
- If your environment has npm: `npm install`

2) Run the GUI dev server

- `corepack pnpm dev`
- or `npm run dev`

3) Open the local URL shown in terminal (Vite default is http://localhost:5173)

## Build and test
- `corepack pnpm build`
- `corepack pnpm test`

## Environment
Copy `.env.example` to `.env` and fill in your values.
