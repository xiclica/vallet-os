import { useState, useEffect, useRef } from 'react';
import './App.css';
import valletLogo from './assets/images/vallet-os-V.png';
import { OpenSomething, HideWindow, GetAllLinks, CreateLink, UpdateLink, DeleteLink, SearchLinks, SetAdminSize, SetLauncherSize, SetLauncherExpandedSize, SetRecordingSize, GetSettingBackend, UpdateSettingBackend, QuitApp, ProcessAudio, GetAllFolders, CreateFolder, UpdateFolder, DeleteFolder, GetUsageStats } from "../wailsjs/go/main/App";
import { main } from "../wailsjs/go/models";
import { EventsOn } from "../wailsjs/runtime/runtime";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';

function App() {
    // === Estados de la Aplicación ===
    const [query, setQuery] = useState(''); // Texto ingresado en el buscador.
    const [appMode, setAppMode] = useState<'launcher' | 'admin' | 'recording'>('launcher'); // Modo visual actual.
    const [showAdmin, setShowAdmin] = useState(false); // Controla si se muestra el panel de admin.
    const [links, setLinks] = useState<main.Link[]>([]); // Lista completa de links (para admin).
    const [editingLink, setEditingLink] = useState<main.Link | null>(null); // Link que se está editando.
    const [searchResults, setSearchResults] = useState<main.Link[]>([]); // Resultados de búsqueda filtrados.
    const [selectedIndex, setSelectedIndex] = useState(0); // Índice de la sugerencia seleccionada.
    const [activeTab, setActiveTab] = useState<'dashboard' | 'links' | 'folders' | 'settings' | 'docs'>('links'); // Pestaña activa en el panel de admin.
    const [folders, setFolders] = useState<main.Folder[]>([]); // Lista de carpetas.
    const [editingFolder, setEditingFolder] = useState<main.Folder | null>(null); // Carpeta que se está editando.
    const [folderFormData, setFolderFormData] = useState({
        name: '',
        description: ''
    });
    const [runInBackground, setRunInBackground] = useState(false); // Ajuste de ejecución en segundo plano.
    const [defaultBrowser, setDefaultBrowser] = useState('system'); // Navegador preferido.
    const [saveProgress, setSaveProgress] = useState(0); // Progreso visual de guardado.
    const [isSaving, setIsSaving] = useState(false); // Estado de guardado en curso.
    const [isRecording, setIsRecording] = useState(false); // Estado de grabación activa.
    // Estado para controlar la reproducción de sonidos durante la transcripción.
    const [playAudioTranscription, setPlayAudioTranscription] = useState(true);
    const inputRef = useRef<HTMLInputElement>(null); // Referencia al input del buscador.
    const [selectedFolderFilter, setSelectedFolderFilter] = useState('Todas'); // Carpeta seleccionada para filtrar links en admin.
    const [usageStats, setUsageStats] = useState<main.UsageLog[]>([]); // Estadísticas de uso de herramientas.
    const resultsRef = useRef<HTMLDivElement>(null); // Referencia al contenedor de resultados para el scroll.
    const uiResetTimeoutRef = useRef<number | null>(null); // Referencia al timeout de limpieza de la interfaz.

    // Lógica relacionada con la grabación de audio.
    const recordingRef = useRef<{
        stream: MediaStream | null;
        processor: ScriptProcessorNode | null;
        context: AudioContext | null;
        chunks: Int16Array[];
    }>({ stream: null, processor: null, context: null, chunks: [] });

    // === Lógica de Grabación de Audio ===
    const startRecording = async () => {
        try {
            // Solicitar acceso al micrófono.
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            // Configurar contexto de audio a 16kHz (requerido por Whisper).
            const context = new AudioContext({ sampleRate: 16000 });
            const source = context.createMediaStreamSource(stream);
            const processor = context.createScriptProcessor(4096, 1, 1);

            const chunks: Int16Array[] = [];

            // Capturar datos de audio y convertirlos a Int16 (PCM).
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
            console.error("Error iniciando grabación:", err);
        }
    };

    const stopRecording = () => {
        const { stream, processor, context, chunks } = recordingRef.current;
        setIsRecording(false);
        if (!context || !processor || !stream) return;

        // Desconectar y cerrar el flujo de audio.
        processor.disconnect();
        stream.getTracks().forEach(track => track.stop());
        context.close();

        // Procesar los fragmentos de audio capturados.
        if (chunks.length > 0) {
            const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const pcmData = new Int16Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                pcmData.set(chunk, offset);
                offset += chunk.length;
            }

            // Convertir buffer PCM a formato WAV.
            const wavBuffer = encodeWAV(pcmData, 16000);
            // Convertir el WAV resultante a Base64 para enviarlo al backend de Go.
            const uint8 = new Uint8Array(wavBuffer);
            let binary = '';
            for (let i = 0; i < uint8.byteLength; i++) {
                binary += String.fromCharCode(uint8[i]);
            }
            const base64 = btoa(binary);
            ProcessAudio(base64); // Invocación a Go.
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
        // Escuchar eventos globales enviados desde Go.
        const unsubsStart = EventsOn("start-recording", () => {
            // Cancelar cualquier limpieza de UI pendiente si se inicia una nueva grabación.
            if (uiResetTimeoutRef.current) {
                clearTimeout(uiResetTimeoutRef.current);
                uiResetTimeoutRef.current = null;
            }

            // Si el foco está fuera del launcher, mostrar la mini-ventana de grabación.
            if (!showAdmin) {
                setAppMode('recording');
                // Ya no llamamos a SetRecordingSize aquí porque Go lo hace antes de mostrar la ventana.
            }
            startRecording();
        });

        const unsubsStop = EventsOn("stop-recording", () => {
            stopRecording();

            // Al detener, volver al modo launcher tras un breve retardo para que el usuario vea el estado final.
            if (appMode === 'recording') {
                // Cancelar cualquier limpieza previa.
                if (uiResetTimeoutRef.current) clearTimeout(uiResetTimeoutRef.current);

                uiResetTimeoutRef.current = window.setTimeout(() => {
                    setAppMode('launcher');
                    SetLauncherSize();
                    HideWindow();
                    uiResetTimeoutRef.current = null;
                }, 1500);
            }
        });

        return () => {
            unsubsStart();
            unsubsStop();
            if (uiResetTimeoutRef.current) clearTimeout(uiResetTimeoutRef.current);
        };
    }, [showAdmin, appMode]);


    // Estado del formulario para creación/edición de links.
    const [formData, setFormData] = useState({
        name: '',
        url: '',
        description: '',
        category: 'General'
    });

    useEffect(() => {
        // Cargar configuraciones
        GetSettingBackend("run_in_background").then(val => {
            setRunInBackground(val === "true");
        });

        GetSettingBackend("default_browser").then(val => {
            if (val) setDefaultBrowser(val);
        });

        GetSettingBackend("play_audio_transcription").then(val => {
            setPlayAudioTranscription(val !== "false");
        });

        loadUsageStats();

        // Asegurar que el input tenga el foco al cargar la ventana.
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
            } else if (e.key === 'ArrowDown') {
                // Navegar hacia abajo en los resultados.
                setSelectedIndex(prev => (prev + 1) % Math.max(searchResults.length, 1));
            } else if (e.key === 'ArrowUp') {
                // Navegar hacia arriba en los resultados.
                setSelectedIndex(prev => (prev - 1 + searchResults.length) % Math.max(searchResults.length, 1));
            } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') {
                // Atajo para ir directamente a la sección de links en el panel interno.
                e.preventDefault();
                setShowAdmin(true);
                setAppMode('admin');
                setActiveTab('links');
                SetAdminSize();
            } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'x') {
                // Atajo para minimizar la aplicación rápidamente (todas las ventanas).
                e.preventDefault();
                HideWindow();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('focus', handleFocus);

        // Foco inicial al montar el componente.
        handleFocus();

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('focus', handleFocus);
        };
    }, [showAdmin, searchResults.length]); // Dependemos de searchResults.length para la navegación.

    // === Lógica de Desplazamiento de Scroll ===
    useEffect(() => {
        // Asegurar que el elemento seleccionado esté siempre visible dentro del contenedor con scroll.
        if (resultsRef.current && searchResults.length > 0) {
            const selectedElement = resultsRef.current.children[selectedIndex] as HTMLElement;
            if (selectedElement) {
                selectedElement.scrollIntoView({
                    behavior: 'auto',
                    block: 'nearest'
                });
            }
        }
    }, [selectedIndex, searchResults]);

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
            loadFolders();
        }
    }, [showAdmin]);

    useEffect(() => {
        // Lógica de búsqueda reactiva.
        if (query.length > 0) {
            SearchLinks(query).then(results => {
                setSearchResults(results || []);
                setSelectedIndex(0); // Reiniciar selección al buscar.
                // Expandir la ventana si hay resultados.
                if (results && results.length > 0) {
                    SetLauncherExpandedSize();
                } else {
                    SetLauncherSize();
                }
            }).catch(() => {
                setSearchResults([]);
                setSelectedIndex(0);
                SetLauncherSize();
            });
        } else {
            setSearchResults([]);
            setSelectedIndex(0);
            if (!showAdmin) SetLauncherSize();
        }
    }, [query, showAdmin]);

    const loadUsageStats = async () => {
        try {
            const stats = await GetUsageStats();
            setUsageStats(stats || []);
        } catch (error) {
            console.error("Error loading usage stats:", error);
        }
    };

    const loadLinks = async () => {
        try {
            const allLinks = await GetAllLinks();
            setLinks(allLinks || []);
        } catch (error) {
            console.error('Error loading links:', error);
        }
    };

    const loadFolders = async () => {
        try {
            const allFolders = await GetAllFolders();
            setFolders(allFolders || []);
        } catch (error) {
            console.error('Error loading folders:', error);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        // Si hay un resultado seleccionado en la lista, abrirlo.
        if (searchResults.length > 0 && selectedIndex >= 0 && selectedIndex < searchResults.length) {
            handleLinkClick(searchResults[selectedIndex]);
        } else if (query.trim()) {
            // Si no hay selección pero hay query, intentar abrir directamente.
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
            category: 'General'
        });
        setEditingLink(null);
    };

    const handleSubmitFolder = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingFolder) {
                await UpdateFolder({
                    ...editingFolder,
                    ...folderFormData
                });
            } else {
                await CreateFolder({
                    id: 0,
                    ...folderFormData,
                    created_at: ''
                });
            }
            resetFolderForm();
            loadFolders();
        } catch (error) {
            console.error('Error saving folder:', error);
        }
    };

    const handleEditFolder = (folder: main.Folder) => {
        setEditingFolder(folder);
        setFolderFormData({
            name: folder.name,
            description: folder.description || ''
        });
    };

    const handleDeleteFolder = async (id: number) => {
        if (confirm('¿Estás seguro de eliminar esta carpeta? Los links se moverán a "General".')) {
            try {
                await DeleteFolder(id);
                loadFolders();
                loadLinks();
            } catch (error) {
                alert(error);
                console.error('Error deleting folder:', error);
            }
        }
    };

    const resetFolderForm = () => {
        setFolderFormData({
            name: '',
            description: ''
        });
        setEditingFolder(null);
    };

    const toggleBackground = async (checked: boolean) => {
        setRunInBackground(checked);
        await UpdateSettingBackend("run_in_background", checked ? "true" : "false");
    };

    /**
     * Alterna la configuración de reproducción de audio en la transcripción.
     */
    const toggleAudioTranscription = async (checked: boolean) => {
        setPlayAudioTranscription(checked);
        await UpdateSettingBackend("play_audio_transcription", checked ? "true" : "false");
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
            // Mostrar una pequeña notificación o alerta si se desea, 
            // pero el feedback visual de la barra es suficiente.
        }, 800);
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
                            <div className="sidebar-header-left">
                                <img src={valletLogo} alt="Vallet OS Logo" className="sidebar-logo-img" />
                                <span>Vallet OS</span>
                            </div>
                            <div className="sidebar-header-actions">
                                <button className="header-icon-btn-compact">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                                </button>
                                <button className="close-btn-compact" onClick={() => { setShowAdmin(false); SetLauncherSize(); }}>✕</button>
                            </div>
                        </div>

                        <nav className="sidebar-nav">
                            <button
                                className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                                onClick={() => {
                                    setActiveTab('dashboard');
                                    loadUsageStats();
                                }}
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
                                className={`nav-item ${activeTab === 'folders' ? 'active' : ''}`}
                                onClick={() => setActiveTab('folders')}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                                Carpetas
                            </button>
                            <button
                                className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                                onClick={() => setActiveTab('settings')}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                                Ajustes
                            </button>
                            <button
                                className={`nav-item ${activeTab === 'docs' ? 'active' : ''}`}
                                onClick={() => setActiveTab('docs')}
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                                Documentación
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

                        <div className="main-content-scroll">
                            {activeTab === 'dashboard' && (
                                <div className="section-dashboard">
                                    <header className="dashboard-content-header">
                                        <h1>Dashboard de Productividad</h1>
                                        <p>Análisis en tiempo real del uso de tus herramientas.</p>
                                    </header>

                                    <div className="stats-grid-dashboard">
                                        <div className="stat-card-new">
                                            <div className="stat-card-icon purple">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                                            </div>
                                            <div className="stat-card-info">
                                                <span className="stat-label">Uso de Links (Hoy)</span>
                                                <div className="stat-row">
                                                    <span className="stat-value">
                                                        {usageStats
                                                            .filter(s => s.tool_type === 'links' && s.date === new Date().toISOString().split('T')[0])
                                                            .reduce((acc, curr) => acc + curr.count, 0)}
                                                    </span>
                                                    <span className="stat-trend positive">Hoy</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="stat-card-new">
                                            <div className="stat-card-icon green">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                                            </div>
                                            <div className="stat-card-info">
                                                <span className="stat-label">Transcripciones (Hoy)</span>
                                                <div className="stat-row">
                                                    <span className="stat-value">
                                                        {usageStats
                                                            .filter(s => s.tool_type === 'transcription' && s.date === new Date().toISOString().split('T')[0])
                                                            .reduce((acc, curr) => acc + curr.count, 0)}
                                                    </span>
                                                    <span className="stat-trend positive">Hoy</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="stat-card-new">
                                            <div className="stat-card-icon blue">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                                            </div>
                                            <div className="stat-card-info">
                                                <span className="stat-label">Total Acciones</span>
                                                <div className="stat-row">
                                                    <span className="stat-value">
                                                        {usageStats.reduce((acc, curr) => acc + curr.count, 0)}
                                                    </span>
                                                    <span className="stat-trend text-secondary">Histórico</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="dashboard-charts-row">
                                        <div className="chart-placeholder-card full-width">
                                            <div className="card-header-small">
                                                <h4>Actividad de Links (Semanal)</h4>
                                                <div className="badge-new">Links</div>
                                            </div>
                                            <div className="real-chart-container">
                                                <ResponsiveContainer width="100%" height={250}>
                                                    <AreaChart data={
                                                        // useMemo para optimizar el procesamiento de datos
                                                        (() => {
                                                            const filtered = usageStats.filter(s => s.tool_type === 'links');
                                                            const grouped = filtered.reduce((acc: any, curr) => {
                                                                if (!acc[curr.date]) acc[curr.date] = { date: curr.date, day: curr.day_of_week, count: 0 };
                                                                acc[curr.date].count += curr.count;
                                                                return acc;
                                                            }, {});
                                                            return Object.values(grouped)
                                                                .sort((a: any, b: any) => a.date.localeCompare(b.date))
                                                                .slice(-7);
                                                        })()
                                                    }>
                                                        <defs>
                                                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                                                                <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 12 }} />
                                                        <Tooltip
                                                            contentStyle={{ backgroundColor: 'rgba(20, 20, 25, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                                                            itemStyle={{ color: '#a855f7' }}
                                                        />
                                                        <Area type="monotone" dataKey="count" stroke="#a855f7" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="dashboard-charts-row">
                                        <div className="chart-placeholder-card">
                                            <div className="card-header-small">
                                                <h4>Uso de Transcripción (Whisper)</h4>
                                                <div className="badge-new" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>Voz</div>
                                            </div>
                                            <div className="real-chart-container">
                                                <ResponsiveContainer width="100%" height={200}>
                                                    <BarChart data={
                                                        Object.values(usageStats.filter(s => s.tool_type === 'transcription').reduce((acc: any, curr) => {
                                                            if (!acc[curr.date]) acc[curr.date] = { date: curr.date, day: curr.day_of_week, count: 0 };
                                                            acc[curr.date].count += curr.count;
                                                            return acc;
                                                        }, {})).sort((a: any, b: any) => a.date.localeCompare(b.date)).slice(-7)
                                                    }>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} />
                                                        <Tooltip
                                                            contentStyle={{ backgroundColor: 'rgba(20, 20, 25, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                                            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                                        />
                                                        <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                        <div className="chart-placeholder-card">
                                            <div className="card-header-small">
                                                <h4>Resumen Diario (Links)</h4>
                                                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Últimos registros por día</p>
                                            </div>
                                            <div className="usage-table-mini-container">
                                                <table className="usage-table-mini">
                                                    <thead>
                                                        <tr>
                                                            <th>Día</th>
                                                            <th>Fecha</th>
                                                            <th>Usos</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {usageStats
                                                            .filter(s => s.tool_type === 'links')
                                                            .slice(0, 5)
                                                            .map((stat, i) => (
                                                                <tr key={i}>
                                                                    <td className="font-semibold">{stat.day_of_week}</td>
                                                                    <td className="text-secondary" style={{ fontSize: '11px' }}>{stat.date}</td>
                                                                    <td>
                                                                        <span className="count-badge">{stat.count}</span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        {usageStats.filter(s => s.tool_type === 'links').length === 0 && (
                                                            <tr>
                                                                <td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.3)' }}>
                                                                    Sin datos aún
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </tbody>
                                                </table>
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

                                    <div className="glass-form-container">
                                        <form onSubmit={handleSubmitLink} className="modern-form-inline">
                                            <div className="form-row">
                                                <div className="form-group flex-2">
                                                    <input
                                                        type="text"
                                                        value={formData.name}
                                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                        required
                                                        placeholder="Alias (Ej: Workspace)"
                                                    />
                                                </div>
                                                <div className="form-group flex-3">
                                                    <input
                                                        type="text"
                                                        value={formData.url}
                                                        onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                                        required
                                                        placeholder="URL o Comando (https://...)"
                                                    />
                                                </div>
                                                <div className="form-group flex-2">
                                                    <select
                                                        value={formData.category}
                                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                                        className="browser-select"
                                                        style={{ height: '42px', width: '100%', minWidth: 'unset' }}
                                                    >
                                                        {folders.map(f => (
                                                            <option key={f.id} value={f.name}>{f.name}</option>
                                                        ))}
                                                    </select>
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

                                    <div className="filter-bar">
                                        <button
                                            className={`filter-btn ${selectedFolderFilter === 'Todas' ? 'active' : ''}`}
                                            onClick={() => setSelectedFolderFilter('Todas')}
                                        >
                                            Todas
                                        </button>
                                        {folders.map(f => (
                                            <button
                                                key={f.id}
                                                className={`filter-btn ${selectedFolderFilter === f.name ? 'active' : ''}`}
                                                onClick={() => setSelectedFolderFilter(f.name)}
                                            >
                                                {f.name}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="table-container-macos">
                                        <table className="macos-table">
                                            <thead>
                                                <tr>
                                                    <th>Alias</th>
                                                    <th>URL / Comando</th>
                                                    <th>Carpeta</th>
                                                    <th className="actions-column">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {links
                                                    .filter(link => selectedFolderFilter === 'Todas' || link.category === selectedFolderFilter)
                                                    .map((link) => (
                                                        <tr key={link.id}>
                                                            <td className="font-semibold">{link.name}</td>
                                                            <td className="text-accent">{link.url}</td>
                                                            <td>
                                                                <span className="badge-new" style={{ fontSize: '10px', padding: '2px 8px' }}>
                                                                    {link.category || 'General'}
                                                                </span>
                                                            </td>
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
                                        {links.length > 0 && links.filter(link => selectedFolderFilter === 'Todas' || link.category === selectedFolderFilter).length === 0 && (
                                            <div className="empty-table-state">
                                                <p>No hay links en esta carpeta</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'folders' && (
                                <div className="section-folders">
                                    <div className="admin-header-inline">
                                        <div className="card-header">
                                            <h3>{editingFolder ? 'Editar Carpeta' : 'Nueva Carpeta'}</h3>
                                            <p>Organiza tus links en categorías.</p>
                                        </div>
                                    </div>

                                    <div className="form-container-top">
                                        <form onSubmit={handleSubmitFolder} className="modern-form-inline">
                                            <div className="form-row">
                                                <div className="form-group flex-2">
                                                    <label>Nombre</label>
                                                    <input
                                                        type="text"
                                                        value={folderFormData.name}
                                                        onChange={(e) => setFolderFormData({ ...folderFormData, name: e.target.value })}
                                                        required
                                                        placeholder="Ej: Trabajo"
                                                    />
                                                </div>
                                                <div className="form-group flex-3">
                                                    <label>Descripción</label>
                                                    <input
                                                        type="text"
                                                        value={folderFormData.description}
                                                        onChange={(e) => setFolderFormData({ ...folderFormData, description: e.target.value })}
                                                        placeholder="Opcional"
                                                    />
                                                </div>
                                                <div className="form-actions-inline">
                                                    <button type="submit" className="btn-save">
                                                        {editingFolder ? 'Actualizar' : 'Agregar'}
                                                    </button>
                                                    {editingFolder && (
                                                        <button type="button" className="btn-cancel" onClick={resetFolderForm}>
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
                                                    <th>Nombre</th>
                                                    <th>Descripción</th>
                                                    <th className="actions-column">Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {folders.map((folder) => (
                                                    <tr key={folder.id}>
                                                        <td className="font-semibold">{folder.name}</td>
                                                        <td className="text-secondary">{folder.description || '-'}</td>
                                                        <td className="actions-cell">
                                                            <div className="table-actions">
                                                                <button className="btn-table-action edit" onClick={() => handleEditFolder(folder)} title="Editar">
                                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                                </button>
                                                                <button
                                                                    className={`btn-table-action delete ${folder.name === 'General' ? 'disabled' : ''}`}
                                                                    onClick={() => folder.name !== 'General' && handleDeleteFolder(folder.id)}
                                                                    title={folder.name === 'General' ? 'No se puede eliminar' : 'Eliminar'}
                                                                    disabled={folder.name === 'General'}
                                                                >
                                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
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
                                                <span>Audio en transcripción</span>
                                                <p>Reproducir sonidos al iniciar y detener la grabación de voz.</p>
                                            </div>
                                            <label className="switch">
                                                <input
                                                    type="checkbox"
                                                    checked={playAudioTranscription}
                                                    onChange={(e) => toggleAudioTranscription(e.target.checked)}
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

                            {activeTab === 'docs' && (
                                <div className="section-docs">
                                    <header className="dashboard-content-header">
                                        <h1>Documentación</h1>
                                        <p>Guía completa para dominar Vallet OS y sus funcionalidades.</p>
                                    </header>

                                    <div className="docs-grid">
                                        {/* Columna Izquierda: Introducción y Shortcuts */}
                                        <div className="docs-column">
                                            <div className="docs-card">
                                                <div className="card-icon-header purple">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
                                                    <h3>Atajos de Teclado</h3>
                                                </div>
                                                <ul className="docs-list">
                                                    <li>
                                                        <span className="key-combination">Ctrl + Shift + Espacio</span>
                                                        <span className="key-description">Abre/Muestra el buscador principal.</span>
                                                    </li>
                                                    <li>
                                                        <span className="key-combination">Ctrl + Alt + Espacio</span>
                                                        <span className="key-description">Inicia/Detiene la grabación de voz (Whisper).</span>
                                                    </li>
                                                    <li>
                                                        <span className="key-combination">Ctrl + Shift + C</span>
                                                        <span className="key-description">Accede directamente a la sección de Links.</span>
                                                    </li>
                                                    <li>
                                                        <span className="key-combination">Ctrl + Shift + X</span>
                                                        <span className="key-description">Minimiza rápidamente todas las ventanas de la app.</span>
                                                    </li>
                                                    <li>
                                                        <span className="key-combination">Enter</span>
                                                        <span className="key-description">Ejecuta la búsqueda o abre el link seleccionado.</span>
                                                    </li>
                                                    <li>
                                                        <span className="key-combination">Esc</span>
                                                        <span className="key-description">Oculta la ventana o cierra el panel actual.</span>
                                                    </li>
                                                </ul>
                                            </div>

                                            <div className="docs-card">
                                                <div className="card-icon-header blue">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><polyline points="13 2 13 9 20 9" /></svg>
                                                    <h3>Funcionalidades</h3>
                                                </div>
                                                <div className="docs-feature-item">
                                                    <strong>Buscador Inteligente:</strong> Encuentra links guardados, abre URLs directamente o lanza aplicaciones del sistema.
                                                </div>
                                                <div className="docs-feature-item">
                                                    <strong>Gestión de Links:</strong> Organiza tus sitios favoritos por carpetas y nombres personalizados para acceso rápido.
                                                </div>
                                                <div className="docs-feature-item">
                                                    <strong>Privacidad Total:</strong> Todo el procesamiento, incluyendo la voz, ocurre localmente en tu computadora.
                                                </div>
                                            </div>

                                            <div className="docs-card">
                                                <div className="card-icon-header orange" style={{ color: '#f97316' }}>
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
                                                    <h3>Comandos de Búsqueda</h3>
                                                </div>
                                                <p className="docs-paragraph">Puedes escribir comandos directamente en el buscador principal para realizar acciones rápidas:</p>
                                                <ul className="docs-bullets">
                                                    <li><code>calc</code> - Abre la calculadora de Windows.</li>
                                                    <li><code>notepad</code> - Abre el Bloc de notas.</li>
                                                    <li><code>control</code> - Abre el Panel de Control.</li>
                                                    <li><code>mspaint</code> - Abre Paint.</li>
                                                    <li><code>cmd</code> - Abre el Símbolo del sistema.</li>
                                                    <li><code>https://google.com</code> - Abre una URL directamente.</li>
                                                </ul>
                                            </div>
                                        </div>

                                        {/* Columna Derecha: Sistema Whisper AI */}
                                        <div className="docs-column">
                                            <div className="docs-card whisper-highlight">
                                                <div className="card-icon-header green">
                                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></svg>
                                                    <h3>Whisper AI: Voz a Texto</h3>
                                                </div>
                                                <p className="docs-paragraph">
                                                    El sistema Whisper permite transcribir tu voz a texto de forma instantánea y pegarla automáticamente donde esté tu cursor.
                                                </p>

                                                <h4 className="docs-subtitle">¿Cómo funciona?</h4>
                                                <ol className="docs-steps">
                                                    <li>Presiona <code>Ctrl + Alt + Espacio</code> para grabar.</li>
                                                    <li>Habla claramente.</li>
                                                    <li>Presiona el atajo nuevamente para detener.</li>
                                                    <li>El sistema procesa el audio y pega el texto resultante.</li>
                                                </ol>

                                                <div className="docs-info-box">
                                                    <strong>Tip:</strong> El modelo <strong>small</strong> ofrece el mejor equilibrio entre velocidad y precisión. Asegúrate de tener el binario adecuado para tu GPU (CUDA) o CPU.
                                                </div>

                                                <h4 className="docs-subtitle">Requisitos de Instalación</h4>
                                                <ul className="docs-bullets">
                                                    <li>Carpeta <code>whisper/</code> en la raíz del proyecto.</li>
                                                    <li>Archivo <code>whisper-cli.exe</code>.</li>
                                                    <li>Modelo <code>ggml-small.bin</code>.</li>
                                                </ul>
                                            </div>
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
                    <img src={valletLogo} alt="Logo" className="recording-logo" />
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
                        <span className="key">Esc</span> para ocultar ·
                        <span className="key">Ctrl+Shift+C</span> para Mis Links
                    </div>
                </div>

                {searchResults.length > 0 && (
                    <div className="results-box">
                        <div className="search-results" ref={resultsRef}>
                            {searchResults.map((link, index) => (
                                <div
                                    key={link.id}
                                    className={`result-item ${index === selectedIndex ? 'selected' : ''}`}
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
