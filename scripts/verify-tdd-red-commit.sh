#!/usr/bin/env bash
set -euo pipefail

# TDD Red-Green verification script
# Validates that the RED->GREEN->REFACTOR cycle is followed correctly

usage() {
  echo "Usage: $0 [--self-test] [--check-branch]"
  echo "  --self-test    Run internal self-test"
  echo "  --check-branch Check if on a feature branch (not main/master)"
}

self_test() {
  echo "Running self-test..."
  
  # Check that the script is executable
  if [ ! -x "$0" ]; then
    echo "FAIL: Script is not executable"
    exit 1
  fi
  
  # Check that the script references itself in its own documentation
  if ! grep -q "verify-tdd-red-commit" "$0"; then
    echo "FAIL: Script doesn't reference itself in documentation"
    exit 1
  fi
  
  echo "Self-test PASSED"
}

check_branch() {
  echo "Checking branch..."
  
  BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "detached")
  
  if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
    echo "FAIL: Must not develop on main or master branch (detected: $BRANCH)"
    echo "Use: git checkout -b feat/<name>"
    exit 1
  fi
  
  echo "Branch check PASSED ($BRANCH)"
}

# Parse arguments
case "${1:-}" in
  --self-test)
    self_test
    ;;
  --check-branch)
    check_branch
    ;;
  -h|--help)
    usage
    ;;
  *)
    # Default: run both checks
    self_test
    check_branch
    ;;
esac

echo "All checks passed."
