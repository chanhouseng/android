$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$project = Split-Path $PSScriptRoot -Parent
$workspace = Split-Path $project -Parent
$publicResources = Join-Path $project 'data/resources'
New-Item -ItemType Directory -Force -Path (Join-Path $publicResources 'maps'), (Join-Path $publicResources 'stops') | Out-Null
$copies = @{
    'resources/maps/Mumbai Map.png' = 'maps/mumbai_base.png'
    'icons/launcher/art_icon_citymove.png' = 'art_icon_citymove.png'
    'icons/map_pins/pin_bus@2x.png' = 'pin_bus.png'
    'icons/map_pins/pin_metro@2x.png' = 'pin_metro.png'
    'icons/map_pins/pin_rapid@2x.png' = 'pin_rapid.png'
}
foreach ($source in $copies.Keys) {
    $target = Join-Path $publicResources $copies[$source]
    if (!(Test-Path -LiteralPath $target)) { Copy-Item -LiteralPath (Join-Path $workspace $source) -Destination $target }
}
$manifest = Get-Content -Raw -LiteralPath (Join-Path $project 'data/resources.json') | ConvertFrom-Json
$routes = Get-Content -Raw -LiteralPath (Join-Path $project 'data/routes.json') | ConvertFrom-Json
$overlayPath = Join-Path $publicResources 'maps/mumbai_transit_overlay.png'
if (!(Test-Path -LiteralPath $overlayPath)) {
    $metadata = $manifest.maps | Where-Object { $_.resource_id -eq 'MAP-MUM-002' }
    $bitmap = [System.Drawing.Bitmap]::new([int]$metadata.width_px, [int]$metadata.height_px)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $font = [System.Drawing.Font]::new('Arial', 18)
    try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        foreach ($route in $routes) {
            $color = [System.Drawing.ColorTranslator]::FromHtml($route.color)
            $pen = [System.Drawing.Pen]::new($color, 7)
            $brush = [System.Drawing.SolidBrush]::new($color)
            try {
                $points = [System.Drawing.PointF[]]@($route.stops | Sort-Object sequence | ForEach-Object {
                    [System.Drawing.PointF]::new([single]($_.map_x_percent * $bitmap.Width / 100), [single]($_.map_y_percent * $bitmap.Height / 100))
                })
                if ($points.Count -gt 1) { $graphics.DrawLines($pen, $points) }
                foreach ($point in $points) { $graphics.FillEllipse($brush, $point.X - 6, $point.Y - 6, 12, 12) }
                if ($points.Count) { $graphics.DrawString($route.route_number, $font, $brush, $points[0].X + 10, $points[0].Y) }
            } finally { $pen.Dispose(); $brush.Dispose() }
        }
        $bitmap.Save($overlayPath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $font.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
}
foreach ($entry in $manifest.stop_images) {
    $target = Join-Path (Join-Path $project 'data') $entry.file
    if (Test-Path -LiteralPath $target) { continue }
    $bitmap = [System.Drawing.Bitmap]::new(800, 450)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $font = [System.Drawing.Font]::new('Arial', 24)
    $small = [System.Drawing.Font]::new('Arial', 16)
    try {
        $graphics.Clear([System.Drawing.Color]::WhiteSmoke)
        $graphics.DrawString($entry.caption, $font, [System.Drawing.Brushes]::DarkSlateBlue, 30, 80)
        $graphics.DrawString($entry.stop_id, $small, [System.Drawing.Brushes]::Black, 30, 145)
        $graphics.DrawString('Practice placeholder - original photo not supplied', $small, [System.Drawing.Brushes]::DimGray, 30, 280)
        $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    } finally { $font.Dispose(); $small.Dispose(); $graphics.Dispose(); $bitmap.Dispose() }
}
Write-Output 'Public resources prepared; existing files and JSON were preserved.'
