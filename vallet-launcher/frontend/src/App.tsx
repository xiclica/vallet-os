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
                    <div className="admin-header">
                        <h2>Administrar Links</h2>
                        <button className="close-btn" onClick={() => {
                            setShowAdmin(false);
                            SetLauncherSize();
                        }}>✕</button>
                    </div>

                    <div className="admin-content">
                        <div className="form-section">
                            <h3>{editingLink ? 'Editar Link' : 'Nuevo Link'}</h3>
                            <form onSubmit={handleSubmitLink}>
                                <div className="form-group">
                                    <label>Nombre *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        required
                                        placeholder="Ej: Google"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>URL *</label>
                                    <input
                                        type="url"
                                        value={formData.url}
                                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                        required
                                        placeholder="https://www.google.com"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Descripción</label>
                                    <input
                                        type="text"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Buscador web"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Categoría</label>
                                    <input
                                        type="text"
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        placeholder="Productividad"
                                    />
                                </div>
                                <div className="form-actions">
                                    <button type="submit" className="btn-primary">
                                        {editingLink ? 'Actualizar' : 'Crear'}
                                    </button>
                                    {editingLink && (
                                        <button type="button" className="btn-secondary" onClick={resetForm}>
                                            Cancelar
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>

                        <div className="links-section">
                            <h3>Links Guardados ({links.length})</h3>
                            <div className="links-list">
                                {links.map((link) => (
                                    <div key={link.id} className="link-item">
                                        <div className="link-info">
                                            <div className="link-name">{link.name}</div>
                                            <div className="link-url">{link.url}</div>
                                            {link.description && <div className="link-desc">{link.description}</div>}
                                            {link.category && <span className="link-category">{link.category}</span>}
                                        </div>
                                        <div className="link-actions">
                                            <button className="btn-edit" onClick={() => handleEdit(link)}>✎</button>
                                            <button className="btn-delete" onClick={() => handleDelete(link.id)}>🗑</button>
                                        </div>
                                    </div>
                                ))}
                                {links.length === 0 && (
                                    <div className="empty-state">No hay links guardados</div>
                                )}
                            </div>
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
