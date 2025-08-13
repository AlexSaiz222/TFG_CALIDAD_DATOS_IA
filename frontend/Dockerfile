FROM node:18-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy only package files first to leverage Docker cache
COPY package.json pnpm-lock.yaml ./

# Clean install dependencies
RUN pnpm install --frozen-lockfile

# Copy only necessary files for the build
COPY next.config.js ./
COPY tsconfig.json ./
COPY next-env.d.ts ./
COPY public ./public
COPY src ./src
COPY .env.local ./

# Build application
RUN pnpm build

# Expose port
EXPOSE 3000

# Run the application
CMD ["pnpm", "start"]
