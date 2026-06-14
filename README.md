# Easy Github

GitHub가 익숙하지 않은 사람도 로컬 프로젝트를 안전하게 관리할 수 있도록 만든 Windows용 데스크톱 앱입니다.

![Easy Github 프로젝트 화면](docs/screenshots/easygithub-projects.png)

## 주요 기능

- 로컬 Git 저장소 등록 및 프로젝트 전환
- 변경사항 확인, stage, commit, pull, push
- 브랜치 생성, 전환, 병합, 삭제
- GitHub PR, Issue, Repository 관리
- 프로젝트별 TODO 확인
- 앱 내 초보자 가이드
- 라이트/다크/시스템 테마
- Tauri 기반 경량 실행 및 자동 업데이트

## 다운로드

최신 설치 파일은 [GitHub Releases](https://github.com/snowtie/Easy-Github/releases/latest)에서 받을 수 있습니다.

Windows 64-bit 환경에서는 `EasyGithub_2.1.5_x64-setup.exe`를 다운로드해서 실행하면 됩니다.

## 로그인

GitHub 기능을 사용하려면 로그인이 필요합니다.

- 기본 방식: GitHub Personal Access Token
- 사이트 로그인: OAuth Client ID가 포함된 빌드에서 사용 가능

토큰은 Windows 자격 증명 저장소를 통해 로컬 PC에 저장됩니다.

### 토큰 발급

1. [GitHub 토큰 발급 페이지](https://github.com/settings/tokens)로 이동합니다.
2. 필요한 권한을 선택해 token을 발급합니다.
3. 앱의 `로그인` 버튼을 누르고 token을 붙여넣습니다.

비공개 저장소를 다루려면 `repo` 권한이 필요합니다.

## 업데이트

앱 안의 `업데이트 확인` 버튼으로 새 버전을 확인할 수 있습니다.

`2.1.5` 릴리스부터 Windows 실행 시 불필요한 CMD 창이 뜨지 않고, 다크모드 전환 시 native title bar theme도 같이 반영됩니다.

## 개발

```powershell
npm install
npm run dev
```

Tauri 앱으로 실행하려면:

```powershell
npm run tauri:dev
```

릴리스 빌드:

```powershell
npm run tauri:build
npm run updater:metadata
```

업데이트 서명에는 `TAURI_SIGNING_PRIVATE_KEY`가 필요합니다.
