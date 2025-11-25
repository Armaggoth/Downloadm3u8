param(
    [Parameter(Mandatory=$true)]
    [string]$Folder
)

if (!(Test-Path $Folder)) {
    Write-Host "Folder '$Folder' not found."
    exit 1
}

# Get all mp4 files matching pattern and not containing 'merged'
$files = Get-ChildItem -Path $Folder -File -Filter "*.mp4" | Where-Object {
    $_.Name -match "-page-(\d{2})\.mp4$" -and $_.Name -notmatch "merged"
}

# Extract page numbers as strings and sort
$sorted = $files | ForEach-Object {
    if ($_.Name -match "-page-(\d{2})\.mp4$") {
        [PSCustomObject]@{
            File = $_.Name
            PageStr = $matches[1]
            PageInt = [int]$matches[1]
        }
    }
} | Sort-Object PageInt

# Group consecutive files
$groups = @()
$group = @()
$startStr = $null
$endStr = $null
$prevInt = $null
foreach ($item in $sorted) {
    if ($null -eq $startStr) {
        $startStr = $item.PageStr
        $endStr = $item.PageStr
        $prevInt = $item.PageInt
        $group = @($item.File)
    } elseif ($item.PageInt -eq $prevInt + 1) {
        $endStr = $item.PageStr
        $prevInt = $item.PageInt
        $group += $item.File
    } else {
        $groups += ,@($startStr, $endStr, $group)
        $startStr = $item.PageStr
        $endStr = $item.PageStr
        $prevInt = $item.PageInt
        $group = @($item.File)
    }
}
if ($group.Count -gt 0) {
    $groups += ,@($startStr, $endStr, $group)
}

# Merge each group and extract audio
foreach ($g in $groups) {
    $gstart = $g[0]
    $gend = $g[1]
    $gfiles = $g[2]
    if ($gfiles.Count -gt 1) {
        $base = $gfiles[0] -replace "-page-\d{2}\.mp4$", ""
        $outname = "$base-page-merged-$gstart-$gend.mp4"
        $audioout = "$base-page-merged-$gstart-$gend.mp3"
        $listfile = Join-Path $Folder "files.txt"
        Remove-Item $listfile -ErrorAction SilentlyContinue
        foreach ($f in $gfiles) {
            Add-Content $listfile "file '$f'"
        }
        Write-Host "Merging $($gfiles.Count) files into $outname..."
        ffmpeg -f concat -safe 0 -i $listfile -c copy (Join-Path $Folder $outname)
        Remove-Item $listfile -ErrorAction SilentlyContinue
        Write-Host "Extracting audio to $audioout at 128 kbps..."
        ffmpeg -i (Join-Path $Folder $outname) -c:a libmp3lame -b:a 128k -map a (Join-Path $Folder $audioout)
        $mp3Path = Join-Path $Folder $audioout
        $maxSizeBytes = 99.9 * 1024 * 1024
        $mp3File = Get-Item $mp3Path
        if ($mp3File.Length -gt $maxSizeBytes) {
            Write-Host "MP3 file exceeds 99.9 MB, splitting..."
            # Estimate duration per part
            $duration = ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$mp3Path"
            $durationSec = [math]::Floor([double]$duration)
            $bitrate = 128 * 1000
            $partDuration = [math]::Floor($maxSizeBytes * 8 / $bitrate)
            $partNum = 1
            $startSec = 0
            while ($startSec -lt $durationSec) {
                $partSuffix = "-Part-" + "{0:D2}" -f $partNum
                $partName = $audioout -replace "\.mp3$", "$partSuffix.mp3"
                ffmpeg -y -i $mp3Path -ss $startSec -t $partDuration -c copy (Join-Path $Folder $partName)
                $startSec += $partDuration
                $partNum++
            }
            Remove-Item $mp3Path -ErrorAction SilentlyContinue
        }
    } else {
        Write-Host "Skipping group with only one file: $($gfiles[0])"
    }
}
