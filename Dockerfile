FROM node:18-alpine

WORKDIR /app

# Install necessary build tools
RUN apk add --no-cache python3 make g++

# Copy package.json files for backend only
COPY backend/package*.json ./backend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm install

# Copy backend source code
COPY backend ./

# Build backend TypeScript
RUN npm run build

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV STARTUP_TIMEOUT=300000
ENV DEBUG=express:*,mongoose:*

# Expose port
EXPOSE 8080

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/healthcheck || exit 1

# Start backend server with increased debugging
CMD ["sh", "-c", "node --trace-warnings --max-old-space-size=2048 dist/server.js"]
