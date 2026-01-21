FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Create a non-root user for security
# Running as non-root is a Docker best practice
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
# Switch to non-root user
USER nodejs

EXPOSE 3000

# Health check to verify container is running properly
# Docker will periodically check if the service is healthy
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "server.js"]