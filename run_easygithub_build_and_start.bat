@echo off
setlocal

REM EasyGithub 빌드 후 실행(Preview) 스크립트
REM - 필요 시 아래 2개 값을 채워주세요 (GitHub OAuth)
REM - 주의: 실제 값은 커밋하지 마세요
REM set "GITHUB_CLIENT_ID=YOUR_CLIENT_ID"
REM set "GITHUB_CLIENT_SECRET=YOUR_CLIENT_SECRET"

cd /d "%~dp0"

if not exist node_modules (
  echo [EasyGithub] node_modules 없음 - npm install 실행
  call npm install
  if errorlevel 1 (
    echo [EasyGithub] npm install 실패
    pause
    exit /b 1
  )
)

echo [EasyGithub] 빌드 시작
call npm run build
if errorlevel 1 (
  echo [EasyGithub] 빌드 실패
  pause
  exit /b 1
)

echo [EasyGithub] 빌드 실행(Preview) (종료: Ctrl+C)
call npm run start

echo [EasyGithub] 프로세스 종료
pause
endlocal
