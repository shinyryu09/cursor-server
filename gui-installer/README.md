# MCP Cursor Server GUI 설치 프로그램

Electron 기반의 직관적인 GUI 설치 프로그램으로 MCP Cursor Server를 쉽게 설치할 수 있습니다.

## 🚀 빠른 시작

### 1. GUI 설치 프로그램 실행

```bash
# 프로젝트 루트에서
npm run gui:install  # 의존성 설치
npm run gui:start    # GUI 설치 프로그램 실행
```

### 2. 설치 과정

1. **환영 화면**: MCP Cursor Server의 주요 기능과 시스템 요구사항 확인
2. **설치 경로 선택**: 마우스 클릭으로 설치할 폴더 선택
3. **설치 진행**: 자동으로 저장소 클론, 의존성 설치, 환경 설정
4. **설치 완료**: 서버 시작 및 다음 단계 안내

## 🎨 주요 기능

### 직관적인 사용자 인터페이스
- **단계별 안내**: 설치 과정을 4단계로 나누어 명확하게 안내
- **실시간 진행률**: 설치 진행 상황을 시각적으로 표시
- **상세한 로그**: 모든 설치 과정을 실시간으로 확인 가능

### 자동화된 설치 과정
- **시스템 요구사항 확인**: Node.js 버전, npm 등 자동 검증
- **저장소 클론**: GitHub에서 최신 소스코드 자동 다운로드
- **의존성 설치**: npm을 통한 패키지 자동 설치
- **환경 설정**: .env 파일 자동 생성 및 기본 설정

### 사용자 친화적 기능
- **폴더 선택**: 시스템 파일 선택 대화상자를 통한 쉬운 경로 선택
- **에러 처리**: 설치 중 발생하는 문제에 대한 명확한 안내
- **완료 후 액션**: 설치 완료 후 서버 시작, 폴더 열기, 문서 보기

## 🛠️ 개발 및 빌드

### 개발 모드 실행
```bash
cd gui-installer
npm install
npm start
```

### 배포용 빌드
```bash
# macOS용 DMG 파일
npm run build:mac

# Windows용 설치 파일
npm run build:win

# Linux용 AppImage 파일
npm run build:linux

# 모든 플랫폼
npm run build
```

### 빌드 결과물
- **macOS**: `dist/MCP Cursor Server Installer-1.0.0.dmg`
- **Windows**: `dist/MCP Cursor Server Installer Setup 1.0.0.exe`
- **Linux**: `dist/MCP Cursor Server Installer-1.0.0.AppImage`

## 📁 프로젝트 구조

```
gui-installer/
├── src/
│   ├── main.js          # Electron 메인 프로세스
│   ├── preload.js       # 보안을 위한 preload 스크립트
│   ├── index.html       # 메인 UI
│   └── app.js           # 프론트엔드 로직
├── assets/
│   └── icon.png         # 앱 아이콘
├── package.json         # 프로젝트 설정
└── README.md           # 이 파일
```

## 🔧 기술 스택

- **Electron**: 크로스 플랫폼 데스크톱 앱 프레임워크
- **HTML/CSS/JavaScript**: 사용자 인터페이스
- **Node.js**: 백엔드 로직 및 시스템 통합
- **electron-builder**: 앱 패키징 및 배포

## 🎯 설치 과정 상세

### 1단계: 시스템 요구사항 확인
- Node.js 18.0.0 이상 버전 확인
- npm 설치 상태 확인
- 필요한 디렉토리 권한 확인

### 2단계: 저장소 클론
- GitHub에서 최신 소스코드 다운로드
- 선택한 경로에 `cursor-server` 폴더 생성
- Git 저장소 초기화

### 3단계: 의존성 설치
- npm 캐시 정리
- package.json 기반 패키지 설치
- 설치 과정 로그 실시간 표시

### 4단계: 환경 설정
- env.example을 .env로 복사
- 기본 환경 변수 설정
- Cursor Editor 연결 확인

### 5단계: 설치 완료
- 설치 성공 메시지 표시
- 서버 시작 옵션 제공
- 다음 단계 안내

## 🚨 문제 해결

### 일반적인 문제

**1. GUI 설치 프로그램이 실행되지 않음**
```bash
# 의존성 재설치
cd gui-installer
rm -rf node_modules package-lock.json
npm install
```

**2. 설치 중 권한 오류**
- 관리자 권한으로 실행
- 설치 경로에 쓰기 권한 확인

**3. 네트워크 연결 문제**
- 인터넷 연결 상태 확인
- 방화벽 설정 확인

### 로그 확인
설치 과정의 모든 로그는 GUI 내에서 실시간으로 확인할 수 있습니다. 문제가 발생하면 로그를 확인하여 구체적인 오류 메시지를 파악하세요.

## 📞 지원

문제가 발생하거나 질문이 있으시면 [Issues](https://github.com/shinyryu09/cursor-server/issues)에 등록해주세요.

## 📄 라이선스

MIT License

