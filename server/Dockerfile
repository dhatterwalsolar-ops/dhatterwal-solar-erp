FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
COPY . .
RUN npx prisma generate
ENV NODE_ENV=production
ENV USE_PGLITE=false
EXPOSE 8787
CMD ["node", "index.js"]
