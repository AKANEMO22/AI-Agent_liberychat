$parts = Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'qwen2.5-coder-7b-instruct.gguf.part*' | Sort-Object Name
$output = Join-Path $PSScriptRoot 'qwen2.5-coder-7b-instruct.gguf'

if ($parts.Count -eq 0) {
    throw 'No model parts found.'
}

$destination = [System.IO.File]::Open($output, [System.IO.FileMode]::Create)
try {
    foreach ($part in $parts) {
        $source = [System.IO.File]::OpenRead($part.FullName)
        try {
            $source.CopyTo($destination)
        }
        finally {
            $source.Dispose()
        }
    }
}
finally {
    $destination.Dispose()
}

Write-Host "Assembled $output from $($parts.Count) parts."