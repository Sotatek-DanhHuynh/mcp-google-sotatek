# ============================================================
#  MCP Google Sotatek — Setup Script
#  Cach 1: Right-click -> "Run with PowerShell" (thu muc local)
#  Cach 2: irm https://raw.githubusercontent.com/Sotatek-DanhHuynh/mcp-google-sotatek/master/setup.ps1 | iex
#  Yeu cau: Node.js >= 18, Claude Desktop hoac Claude Code CLI
# ============================================================

$ErrorActionPreference = "Stop"
$REPO_RAW = "https://raw.githubusercontent.com/Sotatek-DanhHuynh/mcp-google-sotatek/master"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   MCP Google Sotatek Setup" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Kiem tra Node.js
try {
    $nodeVersion = node --version
    Write-Host "[OK] Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js is not installed. Download at: https://nodejs.org" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# 2. Xac dinh thu muc cai dat
$localPath = $MyInvocation.MyCommand.Path
$isRemote = [string]::IsNullOrEmpty($localPath)

if ($isRemote) {
    $SERVER_DIR = "$env:APPDATA\mcp-google-sotatek"
    Write-Host "[...] Installing to: $SERVER_DIR" -ForegroundColor Yellow

    if (-not (Test-Path $SERVER_DIR)) {
        New-Item -ItemType Directory -Path $SERVER_DIR -Force | Out-Null
    }

    Write-Host "[...] Downloading files..." -ForegroundColor Yellow
    Invoke-WebRequest "$REPO_RAW/index.js"     -OutFile "$SERVER_DIR\index.js"
    Invoke-WebRequest "$REPO_RAW/package.json" -OutFile "$SERVER_DIR\package.json"
    Write-Host "[OK] Files downloaded" -ForegroundColor Green
} else {
    $SERVER_DIR = Split-Path -Parent $localPath
    Write-Host "[OK] Using local directory: $SERVER_DIR" -ForegroundColor Green
}

# 3. Cai dependencies
Write-Host ""
Write-Host "[...] Installing dependencies..." -ForegroundColor Yellow
Push-Location $SERVER_DIR
npm.cmd install --silent
Pop-Location
Write-Host "[OK] Dependencies installed" -ForegroundColor Green

# 4. Tao file credentials rong san, yeu cau user paste JSON vao
$credDir = "$env:LOCALAPPDATA\mcp-google-sotatek"
$credPath = "$credDir\credentials.json"

if (-not (Test-Path $credDir)) {
    New-Item -ItemType Directory -Path $credDir -Force | Out-Null
}
if (-not (Test-Path $credPath)) {
    [System.IO.File]::WriteAllText($credPath, '{}', (New-Object System.Text.UTF8Encoding $false))
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Yellow
Write-Host "   CAN PASTE SERVICE ACCOUNT KEY" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Lien he admin de lay noi dung file JSON key cua service account" -ForegroundColor White
Write-Host "   (mcp-google-bot@bctk-sotatek.iam.gserviceaccount.com)" -ForegroundColor Gray
Write-Host "2. File rong da duoc tao tai:" -ForegroundColor White
Write-Host "   $credPath" -ForegroundColor Cyan
Write-Host "3. Notepad se tu mo file nay -> paste toan bo noi dung JSON vao -> Save (Ctrl+S) -> dong Notepad" -ForegroundColor White
Write-Host ""
Read-Host "Nhan Enter de mo Notepad"
Start-Process notepad.exe $credPath -Wait

# 5. Validate JSON da paste
try {
    $credJson = Get-Content $credPath -Raw | ConvertFrom-Json
    if (-not $credJson.client_email -or -not $credJson.private_key) {
        throw "Thieu field client_email hoac private_key"
    }
    Write-Host "[OK] Credentials hop le (account: $($credJson.client_email))" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] File JSON khong hop le hoac chua duoc paste dung noi dung." -ForegroundColor Red
    Write-Host "        Vui long chay lai script va paste lai vao: $credPath" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

$serverIndex = "$SERVER_DIR\index.js"
$credPathEscaped = $credPath -replace '\\', '\\'

# 6. Cap nhat Claude Desktop config
$serverIndexJson = $serverIndex -replace '\\', '\\'
$mcpBlock = "  ""mcpServers"": {`n    ""google"": {`n      ""command"": ""node"",`n      ""args"": [""$serverIndexJson""],`n      ""env"": {`n        ""GOOGLE_CREDENTIALS_PATH"": ""$credPathEscaped""`n      }`n    }`n  }"

$possiblePaths = @(
    (Get-ChildItem "$env:LOCALAPPDATA\Packages" -Filter "Claude_*" -ErrorAction SilentlyContinue |
        Select-Object -First 1 |
        ForEach-Object { "$($_.FullName)\LocalCache\Roaming\Claude\claude_desktop_config.json" }),
    "$env:APPDATA\Claude\claude_desktop_config.json"
)

$configPath = $null
foreach ($p in $possiblePaths) {
    if ($p -and (Test-Path $p)) { $configPath = $p; break }
}

if (-not $configPath) {
    $configPath = "$env:APPDATA\Claude\claude_desktop_config.json"
    $configDir = Split-Path $configPath
    if (-not (Test-Path $configDir)) { New-Item -ItemType Directory -Path $configDir -Force | Out-Null }
    $noBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText($configPath, '{}', $noBom)
}

$raw = Get-Content $configPath -Raw -Encoding UTF8
if ($raw -match '"mcpServers"') {
    $raw = $raw -replace '"mcpServers"\s*:\s*\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}', $mcpBlock.TrimStart()
} else {
    $body = $raw.Trim()
    if ($body -eq '{}' -or $body -eq '{') {
        $raw = "{`n$mcpBlock`n}"
    } else {
        $raw = $body.TrimEnd('}').TrimEnd() + ",`n$mcpBlock`n}"
    }
}
$noBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($configPath, $raw, $noBom)
Write-Host "[OK] Claude Desktop config updated" -ForegroundColor Green

# 7. Dang ky voi Claude Code CLI
try {
    $claudeCmd = Get-Command claude -ErrorAction Stop
    claude mcp add -s user google node $serverIndex -e "GOOGLE_CREDENTIALS_PATH=$credPath" 2>&1 | Out-Null
    Write-Host "[OK] Claude Code CLI config updated" -ForegroundColor Green
} catch {
    Write-Host "[SKIP] Claude Code CLI not found, skipping" -ForegroundColor DarkGray
}

# 8. Cai SKILL daily-report-sync vao project hien tai (neu dang dung trong project)
Write-Host ""
Write-Host "[...] Checking for project skill installation..." -ForegroundColor Yellow

$cwd = (Get-Location).Path
$isProject = (Test-Path "$cwd\.git") -or (Test-Path "$cwd\package.json")

if ($isProject) {
    $skillDir = "$cwd\.claude\skills\daily-report-sync"
    $skillFile = "$skillDir\SKILL.md"

    if (-not (Test-Path "$cwd\.claude")) {
        New-Item -ItemType Directory -Path "$cwd\.claude" -Force | Out-Null
        Write-Host "[OK] Created .claude/" -ForegroundColor Green
    }
    if (-not (Test-Path $skillDir)) {
        New-Item -ItemType Directory -Path $skillDir -Force | Out-Null
    }

    Invoke-WebRequest "$REPO_RAW/skills/daily-report-sync/SKILL.md" -OutFile $skillFile
    Write-Host "[OK] Skill installed: .claude/skills/daily-report-sync/SKILL.md" -ForegroundColor Green
} else {
    Write-Host "[SKIP] Not in a project directory (no .git or package.json found)." -ForegroundColor DarkGray
    Write-Host "       To install the skill later: cd <your-project> then re-run this script." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "   Setup complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "-> Restart Claude Desktop to apply changes." -ForegroundColor White
Write-Host ""
Write-Host "   github.com/Sotatek-DanhHuynh" -ForegroundColor DarkGray
Write-Host ""
Read-Host "Press Enter to close"
