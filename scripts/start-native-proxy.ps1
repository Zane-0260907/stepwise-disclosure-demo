param()
$ErrorActionPreference = 'Stop'
$repositoryDirectory = Split-Path -Parent $PSScriptRoot
$previousDeepSeekKey = $env:DEEPSEEK_API_KEY
try {
    if ([string]::IsNullOrWhiteSpace($previousDeepSeekKey)) {
        $enteredSecret = Read-Host 'DeepSeek API key (input is hidden; not saved to disk)' -AsSecureString
        $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($enteredSecret)
        try { $env:DEEPSEEK_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer) }
    }
    Push-Location -LiteralPath $repositoryDirectory
    try { & node (Join-Path $PSScriptRoot 'start-native-proxy.mjs') }
    finally { Pop-Location }
}
finally {
    if ($null -eq $previousDeepSeekKey) { Remove-Item Env:DEEPSEEK_API_KEY -ErrorAction SilentlyContinue }
    else { $env:DEEPSEEK_API_KEY = $previousDeepSeekKey }
    if ($null -ne $enteredSecret) { $enteredSecret.Dispose() }
}
