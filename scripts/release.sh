#!/bin/bash

# MCP Cursor Server Release Script
# Usage: ./scripts/release.sh <version> [type]
# Example: ./scripts/release.sh 2.1.0 minor

set -e

VERSION=$1
TYPE=${2:-patch}

if [ -z "$VERSION" ]; then
    echo "❌ Usage: ./scripts/release.sh <version> [type]"
    echo "   Example: ./scripts/release.sh 2.1.0 minor"
    exit 1
fi

echo "🚀 Starting release process for v$VERSION..."

# 현재 브랜치 확인
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "develop" ]; then
    echo "⚠️  Warning: You are not on develop branch (current: $CURRENT_BRANCH)"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 최신 develop 브랜치로 업데이트
echo "📥 Updating develop branch..."
git checkout develop
git pull origin develop

# 릴리즈 브랜치 생성
RELEASE_BRANCH="release/v$VERSION"
echo "🌿 Creating release branch: $RELEASE_BRANCH"
git checkout -b $RELEASE_BRANCH

# 버전 업데이트
echo "📦 Updating version to v$VERSION..."
npm version $VERSION --no-git-tag-version

# CHANGELOG 생성
echo "📝 Generating changelog..."
npm run version:changelog

# 변경사항 커밋
echo "💾 Committing release preparation..."
git add .
git commit -m "chore(release): prepare v$VERSION

- Update version to $VERSION
- Generate changelog
- Update documentation"

# main 브랜치로 머지
echo "🔄 Merging to main branch..."
git checkout main
git pull origin main
git merge --no-ff $RELEASE_BRANCH -m "chore(release): merge release/v$VERSION to main"

# 태그 생성
echo "🏷️  Creating tag v$VERSION..."
git tag -a v$VERSION -m "Release version $VERSION

$(npm run version:changelog --silent | head -20)"

# main 브랜치 푸시
echo "📤 Pushing main branch and tag..."
git push origin main
git push origin v$VERSION

# develop 브랜치로 머지
echo "🔄 Merging back to develop..."
git checkout develop
git merge --no-ff $RELEASE_BRANCH -m "chore(release): merge release/v$VERSION to develop"
git push origin develop

# 릴리즈 브랜치 삭제
echo "🧹 Cleaning up release branch..."
git branch -d $RELEASE_BRANCH
git push origin --delete $RELEASE_BRANCH 2>/dev/null || true

# GitHub Release 생성 (gh CLI가 있는 경우)
if command -v gh &> /dev/null; then
    echo "📋 Creating GitHub release..."
    gh release create v$VERSION \
        --title "Release v$VERSION" \
        --notes "$(npm run version:changelog --silent)" \
        --latest
else
    echo "ℹ️  GitHub CLI not found. Please create release manually at:"
    echo "   https://github.com/shinyryu09/cursor-server/releases/new"
fi

echo "✅ Release v$VERSION completed successfully!"
echo ""
echo "📋 Summary:"
echo "   - Version: v$VERSION"
echo "   - Branch: $RELEASE_BRANCH (deleted)"
echo "   - Tag: v$VERSION"
echo "   - Main branch: updated"
echo "   - Develop branch: updated"
echo ""
echo "🔗 Links:"
echo "   - Repository: https://github.com/shinyryu09/cursor-server"
echo "   - Releases: https://github.com/shinyryu09/cursor-server/releases"
echo "   - Latest: https://github.com/shinyryu09/cursor-server/releases/tag/v$VERSION"
