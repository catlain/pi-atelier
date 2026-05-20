#!/bin/bash
set -e

TMPDIR="/tmp/alsa-debs"
mkdir -p "$TMPDIR"

BASE="http://mirrors.aliyun.com/ubuntu/pool/main"

DEBS=(
  "a/alsa-lib/libatopology2t64_1.2.11-1ubuntu0.2_amd64.deb"
  "f/fftw3/libfftw3-single3_3.3.10-1ubuntu3_amd64.deb"
  "libs/libsamplerate/libsamplerate0_0.2.2-4build1_amd64.deb"
  "a/alsa-utils/alsa-utils_1.2.9-1ubuntu5_amd64.deb"
)

echo "📦 通过 Windows curl.exe 下载 alsa-utils（绕过 WSL2 网络问题）..."
for deb in "${DEBS[@]}"; do
  filename=$(basename "$deb")
  echo "  下载 $filename ..."
  curl.exe -sL -o "$TMPDIR/$filename" "$BASE/$deb"
  if [ ! -s "$TMPDIR/$filename" ]; then
    echo "❌ 下载失败: $filename"
    exit 1
  fi
done

echo "🔧 安装..."
sudo dpkg -i "$TMPDIR"/*.deb 2>/dev/null || sudo apt-get install -f -y 2>/dev/null || true

rm -rf "$TMPDIR"

# 验证
if command -v arecord &>/dev/null; then
  echo "✅ alsa-utils 安装成功！"
  echo "接下来运行: bash ~/.pi/agent/extensions/voice-input/setup.sh"
else
  echo "❌ 安装可能失败，请检查上方输出"
fi
