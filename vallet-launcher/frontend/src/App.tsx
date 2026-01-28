import { useState, useEffect, useRef } from 'react';
import './App.css';
import { OpenSomething, HideWindow, GetAllLinks, CreateLink, UpdateLink, DeleteLink, SearchLinks, SetAdminSize, SetLauncherSize, SetLauncherExpandedSize, SetRecordingSize, GetSettingBackend, UpdateSettingBackend, QuitApp, ProcessAudio } from "../wailsjs/go/main/App";
import { main } from "../wailsjs/go/models";
import { EventsOn } from "../wailsjs/runtime/runtime";

function App() {
    const [query, setQuery] = useState('');
    const [appMode, setAppMode] = useState<'launcher' | 'admin' | 'recording'>('launcher');
    const [showAdmin, setShowAdmin] = useState(false);
    const [links, setLinks] = useState<main.Link[]>([]);
    const [editingLink, setEditingLink] = useState<main.Link | null>(null);
    const [searchResults, setSearchResults] = useState<main.Link[]>([]);
    const [activeTab, setActiveTab] = useState('links');
    const [runInBackground, setRunInBackground] = useState(false);
    const [defaultBrowser, setDefaultBrowser] = useState('system');
    const [saveProgress, setSaveProgress] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Recording logic ref
    const recordingRef = useRef<{
        stream: MediaStream | null;
        processor: ScriptProcessorNode | null;
        context: AudioContext | null;
        chunks: Int16Array[];
    }>({ stream: null, processor: null, context: null, chunks: [] });

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const context = new AudioContext({ sampleRate: 16000 });
            const source = context.createMediaStreamSource(stream);
            // We use a small buffer for performance
            const processor = context.createScriptProcessor(4096, 1, 1);

            const chunks: Int16Array[] = [];

            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);
                const int16Data = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                    const s = Math.max(-1, Math.min(1, inputData[i]));
                    int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }
                chunks.push(int16Data);
            };

            source.connect(processor);
            processor.connect(context.destination);

            recordingRef.current = { stream, processor, context, chunks };
            setIsRecording(true);
        } catch (err) {
            console.error("Error starting recording:", err);
        }
    };

    const stopRecording = () => {
        const { stream, processor, context, chunks } = recordingRef.current;
        setIsRecording(false);
        if (!context || !processor || !stream) return;

        processor.disconnect();
        stream.getTracks().forEach(track => track.stop());
        context.close();

        // Encode and send
        if (chunks.length > 0) {
            const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const pcmData = new Int16Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                pcmData.set(chunk, offset);
                offset += chunk.length;
            }

            const wavBuffer = encodeWAV(pcmData, 16000);
            // Convert to base64
            const uint8 = new Uint8Array(wavBuffer);
            let binary = '';
            for (let i = 0; i < uint8.byteLength; i++) {
                binary += String.fromCharCode(uint8[i]);
            }
            const base64 = btoa(binary);
            ProcessAudio(base64);
        }
    };

    const encodeWAV = (samples: Int16Array, sampleRate: number) => {
        const buffer = new ArrayBuffer(44 + samples.length * 2);
        const view = new DataView(buffer);

        const writeString = (offset: number, string: string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 32 + samples.length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 1, true); // Mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true); // Block align
        view.setUint16(34, 16, true); // Bits per sample
        writeString(36, 'data');
        view.setUint32(40, samples.length * 2, true);

        let offset = 44;
        for (let i = 0; i < samples.length; i++, offset += 2) {
            view.setInt16(offset, samples[i], true);
        }

        return buffer;
    };

    useEffect(() => {
        const unsubsStart = EventsOn("start-recording", () => {
            // If we are not in admin mode, switch to recording view
            if (!showAdmin) {
                setAppMode('recording');
                SetRecordingSize();
            }
            startRecording();
        });

        const unsubsStop = EventsOn("stop-recording", () => {
            stopRecording();

            // If we were in recording mode, go back to launcher or hide
            if (appMode === 'recording') {
                setTimeout(() => {
                    setAppMode('launcher');
                    SetLauncherSize();
                    HideWindow();
                }, 1500);
            }
        });

        return () => {
            unsubsStart();
            unsubsStop();
        };
    }, [showAdmin, appMode]);

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        url: '',
        description: '',
        category: ''
    });

    useEffect(() => {
        // Cargar configuraciones
        GetSettingBackend("run_in_background").then(val => {
            setRunInBackground(val === "true");
        });

        GetSettingBackend("default_browser").then(val => {
            if (val) setDefaultBrowser(val);
        });

        const handleFocus = () => {
            if (inputRef.current && !showAdmin) {
                inputRef.current.focus();
            }
        };

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
        window.addEventListener('focus', handleFocus);

        // Initial focus
        handleFocus();

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('focus', handleFocus);
        };
    }, [showAdmin]);

    useEffect(() => {
        const unsubscribe = EventsOn("window-shown", () => {
            setQuery('');
            setAppMode('launcher');
            SetLauncherSize();
            if (inputRef.current && !showAdmin) {
                inputRef.current.focus();
            }
        });
        return () => unsubscribe();
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
                if (results && results.length > 0) {
                    SetLauncherExpandedSize();
                } else {
                    SetLauncherSize();
                }
            }).catch(() => {
                setSearchResults([]);
                SetLauncherSize();
            });
        } else {
            setSearchResults([]);
            if (!showAdmin) SetLauncherSize();
        }
    }, [query, showAdmin]);

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

    const toggleBackground = async (checked: boolean) => {
        setRunInBackground(checked);
        await UpdateSettingBackend("run_in_background", checked ? "true" : "false");
    };

    const handleBrowserChange = async (browser: string) => {
        setDefaultBrowser(browser);
        setIsSaving(true);
        setSaveProgress(0);

        // Simulación de progreso para feedback visual
        const interval = setInterval(() => {
            setSaveProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    return 100;
                }
                return prev + 5;
            });
        }, 30);

        await UpdateSettingBackend("default_browser", browser);

        // Mantener la barra llena un momento antes de desaparecer
        setTimeout(() => {
            setIsSaving(false);
            setSaveProgress(0);
        }, 1000);
    };

    const handleQuit = () => {
        if (confirm('¿Estás seguro de que quieres cerrar Vallet Launcher por completo?')) {
            QuitApp();
        }
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
                            <div></div>
                            <div className="header-actions">
                                <button className="header-icon-btn">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                                </button>
                                <button className="close-btn-round" onClick={() => { setShowAdmin(false); SetLauncherSize(); }}>✕</button>
                            </div>
                        </header>

                        <div className="main-content-scroll">
                            {activeTab === 'dashboard' && (
                                <div className="section-dashboard">
                                    <header className="dashboard-content-header">
                                        <h1>Dashboard</h1>
                                        <p>Resumen general de tus accesos y productividad.</p>
                                    </header>

                                    <div className="stats-grid-dashboard">
                                        <div className="stat-card-new">
                                            <div className="stat-card-icon purple">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                                            </div>
                                            <div className="stat-card-info">
                                                <span className="stat-label">Total Links</span>
                                                <div className="stat-row">
                                                    <span className="stat-value">{links.length}</span>
                                                    <span className="stat-trend positive">↑ 12%</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="stat-card-new">
                                            <div className="stat-card-icon green">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
                                            </div>
                                            <div className="stat-card-info">
                                                <span className="stat-label">Activos</span>
                                                <div className="stat-row">
                                                    <span className="stat-value">{links.length}</span>
                                                    <span className="stat-trend positive">↑ 5%</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="stat-card-new">
                                            <div className="stat-card-icon blue">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                            </div>
                                            <div className="stat-card-info">
                                                <span className="stat-label">Recientes</span>
                                                <div className="stat-row">
                                                    <span className="stat-value">24</span>
                                                    <span className="stat-trend text-secondary">Últimos 7 días</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="dashboard-charts-row">
                                        <div className="chart-placeholder-card">
                                            <div className="card-header-small">
                                                <h4>Actividad de Uso</h4>
                                                <div className="badge-new">Semanal</div>
                                            </div>
                                            <div className="fake-chart">
                                                {/* Representación visual de un gráfico tipo el de la imagen */}
                                                <div className="chart-line-bg"></div>
                                                <div className="chart-bars">
                                                    {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                                                        <div key={i} className="chart-bar" style={{ height: `${h}%` }}></div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="status-overview-card">
                                            <h4>Estado del Sistema</h4>
                                            <div className="status-rings">
                                                <div className="status-ring-item">
                                                    <div className="ring purple">60%</div>
                                                    <span>Base de Datos</span>
                                                </div>
                                                <div className="status-ring-item">
                                                    <div className="ring green">92%</div>
                                                    <span>Memoria</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'links' && (
                                <div className="section-links">
                                    <div className="admin-header-inline">
                                        <div className="card-header">
                                            <h3>{editingLink ? 'Editar Link' : 'Nuevo Link'}</h3>
                                            <p>Agrega o modifica tus accesos directos.</p>
                                        </div>
                                    </div>

                                    <div className="form-container-top">
                                        <form onSubmit={handleSubmitLink} className="modern-form-inline">
                                            <div className="form-row">
                                                <div className="form-group flex-2">
                                                    <label>Alias</label>
                                                    <input
                                                        type="text"
                                                        value={formData.name}
                                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                        required
                                                        placeholder="Ej: Workspace"
                                                    />
                                                </div>
                                                <div className="form-group flex-3">
                                                    <label>URL o Comando</label>
                                                    <input
                                                        type="text"
                                                        value={formData.url}
                                                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                                        required
                                                        placeholder="https://... o comando"
                                                    />
                                                </div>
                                                <div className="form-actions-inline">
                                                    <button type="submit" className="btn-save">
                                                        {editingLink ? 'Actualizar' : 'Agregar'}
                                                    </button>
                                                    {editingLink && (
                                                        <button type="button" className="btn-cancel" onClick={resetForm}>
                                                            ✕
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </form>
                                    </div>

                                    <div className="table-container-macos">
                                        <table className="macos-table">
                                            <thead>
                                                <tr>
                                                    <th>Alias</th>
                                                    <th>URL / Comando</th>
                                                    <th className="actions-column">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {links.map((link) => (
                                                    <tr key={link.id}>
                                                        <td className="font-semibold">{link.name}</td>
                                                        <td className="text-accent">{link.url}</td>
                                                        <td className="actions-cell">
                                                            <div className="table-actions">
                                                                <button className="btn-table-action edit" onClick={() => handleEdit(link)} title="Editar">
                                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                                </button>
                                                                <button className="btn-table-action delete" onClick={() => handleDelete(link.id)} title="Eliminar">
                                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        {links.length === 0 && (
                                            <div className="empty-table-state">
                                                <p>No hay links registrados</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'settings' && (
                                <div className="section-settings">
                                    <header className="dashboard-content-header">
                                        <h1>Configuración</h1>
                                        <p>Personaliza el comportamiento de Vallet Launcher.</p>
                                    </header>

                                    <div className="settings-group">
                                        <div className="settings-item">
                                            <div className="settings-info">
                                                <span>Ejecutar en segundo plano</span>
                                                <p>La aplicación seguirá ejecutándose al cerrar la ventana.</p>
                                            </div>
                                            <label className="switch">
                                                <input
                                                    type="checkbox"
                                                    checked={runInBackground}
                                                    onChange={(e) => toggleBackground(e.target.checked)}
                                                />
                                                <span className="slider"></span>
                                            </label>
                                        </div>

                                        <div className="settings-item">
                                            <div className="settings-info">
                                                <span>Navegador por defecto</span>
                                                <p>Selecciona con qué navegador se abrirán los enlaces.</p>
                                            </div>
                                            <select
                                                className="browser-select"
                                                value={defaultBrowser}
                                                onChange={(e) => handleBrowserChange(e.target.value)}
                                            >
                                                <option value="system">Predeterminado del Sistema</option>
                                                <option value="chrome">Google Chrome</option>
                                                <option value="firefox">Mozilla Firefox</option>
                                                <option value="edge">Microsoft Edge</option>
                                                <option value="brave">Brave Browser</option>
                                                <option value="opera">Opera</option>
                                            </select>
                                        </div>
                                        {isSaving && (
                                            <div className="progress-container">
                                                <div
                                                    className="progress-bar"
                                                    style={{
                                                        width: `${saveProgress}%`,
                                                        backgroundColor: saveProgress < 50 ? '#fbbf24' : '#10b981' // Amarillo a Verde
                                                    }}
                                                ></div>
                                                <span className="progress-text">
                                                    {saveProgress < 100 ? 'Guardando...' : '¡Guardado!'}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="danger-zone">
                                        <h2>Zona de Peligro</h2>
                                        <div className="settings-item" style={{ border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                            <div className="settings-info">
                                                <span>Cerrar Aplicación</span>
                                                <p>Detiene el proceso de Vallet Launcher por completo.</p>
                                            </div>
                                            <button className="btn-danger-outline" onClick={handleQuit}>
                                                Cerrar Todo
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div >
        );
    }

    if (appMode === 'recording') {
        return (
            <div className="recording-only-container">
                <div className="recording-pill">
                    <div className="mic-icon-circle">
                        <svg viewBox="0 0 24 24" fill="white" style={{ width: '18px' }}>
                            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        </svg>
                    </div>
                    <div className="recording-text">
                        <span className="recording-status">
                            {isRecording ? "Escuchando..." : "Procesando..."}
                        </span>
                        <span className="recording-hint">Presiona el atajo para detener</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container" style={appMode === 'launcher' ? { opacity: 1 } : {}}>
            <div className="launcher-content">
                <div className="search-box">
                    <button className="admin-link-top" onClick={() => {
                        setShowAdmin(true);
                        setAppMode('admin');
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

                    <div className="hint">
                        Presiona <span className="key">Enter</span> para abrir ·
                        <span className="key">Esc</span> para ocultar
                    </div>
                </div>

                {searchResults.length > 0 && (
                    <div className="results-box">
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
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
