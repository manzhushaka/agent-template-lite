# Deployment Skeleton

The Builder Skill replaces `agent-template-lite` in service names and paths after project naming is confirmed. Keep the three services on loopback and expose only Nginx routes.

Runtime layout:

```text
/home/app/<project>/current/
/home/app/<project>/releases/<version>/
/home/app/<project>/shared/.env
/home/app/<project>/shared/var/lancedb/
```

Before a real deployment:

1. Install Node.js, pnpm, Python, uv, MySQL and Nginx on the application host.
2. Put real secrets in `shared/.env` with mode `0640` or stricter.
3. Build Chat and Console with the same base-path variables used by Nginx.
4. Preserve `shared/var/lancedb`, MySQL data, logs and the shared environment across releases.
5. Verify `/api/health` for all three services before switching `current`.

This directory is a deployment skeleton, not proof of a live release. The application host, ports, routes and credentials must be checked per generated project.
