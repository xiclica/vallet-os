package main

import (
	"context"
	"fmt"
	"runtime"
	"syscall"
	"unsafe"
)

var (
	user32      = syscall.NewLazyDLL("user32.dll")
	reghotkey   = user32.NewProc("RegisterHotKey")
	unreghotkey = user32.NewProc("UnregisterHotKey")
	getmessage  = user32.NewProc("GetMessageW")
)

const (
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

	go func() {
		hotkeyID := 1
		// Register Ctrl + Shift + Space
		ret, _, err := reghotkey.Call(0, uintptr(hotkeyID), MOD_CONTROL|MOD_SHIFT, VK_SPACE)
		if ret == 0 {
			fmt.Printf("Error registrando hotkey: %v\n", err)
			return
		}
		defer unreghotkey.Call(0, uintptr(hotkeyID))

		var msg MSG
		for {
			ret, _, _ := getmessage.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
			if int32(ret) <= 0 {
				break
			}

			if msg.Uint == WM_HOTKEY {
				if msg.Wparam == uintptr(hotkeyID) {
					a.ShowWindow()
				}
			}
		}
	}()
}
