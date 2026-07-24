#!/usr/bin/env bash
# Code Maniac — installa TUTTO in un colpo:
#   1) copia la skill in ~/.claude/skills/code-maniac
#   2) installa i tre aiutanti (graphify, caveman, ponytail), saltando i già presenti
#
# Uso (dalla cartella del repo):
#   bash install.sh
# Argomenti extra vengono passati a setup.mjs, es.:
#   bash install.sh --skills-dir ~/skills
set -euo pipefail
src="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dst="$HOME/.claude/skills/code-maniac"

echo "Code Maniac -> installo la skill in $dst"
mkdir -p "$dst"
( cd "$src" && tar --exclude='./.git' -cf - . ) | ( cd "$dst" && tar -xf - )

echo "Skill installata. Installo graphify, caveman, ponytail..."
node "$dst/scripts/setup.mjs" "$@"

echo "Fatto. Riavvia Claude Code."
