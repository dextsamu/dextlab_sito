# Dext Lab — immagine dell'applicazione Astro in modalità server.
#
# Build multi-stadio: le dipendenze di sviluppo servono solo a compilare e non
# finiscono nell'immagine finale.

ARG NODE_IMAGE=node:22-alpine

# pg_dump serve al backup. Va allineato alla versione del server PostgreSQL:
# pg_dump rifiuta di leggere un server più recente di sé. Con un Postgres 17
# passare --build-arg PG_CLIENT=postgresql17-client.
ARG PG_CLIENT=postgresql16-client

# --- dipendenze complete (build) ---
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- compilazione ---
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- sole dipendenze di runtime ---
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- immagine finale ---
FROM ${NODE_IMAGE} AS runtime
ARG PG_CLIENT
RUN apk add --no-cache "${PG_CLIENT}"

WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4321 \
    BACKUP_DIR=/app/data/backups

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY migrations ./migrations
COPY scripts ./scripts
COPY deploy-docker/entrypoint.sh /usr/local/bin/entrypoint.sh

# L'utente "node" esiste già nell'immagine ufficiale: il processo non gira come root.
RUN chmod +x /usr/local/bin/entrypoint.sh \
 && mkdir -p /app/data/backups \
 && chown -R node:node /app/data

USER node
EXPOSE 4321

# L'healthcheck resta interno al container: Traefik instrada in base alle label.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4321)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "./dist/server/entry.mjs"]
