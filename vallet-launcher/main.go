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

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	app := NewApp()

	// Start systray in a goroutine
	go func() {
		systray.Run(onReady(app), onExit)
	}()

	err := wails.Run(&options.App{
		Title:            "Vallet Launcher",
		Width:            660,
		Height:           110,
		Frameless:        true,
		AlwaysOnTop:      true,
		BackgroundColour: &options.RGBA{R: 0, G: 0, B: 0, A: 0},
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup:     app.startup,
		OnDomReady:    app.domReady,
		OnBeforeClose: app.beforeClose,
		OnShutdown:    app.shutdown,
		Bind: []interface{}{
			app,
		},
		Windows: &windows.Options{
			WebviewIsTransparent: true,
			WindowIsTranslucent:  true,
			BackdropType:         windows.None,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}

func onReady(app *App) func() {
	return func() {
		iconData, err := os.ReadFile("build/appicon.png")
		if err == nil {
			systray.SetIcon(iconData)
		}
		systray.SetTitle("Vallet Launcher")
		systray.SetTooltip("Vallet Launcher")

		mShow := systray.AddMenuItem("Mostrar", "Muestra la ventana principal")
		systray.AddSeparator()
		mQuit := systray.AddMenuItem("Salir", "Cierra la aplicación")

		go func() {
			for {
				select {
				case <-mShow.ClickedCh:
					app.ShowWindow()
				case <-mQuit.ClickedCh:
					app.QuitApp()
				}
			}
		}()
	}
}

func onExit() {
	// Limpieza si es necesario
}
