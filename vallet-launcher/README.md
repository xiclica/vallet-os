# Vallet Launcher

Una aplicación de escritorio tipo Alfred/Spotlight construida con Wails (Go + React + TypeScript) para Windows, con gestión de links mediante SQLite.

## 🎯 Características

- **Interfaz Premium**: Diseño glassmorphism con efectos de blur estilo macOS
- **Siempre Accesible**: Ventana sin bordes, siempre al frente, transparente
- **Base de Datos SQLite**: Persistencia de links favoritos
- **Búsqueda Inteligente**: 
  - Busca en tus links guardados
  - Escribe una URL (ej: `google.com`, `https://github.com`) para abrir en el navegador
  - Escribe el nombre de una aplicación (ej: `calc`, `notepad`) para ejecutarla
- **Panel de Administración CRUD**:
  - Crear, editar y eliminar links
  - Organizar por categorías
  - Agregar descripciones
- **Sugerencias en Tiempo Real**: Muestra links guardados mientras escribes
- **Atajos de Teclado**:
  - `Enter`: Ejecutar búsqueda/abrir
  - `Esc`: Ocultar ventana (o cerrar panel admin)
  - Click en "⚙ Admin": Abrir panel de administración

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

## 💡 Uso

### Búsqueda Rápida
1. Abre la aplicación
2. Escribe el nombre de un link guardado, una URL o una aplicación
3. Presiona `Enter` para abrir
4. La ventana se ocultará automáticamente

### Administrar Links
1. Click en "⚙ Admin" en la barra de búsqueda
2. Completa el formulario con:
   - **Nombre**: Nombre corto para buscar (ej: "Gmail")
   - **URL**: Dirección completa (ej: "https://mail.google.com")
   - **Descripción**: Opcional, para recordar qué es
   - **Categoría**: Opcional, para organizar (ej: "Trabajo", "Personal")
3. Click en "Crear" para guardar
4. Los links aparecen en la lista de la derecha
5. Usa los botones ✎ (editar) o 🗑 (eliminar) para gestionar

### Búsqueda con Sugerencias
1. Empieza a escribir en el buscador
2. Verás sugerencias de links guardados que coincidan
3. Click en una sugerencia para abrirla directamente

## 🎯 Próximas Mejoras

- [ ] Agregar sistema de bandeja (tray icon) con hotkey global
- [ ] Importar/Exportar links
- [ ] Estadísticas de uso
- [ ] Temas personalizables (claro/oscuro)
- [ ] Soporte para iconos personalizados
- [ ] Sincronización en la nube

## 📄 Licencia

MIT
