# 🔄 플러그인 버전 관리 가이드

## 📋 개요

MCP Cursor Server와 IntelliJ 플러그인의 버전을 동기화하고 자동화된 버전 관리 시스템을 제공합니다.

## 🎯 주요 기능

- **자동 버전 동기화**: 서버와 플러그인 버전 자동 동기화
- **버전 증가**: 패치, 마이너, 메이저 버전 자동 증가
- **버전 정보 확인**: 현재 버전 상태 실시간 확인
- **빌드 자동화**: 버전 변경 후 자동 빌드

## 🚀 사용법

### 1. 버전 정보 확인

```bash
# 현재 버전 정보 표시
npm run plugin:version:info

# 또는 직접 스크립트 실행
node scripts/plugin-version.js info
```

**출력 예시:**
```
📊 버전 정보
==================================================
서버 버전: 2.1.1
플러그인 버전: 2.1.1
동기화 상태: ✅ 동기화됨
==================================================
```

### 2. 버전 동기화

```bash
# 서버와 플러그인 버전 동기화
npm run plugin:version:sync

# 또는 직접 스크립트 실행
node scripts/plugin-version.js sync
```

### 3. 버전 증가

#### 패치 버전 증가 (2.1.1 → 2.1.2)
```bash
npm run plugin:version:patch
```

#### 마이너 버전 증가 (2.1.1 → 2.2.0)
```bash
npm run plugin:version:minor
```

#### 메이저 버전 증가 (2.1.1 → 3.0.0)
```bash
npm run plugin:version:major
```

### 4. 플러그인 빌드

```bash
# 플러그인 빌드
npm run plugin:build
```

## 📁 파일 구조

```
scripts/
├── plugin-version.js          # 버전 관리 스크립트
└── ...

mcp-intellij-plugin/
├── build.gradle.kts           # 플러그인 버전 설정
├── src/main/resources/
│   └── META-INF/
│       └── plugin.xml         # 플러그인 메타데이터
└── ...

package.json                   # 서버 버전 설정
```

## 🔧 버전 관리 스크립트 상세

### `scripts/plugin-version.js`

#### 주요 함수들:

1. **`getServerVersion()`**: 서버 버전 가져오기
2. **`getPluginVersion()`**: 플러그인 버전 가져오기
3. **`updatePluginVersion(newVersion)`**: 플러그인 버전 업데이트
4. **`showVersionInfo()`**: 버전 정보 표시
5. **`syncVersions()`**: 버전 동기화
6. **`incrementPatch()`**: 패치 버전 증가
7. **`incrementMinor()`**: 마이너 버전 증가
8. **`incrementMajor()`**: 메이저 버전 증가

#### 지원하는 명령어:

- `info`, `--info`: 버전 정보 표시
- `sync`, `--sync`: 서버와 플러그인 버전 동기화
- `patch`, `--patch`: 패치 버전 증가
- `minor`, `--minor`: 마이너 버전 증가
- `major`, `--major`: 메이저 버전 증가

## 📦 NPM 스크립트

### 버전 관리 관련 스크립트:

```json
{
  "scripts": {
    "plugin:version": "node scripts/plugin-version.js",
    "plugin:version:info": "node scripts/plugin-version.js info",
    "plugin:version:sync": "node scripts/plugin-version.js sync",
    "plugin:version:patch": "node scripts/plugin-version.js patch",
    "plugin:version:minor": "node scripts/plugin-version.js minor",
    "plugin:version:major": "node scripts/plugin-version.js major",
    "plugin:build": "cd mcp-intellij-plugin && export JAVA_HOME=/usr/local/opt/openjdk@17 && export PATH=$JAVA_HOME/bin:$PATH && ./gradlew clean buildPlugin"
  }
}
```

## 🔄 버전 관리 워크플로우

### 1. 일반적인 개발 워크플로우

```bash
# 1. 버전 정보 확인
npm run plugin:version:info

# 2. 개발 작업 완료 후 패치 버전 증가
npm run plugin:version:patch

# 3. 플러그인 빌드
npm run plugin:build

# 4. 빌드된 플러그인 확인
ls -la mcp-intellij-plugin/build/distributions/
```

### 2. 새로운 기능 추가 시

```bash
# 1. 마이너 버전 증가
npm run plugin:version:minor

# 2. 플러그인 빌드
npm run plugin:build
```

### 3. 호환성 변경 시

```bash
# 1. 메이저 버전 증가
npm run plugin:version:major

# 2. 플러그인 빌드
npm run plugin:build
```

## 📋 버전 규칙

### Semantic Versioning (SemVer)

- **MAJOR**: 호환성을 깨는 변경사항
- **MINOR**: 하위 호환성을 유지하는 새로운 기능
- **PATCH**: 하위 호환성을 유지하는 버그 수정

### 예시:

- `1.0.0` → `1.0.1`: 버그 수정
- `1.0.1` → `1.1.0`: 새로운 기능 추가
- `1.1.0` → `2.0.0`: 호환성을 깨는 변경사항

## 🚨 주의사항

1. **버전 동기화**: 서버와 플러그인 버전은 항상 동기화되어야 합니다.
2. **빌드 환경**: JDK 17이 필요합니다.
3. **파일 백업**: 버전 변경 전 중요한 파일들을 백업하세요.
4. **테스트**: 버전 변경 후 플러그인을 테스트하세요.

## 🔍 문제 해결

### 버전 동기화 실패

```bash
# 수동으로 버전 동기화
npm run plugin:version:sync
```

### 빌드 실패

```bash
# JDK 17 확인
java --version

# 환경 변수 설정
export JAVA_HOME=/usr/local/opt/openjdk@17
export PATH=$JAVA_HOME/bin:$PATH

# 다시 빌드
npm run plugin:build
```

### 플러그인 설치 실패

1. 이전 플러그인 제거
2. IDE 재시작
3. 새로운 플러그인 설치

## 📚 관련 문서

- [IntelliJ Plugin Development](https://plugins.jetbrains.com/docs/intellij/welcome.html)
- [Semantic Versioning](https://semver.org/)
- [Gradle Build System](https://gradle.org/)

## 🤝 기여하기

버전 관리 시스템 개선에 기여하고 싶으시다면:

1. 이슈 리포트
2. 풀 리퀘스트 제출
3. 문서 개선 제안

---

**마지막 업데이트**: 2025-09-24
**버전**: 2.1.1

