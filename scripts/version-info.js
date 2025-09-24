#!/usr/bin/env node

/**
 * 버전 정보 생성 스크립트
 * 현재 버전, Git 정보, 빌드 정보 등을 종합적으로 표시
 */

import { execSync } from 'child_process';
import { promises as fs } from 'fs';

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
 * Git 정보 가져오기
 */
function getGitInfo() {
  try {
    const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    const commit = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    const shortCommit = commit.substring(0, 7);
    const commitDate = execSync('git log -1 --format=%ci', { encoding: 'utf8' }).trim();
    const commitMessage = execSync('git log -1 --format=%s', { encoding: 'utf8' }).trim();
    const author = execSync('git log -1 --format=%an', { encoding: 'utf8' }).trim();
    
    // 원격 저장소 정보
    let remoteUrl = '';
    try {
      remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    } catch (error) {
      remoteUrl = 'No remote repository';
    }

    // 태그 정보
    let latestTag = '';
    try {
      latestTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
    } catch (error) {
      latestTag = 'No tags found';
    }

    // 변경사항 상태
    const hasChanges = execSync('git status --porcelain', { encoding: 'utf8' }).trim() !== '';
    const status = hasChanges ? 'Modified' : 'Clean';

    return {
      branch,
      commit,
      shortCommit,
      commitDate,
      commitMessage,
      author,
      remoteUrl,
      latestTag,
      status,
      hasChanges
    };
  } catch (error) {
    log.error('Git 정보를 가져올 수 없습니다:', error.message);
    return null;
  }
}

/**
 * 패키지 정보 가져오기
 */
function getPackageInfo() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    return {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      author: packageJson.author,
      license: packageJson.license,
      engines: packageJson.engines,
      keywords: packageJson.keywords
    };
  } catch (error) {
    log.error('package.json을 읽을 수 없습니다:', error.message);
    return null;
  }
}

/**
 * 시스템 정보 가져오기
 */
function getSystemInfo() {
  try {
    const nodeVersion = process.version;
    const platform = process.platform;
    const arch = process.arch;
    const uptime = process.uptime();
    
    // Node.js 메모리 사용량
    const memoryUsage = process.memoryUsage();
    
    return {
      nodeVersion,
      platform,
      arch,
      uptime,
      memoryUsage
    };
  } catch (error) {
    log.error('시스템 정보를 가져올 수 없습니다:', error.message);
    return null;
  }
}

/**
 * 빌드 정보 가져오기
 */
function getBuildInfo() {
  try {
    const buildTime = new Date().toISOString();
    const buildDate = new Date().toLocaleDateString('ko-KR');
    const buildTimeLocal = new Date().toLocaleString('ko-KR');
    
    return {
      buildTime,
      buildDate,
      buildTimeLocal
    };
  } catch (error) {
    log.error('빌드 정보를 가져올 수 없습니다:', error.message);
    return null;
  }
}

/**
 * 버전 정보 포맷팅
 */
function formatVersionInfo(packageInfo, gitInfo, systemInfo, buildInfo) {
  let output = '';

  // 헤더
  output += `${colors.cyan}╔══════════════════════════════════════════════════════════════╗${colors.reset}\n`;
  output += `${colors.cyan}║                    MCP Cursor Server                        ║${colors.reset}\n`;
  output += `${colors.cyan}║                    Version Information                      ║${colors.reset}\n`;
  output += `${colors.cyan}╚══════════════════════════════════════════════════════════════╝${colors.reset}\n\n`;

  // 패키지 정보
  if (packageInfo) {
    output += `${colors.yellow}📦 Package Information${colors.reset}\n`;
    output += `  Name: ${packageInfo.name}\n`;
    output += `  Version: ${colors.green}${packageInfo.version}${colors.reset}\n`;
    output += `  Description: ${packageInfo.description}\n`;
    output += `  Author: ${packageInfo.author}\n`;
    output += `  License: ${packageInfo.license}\n`;
    if (packageInfo.engines) {
      output += `  Node.js: ${packageInfo.engines.node}\n`;
    }
    output += `\n`;
  }

  // Git 정보
  if (gitInfo) {
    output += `${colors.blue}🔧 Git Information${colors.reset}\n`;
    output += `  Branch: ${gitInfo.branch}\n`;
    output += `  Commit: ${gitInfo.shortCommit} (${gitInfo.commit})\n`;
    output += `  Date: ${gitInfo.commitDate}\n`;
    output += `  Message: ${gitInfo.commitMessage}\n`;
    output += `  Author: ${gitInfo.author}\n`;
    output += `  Latest Tag: ${gitInfo.latestTag}\n`;
    output += `  Status: ${gitInfo.hasChanges ? colors.red + gitInfo.status + colors.reset : colors.green + gitInfo.status + colors.reset}\n`;
    output += `  Remote: ${gitInfo.remoteUrl}\n`;
    output += `\n`;
  }

  // 시스템 정보
  if (systemInfo) {
    output += `${colors.magenta}💻 System Information${colors.reset}\n`;
    output += `  Node.js: ${systemInfo.nodeVersion}\n`;
    output += `  Platform: ${systemInfo.platform}\n`;
    output += `  Architecture: ${systemInfo.arch}\n`;
    output += `  Uptime: ${Math.floor(systemInfo.uptime / 60)} minutes\n`;
    output += `  Memory Usage:\n`;
    output += `    RSS: ${Math.round(systemInfo.memoryUsage.rss / 1024 / 1024)} MB\n`;
    output += `    Heap Used: ${Math.round(systemInfo.memoryUsage.heapUsed / 1024 / 1024)} MB\n`;
    output += `    Heap Total: ${Math.round(systemInfo.memoryUsage.heapTotal / 1024 / 1024)} MB\n`;
    output += `\n`;
  }

  // 빌드 정보
  if (buildInfo) {
    output += `${colors.green}🏗️  Build Information${colors.reset}\n`;
    output += `  Build Time: ${buildInfo.buildTime}\n`;
    output += `  Build Date: ${buildInfo.buildDate}\n`;
    output += `  Build Time (Local): ${buildInfo.buildTimeLocal}\n`;
    output += `\n`;
  }

  // 사용 가능한 명령어
  output += `${colors.yellow}🚀 Available Commands${colors.reset}\n`;
  output += `  npm start                    - Start the server\n`;
  output += `  npm run dev                  - Start in development mode\n`;
  output += `  npm test                     - Run tests\n`;
  output += `  npm run lint                 - Run linting\n`;
  output += `  npm run format               - Format code\n`;
  output += `  npm run version:patch        - Increment patch version\n`;
  output += `  npm run version:minor        - Increment minor version\n`;
  output += `  npm run version:major        - Increment major version\n`;
  output += `  npm run git:push             - Auto push with patch version\n`;
  output += `  npm run git:push:minor       - Auto push with minor version\n`;
  output += `  npm run git:push:major       - Auto push with major version\n`;
  output += `  ./scripts/release.sh         - Create release\n`;
  output += `\n`;

  // 링크
  output += `${colors.cyan}🔗 Links${colors.reset}\n`;
  if (gitInfo && gitInfo.remoteUrl) {
    const repoUrl = gitInfo.remoteUrl.replace('.git', '');
    output += `  Repository: ${repoUrl}\n`;
    output += `  Issues: ${repoUrl}/issues\n`;
    output += `  Releases: ${repoUrl}/releases\n`;
  }
  output += `  Documentation: README.md\n`;
  output += `  Changelog: CHANGELOG.md\n`;
  output += `  Version History: VERSION_HISTORY.md\n`;
  output += `\n`;

  return output;
}

/**
 * JSON 형태로 버전 정보 출력
 */
function formatVersionInfoJson(packageInfo, gitInfo, systemInfo, buildInfo) {
  return JSON.stringify({
    package: packageInfo,
    git: gitInfo,
    system: systemInfo,
    build: buildInfo
  }, null, 2);
}

/**
 * 메인 함수
 */
async function main() {
  try {
    const args = process.argv.slice(2);
    const jsonOutput = args.includes('--json') || args.includes('-j');

    // 정보 수집
    const packageInfo = getPackageInfo();
    const gitInfo = getGitInfo();
    const systemInfo = getSystemInfo();
    const buildInfo = getBuildInfo();

    if (jsonOutput) {
      // JSON 출력
      console.log(formatVersionInfoJson(packageInfo, gitInfo, systemInfo, buildInfo));
    } else {
      // 포맷된 출력
      console.log(formatVersionInfo(packageInfo, gitInfo, systemInfo, buildInfo));
    }

  } catch (error) {
    log.error('버전 정보 생성 실패:', error.message);
    process.exit(1);
  }
}

// 스크립트 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

