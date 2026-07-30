#!/usr/bin/env bash
#
# Deploy eseguito SUL VPS. Lo copia e lo lancia la GitHub Action, ma è pensato
# per funzionare anche a mano:
#
#   cd /opt/dextlab/deploy-docker && ./remote-deploy.sh sha-abc1234
#
# Sta nel repository invece di essere generato dentro il workflow così è
# leggibile, versionato e utilizzabile senza passare da GitHub.
#
# Se il container nuovo non diventa sano entro il timeout, si torna
# automaticamente all'immagine precedente e si esce con errore: un deploy
# automatico su ogni push non deve poter lasciare il sito giù.
set -euo pipefail

IMAGE_TAG="${1:?uso: remote-deploy.sh <image-tag>}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "ERRORE: manca il file .env in $(pwd)." >&2
  echo "Copialo da .env.example e compila almeno APP_SECRET, SITE_HOST, SITE_URL e DB_*." >&2
  exit 1
fi

compose() { docker compose "$@"; }

current_image() {
  local cid
  cid="$(compose ps -q web 2>/dev/null || true)"
  [ -n "$cid" ] || return 0
  docker inspect -f '{{.Config.Image}}' "$cid" 2>/dev/null || true
}

# Tag attualmente in esecuzione, per poter tornare indietro.
PREVIOUS_IMAGE="$(current_image)"
if [ -n "$PREVIOUS_IMAGE" ]; then
  echo "In esecuzione ora: $PREVIOUS_IMAGE"
else
  echo "Nessun container attivo: primo avvio."
fi

echo "Scarico l'immagine con tag $IMAGE_TAG..."
IMAGE_TAG="$IMAGE_TAG" compose pull web

echo "Avvio il container..."
# L'entrypoint applica le migrazioni prima di avviare il server: se falliscono
# il container non parte e l'attesa dello stato sano scade.
IMAGE_TAG="$IMAGE_TAG" compose up -d web

wait_healthy() {
  local cid deadline status
  cid="$(compose ps -q web)"
  if [ -z "$cid" ]; then
    echo "ERRORE: nessun container avviato." >&2
    return 1
  fi
  deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}nohealth{{end}}' "$cid" 2>/dev/null || echo missing)"
    case "$status" in
      healthy)
        echo "Container sano."
        return 0
        ;;
      nohealth)
        # Immagine senza healthcheck: si verifica almeno che sia in esecuzione.
        if [ "$(docker inspect -f '{{.State.Running}}' "$cid")" = "true" ]; then
          echo "Container in esecuzione (immagine senza healthcheck)."
          return 0
        fi
        ;;
      unhealthy)
        echo "Container marcato unhealthy." >&2
        return 1
        ;;
    esac
    sleep 3
  done
  echo "ERRORE: il container non è diventato sano entro ${HEALTH_TIMEOUT}s." >&2
  return 1
}

if wait_healthy; then
  echo
  echo "Deploy completato: $IMAGE_TAG"
  # Le immagini non più referenziate occupano spazio: il VPS ha disco limitato.
  docker image prune -f --filter "until=168h" >/dev/null 2>&1 || true
  exit 0
fi

echo
echo "--- ultime righe di log del container ---" >&2
compose logs --tail 60 web >&2 || true

if [ -z "$PREVIOUS_IMAGE" ]; then
  echo >&2
  echo "Nessuna versione precedente a cui tornare: il container resta fermo." >&2
  exit 1
fi

PREVIOUS_TAG="${PREVIOUS_IMAGE##*:}"
echo >&2
echo "Torno alla versione precedente ($PREVIOUS_TAG)..." >&2
if IMAGE_TAG="$PREVIOUS_TAG" compose up -d web && wait_healthy; then
  echo "Rollback riuscito: il sito gira di nuovo su $PREVIOUS_TAG." >&2
else
  echo "ATTENZIONE: anche il rollback è fallito. Il sito potrebbe essere giù." >&2
fi

# Si esce comunque con errore: il deploy richiesto non è andato a buon fine.
exit 1
