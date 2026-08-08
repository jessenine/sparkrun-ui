# syntax=docker/dockerfile:1.7

# Multi-stage build for the sparkrun-local-agent Rust binary targeting ARM64.
#
# agent-build.yml sets up Docker Buildx with --platform linux/arm64 and QEMU,
# so this builder compiles `cargo build --release` natively under ARM64
# emulation and produces an aarch64 binary. The binary is the only artifact the
# workflow cares about: it extracts it from /usr/local/bin/sparkrun-local-agent
# and ships it to the cluster node.

# -----------------------------------------------------------------------------
# Builder: cross-compile the agent under QEMU emulation.
# -----------------------------------------------------------------------------
FROM rust:1.97-bookworm AS builder

WORKDIR /agent

# Build toolchain for the transitive native crates (cmake/pkg-config etc.).
RUN apt-get update \
  && apt-get install -y --no-install-recommends build-essential pkg-config cmake \
  && rm -rf /var/lib/apt/lists/*

# Layer the manifest first so dependency compilation is cached across builds.
COPY Cargo.toml Cargo.lock ./

# Copy the real source and build. (No stub-cache step here: a stub src/ causes
# Docker/Cargo to skip the real rebuild and ship an empty binary.)
COPY src ./src
RUN cargo build --release \
  && cp target/release/sparkrun-local-agent /agent/sparkrun-local-agent \
  && strip /agent/sparkrun-local-agent

# -----------------------------------------------------------------------------
# Runtime: minimal Debian. The workflow runs `docker run ... cat
# /usr/local/bin/sparkrun-local-agent` to extract the binary, so there must be
# NO ENTRYPOINT here (args override CMD and run `cat` directly).
# -----------------------------------------------------------------------------
FROM debian:bookworm-slim AS runtime

COPY --from=builder /agent/sparkrun-local-agent /usr/local/bin/sparkrun-local-agent

CMD ["sparkrun-local-agent"]
