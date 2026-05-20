#!/bin/bash
# Voice Input 扩展依赖安装脚本
set -e

echo "🎤 安装录音工具..."
if ! command -v arecord &>/dev/null && ! command -v ffmpeg &>/dev/null; then
    echo "尝试安装 alsa-utils..."
    sudo apt-get update -qq && sudo apt-get install -y alsa-utils || {
        echo "⚠ apt 安装失败，尝试 fallback 方案..."
        # 尝试 pip 安装 sounddevice（Python 录音）
        pip install sounddevice 2>/dev/null && echo "✅ 已安装 sounddevice (Python fallback)" || {
            echo "❌ 无法安装录音工具，请手动安装 alsa-utils:"
            echo "   sudo apt-get update && sudo apt-get install -y alsa-utils"
            exit 1
        }
    }
fi

# 检查录音设备
echo "📡 检查音频设备..."
if command -v arecord &>/dev/null; then
    # WSL2: 通过 PulseAudio 插件录音
    if arecord -L 2>/dev/null | grep -q pulse; then
        echo "✅ PulseAudio 录音源可用"
    else
        echo "⚠ 将使用默认 ALSA 设备（WSL2 下可能需要 PulseAudio 桥接）"
    fi
elif command -v ffmpeg &>/dev/null; then
    echo "✅ 将使用 ffmpeg 录音"
elif python3 -c "import sounddevice" 2>/dev/null; then
    echo "✅ 将使用 sounddevice (Python) 录音"
fi

# 检查并下载模型
MODEL_DIR="$HOME/.pi/models/voice/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17"
if [ -f "$MODEL_DIR/model.int8.onnx" ]; then
    echo "✅ SenseVoice 模型已就绪"
else
    echo "⏳ 下载 SenseVoice 模型 (~230MB)..."
    mkdir -p "$HOME/.pi/models/voice"
    TMP="/tmp/sherpa-onnx-sense-voice.tar.bz2"
    wget -q --show-progress -O "$TMP" \
        "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17.tar.bz2"
    tar xf "$TMP" -C "$HOME/.pi/models/voice/"
    rm -f "$TMP"
    echo "✅ 模型下载完成"
fi

echo ""
echo "🎉 安装完成！在 pi 中使用 /voice 开始录音"
