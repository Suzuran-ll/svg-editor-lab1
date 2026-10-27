#!/usr/bin/env bash
set -euo pipefail

SVG_LAB_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SVG_LAB_ROOT"
mkdir -p .tools .cache/npm .tmp

if [[ ! -x .tools/node/bin/node ]]; then
  case "$(uname -s)" in
    Darwin) platform=darwin ;;
    Linux) platform=linux ;;
    *) echo 'This setup script supports macOS and Linux.' >&2; exit 1 ;;
  esac
  case "$(uname -m)" in
    arm64|aarch64) architecture=arm64 ;;
    x86_64) architecture=x64 ;;
    *) echo 'Unsupported CPU architecture.' >&2; exit 1 ;;
  esac
  version=24.22.1
  archive="node-v${version}-${platform}-${architecture}.tar.gz"
  curl -sSL --fail "https://nodejs.org/dist/v${version}/SHASUMS256.txt" -o .tools/SHASUMS256.txt
  curl -sSL --fail "https://nodejs.org/dist/v${version}/${archive}" -o ".tools/${archive}"
  expected="$(awk -v filename="$archive" '$2 == filename { print $1 }' .tools/SHASUMS256.txt)"
  if command -v shasum >/dev/null 2>&1; then
    actual="$(shasum -a 256 ".tools/$archive" | awk '{ print $1 }')"
  else
    actual="$(sha256sum ".tools/$archive" | awk '{ print $1 }')"
  fi
  if [[ -z "$expected" || "$expected" != "$actual" ]]; then
    echo 'Node archive checksum verification failed.' >&2
    exit 1
  fi
  mkdir -p .tools/node
  tar -xzf ".tools/$archive" -C .tools/node --strip-components=1
fi

source scripts/env.sh
if [[ "$(node --version)" != v24.* ]]; then
  echo 'This project requires Node 24.' >&2
  exit 1
fi
npm ci
echo 'Ready. Run: source scripts/env.sh; npm run cli'
