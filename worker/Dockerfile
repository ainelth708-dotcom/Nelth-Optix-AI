FROM oven/bun:1 AS runtime
WORKDIR /srv/worker
COPY server.ts ./
ENV WORKER_PORT=8787 \
    WORKER_ROOT=/data \
    COMMAND_TIMEOUT_MS=60000
VOLUME ["/data"]
EXPOSE 8787
CMD ["bun", "server.ts"]
