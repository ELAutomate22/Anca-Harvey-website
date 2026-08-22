$ErrorActionPreference = 'Stop'

function Read-RequiredValue {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Prompt,
    [int] $MaximumLength = 254
  )

  while ($true) {
    $value = (Read-Host $Prompt).Trim()
    if ($value.Length -ge 1 -and $value.Length -le $MaximumLength) {
      return $value
    }
    Write-Host "Enter between 1 and $MaximumLength characters." -ForegroundColor Yellow
  }
}

function Read-EmailAddress {
  param([Parameter(Mandatory = $true)][string] $Prompt)

  while ($true) {
    $value = (Read-Host $Prompt).Trim().ToLowerInvariant()
    if ($value -match '^[^\s@]+@[^\s@]+\.[^\s@]+$' -and $value.Length -le 254) {
      return $value
    }
    Write-Host 'Enter a valid email address.' -ForegroundColor Yellow
  }
}

function ConvertFrom-SecureValue {
  param([Parameter(Mandatory = $true)][Security.SecureString] $Value)

  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
  }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
  }
}

function Read-ConfirmedPassword {
  param([Parameter(Mandatory = $true)][string] $AccountLabel)

  while ($true) {
    $firstSecure = Read-Host "$AccountLabel password (14+ characters)" -AsSecureString
    $secondSecure = Read-Host "Confirm $AccountLabel password" -AsSecureString
    $first = ConvertFrom-SecureValue $firstSecure
    $second = ConvertFrom-SecureValue $secondSecure

    if ($first.Length -lt 14) {
      Write-Host 'The password must contain at least 14 characters.' -ForegroundColor Yellow
    }
    elseif ($first -cne $second) {
      Write-Host 'The passwords did not match. Try again.' -ForegroundColor Yellow
    }
    else {
      $second = $null
      return $first
    }

    $first = $null
    $second = $null
  }
}

function Read-WithDefault {
  param(
    [Parameter(Mandatory = $true)][string] $Prompt,
    [Parameter(Mandatory = $true)][string] $Default
  )

  $value = (Read-Host "$Prompt [$Default]").Trim()
  if ($value) { return $value }
  return $Default
}

$partner1Password = $null
$partner2Password = $null

try {
  Write-Host ''
  Write-Host 'Provision exactly two production accounts' -ForegroundColor Cyan
  Write-Host 'Passwords are masked and are never written to the repository.'
  Write-Host ''

  if (-not $env:PARTNER_1_NAME) {
    $env:PARTNER_1_NAME = Read-RequiredValue 'First partner name' 80
  }
  if (-not $env:PARTNER_1_EMAIL) {
    $env:PARTNER_1_EMAIL = Read-EmailAddress 'First partner email'
  }
  $partner1Password = Read-ConfirmedPassword 'First partner'
  $env:PARTNER_1_PASSWORD = $partner1Password

  Write-Host ''
  if (-not $env:PARTNER_2_NAME) {
    $env:PARTNER_2_NAME = Read-RequiredValue 'Second partner name' 80
  }
  if (-not $env:PARTNER_2_EMAIL) {
    $env:PARTNER_2_EMAIL = Read-EmailAddress 'Second partner email'
  }
  if ($env:PARTNER_2_EMAIL -eq $env:PARTNER_1_EMAIL) {
    throw 'The two account emails must be different.'
  }
  $partner2Password = Read-ConfirmedPassword 'Second partner'
  $env:PARTNER_2_PASSWORD = $partner2Password

  Write-Host ''
  $env:RELATIONSHIP_TITLE = Read-WithDefault 'Relationship title' 'Our Corner'
  $env:RELATIONSHIP_START_DATE = Read-WithDefault 'Relationship start date (YYYY-MM-DD)' '2025-08-20'
  $env:RELATIONSHIP_TIMEZONE = Read-WithDefault 'IANA timezone' 'Europe/London'

  & pnpm db:provision:remote
  if ($LASTEXITCODE -ne 0) {
    throw "Provisioning failed with exit code $LASTEXITCODE."
  }
}
finally {
  $partner1Password = $null
  $partner2Password = $null
  Remove-Item Env:PARTNER_1_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:PARTNER_1_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:PARTNER_1_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:PARTNER_2_EMAIL -ErrorAction SilentlyContinue
  Remove-Item Env:PARTNER_2_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:PARTNER_2_NAME -ErrorAction SilentlyContinue
  Remove-Item Env:RELATIONSHIP_TITLE -ErrorAction SilentlyContinue
  Remove-Item Env:RELATIONSHIP_START_DATE -ErrorAction SilentlyContinue
  Remove-Item Env:RELATIONSHIP_TIMEZONE -ErrorAction SilentlyContinue
}
