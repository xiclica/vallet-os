---
description: Cómo crear un build funcional de Vallet Launcher con Whisper
---

Este workflow te guiará para crear una versión ejecutable (`.exe`) que incluya todos los archivos necesarios para que la IA (Whisper) funcione correctamente.

### 1. ¿Por qué no se incluyen los modelos automáticamente?
Los modelos de Whisper (como `ggml-small.bin`) pesan más de 150MB. Si los "embebemos" directamente en el código de Go:
- El ejecutable tardará mucho en abrirse.
- Consumirá muchísima memoria RAM innecesaria al inicio.
- El proceso de compilación de Wails podría fallar o ser extremadamente lento.

### 2. Pasos para el Build

1. **Compilar el Frontend y Backend:**
   Corre el comando estándar de Wails para generar el ejecutable limpio:
   ```powershell
   wails build
   ```
   Esto creará un archivo en `build/bin/vallet-launcher.exe`.

2. **Crear la carpeta de Recursos:**
   Ve a la carpeta donde se generó el build (`build/bin/`) y crea una subcarpeta llamada `resources`.

3. **Copiar Archivos Externos:**
   Copia los siguientes archivos dentro de la nueva carpeta `resources`:
   - `whisper-cli.exe` (El motor de Whisper)
   - `ggml-small.bin` (El modelo de inteligencia artificial)
   - Cualquier otra DLL necesaria (como `cudart64_12.dll` si usas GPU).

### 3. Estructura Final Recomendada
Para que puedas distribuir tu aplicación (en un `.zip`), la carpeta debe verse así:
```text
vallet-launcher/
├── vallet-launcher.exe (App principal)
└── resources/
    ├── whisper-cli.exe
    ├── ggml-small.bin
    └── ... (DLLs de GPU si aplican)
```

### 4. Automatización (Opcional)
Puedes usar este comando para automatizar la recolección si ya tienes los archivos en sus carpetas originales:

```powershell
# Crear carpetas
mkdir -Path "build/bin/resources" -Force

# Copiar ejecutable principal (después de wails build)
# Copy-Item "whisper/whisper-cublas-12.4.0-bin-x64/Release/whisper-cli.exe" "build/bin/resources/"
# Copy-Item "whisper/whisper.cpp.small/models/ggml-small.bin" "build/bin/resources/"
```
