#!/usr/bin/env bash
set -euo pipefail

REPO="2hoch1/ptero"
BASE_URL="https://github.com/${REPO}/releases/latest/download"

case "$(uname -m)" in
  aarch64|arm64) ARCH="arm64" ;;
  *)             ARCH="amd64" ;;
esac

BINARY="ptero-${ARCH}"
DEST="/usr/local/bin/ptero"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: curl -sSL https://ptero.2hoch1.dev/get.sh | sudo bash"
  exit 1
fi

echo "Downloading ptero (${ARCH})..."
curl -fsSL "${BASE_URL}/${BINARY}" -o "${DEST}"
curl -fsSL "${BASE_URL}/${BINARY}.sha256" -o "${DEST}.sha256"

echo "Verifying checksum..."
EXPECTED=$(awk '{print $1}' "${DEST}.sha256")
ACTUAL=$(sha256sum "${DEST}" | awk '{print $1}')

if [[ "${EXPECTED}" != "${ACTUAL}" ]]; then
  echo "[ERROR] Checksum mismatch - the downloaded binary may be corrupted or tampered with."
  rm -f "${DEST}" "${DEST}.sha256"
  exit 1
fi

rm -f "${DEST}.sha256"
chmod +x "${DEST}"
echo "ptero installed to ${DEST}"
echo ""
echo "Run: ptero init"
