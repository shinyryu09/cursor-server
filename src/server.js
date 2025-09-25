import { MCPHttpServer } from './core/mcpHttpServer.js';
import { MCPServer } from './core/mcpServer.js';
import { HttpProxyServer } from './core/httpProxyServer.js';
import logger from './utils/logger.js';
import config from './config/config.js';

/**
 * MCP Cursor Server 메인 애플리케이션
 * 중앙 허브 역할: Cursor AI <-> MCP 서버 <-> HTTP 프록시 <-> 클라이언트들
 */
class MCPServerApp {
  constructor() {
    this.mcpServer = new MCPServer();
    this.mcpHttpServer = new MCPHttpServer(this.mcpServer);
    this.httpProxyServer = new HttpProxyServer();
    this.isRunning = false;
  }

  /**
   * 서버 시작
   */
  async start() {
    try {
      console.log('🚀 MCP Cursor Server 시작 중...');
      console.log(`버전: ${config.version}`);
      console.log(`환경: ${config.environment}`);
      
      // 시스템 요구사항 확인
      await this.checkSystemRequirements();
      
      // MCP 서버 초기화
      await this.mcpServer.initialize();
      logger.info('MCP 서버 초기화 완료');
      
      // MCP HTTP 서버 시작 (Cursor Editor 연결용)
      await this.mcpHttpServer.start();
      
      // HTTP 프록시 서버 시작 (클라이언트들 연결용)
      await this.httpProxyServer.start();
      
      this.isRunning = true;
      console.log('✅ MCP 서버가 성공적으로 시작되었습니다!');
      console.log('📡 MCP HTTP 서버: http://localhost:3001 (Cursor Editor)');
      console.log('🔄 HTTP 프록시 서버: http://localhost:3000 (클라이언트들)');
      console.log('Ctrl+C를 눌러 서버를 중지할 수 있습니다.');
      
      // 종료 신호 처리
      process.on('SIGINT', () => this.stop());
      process.on('SIGTERM', () => this.stop());
      
    } catch (error) {
      console.error('❌ 서버 시작 실패:', error.message);
      process.exit(1);
    }
  }

  /**
   * 서버 중지
   */
  async stop() {
    try {
      console.log('\n🛑 서버를 중지하는 중...');
      
      if (this.httpProxyServer) {
        await this.httpProxyServer.stop();
      }
      
      if (this.mcpHttpServer) {
        await this.mcpHttpServer.stop();
      }
      
      this.isRunning = false;
      console.log('✅ MCP 서버가 중지되었습니다.');
      process.exit(0);
    } catch (error) {
      console.error('❌ 서버 중지 오류:', error.message);
      process.exit(1);
    }
  }

  /**
   * 시스템 요구사항 확인
   */
  async checkSystemRequirements() {
    console.log('🔍 시스템 요구사항 확인 중...');
    
    try {
      // Node.js 버전 확인
      const nodeVersion = process.version;
      console.log(`  ✅ Node.js: ${nodeVersion}`);
      
      // 필수 디렉토리 확인
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const requiredDirs = ['src', 'logs'];
      for (const dir of requiredDirs) {
        try {
          await fs.access(dir);
          console.log(`  ✅ 디렉토리: ${dir}`);
        } catch (error) {
          await fs.mkdir(dir, { recursive: true });
          console.log(`  ✅ 디렉토리 생성: ${dir}`);
        }
      }
      
      // AI 모델 API 키 확인
      const hasApiKey = config.ai.openai.apiKey || 
                       config.ai.anthropic.apiKey || 
                       config.ai.google.apiKey;
      
      if (hasApiKey) {
        console.log('  ✅ AI 모델 API 키 설정됨');
      } else {
        console.log('  ⚠️  AI 모델 API 키가 설정되지 않음 (cursor-default 모델만 사용 가능)');
      }
      
      console.log('✅ 시스템 요구사항 확인 완료');
      
    } catch (error) {
      console.error('❌ 시스템 요구사항 확인 실패:', error.message);
      throw error;
    }
  }
}

// CLI 처리
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';
  
  const app = new MCPServerApp();
  
  switch (command) {
    case 'start':
      await app.start();
      // 서버가 계속 실행되도록 대기
      await new Promise(() => {}); // 무한 대기
      break;
      
    case 'stop':
      await app.stop();
      break;
      
    case 'restart':
      await app.stop();
      await app.start();
      break;
      
    case 'status':
      console.log(`서버 상태: ${app.isRunning ? '실행 중' : '중지됨'}`);
      break;
      
    default:
      console.log('사용법: node src/server.js [start|stop|restart|status]');
      process.exit(1);
  }
}

// 에러 처리
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// 메인 함수 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ 애플리케이션 실행 오류:', error.message);
    process.exit(1);
  });
}

export default MCPServerApp;