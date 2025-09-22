#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import chalk from 'chalk';

/**
 * 변경 로그 생성 스크립트
 */
function generateChangelog() {
  try {
    // package.json에서 버전 정보 읽기
    const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
    const currentVersion = packageJson.version;
    
    // Git에서 최근 커밋들 가져오기
    let recentCommits = [];
    try {
      const gitLog = execSync('git log --oneline -10', { encoding: 'utf8' });
      recentCommits = gitLog.split('\n').filter(line => line.trim()).map(line => {
        const [hash, ...messageParts] = line.split(' ');
        return {
          hash: hash,
          message: messageParts.join(' ')
        };
      });
    } catch (error) {
      console.log(chalk.yellow('⚠️  Git 로그를 가져올 수 없습니다.'));
    }
    
    // CHANGELOG.md 파일 생성/업데이트
    const changelogPath = './CHANGELOG.md';
    let existingChangelog = '';
    
    if (existsSync(changelogPath)) {
      existingChangelog = readFileSync(changelogPath, 'utf8');
    }
    
    // 새로운 버전 섹션 생성
    const today = new Date().toISOString().split('T')[0];
    const newVersionSection = `## [${currentVersion}] - ${today}

### 변경사항
${recentCommits.map(commit => `- ${commit.message}`).join('\n')}

### 기술적 변경사항
- 버전 업데이트: v${currentVersion}
- Git 커밋: ${recentCommits[0]?.hash || 'N/A'}
- 변경된 파일 수: ${recentCommits.length}
- 자동 생성 시간: ${new Date().toISOString()}

### 자동 생성 정보
이 변경 로그는 다음 명령어로 자동 생성되었습니다:
\`\`\`bash
npm run version:changelog
\`\`\`

상세한 버전 히스토리는 [VERSION_HISTORY.md](./VERSION_HISTORY.md)를 참조하세요.

---

`;
    
    // 기존 CHANGELOG에 새 섹션 추가
    const updatedChangelog = newVersionSection + existingChangelog;
    
    // 파일 저장
    writeFileSync(changelogPath, updatedChangelog);
    
    console.log(chalk.green('✅ CHANGELOG.md가 업데이트되었습니다.'));
    console.log(chalk.cyan('📝 버전:'), chalk.white.bold(`v${currentVersion}`));
    console.log(chalk.cyan('📅 날짜:'), chalk.white(today));
    console.log(chalk.cyan('📋 커밋 수:'), chalk.white(recentCommits.length));
    
  } catch (error) {
    console.error(chalk.red('❌ 오류 발생:'), error.message);
    process.exit(1);
  }
}

// 스크립트 실행
generateChangelog();
