# Stage 1: Build the frontend application
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Build the Vue app for production
RUN npm run build

# Stage 2: Create the production image
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm install --production

COPY src/server ./src/server
COPY --from=builder /app/dist ./dist

EXPOSE 3001
CMD ["node", "src/server/index.js"]
