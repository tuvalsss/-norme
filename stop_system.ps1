# PowerShell script לעצירת מערכת AI Agent
$host.UI.RawUI.WindowTitle = "AI-SYSTEM STOPPER (PowerShell)"

function Show-ColoredMessage {
    param (
        [string]$Message,
        [string]$ForegroundColor = "White"
    )
    
    Write-Host $Message -ForegroundColor $ForegroundColor
}

# כותרת
Show-ColoredMessage "==================================" "Red"
Show-ColoredMessage "  STOPPING ENORME AI AGENT SYSTEM" "Red" 
Show-ColoredMessage "==================================" "Red"
Write-Host ""

# עצירת תהליכי node.js
Show-ColoredMessage "עוצר את כל תהליכי Node.js..." "Yellow"
try {
    Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
    Show-ColoredMessage "תהליכי Node.js נעצרו בהצלחה." "Green"
} catch {
    Show-ColoredMessage "לא נמצאו תהליכי Node.js פעילים או שאירעה שגיאה בעצירתם." "Red"
}

Write-Host ""
Show-ColoredMessage "המערכת נעצרה בהצלחה!" "Green"
Write-Host ""

# המתנה להקשת מקש כלשהו
Show-ColoredMessage "לחץ על מקש כלשהו לסגירת החלון..." "Gray"
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 