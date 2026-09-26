param([switch]$UseDeepSeek)
$ErrorActionPreference = 'Stop'
$project = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$listener = Get-NetTCPConnection -LocalPort 4793 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listener) {
  $existing = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
  if ($existing.Name -ne 'node.exe' -or $existing.CommandLine -notmatch 'src[/\\]app-server\.mjs') {
    throw 'Port 4793 is in use by another application.'
  }
  Stop-Process -Id $listener.OwningProcess
}
$keyWasEntered = $false
if ($UseDeepSeek -and -not $env:DEEPSEEK_API_KEY) {
  $secret = Read-Host 'DeepSeek API Key（只在本机终端输入，不会保存到项目）' -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  try { $env:DEEPSEEK_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
  $keyWasEntered = $true
}
$previous = (Get-Location).Path
try {
  Set-Location -LiteralPath $project
  Write-Output '打开 http://127.0.0.1:4793/；关闭此终端将停止演示服务。'
  & node src/app-server.mjs
} finally {
  Set-Location -LiteralPath $previous
  if ($keyWasEntered) { Remove-Item Env:DEEPSEEK_API_KEY -ErrorAction SilentlyContinue }
}
