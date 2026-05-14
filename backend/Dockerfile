# STEP 1: Dependency installation (cached unless package.json changes)
FROM node:24 AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# STEP 2: Runtime image
FROM node:24-slim AS run
WORKDIR /app

# Install native PDF tooling required by node-poppler.
# This enables pdftotext/pdfimages/pdftocairo inside Cloud Run.
RUN apt-get update \
    && apt-get install -y --no-install-recommends poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

EXPOSE 8080
CMD ["node", "server.js"]
