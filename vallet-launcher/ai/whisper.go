package ai

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
)

const (
	WhisperType = "small"           // Tipo de modelo a utilizar (ej: tiny, base, small, medium, large).
	ModelName   = "ggml-small.bin"  // Nombre del archivo del modelo pre-entrenado.
	BinaryName  = "whisper-cli.exe" // Nombre del binario ejecutable de Whisper.
)

// WhisperClient maneja la comunicación con el binario de whisper.cpp.
type WhisperClient struct {
	binaryPath string // Ruta completa al ejecutable de Whisper.
	modelPath  string // Ruta completa al archivo del modelo .bin.
}

// NewWhisperClient inicializa un nuevo cliente buscando el binario y el modelo en rutas comunes.
func NewWhisperClient() (*WhisperClient, error) {
	// Obtener la ruta del ejecutable actual para buscar recursos relativos a él.
	exePath, err := os.Executable()
	if err != nil {
		return nil, err
	}
	exeDir := filepath.Dir(exePath)

	// También considerar el directorio de trabajo actual (útil durante el desarrollo).
	cwd, _ := os.Getwd()

	// Lista de directorios posibles donde podría estar el ejecutable de Whisper.
	possibleBinaryDirs := []string{
		exeDir,
		cwd,
		filepath.Join(exeDir, "resources"),
		filepath.Join(cwd, "resources"),
		filepath.Join(cwd, "ai"),
		filepath.Join(exeDir, "ai"),
		filepath.Join(cwd, "whisper", "whisper-cublas-12.4.0-bin-x64", "Release"),
	}

	// Lista de directorios posibles donde podría estar el modelo de lenguaje.
	possibleModelDirs := []string{
		exeDir,
		cwd,
		filepath.Join(exeDir, "resources"),
		filepath.Join(cwd, "resources"),
		filepath.Join(cwd, "ai"),
		filepath.Join(exeDir, "ai"),
		filepath.Join(cwd, "whisper", "whisper.cpp.small"),
		filepath.Join(cwd, "whisper", "whisper.cpp.small", "models"),
	}

	binaryPath := ""
	modelPath := ""

	// Buscar el binario en las rutas especificadas.
	for _, dir := range possibleBinaryDirs {
		bPath := filepath.Join(dir, BinaryName)
		if _, err := os.Stat(bPath); err == nil {
			binaryPath = bPath
			break
		}
	}

	// Buscar el modelo corregido en las rutas especificadas.
	for _, dir := range possibleModelDirs {
		mPath := filepath.Join(dir, ModelName)
		if _, err := os.Stat(mPath); err == nil {
			modelPath = mPath
			break
		}
	}

	// Si no se encuentran, se asumen los nombres por defecto (el SO los buscará en el PATH).
	if binaryPath == "" {
		binaryPath = BinaryName
	}
	if modelPath == "" {
		modelPath = ModelName
	}

	return &WhisperClient{
		binaryPath: binaryPath,
		modelPath:  modelPath,
	}, nil
}

// Transcribe toma la ruta de un archivo .wav y devuelve el texto transcrito.
func (w *WhisperClient) Transcribe(wavPath string) (string, error) {
	// Verificar que existan el binario y el modelo antes de ejecutar.
	if _, err := os.Stat(w.binaryPath); os.IsNotExist(err) {
		if p, err := exec.LookPath(w.binaryPath); err == nil {
			w.binaryPath = p
		} else {
			return "", fmt.Errorf("binario de whisper no encontrado: %s", w.binaryPath)
		}
	}
	if _, err := os.Stat(w.modelPath); os.IsNotExist(err) {
		return "", fmt.Errorf("modelo de whisper no encontrado: %s", w.modelPath)
	}

	// Configuración del comando para llamar a whisper-cli.
	// -m: ruta al modelo.
	// -f: ruta al archivo de audio.
	// -nt: no incluir timestamps en la salida.
	// -l auto: detectar lenguaje automáticamente.
	// -t 8: usar 8 hilos.
	// -bs 1 -bo 1: configuraciones de velocidad (beam search y best of).
	cmd := exec.Command(w.binaryPath, "-m", w.modelPath, "-f", wavPath, "-nt", "-l", "auto", "-t", "8", "-bs", "1", "-bo", "1")

	// En Windows, ocultamos la consola emergente para que no interrumpa al usuario.
	if runtime.GOOS == "windows" {
		cmd.SysProcAttr = &syscall.SysProcAttr{
			HideWindow:    true,
			CreationFlags: 0x08000000, // CREATE_NO_WINDOW
		}
	}

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// Ejecutar la transcripción.
	err := cmd.Run()

	// Se imprime la información del sistema (útil para diagnosticar si usa GPU/CUDA).
	fmt.Println("--- Información del Sistema Whisper ---")
	fmt.Println(stderr.String())
	fmt.Println("---------------------------------------")

	if err != nil {
		return "", fmt.Errorf("error ejecutando whisper: %v, stderr: %s", err, stderr.String())
	}

	// Limpiar y devolver el texto transcrito.
	output := strings.TrimSpace(stdout.String())
	return output, nil
}
