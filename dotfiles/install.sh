#!/bin/bash
# Links this repo's CLAUDE.md to ~/.claude/CLAUDE.md, so every Claude Code session on this machine starts with the
# same working rules and an edit here reaches all of them. An existing file is kept as CLAUDE.md.bak, never lost.
set -e
here="$(cd "$(dirname "$0")" && pwd)"
target="$HOME/.claude/CLAUDE.md"
mkdir -p "$HOME/.claude"
if [ -e "$target" ] && [ ! -L "$target" ]; then
  mv "$target" "$target.bak"
  echo "Kept your existing file as $target.bak"
fi
ln -sfn "$here/CLAUDE.md" "$target"
echo "Linked $target -> $here/CLAUDE.md"
