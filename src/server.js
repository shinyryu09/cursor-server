#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import logger from './utils/logger.js';
import config from './config/config.js';

// ES modules에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * MCP Cursor Server 메인 애플리케이션
 */
class Application {
  constructor() {
    this.program = new Command();
    this.mcpServer = null;
    this.setupCommands();
  }

  /**
   * CLI 명령어 설정
   */
  setupCommands() {
    this.program
      .name('mcp-cursor-server')
      .description('MCP server for Xcode, Android Studio integration with Cursor CLI and multiple AI models')
      .version(config.mcp.version);

    // 서버 시작 명령어
    this.program
      .command('start')
      .description('Start the MCP server')
      .option('-p, --port <port>', 'Server port', config.server.port.toString())
      .option('-h, --host <host>', 'Server host', config.server.host)
      .option('--stdio', 'Use stdio transport (default for MCP)')
      .action(async (options) => {
        await this.startServer(options);
      });

    // MCP 모드 명령어 (stdio 전용)
    this.program
      .command('mcp')
      .description('Start the MCP server in stdio mode for plugin integration')
      .action(async () => {
        await this.startMCPServer();
      });

    // 프로젝트 감지 명령어
    this.program
      .command('detect')
      .description('Detect project in current directory')
      .option('-d, --dir <directory>', 'Directory to scan', process.cwd())
      .action(async (options) => {
        await this.detectProject(options.dir);
      });

    // 상태 확인 명령어
    this.program
      .command('status')
      .description('Check server status and available services')
      .action(async () => {
        await this.checkStatus();
      });

    // 설정 명령어
    this.program
      .command('config')
      .description('Show current configuration')
      .action(() => {
        this.showConfig();
      });

    // 로그 명령어
    this.program
      .command('logs')
      .description('Show server logs')
      .option('-f, --follow', 'Follow log output')
      .option('-n, --lines <number>', 'Number of lines to show', '50')
      .action(async (options) => {
        await this.showLogs(options);
      });

    // 버전 관리 명령어
    this.program
      .command('version')
      .description('Version management commands')
      .option('-i, --info', 'Show version information')
      .option('-p, --patch', 'Increment patch version')
      .option('-m, --minor', 'Increment minor version')
      .option('-M, --major', 'Increment major version')
      .option('--show', 'Show current version')
      .action(async (options) => {
        await this.handleVersion(options);
      });

    // 채팅 히스토리 관리 명령어
    this.program
      .command('chat')
      .description('Chat history management commands')
      .option('-l, --list', 'List all chat sessions')
      .option('-s, --stats', 'Show chat statistics')
      .option('-c, --cleanup', 'Clean up old chat sessions')
      .option('-d, --delete <sessionId>', 'Delete specific chat session')
      .option('--search <keyword>', 'Search chat history')
      .action(async (options) => {
        await this.handleChatHistory(options);
      });

  }

  /**
   * 서버 시작
   */
  async startServer(options) {
    try {
      console.log(chalk.blue.bold('🚀 MCP Cursor Server 시작 중...'));
      console.log(chalk.gray(`버전: ${config.mcp.version}`));
      console.log(chalk.gray(`환경: ${config.server.environment}`));

      // 시스템 요구사항 확인
      await this.checkSystemRequirements();

      // 로그 디렉토리 생성
      await this.ensureLogDirectory();

      // MCP 서버 시작 (stdio 모드)
      const { MCPServer } = await import('./core/mcpServer.js');
      this.mcpServer = new MCPServer();
      await this.mcpServer.initialize();
      await this.mcpServer.start();
      
      console.log(chalk.green('✅ MCP 서버가 stdio 모드로 시작되었습니다.'));
      
      // HTTP 서버 시작 (플러그인용)
      const { HttpServer } = await import('./core/httpServer.js');
      this.httpServer = new HttpServer();
      await this.httpServer.start();
      
      console.log(chalk.green(`✅ HTTP 서버가 시작되었습니다: http://${config.server.host}:${config.server.port}`));

      console.log(chalk.green.bold('✅ MCP 서버가 성공적으로 시작되었습니다!'));
      console.log(chalk.gray('Ctrl+C를 눌러 서버를 중지할 수 있습니다.'));

      // 프로세스 종료 시 정리
      process.on('SIGINT', async () => {
        console.log(chalk.yellow('\n🛑 서버를 중지하는 중...'));
        await this.stopServer();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        console.log(chalk.yellow('\n🛑 서버를 중지하는 중...'));
        await this.stopServer();
        process.exit(0);
      });

    } catch (error) {
      console.error(chalk.red.bold('❌ 서버 시작 실패:'), error.message);
      logger.error('서버 시작 실패:', error);
      
      // 구체적인 에러 메시지 제공
      if (error.code === 'EADDRINUSE') {
        console.error(chalk.yellow('💡 포트가 이미 사용 중입니다. 다른 포트를 사용하거나 기존 프로세스를 종료하세요.'));
        console.error(chalk.gray(`  lsof -i :${config.server.port}`));
      } else if (error.code === 'ENOENT') {
        console.error(chalk.yellow('💡 필요한 파일이나 디렉토리를 찾을 수 없습니다.'));
        console.error(chalk.gray('  npm run setup 명령어로 자동 설치를 시도해보세요.'));
      } else if (error.message.includes('Cannot find module')) {
        console.error(chalk.yellow('💡 의존성 모듈을 찾을 수 없습니다.'));
        console.error(chalk.gray('  npm install 또는 npm run install:clean 명령어를 실행하세요.'));
      }
      
      process.exit(1);
    }
  }

  /**
   * 시스템 요구사항 확인
   */
  async checkSystemRequirements() {
    console.log(chalk.blue('🔍 시스템 요구사항 확인 중...'));
    
    // Node.js 버전 확인
    const nodeVersion = process.version;
    const requiredVersion = '18.0.0';
    
    if (this.compareVersions(nodeVersion.slice(1), requiredVersion) < 0) {
      throw new Error(`Node.js 버전이 너무 낮습니다. 현재: ${nodeVersion}, 필요: v${requiredVersion} 이상`);
    }
    
    console.log(chalk.gray(`  ✅ Node.js: ${nodeVersion}`));
    
    // 필수 디렉토리 확인
    const requiredDirs = ['src', 'logs'];
    for (const dir of requiredDirs) {
      try {
        await fs.access(dir);
        console.log(chalk.gray(`  ✅ 디렉토리: ${dir}`));
      } catch {
        console.log(chalk.gray(`  ⚠️  디렉토리: ${dir} (자동 생성됨)`));
        await fs.mkdir(dir, { recursive: true });
      }
    }
    
    // 환경 변수 확인
    const requiredEnvVars = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY', 'CURSOR_API_KEY'];
    const hasApiKey = requiredEnvVars.some(key => process.env[key]);
    
    if (!hasApiKey) {
      console.log(chalk.yellow('  ⚠️  AI 모델 API 키가 설정되지 않았습니다.'));
      console.log(chalk.gray('    .env 파일에 최소 하나의 API 키를 설정하세요.'));
    } else {
      console.log(chalk.gray('  ✅ AI 모델 API 키 설정됨'));
    }
    
    console.log(chalk.green('✅ 시스템 요구사항 확인 완료'));
  }

  /**
   * 버전 비교 함수
   */
  compareVersions(version1, version2) {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;
      
      if (v1part < v2part) return -1;
      if (v1part > v2part) return 1;
    }
    
    return 0;
  }

  /**
   * MCP 서버 시작 (stdio 모드)
   */
  async startMCPServer() {
    try {
      console.log(chalk.blue('🚀 MCP Cursor Server 시작 중...'));
      console.log(chalk.gray(`버전: ${config.mcp.version}`));
      console.log(chalk.gray(`환경: ${config.mcp.environment}`));
      
      // 시스템 요구사항 확인
      await this.checkSystemRequirements();
      
      // MCP 서버만 시작 (stdio 모드)
      const { MCPServer } = await import('./core/mcpServer.js');
      this.mcpServer = new MCPServer();
      await this.mcpServer.initialize();
      await this.mcpServer.start();
      
      logger.info('MCP 서버가 stdio 모드로 시작되었습니다');
      
    } catch (error) {
      console.error(chalk.red('❌ MCP 서버 시작 실패:'), error.message);
      logger.error('MCP 서버 시작 실패:', error);
      process.exit(1);
    }
  }

  /**
   * 서버 중지
   */
  async stopServer() {
    try {
      if (this.httpServer) {
        await this.httpServer.stop();
      }
      if (this.mcpServer) {
        await this.mcpServer.stop();
      }
      console.log(chalk.green('✅ MCP 서버가 중지되었습니다.'));
    } catch (error) {
      console.error(chalk.red('❌ 서버 중지 실패:'), error.message);
      logger.error('서버 중지 실패:', error);
    }
  }

  /**
   * 프로젝트 감지
   */
  async detectProject(directory) {
    try {
      console.log(chalk.blue(`🔍 프로젝트 감지 중: ${directory}`));

      const ProjectDetector = (await import('./services/projectDetector.js')).default;
      const detector = new ProjectDetector();
      const project = await detector.detectProject(directory);

      if (project) {
        console.log(chalk.green.bold('✅ 프로젝트 감지됨!'));
        console.log(chalk.gray(`타입: ${project.type}`));
        console.log(chalk.gray(`이름: ${project.name}`));
        console.log(chalk.gray(`경로: ${project.path}`));
        
        if (project.projectFile) {
          console.log(chalk.gray(`프로젝트 파일: ${project.projectFile}`));
        }

        if (project.buildSettings) {
          console.log(chalk.gray(`빌드 설정: ${Object.keys(project.buildSettings).length}개 항목`));
        }
      } else {
        console.log(chalk.yellow('⚠️  프로젝트를 찾을 수 없습니다.'));
        console.log(chalk.gray('지원되는 프로젝트 타입: Xcode (.xcodeproj, .xcworkspace), Android (build.gradle)'));
      }

    } catch (error) {
      console.error(chalk.red.bold('❌ 프로젝트 감지 실패:'), error.message);
      logger.error('프로젝트 감지 실패:', error);
      process.exit(1);
    }
  }

  /**
   * 상태 확인
   */
  async checkStatus() {
    try {
      console.log(chalk.blue.bold('📊 MCP Cursor Server 상태'));
      console.log(chalk.gray('=' .repeat(50)));

      // 서버 정보
      console.log(chalk.cyan('서버 정보:'));
      console.log(chalk.gray(`  이름: ${config.mcp.name}`));
      console.log(chalk.gray(`  버전: ${config.mcp.version}`));
      console.log(chalk.gray(`  환경: ${config.server.environment}`));
      console.log(chalk.gray(`  포트: ${config.server.port}`));
      console.log(chalk.gray(`  호스트: ${config.server.host}`));

      // AI 서비스 상태
      console.log(chalk.cyan('\nAI 서비스 상태:'));
      const AIService = (await import('./services/aiService.js')).default;
      const aiService = new AIService();
      const aiStatus = aiService.getStatus();

      for (const [type, status] of Object.entries(aiStatus)) {
        const icon = status.available ? '✅' : '❌';
        console.log(chalk.gray(`  ${icon} ${type}: ${status.available ? '사용 가능' : '사용 불가'}`));
        if (status.available && status.models.length > 0) {
          console.log(chalk.gray(`    모델: ${status.models.map(m => m.id).join(', ')}`));
        }
      }


      // 프로젝트 상태
      console.log(chalk.cyan('\n프로젝트 상태:'));
      const ProjectDetector = (await import('./services/projectDetector.js')).default;
      const detector = new ProjectDetector();
      const project = await detector.detectProject();

      if (project) {
        console.log(chalk.gray(`  ✅ 프로젝트 감지됨: ${project.name} (${project.type})`));
        console.log(chalk.gray(`    경로: ${project.path}`));
      } else {
        console.log(chalk.gray(`  ⚠️  프로젝트 감지되지 않음`));
      }

    } catch (error) {
      console.error(chalk.red.bold('❌ 상태 확인 실패:'), error.message);
      logger.error('상태 확인 실패:', error);
      process.exit(1);
    }
  }

  /**
   * 설정 표시
   */
  showConfig() {
    console.log(chalk.blue.bold('⚙️  현재 설정'));
    console.log(chalk.gray('=' .repeat(50)));

    console.log(chalk.cyan('서버 설정:'));
    console.log(chalk.gray(`  포트: ${config.server.port}`));
    console.log(chalk.gray(`  호스트: ${config.server.host}`));
    console.log(chalk.gray(`  환경: ${config.server.environment}`));

    console.log(chalk.cyan('\nAI 모델 설정:'));
    for (const [provider, settings] of Object.entries(config.ai)) {
      const hasKey = !!settings.apiKey;
      const icon = hasKey ? '✅' : '❌';
      console.log(chalk.gray(`  ${icon} ${provider}: ${hasKey ? '설정됨' : '설정되지 않음'}`));
      if (hasKey && settings.models) {
        console.log(chalk.gray(`    모델: ${settings.models.join(', ')}`));
      }
    }

    console.log(chalk.cyan('\n프로젝트 설정:'));
    console.log(chalk.gray(`  Xcode 검색 경로: ${config.projects.xcode.searchPaths.join(', ')}`));
    console.log(chalk.gray(`  Android 검색 경로: ${config.projects.android.searchPaths.join(', ')}`));

    console.log(chalk.cyan('\n로깅 설정:'));
    console.log(chalk.gray(`  레벨: ${config.logging.level}`));
    console.log(chalk.gray(`  포맷: ${config.logging.format}`));
  }

  /**
   * 로그 표시
   */
  async showLogs(options) {
    try {
      const logFile = path.join(__dirname, '../logs/combined.log');
      
      // 로그 파일 존재 확인
      try {
        await fs.access(logFile);
      } catch {
        console.log(chalk.yellow('⚠️  로그 파일이 없습니다.'));
        return;
      }

      if (options.follow) {
        console.log(chalk.blue('📋 로그를 실시간으로 표시합니다. (Ctrl+C로 중지)'));
        // 실시간 로그 표시는 별도 구현 필요
        console.log(chalk.gray('실시간 로그 기능은 아직 구현되지 않았습니다.'));
      } else {
        const content = await fs.readFile(logFile, 'utf8');
        const lines = content.split('\n');
        const lastLines = lines.slice(-parseInt(options.lines));
        
        console.log(chalk.blue(`📋 최근 ${options.lines}줄 로그:`));
        console.log(chalk.gray('=' .repeat(50)));
        console.log(lastLines.join('\n'));
      }

    } catch (error) {
      console.error(chalk.red.bold('❌ 로그 표시 실패:'), error.message);
      logger.error('로그 표시 실패:', error);
    }
  }

  /**
   * 버전 관리 핸들러
   */
  async handleVersion(options) {
    try {
      if (options.info) {
        await this.showVersionInfo();
      } else if (options.patch) {
        await this.incrementVersion('patch');
      } else if (options.minor) {
        await this.incrementVersion('minor');
      } else if (options.major) {
        await this.incrementVersion('major');
      } else if (options.show) {
        await this.showCurrentVersion();
      } else {
        // 기본적으로 버전 정보 표시
        await this.showVersionInfo();
      }
    } catch (error) {
      console.error(chalk.red.bold('❌ 버전 관리 실패:'), error.message);
      logger.error('버전 관리 실패:', error);
      process.exit(1);
    }
  }

  /**
   * 버전 정보 표시
   */
  async showVersionInfo() {
    try {
      const packageJson = JSON.parse(await fs.readFile('./package.json', 'utf8'));
      const currentVersion = packageJson.version;
      
      console.log(chalk.blue.bold('📦 MCP Cursor Server - 버전 정보'));
      console.log(chalk.gray('=' .repeat(50)));
      
      console.log(chalk.cyan('현재 버전:'), chalk.white.bold(`v${currentVersion}`));
      
      // Git 정보 수집
      try {
        const { execSync } = await import('child_process');
        const gitBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
        const gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
        const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
        const lastCommit = execSync('git log -1 --pretty=format:"%h - %an, %ar : %s"', { encoding: 'utf8' }).trim();
        
        console.log(chalk.cyan('Git 브랜치:'), chalk.white(gitBranch));
        console.log(chalk.cyan('커밋 해시:'), chalk.white(gitCommit));
        console.log(chalk.cyan('마지막 커밋:'), chalk.white(lastCommit));
        
        if (gitStatus.length > 0) {
          console.log(chalk.yellow('📝 상태:'), chalk.yellow('변경사항 있음'));
        } else {
          console.log(chalk.green('✅ 상태:'), chalk.green('변경사항 없음'));
        }
      } catch (error) {
        console.log(chalk.yellow('⚠️  Git 정보를 가져올 수 없습니다.'));
      }
      
      // 버전 관리 명령어 안내
      console.log(chalk.gray('\n' + '=' .repeat(50)));
      console.log(chalk.blue.bold('📋 버전 관리 명령어:'));
      console.log(chalk.gray('  node src/server.js version --patch    - 패치 버전 증가 (2.0.0 → 2.0.1)'));
      console.log(chalk.gray('  node src/server.js version --minor    - 마이너 버전 증가 (2.0.0 → 2.1.0)'));
      console.log(chalk.gray('  node src/server.js version --major    - 메이저 버전 증가 (2.0.0 → 3.0.0)'));
      console.log(chalk.gray('  npm run git:push                      - 패치 버전 증가 후 푸시'));
      console.log(chalk.gray('  npm run release                       - 패치 버전 증가 후 릴리스'));
      
    } catch (error) {
      throw new Error(`버전 정보 표시 실패: ${error.message}`);
    }
  }

  /**
   * 현재 버전 표시
   */
  async showCurrentVersion() {
    try {
      const packageJson = JSON.parse(await fs.readFile('./package.json', 'utf8'));
      console.log(packageJson.version);
    } catch (error) {
      throw new Error(`버전 표시 실패: ${error.message}`);
    }
  }

  /**
   * 버전 증가
   */
  async incrementVersion(type) {
    try {
      const { execSync } = await import('child_process');
      
      console.log(chalk.blue(`🔄 ${type} 버전을 증가시킵니다...`));
      
      // npm version 명령어 실행
      execSync(`npm version ${type} --no-git-tag-version`, { stdio: 'inherit' });
      
      // 새로운 버전 읽기
      const packageJson = JSON.parse(await fs.readFile('./package.json', 'utf8'));
      const newVersion = packageJson.version;
      
      console.log(chalk.green.bold(`✅ 버전이 v${newVersion}으로 업데이트되었습니다!`));
      
      // 변경사항을 Git에 추가
      try {
        execSync('git add package.json', { stdio: 'inherit' });
        execSync(`git commit -m "chore: bump version to v${newVersion}"`, { stdio: 'inherit' });
        console.log(chalk.green('✅ Git에 커밋되었습니다.'));
      } catch (error) {
        console.log(chalk.yellow('⚠️  Git 커밋 실패 (변경사항은 저장됨):'), error.message);
      }
      
    } catch (error) {
      throw new Error(`버전 증가 실패: ${error.message}`);
    }
  }

  /**
   * 버전 관리 핸들러
   */
  async handleVersion(options) {
    try {
      if (options.info) {
        await this.showVersionInfo();
      } else if (options.patch) {
        await this.incrementVersion('patch');
      } else if (options.minor) {
        await this.incrementVersion('minor');
      } else if (options.major) {
        await this.incrementVersion('major');
      } else if (options.show) {
        await this.showCurrentVersion();
      } else {
        // 기본적으로 버전 정보 표시
        await this.showVersionInfo();
      }
    } catch (error) {
      console.error(chalk.red.bold('❌ 버전 관리 실패:'), error.message);
      logger.error('버전 관리 실패:', error);
      process.exit(1);
    }
  }

  /**
   * 버전 정보 표시
   */
  async showVersionInfo() {
    try {
      const packageJson = JSON.parse(await fs.readFile('./package.json', 'utf8'));
      const currentVersion = packageJson.version;
      
      console.log(chalk.blue.bold('📦 MCP Cursor Server - 버전 정보'));
      console.log(chalk.gray('=' .repeat(50)));
      console.log(chalk.gray(`현재 버전: v${currentVersion}`));
      
      // Git 정보 표시
      try {
        const { execSync } = await import('child_process');
        const gitBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
        const gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
        const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
        
        console.log(chalk.gray(`Git 브랜치: ${gitBranch}`));
        console.log(chalk.gray(`커밋 해시: ${gitCommit}`));
        
        // 마지막 커밋 정보
        try {
          const lastCommit = execSync('git log -1 --pretty=format:"%h - %an, %ar : %s"', { encoding: 'utf8' }).trim();
          console.log(chalk.gray(`마지막 커밋: ${lastCommit}`));
        } catch (error) {
          console.log(chalk.gray('마지막 커밋: 정보 없음'));
        }
        
        // 상태 표시
        if (gitStatus) {
          console.log(chalk.yellow('📝 상태: 변경사항 있음'));
        } else {
          console.log(chalk.green('✅ 상태: 깨끗함'));
        }
        
      } catch (error) {
        console.log(chalk.gray('Git 정보: 사용할 수 없음'));
      }

      // 버전 관리 명령어 안내
      console.log(chalk.gray('\n' + '=' .repeat(50)));
      console.log(chalk.blue.bold('📋 버전 관리 명령어:'));
      console.log(chalk.gray('  node src/server.js version --patch    - 패치 버전 증가 (2.0.0 → 2.0.1)'));
      console.log(chalk.gray('  node src/server.js version --minor    - 마이너 버전 증가 (2.0.0 → 2.1.0)'));
      console.log(chalk.gray('  node src/server.js version --major    - 메이저 버전 증가 (2.0.0 → 3.0.0)'));
      console.log(chalk.gray('  npm run version:patch                 - 패치 버전 증가'));
      console.log(chalk.gray('  npm run version:minor                 - 마이너 버전 증가'));
      console.log(chalk.gray('  npm run version:major                 - 메이저 버전 증가'));
      console.log(chalk.gray(''));
      console.log(chalk.blue.bold('🚀 자동 버전 증가 및 푸시:'));
      console.log(chalk.gray('  npm run git:push                      - 패치 버전 증가 후 자동 푸시'));
      console.log(chalk.gray('  npm run git:push:minor                - 마이너 버전 증가 후 자동 푸시'));
      console.log(chalk.gray('  npm run git:push:major                - 메이저 버전 증가 후 자동 푸시'));
      
    } catch (error) {
      throw new Error(`버전 정보 표시 실패: ${error.message}`);
    }
  }

  /**
   * 현재 버전 표시
   */
  async showCurrentVersion() {
    try {
      const packageJson = JSON.parse(await fs.readFile('./package.json', 'utf8'));
      console.log(packageJson.version);
    } catch (error) {
      throw new Error(`버전 표시 실패: ${error.message}`);
    }
  }

  /**
   * 버전 증가
   */
  async incrementVersion(type) {
    try {
      const { execSync } = await import('child_process');
      
      console.log(chalk.blue(`🔄 ${type} 버전을 증가시킵니다...`));
      
      // npm version 명령어 실행
      execSync(`npm version ${type} --no-git-tag-version`, { stdio: 'inherit' });
      
      // 새로운 버전 읽기
      const packageJson = JSON.parse(await fs.readFile('./package.json', 'utf8'));
      const newVersion = packageJson.version;
      
      console.log(chalk.green.bold(`✅ 버전이 v${newVersion}으로 업데이트되었습니다!`));
      
      // 변경사항을 Git에 추가
      try {
        execSync('git add package.json', { stdio: 'inherit' });
        execSync(`git commit -m "chore: bump version to v${newVersion}"`, { stdio: 'inherit' });
        console.log(chalk.green('✅ Git에 커밋되었습니다.'));
      } catch (error) {
        console.log(chalk.yellow('⚠️  Git 커밋 실패 (변경사항은 저장됨):'), error.message);
      }
      
    } catch (error) {
      throw new Error(`버전 증가 실패: ${error.message}`);
    }
  }

  /**
   * 채팅 히스토리 핸들러
   */
  async handleChatHistory(options) {
    try {
      const ChatHistoryService = (await import('./services/chatHistoryService.js')).default;
      const chatHistoryService = new ChatHistoryService();
      await chatHistoryService.initialize();

      if (options.list) {
        await this.listChatSessions(chatHistoryService);
      } else if (options.stats) {
        await this.showChatStatistics(chatHistoryService);
      } else if (options.cleanup) {
        await this.cleanupChatSessions(chatHistoryService);
      } else if (options.delete) {
        await this.deleteChatSession(chatHistoryService, options.delete);
      } else if (options.search) {
        await this.searchChatHistory(chatHistoryService, options.search);
      } else {
        // 기본적으로 통계 표시
        await this.showChatStatistics(chatHistoryService);
      }
    } catch (error) {
      console.error(chalk.red.bold('❌ 채팅 히스토리 관리 실패:'), error.message);
      logger.error('채팅 히스토리 관리 실패:', error);
      process.exit(1);
    }
  }

  /**
   * 채팅 세션 목록 표시
   */
  async listChatSessions(chatHistoryService) {
    try {
      const sessions = await chatHistoryService.getAllSessions();
      
      console.log(chalk.blue.bold('💬 채팅 세션 목록'));
      console.log(chalk.gray('=' .repeat(80)));
      
      if (sessions.length === 0) {
        console.log(chalk.yellow('📝 채팅 세션이 없습니다.'));
        return;
      }
      
      sessions.forEach((session, index) => {
        const createdDate = new Date(session.createdAt).toLocaleString();
        const updatedDate = new Date(session.updatedAt).toLocaleString();
        
        console.log(chalk.cyan(`${index + 1}. ${session.sessionId}`));
        console.log(chalk.gray(`   생성: ${createdDate}`));
        console.log(chalk.gray(`   수정: ${updatedDate}`));
        console.log(chalk.gray(`   메시지: ${session.messageCount}개`));
        console.log(chalk.gray(`   마지막 메시지: ${session.lastMessage.substring(0, 50)}...`));
        console.log('');
      });
      
      console.log(chalk.gray(`총 ${sessions.length}개 세션`));
      
    } catch (error) {
      throw new Error(`세션 목록 표시 실패: ${error.message}`);
    }
  }

  /**
   * 채팅 통계 표시
   */
  async showChatStatistics(chatHistoryService) {
    try {
      const stats = await chatHistoryService.getStatistics();
      
      console.log(chalk.blue.bold('📊 채팅 히스토리 통계'));
      console.log(chalk.gray('=' .repeat(50)));
      
      console.log(chalk.cyan('세션 정보:'));
      console.log(chalk.gray(`  총 세션 수: ${stats.totalSessions}개`));
      console.log(chalk.gray(`  총 메시지 수: ${stats.totalMessages}개`));
      console.log(chalk.gray(`  세션당 평균 메시지: ${stats.averageMessagesPerSession}개`));
      
      if (stats.oldestSession) {
        console.log(chalk.gray(`  가장 오래된 세션: ${new Date(stats.oldestSession).toLocaleString()}`));
      }
      if (stats.newestSession) {
        console.log(chalk.gray(`  가장 최근 세션: ${new Date(stats.newestSession).toLocaleString()}`));
      }
      
      console.log(chalk.cyan('\n저장소 사용량:'));
      console.log(chalk.gray(`  ${stats.storageUsed.mb}MB (${stats.storageUsed.kb}KB, ${stats.storageUsed.bytes} bytes)`));
      
      console.log(chalk.gray('\n' + '=' .repeat(50)));
      console.log(chalk.blue.bold('💡 채팅 히스토리 명령어:'));
      console.log(chalk.gray('  node src/server.js chat --list           - 세션 목록 표시'));
      console.log(chalk.gray('  node src/server.js chat --stats          - 통계 표시'));
      console.log(chalk.gray('  node src/server.js chat --cleanup        - 오래된 세션 정리'));
      console.log(chalk.gray('  node src/server.js chat --delete <id>    - 세션 삭제'));
      console.log(chalk.gray('  node src/server.js chat --search <키워드> - 히스토리 검색'));
      
    } catch (error) {
      throw new Error(`통계 표시 실패: ${error.message}`);
    }
  }

  /**
   * 오래된 채팅 세션 정리
   */
  async cleanupChatSessions(chatHistoryService) {
    try {
      console.log(chalk.blue('🧹 오래된 채팅 세션을 정리하는 중...'));
      
      const result = await chatHistoryService.cleanupOldSessions();
      
      console.log(chalk.green.bold('✅ 세션 정리 완료!'));
      console.log(chalk.gray(`결과: ${result.message}`));
      
    } catch (error) {
      throw new Error(`세션 정리 실패: ${error.message}`);
    }
  }

  /**
   * 채팅 세션 삭제
   */
  async deleteChatSession(chatHistoryService, sessionId) {
    try {
      console.log(chalk.blue(`🗑️  세션 삭제 중: ${sessionId}`));
      
      const deleted = await chatHistoryService.deleteSession(sessionId);
      
      if (deleted) {
        console.log(chalk.green.bold('✅ 세션이 삭제되었습니다!'));
      } else {
        console.log(chalk.yellow('⚠️  세션을 찾을 수 없습니다.'));
      }
      
    } catch (error) {
      throw new Error(`세션 삭제 실패: ${error.message}`);
    }
  }

  /**
   * 채팅 히스토리 검색
   */
  async searchChatHistory(chatHistoryService, keyword) {
    try {
      console.log(chalk.blue(`🔍 채팅 히스토리 검색: "${keyword}"`));
      
      const results = await chatHistoryService.searchHistory(keyword);
      
      if (results.length === 0) {
        console.log(chalk.yellow('📝 검색 결과가 없습니다.'));
        return;
      }
      
      console.log(chalk.gray('=' .repeat(80)));
      
      results.forEach((result, index) => {
        console.log(chalk.cyan(`${index + 1}. 세션: ${result.sessionId}`));
        console.log(chalk.gray(`   수정: ${new Date(result.updatedAt).toLocaleString()}`));
        console.log(chalk.gray(`   매칭 메시지: ${result.matches.length}개`));
        
        result.matches.forEach((match, matchIndex) => {
          console.log(chalk.gray(`   ${matchIndex + 1}) ${match.message.content.substring(0, 100)}...`));
        });
        console.log('');
      });
      
      console.log(chalk.gray(`총 ${results.length}개 세션에서 검색됨`));
      
    } catch (error) {
      throw new Error(`히스토리 검색 실패: ${error.message}`);
    }
  }


  /**
   * 로그 디렉토리 생성
   */
  async ensureLogDirectory() {
    try {
      const logDir = path.join(__dirname, '../logs');
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      logger.warn('로그 디렉토리 생성 실패:', error.message);
    }
  }

  /**
   * 애플리케이션 실행
   */
  run() {
    this.program.parse();
  }
}

// 애플리케이션 실행
const app = new Application();
app.run();
