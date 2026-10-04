$ErrorActionPreference = 'Stop'
Write-Host 'Updating the gameplay experiment and planner editor...'
& ssh -o BatchMode=yes -o ConnectTimeout=10 root@123.57.154.12 'bash /opt/deep-surge-lab/repo/scripts/update-server.sh'
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host 'Game: https://taskstream.xyz/deep-surge-lab/'
Write-Host 'Planner: https://taskstream.xyz/deep-surge-editor/'

