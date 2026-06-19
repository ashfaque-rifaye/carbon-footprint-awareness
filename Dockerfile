# ---- Build stage ----
# Debian-based (glibc) image so better-sqlite3's prebuilt binary loads cleanly;
# build tools are included as a fallback in case a prebuild is unavailable.
FROM node:22-slim AS build
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies. Scripts run so the native better-sqlite3 binary is built/fetched.
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build: vite bundles the client, esbuild compiles the server
COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Local SQLite database path. /tmp is always writable on Cloud Run.
ENV DB_PATH=/tmp/carbonsync.db

# Copy the compiled output and node_modules (incl. the native better-sqlite3 binary)
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

# Cloud Run injects PORT at runtime; the server already reads process.env.PORT.
# dist/server.cjs is the compiled Express server; dist/ contains the static assets
# it serves in production mode.
EXPOSE 8080

CMD ["node", "dist/server.cjs"]
