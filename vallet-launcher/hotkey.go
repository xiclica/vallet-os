package main

import (
	"context"
	"fmt"
	"runtime"
	"syscall"
	"unsafe"
	"vallet-launcher/utils"

	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

var (
	// user32 carga la librería dinámica de Windows necesaria para registrar hotkeys globales.
	user32      = syscall.NewLazyDLL("user32.dll")
	reghotkey   = user32.NewProc("RegisterHotKey")
	unreghotkey = user32.NewProc("UnregisterHotKey")
	getmessage  = user32.NewProc("GetMessageW")
)

const (
	// Modificadores de teclas y códigos de teclas virtuales.
	MOD_ALT     = 0x0001
	MOD_CONTROL = 0x0002
	MOD_SHIFT   = 0x0004
	VK_SPACE    = 0x20   // Código de la barra espaciadora.
	WM_HOTKEY   = 0x0312 // Identificador del mensaje de evento de hotkey.
)

// MSG representa la estructura del sistema de Windows para mensajes de eventos.
type MSG struct {
	HWND   uintptr
	Uint   uint32
	Wparam uintptr
	Lparam uintptr
	Time   uint32
	Pt     struct{ X, Y int32 }
}

// setupHotkeys registra y escucha los atajos de teclado globales (Ctrl+Shift+Espacio y Ctrl+Alt+Espacio).
func (a *App) setupHotkeys(ctx context.Context) {
	// Solo disponible en Windows por el uso de la API Win32.
	if runtime.GOOS != "windows" {
		return
	}

	recording := false

	// Se lanza en una goroutine para no bloquear el hilo principal de la UI.
	go func() {
		// Importante: Bloquear esta goroutine a un hilo del SO para RegisterHotKey / GetMessage.
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()

		// ID 1: Atajo para mostrar el Launcher (Ctrl + Shift + Espacio).
		hotkeyID_Launcher := 1
		ok1, _, err1 := reghotkey.Call(0, uintptr(hotkeyID_Launcher), MOD_CONTROL|MOD_SHIFT, VK_SPACE)
		if ok1 == 0 {
			fmt.Printf("❌ Error registrando Hotkey Launcher (Ctrl+Shift+Space): %v\n", err1)
		} else {
			fmt.Println("✅ Hotkey Launcher registrado (Ctrl+Shift+Space)")
		}
		defer unreghotkey.Call(0, uintptr(hotkeyID_Launcher))

		// ID 2: Atajo para activar grabación por voz Whisper (Ctrl + Alt + Espacio).
		hotkeyID_Whisper := 2
		ok2, _, err2 := reghotkey.Call(0, uintptr(hotkeyID_Whisper), MOD_CONTROL|MOD_ALT, VK_SPACE)
		if ok2 == 0 {
			fmt.Printf("❌ Error registrando Hotkey Whisper (Ctrl+Alt+Space): %v\n", err2)
		} else {
			fmt.Println("✅ Hotkey Whisper registrado (Ctrl+Alt+Space)")
		}
		defer unreghotkey.Call(0, uintptr(hotkeyID_Whisper))

		fmt.Println("🎹 Bucle de mensajes de Windows para hotkeys iniciado.")

		var msg MSG
		for {
			// Escucha de mensajes del sistema de Windows.
			ret, _, _ := getmessage.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
			if int32(ret) == 0 {
				fmt.Println("ℹ️ Bucle de hotkeys finalizado por WM_QUIT.")
				break
			}
			if int32(ret) < 0 {
				fmt.Printf("❌ Error en GetMessage (bucle hotkeys): %v\n", ret)
				break
			}

			// Procesa el mensaje si corresponde a un hotkey registrado.
			if msg.Uint == WM_HOTKEY {
				switch msg.Wparam {
				case uintptr(hotkeyID_Launcher):
					// Muestra la ventana del buscador.
					a.ShowWindow()

				case uintptr(hotkeyID_Whisper):
					// Alterna la grabación de audio.
					if !recording {
						recording = true
						// Muestra la ventana en modo grabación sin quitarle el foco a la app actual.
						utils.ShowWindowNoActivate("Vallet Launcher")

						// Reproducir sonido de inicio y emitir evento al frontend.
						a.PlaySound("start-recording.wav")
						wailsruntime.EventsEmit(ctx, "start-recording")
						fmt.Println("🎙️ Iniciando grabación via Frontend...")
					} else {
						recording = false

						// Reproducir sonido de fin y emitir evento al frontend.
						a.PlaySound("end-recording.wav")
						wailsruntime.EventsEmit(ctx, "stop-recording")
						fmt.Println("⏹️ Deteniendo grabación...")
					}

				}
			}
		}
		fmt.Println("⚠️ Goroutine de hotkeys terminada.")
	}()
}
