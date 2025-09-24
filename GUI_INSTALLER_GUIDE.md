# 🖥️ MCP Cursor Server GUI 설치 프로그램 가이드

맥 사용자를 위한 직관적인 GUI 설치 프로그램을 제공합니다.

## 🚀 설치 프로그램 실행

### 1. 저장소 클론
```bash
git clone https://github.com/shinyryu09/cursor-server.git
cd cursor-server
```

### 2. GUI 설치 프로그램 실행
```bash
# GUI 설치 프로그램 의존성 설치
npm run gui:install

# GUI 설치 프로그램 실행
npm run gui:start
```

## 📋 설치 과정

### 1단계: 환영 화면
- MCP Cursor Server의 주요 기능 확인
- 시스템 요구사항 확인
- "설치 시작" 버튼 클릭

### 2단계: 설치 경로 선택
- "폴더 선택" 버튼 클릭
- 원하는 설치 경로 선택
- "다음" 버튼 클릭

### 3단계: 설치 진행
- "설치 시작" 버튼 클릭
- 실시간 진행률 확인
- 상세한 설치 로그 확인

### 4단계: 설치 완료
- 설치 성공 메시지 확인
- 다음 단계 안내 확인
- 서버 시작, 폴더 열기, 문서 보기 옵션

## 🎨 GUI 특징

### 직관적인 인터페이스
- **단계별 안내**: 4단계로 나누어진 명확한 설치 과정
- **실시간 피드백**: 설치 진행 상황을 시각적으로 표시
- **상세한 로그**: 모든 설치 과정을 실시간으로 확인

### 자동화된 기능
- **시스템 검증**: Node.js 버전, npm 등 자동 확인
- **저장소 클론**: GitHub에서 최신 소스코드 자동 다운로드
- **의존성 설치**: npm을 통한 패키지 자동 설치
- **환경 설정**: .env 파일 자동 생성

### 사용자 친화적 기능
- **폴더 선택**: 시스템 파일 선택 대화상자 사용
- **에러 처리**: 문제 발생 시 명확한 안내 메시지
- **완료 후 액션**: 설치 완료 후 다양한 옵션 제공

## 🔧 개발자 정보

### 프로젝트 구조
```
gui-installer/
├── src/
│   ├── main.js          # Electron 메인 프로세스
│   ├── preload.js       # 보안을 위한 preload 스크립트
│   ├── index.html       # 메인 UI
│   └── app.js           # 프론트엔드 로직
├── assets/
│   ├── icon.svg         # SVG 아이콘
│   └── icon.png         # PNG 아이콘
├── package.json         # 프로젝트 설정
└── README.md           # 상세 문서
```

### 기술 스택
- **Electron**: 크로스 플랫폼 데스크톱 앱
- **HTML/CSS/JavaScript**: 사용자 인터페이스
- **Node.js**: 백엔드 로직 및 시스템 통합
- **electron-builder**: 앱 패키징 및 배포

### 빌드 명령어
```bash
# 개발 모드 실행
cd gui-installer
npm start

# macOS용 DMG 파일 생성
npm run build:mac

# Windows용 설치 파일 생성
npm run build:win

# Linux용 AppImage 파일 생성
npm run build:linux
```

## 🚨 문제 해결

### 일반적인 문제

**1. GUI 설치 프로그램이 실행되지 않음**
```bash
cd gui-installer
rm -rf node_modules package-lock.json
npm install
npm start
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

## 🎯 다음 단계

GUI 설치 프로그램으로 설치를 완료한 후:

1. **환경 변수 설정**: `.env` 파일에 AI 모델 API 키 설정
2. **Cursor Editor 설정**: Cursor Editor 실행 및 API 서버 활성화
3. **서버 시작**: `npm start` 명령어로 서버 실행
4. **사용 시작**: MCP 클라이언트와 연동하여 사용

자세한 사용법은 메인 README.md를 참조하세요.

