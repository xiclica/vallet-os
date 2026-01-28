package main

import (
	"database/sql"
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
	Category    string `json:"category"`    // Categoría para organizar links.
	CreatedAt   string `json:"created_at"`  // Fecha de creación.
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
	dbDir := filepath.Join(homeDir, ".vallet-launcher")
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

// createTables crea las tablas necesarias ('links' y 'settings') si no existen.
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
	}

	for _, query := range queries {
		if _, err := d.db.Exec(query); err != nil {
			return err
		}
	}

	// Insertar configuraciones por defecto si es la primera vez que se ejecuta.
	d.db.Exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('run_in_background', 'false')")
	d.db.Exec("INSERT OR IGNORE INTO settings (key, value) VALUES ('default_browser', 'system')")

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

func (d *Database) Close() error {
	return d.db.Close()
}
