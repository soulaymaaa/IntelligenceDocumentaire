FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (Tesseract, Sharp)
RUN apk add --no-cache python3 make g++ tesseract-ocr tesseract-ocr-data-fra tesseract-ocr-data-eng

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# ─── Production image ────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache tesseract-ocr tesseract-ocr-data-fra tesseract-ocr-data-eng

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

RUN mkdir -p uploads logs

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "dist/app.js"]
