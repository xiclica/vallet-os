package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"syscall"
	"unsafe"

	"vallet-launcher/ai"
	"vallet-launcher/audio"
	"vallet-launcher/utils"
)

var (
	user32      = syscall.NewLazyDLL("user32.dll")
	reghotkey   = user32.NewProc("RegisterHotKey")
	unreghotkey = user32.NewProc("UnregisterHotKey")
	getmessage  = user32.NewProc("GetMessageW")
)

const (
	MOD_ALT     = 0x0001
	MOD_CONTROL = 0x0002
	MOD_SHIFT   = 0x0004
	VK_SPACE    = 0x20
	WM_HOTKEY   = 0x0312
)

type MSG struct {
	HWND   uintptr
	Uint   uint32
	Wparam uintptr
	Lparam uintptr
	Time   uint32
	Pt     struct{ X, Y int32 }
}

func (a *App) setupHotkeys(ctx context.Context) {
	if runtime.GOOS != "windows" {
		return
	}

	// Initialize Audio Recorder
	recorder, err := audio.NewRecorder()
	if err != nil {
		log.Printf("Error initializing recorder: %v", err)
	}
	defer recorder.Close()

	// Initialize Whisper Client
	whisper, err := ai.NewWhisperClient()
	if err != nil {
		log.Printf("Error initializing whisper: %v", err)
	}

	recording := false
	tempFile := filepath.Join(os.TempDir(), "vallet_voice_temp.wav")

	go func() {
		// ID 1: Launcher (Ctrl + Shift + Space)
		hotkeyID_Launcher := 1
		ret, _, err := reghotkey.Call(0, uintptr(hotkeyID_Launcher), MOD_CONTROL|MOD_SHIFT, VK_SPACE)
		if ret == 0 {
			fmt.Printf("Error registrando hotkey Launcher: %v\n", err)
		}
		defer unreghotkey.Call(0, uintptr(hotkeyID_Launcher))

		// ID 2: Whisper (Ctrl + Alt + Space)
		hotkeyID_Whisper := 2
		ret2, _, err2 := reghotkey.Call(0, uintptr(hotkeyID_Whisper), MOD_CONTROL|MOD_ALT, VK_SPACE)
		if ret2 == 0 {
			fmt.Printf("Error registrando hotkey Whisper: %v\n", err2)
		}
		defer unreghotkey.Call(0, uintptr(hotkeyID_Whisper))

		var msg MSG
		for {
			ret, _, _ := getmessage.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
			if int32(ret) <= 0 {
				break
			}

			if msg.Uint == WM_HOTKEY {
				switch msg.Wparam {
				case uintptr(hotkeyID_Launcher):
					a.ShowWindow()

				case uintptr(hotkeyID_Whisper):
					if !recording {
						// START RECORDING
						if recorder == nil {
							continue
						}
						err := recorder.Start(tempFile)
						if err != nil {
							log.Printf("Error starting recording: %v", err)
							continue
						}
						recording = true
						// beep or visual cue could go here
						fmt.Println("🎙️ Recording started...")
					} else {
						// STOP RECORDING & TRANSCRIBE
						recording = false
						if recorder != nil {
							recorder.Stop()
						}
						fmt.Println("⏹️ Recording stopped. Transcribing...")

						// Process in background
						go func() {
							if whisper == nil {
								log.Println("Whisper client not initialized")
								return
							}

							text, err := whisper.Transcribe(tempFile)
							if err != nil {
								log.Printf("Transcription error: %v", err)
								return
							}

							if text != "" {
								fmt.Printf("📝 Transcribed: %s\n", text)
								if err := utils.PasteText(text); err != nil {
									log.Printf("Error pasting text: %v", err)
								}
							}
						}()
					}
				}
			}
		}
	}()
}
