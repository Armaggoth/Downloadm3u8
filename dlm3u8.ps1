<#
.SYNOPSIS
  PowerShell m3u8 downloader and merger (single URL mode).
.DESCRIPTION
  Downloads m3u8 playlist and segments, processes with Node.js scripts, merges with ffmpeg.
  Uses PowerShell for downloads, calls Node.js and ffmpeg as in the original batch file.
#>

param (
    [Parameter(Mandatory=$true)]
    [string]$Url,
    [string]$Output
)

function Show-Usage {
    Write-Host "Usage:"
    Write-Host "  .\dlm3u8.ps1 -Url <m3u8-url> [-Output <output.mp4>]"
    Write-Host ""
    Write-Host "dlm3u8 relies on Node.js and FFmpeg. These tools must be installed and available in the PATH."
    exit 1
}

function Get-Basename {
    param([string]$Name)
    while ($Name.EndsWith('.')) { $Name = $Name.Substring(0, $Name.Length - 1) }
    if ($Name.ToLower().EndsWith('.mp4')) { $Name = $Name.Substring(0, $Name.Length - 4) }
    return $Name
}


if (-not $Url) { Show-Usage; return }

# Set up file names
$basename = if ($Output) { Get-Basename $Output } else { 'output' }
$inputFile = "$basename.m3u8"
$outputFile = "$basename.mp4"
$aria2cInput = "$basename.aria2c.txt"
$scanLog = "$basename.ffmpeg.scan.log"
$mergeLog = "$basename.ffmpeg.merge.log"

# Validate output file name
try {
    New-Item -Path $outputFile -ItemType File -Force | Remove-Item -Force
} catch {
    Write-Error "Error: Invalid output file name or path in '$outputFile'"
    return
}

# Download m3u8 playlist
Write-Host "Downloading m3u8 playlist..."
Invoke-WebRequest -Uri $Url -OutFile $inputFile
if (-not (Test-Path $inputFile)) {
    Write-Error "Failed to download m3u8 playlist."
    return
}
Write-Host "Downloaded '$Url' as '$inputFile' OK."

# Run Node.js script to process m3u8 and generate aria2c download list
Write-Host "Processing m3u8 with Node.js (ppm3u8.js)..."
& node "$PSScriptRoot\js\ppm3u8.js" "$inputFile" "$Url"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Node.js ppm3u8.js failed."
    return
}

# Download files from aria2c input file
Write-Host "Starting to download files from '$aria2cInput'..."
if (-not (Test-Path $aria2cInput)) {
    Write-Error "Segment list '$aria2cInput' not found."
    return
}
$segmentUrls = Get-Content $aria2cInput | Where-Object { $_ }
foreach ($segUrl in $segmentUrls) {
    $segName = Split-Path $segUrl -Leaf
    try {
        Invoke-WebRequest -Uri $segUrl -OutFile $segName
    } catch {
        Write-Warning "Failed to download segment: $segUrl"
    }
}
Remove-Item $aria2cInput -Force

# Generate ffmpeg scan log
Write-Host "Generating '$scanLog' for advertisement removal..."
& ffmpeg -allowed_extensions ALL -protocol_whitelist file,crypto,data -i "$inputFile" -c copy -f null NUL 2> "$scanLog"
if ($LASTEXITCODE -ne 0) {
    Write-Error "There are errors in the generated '$scanLog'."
    return
}

# Rebuild m3u8 to remove ads
Write-Host "Processing ad removal with Node.js (fixm3u8.js)..."
& node "$PSScriptRoot\js\fixm3u8.js" "$inputFile" "$scanLog"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Node.js fixm3u8.js failed."
    return
}

# Merge all ts files to mp4 file
Write-Host "Merging '$outputFile' based on '$inputFile'..."
& ffmpeg -y -allowed_extensions ALL -protocol_whitelist file,crypto,data -i "$inputFile" -c copy "$outputFile" 2> "$mergeLog"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to merge '$outputFile'."
    return
}

# Check the 'discontinuity' keyword in ffmpeg merge log
$mergeLogContent = Get-Content $mergeLog -Raw
if ($mergeLogContent -match 'discontinuity') {
    Write-Host "'$outputFile' was merged successfully, but ad removal failed. Please check the log files for details."
    return
}

# Cleanup
Remove-Item $inputFile, $scanLog, $mergeLog -Force
Write-Host "Successfully merged '$outputFile'."
