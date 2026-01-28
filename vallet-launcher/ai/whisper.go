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
	WhisperType = "small" // Model type
	ModelName   = "ggml-small.bin"
	BinaryName  = "whisper-cli.exe"
)

type WhisperClient struct {
	binaryPath string
	modelPath  string
}

func NewWhisperClient() (*WhisperClient, error) {
	// Look for binary and model in current execution dir
	exePath, err := os.Executable()
	if err != nil {
		return nil, err
	}
	exeDir := filepath.Dir(exePath)

	// Also check current working directory (useful for dev)
	cwd, _ := os.Getwd()

	possibleBinaryDirs := []string{
		exeDir,
		cwd,
		filepath.Join(exeDir, "resources"),
		filepath.Join(cwd, "resources"),
		filepath.Join(cwd, "ai"),
		filepath.Join(exeDir, "ai"),
		filepath.Join(cwd, "whisper", "whisper-cublas-12.4.0-bin-x64", "Release"),
	}

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

	for _, dir := range possibleBinaryDirs {
		bPath := filepath.Join(dir, BinaryName)
		if _, err := os.Stat(bPath); err == nil {
			binaryPath = bPath
			break
		}
	}

	for _, dir := range possibleModelDirs {
		mPath := filepath.Join(dir, ModelName)
		if _, err := os.Stat(mPath); err == nil {
			modelPath = mPath
			break
		}
	}

	// Fallback/Warning if not found, let the user know they need to place them
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

func (w *WhisperClient) Transcribe(wavPath string) (string, error) {
	// Check if files exist
	if _, err := os.Stat(w.binaryPath); os.IsNotExist(err) {
		if p, err := exec.LookPath(w.binaryPath); err == nil {
			w.binaryPath = p
		} else {
			return "", fmt.Errorf("whisper binary not found: %s", w.binaryPath)
		}
	}
	if _, err := os.Stat(w.modelPath); os.IsNotExist(err) {
		return "", fmt.Errorf("whisper model not found: %s", w.modelPath)
	}

	// Command: whisper-cli -m model -f file -nt -l auto
	// -t 8: Hilos de CPU (para gestión)
	// -bs 1: Beam size 1 (Mucho más rápido)
	// -bo 1: Best of 1 (Vital para velocidad)
	// --max-len 0: Sin límite de longitud de segmento
	cmd := exec.Command(w.binaryPath, "-m", w.modelPath, "-f", wavPath, "-nt", "-l", "auto", "-t", "8", "-bs", "1", "-bo", "1")

	// Hide window on Windows to prevent stealing focus
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

	err := cmd.Run()

	// Imprimimos el stderr siempre para ver si usa GPU (CUDA = 1, etc)
	fmt.Println("--- Whisper System Info ---")
	fmt.Println(stderr.String())
	fmt.Println("---------------------------")

	if err != nil {
		return "", fmt.Errorf("whisper execution failed: %v, stderr: %s", err, stderr.String())
	}

	output := strings.TrimSpace(stdout.String())
	return output, nil
}
