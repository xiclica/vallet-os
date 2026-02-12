package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

// Link representa un acceso directo guardado por el usuario.
type Link struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`        // Alias o nombre del link.
	URL         string `json:"url"`         // Dirección web o comando.
	Description string `json:"description"` // Descripción opcional.
	Category    string `json:"category"`    // Categoría para organizar links (ahora se refiere al nombre o ID de la carpeta).
	CreatedAt   string `json:"created_at"`  // Fecha de creación.
}

// Folder representa una agrupación de links.
type Folder struct {
	ID          int    `json:"id"`
	Name        string `json:"name"`        // Nombre de la carpeta.
	Description string `json:"description"` // Descripción opcional.
	CreatedAt   string `json:"created_at"`  // Fecha de creación.
}

// UsageLog representa un registro de uso de una herramienta.
type UsageLog struct {
	Date      string `json:"date"`
	ToolType  string `json:"tool_type"`
	DayOfWeek string `json:"day_of_week"`
	Count     int    `json:"count"`
}

// Database encapsula la conexión a la base de datos SQLite.
type Database struct {
	db *sql.DB
}

// NewDatabase inicializa la conexión con SQLite, creando el archivo y las tablas si no existen.
func NewDatabase() (*Database, error) {
	// Obtener el directorio de datos del usuario (Home).
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	// Crear carpeta oculta para la base de datos en el home del usuario.
	dbDir := filepath.Join(homeDir, ".vallet-os")
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		return nil, err
	}

	dbPath := filepath.Join(dbDir, "vallet.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}

	database := &Database{db: db}
	if err := database.createTables(); err != nil {
		return nil, err
	}

	return database, nil
}

// createTables crea las tablas necesarias ('links', 'settings', 'folders') si no existen.
func (d *Database) createTables() error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS links (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			url TEXT NOT NULL,
			description TEXT,
			category TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT
		);`,
		`CREATE TABLE IF NOT EXISTS folders (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE,
			description TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS usage_stats (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			tool_type TEXT NOT NULL,
			day_of_week TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
	}

	for _, query := range queries {
		if _, err := d.db.Exec(query); err != nil {
			return err
		}
	}

	// Insertar configuraciones por defecto si es la primera vez que se ejecuta.
	d.db.Exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('run_in_background', 'false')")
	d.db.Exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('default_browser', 'system')")
	d.db.Exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('play_audio_transcription', 'true')")

	// Insertar carpeta 'General' por defecto.
	d.db.Exec("INSERT OR IGNORE INTO folders (name, description) VALUES ('General', 'Carpeta predeterminada para todos los links')")

	// Migrar links de la categoría 'general' (o similar) a 'General' para consistencia con la carpeta.
	d.db.Exec("UPDATE links SET category = 'General' WHERE LOWER(category) = 'general'")

	return nil
}

// GetSetting recupera un valor de la tabla settings.
func (d *Database) GetSetting(key string) (string, error) {
	var value string
	err := d.db.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return value, err
}

// UpdateSetting guarda o actualiza un valor de configuración.
func (d *Database) UpdateSetting(key, value string) error {
	_, err := d.db.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, value)
	return err
}

// ============ Métodos para Links ============

func (d *Database) GetAllLinks() ([]Link, error) {
	rows, err := d.db.Query("SELECT id, name, url, description, category, created_at FROM links ORDER BY created_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var links []Link
	for rows.Next() {
		var link Link
		err := rows.Scan(&link.ID, &link.Name, &link.URL, &link.Description, &link.Category, &link.CreatedAt)
		if err != nil {
			log.Println("Error scanning link:", err)
			continue
		}
		links = append(links, link)
	}

	return links, nil
}

func (d *Database) GetLinkByID(id int) (*Link, error) {
	var link Link
	err := d.db.QueryRow("SELECT id, name, url, description, category, created_at FROM links WHERE id = ?", id).
		Scan(&link.ID, &link.Name, &link.URL, &link.Description, &link.Category, &link.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &link, nil
}

func (d *Database) SearchLinks(query string) ([]Link, error) {
	searchQuery := "%" + query + "%"
	rows, err := d.db.Query(
		"SELECT id, name, url, description, category, created_at FROM links WHERE name LIKE ? OR url LIKE ? OR description LIKE ? ORDER BY created_at DESC",
		searchQuery, searchQuery, searchQuery,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var links []Link
	for rows.Next() {
		var link Link
		err := rows.Scan(&link.ID, &link.Name, &link.URL, &link.Description, &link.Category, &link.CreatedAt)
		if err != nil {
			continue
		}
		links = append(links, link)
	}

	return links, nil
}

func (d *Database) CreateLink(link Link) (int64, error) {
	// Si no tiene categoría, asignar 'General' por defecto.
	if link.Category == "" {
		link.Category = "General"
	}
	result, err := d.db.Exec(
		"INSERT INTO links (name, url, description, category) VALUES (?, ?, ?, ?)",
		link.Name, link.URL, link.Description, link.Category,
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (d *Database) UpdateLink(link Link) error {
	_, err := d.db.Exec(
		"UPDATE links SET name = ?, url = ?, description = ?, category = ? WHERE id = ?",
		link.Name, link.URL, link.Description, link.Category, link.ID,
	)
	return err
}

func (d *Database) DeleteLink(id int) error {
	_, err := d.db.Exec("DELETE FROM links WHERE id = ?", id)
	return err
}

// ============ Métodos para Carpetas (Folders) ============

func (d *Database) GetAllFolders() ([]Folder, error) {
	rows, err := d.db.Query("SELECT id, name, description, created_at FROM folders ORDER BY name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var folders []Folder
	for rows.Next() {
		var f Folder
		err := rows.Scan(&f.ID, &f.Name, &f.Description, &f.CreatedAt)
		if err != nil {
			log.Println("Error scanning folder:", err)
			continue
		}
		folders = append(folders, f)
	}

	return folders, nil
}

func (d *Database) CreateFolder(folder Folder) (int64, error) {
	result, err := d.db.Exec(
		"INSERT INTO folders (name, description) VALUES (?, ?)",
		folder.Name, folder.Description,
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (d *Database) UpdateFolder(folder Folder) error {
	// Al actualizar el nombre de una carpeta, también deberíamos actualizar los links asociados
	// si usamos el nombre como identificador de categoría.
	// Primero obtenemos el nombre antiguo si es necesario, pero aquí asumimos que el ID es estable.

	var oldName string
	err := d.db.QueryRow("SELECT name FROM folders WHERE id = ?", folder.ID).Scan(&oldName)
	if err != nil {
		return err
	}

	tx, err := d.db.Begin()
	if err != nil {
		return err
	}

	_, err = tx.Exec("UPDATE folders SET name = ?, description = ? WHERE id = ?", folder.Name, folder.Description, folder.ID)
	if err != nil {
		tx.Rollback()
		return err
	}

	if oldName != folder.Name {
		_, err = tx.Exec("UPDATE links SET category = ? WHERE category = ?", folder.Name, oldName)
		if err != nil {
			tx.Rollback()
			return err
		}
	}

	return tx.Commit()
}

func (d *Database) DeleteFolder(id int) error {
	var name string
	err := d.db.QueryRow("SELECT name FROM folders WHERE id = ?", id).Scan(&name)
	if err != nil {
		return err
	}

	// No permitir borrar la carpeta 'General'
	if name == "General" {
		return fmt.Errorf("no se puede eliminar la carpeta predeterminada 'General'")
	}

	tx, err := d.db.Begin()
	if err != nil {
		return err
	}

	// Mover links de esta carpeta a 'General' antes de borrarla
	_, err = tx.Exec("UPDATE links SET category = 'General' WHERE category = ?", name)
	if err != nil {
		tx.Rollback()
		return err
	}

	_, err = tx.Exec("DELETE FROM folders WHERE id = ?", id)
	if err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit()
}

// ============ Métodos para Estadísticas ============

// LogUsage registra el uso de una herramienta (links o transcription).
func (d *Database) LogUsage(toolType string, dayOfWeek string) error {
	_, err := d.db.Exec(
		"INSERT INTO usage_stats (tool_type, day_of_week) VALUES (?, ?)",
		toolType, dayOfWeek,
	)
	return err
}

// GetUsageStats recupera el conteo de uso agrupado por día y herramienta.
func (d *Database) GetUsageStats() ([]UsageLog, error) {
	rows, err := d.db.Query(`
		SELECT DATE(created_at) as date, tool_type, day_of_week, COUNT(*) as count 
		FROM usage_stats 
		GROUP BY DATE(created_at), tool_type 
		ORDER BY date DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []UsageLog
	for rows.Next() {
		var s UsageLog
		err := rows.Scan(&s.Date, &s.ToolType, &s.DayOfWeek, &s.Count)
		if err != nil {
			log.Println("Error scanning usage stat:", err)
			continue
		}
		stats = append(stats, s)
	}

	return stats, nil
}

func (d *Database) Close() error {
	return d.db.Close()
}
