# Compatibility shim: local development now uses Windows Authentication.
# The API no longer needs a SQL login password.
& (Join-Path $PSScriptRoot 'start-local-api.ps1')
