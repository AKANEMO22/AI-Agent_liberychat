# ==============================================================================
# Modern Windows Explorer Folder and File Picker Helper for Local Qwen
# Uses IFileDialog COM Common Item Dialog for true modern Windows 10/11 Explorer UI
# ==============================================================================

param(
  [Parameter(Mandatory=$true)]
  [ValidateSet('folder', 'file')]
  [string]$Mode,
  [string]$InitialDir = ""
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$resultOutput = @{
  status = "cancelled"
}

try {
  $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
  $csPath = Join-Path $scriptDir "ModernPicker.cs"
  if (-not ([System.Management.Automation.PSTypeName]'LocalQwenNative.NativeDialogHelper').Type) {
    Add-Type -Path $csPath
  }

  $startDir = $InitialDir
  if (-not $startDir -or -not (Test-Path -LiteralPath $startDir)) {
    $startDir = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::UserProfile)
  }

  if ($Mode -eq 'folder') {
    $selected = [LocalQwenNative.NativeDialogHelper]::ShowModernFolderPicker("Open Folder", $startDir)
    if ($selected -and -not $selected.StartsWith("ERROR:") -and (Test-Path -LiteralPath $selected)) {
      $resultOutput = @{
        status = "selected"
        type = "folder"
        path = $selected
      }
    } elseif ($selected -and $selected.StartsWith("ERROR:")) {
      $resultOutput = @{
        status = "error"
        error = $selected
      }
    }
  } elseif ($Mode -eq 'file') {
    $selected = [LocalQwenNative.NativeDialogHelper]::ShowModernFilePicker("Open File", $startDir)
    if ($selected -and -not $selected.StartsWith("ERROR:") -and (Test-Path -LiteralPath $selected)) {
      $resultOutput = @{
        status = "selected"
        type = "file"
        path = $selected
      }
    } elseif ($selected -and $selected.StartsWith("ERROR:")) {
      $resultOutput = @{
        status = "error"
        error = $selected
      }
    }
  }
} catch {
  $resultOutput = @{
    status = "error"
    error = $_.Exception.Message
  }
}

# Output clean single-line JSON
$json = $resultOutput | ConvertTo-Json -Compress
[Console]::WriteLine($json)
exit 0
