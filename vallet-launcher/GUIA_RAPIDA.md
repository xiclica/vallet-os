# Guía Rápida - Vallet OS

## 🚀 Inicio Rápido

### 1. Ejecutar la Aplicación

```bash
cd "c:\Dev\Go\Vallet OS GO\vallet-launcher"
wails dev
```

### 2. Primera Vez - Agregar Links

1. Cuando se abra la aplicación, verás una barra de búsqueda
2. Click en **"⚙ Admin"** (esquina inferior derecha)
3. Se abrirá el panel de administración

### 3. Crear tu Primer Link

En el formulario de la izquierda:
- **Nombre**: `GitHub`
- **URL**: `https://github.com`
- **Descripción**: `Repositorios de código`
- **Categoría**: `Desarrollo`
- Click en **"Crear"**

### 4. Agregar Más Links de Ejemplo

```
Nombre: Gmail
URL: https://mail.google.com
Categoría: Productividad

Nombre: YouTube
URL: https://youtube.com
Categoría: Entretenimiento

Nombre: ChatGPT
URL: https://chat.openai.com
Categoría: IA

Nombre: Notion
URL: https://notion.so
Categoría: Productividad
```

### 5. Usar la Búsqueda

1. Presiona `Esc` para cerrar el panel de administración
2. Escribe en el buscador: `git`
3. Verás aparecer "GitHub" como sugerencia
4. Presiona `Enter` o click en la sugerencia
5. Se abrirá GitHub en tu navegador

## ⌨️ Atajos de Teclado

| Tecla | Acción |
|-------|--------|
| `Enter` | Abrir el link/URL/aplicación |
| `Esc` | Ocultar ventana (o cerrar panel admin) |
| Click "⚙ Admin" | Abrir panel de administración |

## 🎯 Casos de Uso

### Búsqueda de Links Guardados
```
Escribe: "git" → Abre GitHub
Escribe: "mail" → Abre Gmail
Escribe: "you" → Abre YouTube
```

### Abrir URLs Directamente
```
Escribe: "google.com" → Abre Google
Escribe: "https://reddit.com" → Abre Reddit
```

### Ejecutar Aplicaciones de Windows
```
Escribe: "calc" → Abre Calculadora
Escribe: "notepad" → Abre Bloc de notas
Escribe: "mspaint" → Abre Paint
```

## 🗂️ Organización con Categorías

Usa categorías para organizar tus links:
- **Trabajo**: Slack, Teams, Email corporativo
- **Desarrollo**: GitHub, Stack Overflow, Documentación
- **Productividad**: Notion, Trello, Google Drive
- **Entretenimiento**: YouTube, Netflix, Spotify
- **IA**: ChatGPT, Claude, Gemini

## 📊 Gestión de Links

### Editar un Link
1. Abre el panel de administración (⚙ Admin)
2. En la lista de la derecha, click en el botón **✎** (lápiz)
3. Modifica los campos necesarios
4. Click en **"Actualizar"**

### Eliminar un Link
1. Abre el panel de administración
2. Click en el botón **🗑** (papelera)
3. Confirma la eliminación

### Cancelar Edición
- Si estás editando y quieres cancelar, click en **"Cancelar"**

## 💾 Ubicación de la Base de Datos

La base de datos SQLite se guarda en:
```
C:\Users\{TuUsuario}\.vallet-os\vallet.db
```

Puedes hacer backup de este archivo para guardar tus links.

## 🎨 Personalización

### Cambiar el Tamaño de la Ventana
Edita `main.go`:
```go
Width:  800,  // Ancho en píxeles
Height: 500,  // Alto en píxeles
```

### Cambiar Colores
Edita `frontend/src/App.css`, sección `:root`:
```css
--accent: #0071e3;  /* Color principal */
--danger: #ff3b30;  /* Color de eliminar */
--success: #34c759; /* Color de éxito */
```

## 🐛 Solución de Problemas

### La aplicación no inicia
```bash
# Verifica que estés en el directorio correcto
cd "c:\Dev\Go\Vallet OS GO\vallet-launcher"

# Ejecuta
wails dev
```

### Error de base de datos
- La base de datos se crea automáticamente
- Si hay problemas, elimina: `C:\Users\{TuUsuario}\.vallet-os\vallet.db`
- Se recreará al iniciar la app

### Los links no aparecen en la búsqueda
- Verifica que los links estén guardados en el panel de administración
- La búsqueda es sensible a mayúsculas/minúsculas parcialmente

## 📦 Compilar para Producción

Cuando estés listo para usar la app sin el modo desarrollo:

```bash
cd "c:\Dev\Go\Vallet OS GO\vallet-launcher"
wails build
```

El ejecutable estará en: `build\bin\vallet-os.exe`

¡Disfruta de tu launcher personalizado! 🚀
