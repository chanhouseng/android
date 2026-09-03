$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$commentsPath = Join-Path $projectRoot 'storage\comments.json'
$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ('ws-mad-http-' + [guid]::NewGuid().ToString('N'))
$backupPath = Join-Path $temporaryRoot 'comments.json'
$stdoutPath = Join-Path $temporaryRoot 'server.out.log'
$stderrPath = Join-Path $temporaryRoot 'server.err.log'
$serverProcess = $null
$passed = 0
$invokeWebRequestCommand = Get-Command Invoke-WebRequest
$supportsSkipHttpErrorCheck = $invokeWebRequestCommand.Parameters.ContainsKey('SkipHttpErrorCheck')
$supportsUseBasicParsing = $invokeWebRequestCommand.Parameters.ContainsKey('UseBasicParsing')

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) {
        throw "Assertion failed: $Message"
    }
    $script:passed++
}

function Assert-Equal {
    param($Expected, $Actual, [string]$Message)
    if ($Expected -ne $Actual) {
        throw "Assertion failed: $Message. Expected '$Expected', got '$Actual'."
    }
    $script:passed++
}

function Start-TestServer {
    $phpPath = (Get-Command php).Source
    $process = Start-Process `
        -FilePath $phpPath `
        -ArgumentList @('-S', '0.0.0.0:3000', 'server.php') `
        -WorkingDirectory $projectRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath `
        -PassThru
    $script:serverProcess = $process

    $deadline = (Get-Date).AddSeconds(10)
    $lastProbeError = ''
    while ((Get-Date) -lt $deadline) {
        if ($process.HasExited) {
            throw "Server exited before becoming ready."
        }
        try {
            $probeParameters = @{
                Uri = 'http://127.0.0.1:3000/api/video'
                TimeoutSec = 1
            }
            if ($script:supportsUseBasicParsing) {
                $probeParameters.UseBasicParsing = $true
            }
            $probe = Invoke-WebRequest @probeParameters
            if ($probe.StatusCode -eq 200) {
                return $process
            }
        } catch {
            $lastProbeError = $_.Exception.Message
        }
        Start-Sleep -Milliseconds 100
    }

    $serverError = if (Test-Path -LiteralPath $stderrPath) {
        (Get-Content -Raw -LiteralPath $stderrPath).Trim()
    } else {
        'No server error log was created.'
    }
    throw "Server did not become ready within 10 seconds. Last probe: $lastProbeError Server log: $serverError"
}

function Stop-TestServer {
    param($Process)
    if ($null -ne $Process -and -not $Process.HasExited) {
        Stop-Process -Id $Process.Id -Force
        Wait-Process -Id $Process.Id -ErrorAction SilentlyContinue
    }
    if ($null -ne $Process) {
        $Process.Dispose()
    }
}

function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        $Body = $null,
        [string]$ContentType = ''
    )

    $parameters = @{
        Uri = 'http://127.0.0.1:3000' + $Path
        Method = $Method
        TimeoutSec = 5
    }
    if ($script:supportsSkipHttpErrorCheck) {
        $parameters.SkipHttpErrorCheck = $true
    }
    if ($script:supportsUseBasicParsing) {
        $parameters.UseBasicParsing = $true
    }
    if ($null -ne $Body) {
        $parameters.Body = $Body
    }
    if ($ContentType -ne '') {
        $parameters.ContentType = $ContentType
    }

    try {
        return Invoke-WebRequest @parameters
    } catch {
        $webResponse = $_.Exception.Response
        if ($script:supportsSkipHttpErrorCheck -or $null -eq $webResponse) {
            throw
        }

        $stream = $webResponse.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        try {
            $content = $reader.ReadToEnd()
        } finally {
            $reader.Dispose()
            $stream.Dispose()
        }

        return [pscustomobject]@{
            StatusCode = [int]$webResponse.StatusCode
            Headers = $webResponse.Headers
            Content = $content
            RawContentLength = $webResponse.ContentLength
        }
    }
}

New-Item -ItemType Directory -Path $temporaryRoot | Out-Null
Copy-Item -LiteralPath $commentsPath -Destination $backupPath

try {
    $serverProcess = Start-TestServer

    $metadata = Invoke-Api -Method Post -Path '/api/image/photos'
    $metadataJson = $metadata.Content | ConvertFrom-Json
    Assert-Equal 200 $metadata.StatusCode 'photo metadata status'
    Assert-Equal 18 $metadataJson.data.totalPhotos 'photo total'
    Assert-Equal 2 $metadataJson.data.totalPage 'photo pages'
    Assert-True ($metadata.Headers.'Content-Type' -like 'application/json*') 'photo metadata content type'

    $page = Invoke-Api -Method Post -Path '/api/image/photos' -Body @{ pageNumber = '0' }
    $pageJson = $page.Content | ConvertFrom-Json
    Assert-Equal 200 $page.StatusCode 'photo page status'
    Assert-Equal 9 $pageJson.data.Count 'photo page size'
    Assert-True ($pageJson.data[0].url -like 'http://127.0.0.1:3000/api/image/photos/*') 'dynamic photo URL'

    $badPage = Invoke-Api -Method Post -Path '/api/image/photos' -Body @{ pageNumber = '100' }
    Assert-Equal 400 $badPage.StatusCode 'invalid photo page status'
    Assert-Equal 'PageNumber out of limit.' (($badPage.Content | ConvertFrom-Json).msg) 'invalid photo page message'

    $photo = Invoke-Api -Method Get -Path '/api/image/photos/No_00009.jpg'
    Assert-Equal 200 $photo.StatusCode 'photo resource status'
    Assert-True ($photo.Headers.'Content-Type' -like 'image/jpeg*') 'photo resource MIME'
    Assert-True ($photo.RawContentLength -gt 0) 'photo resource bytes'

    $skillTypes = Invoke-Api -Method Get -Path '/api/skills-types'
    Assert-Equal 200 $skillTypes.StatusCode 'skill types status'
    Assert-Equal 2 (($skillTypes.Content | ConvertFrom-Json).data.Count) 'skill type count'

    $skill = Invoke-Api -Method Get -Path '/api/skills/1000'
    $skillJson = $skill.Content | ConvertFrom-Json
    Assert-Equal 200 $skill.StatusCode 'skill detail status'
    Assert-Equal 'Information Network Cabling' $skillJson.data.name 'skill detail name'
    Assert-Equal 'http://127.0.0.1:3000/api/image/skills_images/1000.jpg' $skillJson.data.img 'dynamic skill image URL'

    $skillImage = Invoke-Api -Method Get -Path '/api/image/skills_images/1000.jpg'
    Assert-Equal 200 $skillImage.StatusCode 'skill image status'
    Assert-True ($skillImage.Headers.'Content-Type' -like 'image/jpeg*') 'skill image MIME'

    $unknownSkill = Invoke-Api -Method Get -Path '/api/skills/9999'
    Assert-Equal 404 $unknownSkill.StatusCode 'unknown skill status'

    $videos = Invoke-Api -Method Get -Path '/api/video'
    $videosJson = $videos.Content | ConvertFrom-Json
    Assert-Equal 200 $videos.StatusCode 'video status'
    Assert-Equal 20 $videosJson.data.Count 'video count'
    Assert-Equal '2D6A33E7-AE3C-FCFA-5AF1-249C71C1AC57' $videosJson.data[0].uuid 'first video UUID'

    $comments = Invoke-Api -Method Get -Path '/api/video/comment'
    Assert-Equal 200 $comments.StatusCode 'comment list status'
    Assert-Equal 20 (($comments.Content | ConvertFrom-Json).data.Count) 'initial comment count'

    $uniqueText = 'integration-' + [guid]::NewGuid().ToString('N')
    $commentBody = @{
        commentText = $uniqueText
        videoUUID = '2D6A33E7-AE3C-FCFA-5AF1-249C71C1AC57'
    } | ConvertTo-Json -Compress
    $created = Invoke-Api -Method Post -Path '/api/video/comment' -Body $commentBody -ContentType 'application/json'
    $createdJson = $created.Content | ConvertFrom-Json
    Assert-Equal 200 $created.StatusCode 'create comment status'
    Assert-Equal $uniqueText $createdJson.data.commentText 'created comment text'
    Assert-Equal '127.0.0.1' $createdJson.data.ipAddress 'created comment IP'

    $unknownVideoBody = @{
        commentText = 'unknown video'
        videoUUID = 'C80137E8-4FAE-980C-A222-BB5F1A71CE2B'
    } | ConvertTo-Json -Compress
    $unknownVideo = Invoke-Api -Method Post -Path '/api/video/comment' -Body $unknownVideoBody -ContentType 'application/json'
    Assert-Equal 400 $unknownVideo.StatusCode 'unknown video status'
    Assert-Equal 'No video of this UUID can be found.' (($unknownVideo.Content | ConvertFrom-Json).msg) 'unknown video message'

    $malformed = Invoke-Api -Method Post -Path '/api/video/comment' -Body '{broken' -ContentType 'application/json'
    Assert-Equal 400 $malformed.StatusCode 'malformed JSON status'

    foreach ($path in @(
        '/api/image/photos/%2e%2e%2fskills.json',
        '/api/image/photos/C:%5cWindows%5cwin.ini',
        '/api/image/photos/No_99999.jpg'
    )) {
        Assert-Equal 404 (Invoke-Api -Method Get -Path $path).StatusCode ('unsafe media status for ' + $path)
    }

    Assert-Equal 404 (Invoke-Api -Method Get -Path '/api/not-found').StatusCode 'unknown route status'
    $wrongMethod = Invoke-Api -Method Delete -Path '/api/video'
    Assert-Equal 405 $wrongMethod.StatusCode 'wrong method status'
    $allowHeader = [string] $wrongMethod.Headers['Allow']
    Assert-True (($allowHeader -split ',\s*') -contains 'GET') 'Allow header'

    Stop-TestServer -Process $serverProcess
    $serverProcess = $null
    $serverProcess = Start-TestServer

    $afterRestart = Invoke-Api -Method Get -Path '/api/video/comment'
    $matching = @((($afterRestart.Content | ConvertFrom-Json).data) | Where-Object { $_.commentText -eq $uniqueText })
    Assert-Equal 1 $matching.Count 'comment survives server restart'

    Write-Output "$passed HTTP assertions passed"
} finally {
    Stop-TestServer -Process $serverProcess
    Copy-Item -LiteralPath $backupPath -Destination $commentsPath -Force
    for ($attempt = 0; $attempt -lt 10; $attempt++) {
        try {
            Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
            break
        } catch {
            if ($attempt -eq 9) {
                throw
            }
            Start-Sleep -Milliseconds 100
        }
    }
}
