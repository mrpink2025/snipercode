package browser

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
)

// Fingerprint representa uma fingerprint de browser
type Fingerprint struct {
	UserAgent    string `json:"userAgent"`
	Language     string `json:"language"`
	Platform     string `json:"platform"`
	ScreenWidth  int    `json:"screenWidth"`
	ScreenHeight int    `json:"screenHeight"`
	Timezone     string `json:"timezone"`
	WebGL        string `json:"webgl"`
	Canvas       string `json:"canvas"`
}

// GenerateFingerprint gera fingerprint do browser
func GenerateFingerprint(fp Fingerprint) string {
	data, _ := json.Marshal(fp)
	hash := md5.Sum(data)
	return fmt.Sprintf("%x", hash)
}

// GetFingerprintScript retorna script JS para coletar fingerprint
func GetFingerprintScript() string {
	return `
(function() {
	return {
		userAgent: navigator.userAgent,
		language: navigator.language,
		platform: navigator.platform,
		screenWidth: screen.width,
		screenHeight: screen.height,
		timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		webgl: (function() {
			const canvas = document.createElement('canvas');
			const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
			if (!gl) return 'not supported';
			return gl.getParameter(gl.RENDERER);
		})(),
		canvas: (function() {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			ctx.textBaseline = 'top';
			ctx.font = '14px Arial';
			ctx.fillText('fingerprint', 2, 2);
			return canvas.toDataURL();
		})()
	};
})()
`
}
