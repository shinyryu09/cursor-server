#!/bin/bash

# MCP Cursor Server Release Script
# 자동화된 릴리스 및 태그 생성 스크립트

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 도움말 표시
show_help() {
    echo "MCP Cursor Server Release Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t, --type TYPE     Release type: patch, minor, major (default: patch)"
    echo "  -m, --message MSG   Custom release message"
    echo "  -d, --dry-run       Dry run mode (no actual changes)"
    echo "  -h, --help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --type patch --message 'Bug fixes'"
    echo "  $0 --type minor --message 'New features'"
    echo "  $0 --type major --message 'Breaking changes'"
    echo "  $0 --dry-run"
}

# 기본값 설정
RELEASE_TYPE="patch"
RELEASE_MESSAGE=""
DRY_RUN=false

# 인수 파싱
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            RELEASE_TYPE="$2"
            shift 2
            ;;
        -m|--message)
            RELEASE_MESSAGE="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# 릴리스 타입 검증
if [[ ! "$RELEASE_TYPE" =~ ^(patch|minor|major)$ ]]; then
    log_error "Invalid release type: $RELEASE_TYPE. Must be patch, minor, or major."
    exit 1
fi

# 현재 디렉토리가 Git 저장소인지 확인
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    log_error "Not a Git repository. Please run this script from the project root."
    exit 1
fi

# 작업 디렉토리가 깨끗한지 확인
if ! git diff-index --quiet HEAD --; then
    log_error "Working directory is not clean. Please commit or stash your changes."
    exit 1
fi

# 현재 브랜치가 main인지 확인
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    log_warning "Current branch is '$CURRENT_BRANCH', not 'main'. Continuing anyway..."
fi

# 현재 버전 가져오기
CURRENT_VERSION=$(npm run version:show --silent)
log_info "Current version: $CURRENT_VERSION"

# 새 버전 계산
case $RELEASE_TYPE in
    patch)
        NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$NF = $NF + 1;} 1' | sed 's/ /./g')
        ;;
    minor)
        NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$2 = $2 + 1; $3 = 0;} 1' | sed 's/ /./g')
        ;;
    major)
        NEW_VERSION=$(echo $CURRENT_VERSION | awk -F. '{$1 = $1 + 1; $2 = 0; $3 = 0;} 1' | sed 's/ /./g')
        ;;
esac

log_info "New version: $NEW_VERSION"

# 릴리스 메시지 설정
if [[ -z "$RELEASE_MESSAGE" ]]; then
    case $RELEASE_TYPE in
        patch)
            RELEASE_MESSAGE="Bug fixes and improvements"
            ;;
        minor)
            RELEASE_MESSAGE="New features and enhancements"
            ;;
        major)
            RELEASE_MESSAGE="Breaking changes and major updates"
            ;;
    esac
fi

log_info "Release message: $RELEASE_MESSAGE"

# Dry run 모드
if [[ "$DRY_RUN" == "true" ]]; then
    log_warning "DRY RUN MODE - No actual changes will be made"
    echo ""
    echo "Would perform the following actions:"
    echo "1. Update package.json version to $NEW_VERSION"
    echo "2. Generate changelog and version history"
    echo "3. Commit changes with message: 'chore: release v$NEW_VERSION'"
    echo "4. Create tag: v$NEW_VERSION"
    echo "5. Push changes and tag to origin"
    echo "6. Create GitHub release"
    exit 0
fi

# 사용자 확인
echo ""
log_warning "This will:"
echo "  - Update version from $CURRENT_VERSION to $NEW_VERSION"
echo "  - Create a new Git tag: v$NEW_VERSION"
echo "  - Push changes to origin"
echo "  - Create a GitHub release"
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_info "Release cancelled."
    exit 0
fi

# 1. 버전 업데이트
log_info "Updating version to $NEW_VERSION..."
npm version $RELEASE_TYPE --no-git-tag-version

# 2. 변경사항 생성
log_info "Generating changelog and version history..."
npm run changelog:generate
npm run version:history

# 3. 변경사항 커밋
log_info "Committing changes..."
git add package.json CHANGELOG.md VERSION_HISTORY.md
git commit -m "chore: release v$NEW_VERSION

$RELEASE_MESSAGE"

# 4. 태그 생성
log_info "Creating tag v$NEW_VERSION..."
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION

$RELEASE_MESSAGE"

# 5. 푸시
log_info "Pushing changes and tag to origin..."
git push origin main
git push origin "v$NEW_VERSION"

# 6. GitHub 릴리스 생성 (gh CLI 사용)
if command -v gh &> /dev/null; then
    log_info "Creating GitHub release..."
    
    # 릴리스 노트 생성
    RELEASE_NOTES="## 🚀 Release v$NEW_VERSION

### 📝 Changes
$RELEASE_MESSAGE

### 📚 Documentation
- [README.md](./README.md) - Getting started guide
- [VERSION_HISTORY.md](./VERSION_HISTORY.md) - Detailed version history
- [CHANGELOG.md](./CHANGELOG.md) - Change log

### 🛠️ Installation
\`\`\`bash
# Clone repository
git clone https://github.com/\$(gh repo view --json owner,name -q '.owner.login + "/" + .name').git
cd mcp-cursor-server

# Install dependencies
npm install

# Start server
npm start
\`\`\`

### 🔧 Usage
\`\`\`bash
# Start server
npm start

# Check status
node src/server.js status

# Detect projects
node src/server.js detect
\`\`\`"

    gh release create "v$NEW_VERSION" \
        --title "Release v$NEW_VERSION" \
        --notes "$RELEASE_NOTES" \
        --latest
else
    log_warning "GitHub CLI (gh) not found. Please create the release manually:"
    echo "  https://github.com/\$(git remote get-url origin | sed 's/.*github.com[:/]\([^.]*\).*/\1/')/releases/new?tag=v$NEW_VERSION"
fi

# 완료 메시지
echo ""
log_success "Release v$NEW_VERSION created successfully!"
echo ""
echo "📦 Release Details:"
echo "  Version: $NEW_VERSION"
echo "  Type: $RELEASE_TYPE"
echo "  Message: $RELEASE_MESSAGE"
echo "  Tag: v$NEW_VERSION"
echo ""
echo "🔗 Links:"
echo "  Repository: $(git remote get-url origin)"
echo "  Latest Release: $(git remote get-url origin | sed 's/\.git$//')/releases/latest"
echo ""
echo "📋 Next Steps:"
echo "  1. Verify the release on GitHub"
echo "  2. Update any dependent projects"
echo "  3. Announce the release to users"
echo ""
