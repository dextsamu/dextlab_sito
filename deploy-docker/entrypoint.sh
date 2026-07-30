#!/bin/sh
# Avvio del container: applica le migrazioni non ancora applicate, poi esegue il
# comando ricevuto.
#
# Le migrazioni girano qui perché il deploy è a container singolo e questo
# elimina un passaggio manuale a ogni aggiornamento. Il runner è idempotente:
# se non c'è nulla da applicare non fa nulla. Con più repliche in parallelo
# conviene disattivarlo (RUN_MIGRATIONS=false) e lanciarlo come job separato.
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] applico le migrazioni..."
  if ! node ./scripts/migrate.mjs; then
    echo "[entrypoint] migrazioni fallite: il container non parte." >&2
    exit 1
  fi
else
  echo "[entrypoint] RUN_MIGRATIONS=false, migrazioni saltate."
fi

echo "[entrypoint] avvio: $*"
exec "$@"
