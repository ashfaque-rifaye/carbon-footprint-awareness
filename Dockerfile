# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app

# Install all dependencies (build tools included)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source and build: vite bundles the client, esbuild compiles the server
COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy only the compiled output and production node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

# Cloud Run injects PORT at runtime; the server already reads process.env.PORT.
# dist/server.cjs is the compiled Express server; dist/ contains the static assets
# it serves in production mode.
EXPOSE 8080

CMD ["node", "dist/server.cjs"]
