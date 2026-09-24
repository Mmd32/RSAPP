# Single-image deployment: builds the frontend, then serves it plus the API
# from one Node process. Works on Railway, Render, Fly.io and Koyeb.
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
# Override with a mounted volume path to make data survive redeploys.
ENV DATA_DIR=data

EXPOSE 3001
CMD ["npm", "start"]
