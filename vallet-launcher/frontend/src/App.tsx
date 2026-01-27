import { useState, useEffect, useRef } from 'react';
import './App.css';
import { OpenSomething, HideWindow, GetAllLinks, CreateLink, UpdateLink, DeleteLink, SearchLinks, SetAdminSize, SetLauncherSize } from "../wailsjs/go/main/App";
import { main } from "../wailsjs/go/models";

function App() {
    const [query, setQuery] = useState('');
    const [showAdmin, setShowAdmin] = useState(false);
    const [links, setLinks] = useState<main.Link[]>([]);
    const [editingLink, setEditingLink] = useState<main.Link | null>(null);
    const [searchResults, setSearchResults] = useState<main.Link[]>([]);
    const [activeTab, setActiveTab] = useState('links');
    const inputRef = useRef<HTMLInputElement>(null);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        url: '',
        description: '',
        category: ''
    });

    useEffect(() => {
        if (inputRef.current && !showAdmin) {
            inputRef.current.focus();
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showAdmin) {
                    setShowAdmin(false);
                    SetLauncherSize();
                } else {
                    HideWindow();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showAdmin]);

    useEffect(() => {
        if (showAdmin) {
            loadLinks();
        }
    }, [showAdmin]);

    useEffect(() => {
        if (query.length > 0) {
            SearchLinks(query).then(results => {
                setSearchResults(results || []);
            }).catch(() => setSearchResults([]));
        } else {
            setSearchResults([]);
        }
    }, [query]);

    const loadLinks = async () => {
        try {
            const allLinks = await GetAllLinks();
            setLinks(allLinks || []);
        } catch (error) {
            console.error('Error loading links:', error);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            OpenSomething(query);
            setQuery('');
            setSearchResults([]);
        }
    };

    const handleLinkClick = (link: main.Link) => {
        OpenSomething(link.url);
        setQuery('');
        setSearchResults([]);
    };

    const handleSubmitLink = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingLink) {
                await UpdateLink({
                    ...editingLink,
                    ...formData
                });
            } else {
                await CreateLink({
                    id: 0,
                    ...formData,
                    created_at: ''
                });
            }
            resetForm();
            loadLinks();
        } catch (error) {
            console.error('Error saving link:', error);
        }
    };

    const handleEdit = (link: main.Link) => {
        setEditingLink(link);
        setFormData({
            name: link.name,
            url: link.url,
            description: link.description || '',
            category: link.category || ''
        });
    };

    const handleDelete = async (id: number) => {
        if (confirm('¿Estás seguro de eliminar este link?')) {
            try {
                await DeleteLink(id);
                loadLinks();
            } catch (error) {
                console.error('Error deleting link:', error);
            }
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            url: '',
            description: '',
            category: ''
        });
        setEditingLink(null);
    };

    if (showAdmin) {
        return (
            <div className="container admin-container">
                <div className="admin-panel">
                    {/* Sidebar Izquierdo */}
                    <div className="admin-sidebar">
                        <div className="sidebar-header">
                            <div className="logo-icon">V</div>
                            <span>Vallet OS</span>
                        </div>

                        <nav className="sidebar-nav">
                            <button
                                className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                                onClick={() => setActiveTab('dashboard')}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                                Dashboard
                            </button>
                            <button
                                className={`nav-item ${activeTab === 'links' ? 'active' : ''}`}
                                onClick={() => setActiveTab('links')}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                                Mis Links
                            </button>
                            <button
                                className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                                onClick={() => setActiveTab('settings')}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                                Ajustes
                            </button>
                        </nav>

                        <div className="sidebar-footer">
                            <button className="logout-btn" onClick={() => { setShowAdmin(false); SetLauncherSize(); }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                                Salir
                            </button>
                        </div>
                    </div>

                    {/* Área de Contenido */}
                    <div className="admin-main">
                        <header className="main-header">
                            <div className="breadcrumb">Configuración / {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</div>
                            <div className="header-actions">
                                <button className="close-btn-round" onClick={() => { setShowAdmin(false); SetLauncherSize(); }}>✕</button>
                            </div>
                        </header>

                        <div className="main-content-scroll">
                            {activeTab === 'dashboard' && (
                                <div className="section-dashboard">
                                    <h1>Resumen</h1>
                                    <div className="stats-grid">
                                        <div className="stat-card">
                                            <div className="stat-value">{links.length}</div>
                                            <div className="stat-label">Links Guardados</div>
                                        </div>
                                        <div className="stat-card">
                                            <div className="stat-value">Activo</div>
                                            <div className="stat-label">Estado del Sistema</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'links' && (
                                <div className="section-links">
                                    <div className="admin-content-grid">
                                        <div className="form-section">
                                            <div className="card-header">
                                                <h3>{editingLink ? 'Editar Link' : 'Nuevo Link'}</h3>
                                                <p>Completa la información para guardar un nuevo acceso directo.</p>
                                            </div>
                                            <form onSubmit={handleSubmitLink} className="modern-form">
                                                <div className="form-group">
                                                    <label>Nombre del sitio</label>
                                                    <input
                                                        type="text"
                                                        value={formData.name}
                                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                        required
                                                        placeholder="Ej: Workspace Principal"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>URL o Comando</label>
                                                    <input
                                                        type="text"
                                                        value={formData.url}
                                                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                                        required
                                                        placeholder="https://... o comando de app"
                                                    />
                                                </div>
                                                <div className="form-group">
                                                    <label>Descripción (Opcional)</label>
                                                    <input
                                                        type="text"
                                                        value={formData.description}
                                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                        placeholder="Breve descripción..."
                                                    />
                                                </div>
                                                <div className="form-actions">
                                                    <button type="submit" className="btn-save">
                                                        {editingLink ? 'Guardar Cambios' : 'Crear Link'}
                                                    </button>
                                                    {editingLink && (
                                                        <button type="button" className="btn-cancel" onClick={resetForm}>
                                                            Cancelar
                                                        </button>
                                                    )}
                                                </div>
                                            </form>
                                        </div>

                                        <div className="links-section">
                                            <div className="card-header">
                                                <h3>Tus Accesos ({links.length})</h3>
                                                <p>Lista de todos los comandos y sitios guardados.</p>
                                            </div>
                                            <div className="links-list-modern">
                                                {links.map((link) => (
                                                    <div key={link.id} className="link-card-modern">
                                                        <div className="link-card-info">
                                                            <div className="link-card-name">{link.name}</div>
                                                            <div className="link-card-url">{link.url}</div>
                                                        </div>
                                                        <div className="link-card-actions">
                                                            <button className="btn-action edit" onClick={() => handleEdit(link)}>✎</button>
                                                            <button className="btn-action delete" onClick={() => handleDelete(link.id)}>🗑</button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {links.length === 0 && (
                                                    <div className="empty-state-modern">
                                                        <div className="empty-icon">📂</div>
                                                        <p>No tienes links guardados todavía.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'settings' && (
                                <div className="section-settings">
                                    <h1>Configuración General</h1>
                                    <div className="settings-card">
                                        <p>Próximamente: Personalización de colores, atajos de teclado y más.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <div className={`search-box ${searchResults.length > 0 ? 'has-results' : ''}`}>
                <button className="admin-link-top" onClick={() => {
                    setShowAdmin(true);
                    SetAdminSize();
                }} title="Administrar">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
                <form onSubmit={handleSearch}>
                    <div className="search-input-container">
                        <svg className="search-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Buscar aplicación o sitio web..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoFocus
                        />
                    </div>
                </form>

                {searchResults.length > 0 && (
                    <div className="search-results">
                        {searchResults.map((link) => (
                            <div
                                key={link.id}
                                className="result-item"
                                onClick={() => handleLinkClick(link)}
                            >
                                <div className="result-name">{link.name}</div>
                                <div className="result-url">{link.url}</div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="hint">
                    Presiona <span className="key">Enter</span> para abrir ·
                    <span className="key">Esc</span> para ocultar
                </div>
            </div>
        </div>
    );
}

export default App;
