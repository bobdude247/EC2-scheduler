# EC2 Scheduler

Lightweight starter project for scheduling Amazon EC2 instances to start/stop on a recurring schedule.

## Planned capabilities
- Define instance schedules (by tag, instance ID, or Auto Scaling group)
- Start instances in a morning window
- Stop instances in an evening window
- Dry-run mode for safe validation
- CI lint/test checks

## Quick start
```bash
npm install
npm run dev
```

## Environment
Copy `.env.example` to `.env` and fill in your values.

