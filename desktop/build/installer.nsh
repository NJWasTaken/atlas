!macro customUnInstall
  ; Electron's main process owns the local API and Next.js sidecars.
  ; Stop the full process tree before NSIS removes installed files.
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /T /IM Atlas.exe'
  nsExec::ExecToLog '"$SYSDIR\taskkill.exe" /F /T /IM atlas-api.exe'
!macroend
