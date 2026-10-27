# Run from any directory: source /absolute/path/to/scripts/env.sh
SVG_LAB_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]:-${(%):-%x}}")/.." && pwd)"
export PATH="$SVG_LAB_ROOT/.tools/node/bin:$PATH"
export npm_config_cache="$SVG_LAB_ROOT/.cache/npm"
export TMPDIR="$SVG_LAB_ROOT/.tmp"
