# MCP Cursor IntelliJ Plugin

IntelliJ IDEA와 Android Studio에서 MCP Cursor Server와 연결하여 AI 기반 코드 생성 및 분석 기능을 제공하는 플러그인입니다.

## 🚀 주요 기능

- **🤖 AI 코드 생성**: 자연어 설명으로 코드 자동 생성
- **📊 코드 분석**: AI를 통한 코드 품질 분석 및 개선 제안
- **💬 AI 채팅**: 실시간 AI와의 대화를 통한 개발 지원
- **🔍 프로젝트 컨텍스트 인식**: 현재 프로젝트 정보를 활용한 정확한 코드 생성
- **⚡ 실시간 제안**: 스트리밍 방식의 빠른 AI 응답

## 📋 지원 모델

- **OpenAI**: GPT-4, GPT-4-turbo, GPT-3.5-turbo
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
- **Google**: Gemini Pro, Gemini Pro Vision
- **Cursor**: Cursor AI 모델

## 🛠️ 설치 방법

### 1. MCP Cursor Server 실행

먼저 MCP Cursor Server가 실행 중인지 확인하세요:

```bash
# 서버 상태 확인
node src/server.js status

# 서버 시작 (필요한 경우)
node src/server.js start
```

### 2. 플러그인 빌드

```bash
# 플러그인 디렉토리로 이동
cd mcp-intellij-plugin

# Gradle 빌드
./gradlew buildPlugin
```

### 3. 플러그인 설치

1. **IntelliJ IDEA** 또는 **Android Studio** 실행
2. **File** → **Settings** (Windows/Linux) 또는 **Preferences** (macOS)
3. **Plugins** → **⚙️** → **Install Plugin from Disk...**
4. 빌드된 플러그인 파일 선택: `build/distributions/mcp-cursor-client-1.0.0.zip`
5. **OK** 클릭 후 IDE 재시작

## 🎯 사용 방법

### 1. 설정

1. **Tools** → **MCP Cursor Settings** 메뉴 선택
2. 서버 URL 설정 (기본값: `http://localhost:3000`)
3. **연결 테스트** 버튼으로 서버 연결 확인
4. 원하는 설정 적용 후 **OK**

### 2. AI 코드 생성

1. 코드를 생성하고 싶은 위치에 커서 위치
2. **Code** → **Generate Code with AI** 메뉴 선택 (또는 `Ctrl+Shift+G`)
3. 코드 생성 요청 입력
4. 원하는 AI 모델 선택
5. **생성** 버튼 클릭

### 3. AI 채팅

1. **Tools** → **Open AI Chat** 메뉴 선택 (또는 `Ctrl+Shift+C`)
2. 우측 패널에 채팅 창이 열림
3. AI 모델 선택
4. 질문 입력 후 **Enter** 또는 **전송** 버튼 클릭

### 4. 코드 분석

1. 분석하고 싶은 코드 선택
2. **Code** → **Analyze Code with AI** 메뉴 선택
3. 분석 유형 선택:
   - 코드 품질
   - 성능 최적화
   - 보안 검토
   - 리팩토링 제안
   - 버그 검사
   - 일반 분석
4. AI 모델 선택
5. 분석 결과 확인

## ⌨️ 단축키

- `Ctrl+Shift+G`: AI 코드 생성
- `Ctrl+Shift+C`: AI 채팅 열기
- `Ctrl+Enter`: 채팅에서 메시지 전송
- `Shift+Enter`: 채팅에서 줄바꿈

## 🔧 개발자 정보

### 프로젝트 구조

```
mcp-intellij-plugin/
├── src/main/kotlin/com/mcp/cursor/client/
│   ├── service/           # MCP 서버 통신
│   ├── ui/               # 사용자 인터페이스
│   ├── actions/          # 액션 클래스
│   └── settings/         # 설정 관리
├── src/main/resources/
│   └── META-INF/
│       └── plugin.xml    # 플러그인 설정
└── build.gradle.kts      # 빌드 설정
```

### 주요 클래스

- **MCPService**: MCP 서버와의 통신 담당
- **ChatPanel**: AI 채팅 UI
- **GenerateCodeAction**: 코드 생성 액션
- **AnalyzeCodeAction**: 코드 분석 액션
- **MCPSettingsConfigurable**: 설정 페이지

### 빌드 요구사항

- **JDK 17** 이상
- **IntelliJ IDEA 2023.3** 이상
- **Kotlin 1.9.20** 이상
- **Gradle 8.0** 이상

## 🐛 문제 해결

### 연결 오류

1. MCP Cursor Server가 실행 중인지 확인
2. 서버 URL이 올바른지 확인 (`http://localhost:3000`)
3. 방화벽 설정 확인
4. **Tools** → **MCP Cursor Settings**에서 연결 테스트 실행

### 모델이 표시되지 않음

1. 서버 연결 상태 확인
2. API 키가 설정되어 있는지 확인
3. 서버 재시작 후 플러그인 재연결

### 코드 생성이 작동하지 않음

1. 선택한 모델이 사용 가능한지 확인
2. 요청 텍스트가 비어있지 않은지 확인
3. 서버 로그 확인

## 📝 라이선스

MIT License

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📞 지원

문제가 발생하거나 기능 요청이 있으시면 GitHub Issues를 통해 문의해주세요.

---

**MCP Cursor IntelliJ Plugin**으로 더욱 효율적인 개발을 경험해보세요! 🚀


