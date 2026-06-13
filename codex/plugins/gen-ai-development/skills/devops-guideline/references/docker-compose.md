# docker-compose for Local Middleware

How to use docker-compose so a contributor can `git clone` and run the project **without installing or depending on any external middleware**. The compose file is a local-development convenience, not a deployment artifact.

## Scope: middleware only, dev only

- **Middleware only.** Orchestrate the stateful dependencies a dev needs locally — database (MySQL/PostgreSQL), message queue (Kafka/RabbitMQ/NSQ), cache (Redis), object store (MinIO). **Do not put your own service in compose.** The service runs on the host (`make server-run`) or in a debugger, so you can rebuild/restart/attach instantly without a compose round-trip. Compose owns the things you *don't* iterate on.
- **Dev only.** This file never ships to production. Production middleware is managed by the platform (k8s, managed cloud services); the repo's `deploy/k8s/` (or equivalent) is the prod story. Say so in a header comment so nobody points it at prod.
- **One concern per service entry.** Each compose service is one piece of middleware with its own healthcheck, so dependent steps can wait for "actually ready", not just "container started".

## Non-conflicting host ports (detect-then-create)

A fixed host port (e.g. `3306:3306`) collides the moment a contributor runs **two projects at once**, or already has a local MySQL. The convention: **the host port is allocated once, from a free port detected at first bring-up, then persisted and reused.** Each repo ends up on its own port; no coordination needed.

The container's internal port stays standard (`3306`); only the *host* side is dynamic.

```yaml
# docker-compose.yml — middleware only, host port injected by `make deps-up`
services:
  mysql:
    image: mysql:8
    container_name: ${COMPOSE_PROJECT_NAME:-app}-mysql   # project-scoped name avoids cross-repo clashes
    ports:
      - "${DEV_MYSQL_PORT:?run 'make deps-up' first to allocate a host port}:3306"
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_USER: app
      MYSQL_PASSWORD: app
      MYSQL_DATABASE: app
    volumes:
      - ./tmp/mysqldata:/var/lib/mysql
    command: >
      --character-set-server=utf8mb4
      --collation-server=utf8mb4_unicode_ci
      --default-time-zone='+00:00'
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-uapp", "-papp"]
      interval: 5s
      timeout: 5s
      retries: 10
```

Makefile side — allocate once, persist to a gitignored file, reuse:

```makefile
DEPS_ENV := tmp/deps.env
-include $(DEPS_ENV)          # provides DEV_MYSQL_PORT once allocated (empty on first run)

deps-up: ## start middleware on an auto-allocated free host port
	@mkdir -p tmp tmp/mysqldata
	@if [ -z "$(DEV_MYSQL_PORT)" ]; then \
		port=$$(python3 -c 'import socket;s=socket.socket();s.bind(("",0));print(s.getsockname()[1]);s.close()'); \
		echo "DEV_MYSQL_PORT=$$port" > $(DEPS_ENV); \
		echo "allocated free host port $$port for mysql → $(DEPS_ENV)"; \
	fi
	@set -a; . $(DEPS_ENV); set +a; docker compose up -d
	@. $(DEPS_ENV); echo "mysql reachable at 127.0.0.1:$$DEV_MYSQL_PORT"

deps-reset: ## wipe data AND release the allocated port
	docker compose down -v
	rm -rf tmp/mysqldata $(DEPS_ENV)
	$(MAKE) deps-up
```

The application's DSN is composed from the same `DEV_MYSQL_PORT` (e.g. in `.env`: `APP_DB_DSN=app:app@tcp(127.0.0.1:${DEV_MYSQL_PORT})/app?...`), so service and container always agree.

Notes:
- **Sticky allocation.** The port is picked *once* and persisted in `tmp/deps.env` (gitignored). Re-running `deps-up` reuses it, so the DSN stays valid across restarts; only `deps-reset` re-picks.
- **`COMPOSE_PROJECT_NAME`.** Scope the compose project (and container names / network / volumes) per repo so two projects' stacks never collide on names, only on ports.
- **The detect→bind race.** `bind(("",0))` asks the OS for a currently-free port; there's a tiny window before compose binds it. For local dev this is acceptable. If you want it race-free, bind an *ephemeral* host port in compose (`"0:3306"`) and discover the assigned one with `docker compose port mysql 3306` after `up`, then write that back to `tmp/deps.env` — Docker's allocation is atomic.
- Keep the data volume under the gitignored `tmp/` (e.g. `./tmp/mysqldata`) so a wipe is just `rm -rf`.
