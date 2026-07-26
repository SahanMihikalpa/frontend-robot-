FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Optional — enables YouTube keyword search in the study-break "Rest video".
# NEXT_PUBLIC_* is inlined into the client bundle at build time, so it must be set
# here (a build arg), not at runtime. Empty = search disabled (paste-a-link still works).
ARG NEXT_PUBLIC_YOUTUBE_API_KEY=
ENV NEXT_PUBLIC_YOUTUBE_API_KEY=$NEXT_PUBLIC_YOUTUBE_API_KEY

# Ensure public dir exists (Next.js requires it)
RUN mkdir -p public

RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -qO- http://localhost:3000 || exit 1

CMD ["npm", "start"]
