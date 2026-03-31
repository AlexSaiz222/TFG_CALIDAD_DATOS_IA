# ./frontend/Dockerfile (DESARROLLO)
FROM node:18-alpine
WORKDIR /app

# Instalar pnpm
RUN npm i -g pnpm

# Instalar dependencias usando el lockfile
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile

# Exponer el puerto de Next.js
EXPOSE 3000

# Arrancar Next en modo dev (HMR)
CMD ["pnpm", "dev"]