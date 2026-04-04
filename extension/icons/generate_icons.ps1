Add-Type -AssemblyName System.Drawing

function Create-Icon($size, $filename) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    # Blue background circle
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 29, 78, 216))
    $g.FillEllipse($brush, 0, 0, $size, $size)

    # White "E" letter
    $font = New-Object System.Drawing.Font("Arial", ($size * 0.5), [System.Drawing.FontStyle]::Bold)
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
    $g.DrawString("E", $font, $whiteBrush, $rect, $sf)

    $bmp.Save($filename, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Created: $filename"
}

$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
Create-Icon 16  "$dir\icon16.png"
Create-Icon 48  "$dir\icon48.png"
Create-Icon 128 "$dir\icon128.png"
Write-Host "Icons generated successfully!"
