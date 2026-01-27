package main

import (
	"context"
	"log"
	"os/exec"
	"runtime"
	"strings"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
	db  *Database
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Inicializar base de datos
	db, err := NewDatabase()
	if err != nil {
		log.Fatal("Error initializing database:", err)
	}
	a.db = db
}

// domReady is called after front-end resources have been loaded
func (a *App) domReady(ctx context.Context) {
	// Aquí puedes agregar lógica después de que el DOM esté listo
}

// beforeClose is called when the application is about to quit
func (a *App) beforeClose(ctx context.Context) (prevent bool) {
	bg, _ := a.GetSettingBackend("run_in_background")
	if bg == "true" {
		wailsruntime.WindowHide(a.ctx)
		return true // Prevent closing
	}

	if a.db != nil {
		a.db.Close()
	}
	return false
}

// shutdown is called at application termination
func (a *App) shutdown(ctx context.Context) {
	if a.db != nil {
		a.db.Close()
	}
}

// OpenSomething tries to open either a URL or an application
func (a *App) OpenSomething(input string) {
	input = strings.TrimSpace(input)
	if input == "" {
		return
	}

	// Primero buscar en la base de datos
	links, err := a.db.SearchLinks(input)
	if err == nil && len(links) > 0 {
		// Si encuentra un link, abrirlo
		wailsruntime.BrowserOpenURL(a.ctx, links[0].URL)
		wailsruntime.WindowHide(a.ctx)
		return
	}

	// Check if it's a URL
	if strings.HasPrefix(input, "http://") || strings.HasPrefix(input, "https://") || (strings.Contains(input, ".") && !strings.Contains(input, " ")) {
		url := input
		if !strings.HasPrefix(input, "http") {
			url = "https://" + input
		}
		wailsruntime.BrowserOpenURL(a.ctx, url)
	} else {
		// Try to run as a command (Windows specific for now)
		if runtime.GOOS == "windows" {
			exec.Command("cmd", "/C", "start", "", input).Start()
		} else {
			// For Mac/Linux
			exec.Command("open", input).Start()
		}
	}

	// Hide the window after action
	wailsruntime.WindowHide(a.ctx)
}

// HideWindow hides the application window
func (a *App) HideWindow() {
	wailsruntime.WindowHide(a.ctx)
}

// ShowWindow shows the application window
func (a *App) ShowWindow() {
	wailsruntime.WindowShow(a.ctx)
}

func (a *App) SetAdminSize() {
	wailsruntime.WindowSetSize(a.ctx, 1200, 650)
	wailsruntime.WindowCenter(a.ctx)
}

// SetLauncherSize resizes the window for launcher mode
func (a *App) SetLauncherSize() {
	wailsruntime.WindowSetSize(a.ctx, 660, 120)
	wailsruntime.WindowCenter(a.ctx)
}

// ============ CRUD Operations for Links ============

// GetAllLinks returns all saved links
func (a *App) GetAllLinks() ([]Link, error) {
	return a.db.GetAllLinks()
}

// GetLinkByID returns a link by ID
func (a *App) GetLinkByID(id int) (*Link, error) {
	return a.db.GetLinkByID(id)
}

// SearchLinks searches for links matching the query
func (a *App) SearchLinks(query string) ([]Link, error) {
	return a.db.SearchLinks(query)
}

// CreateLink creates a new link
func (a *App) CreateLink(link Link) (int64, error) {
	return a.db.CreateLink(link)
}

// UpdateLink updates an existing link
func (a *App) UpdateLink(link Link) error {
	return a.db.UpdateLink(link)
}

// DeleteLink deletes a link by ID
func (a *App) DeleteLink(id int) error {
	return a.db.DeleteLink(id)
}

// GetSettingBackend gets a setting value
func (a *App) GetSettingBackend(key string) (string, error) {
	return a.db.GetSetting(key)
}

// UpdateSettingBackend updates a setting value
func (a *App) UpdateSettingBackend(key, value string) error {
	return a.db.UpdateSetting(key, value)
}

// QuitApp closes the application completely
func (a *App) QuitApp() {
	// We set the setting to false temporarily or just use runtime.Quit
	// but to bypass beforeClose we can just exit the process or clear the setting
	// Better way: Wails provides runtime.Quit which triggers OnShutdown but we can force it
	wailsruntime.Quit(a.ctx)
}
