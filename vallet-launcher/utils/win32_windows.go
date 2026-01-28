//go:build windows

package utils

import (
	"syscall"
	"unsafe"
)

var (
	// user32 carga funciones de la API de usuario de Windows para manejo de ventanas.
	user32           = syscall.NewLazyDLL("user32.dll")
	findWindow       = user32.NewProc("FindWindowW")      // Buscar una ventana por su título.
	showWindow       = user32.NewProc("ShowWindow")       // Cambiar el estado de visualización de una ventana.
	setWindowPos     = user32.NewProc("SetWindowPos")     // Cambiar posición, tamaño y orden Z.
	getSystemMetrics = user32.NewProc("GetSystemMetrics") // Obtener dimensiones de pantalla, etc.
)

const (
	// Constantes de la API de Windows.
	SW_SHOWNOACTIVATE = 4           // Muestra la ventana sin darle el foco.
	SWP_NOSIZE        = 0x0001      // Mantiene el tamaño actual.
	SWP_NOMOVE        = 0x0002      // Mantiene la posición actual.
	SWP_NOACTIVATE    = 0x0010      // No activa la ventana tras el cambio.
	HWND_TOPMOST      = ^uintptr(0) // -1 (Fija la ventana por encima de todas).
	SM_CXSCREEN       = 0           // Ancho de la pantalla.
	SM_CYSCREEN       = 1           // Alto de la pantalla.
)

// ShowWindowNoActivate muestra la ventana de la aplicación sin robar el foco de la ventana actual.
func ShowWindowNoActivate(title string) {
	windowTitlePtr, _ := syscall.UTF16PtrFromString(title)
	hwnd, _, _ := findWindow.Call(0, uintptr(unsafe.Pointer(windowTitlePtr)))
	if hwnd != 0 {
		showWindow.Call(hwnd, uintptr(SW_SHOWNOACTIVATE))
	}
}

// ResizeWindowNoActivate cambia el tamaño de la ventana sin activarla.
func ResizeWindowNoActivate(title string, width, height int) {
	windowTitlePtr, _ := syscall.UTF16PtrFromString(title)
	hwnd, _, _ := findWindow.Call(0, uintptr(unsafe.Pointer(windowTitlePtr)))
	if hwnd != 0 {
		setWindowPos.Call(hwnd, 0, 0, 0, uintptr(width), uintptr(height), SWP_NOMOVE|SWP_NOACTIVATE)
	}
}

// CenterWindowNoActivate centra la ventana en la pantalla y le asigna un tamaño sin activarla.
func CenterWindowNoActivate(title string, width, height int) {
	windowTitlePtr, _ := syscall.UTF16PtrFromString(title)
	hwnd, _, _ := findWindow.Call(0, uintptr(unsafe.Pointer(windowTitlePtr)))
	if hwnd != 0 {
		// Obtener resolución de pantalla.
		screenWidth, _, _ := getSystemMetrics.Call(uintptr(SM_CXSCREEN))
		screenHeight, _, _ := getSystemMetrics.Call(uintptr(SM_CYSCREEN))

		// Calcular coordenadas para centrar.
		x := (int(screenWidth) - width) / 2
		y := (int(screenHeight) - height) / 2

		setWindowPos.Call(hwnd, 0, uintptr(x), uintptr(y), uintptr(width), uintptr(height), SWP_NOACTIVATE)
	}
}
