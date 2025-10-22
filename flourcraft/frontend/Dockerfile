# FlourCraft Frontend Dockerfile
FROM node:18-alpine AS base

# Build stage
FROM base AS builder
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build:prod

# Production stage with nginx
FROM nginx:alpine AS runner

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built application
COPY --from=builder /app/dist/frontend /usr/share/nginx/html

# Copy PWA files
COPY --from=builder /app/dist/frontend/*.ico /usr/share/nginx/html/
COPY --from=builder /app/dist/frontend/manifest.json /usr/share/nginx/html/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S flourcraft -u 1001

# Set ownership
RUN chown -R flourcraft:nodejs /usr/share/nginx/html
RUN chown -R flourcraft:nodejs /var/cache/nginx
RUN chown -R flourcraft:nodejs /var/log/nginx
RUN chown -R flourcraft:nodejs /etc/nginx/conf.d

# Create nginx pid directory
RUN mkdir -p /var/run/nginx
RUN chown -R flourcraft:nodejs /var/run/nginx

# Switch to non-root user
USER flourcraft

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]