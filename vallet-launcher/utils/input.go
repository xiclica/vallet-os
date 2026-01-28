package utils

import (
	"time"

	"github.com/atotto/clipboard"
	"github.com/micmonay/keybd_event"
)

// PasteText types the text by pasting it from the clipboard
func PasteText(text string) error {
	// Backup clipboard? Optional. For now just overwrite.
	if err := clipboard.WriteAll(text); err != nil {
		return err
	}

	kb, err := keybd_event.NewKeyBonding()
	if err != nil {
		return err
	}

	// For Windows and others
	kb.HasCTRL(true)
	kb.SetKeys(keybd_event.VK_V)

	// Small delay to ensure clipboard is ready
	time.Sleep(100 * time.Millisecond)

	// Press
	err = kb.Launching()
	if err != nil {
		return err
	}

	return nil
}
