# Image aplikasi Classmeet (Next.js, mode produksi). Dibangun lewat deploy/supabase/docker-compose.app.yml
# (10-up.sh --server). NEXT_PUBLIC_* dipanggang saat build dan dikirim sebagai build arg dari stack/.env.
# Rahasia server (SUPABASE_SERVICE_ROLE_KEY, DISPLAY_*, ...) TIDAK masuk image; dibaca saat berjalan lewat env_file.
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npm run build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# node_modules ikut (lib/admin/qr-png.ts membaca wasm dari node_modules saat berjalan).
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/login').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
