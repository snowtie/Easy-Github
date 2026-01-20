@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM Release helper for Windows.
REM - Updates package.json version to the provided version.
REM - (Optional) Commits the version bump.
REM - Creates an annotated tag (vX.Y.Z) and pushes it to origin to trigger GitHub Actions.
REM
REM Usage:
REM   release-build.bat 1.2.3
REM   release-build.bat 1.2.3 --commit
REM   release-build.bat 1.2.3 --commit --no-pause
REM   release-build.bat 1.2.3 --commit --keep-utf8
REM   release-build.bat 1.2.3 --commit --use-existing-tag
REM   release-build.bat 1.2.3 --commit --prompt

set "DEFAULT_TAG_PREFIX=v"
set "PAUSE_ON_EXIT=1"
set "DO_COMMIT=0"
set "PROMPT_ON_TAG_EXISTS=0"
set "KEEP_UTF8=0"
set "SKIP_TAG_CREATE=0"
set "SKIP_TAG_PUSH=0"
set "ORIGINAL_CODEPAGE="
set "OEM_CODEPAGE="
set "CODEPAGE_CHANGED=0"

REM Log file (useful when launched without console)
set "TS="
for /f "usebackq delims=" %%T in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Date -Format yyyyMMdd-HHmmss"`) do set "TS=%%T"
if "%TS%"=="" set "TS=unknown-time"
set "LOG_DIR=%~dp0release"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>nul
set "LOGFILE=%LOG_DIR%\release-build-%TS%.log"
if not exist "%LOG_DIR%" (
  set "LOG_DIR=%TEMP%"
  set "LOGFILE=%LOG_DIR%\release-build-%TS%.log"
)
> "%LOGFILE%" echo [INFO] release-build started at %DATE% %TIME%
>> "%LOGFILE%" echo [INFO] cwd: %CD%
set "STEP=init"
>> "%LOGFILE%" echo [STEP] %STEP%

REM Parse args: first arg is version, remaining are flags
set "VERSION=%~1"
set "REMAINING_ARGS="
set "RAW_ARGS=%*"
set "SANITIZED_ARGS=%RAW_ARGS%"

REM 런처가 공백 없이 전달하는 경우(예: release-build.bat1.2.0--commit)를 복구한다.
set "SANITIZED_ARGS=%SANITIZED_ARGS:release-build.bat=%"
set "SANITIZED_ARGS=%SANITIZED_ARGS:release-build.BAT=%"
set "SANITIZED_ARGS=%SANITIZED_ARGS:--= --%"

if "%VERSION%"=="" (
  for /f "tokens=1,* delims= " %%A in ("%SANITIZED_ARGS%") do (
    set "VERSION=%%A"
    set "REMAINING_ARGS=%%B"
  )
)

REM 잘못 전달된 값(예: '='만 들어오는 경우)은 제거한다.
if "%VERSION%"=="=" set "VERSION="
if "%VERSION:~0,1%"=="=" set "VERSION=%VERSION:~1%"

REM 플래그는 문자열 포함 여부로도 처리해 공백 누락 케이스를 막는다.
echo %SANITIZED_ARGS% | findstr /I /C:"--no-pause" >nul && set "PAUSE_ON_EXIT=0"
echo %SANITIZED_ARGS% | findstr /I /C:"--commit" >nul && set "DO_COMMIT=1"
echo %SANITIZED_ARGS% | findstr /I /C:"--prompt" >nul && set "PROMPT_ON_TAG_EXISTS=1"
echo %SANITIZED_ARGS% | findstr /I /C:"--keep-utf8" >nul && set "KEEP_UTF8=1"
echo %SANITIZED_ARGS% | findstr /I /C:"--use-existing-tag" >nul && set "SKIP_TAG_CREATE=1"

if not "%REMAINING_ARGS%"=="" (
  for %%F in (!REMAINING_ARGS!) do (
    if /I "%%F"=="--no-pause" set "PAUSE_ON_EXIT=0"
    if /I "%%F"=="--commit" set "DO_COMMIT=1"
    if /I "%%F"=="--prompt" set "PROMPT_ON_TAG_EXISTS=1"
    if /I "%%F"=="--keep-utf8" set "KEEP_UTF8=1"
    if /I "%%F"=="--use-existing-tag" set "SKIP_TAG_CREATE=1"
  )
)

>> "%LOGFILE%" echo [DEBUG] raw_args=%RAW_ARGS%
>> "%LOGFILE%" echo [DEBUG] sanitized_args=%SANITIZED_ARGS%
>> "%LOGFILE%" echo [DEBUG] version=%VERSION% do_commit=%DO_COMMIT% prompt=%PROMPT_ON_TAG_EXISTS%

REM Ensure git exists
where git >> "%LOGFILE%" 2>&1
>> "%LOGFILE%" echo [DEBUG] errorlevel_after_where_git=!ERRORLEVEL!
if errorlevel 1 (
  echo [ERROR] git not found. Install Git and try again.
  >> "%LOGFILE%" echo [ERROR] git not found - where_git_failed
  goto :fail
)

>> "%LOGFILE%" echo [STEP] after_where_git

REM Switch to repo root (folder of this .bat)
set "STEP=pushd_repo_root"
>> "%LOGFILE%" echo [STEP] %STEP% repo_root=%~dp0
pushd "%~dp0" >nul
if errorlevel 1 (
  echo [ERROR] Failed to switch to repo root: %~dp0
  >> "%LOGFILE%" echo [ERROR] pushd failed
  goto :fail
)

REM Ensure this is a git repository
set "STEP=check_git_repo"
>> "%LOGFILE%" echo [STEP] %STEP%
git rev-parse --is-inside-work-tree >> "%LOGFILE%" 2>&1
if errorlevel 1 (
  echo [ERROR] Not a git repository: %CD%
  >> "%LOGFILE%" echo [ERROR] Not a git repository
  goto :fail
)

REM Ensure origin remote exists
set "STEP=check_origin"
>> "%LOGFILE%" echo [STEP] %STEP%
git remote get-url origin >> "%LOGFILE%" 2>&1
if errorlevel 1 (
  echo [ERROR] Remote "origin" not found. Check: git remote -v
  >> "%LOGFILE%" echo [ERROR] origin remote not found
  goto :fail
)

REM Read version (interactive if missing)
if "%VERSION%"=="" (
  set /p "VERSION=Enter release version (e.g. 1.2.3 or v1.2.3): "
)

set "VERSION=%VERSION: =%"
if "%VERSION%"=="" (
  echo [ERROR] Version is empty.
  >> "%LOGFILE%" echo [ERROR] Version is empty
  goto :fail
)

set "STEP=parse_version"
>> "%LOGFILE%" echo [STEP] %STEP% VERSION=%VERSION%

REM Normalize version for package.json: strip leading 'v'
set "PKG_VERSION=%VERSION%"
if /I "%PKG_VERSION:~0,1%"=="v" set "PKG_VERSION=%PKG_VERSION:~1%"

REM Normalize tag name: add "v" prefix if missing
set "TAG=%VERSION%"
if /I not "%TAG:~0,1%"=="v" (
  set "TAG=%DEFAULT_TAG_PREFIX%%TAG%"
)

REM Ensure tag does not already exist (local or remote)
set "STEP=check_tag_exists"
>> "%LOGFILE%" echo [STEP] %STEP% TAG=%TAG%
call :tag_exists "%TAG%"
if "%TAG_EXISTS%"=="1" (
  echo [WARN] Tag already exists: %TAG%
  >> "%LOGFILE%" echo [WARN] Tag already exists: %TAG%

  if "%SKIP_TAG_CREATE%"=="1" (
    REM 기존 태그를 그대로 사용한다.
    set "SKIP_TAG_PUSH=1"
    >> "%LOGFILE%" echo [INFO] Using existing tag without re-creating it: %TAG%
  ) else (
    REM 기본 동작: 기존 태그를 그대로 사용한다.
    if not "%PROMPT_ON_TAG_EXISTS%"=="1" (
      set "SKIP_TAG_CREATE=1"
      set "SKIP_TAG_PUSH=1"
      >> "%LOGFILE%" echo [INFO] Using existing tag by default: %TAG%
    ) else (
      echo        Choose: [U]se existing tag, [A]uto bump patch, [I]nput another version, [C]ancel
      set /p "CHOICE=Select (U/A/I/C) [U]: "
      if "%CHOICE%"=="" set "CHOICE=U"

      if /I "%CHOICE%"=="U" (
        set "SKIP_TAG_CREATE=1"
        set "SKIP_TAG_PUSH=1"
        >> "%LOGFILE%" echo [INFO] Using existing tag from prompt: %TAG%
      ) else if /I "%CHOICE%"=="A" (
        call :auto_bump_patch "%PKG_VERSION%"
        if errorlevel 1 goto :fail
        echo [INFO] Using next available version: !PKG_VERSION!  tag=!TAG!
        >> "%LOGFILE%" echo [INFO] Using next available version: !PKG_VERSION!  tag=!TAG!
      ) else if /I "%CHOICE%"=="I" (
        set /p "VERSION=Enter release version (e.g. 1.2.3 or v1.2.3): "
        set "VERSION=%VERSION: =%"
        if "%VERSION%"=="" (
          echo [ERROR] Version is empty.
          goto :fail
        )

        set "PKG_VERSION=%VERSION%"
        if /I "%PKG_VERSION:~0,1%"=="v" set "PKG_VERSION=%PKG_VERSION:~1%"

        set "TAG=%VERSION%"
        if /I not "%TAG:~0,1%"=="v" set "TAG=%DEFAULT_TAG_PREFIX%%TAG%"

        call :tag_exists "%TAG%"
        if "%TAG_EXISTS%"=="1" (
          echo [ERROR] Tag already exists: %TAG%
          goto :fail
        )
      ) else (
        echo [INFO] Cancelled.
        goto :fail
      )
    )
  )
)

REM Ensure npm exists (used to update package.json/package-lock.json safely)
where npm >> "%LOGFILE%" 2>&1
if errorlevel 1 (
  echo [ERROR] npm not found. Install Node.js that includes npm and try again.
  >> "%LOGFILE%" echo [ERROR] npm not found - where_npm_failed
  goto :fail
)

REM Ensure working tree is clean before version bump
set "STEP=check_clean_worktree"
>> "%LOGFILE%" echo [STEP] %STEP%
REM git stdout 파싱 대신 exit code로 판단해 인코딩/경고 영향을 제거한다.
set "HAS_CHANGES=0"
git diff --quiet
if errorlevel 1 set "HAS_CHANGES=1"
git diff --cached --quiet
if errorlevel 1 set "HAS_CHANGES=1"
for /f "usebackq delims=" %%S in (`git ls-files --others --exclude-standard`) do (
  set "HAS_CHANGES=1"
)
if "%HAS_CHANGES%"=="1" (
  echo [ERROR] Working tree is not clean. Commit/stash changes first.
  >> "%LOGFILE%" echo [ERROR] Working tree is not clean:
  >> "%LOGFILE%" echo [DEBUG] unstaged:
  git diff --name-only >> "%LOGFILE%" 2>&1
  >> "%LOGFILE%" echo [DEBUG] staged:
  git diff --cached --name-only >> "%LOGFILE%" 2>&1
  >> "%LOGFILE%" echo [DEBUG] untracked:
  git ls-files --others --exclude-standard >> "%LOGFILE%" 2>&1
  git diff --name-only
  git diff --cached --name-only
  git ls-files --others --exclude-standard
  goto :fail
)

REM 안정적인 콘솔 렌더링을 위해 UTF-8을 기본으로 쓰지 않는다.
REM PowerShell 실행 등 일부 환경에서는 65001이 깨지는 문제가 있어 OEM 코드페이지로 복구한다.
set "STEP=set_codepage"
>> "%LOGFILE%" echo [STEP] %STEP%
if "%KEEP_UTF8%"=="1" (
  >> "%LOGFILE%" echo [INFO] keep_utf8_enabled
) else (
  set "ORIGINAL_CODEPAGE="
  for /f "tokens=2 delims=:" %%C in ('chcp') do set "ORIGINAL_CODEPAGE=%%C"
  set "ORIGINAL_CODEPAGE=%ORIGINAL_CODEPAGE: =%"
  for /f "tokens=2 delims=:" %%C in ('reg query "HKCU\Console" /v CodePage ^| find "REG_DWORD"') do set "OEM_CODEPAGE=%%C"
  set "OEM_CODEPAGE=%OEM_CODEPAGE: =%"

  if "%OEM_CODEPAGE%"=="" (
    set "OEM_CODEPAGE=437"
  ) else (
    set /a OEM_CODEPAGE=0x%OEM_CODEPAGE%
  )

  if not "%OEM_CODEPAGE%"=="" (
    chcp %OEM_CODEPAGE% >nul
    if errorlevel 1 (
      >> "%LOGFILE%" echo [WARN] chcp_failed codepage=%OEM_CODEPAGE%
    ) else (
      set "CODEPAGE_CHANGED=1"
      >> "%LOGFILE%" echo [INFO] chcp %OEM_CODEPAGE% (from %ORIGINAL_CODEPAGE%)
    )
  )
)

REM Ensure package.json exists
if not exist "package.json" (
  echo [ERROR] package.json not found in: %CD%
  goto :fail
)

REM Release flow requires committing the version bump (remote builds need it)
if not "%DO_COMMIT%"=="1" (
  echo [ERROR] This script requires --commit to proceed.
  echo         Example: release-build.bat %PKG_VERSION% --commit
  goto :fail
)

REM Update version using npm (updates package.json and package-lock.json)
echo [INFO] Updating version via npm: %PKG_VERSION%
>> "%LOGFILE%" echo [CMD] npm version %PKG_VERSION% --no-git-tag-version
npm version %PKG_VERSION% --no-git-tag-version >> "%LOGFILE%" 2>&1
if errorlevel 1 (
  echo [ERROR] Failed to update version via npm.
  >> "%LOGFILE%" echo [ERROR] npm version failed
  goto :fail
)

REM Optionally commit the version bump
if "%DO_COMMIT%"=="1" (
  if exist "package-lock.json" (
    >> "%LOGFILE%" echo [CMD] git add package.json package-lock.json
    git add package.json package-lock.json >> "%LOGFILE%" 2>&1
  ) else (
    >> "%LOGFILE%" echo [CMD] git add package.json
    git add package.json >> "%LOGFILE%" 2>&1
  )
  if errorlevel 1 (
    echo [ERROR] Failed to stage version files
    >> "%LOGFILE%" echo [ERROR] git add failed
    goto :fail
  )

  >> "%LOGFILE%" echo [CMD] git commit -m "chore(release): %TAG%"
  git commit -m "chore(release): %TAG%" >> "%LOGFILE%" 2>&1
  if errorlevel 1 (
    echo [ERROR] Failed to commit version bump.
    >> "%LOGFILE%" echo [ERROR] git commit failed
    goto :fail
  )

  >> "%LOGFILE%" echo [CMD] git push origin HEAD
  git push origin HEAD >> "%LOGFILE%" 2>&1
  if errorlevel 1 (
    echo [ERROR] Failed to push commit to origin.
    >> "%LOGFILE%" echo [ERROR] git push origin HEAD failed
    goto :fail
  )
) else (
echo [INFO] version updated to %PKG_VERSION% - package.json and package-lock.json
echo [INFO] Re-run with --commit to commit+push the version bump before tagging.

  goto :fail
)

REM Create annotated tag
if "%SKIP_TAG_CREATE%"=="1" (
  >> "%LOGFILE%" echo [INFO] Skip tag creation: %TAG%
) else (
  >> "%LOGFILE%" echo [CMD] git tag -a "%TAG%" -m "Release %TAG%"
  git tag -a "%TAG%" -m "Release %TAG%" >> "%LOGFILE%" 2>&1
  if errorlevel 1 (
    echo [ERROR] Failed to create tag.
    >> "%LOGFILE%" echo [ERROR] git tag failed
    goto :fail
  )
)

REM Push tag to trigger Actions
if "%SKIP_TAG_PUSH%"=="1" (
  >> "%LOGFILE%" echo [INFO] Skip tag push: %TAG%
) else (
  >> "%LOGFILE%" echo [CMD] git push origin "%TAG%"
  git push origin "%TAG%" >> "%LOGFILE%" 2>&1
  if errorlevel 1 (
    echo [ERROR] Failed to push tag to origin.
    echo         Check remote name and permissions.
    >> "%LOGFILE%" echo [ERROR] git push tag failed
    goto :fail
  )
)

echo.
echo [OK] Release started: %TAG%
echo      package.json version: %PKG_VERSION%
echo      GitHub Actions will build Windows and macOS installers in parallel.
echo      After completion, artifacts are attached to the GitHub Release.
echo.

REM Open workflow page (best-effort)
for /f "usebackq delims=" %%U in (`git remote get-url origin 2^>nul`) do set "ORIGIN_URL=%%U"
if not "%ORIGIN_URL%"=="" (
  set "ORIGIN_URL=!ORIGIN_URL:git@github.com:=https://github.com/!"
  set "ORIGIN_URL=!ORIGIN_URL:.git=!"
  start "" "!ORIGIN_URL!/actions/workflows/build.yml"
)

goto :success

REM --- Helpers ---

:tag_exists
REM Sets TAG_EXISTS=1 if tag exists locally or on origin.
set "TAG_EXISTS=0"

git rev-parse -q --verify "refs/tags/%~1" >> "%LOGFILE%" 2>&1
if not errorlevel 1 set "TAG_EXISTS=1"

if "%TAG_EXISTS%"=="0" (
  git ls-remote --exit-code --tags origin "refs/tags/%~1" >> "%LOGFILE%" 2>&1
  if not errorlevel 1 set "TAG_EXISTS=1"
)

exit /b 0

:auto_bump_patch
REM Finds next available patch version from a base semver (e.g. 1.2.0 -> 1.2.1).
REM PowerShell/cmd quoting 이슈를 피하기 위해 배치에서 직접 파싱한다.
set "BASE=%~1"

set "MAJOR="
set "MINOR="
set "PATCH="
for /f "tokens=1-3 delims=." %%A in ("%BASE%") do (
  set "MAJOR=%%A"
  set "MINOR=%%B"
  set "PATCH=%%C"
)

if "%MAJOR%"=="" exit /b 1
if "%MINOR%"=="" exit /b 1
if "%PATCH%"=="" set "PATCH=0"

set /a PATCH_NUM=%PATCH% 1>nul 2>nul
if errorlevel 1 exit /b 1

set /a NEXT_PATCH=%PATCH_NUM%+1
set "NEXT_VERSION="

REM 최대 9999까지 탐색
for /l %%P in (!NEXT_PATCH!,1,9999) do (
  set "CANDIDATE=%MAJOR%.%MINOR%.%%P"
  set "CAND_TAG=%DEFAULT_TAG_PREFIX%!CANDIDATE!"

  call :tag_exists "!CAND_TAG!"
  if "!TAG_EXISTS!"=="0" (
    set "NEXT_VERSION=!CANDIDATE!"
    goto :auto_bump_patch_found
  )
)

exit /b 1

:auto_bump_patch_found
set "PKG_VERSION=%NEXT_VERSION%"
set "TAG=%DEFAULT_TAG_PREFIX%%PKG_VERSION%"
set "VERSION=%TAG%"
exit /b 0

:fail
set "EXIT_CODE=1"
>> "%LOGFILE%" echo [FAIL] step=%STEP% errorlevel=%ERRORLEVEL%
goto :finally

:success
set "EXIT_CODE=0"
goto :finally

:finally
>> "%LOGFILE%" echo [INFO] exit_code=%EXIT_CODE%
popd >nul
echo.
echo Log saved: "%LOGFILE%"
if not "%EXIT_CODE%"=="0" (
  REM When launched from Explorer or in a failing case, open the log automatically.
  start "" "%LOGFILE%" >nul 2>nul
)
if "%CODEPAGE_CHANGED%"=="1" (
  if not "%ORIGINAL_CODEPAGE%"=="" chcp %ORIGINAL_CODEPAGE% >nul
)
if "%PAUSE_ON_EXIT%"=="1" (
  pause
)
exit /b %EXIT_CODE%
