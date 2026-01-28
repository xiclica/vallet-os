# Script de Build Completo para Vallet Launcher
Write-Host "🚀 Iniciando Build de Vallet Launcher..." -ForegroundColor Cyan

# 1. Ejecutar Wails Build
Write-Host "🛠️ Ejecutando wails build..." -ForegroundColor Yellow
wails build
if ($LASTEXITCODE -ne 0) { 
    Write-Host "❌ Error en wails build" -ForegroundColor Red
    exit $LASTEXITCODE 
}

# 2. Definir rutas
$binDir = "build\bin"
$resDir = "$binDir\resources"
$whisperSource = "whisper\whisper-cublas-12.4.0-bin-x64\Release"
$modelSource = "whisper\whisper.cpp.small\ggml-small.bin"

# 3. Crear carpeta de recursos
Write-Host "📁 Creando carpeta de recursos en $resDir..." -ForegroundColor Yellow
if (!(Test-Path $resDir)) { 
    New-Item -ItemType Directory -Path $resDir -Force | Out-Null
}

# 4. Copiar Motor y DLLs (GPU/CUDA)
Write-Host "🔋 Copiando motor Whisper y librerías CUDA..." -ForegroundColor Yellow
if (Test-Path $whisperSource) {
    Copy-Item "$whisperSource\*" $resDir -Recurse -Force
} else {
    Write-Host "⚠️ No se encontró la carpeta de origen de Whisper: $whisperSource" -ForegroundColor Red
}

# 5. Copiar Modelo
Write-Host "🧠 Copiando modelo de IA (ggml-small.bin)..." -ForegroundColor Yellow
if (Test-Path $modelSource) {
    Copy-Item $modelSource $resDir -Force
} else {
    Write-Host "⚠️ No se encontró el modelo: $modelSource" -ForegroundColor Red
}

Write-Host "✅ Build completado con éxito en $binDir" -ForegroundColor Green
Write-Host "💡 Para distribuir: envía la carpeta 'bin' completa (incluyendo la subcarpeta 'resources')." -ForegroundColor Gray
