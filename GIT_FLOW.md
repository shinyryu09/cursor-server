# Git Flow 정책

## 📋 개요

이 문서는 MCP Cursor Server 프로젝트의 Git Flow 정책을 정의합니다. 체계적인 브랜치 관리와 배포 프로세스를 통해 안정적인 개발 환경을 구축합니다.

## 🌳 브랜치 구조

### 메인 브랜치
- **`main`**: 프로덕션 배포용 브랜치 (안정화된 코드)
- **`develop`**: 개발 통합 브랜치 (다음 릴리즈를 위한 통합)

### 보조 브랜치
- **`feature/*`**: 새로운 기능 개발
- **`release/*`**: 릴리즈 준비 및 배포
- **`hotfix/*`**: 프로덕션 긴급 수정
- **`bugfix/*`**: 버그 수정

## 🔄 브랜치 전략

### 1. Feature 브랜치
```bash
# 새 기능 개발 시작
git checkout develop
git pull origin develop
git checkout -b feature/새기능명

# 개발 완료 후
git checkout develop
git merge --no-ff feature/새기능명
git branch -d feature/새기능명
git push origin develop
```

### 2. Release 브랜치
```bash
# 릴리즈 준비
git checkout develop
git checkout -b release/v2.1.0

# 릴리즈 완료 후
git checkout main
git merge --no-ff release/v2.1.0
git tag -a v2.1.0 -m "Release version 2.1.0"
git checkout develop
git merge --no-ff release/v2.1.0
git branch -d release/v2.1.0
```

### 3. Hotfix 브랜치
```bash
# 긴급 수정
git checkout main
git checkout -b hotfix/긴급수정명

# 수정 완료 후
git checkout main
git merge --no-ff hotfix/긴급수정명
git tag -a v2.0.1 -m "Hotfix version 2.0.1"
git checkout develop
git merge --no-ff hotfix/긴급수정명
git branch -d hotfix/긴급수정명
```

## 📝 커밋 메시지 규칙

### 형식
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 종류
- **feat**: 새로운 기능
- **fix**: 버그 수정
- **docs**: 문서 수정
- **style**: 코드 스타일 변경
- **refactor**: 코드 리팩토링
- **test**: 테스트 추가/수정
- **chore**: 빌드/설정 변경

### 예시
```
feat(chat): Add chat history management

- Implement ChatHistoryService for session management
- Add API endpoints for chat history CRUD operations
- Add CLI commands for chat history management

Closes #123
```

## 🏷️ 태그 규칙

### 버전 태그
- **형식**: `v{major}.{minor}.{patch}`
- **예시**: `v2.1.0`, `v2.0.1`, `v1.5.3`

### 태그 생성
```bash
# 버전 태그 생성
git tag -a v2.1.0 -m "Release version 2.1.0"

# 태그 푸시
git push origin v2.1.0

# 모든 태그 푸시
git push origin --tags
```

## 🚀 배포 프로세스

### 1. 개발 단계
```bash
# 기능 개발
git checkout -b feature/새기능
# ... 개발 작업 ...
git commit -m "feat(새기능): 기능 구현"
git push origin feature/새기능
```

### 2. 통합 단계
```bash
# develop 브랜치로 머지
git checkout develop
git merge --no-ff feature/새기능
git push origin develop
```

### 3. 릴리즈 단계
```bash
# 릴리즈 브랜치 생성
git checkout -b release/v2.1.0
# ... 릴리즈 준비 작업 ...
git commit -m "chore(release): prepare v2.1.0"

# main 브랜치로 머지
git checkout main
git merge --no-ff release/v2.1.0
git tag -a v2.1.0 -m "Release version 2.1.0"
git push origin main
git push origin v2.1.0

# develop 브랜치로 머지
git checkout develop
git merge --no-ff release/v2.1.0
git push origin develop
```

## 📋 체크리스트

### 개발 시작 전
- [ ] 최신 develop 브랜치에서 시작
- [ ] 적절한 브랜치명 사용
- [ ] 이슈 번호 확인

### 커밋 전
- [ ] 코드 스타일 확인
- [ ] 테스트 실행
- [ ] 커밋 메시지 규칙 준수

### 머지 전
- [ ] 코드 리뷰 완료
- [ ] 충돌 해결
- [ ] 테스트 통과

### 릴리즈 전
- [ ] 버전 번호 업데이트
- [ ] CHANGELOG.md 업데이트
- [ ] 문서 업데이트
- [ ] 태그 생성

## 🔧 자동화 스크립트

### 릴리즈 자동화
```bash
#!/bin/bash
# scripts/release.sh

VERSION=$1
if [ -z "$VERSION" ]; then
    echo "Usage: ./scripts/release.sh <version>"
    exit 1
fi

# 릴리즈 브랜치 생성
git checkout develop
git pull origin develop
git checkout -b release/v$VERSION

# 버전 업데이트
npm version $VERSION --no-git-tag-version

# CHANGELOG 생성
npm run version:changelog

# 커밋
git add .
git commit -m "chore(release): prepare v$VERSION"

# main으로 머지
git checkout main
git pull origin main
git merge --no-ff release/v$VERSION

# 태그 생성
git tag -a v$VERSION -m "Release version $VERSION"

# 푸시
git push origin main
git push origin v$VERSION

# develop으로 머지
git checkout develop
git merge --no-ff release/v$VERSION
git push origin develop

# 릴리즈 브랜치 삭제
git branch -d release/v$VERSION
git push origin --delete release/v$VERSION

echo "Release v$VERSION completed!"
```

## 📊 브랜치 보호 규칙

### main 브랜치
- 직접 푸시 금지
- Pull Request 필수
- 코드 리뷰 필수
- 상태 체크 통과 필수

### develop 브랜치
- 직접 푸시 허용 (개발자)
- Pull Request 권장
- 자동 테스트 실행

## 🚨 긴급 상황 대응

### Hotfix 프로세스
1. main 브랜치에서 hotfix 브랜치 생성
2. 긴급 수정 작업
3. main 브랜치로 머지 및 태그 생성
4. develop 브랜치로 머지
5. 배포 및 모니터링

### 롤백 프로세스
```bash
# 특정 태그로 롤백
git checkout v2.0.0
git checkout -b hotfix/rollback-v2.0.0
# ... 롤백 작업 ...
git checkout main
git merge --no-ff hotfix/rollback-v2.0.0
git tag -a v2.0.1 -m "Rollback to v2.0.0"
```

## 📚 참고 자료

- [Git Flow 공식 문서](https://nvie.com/posts/a-successful-git-branching-model/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Semantic Versioning](https://semver.org/)

## 🔄 정책 업데이트

이 정책은 프로젝트 요구사항에 따라 지속적으로 업데이트됩니다. 변경사항은 팀원들과 논의 후 적용됩니다.

---

**마지막 업데이트**: 2025-01-23
**버전**: 1.0.0
