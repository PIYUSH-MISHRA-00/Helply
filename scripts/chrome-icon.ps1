# Builds build/chrome-icon.png from the locally installed Chrome logo.
# The logo is Google's, so it is generated per machine and never committed.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$roots = @(
  "$env:ProgramFiles\Google\Chrome\Application",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application",
  "$env:LOCALAPPDATA\Google\Chrome\Application"
)
$logo = $roots |
  Where-Object { $_ -and (Test-Path $_) } |
  ForEach-Object { Get-ChildItem $_ -Recurse -Filter Logo.png -ErrorAction SilentlyContinue } |
  Where-Object { $_.DirectoryName -like '*VisualElements' } |
  Select-Object -First 1

$out = Join-Path $PSScriptRoot '..\build\chrome-icon.png'
if (-not $logo) {
  Write-Warning 'Google Chrome is not installed. Using the Helply icon.'
  Copy-Item (Join-Path $PSScriptRoot '..\assets\icons\icon.png') $out -Force
  exit 0
}

$src = New-Object System.Drawing.Bitmap $logo.FullName
# The tile logo is padded; crop to the visible pixels so it fills the taskbar slot.
$minX = $src.Width; $minY = $src.Height; $maxX = -1; $maxY = -1
for ($y = 0; $y -lt $src.Height; $y++) {
  for ($x = 0; $x -lt $src.Width; $x++) {
    $p = $src.GetPixel($x, $y)
    if ($p.A -gt 16 -and -not ($p.R -gt 245 -and $p.G -gt 245 -and $p.B -gt 245)) {
      if ($x -lt $minX) { $minX = $x }; if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }; if ($y -gt $maxY) { $maxY = $y }
    }
  }
}
$side = [Math]::Max($maxX - $minX, $maxY - $minY) + 1
$crop = New-Object System.Drawing.Rectangle $minX, $minY, $side, $side

$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::Transparent)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, 256, 256), $crop, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$src.Dispose()
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "Chrome icon written to $out"
