# Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Build backend
FROM node:20-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/ .

# Production image
FROM node:20-alpine
WORKDIR /app

# Install nginx to serve static files
RUN apk add --no-cache nginx

# Copy frontend build
COPY --from=frontend-build /app/dist ./dist

# Copy backend
COPY --from=backend-build /app/backend ./backend

# Configure nginx
COPY nginx.conf /etc/nginx/http.d/default.conf

# Create necessary directories
RUN mkdir -p /app/backend/data /app/backend/logs /run/nginx

WORKDIR /app/backend

# Expose ports
EXPOSE 80 3000

# Start script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

CMD ["/docker-entrypoint.sh"]
