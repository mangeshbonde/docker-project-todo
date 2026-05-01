# ─────────────────────────────────────────────────────────────────────────────
# Dockerfile — To-Do Node.js Application
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1: Build dependencies
FROM node:18-alpine AS builder

# Set working directory inside container
WORKDIR /app

# Copy only package files first (for Docker layer caching)
COPY package*.json ./

# Install production + dev dependencies
RUN npm install

# ─────────────────────────────────────────────────────────────────────────────

# Stage 2: Production image
FROM node:18-alpine

# Create non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy installed node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source code
COPY . .

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose application port
EXPOSE 3000

# Environment variables (can be overridden at runtime)
ENV NODE_ENV=production \
    PORT=3000 \
    DB_HOST=mysql \
    DB_PORT=3306 \
    DB_USER=todouser \
    DB_PASSWORD=todopass \
    DB_NAME=tododb

# Health check — verifies app is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "app.js"]
