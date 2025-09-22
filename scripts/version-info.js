#!/usr/bin/env node

import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import chalk from 'chalk';

/**
 * 버전 정보 표시 스크립트
 */
function showVersionInfo() {
  try {
    // package.json에서 버전 정보 읽기
    const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
    const currentVersion = packageJson.version;
    
    // Git 정보 수집
    let gitInfo = {};
    try {
      const gitBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
      const gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
      const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
      const lastCommit = execSync('git log -1 --pretty=format:"%h - %an, %ar : %s"', { encoding: 'utf8' }).trim();
      
      gitInfo = {
        branch: gitBranch,
        commit: gitCommit,
        hasChanges: gitStatus.length > 0,
        lastCommit: lastCommit
      };
    } catch (error) {
      console.log(chalk.yellow('⚠️  Git 정보를 가져올 수 없습니다.'));
    }
    
    // 버전 정보 출력
    console.log(chalk.blue.bold('📦 MCP Cursor Server - 버전 정보'));
    console.log(chalk.gray('=' .repeat(50)));
    
    console.log(chalk.cyan('현재 버전:'), chalk.white.bold(`v${currentVersion}`));
    
    if (gitInfo.branch) {
      console.log(chalk.cyan('Git 브랜치:'), chalk.white(gitInfo.branch));
      console.log(chalk.cyan('커밋 해시:'), chalk.white(gitInfo.commit));
      console.log(chalk.cyan('마지막 커밋:'), chalk.white(gitInfo.lastCommit));
      
      if (gitInfo.hasChanges) {
        console.log(chalk.yellow('📝 상태:'), chalk.yellow('변경사항 있음'));
      } else {
        console.log(chalk.green('✅ 상태:'), chalk.green('변경사항 없음'));
      }
    }
    
    // 버전 히스토리
    console.log(chalk.gray('\n' + '=' .repeat(50)));
    console.log(chalk.blue.bold('📋 버전 관리 명령어:'));
    console.log(chalk.gray('  npm run version:patch    - 패치 버전 증가 (2.0.0 → 2.0.1)'));
    console.log(chalk.gray('  npm run version:minor    - 마이너 버전 증가 (2.0.0 → 2.1.0)'));
    console.log(chalk.gray('  npm run version:major    - 메이저 버전 증가 (2.0.0 → 3.0.0)'));
    console.log(chalk.gray('  npm run git:push         - 패치 버전 증가 후 푸시'));
    console.log(chalk.gray('  npm run release          - 패치 버전 증가 후 릴리스'));
    console.log(chalk.gray('  npm run release:minor    - 마이너 버전 증가 후 릴리스'));
    console.log(chalk.gray('  npm run release:major    - 메이저 버전 증가 후 릴리스'));
    
  } catch (error) {
    console.error(chalk.red('❌ 오류 발생:'), error.message);
    process.exit(1);
  }
}

// 스크립트 실행
showVersionInfo();
