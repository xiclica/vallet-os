package main

import (
	"context"
	"fmt"
	"runtime"
	"syscall"
	"unsafe"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
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

	recording := false

	go func() {
		// ID 1: Launcher (Ctrl + Shift + Space)
		hotkeyID_Launcher := 1
		reghotkey.Call(0, uintptr(hotkeyID_Launcher), MOD_CONTROL|MOD_SHIFT, VK_SPACE)
		defer unreghotkey.Call(0, uintptr(hotkeyID_Launcher))

		// ID 2: Whisper (Ctrl + Alt + Space)
		hotkeyID_Whisper := 2
		reghotkey.Call(0, uintptr(hotkeyID_Whisper), MOD_CONTROL|MOD_ALT, VK_SPACE)
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
						recording = true
						wailsruntime.EventsEmit(ctx, "start-recording")
						fmt.Println("🎙️ Iniciando grabación via Frontend...")
					} else {
						recording = false
						wailsruntime.EventsEmit(ctx, "stop-recording")
						fmt.Println("⏹️ Deteniendo grabación...")
					}
				}
			}
		}
	}()
}
