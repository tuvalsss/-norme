# PowerShell script להפעלת מערכת AI Agent
$host.UI.RawUI.WindowTitle = "AI-SYSTEM LAUNCHER (PowerShell)"

function Show-ColoredMessage {
    param (
        [string]$Message,
        [string]$ForegroundColor = "White"
    )
    
    Write-Host $Message -ForegroundColor $ForegroundColor
}

# כותרת
Show-ColoredMessage "==================================" "Cyan"
Show-ColoredMessage "  STARTING ENORME AI AGENT SYSTEM" "Cyan"
Show-ColoredMessage "==================================" "Cyan"
Write-Host ""

# נתיבים
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$agentSystemPath = Join-Path $scriptPath "ai-agent-system"
$dashboardPath = Join-Path $scriptPath "ai-dashboard-fixed"

# הפעלת שרת הסוכנים
Show-ColoredMessage "הפעלת שרת הסוכנים..." "Yellow"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$agentSystemPath'; node server.js" -WindowStyle Normal

# המתנה קצרה
Start-Sleep -Seconds 2

# הפעלת שרת הדאשבורד
Show-ColoredMessage "הפעלת שרת הדאשבורד..." "Yellow"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$dashboardPath'; node server.js" -WindowStyle Normal

# המתנה קצרה
Start-Sleep -Seconds 3

# פתיחת הדפדפן
Show-ColoredMessage "פתיחת ממשק המשתמש בדפדפן..." "Green"
Start-Process "http://localhost:3001"

# סיכום
Write-Host ""
Show-ColoredMessage "המערכת הופעלה בהצלחה!" "Green"
Show-ColoredMessage "שרת הסוכנים פועל בפורט 3000" "White"
Show-ColoredMessage "ממשק הניהול פועל בפורט 3001" "White"
Write-Host ""
Show-ColoredMessage "לסגירת המערכת, סגור את חלונות PowerShell או הרץ את הסקריפט stop_system.ps1" "Gray" 