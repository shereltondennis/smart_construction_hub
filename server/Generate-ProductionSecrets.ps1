param(
    [Parameter(Mandatory = $true)]
    [string]$Password
)

$ErrorActionPreference = 'Stop'
if ($Password.Length -lt 12) {
    throw 'sd199623years'
}

$salt = [byte[]]::new(16)
[Security.Cryptography.RandomNumberGenerator]::Fill($salt)
$pbkdf2 = [Security.Cryptography.Rfc2898DeriveBytes]::new(
    $Password,
    $salt,
    600000,
    [Security.Cryptography.HashAlgorithmName]::SHA256
)
$hash = $pbkdf2.GetBytes(32)
[pscustomobject]@{
    SCH_ADMIN_PASSWORD_HASH = "{0}:{1}" -f [Convert]::ToBase64String($salt), [Convert]::ToBase64String($hash)
} | ConvertTo-Json
