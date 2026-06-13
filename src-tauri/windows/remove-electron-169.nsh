!include LogicLib.nsh

!macro BACKUP_EASYGITHUB_APPDATA
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "if (Test-Path -LiteralPath ''$APPDATA\EasyGithub'') { Remove-Item -LiteralPath ''$TEMP\EasyGithubLegacyBackup'' -Recurse -Force -ErrorAction SilentlyContinue; Copy-Item -LiteralPath ''$APPDATA\EasyGithub'' -Destination ''$TEMP\EasyGithubLegacyBackup'' -Recurse -Force }"'
!macroend

!macro RESTORE_EASYGITHUB_APPDATA
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "if (Test-Path -LiteralPath ''$TEMP\EasyGithubLegacyBackup'') { New-Item -ItemType Directory -Force -Path ''$APPDATA'' | Out-Null; Copy-Item -LiteralPath ''$TEMP\EasyGithubLegacyBackup'' -Destination ''$APPDATA\EasyGithub'' -Recurse -Force; Remove-Item -LiteralPath ''$TEMP\EasyGithubLegacyBackup'' -Recurse -Force -ErrorAction SilentlyContinue }"'
!macroend

!macro TRY_REMOVE_EASYGITHUB_ELECTRON_169 ROOT KEY
  ReadRegStr $0 ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${KEY}" "DisplayVersion"
  ${If} $0 == "1.6.9"
    ReadRegStr $1 ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${KEY}" "QuietUninstallString"
    ${If} $1 == ""
      ReadRegStr $1 ${ROOT} "Software\Microsoft\Windows\CurrentVersion\Uninstall\${KEY}" "UninstallString"
      ${If} $1 != ""
        StrCpy $1 "$1 /S"
      ${EndIf}
    ${EndIf}

    ${If} $1 != ""
      !insertmacro BACKUP_EASYGITHUB_APPDATA
      DetailPrint "Removing legacy EasyGithub Electron 1.6.9 installation..."
      ExecWait '$1' $2
      DetailPrint "Legacy EasyGithub Electron uninstall exit code: $2"
      !insertmacro RESTORE_EASYGITHUB_APPDATA
    ${EndIf}
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREINSTALL
  Push $0
  Push $1
  Push $2

  !insertmacro TRY_REMOVE_EASYGITHUB_ELECTRON_169 HKCU "98c14be6-868f-5c72-8a28-2acf45ebd88e"
  !insertmacro TRY_REMOVE_EASYGITHUB_ELECTRON_169 HKLM "98c14be6-868f-5c72-8a28-2acf45ebd88e"
  !insertmacro TRY_REMOVE_EASYGITHUB_ELECTRON_169 HKCU "com.easygithub.app"
  !insertmacro TRY_REMOVE_EASYGITHUB_ELECTRON_169 HKLM "com.easygithub.app"
  !insertmacro TRY_REMOVE_EASYGITHUB_ELECTRON_169 HKCU "EasyGithub"
  !insertmacro TRY_REMOVE_EASYGITHUB_ELECTRON_169 HKLM "EasyGithub"

  Pop $2
  Pop $1
  Pop $0
!macroend
