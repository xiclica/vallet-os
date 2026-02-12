# Configuración de Whisper (Voz a Texto)

Para que la funcionalidad de transcripción funcione, necesitas descargar dos archivos y colocarlos en la carpeta raíz de la aplicación (`vallet-os`) o en una carpeta `ai/`.

## 1. Descargar Whisper CLI (con soporte GPU)
Descarga el ejecutable `whisper-cli.exe` optimizado para NVIDIA/CUDA.
- Puedes encontrar versiones precompiladas en releases de proyectos como `const-me/Whisper` o `ggerganov/whisper.cpp` (busca builds de Windows con CUDA).
- Renombra el ejecutable a `whisper-cli.exe`.

## 2. Descargar Modelo
Descarga el modelo `ggml-small.bin`.
- Enlace oficial: https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin
- Colócalo junto al ejecutable o en `whisper/whisper.cpp.small/`.

## Estructura final esperada
```
vallet-os/
├── vallet-os.exe
├── whisper-cli.exe
└── ggml-small.bin
     (o en whisper/whisper.cpp.small/ggml-small.bin)
```

## Uso
1. Presiona `Ctrl + Alt + Space` para iniciar la grabación (oirás un aviso en la consola).
2. Habla.
3. Presiona `Ctrl + Alt + Space` nuevamente para detener.
4. Espera unos segundos y el texto se pegará automáticamente donde esté tu cursor.


