package audio

import (
	"fmt"
	"log"
	"path/filepath"
	"syscall"
	"unsafe"
)

var (
	// winmm carga la librería multimedia de Windows para grabación y reproducción.
	winmm             = syscall.NewLazyDLL("winmm.dll")
	mciSendString     = winmm.NewProc("mciSendStringW")     // Comando para enviar cadenas MCI.
	mciGetErrorString = winmm.NewProc("mciGetErrorStringW") // Obtener descripción de errores MCI.
)

// Recorder gestiona la grabación de audio usando la interfaz MCI de Windows.
type Recorder struct {
	filePath string // Ruta donde se guardará el archivo final.
	alias    string // Alias interno para la sesión de grabación.
}

// NewRecorder crea una nueva instancia del grabador con un alias por defecto.
func NewRecorder() (*Recorder, error) {
	return &Recorder{
		alias: "vrec",
	}, nil
}

// Start inicia la sesión de grabación y configura los parámetros de audio (16kHz, 16bit, Mono).
func (r *Recorder) Start(filename string) error {
	r.filePath = filename

	// Asegurarse de cerrar cualquier sesión previa colgada.
	_ = r.mci("close " + r.alias)

	// Abrir un nuevo dispositivo de audio waveaudio con el alias definido.
	if err := r.mci("open new type waveaudio alias " + r.alias); err != nil {
		return fmt.Errorf("error abriendo dispositivo mci: %v", err)
	}

	// Configuración del formato de audio (optimizado para Whisper: 16kHz, mono).
	_ = r.mci("set " + r.alias + " time format ms")
	_ = r.mci("set " + r.alias + " bitspersample 16")
	_ = r.mci("set " + r.alias + " channels 1")
	_ = r.mci("set " + r.alias + " samplespersec 16000")
	_ = r.mci("set " + r.alias + " bytespersec 32000")
	_ = r.mci("set " + r.alias + " alignment 2")

	// Comenzar la grabación efectiva.
	if err := r.mci("record " + r.alias); err != nil {
		return fmt.Errorf("error iniciando grabación: %v", err)
	}

	log.Printf("Grabación iniciada en alias %s", r.alias)
	return nil
}

// Stop detiene la grabación, guarda el archivo en disco y cierra la sesión.
func (r *Recorder) Stop() error {
	// Detener la grabación.
	if err := r.mci("stop " + r.alias); err != nil {
		log.Printf("Error deteniendo grabación: %v", err)
	}

	// Guardar el audio acumulado en el archivo especificado.
	absPath, _ := filepath.Abs(r.filePath)
	cmd := fmt.Sprintf("save %s \"%s\"", r.alias, absPath)
	if err := r.mci(cmd); err != nil {
		return fmt.Errorf("error guardando grabación: %v", err)
	}

	// Cerrar el dispositivo para liberar recursos.
	r.mci("close " + r.alias)
	return nil
}

// Close fuerza el cierre del dispositivo MCI.
func (r *Recorder) Close() {
	r.mci("close " + r.alias)
}

// mci ejecuta comandos de la API MCI de Windows convirtiéndolos a UTF16.
func (r *Recorder) mci(command string) error {
	utf16Cmd, err := syscall.UTF16PtrFromString(command)
	if err != nil {
		return err
	}

	// Enviar el comando MCI.
	ret, _, _ := mciSendString.Call(
		uintptr(unsafe.Pointer(utf16Cmd)),
		0,
		0,
		0,
	)

	if ret != 0 {
		return fmt.Errorf("Error MCI %d: %s", ret, r.getErrorString(uint32(ret)))
	}
	return nil
}

func (r *Recorder) getErrorString(errCode uint32) string {
	buf := make([]uint16, 256)
	ret, _, _ := mciGetErrorString.Call(
		uintptr(errCode),
		uintptr(unsafe.Pointer(&buf[0])),
		uintptr(len(buf)),
	)
	if ret == 0 {
		return "Unknown MCI Error"
	}
	return syscall.UTF16ToString(buf)
}
