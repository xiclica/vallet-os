package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"vallet-launcher/ai"
	"vallet-launcher/audio"
	"vallet-launcher/utils"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// ProcessAudio recibe el audio en formato base64 desde el frontend, lo transcribe usando Whisper
// y pega el texto resultante en la aplicación activa del usuario.
func (a *App) ProcessAudio(base64Data string) {
	fmt.Println("🎙️ Procesando audio recibido...")

	// 1. Decodificar la cadena base64 a bytes.
	data, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		log.Printf("Error decodificando audio: %v", err)
		return
	}

	// 2. Guardar los bytes en un archivo temporal .wav.
	tempFile := filepath.Join(os.TempDir(), "vallet_voice.wav")
	err = os.WriteFile(tempFile, data, 0644)
	if err != nil {
		log.Printf("Error guardando audio temporal: %v", err)
		return
	}

	// 3. Inicializar el cliente de Whisper y transcribir el archivo.
	whisper, err := ai.NewWhisperClient()
	if err != nil {
		log.Printf("Error inicializando Whisper: %v", err)
		return
	}

	text, err := whisper.Transcribe(tempFile)
	if err != nil {
		log.Printf("Error en la transcripción: %v", err)
		return
	}

	// 4. Si hay texto, pegarlo automáticamente usando las utilidades del sistema.
	if text != "" {
		fmt.Printf("📝 Transcripción: %s\n", text)
		err = utils.PasteText(text)
		if err != nil {
			log.Printf("Error pegando texto: %v", err)
		}
	} else {
		fmt.Println("⚠️ No se detectó texto en el audio.")
	}
}

// App representa la estructura principal de la aplicación Wails.
type App struct {
	ctx context.Context // Contexto de la aplicación Wails.
	db  *Database       // Referencia a la base de datos SQLite.
}

// NewApp crea una nueva instancia de la aplicación.
func NewApp() *App {
	return &App{}
}

// startup se ejecuta automáticamente cuando Wails arranca.
// Se usa para inicializar la base de datos y configurar hotkeys.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Conectar a la base de datos local.
	db, err := NewDatabase()
	if err != nil {
		log.Fatal("Error inicializando base de datos:", err)
	}
	a.db = db

	// Configurar los atajos de teclado globales (Ctrl+Alt+Espacio, etc.).
	a.setupHotkeys(ctx)
}

// domReady se ejecuta cuando el frontend (HTML/JS) ha terminado de cargar.
func (a *App) domReady(ctx context.Context) {
	// Espacio para lógica adicional post-carga.
}

// beforeClose se ejecuta antes de que la ventana se cierre.
// Permite implementar la opción de "minimizar a la bandeja" en vez de cerrar.
func (a *App) beforeClose(ctx context.Context) (prevent bool) {
	bg, _ := a.GetSettingBackend("run_in_background")
	if bg == "true" {
		wailsruntime.WindowHide(a.ctx)
		return true // Cancela el cierre y oculta la ventana.
	}

	if a.db != nil {
		a.db.Close()
	}
	return false
}

// shutdown se llama al terminar definitivamente la aplicación.
func (a *App) shutdown(ctx context.Context) {
	if a.db != nil {
		a.db.Close()
	}
}

// openURLWithBrowser abre una URL utilizando un navegador específico o el del sistema.
func (a *App) openURLWithBrowser(url string) error {
	browser, err := a.db.GetSetting("default_browser")
	if err != nil || browser == "" || browser == "system" {
		// Abre con el navegador predeterminado del sistema operativo.
		wailsruntime.BrowserOpenURL(a.ctx, url)
		return nil
	}

	// Lógica específica para abrir navegadores en Windows si se ha configurado uno.
	if runtime.GOOS == "windows" {
		var cmd *exec.Cmd
		switch browser {
		case "chrome":
			cmd = exec.Command("cmd", "/C", "start", "chrome", url)
		case "firefox":
			cmd = exec.Command("cmd", "/C", "start", "firefox", url)
		case "edge":
			cmd = exec.Command("cmd", "/C", "start", "msedge", url)
		case "brave":
			cmd = exec.Command("cmd", "/C", "start", "brave", url)
		case "opera":
			cmd = exec.Command("cmd", "/C", "start", "opera", url)
		default:
			wailsruntime.BrowserOpenURL(a.ctx, url)
			return nil
		}
		return cmd.Start()
	}

	wailsruntime.BrowserOpenURL(a.ctx, url)
	return nil
}

// OpenSomething procesa la entrada del buscador (un comando, una URL o un alias guardado).
func (a *App) OpenSomething(input string) {
	input = strings.TrimSpace(input)
	if input == "" {
		return
	}

	// 1. Buscar si el input coincide con un alias de link en la base de datos.
	links, err := a.db.SearchLinks(input)
	if err == nil && len(links) > 0 {
		a.openURLWithBrowser(links[0].URL)
		wailsruntime.WindowHide(a.ctx)
		return
	}

	// 2. Verificar si es una URL directa (ej: google.com).
	if strings.HasPrefix(input, "http://") || strings.HasPrefix(input, "https://") || (strings.Contains(input, ".") && !strings.Contains(input, " ")) {
		url := input
		if !strings.HasPrefix(input, "http") {
			url = "https://" + input
		}
		a.openURLWithBrowser(url)
	} else {
		// 3. Intentar ejecutarlo como un comando del sistema (abrir apps como 'notepad').
		if runtime.GOOS == "windows" {
			exec.Command("cmd", "/C", "start", "", input).Start()
		} else {
			exec.Command("open", input).Start()
		}
	}

	// Ocultar la ventana del launcher después de realizar la acción.
	wailsruntime.WindowHide(a.ctx)
}

// HideWindow oculta la ventana principal.
func (a *App) HideWindow() {
	wailsruntime.WindowHide(a.ctx)
}

// ShowWindow restaura y muestra la ventana principal.
func (a *App) ShowWindow() {
	wailsruntime.WindowUnminimise(a.ctx)
	wailsruntime.WindowShow(a.ctx)
	wailsruntime.EventsEmit(a.ctx, "window-shown")
}

// SetAdminSize ajusta el tamaño de la ventana para el panel de administración.
func (a *App) SetAdminSize() {
	if runtime.GOOS == "windows" {
		utils.CenterWindowNoActivate("Vallet Launcher", 1280, 900)
	} else {
		wailsruntime.WindowSetSize(a.ctx, 1280, 800)
		wailsruntime.WindowCenter(a.ctx)
	}
}

// SetLauncherSize ajusta el tamaño de la ventana al modo buscador minimalista.
func (a *App) SetLauncherSize() {
	if runtime.GOOS == "windows" {
		utils.CenterWindowNoActivate("Vallet Launcher", 720, 150)
	} else {
		wailsruntime.WindowSetSize(a.ctx, 720, 150)
		wailsruntime.WindowCenter(a.ctx)
	}
}

// SetLauncherExpandedSize expande la ventana para mostrar sugerencias de búsqueda.
func (a *App) SetLauncherExpandedSize() {
	if runtime.GOOS == "windows" {
		utils.CenterWindowNoActivate("Vallet Launcher", 720, 480)
	} else {
		wailsruntime.WindowSetSize(a.ctx, 720, 480)
		wailsruntime.WindowCenter(a.ctx)
	}
}

// SetRecordingSize ajusta la ventana a un indicador pequeño durante la grabación de voz.
func (a *App) SetRecordingSize() {
	if runtime.GOOS == "windows" {
		utils.CenterWindowNoActivate("Vallet Launcher", 280, 80)
	} else {
		wailsruntime.WindowSetSize(a.ctx, 280, 80)
		wailsruntime.WindowCenter(a.ctx)
	}
}

// ============ Operaciones CRUD para Links y Settings ============

// GetAllLinks obtiene todos los links guardados por el usuario.
func (a *App) GetAllLinks() ([]Link, error) {
	return a.db.GetAllLinks()
}

// GetLinkByID busca un link específico por su identificador único.
func (a *App) GetLinkByID(id int) (*Link, error) {
	return a.db.GetLinkByID(id)
}

// SearchLinks busca links que coincidan con el texto ingresado.
func (a *App) SearchLinks(query string) ([]Link, error) {
	return a.db.SearchLinks(query)
}

// CreateLink guarda un nuevo link con su alias en la base de datos.
func (a *App) CreateLink(link Link) (int64, error) {
	return a.db.CreateLink(link)
}

// UpdateLink actualiza los datos de un link existente.
func (a *App) UpdateLink(link Link) error {
	return a.db.UpdateLink(link)
}

// DeleteLink elimina un link de la base de datos.
func (a *App) DeleteLink(id int) error {
	return a.db.DeleteLink(id)
}

// GetSettingBackend recupera un valor de configuración desde la base de datos.
func (a *App) GetSettingBackend(key string) (string, error) {
	return a.db.GetSetting(key)
}

// UpdateSettingBackend actualiza o crea un valor de configuración.
func (a *App) UpdateSettingBackend(key, value string) error {
	return a.db.UpdateSetting(key, value)
}

// PlaySound reproduce un archivo de audio WAV situado en la carpeta 'audios'.
func (a *App) PlaySound(name string) {
	// Intentar buscar el audio en:
	// 1. . (Desarrollo)
	// 2. resources/ (Producción)
	paths := []string{
		filepath.Join("audios", name),
		filepath.Join("resources", "audios", name),
	}

	var audioPath string
	for _, p := range paths {
		if _, err := os.Stat(p); err == nil {
			audioPath = p
			break
		}
	}

	if audioPath == "" {
		fmt.Printf("⚠️ Audio no encontrado: %s en ninguna ruta conocida.\n", name)
		return
	}

	// Reproducir el archivo usando la utilidad MCI.
	err := audio.PlayWav(audioPath)
	if err != nil {
		fmt.Printf("❌ Error reproduciendo audio %s: %v\n", name, err)
	}
}

// QuitApp cierra la aplicación de forma segura, disparando los hooks de limpieza.
func (a *App) QuitApp() {
	wailsruntime.Quit(a.ctx)
}
