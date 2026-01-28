package main

import (
	"embed"
	"os"

	"github.com/getlantern/systray"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/windows"
)

// assets contiene los archivos compilados del frontend que se incrustan en el binario.
//
//go:embed all:frontend/dist
var assets embed.FS

// main es el punto de entrada principal de la aplicación.
func main() {
	app := NewApp()

	// Inicia el icono de la bandeja del sistema (systray) en una rutina independiente.
	go func() {
		systray.Run(onReady(app), onExit)
	}()

	// Configuración y ejecución de Wails.
	err := wails.Run(&options.App{
		Title:            "Vallet Launcher",
		Width:            720,
		Height:           150,
		Frameless:        true,                                  // Sin marcos de ventana estándar.
		AlwaysOnTop:      true,                                  // Siempre por encima de otras ventanas.
		BackgroundColour: &options.RGBA{R: 0, G: 0, B: 0, A: 0}, // Fondo transparente.
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup:     app.startup,     // Función al iniciar.
		OnDomReady:    app.domReady,    // Función cuando el frontend está listo.
		OnBeforeClose: app.beforeClose, // Función antes de cerrar.
		OnShutdown:    app.shutdown,    // Función al apagar.
		Bind: []interface{}{
			app, // Expone los métodos de App al JS del frontend.
		},
		Windows: &windows.Options{
			WebviewIsTransparent: true, // Permite transparencia en el webview.
			WindowIsTranslucent:  true, // Permite traslucidez en la ventana.
			BackdropType:         windows.None,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}

// onReady configura el icono y el menú de la bandeja del sistema una vez que está lista.
func onReady(app *App) func() {
	return func() {
		iconData, err := os.ReadFile("build/windows/icon.ico")
		if err == nil {
			systray.SetIcon(iconData)
		}
		systray.SetTitle("Vallet Launcher")
		systray.SetTooltip("Vallet Launcher")

		// Menús de la bandeja.
		mShow := systray.AddMenuItem("Mostrar", "Muestra la ventana principal")
		systray.AddSeparator()
		mQuit := systray.AddMenuItem("Salir", "Cierra la aplicación")

		// Manejo de eventos de clic en los menús.
		go func() {
			for {
				select {
				case <-mShow.ClickedCh:
					app.ShowWindow() // Muestra la ventana de la app.
				case <-mQuit.ClickedCh:
					app.QuitApp() // Cierra la app completamente.
				}
			}
		}()
	}
}

// onExit se ejecuta al salir de la bandeja del sistema.
func onExit() {
	// Limpieza si es necesario.
}
