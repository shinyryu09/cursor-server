# Git Flow 정책

이 문서는 MCP Cursor Server 프로젝트의 Git Flow 브랜치 전략과 워크플로우를 정의합니다.

## 🌿 브랜치 전략

### 메인 브랜치

#### `main` 브랜치
- **목적**: 프로덕션 배포 가능한 안정적인 코드
- **보호**: 직접 푸시 불가, PR을 통해서만 병합
- **배포**: 자동 배포 트리거
- **태그**: 모든 릴리스는 이 브랜치에서 태그 생성

#### `develop` 브랜치
- **목적**: 다음 릴리스를 위한 개발 통합 브랜치
- **보호**: 직접 푸시 불가, PR을 통해서만 병합
- **병합**: feature 브랜치들이 병합되는 곳
- **배포**: 개발 환경 자동 배포

### 지원 브랜치

#### `feature/*` 브랜치
- **명명 규칙**: `feature/기능명` 또는 `feature/이슈번호-기능명`
- **생성**: `develop` 브랜치에서 생성
- **병합**: `develop` 브랜치로 병합
- **삭제**: 병합 후 삭제

**예시:**
```bash
# 새 기능 브랜치 생성
git checkout develop
git pull origin develop
git checkout -b feature/chat-history

# 개발 완료 후 병합
git checkout develop
git merge --no-ff feature/chat-history
git push origin develop
git branch -d feature/chat-history
```

#### `release/*` 브랜치
- **명명 규칙**: `release/버전번호`
- **생성**: `develop` 브랜치에서 생성
- **목적**: 릴리스 준비 (버그 수정, 문서 업데이트)
- **병합**: `main`과 `develop` 브랜치로 병합

**예시:**
```bash
# 릴리스 브랜치 생성
git checkout develop
git checkout -b release/2.1.0

# 릴리스 준비 (버그 수정, 문서 업데이트)
# ...

# main으로 병합
git checkout main
git merge --no-ff release/2.1.0
git tag -a v2.1.0 -m "Release version 2.1.0"

# develop으로 병합
git checkout develop
git merge --no-ff release/2.1.0

# 브랜치 삭제
git branch -d release/2.1.0
```

#### `hotfix/*` 브랜치
- **명명 규칙**: `hotfix/버전번호` 또는 `hotfix/이슈번호`
- **생성**: `main` 브랜치에서 생성
- **목적**: 프로덕션 긴급 버그 수정
- **병합**: `main`과 `develop` 브랜치로 병합

**예시:**
```bash
# 핫픽스 브랜치 생성
git checkout main
git checkout -b hotfix/2.0.1

# 버그 수정
# ...

# main으로 병합
git checkout main
git merge --no-ff hotfix/2.0.1
git tag -a v2.0.1 -m "Hotfix version 2.0.1"

# develop으로 병합
git checkout develop
git merge --no-ff hotfix/2.0.1

# 브랜치 삭제
git branch -d hotfix/2.0.1
```

## 📝 커밋 메시지 규칙

### Conventional Commits 사용

커밋 메시지는 [Conventional Commits](https://www.conventionalcommits.org/) 규칙을 따릅니다.

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### 타입 (Type)

- **feat**: 새로운 기능 추가
- **fix**: 버그 수정
- **docs**: 문서 변경
- **style**: 코드 포맷팅, 세미콜론 누락 등 (기능 변경 없음)
- **refactor**: 코드 리팩토링
- **test**: 테스트 추가 또는 수정
- **chore**: 빌드 프로세스, 보조 도구 변경
- **ci**: CI/CD 설정 변경
- **build**: 빌드 시스템 변경
- **perf**: 성능 개선
- **revert**: 이전 커밋 되돌리기

### 스코프 (Scope)

선택사항으로, 변경사항의 범위를 나타냅니다.

- **server**: 서버 관련 변경
- **client**: 클라이언트 관련 변경
- **api**: API 관련 변경
- **config**: 설정 관련 변경
- **docs**: 문서 관련 변경
- **test**: 테스트 관련 변경

### 예시

```bash
# 기능 추가
git commit -m "feat(api): add chat history management endpoints"

# 버그 수정
git commit -m "fix(server): resolve memory leak in streaming responses"

# 문서 업데이트
git commit -m "docs: update installation guide for macOS"

# 리팩토링
git commit -m "refactor(services): improve error handling in AI service"

# 성능 개선
git commit -m "perf(server): optimize response streaming performance"

# CI/CD 변경
git commit -m "ci: add automated release workflow"
```

## 🚀 릴리스 프로세스

### 1. 릴리스 준비

#### 자동 릴리스 (권장)
```bash
# 패치 릴리스 (버그 수정)
./scripts/release.sh --type patch --message "Bug fixes and improvements"

# 마이너 릴리스 (새 기능)
./scripts/release.sh --type minor --message "New features and enhancements"

# 메이저 릴리스 (호환성 없는 변경)
./scripts/release.sh --type major --message "Breaking changes and major updates"
```

#### 수동 릴리스
```bash
# 1. 릴리스 브랜치 생성
git checkout develop
git checkout -b release/2.1.0

# 2. 버전 업데이트
npm version minor --no-git-tag-version

# 3. 변경 로그 생성
npm run changelog:generate

# 4. 커밋
git add .
git commit -m "chore: prepare release v2.1.0"

# 5. main으로 병합
git checkout main
git merge --no-ff release/2.1.0
git tag -a v2.1.0 -m "Release version 2.1.0"

# 6. develop으로 병합
git checkout develop
git merge --no-ff release/2.1.0

# 7. 푸시
git push origin main develop --tags

# 8. 브랜치 삭제
git branch -d release/2.1.0
```

### 2. GitHub 릴리스

릴리스 스크립트가 자동으로 GitHub 릴리스를 생성합니다:

- 릴리스 노트 자동 생성
- 변경 로그 포함
- 설치 및 사용법 가이드
- 릴리스 아티팩트 업로드

### 3. 배포 확인

```bash
# 릴리스 확인
git tag --list

# 최신 릴리스 확인
git describe --tags --abbrev=0

# 릴리스 노트 확인
gh release view v2.1.0
```

## 🔄 워크플로우

### 개발 워크플로우

1. **이슈 생성**: GitHub Issues에서 작업할 이슈 생성
2. **브랜치 생성**: `develop`에서 `feature/이슈번호-기능명` 브랜치 생성
3. **개발**: 기능 개발 및 테스트
4. **PR 생성**: `develop` 브랜치로 Pull Request 생성
5. **코드 리뷰**: 팀원들의 코드 리뷰
6. **병합**: 승인 후 `develop`으로 병합
7. **브랜치 삭제**: 병합 후 feature 브랜치 삭제

### 릴리스 워크플로우

1. **릴리스 계획**: 다음 릴리스에 포함할 기능들 결정
2. **릴리스 브랜치**: `develop`에서 `release/버전번호` 브랜치 생성
3. **릴리스 준비**: 버그 수정, 문서 업데이트, 버전 업데이트
4. **테스트**: 릴리스 브랜치에서 충분한 테스트
5. **병합**: `main`과 `develop`으로 병합
6. **태그 생성**: 릴리스 태그 생성
7. **배포**: 자동 배포 트리거
8. **문서화**: 릴리스 노트 작성

### 핫픽스 워크플로우

1. **긴급 이슈**: 프로덕션에서 발견된 긴급 버그
2. **핫픽스 브랜치**: `main`에서 `hotfix/버전번호` 브랜치 생성
3. **버그 수정**: 최소한의 변경으로 버그 수정
4. **테스트**: 핫픽스 브랜치에서 테스트
5. **병합**: `main`과 `develop`으로 병합
6. **태그 생성**: 패치 버전 태그 생성
7. **배포**: 긴급 배포

## 🛡️ 브랜치 보호 규칙

### main 브랜치
- **직접 푸시**: 금지
- **PR 필수**: 모든 변경사항은 PR을 통해
- **리뷰 필수**: 최소 1명의 승인 필요
- **상태 확인**: CI/CD 통과 필수
- **최신 상태**: base 브랜치와 동기화 필수

### develop 브랜치
- **직접 푸시**: 금지
- **PR 필수**: 모든 변경사항은 PR을 통해
- **리뷰 권장**: 코드 품질을 위한 리뷰 권장
- **상태 확인**: CI/CD 통과 필수

## 📊 브랜치 상태 모니터링

### 브랜치 정리
```bash
# 로컬 브랜치 정리
git branch --merged | grep -v "\*\|main\|develop" | xargs -n 1 git branch -d

# 원격 브랜치 정리
git remote prune origin
```

### 브랜치 상태 확인
```bash
# 브랜치 목록
git branch -a

# 최근 커밋 확인
git log --oneline --graph --all

# 브랜치별 커밋 수
git rev-list --count main
git rev-list --count develop
```

## 🔧 도구 및 스크립트

### 자동화 스크립트

- **`scripts/release.sh`**: 자동 릴리스 생성
- **`scripts/generate-changelog.js`**: 변경 로그 자동 생성
- **`scripts/version-info.js`**: 버전 정보 표시

### Git Hooks

프로젝트 루트에 `.git/hooks/` 디렉토리에 다음 훅들을 설정할 수 있습니다:

- **pre-commit**: 커밋 전 린팅 및 테스트 실행
- **commit-msg**: 커밋 메시지 형식 검증
- **pre-push**: 푸시 전 테스트 실행

## 📚 참고 자료

- [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [GitHub Branch Protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)

## ❓ FAQ

### Q: feature 브랜치를 develop에 병합할 때 --no-ff를 사용하는 이유는?
A: `--no-ff` 옵션을 사용하면 병합 커밋이 생성되어 브랜치의 히스토리가 명확하게 보존됩니다.

### Q: release 브랜치에서 어떤 작업을 하나요?
A: 릴리스 준비 작업(버그 수정, 문서 업데이트, 버전 업데이트)을 수행합니다. 새로운 기능은 추가하지 않습니다.

### Q: hotfix 브랜치는 언제 사용하나요?
A: 프로덕션에서 발견된 긴급 버그를 수정할 때 사용합니다. develop 브랜치를 거치지 않고 main에서 직접 생성합니다.

### Q: 브랜치 이름에 특별한 규칙이 있나요?
A: 네, 각 브랜치 타입별로 명명 규칙이 있습니다:
- feature: `feature/기능명`
- release: `release/버전번호`
- hotfix: `hotfix/버전번호`

### Q: 커밋 메시지는 왜 중요하나요?
A: 커밋 메시지는 프로젝트의 변경 히스토리를 추적하고, 자동화된 도구들이 릴리스 노트를 생성하는 데 사용됩니다.

