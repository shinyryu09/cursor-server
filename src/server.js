#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import MCPServer from './core/mcpServer.js';
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
      .option('--http', 'Use HTTP transport')
      .action(async (options) => {
        await this.startServer(options);
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
  }

  /**
   * 서버 시작
   */
  async startServer(options) {
    try {
      console.log(chalk.blue.bold('🚀 MCP Cursor Server 시작 중...'));
      console.log(chalk.gray(`버전: ${config.mcp.version}`));
      console.log(chalk.gray(`환경: ${config.server.environment}`));

      // 로그 디렉토리 생성
      await this.ensureLogDirectory();

      // MCP 서버 생성
      this.mcpServer = new MCPServer();

      // 서버 시작
      await this.mcpServer.start();

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
      process.exit(1);
    }
  }

  /**
   * 서버 중지
   */
  async stopServer() {
    if (this.mcpServer) {
      try {
        await this.mcpServer.stop();
        console.log(chalk.green('✅ 서버가 중지되었습니다.'));
      } catch (error) {
        console.error(chalk.red('❌ 서버 중지 실패:'), error.message);
        logger.error('서버 중지 실패:', error);
      }
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

      // Cursor 서비스 상태
      console.log(chalk.cyan('\nCursor 서비스 상태:'));
      const CursorService = (await import('./services/cursorService.js')).default;
      const cursorService = new CursorService();
      const cursorStatus = await cursorService.getStatus();

      const cursorIcon = cursorStatus.available ? '✅' : '❌';
      console.log(chalk.gray(`  ${cursorIcon} Cursor CLI: ${cursorStatus.available ? '사용 가능' : '사용 불가'}`));
      if (cursorStatus.available) {
        console.log(chalk.gray(`    작업 디렉토리: ${cursorStatus.workingDirectory}`));
        console.log(chalk.gray(`    타임아웃: ${cursorStatus.timeout}ms`));
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
