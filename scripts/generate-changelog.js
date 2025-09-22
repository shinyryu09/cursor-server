#!/usr/bin/env node

/**
 * 자동 변경 로그 생성 스크립트
 * Git 커밋 히스토리를 기반으로 CHANGELOG.md와 VERSION_HISTORY.md를 자동 생성
 */

import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

// 색상 정의
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`)
};

/**
 * Git 커밋 히스토리 가져오기
 */
function getGitHistory() {
  try {
    const gitLog = execSync('git log --oneline --decorate --graph', { encoding: 'utf8' });
    return gitLog.split('\n').filter(line => line.trim());
  } catch (error) {
    log.error('Git 히스토리를 가져올 수 없습니다:', error.message);
    return [];
  }
}

/**
 * 최근 태그 가져오기
 */
function getLatestTag() {
  try {
    const latestTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
    return latestTag;
  } catch (error) {
    log.warning('태그를 찾을 수 없습니다. 첫 번째 릴리스로 간주합니다.');
    return null;
  }
}

/**
 * 태그 간 커밋 가져오기
 */
function getCommitsSinceTag(tag) {
  try {
    const range = tag ? `${tag}..HEAD` : 'HEAD';
    const commits = execSync(`git log ${range} --oneline --no-merges`, { encoding: 'utf8' });
    return commits.split('\n').filter(line => line.trim());
  } catch (error) {
    log.error('커밋을 가져올 수 없습니다:', error.message);
    return [];
  }
}

/**
 * 패키지 버전 가져오기
 */
function getPackageVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    return packageJson.version;
  } catch (error) {
    log.error('package.json을 읽을 수 없습니다:', error.message);
    return '0.0.0';
  }
}

/**
 * 커밋 메시지 파싱
 */
function parseCommit(commitLine) {
  const match = commitLine.match(/^([a-f0-9]+)\s+(.+)$/);
  if (!match) return null;

  const [, hash, message] = match;
  
  // Conventional Commits 파싱
  const conventionalMatch = message.match(/^(\w+)(\(.+\))?:\s*(.+)$/);
  if (conventionalMatch) {
    const [, type, scope, description] = conventionalMatch;
    return {
      hash: hash.substring(0, 7),
      type: type.toLowerCase(),
      scope: scope ? scope.replace(/[()]/g, '') : null,
      description: description.trim(),
      fullMessage: message
    };
  }

  return {
    hash: hash.substring(0, 7),
    type: 'other',
    scope: null,
    description: message,
    fullMessage: message
  };
}

/**
 * 커밋 타입별 분류
 */
function categorizeCommits(commits) {
  const categories = {
    feat: [],
    fix: [],
    docs: [],
    style: [],
    refactor: [],
    test: [],
    chore: [],
    ci: [],
    build: [],
    perf: [],
    revert: [],
    other: []
  };

  commits.forEach(commit => {
    if (commit && categories[commit.type]) {
      categories[commit.type].push(commit);
    } else {
      categories.other.push(commit);
    }
  });

  return categories;
}

/**
 * CHANGELOG.md 생성
 */
function generateChangelog(currentVersion, categorizedCommits, latestTag) {
  const today = new Date().toISOString().split('T')[0];
  
  let changelog = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

`;

  // 현재 버전 섹션 추가
  changelog += `## [${currentVersion}] - ${today}

`;

  // 변경사항 추가
  if (categorizedCommits.feat.length > 0) {
    changelog += `### Added\n`;
    categorizedCommits.feat.forEach(commit => {
      changelog += `- ${commit.description} (${commit.hash})\n`;
    });
    changelog += `\n`;
  }

  if (categorizedCommits.fix.length > 0) {
    changelog += `### Fixed\n`;
    categorizedCommits.fix.forEach(commit => {
      changelog += `- ${commit.description} (${commit.hash})\n`;
    });
    changelog += `\n`;
  }

  if (categorizedCommits.docs.length > 0) {
    changelog += `### Documentation\n`;
    categorizedCommits.docs.forEach(commit => {
      changelog += `- ${commit.description} (${commit.hash})\n`;
    });
    changelog += `\n`;
  }

  if (categorizedCommits.refactor.length > 0) {
    changelog += `### Changed\n`;
    categorizedCommits.refactor.forEach(commit => {
      changelog += `- ${commit.description} (${commit.hash})\n`;
    });
    changelog += `\n`;
  }

  if (categorizedCommits.perf.length > 0) {
    changelog += `### Performance\n`;
    categorizedCommits.perf.forEach(commit => {
      changelog += `- ${commit.description} (${commit.hash})\n`;
    });
    changelog += `\n`;
  }

  if (categorizedCommits.ci.length > 0 || categorizedCommits.build.length > 0) {
    changelog += `### CI/CD\n`;
    [...categorizedCommits.ci, ...categorizedCommits.build].forEach(commit => {
      changelog += `- ${commit.description} (${commit.hash})\n`;
    });
    changelog += `\n`;
  }

  if (categorizedCommits.other.length > 0) {
    changelog += `### Other\n`;
    categorizedCommits.other.forEach(commit => {
      changelog += `- ${commit.description} (${commit.hash})\n`;
    });
    changelog += `\n`;
  }

  return changelog;
}

/**
 * VERSION_HISTORY.md 생성
 */
function generateVersionHistory(currentVersion, categorizedCommits, latestTag) {
  const today = new Date().toISOString().split('T')[0];
  
  let history = `# Version History

이 문서는 MCP Cursor Server의 상세한 버전별 변경사항과 마이그레이션 가이드를 제공합니다.

## [${currentVersion}] - ${today}

### 🚀 주요 변경사항
`;

  // 주요 변경사항 요약
  const majorChanges = [];
  if (categorizedCommits.feat.length > 0) {
    majorChanges.push(`**새로운 기능 ${categorizedCommits.feat.length}개 추가**`);
  }
  if (categorizedCommits.fix.length > 0) {
    majorChanges.push(`**버그 수정 ${categorizedCommits.fix.length}개**`);
  }
  if (categorizedCommits.perf.length > 0) {
    majorChanges.push(`**성능 개선 ${categorizedCommits.perf.length}개**`);
  }
  if (categorizedCommits.refactor.length > 0) {
    majorChanges.push(`**리팩토링 ${categorizedCommits.refactor.length}개**`);
  }

  if (majorChanges.length > 0) {
    history += majorChanges.join(', ') + '\n\n';
  } else {
    history += `**기타 변경사항 및 개선사항**\n\n`;
  }

  // 상세 변경사항
  history += `### ✨ 새로운 기능\n`;
  if (categorizedCommits.feat.length > 0) {
    categorizedCommits.feat.forEach(commit => {
      history += `- ${commit.description}\n`;
    });
  } else {
    history += `- 없음\n`;
  }

  history += `\n### 🐛 버그 수정\n`;
  if (categorizedCommits.fix.length > 0) {
    categorizedCommits.fix.forEach(commit => {
      history += `- ${commit.description}\n`;
    });
  } else {
    history += `- 없음\n`;
  }

  history += `\n### ⚡ 성능 개선\n`;
  if (categorizedCommits.perf.length > 0) {
    categorizedCommits.perf.forEach(commit => {
      history += `- ${commit.description}\n`;
    });
  } else {
    history += `- 없음\n`;
  }

  history += `\n### 🔧 기술적 변경사항\n`;
  const technicalChanges = [
    ...categorizedCommits.refactor,
    ...categorizedCommits.ci,
    ...categorizedCommits.build,
    ...categorizedCommits.chore
  ];
  
  if (technicalChanges.length > 0) {
    technicalChanges.forEach(commit => {
      history += `- ${commit.description}\n`;
    });
  } else {
    history += `- 없음\n`;
  }

  history += `\n### 📋 마이그레이션 가이드\n`;
  history += `기존 사용자는 추가 마이그레이션 작업이 필요하지 않습니다.\n\n`;

  history += `### 🎯 사용법\n`;
  history += `\`\`\`bash\n`;
  history += `# 서버 시작\n`;
  history += `npm start\n\n`;
  history += `# 상태 확인\n`;
  history += `node src/server.js status\n\n`;
  history += `# 프로젝트 감지\n`;
  history += `node src/server.js detect\n`;
  history += `\`\`\`\n\n`;

  // 통계 정보
  const totalCommits = Object.values(categorizedCommits).flat().length;
  history += `### 📊 변경 통계\n`;
  history += `- 총 커밋 수: ${totalCommits}\n`;
  history += `- 새로운 기능: ${categorizedCommits.feat.length}\n`;
  history += `- 버그 수정: ${categorizedCommits.fix.length}\n`;
  history += `- 성능 개선: ${categorizedCommits.perf.length}\n`;
  history += `- 리팩토링: ${categorizedCommits.refactor.length}\n`;
  history += `- 문서화: ${categorizedCommits.docs.length}\n`;
  history += `- 기타: ${categorizedCommits.other.length}\n\n`;

  history += `---\n\n`;

  return history;
}

/**
 * 메인 함수
 */
async function main() {
  try {
    log.info('변경 로그 생성 시작...');

    // 현재 버전 가져오기
    const currentVersion = getPackageVersion();
    log.info(`현재 버전: ${currentVersion}`);

    // 최근 태그 가져오기
    const latestTag = getLatestTag();
    log.info(`최근 태그: ${latestTag || '없음'}`);

    // 태그 이후 커밋 가져오기
    const commits = getCommitsSinceTag(latestTag);
    log.info(`분석할 커밋 수: ${commits.length}`);

    if (commits.length === 0) {
      log.warning('새로운 커밋이 없습니다.');
      return;
    }

    // 커밋 파싱 및 분류
    const parsedCommits = commits.map(parseCommit).filter(Boolean);
    const categorizedCommits = categorizeCommits(parsedCommits);

    // CHANGELOG.md 생성
    const changelog = generateChangelog(currentVersion, categorizedCommits, latestTag);
    await fs.writeFile('CHANGELOG.md', changelog, 'utf8');
    log.success('CHANGELOG.md 생성 완료');

    // VERSION_HISTORY.md 생성
    const versionHistory = generateVersionHistory(currentVersion, categorizedCommits, latestTag);
    await fs.writeFile('VERSION_HISTORY.md', versionHistory, 'utf8');
    log.success('VERSION_HISTORY.md 생성 완료');

    // 통계 출력
    console.log('\n📊 생성된 변경사항:');
    Object.entries(categorizedCommits).forEach(([type, commits]) => {
      if (commits.length > 0) {
        console.log(`  ${type}: ${commits.length}개`);
      }
    });

    log.success('변경 로그 생성 완료!');

  } catch (error) {
    log.error('변경 로그 생성 실패:', error.message);
    process.exit(1);
  }
}

// 스크립트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
