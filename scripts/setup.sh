#!/bin/bash

# MCP Cursor Server 자동 설치 및 설정 스크립트
# 사용법: ./scripts/setup.sh

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Node.js 버전 확인
check_node_version() {
    log_info "Node.js 버전 확인 중..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js가 설치되지 않았습니다."
        log_info "Node.js 18.0.0 이상을 설치해주세요:"
        log_info "  brew install node"
        log_info "  또는 https://nodejs.org/ 에서 다운로드"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    REQUIRED_VERSION="18.0.0"
    
    if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
        log_success "Node.js 버전 확인 완료: v$NODE_VERSION"
    else
        log_error "Node.js 버전이 너무 낮습니다. v$NODE_VERSION (필요: v$REQUIRED_VERSION 이상)"
        exit 1
    fi
}

# npm 버전 확인
check_npm_version() {
    log_info "npm 버전 확인 중..."
    
    if ! command -v npm &> /dev/null; then
        log_error "npm이 설치되지 않았습니다."
        exit 1
    fi
    
    NPM_VERSION=$(npm --version)
    log_success "npm 버전 확인 완료: v$NPM_VERSION"
}

# 의존성 설치
install_dependencies() {
    log_info "의존성 설치 중..."
    
    # npm 캐시 정리
    log_info "npm 캐시 정리 중..."
    npm cache clean --force
    
    # 기존 node_modules 삭제 (있는 경우)
    if [ -d "node_modules" ]; then
        log_info "기존 node_modules 삭제 중..."
        rm -rf node_modules
    fi
    
    # package-lock.json 삭제 (있는 경우)
    if [ -f "package-lock.json" ]; then
        log_info "기존 package-lock.json 삭제 중..."
        rm -f package-lock.json
    fi
    
    # 의존성 설치
    log_info "패키지 설치 중... (시간이 걸릴 수 있습니다)"
    npm install
    
    log_success "의존성 설치 완료"
}

# 환경 변수 파일 생성
setup_env_file() {
    log_info "환경 변수 파일 설정 중..."
    
    if [ ! -f ".env" ]; then
        if [ -f "env.example" ]; then
            cp env.example .env
            log_success ".env 파일이 생성되었습니다"
        else
            log_warning "env.example 파일이 없습니다. 수동으로 .env 파일을 생성해주세요."
        fi
    else
        log_info ".env 파일이 이미 존재합니다"
    fi
    
    # .env 파일 내용 확인
    if [ -f ".env" ]; then
        log_info ".env 파일 내용:"
        echo "----------------------------------------"
        cat .env
        echo "----------------------------------------"
        log_warning "필요한 API 키를 .env 파일에 설정해주세요."
    fi
}

# Cursor Editor 확인
check_cursor_editor() {
    log_info "Cursor Editor 확인 중..."
    
    if command -v cursor &> /dev/null; then
        CURSOR_VERSION=$(cursor --version 2>/dev/null || echo "unknown")
        log_success "Cursor Editor 확인 완료: $CURSOR_VERSION"
    else
        log_warning "Cursor Editor가 설치되지 않았습니다."
        log_info "https://cursor.sh/ 에서 다운로드하여 설치해주세요."
    fi
}

# 서버 테스트
test_server() {
    log_info "서버 테스트 중..."
    
    # 서버 시작 테스트
    if npm start -- --help &> /dev/null; then
        log_success "서버 시작 테스트 완료"
    else
        log_error "서버 시작 테스트 실패"
        return 1
    fi
}

# 상태 확인
check_status() {
    log_info "서버 상태 확인 중..."
    
    # 상태 확인 명령어 실행
    if npm run start status &> /dev/null; then
        log_success "상태 확인 완료"
    else
        log_warning "상태 확인 실패 (서버가 실행되지 않았을 수 있습니다)"
    fi
}

# 메인 함수
main() {
    echo "🚀 MCP Cursor Server 자동 설치 및 설정을 시작합니다..."
    echo "=================================================="
    
    # 현재 디렉토리 확인
    if [ ! -f "package.json" ]; then
        log_error "package.json 파일을 찾을 수 없습니다."
        log_error "프로젝트 루트 디렉토리에서 실행해주세요."
        exit 1
    fi
    
    # 1. Node.js 버전 확인
    check_node_version
    
    # 2. npm 버전 확인
    check_npm_version
    
    # 3. 의존성 설치
    install_dependencies
    
    # 4. 환경 변수 파일 설정
    setup_env_file
    
    # 5. Cursor Editor 확인
    check_cursor_editor
    
    # 6. 서버 테스트
    test_server
    
    # 7. 상태 확인
    check_status
    
    echo "=================================================="
    log_success "설치 및 설정이 완료되었습니다!"
    echo ""
    log_info "다음 단계:"
    echo "1. .env 파일에 필요한 API 키를 설정하세요"
    echo "2. Cursor Editor를 실행하고 API 서버를 활성화하세요"
    echo "3. npm start 명령어로 서버를 시작하세요"
    echo ""
    log_info "자세한 내용은 README.md를 참조하세요."
}

# 스크립트 실행
main "$@"

