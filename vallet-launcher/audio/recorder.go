package audio

import (
	"fmt"
	"log"
	"path/filepath"
	"syscall"
	"unsafe"
)

var (
	winmm             = syscall.NewLazyDLL("winmm.dll")
	mciSendString     = winmm.NewProc("mciSendStringW")
	mciGetErrorString = winmm.NewProc("mciGetErrorStringW")
)

type Recorder struct {
	filePath string
	alias    string
}

func NewRecorder() (*Recorder, error) {
	return &Recorder{
		alias: "vallet_rec",
	}, nil
}

func (r *Recorder) Start(filename string) error {
	r.filePath = filename

	// Ensure clean state
	r.mci("close " + r.alias)

	// Open new recording session
	// Some systems prefer 'open new type waveaudio alias aliasname'
	// Others might work with just 'open new alias aliasname'
	if err := r.mci("open new type waveaudio alias " + r.alias); err != nil {
		return fmt.Errorf("failed to open mci device: %v", err)
	}

	// Configure for Whisper (16kHz, 16-bit, Mono)
	// We'll try to set these, but we won't fail if some aren't supported by the driver immediately
	cmds := []string{
		"set " + r.alias + " time format ms",
		"set " + r.alias + " bitspersample 16",
		"set " + r.alias + " channels 1",
		"set " + r.alias + " samplespersec 16000",
		"set " + r.alias + " bytespersec 32000",
		"set " + r.alias + " alignment 2",
	}

	for _, cmd := range cmds {
		if err := r.mci(cmd); err != nil {
			log.Printf("MCI [%s] Warning: %v", cmd, err)
		}
	}

	// Start recording
	if err := r.mci("record " + r.alias); err != nil {
		return fmt.Errorf("failed to start recording: %v", err)
	}

	return nil
}

func (r *Recorder) Stop() error {
	// Stop recording
	if err := r.mci("stop " + r.alias); err != nil {
		log.Printf("Error stopping recording: %v", err)
	}

	// Save to file
	// Wrap path in quotes to handle spaces
	absPath, _ := filepath.Abs(r.filePath)
	cmd := fmt.Sprintf("save %s \"%s\"", r.alias, absPath)
	if err := r.mci(cmd); err != nil {
		return fmt.Errorf("failed to save recording: %v", err)
	}

	// Close device
	r.mci("close " + r.alias)
	return nil
}

func (r *Recorder) Close() {
	r.mci("close " + r.alias)
}

func (r *Recorder) mci(command string) error {
	utf16Cmd, err := syscall.UTF16PtrFromString(command)
	if err != nil {
		return err
	}

	// mciSendStringW(command, buffer, bufferSize, callback)
	ret, _, _ := mciSendString.Call(
		uintptr(unsafe.Pointer(utf16Cmd)),
		0,
		0,
		0,
	)

	if ret != 0 {
		return fmt.Errorf("MCI Error %d: %s", ret, r.getErrorString(uint32(ret)))
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
