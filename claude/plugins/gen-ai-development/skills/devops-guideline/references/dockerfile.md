# Dockerfile for Shipping a Service

How to build the **production image** of a service. This is the deploy artifact — distinct from [docker-compose.md](docker-compose.md), which is local-dev middleware only. The image contains *your* service; it does not contain the DB/MQ/cache.

Goals: small, reproducible, fast-to-rebuild, non-root, and **buildable from inside China** (domestic mirrors for every package source).

## Shape: multi-stage, static binary, minimal runtime

A builder stage compiles; a tiny runtime stage carries only the binary + its runtime needs. Nothing from the build toolchain leaks into the shipped image.

```dockerfile
# syntax=docker/dockerfile:1.7

# ---------- build stage ----------
ARG GO_VERSION=1.23
FROM golang:${GO_VERSION}-alpine AS builder

# China mirrors for Go modules (see "Domestic mirrors" below).
ENV CGO_ENABLED=0 \
    GOOS=linux \
    GOFLAGS=-trimpath \
    GOPROXY=https://goproxy.cn,direct \
    GOSUMDB=sum.golang.google.cn

WORKDIR /src

# Prime the module cache first so source edits don't bust dep download.
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .

ARG VERSION=dev
ARG TARGETARCH
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    GOARCH=${TARGETARCH:-amd64} \
    go build -ldflags "-s -w -X main.version=${VERSION}" \
      -o /out/app ./cmd/app

# ---------- runtime stage ----------
FROM alpine:3.20

# China mirror for apk, then the minimal runtime deps.
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories \
 && apk add --no-cache ca-certificates tzdata \
 && addgroup -S app && adduser -S -G app -H -h /app app

WORKDIR /app
COPY --from=builder /out/app /app/app

# Pre-create writable dirs with explicit ownership. Do NOT rely on COPY's
# implicit mkdir — it creates root-owned parents and bites you with EACCES
# when the non-root user tries to write logs.
RUN install -d -o app -g app -m 0755 /app/conf /app/logs

# Bake a config template; operators override via volume mount or env at runtime.
COPY --chown=app:app --chmod=0640 conf/app.prod.yaml /app/conf/app.yaml

USER app:app
EXPOSE 8080
ENTRYPOINT ["/app/app"]
```

Key points carried by this skeleton:
- **Static, stripped binary.** `CGO_ENABLED=0` + `-ldflags "-s -w"` + `-trimpath` → a self-contained binary that runs on a bare `alpine` (or `scratch`).
- **Version via build arg.** `--build-arg VERSION=v1.2.3` → `-X main.version=...`; the binary logs its own version.
- **Multi-arch ready.** `ARG TARGETARCH` + `GOARCH=${TARGETARCH}` lets `docker buildx --platform linux/amd64,linux/arm64` work.

## Domestic mirrors (build from inside China)

External package sources are slow or blocked from China; **default to domestic mirrors** for every ecosystem the image pulls from. Set them per-stage (build deps and OS packages live in different stages). Make them overridable via `ARG` so the same Dockerfile still builds abroad.

| Ecosystem | How | Mirror |
|-----------|-----|--------|
| Go modules | `ENV GOPROXY=https://goproxy.cn,direct  GOSUMDB=sum.golang.google.cn` | goproxy.cn (qiniu) |
| Alpine apk | `sed -i 's\|dl-cdn.alpinelinux.org\|mirrors.aliyun.com\|g' /etc/apk/repositories` before `apk add` | aliyun / ustc |
| Debian apt | rewrite sources to a mirror before `apt-get update` (see below) | aliyun / tuna |
| Node / npm / pnpm | `ENV npm_config_registry=https://registry.npmmirror.com` (pnpm & npm both honor it) | npmmirror (alibaba) |
| Python pip | `ENV PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple` | tuna / aliyun |
| Rust (rustup) | `ENV RUSTUP_DIST_SERVER=https://mirrors.tuna.tsinghua.edu.cn/rustup RUSTUP_UPDATE_ROOT=https://mirrors.tuna.tsinghua.edu.cn/rustup/rustup` | tuna / ustc |
| Rust (crates) | cargo sparse registry replacement (config snippet below) | ustc / tuna |

Debian apt (bookworm uses the deb822 file; older releases use sources.list — handle both):

```dockerfile
RUN set -eux; \
    sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' \
        /etc/apt/sources.list /etc/apt/sources.list.d/debian.sources 2>/dev/null || true; \
    apt-get update && apt-get install -y --no-install-recommends ca-certificates tzdata && \
    rm -rf /var/lib/apt/lists/*
```

Cargo crates mirror (write before `cargo build`/`cargo fetch`):

```dockerfile
RUN mkdir -p $CARGO_HOME && cat > $CARGO_HOME/config.toml <<'EOF'
[source.crates-io]
replace-with = "ustc"
[source.ustc]
registry = "sparse+https://mirrors.ustc.edu.cn/crates.io-index/"
[net]
git-fetch-with-cli = true
EOF
```

Make a mirror overridable so non-China CI opts out:

```dockerfile
ARG GOPROXY=https://goproxy.cn,direct
ENV GOPROXY=${GOPROXY}
# abroad: docker build --build-arg GOPROXY=https://proxy.golang.org,direct .
```

## Fast, correct layer caching

- **Copy manifests before sources.** `COPY go.mod go.sum` (or `package.json pnpm-lock.yaml`, `Cargo.toml Cargo.lock`) → fetch deps → *then* `COPY . .`. Editing source then doesn't re-download dependencies.
- **Use BuildKit cache mounts** for the package cache, and target the **real** cache path — a wrong path mounts an unused dir and **silently disables caching** (deps re-download every build, with no error to tell you). Verify the path against the base image, don't guess: `docker run --rm <base> go env GOMODCACHE GOCACHE`.
  - Go: `--mount=type=cache,target=/go/pkg/mod` (GOMODCACHE is `/go/pkg/mod` in `golang:*-alpine` — `/root/go/pkg/mod` is **wrong** and a common silent-miss) plus `--mount=type=cache,target=/root/.cache/go-build` (GOCACHE) on the *build* step.
  - pnpm: `--mount=type=cache,target=/root/.local/share/pnpm/store` (or set `pnpm store path`).
  - Cargo: `--mount=type=cache,target=/usr/local/cargo/registry --mount=type=cache,target=/src/target`.
- `# syntax=docker/dockerfile:1.7` (or later) at the top enables cache mounts and heredocs.

## Runtime hardening

- **Non-root, with clean ownership.** Create a dedicated user/group and `USER` to it. Pre-create every directory the process writes (logs, config) with explicit ownership using `install -d -o user -g group /app/conf /app/logs`, and copy files with `COPY --chown=user:group`. Do **not** `RUN mkdir -p /app && chown -R user:group /app` *before* the `COPY`s — anything copied afterward lands root-owned (COPY defaults to uid 0), and a recursive `chown` is a needless heavy layer. Order: create dirs → `COPY --chown` the binary and config.
- **Minimal base.** `alpine` (has a shell for debugging) or `scratch`/`distroless` for a static binary (smallest, no shell). For a `scratch`/distroless runtime you must still `COPY` `ca-certificates` and tzdata from the builder. Prefer `alpine` when you want `sh`/`apk` for incident debugging; note distroless images live on a Google registry that can be slow from China.
- **`ca-certificates` + `tzdata`.** Almost every service makes TLS calls and formats timestamps; without these you get x509 and UTC-only surprises.
- **Exec-form `ENTRYPOINT`** (`["/app/app"]`, JSON array) so signals (SIGTERM) reach the process for graceful shutdown — shell form swallows them.
- **`EXPOSE`** the listen port for documentation/tooling (it doesn't publish anything).

## Config, secrets, and the build context

- **Bake a placeholder template, override at runtime.** Copy a `*.prod.yaml` whose secret fields are **empty placeholders** to the default config path, so a zero-arg `docker run` starts and reads sane non-secret defaults; operators supply the real values by mounting a file (`-v .../prod.yaml:/app/conf/app.yaml:ro`) or via env vars (env should win over the file). Baking a placeholder template is safe; baking real secrets is not.
- **An image with baked credentials is a secret.** If the baked config ever carries real passwords/tokens, treat the image as confidential — never push it to a public registry. Default to injecting secrets at run time (env / secret-mount) and baking only non-secret defaults.
- **`.dockerignore` is mandatory.** Keep the build context small and secret-free. Without it, a `COPY . .` can pull in a **host-built binary** (e.g. a `go build` output sitting next to the Dockerfile — tens of MB), local DBs, and secrets. Minimum:

```gitignore
# .dockerignore (next to the Dockerfile)
.git
tmp/
*.db
*.env
.env
# host-built artifacts that must never enter the image
<service-binary-name>
dist/
node_modules/
target/
```

## Wiring into the task runner

Expose the image build/run through the Makefile so it's discoverable alongside everything else (see [make.md](make.md)). Keep these **separate** from the host-build targets (`server-build`/`server-run` compile and run the binary on the host for the inner loop) — the Docker targets are for verifying the shipped artifact:

```makefile
IMAGE   ?= myservice
VERSION ?= dev

server-docker-build: ## build the service image (VERSION overridable)
	docker build -t $(IMAGE):$(VERSION) --build-arg VERSION=$(VERSION) ./service

server-docker-run: deps-up server-docker-build ## run the image against compose middleware
	docker run --rm -p 8080:8080 \
	  --network $${COMPOSE_PROJECT_NAME:-app}_default \
	  -e APP_DB_DSN='app:app@tcp(mysql:3306)/app?parseTime=true&loc=UTC' \
	  -e APP_AUTH_TOKEN="$$APP_AUTH_TOKEN" \
	  $(IMAGE):$(VERSION)
```

The one subtlety: a **containerized** service does not reach compose middleware via the random *host* port — `127.0.0.1:<hostport>` is the container's own loopback. Instead, attach it to the compose network (`<project>_default`) and connect by the middleware's **service name on the internal port** (`mysql:3306`). The random host port from [docker-compose.md](docker-compose.md) is only for *host-side* clients (`make server-run`, a CLI); container-to-container traffic uses service names and standard internal ports, which need no allocation.

## Scope reminder

The image ships the service. Local development does **not** run the service in a container for the inner loop — that runs on the host (`make server-run`) against compose-managed middleware (see [docker-compose.md](docker-compose.md)). Use `server-docker-build` / `server-docker-run` to verify the shipped image, and build it in CI for prod/staging.
