# Estructura del Proyecto: Vallet OS

Este documento proporciona una visión general de la organización del proyecto y la función de cada uno de sus componentes principales.

## Directorios Principales

### 📂 `ai/`
Contiene la lógica de integración con inteligencia artificial.
- `whisper.go`: Maneja la ejecución de Whisper CLI para la transcripción de audio a texto.

### 📂 `audio/`
Encargado de la captura de sonido.
- `recorder.go`: Gestiona la grabación de audio desde el micrófono, guardando los archivos temporalmente para su procesamiento.

### 📂 `frontend/`
Contiene la interfaz de usuario construida con React, TypeScript y Vite.
- `src/App.tsx`: El componente principal que maneja la lógica de la interfaz, búsquedas y comunicación con el backend (Go).
- `src/App.css`: Estilos personalizados para la aplicación (efectos glassmorphism, layouts, etc.).

### 📂 `utils/`
Funciones de utilidad que interactúan con el sistema operativo.
- `input.go`: Permite la simulación de entrada de texto (pegar texto transcrito en otras apps).
- `win32_windows.go`: Funciones específicas de Windows para el manejo de ventanas y foco.

### 📂 `whisper/`
Almacena los binarios (`whisper-cli.exe`) y los modelos de lenguaje (archivos `.bin`) necesarios para que la transcripción funcione localmente.

### 📂 `build/`
Archivos generados tras el proceso de compilación de Wails.

---

## Archivos de la Raíz (Core Backend)

- **`main.go`**: Es el punto de entrada de la aplicación. Configura Wails, define el tamaño de la ventana inicial y arranca el ciclo de vida del programa.
- **`app.go`**: Actúa como el puente principal entre el código Go y el Frontend. Aquí se definen las funciones que el Frontend puede invocar (por ejemplo, iniciar grabación, buscar links, abrir URLs).
- **`database.go`**: Maneja la conexión y las operaciones CRUD con la base de datos SQLite local (`vallet.db`).
- **`hotkey.go`**: Configura los atajos de teclado globales (hotkeys) para que la aplicación responda incluso cuando no tiene el foco (ej. Ctrl+Alt+Espacio para grabar).
- **`wails.json`**: Configuración técnica del proyecto Wails.

---

## Flujo de Trabajo Típico

1. **Entrada**: El usuario presiona el atajo de teclado (`hotkey.go`).
2. **Acción**: La aplicación muestra la ventana y activa el grabador (`audio/recorder.go`).
3. **Procesamiento**: Al soltar las teclas, el audio se envía a Whisper (`ai/whisper.go`) para ser transcrito.
4. **Resultado**: El texto resultante se puede pegar automáticamente en la aplicación activa del usuario (`utils/input.go`) o mostrarse en el buscador del launcher (`App.tsx`).
