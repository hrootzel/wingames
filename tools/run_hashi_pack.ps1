# Hashi pack runner (PowerShell)
# Usage: .\run_hashi_pack.ps1 [easy|medium|hard|all] -Count 50 -Threads 4 -Tries 1400 -Start 0 -Out .\hashi_pack_output.js
# Options:
#   Difficulty (positional): easy|medium|hard|all
#   -Count   : target puzzle count per difficulty
#   -Threads : worker thread count (default 4)
#   -Tries   : max tries per puzzle (0 uses preset default)
#   -Start   : starting index for seed generation (default 0)
#   -Out     : output file (defaults to project hashi_pack_output.js if omitted)
param(
  [Parameter(Position = 0)]
  [ValidateSet('easy','medium','hard','all')]
  [string]$Difficulty = 'all',
  [int]$Count = 50,
  [int]$Threads = 4,
  [int]$Tries = 0,
  [int]$Start = 0,
  [string]$Out = ''
)

$ScriptPath = Join-Path $PSScriptRoot 'make_hashi_pack.cjs'
$Args = @($ScriptPath, $Difficulty, "--count=$Count", "--threads=$Threads", "--start=$Start")
if ($Tries -gt 0) {
  $Args += "--tries=$Tries"
}
if ($Out -ne '') {
  $Args += "--out=$Out"
}

node @Args
