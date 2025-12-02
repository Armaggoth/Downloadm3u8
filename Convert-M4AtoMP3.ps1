
# Convert-M4AtoMP3.ps1
# Usage: .\Convert-M4AtoMP3.ps1 <input.m4a> [output.mp3]


param(
    [Parameter(Position=0, Mandatory=$false)]
    [string]$InputFile,
    [Parameter(Position=1, Mandatory=$false)]
    [string]$OutputFile
)

# Show usage if no parameters are provided
if (-not $InputFile) {
    Write-Host "Usage: .\\Convert-M4AtoMP3.ps1 <input.m4a> [output.mp3]"
    Write-Host "Example: .\\Convert-M4AtoMP3.ps1 song.m4a"
    Write-Host "         .\\Convert-M4AtoMP3.ps1 song.m4a song.mp3"
    exit 1
}

if (!(Test-Path $InputFile)) {
    Write-Host "Input file '$InputFile' not found."
    exit 1
}

if (-not $OutputFile) {
    $OutputFile = [System.IO.Path]::ChangeExtension($InputFile, ".mp3")
}

# Check if ffmpeg is available
$ffmpegExists = Get-Command ffmpeg -ErrorAction SilentlyContinue
if (-not $ffmpegExists) {
    Write-Host "ffmpeg is not installed or not in PATH."
    exit 1
}

Write-Host "Converting '$InputFile' to '$OutputFile'..."
ffmpeg -y -i $InputFile -c:a libmp3lame -b:a 192k $OutputFile
if ($LASTEXITCODE -eq 0) {
    Write-Host "Conversion successful: $OutputFile"
} else {
    Write-Host "Conversion failed."
    exit 1
}
