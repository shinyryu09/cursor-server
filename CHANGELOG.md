## [2.0.0] - 2025-09-22

### 변경사항
- v2.0.0: Complete MCP server rewrite with multi-AI support
- v1.0.1: ScorecardView 스코프 오류 해결 기능 추가
- v1.0.1: Add version management system with automatic version bumping on Git push
- Add cursor-editor model to Xcode Code Intelligence
- Add Cursor Editor integration with HTTP API
- Add GitHub Actions workflows for CI/CD
- Initial commit: Cursor Server with Xcode Code Intelligence integration

### 기술적 변경사항
- 버전 업데이트: v2.0.0
- Git 커밋: 329044f
- 변경된 파일 수: 7
- 자동 생성 시간: 2025-09-22T22:11:22.918Z

### 자동 생성 정보
이 변경 로그는 다음 명령어로 자동 생성되었습니다:
```bash
npm run version:changelog
```

상세한 버전 히스토리는 [VERSION_HISTORY.md](./VERSION_HISTORY.md)를 참조하세요.

---

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-01-23

### Added
- **MCP (Model Context Protocol) 지원**: 표준 MCP 프로토콜을 통한 AI 모델 연동
- **다중 AI 모델 지원**: OpenAI, Anthropic, Google Gemini, Cursor API 통합
- **프로젝트 자동 감지**: Xcode 프로젝트 자동 감지 및 분석
- **Cursor Editor 연동**: Cursor Editor HTTP API를 통한 고급 코드 생성
- **실시간 채팅**: 스트리밍을 통한 실시간 AI 응답
- **버전 관리 시스템**: Semantic Versioning 기반 자동 버전 관리
- **CLI 인터페이스**: Commander.js 기반 명령어 인터페이스
- **로깅 시스템**: Winston 기반 구조화된 로깅
- **프로젝트 감지기**: Xcode 프로젝트 파일 분석 및 빌드 설정 파싱
- **AI 서비스**: 다중 AI 모델 통합 서비스
- **HTTP MCP 서버**: Express.js 기반 HTTP 서버
- **자동 변경 로그 생성**: Git 커밋 기반 변경 로그 자동 생성

### Changed
- **완전한 아키텍처 재설계**: 기존 서버를 MCP 프로토콜 기반으로 완전 재작성
- **Xcode 중심 설계**: Android Studio 지원 제거, Xcode 전용으로 최적화
- **모듈화된 구조**: src/ 디렉토리 기반 모듈화된 코드 구조
- **향상된 에러 처리**: 표준화된 에러 처리 및 로깅

### Technical Details
- **Node.js 18.0.0+** 요구사항
- **ES Modules** 사용
- **TypeScript 스타일 JSDoc** 주석
- **Winston 로깅** 시스템
- **Chalk 컬러 출력**
- **Commander CLI** 인터페이스

### API Endpoints
- `GET /health` - 서버 상태 확인
- `GET /v1/models` - 사용 가능한 AI 모델 목록
- `POST /v1/chat/completions` - OpenAI 호환 채팅 API
- `POST /mcp/*` - MCP 프로토콜 엔드포인트

### CLI Commands
- `node src/server.js start` - 서버 시작
- `node src/server.js detect` - 프로젝트 감지
- `node src/server.js status` - 서버 상태 확인
- `node src/server.js version` - 버전 관리
- `node src/server.js config` - 설정 확인
- `node src/server.js logs` - 로그 확인

### Version Management
- `npm run version:patch/minor/major` - 버전 증가
- `npm run git:push` - 자동 버전업 후 푸시
- `npm run release` - 릴리스 (변경 로그 + 푸시)

## [1.0.0] - 2025-01-22

### Added
- **초기 서버 구현**: Express.js 기반 HTTP 서버
- **Cursor CLI 연동**: Cursor CLI를 통한 AI 채팅 기능
- **Xcode Code Intelligence 지원**: Xcode와의 기본 연동
- **프로젝트 감지**: 기본적인 프로젝트 경로 감지
- **환경 변수 설정**: API 키 및 설정 관리
- **기본 로깅**: 콘솔 기반 로깅 시스템

### Technical Details
- **Node.js** 기반 서버
- **Express.js** 웹 프레임워크
- **CORS** 지원
- **환경 변수** 설정 (.env)

### Known Issues
- 작업 디렉토리 감지 문제
- Cursor CLI 안정성 문제
- 제한적인 AI 모델 지원
- 기본적인 에러 처리

---

## Version History Summary

### v2.0.0 (Current)
- **Major Release**: 완전한 MCP 프로토콜 지원
- **Multi-AI Integration**: OpenAI, Anthropic, Google, Cursor API
- **Advanced Project Detection**: Xcode 프로젝트 분석
- **Professional CLI**: Commander.js 기반 명령어 인터페이스
- **Automated Versioning**: Semantic Versioning + 자동 변경 로그

### v1.0.0 (Legacy)
- **Initial Release**: 기본 HTTP 서버
- **Basic Cursor Integration**: Cursor CLI 연동
- **Simple Project Detection**: 기본 프로젝트 감지
- **Foundation**: 프로젝트 기반 구조

---

## Migration Guide

### From v1.0.0 to v2.0.0

#### Breaking Changes
- **API Endpoints**: 새로운 MCP 프로토콜 엔드포인트
- **Configuration**: 새로운 설정 파일 구조
- **CLI Commands**: 새로운 명령어 인터페이스

#### Migration Steps
1. **Backup**: 기존 설정 및 데이터 백업
2. **Update Dependencies**: `npm install` 실행
3. **Configuration**: 새로운 환경 변수 설정
4. **Testing**: 서버 및 AI 모델 연결 테스트

#### Configuration Changes
```bash
# v1.0.0
CURSOR_API_KEY=your_key

# v2.0.0
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
GOOGLE_API_KEY=your_key
CURSOR_API_KEY=your_key
```

---

## Future Roadmap

### v2.1.0 (Planned)
- **Enhanced Xcode Integration**: 더 정교한 Xcode 프로젝트 분석
- **Performance Optimization**: 응답 속도 개선
- **Advanced Logging**: 구조화된 로그 분석
- **Plugin System**: 확장 가능한 플러그인 아키텍처

### v2.2.0 (Planned)
- **Web Interface**: 웹 기반 관리 인터페이스
- **Real-time Monitoring**: 실시간 서버 모니터링
- **Advanced AI Features**: 더 고급 AI 기능
- **Multi-language Support**: 다국어 지원

### v3.0.0 (Future)
- **Microservices Architecture**: 마이크로서비스 아키텍처
- **Cloud Integration**: 클라우드 서비스 연동
- **Enterprise Features**: 엔터프라이즈 기능
- **Advanced Security**: 고급 보안 기능

---

## Contributing

버전 업데이트 시 다음 사항을 확인해주세요:

1. **Semantic Versioning** 준수
2. **CHANGELOG.md** 업데이트
3. **Breaking Changes** 명시
4. **Migration Guide** 작성
5. **Tests** 업데이트

---

## Support

- **Issues**: [GitHub Issues](https://github.com/shinyryu09/cursor-server/issues)
- **Documentation**: [README.md](./README.md)
- **Version Info**: `node src/server.js version --info`
