param(
    [string]$DocumentPath = 'paper/zh-CN/按步执行与信息共享_中文最新稿.docx',
    [string]$OutputDirectory = 'data/layout-audit/current'
)
$ErrorActionPreference = 'Stop'
$paperPath = (Resolve-Path -LiteralPath $DocumentPath).Path
$auditPath = [IO.Path]::GetFullPath($OutputDirectory)
[IO.Directory]::CreateDirectory($auditPath) | Out-Null
$pdfPath = Join-Path $auditPath 'paper.pdf'
$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Open($paperPath, $false, $true)
    $document.Repaginate()
    $document.ExportAsFixedFormat($pdfPath, 17)
    # Word's COM statistics may stay stale even after export. Count PDF pages.
    $pdfInfo = & pdfinfo $pdfPath
    if ($LASTEXITCODE -ne 0) { throw 'pdfinfo failed; cannot verify exported page count' }
    $pageLine = $pdfInfo | Where-Object { $_ -match '^Pages:\s+(\d+)' }
    if ($pageLine -notmatch '^Pages:\s+(\d+)') { throw 'PDF page count not found' }
    $pages = [int]$Matches[1]
    @{renderer='Microsoft Word'; pages=$pages; source=$paperPath; pdf=$pdfPath} |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $auditPath 'render.json') -Encoding utf8
    Write-Output "Word export: $pages pages"
}
finally {
    if ($null -ne $document) { $document.Close(0); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($document) }
    if ($null -ne $word) { $word.Quit(); [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word) }
}
