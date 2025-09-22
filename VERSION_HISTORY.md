# Version History

이 문서는 MCP Cursor Server의 상세한 버전별 변경사항을 기록합니다.

## 📋 목차
- [v2.0.0 - MCP Protocol Support](#v200---mcp-protocol-support)
- [v1.0.0 - Initial Release](#v100---initial-release)
- [Migration Guides](#migration-guides)
- [Technical Specifications](#technical-specifications)

---

## v2.0.0 - MCP Protocol Support
**Release Date**: 2025-01-23  
**Type**: Major Release  
**Breaking Changes**: Yes

### 🎯 주요 목표
- MCP (Model Context Protocol) 표준 지원
- 다중 AI 모델 통합
- Xcode 중심의 전문적인 개발 도구
- 자동화된 버전 관리 시스템

### ✨ 새로운 기능

#### 1. MCP 프로토콜 지원
```javascript
// MCP 초기화
{
  "jsonrpc": "2.0",
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "resources": { "subscribe": true },
      "tools": { "listChanged": true },
      "prompts": { "listChanged": true }
    }
  }
}
```

#### 2. 다중 AI 모델 통합
- **OpenAI**: GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
- **Google**: Gemini Pro, Gemini Pro Vision
- **Cursor**: Cursor Small, GPT-4 (Cursor API), Claude 3.5 Sonnet (Cursor API)

#### 3. 고급 프로젝트 감지
```bash
# Xcode 프로젝트 감지
node src/server.js detect /path/to/xcode/project

# 감지 결과
✅ 프로젝트 감지됨!
타입: xcode
이름: MyApp
경로: /Users/developer/MyApp
프로젝트 파일: /Users/developer/MyApp/MyApp.xcodeproj
빌드 설정: 45개 항목
```

#### 4. 자동 버전 관리
```bash
# 버전 정보 확인
node src/server.js version --info

# 패치 버전 증가
node src/server.js version --patch

# 자동 릴리스
npm run release
```

### 🏗️ 아키텍처 변경

#### 새로운 디렉토리 구조
```
src/
├── core/           # MCP 서버 핵심
│   └── httpServer.js
├── services/       # 비즈니스 로직
│   ├── projectDetector.js
│   ├── aiService.js
│   └── cursorEditorService.js
├── utils/          # 유틸리티
│   └── logger.js
├── config/         # 설정
│   └── config.js
└── server.js       # 메인 서버
```

#### 의존성 업데이트
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.4.0",
    "axios": "^1.6.0",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "ws": "^8.18.3",
    "dotenv": "^16.3.1",
    "winston": "^3.11.0",
    "chalk": "^5.3.0",
    "commander": "^11.1.0",
    "openai": "^4.20.0",
    "@google/generative-ai": "^0.2.0",
    "@anthropic-ai/sdk": "^0.24.3"
  }
}
```

### 🔧 새로운 CLI 명령어

#### 서버 관리
```bash
# 서버 시작
node src/server.js start

# 프로젝트 감지
node src/server.js detect

# 상태 확인
node src/server.js status

# 설정 확인
node src/server.js config

# 로그 확인
node src/server.js logs
```

#### 버전 관리
```bash
# 버전 정보
node src/server.js version --info

# 버전 증가
node src/server.js version --patch
node src/server.js version --minor
node src/server.js version --major
```

### 📡 새로운 API 엔드포인트

#### MCP 프로토콜
- `POST /mcp/initialize` - MCP 서버 초기화
- `POST /mcp/resources/list` - 리소스 목록
- `POST /mcp/resources/read` - 리소스 읽기
- `POST /mcp/tools/list` - 도구 목록
- `POST /mcp/tools/call` - 도구 실행

#### OpenAI 호환
- `GET /v1/models` - 모델 목록
- `GET /v1/models/:modelId` - 모델 정보
- `POST /v1/chat/completions` - 채팅 완료

### 🐛 버그 수정
- 작업 디렉토리 감지 문제 해결
- Cursor CLI 안정성 개선
- 메모리 누수 방지
- 에러 처리 개선

### ⚠️ Breaking Changes
1. **API 변경**: 새로운 MCP 프로토콜 엔드포인트
2. **설정 변경**: 새로운 환경 변수 구조
3. **CLI 변경**: 새로운 명령어 인터페이스
4. **의존성 변경**: 새로운 패키지 요구사항

---

## v1.0.0 - Initial Release
**Release Date**: 2025-01-22  
**Type**: Initial Release  
**Breaking Changes**: No

### 🎯 주요 목표
- 기본적인 HTTP 서버 구현
- Cursor CLI 연동
- Xcode Code Intelligence 지원

### ✨ 초기 기능

#### 1. 기본 HTTP 서버
```javascript
// Express.js 기반 서버
const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});
```

#### 2. Cursor CLI 연동
```bash
# Cursor CLI 실행
cursor -p "코드를 최적화해주세요"
```

#### 3. 기본 프로젝트 감지
```javascript
// 간단한 프로젝트 감지
function detectProject() {
  // 기본적인 파일 시스템 검색
  return {
    type: 'xcode',
    path: process.cwd()
  };
}
```

### 🏗️ 초기 아키텍처
```
├── server.js          # 메인 서버
├── package.json       # 의존성
├── .env              # 환경 변수
└── README.md         # 문서
```

### 📡 초기 API
- `GET /health` - 서버 상태
- `POST /chat` - 기본 채팅
- `GET /project` - 프로젝트 정보

### 🔧 초기 CLI
```bash
# 서버 시작
node server.js

# 기본 테스트
curl http://localhost:3000/health
```

### ⚠️ 알려진 문제
- 작업 디렉토리 감지 부정확
- Cursor CLI 안정성 문제
- 제한적인 AI 모델 지원
- 기본적인 에러 처리

---

## Migration Guides

### v1.0.0 → v2.0.0

#### 1. 의존성 업데이트
```bash
# 기존 의존성 제거
rm -rf node_modules package-lock.json

# 새로운 의존성 설치
npm install
```

#### 2. 설정 마이그레이션
```bash
# v1.0.0 .env
CURSOR_API_KEY=your_key

# v2.0.0 .env
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
GOOGLE_API_KEY=your_key
CURSOR_API_KEY=your_key
```

#### 3. 명령어 변경
```bash
# v1.0.0
node server.js

# v2.0.0
node src/server.js start
```

#### 4. API 엔드포인트 변경
```bash
# v1.0.0
POST /chat

# v2.0.0
POST /v1/chat/completions
POST /mcp/tools/call
```

---

## Technical Specifications

### System Requirements

#### v2.0.0
- **Node.js**: 18.0.0+
- **npm**: 8.0.0+
- **macOS**: 10.15+ (Xcode 지원)
- **Memory**: 512MB+ RAM
- **Storage**: 100MB+ free space

#### v1.0.0
- **Node.js**: 14.0.0+
- **npm**: 6.0.0+
- **macOS**: 10.14+
- **Memory**: 256MB+ RAM
- **Storage**: 50MB+ free space

### Performance Metrics

#### v2.0.0
- **Startup Time**: ~2-3초
- **Memory Usage**: ~50-100MB
- **Response Time**: ~100-500ms
- **Concurrent Users**: 10+

#### v1.0.0
- **Startup Time**: ~1-2초
- **Memory Usage**: ~25-50MB
- **Response Time**: ~200-1000ms
- **Concurrent Users**: 5+

### Security Features

#### v2.0.0
- **API Key Management**: 환경 변수 기반
- **CORS Protection**: 설정 가능한 CORS
- **Input Validation**: 요청 데이터 검증
- **Error Handling**: 표준화된 에러 응답

#### v1.0.0
- **Basic Security**: 기본적인 보안
- **API Key**: 환경 변수 저장
- **Simple Validation**: 기본 검증

---

## Development Timeline

### 2025-01-22
- **v1.0.0 Release**: 초기 서버 구현
- **Basic Features**: HTTP 서버, Cursor CLI 연동
- **Documentation**: 기본 README 작성

### 2025-01-23
- **v2.0.0 Development**: MCP 프로토콜 설계
- **Architecture Redesign**: 모듈화된 구조 설계
- **Multi-AI Integration**: 다중 AI 모델 통합
- **Advanced Features**: 프로젝트 감지, 버전 관리
- **v2.0.0 Release**: 완전한 MCP 서버 구현

### Future Plans
- **v2.1.0**: 성능 최적화 및 고급 기능
- **v2.2.0**: 웹 인터페이스 및 모니터링
- **v3.0.0**: 마이크로서비스 아키텍처

---

## Support & Maintenance

### Version Support Policy
- **Current Version**: v2.0.0 (Full Support)
- **Previous Version**: v1.0.0 (Security Updates Only)
- **Legacy Versions**: No Support

### Update Schedule
- **Patch Releases**: As needed (bug fixes)
- **Minor Releases**: Monthly (new features)
- **Major Releases**: Quarterly (breaking changes)

### Support Channels
- **GitHub Issues**: [Issues](https://github.com/shinyryu09/cursor-server/issues)
- **Documentation**: [README.md](./README.md)
- **Version Info**: `node src/server.js version --info`
