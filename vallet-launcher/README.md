# Vallet Launcher

Una aplicación de escritorio tipo Alfred/Spotlight construida con Wails (Go + React + TypeScript) para Windows, con gestión de links mediante SQLite.

## 🚀 Funcionalidades Actuales

-   **Buscador Inteligente (`Ctrl + Shift + Space`)**: Acceso instantáneo a un buscador tipo Spotlight/Alfred.
    -   Abre URLs directamente (ej. `google.com`).
    -   Lanzar aplicaciones del sistema (ej. `notepad`, `calc`). (pendiente)
    -   Busca en tu base de datos de links personalizados.
-   **Transcripción de Voz a Texto (`Ctrl + Alt + Space`)**: usando un modelo local small de whisper genera transcripciones rapidas (en mi caso usando GPU).
    -   Graba audio y lo transcribe localmente con alta precisión.
    -   **Auto-Paste**: El texto transcrito se pega automáticamente en la aplicación que tengas abierta y tenga el focus input en ese momento.
-   **Gestión de Links (Panel Admin)**: CRUD completo para guardar tus sitios y comandos frecuentes.
-   **Interfaz Premium**: Diseño moderno con efectos de desenfoque (glassmorphism), animaciones suaves y modo siempre al frente.
-   **Base de Datos Local**: Todo se guarda de forma segura en una base de datos SQLite local.

## 🎙️ Configuración de Whisper (Tutorial)

Para habilitar la transcripción de voz local, sigue estos pasos:

1.  **Crear Carpeta**: En la raíz del proyecto, asegúrate de que existe una carpeta llamada `whisper/`.
2.  **Descargar CLI**: Descarga el binario `whisper-cli.exe` **adecuado para tu PC** [aquí](https://github.com/ggml-org/whisper.cpp/releases).
    -   Si tienes una tarjeta NVIDIA, busca las versiones con **CUDA** para mayor velocidad.
    -   Si no, usa la versión estándar para CPU.
3.  **Descargar Modelo**: Descarga el archivo del modelo `ggml-small.bin`. Hemos probado varios y el modelo **small** es el que mejor funciona, ofreciendo un equilibrio perfecto entre velocidad y precisión.
    -   [Descargar modelo small](https://huggingface.co/ggerganov/whisper.cpp/tree/main)
4.  **Ubicación de Archivos**: Coloca ambos archivos dentro de la carpeta `whisper/`.

La estructura final debe ser:
```text
vallet-launcher/
└── whisper/
    ├── whisper-cli.exe
    └── ggml-small.bin
```

> **Nota**: El sistema busca exactamente esos nombres de archivo para funcionar.

## 🏗️ Estructura del Proyecto

```
vallet-launcher/
├── main.go              # Configuración principal de Wails
├── app.go               # Lógica del backend y métodos expuestos
├── database.go          # Operaciones SQLite y modelos
├── frontend/
│   └── src/
│       ├── App.tsx      # Componente principal con búsqueda y admin
│       ├── App.css      # Estilos premium con glassmorphism
│       └── style.css    # Estilos globales
└── build/               # Recursos de compilación
```

## 🗄️ Base de Datos

La base de datos SQLite se crea automáticamente en:
- Windows: `C:\Users\{usuario}\.vallet-launcher\vallet.db`
- Mac/Linux: `~/.vallet-launcher/vallet.db`

### Estructura de la tabla `links`:
```sql
CREATE TABLE links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 Cómo Ejecutar

### Modo Desarrollo

```bash
cd vallet-launcher
wails dev
```

Esto iniciará:
1. El servidor de desarrollo de Vite (frontend)
2. La aplicación de escritorio con hot-reload

### Compilar para Producción

```bash
cd vallet-launcher
wails build
```

El ejecutable se generará en `build/bin/`.

## 🎨 Diseño

La aplicación utiliza:
- **Tipografía**: Inter (Google Fonts)
- **Efectos**: Glassmorphism con `backdrop-filter: blur(20px)`
- **Animaciones**: Transiciones suaves con cubic-bezier
- **Transparencia**: Ventana completamente transparente con efecto Acrylic en Windows
- **Diseño Responsivo**: Grid layout para el panel de administración

## 🔧 Tecnologías

- **Backend**: Go 1.21+
- **Base de Datos**: SQLite3 (github.com/mattn/go-sqlite3)
- **Frontend**: React 18 + TypeScript + Vite
- **Framework**: Wails v2.11.0
- **Estilos**: CSS puro (sin frameworks)

## 📝 Funcionalidades del Backend

### Búsqueda y Navegación
- `OpenSomething(input string)`: Busca en la BD, abre URLs o ejecuta aplicaciones
- `HideWindow()`: Oculta la ventana
- `ShowWindow()`: Muestra la ventana

### CRUD de Links
- `GetAllLinks()`: Obtiene todos los links guardados
- `GetLinkByID(id int)`: Obtiene un link específico
- `SearchLinks(query string)`: Busca links por nombre, URL o descripción
- `CreateLink(link Link)`: Crea un nuevo link
- `UpdateLink(link Link)`: Actualiza un link existente
- `DeleteLink(id int)`: Elimina un link

## 💡 Uso y Atajos

### Atajos Globales (En cualquier momento)
- **`Ctrl + Shift + Espacio`**: Abre/Muestra el buscador de Vallet Launcher.
- **`Ctrl + Alt + Espacio`**: Activa/Desactiva la grabación de voz (Whisper). Al terminar, el texto se pegará donde esté el cursor.

### Dentro de la Aplicación
- **`Enter`**: Ejecutar búsqueda, abrir URL o lanzar app.
- **`Esc`**: Ocultar la ventana o cerrar el panel de administración.
- **Click en "⚙ Admin"**: Abrir el gestor de links.

### Búsqueda Rápida
1. Presiona `Ctrl + Shift + Espacio`.
2. Escribe el nombre de un link guardado, una URL o una aplicación.
3. Presiona `Enter` para abrir.

### Administrar Links
1. Entra al panel de "⚙ Admin".
2. Gestiona tus links (Crear, Editar, Eliminar).
3. Aparecerán instantáneamente como sugerencias mientras escribes en el buscador principal.

## 🎯 Próximas Mejoras

- [ ] Importar/Exportar links.
- [ ] Estadísticas de uso.
- [ ] Temas personalizables (claro/oscuro).
- [ ] Soporte para iconos personalizados.
- [ ] Sincronización en la nube.

## 📄 Licencia

MIT
