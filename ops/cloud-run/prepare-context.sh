#!/usr/bin/env bash
set -euo pipefail
script_dir=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_root=$script_dir
while [[ ! -d "$repo_root/lib/emsenn/services/561-group" || ! -d "$repo_root/lib/emsenn/services/561-group/services/board-of-directors" ]]; do parent=$(dirname -- "$repo_root"); [[ "$parent" != "$repo_root" ]] || exit 66; repo_root=$parent; done
context_dir=${1:-}
[[ "$context_dir" == /tmp/* ]] || { echo "usage: $0 /tmp/build-context" >&2; exit 64; }
copy_path() {
  local relative=$1 source="$repo_root/$1" target="$context_dir/$1"
  [[ -e "$source" ]] || { echo "missing build input: $source" >&2; exit 66; }
  if [[ -d "$source" ]]; then mkdir -p "$target"; tar --exclude='./node_modules' --exclude='./data' --exclude='./.git' -C "$source" -cf - . | tar -C "$target" -xf -;
  else mkdir -p "$(dirname -- "$target")"; cp "$source" "$target"; fi
}
mkdir -p "$context_dir"
base=lib/emsenn/services/561-group/services
wit=$base/lenticule-science/services/obsmetrological-services-section/services/wit-transition-assay
for path in package.json package-lock.json src bin content/contracts content/agent-cards content/agent-card-signing content/evm/accounts/eip155-5615610.json; do copy_path "$wit/$path"; done
for cell in rmn-semantic-conformance rwil-rdf-projection-service; do
  dep=$base/lenticule-science/services/obsmetrological-services-section/services/$cell
  copy_path "$dep/package.json"; copy_path "$dep/src"; [[ ! -d "$dep/bin" ]] || copy_path "$dep/bin"; [[ ! -d "$dep/types" ]] || copy_path "$dep/types"
done
a2a=$base/red-cup-engineering/services/web-services-section/services/a2a-services-section/services
for cell in a2a-agent-card-discovery-service a2a-agent-card-key-service a2a-contracted-agent-service a2a-rmn-part-service a2a-rmn-task-client-service; do copy_path "$a2a/$cell/package.json"; copy_path "$a2a/$cell/src"; done
cp "$script_dir/Dockerfile" "$context_dir/Dockerfile"
cp "$script_dir/cloudbuild.yaml" "$context_dir/cloudbuild.yaml"
