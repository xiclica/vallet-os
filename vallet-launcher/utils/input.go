package utils

import (
	"time"

	"github.com/atotto/clipboard"
	"github.com/micmonay/keybd_event"
)

// PasteText simula la acción de pegar texto (Ctrl+V) después de copiarlo al portapapeles.
func PasteText(text string) error {
	// 1. Escribir el texto en el portapapeles del sistema.
	if err := clipboard.WriteAll(text); err != nil {
		return err
	}

	// 2. Inicializar el simulador de eventos de teclado.
	kb, err := keybd_event.NewKeyBonding()
	if err != nil {
		return err
	}

	// 3. Configurar la combinación de teclas Ctrl + V.
	kb.HasCTRL(true)
	kb.SetKeys(keybd_event.VK_V)

	// Pequeña espera para asegurar que el portapapeles procesó el nuevo texto.
	time.Sleep(100 * time.Millisecond)

	// 4. Ejecutar la pulsación de teclas.
	err = kb.Launching()
	if err != nil {
		return err
	}

	return nil
}
