# Student Portal - scanner helper
# Lets the portal's "Scan" buttons use a scanner connected to this Windows PC (via WIA).
# Start it with Start-Scanner.bat and keep the window open while you work. Close the window to stop it.
param([int]$Port = 5055)

$JPEG = '{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}'   # WIA JPEG format id
$WIA_CANCELLED = -2145320860                       # 0x80210064: user pressed Cancel

function Send-Response($stream, [int]$code, [string]$status, [string]$contentType, [byte[]]$body) {
  if ($null -eq $body) { $body = [byte[]]@() }
  $headers = "HTTP/1.1 $code $status`r`n" +
    "Content-Type: $contentType`r`n" +
    "Content-Length: $($body.Length)`r`n" +
    "Access-Control-Allow-Origin: *`r`n" +
    "Access-Control-Allow-Methods: GET, OPTIONS`r`n" +
    "Access-Control-Allow-Headers: *`r`n" +
    "Access-Control-Allow-Private-Network: true`r`n" +
    "Cache-Control: no-store`r`n" +
    "Connection: close`r`n`r`n"
  $hb = [System.Text.Encoding]::ASCII.GetBytes($headers)
  $stream.Write($hb, 0, $hb.Length)
  if ($body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}

function Send-Json($stream, [int]$code, $obj) {
  $json = $obj | ConvertTo-Json -Compress
  $status = 'OK'
  if ($code -ne 200) { $status = 'Error' }
  Send-Response $stream $code $status 'application/json; charset=utf-8' ([System.Text.Encoding]::UTF8.GetBytes($json))
}

function Get-Scanners {
  $names = @()
  try {
    $dm = New-Object -ComObject WIA.DeviceManager
    foreach ($info in $dm.DeviceInfos) {
      if ($info.Type -eq 1) { $names += [string]$info.Properties.Item('Name').Value }
    }
  } catch { }
  return ,$names
}

function Invoke-Scan {
  $dialog = New-Object -ComObject WIA.CommonDialog
  # Opens the Windows scan window: pick the scanner, preview, choose colour/quality, then Scan.
  $img = $dialog.ShowAcquireImage(1, 1, 0, $JPEG, $false, $true, $false)
  if ($null -eq $img) { return $null }
  if ($img.FormatID -ne $JPEG) {
    $ip = New-Object -ComObject WIA.ImageProcess
    $ip.Filters.Add($ip.FilterInfos.Item('Convert').FilterID)
    $ip.Filters.Item(1).Properties.Item('FormatID').Value = $JPEG
    $ip.Filters.Item(1).Properties.Item('Quality').Value = 85
    $img = $ip.Apply($img)
  }
  return [byte[]]$img.FileData.BinaryData
}

try {
  $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
  $listener.Start()
} catch {
  Write-Host "Could not start on port $Port. Is the scanner helper already running in another window?" -ForegroundColor Red
  return
}

$found = Get-Scanners
Write-Host ""
Write-Host "  Student Portal scanner helper is running (http://127.0.0.1:$Port)" -ForegroundColor Green
if ($found.Count -gt 0) { Write-Host "  Scanner(s) found: $($found -join ', ')" }
else { Write-Host "  No scanner found yet. Connect and switch on the scanner; it will be picked up when you press Scan." -ForegroundColor Yellow }
Write-Host "  Keep this window open while using the portal. Close it to stop."
Write-Host ""

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
    $requestLine = $reader.ReadLine()
    while ($true) { $line = $reader.ReadLine(); if ($null -eq $line -or $line -eq '') { break } }
    if (-not $requestLine) { continue }
    $parts = $requestLine.Split(' ')
    $method = $parts[0]
    $path = $parts[1].Split('?')[0]

    if ($method -eq 'OPTIONS') {
      Send-Response $stream 204 'No Content' 'text/plain' ([byte[]]@())
    }
    elseif ($path -eq '/status') {
      Send-Json $stream 200 @{ ok = $true; scanners = (Get-Scanners) }
    }
    elseif ($path -eq '/scan') {
      Write-Host "$(Get-Date -Format 'HH:mm:ss')  Scan requested - the Windows scan window is opening (it may appear behind the browser)."
      try {
        $bytes = Invoke-Scan
        if ($null -eq $bytes) {
          Send-Json $stream 409 @{ ok = $false; error = 'cancelled' }
        } else {
          Send-Response $stream 200 'OK' 'image/jpeg' $bytes
          Write-Host "$(Get-Date -Format 'HH:mm:ss')  Scan sent to the portal ($([math]::Round($bytes.Length / 1KB)) KB)."
        }
      } catch {
        if ($_.Exception.HResult -eq $WIA_CANCELLED) {
          Send-Json $stream 409 @{ ok = $false; error = 'cancelled' }
          Write-Host "$(Get-Date -Format 'HH:mm:ss')  Scan cancelled."
        } else {
          Send-Json $stream 500 @{ ok = $false; error = $_.Exception.Message }
          Write-Host "$(Get-Date -Format 'HH:mm:ss')  Scan failed: $($_.Exception.Message)" -ForegroundColor Red
        }
      }
    }
    else {
      Send-Json $stream 404 @{ ok = $false; error = 'not found' }
    }
  } catch {
    Write-Host "Request error: $($_.Exception.Message)" -ForegroundColor Red
  } finally {
    $client.Close()
  }
}
