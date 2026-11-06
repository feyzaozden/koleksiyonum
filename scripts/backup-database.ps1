$ErrorActionPreference = 'Stop'
$backupRoot = Join-Path $env:USERPROFILE 'Koleksiyonum-Yedekler'
$backupDirectory = Join-Path $backupRoot (Join-Path (Get-Date -Format 'yyyy-MM-dd_HHmmss') 'veritabani')
$secret = Read-Host 'Supabase veritabani sifreni gir (ekranda gorunmez)' -AsSecureString
$pointer = [IntPtr]::Zero
$connection = $null
try {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    $encoded = [Uri]::EscapeDataString([Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer))
    $connection = 'postgresql://postgres.xgcgzjrhztmaduuqrvzy:' + $encoded + '@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require'
    $encoded = $null
    New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null
    'INCOMPLETE - Do not use as a verified restore backup.' | Set-Content -LiteralPath (Join-Path $backupDirectory 'STATUS.txt')
    $jobs = @(
        @{ Name = 'roles.sql'; Flags = @('--role-only') },
        @{ Name = 'schema.sql'; Flags = @() },
        @{ Name = 'data.sql'; Flags = @('--data-only', '--use-copy', '-x', 'storage.buckets_vectors', '-x', 'storage.vector_indexes') },
        @{ Name = 'managed-schema-reference.sql'; Flags = @('--schema', 'auth,storage') }
    )
    foreach ($job in $jobs) {
        Write-Host ('Yedek aliniyor: ' + $job.Name)
        $outputFile = Join-Path $backupDirectory $job.Name
        $arguments = @('--yes', 'supabase@3.0.0', 'db', 'dump', ('--remote=' + $connection), '--file', $outputFile) + $job.Flags
        # Capture CLI output: failures can contain connection credentials. Never print it.
        $previousPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $diagnostics = & npx.cmd @arguments 2>&1
        $exitStatus = $LASTEXITCODE
        $ErrorActionPreference = $previousPreference
        $arguments = $null
        if ($exitStatus -ne 0) {
            $message = ($diagnostics | Out-String)
            $plainSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
            if ($plainSecret) {
                $message = $message.Replace($connection, '[BAGLANTI GIZLENDI]').Replace([Uri]::EscapeDataString($plainSecret), '[SIFRE GIZLENDI]').Replace($plainSecret, '[SIFRE GIZLENDI]')
            }
            $plainSecret = $null
            $message = $message -replace '(?i)postgres(?:ql)?://\S+', '[BAGLANTI GIZLENDI]'
            $message = $message -replace '(?im)^.*(?:PGPASSWORD|SUPABASE_DB_PASSWORD|Authorization|access_token|secret_key).*$','[GIZLI ALAN KALDIRILDI]'
            $diagnostics = $null
            Write-Host '--- Sifresi maskelenmis hata ayrintisi ---'
            ($message -split "`r?`n" | Select-Object -Last 18) | ForEach-Object { Write-Host $_ }
            $message = $null
            throw ('Yedek alinamadi: ' + $job.Name + '. Yukaridaki hata ayrintisini kontrol et.')
        }
        $diagnostics = $null
        if (!(Test-Path -LiteralPath $outputFile) -or (Get-Item -LiteralPath $outputFile).Length -eq 0) { throw ('Yedek dosyasi bos veya eksik: ' + $job.Name) }
    }
    Get-ChildItem -LiteralPath $backupDirectory -Filter '*.sql' | Get-FileHash -Algorithm SHA256 |
        Select-Object Hash, @{Name='File';Expression={Split-Path -Leaf $_.Path}} |
        Export-Csv -LiteralPath (Join-Path $backupDirectory 'checksums.csv') -NoTypeInformation
    @'
DATABASE EXPORT FINISHED - RESTORE NOT TESTED.
Storage image files and dashboard settings are NOT included.
managed-schema-reference.sql is reference only: do NOT blindly restore over Supabase managed schemas.
Keep this folder private; data.sql contains personal data and authentication records.
'@ | Set-Content -LiteralPath (Join-Path $backupDirectory 'STATUS.txt')
    Write-Host 'Veritabani disa aktarimi tamamlandi. Geri yukleme testi ve Storage yedegi henuz yapilmadi.'
    Write-Host $backupDirectory
} catch {
    Write-Host ('ISLEM TAMAMLANMADI: ' + $_.Exception.Message)
    Write-Host 'Olusan klasoru tamamlanmis yedek olarak kullanma.'
    exit 1
} finally {
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    $connection = $null
    $encoded = $null
    $arguments = $null
    $diagnostics = $null
    $secret.Dispose()
}
