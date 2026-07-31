# Agent Template Deployment

The production project name is `agent-template`. Keep Chat, Console, AgentOS and the
knowledge worker on loopback and expose only the Nginx routes in
`agent-template.locations.conf`.

Runtime layout:

```text
/home/app/agent-template/current/
/home/app/agent-template/releases/<version>/
/home/app/agent-template/shared/.env
/home/app/agent-template/shared/var/lancedb/
```

Before a real deployment:

1. Install Node.js, pnpm, Python, uv, MySQL and Nginx on the application host.
2. Put the development-equivalent environment in `shared/.env` with mode `0640` or stricter.
3. Build Chat and Console with `/gateway/agent-template/chat` and
   `/gateway/agent-template/console` as their base paths.
4. Preserve `shared/var/lancedb`, logs and the shared environment across releases.
5. Verify all four loopback services before switching `current`.

The release workflow installs the files in this directory on the physical application host.
ECS remains the public Nginx/FRP edge and does not run the application.
