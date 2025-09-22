import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';
import config from '../config/config.js';

const execAsync = promisify(exec);

/**
 * Cursor CLI 서비스
 */
export class CursorService {
  constructor() {
    this.isAvailable = false;
    this.checkAvailability();
  }

  /**
   * Cursor CLI 사용 가능 여부 확인
   */
  async checkAvailability() {
    try {
      await execAsync('cursor-agent --version');
      this.isAvailable = true;
      logger.info('Cursor CLI 사용 가능');
    } catch (error) {
      this.isAvailable = false;
      logger.warn('Cursor CLI를 사용할 수 없습니다:', error.message);
    }
  }

  /**
   * Cursor CLI를 사용한 채팅
   */
  async chat(message, files = []) {
    if (!this.isAvailable) {
      throw new Error('Cursor CLI를 사용할 수 없습니다. cursor-agent가 설치되어 있는지 확인하세요.');
    }

    try {
      logger.info(`Cursor CLI 채팅 시작: ${message.substring(0, 100)}...`);

      // 프로젝트 컨텍스트 수집
      const context = await this.buildContext(files);
      
      // Cursor CLI 명령어 구성
      const args = ['-p', message];
      if (files.length > 0) {
        args.push(...files);
      }

      const command = `cursor-agent ${args.join(' ')}`;
      
      // 환경 변수 설정
      const env = {
        ...process.env,
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        USER: process.env.USER,
        CURSOR_WORKING_DIR: config.cursor.workingDirectory
      };

      // Cursor CLI 실행
      const { stdout, stderr } = await execAsync(command, {
        cwd: config.cursor.workingDirectory,
        env,
        timeout: config.cursor.timeout
      });

      if (stderr) {
        logger.warn('Cursor CLI stderr:', stderr);
      }

      logger.info('Cursor CLI 채팅 완료');
      return stdout || '응답을 받을 수 없습니다.';

    } catch (error) {
      logger.error('Cursor CLI 채팅 오류:', error);
      
      // 타임아웃 오류 처리
      if (error.code === 'TIMEOUT') {
        throw new Error('Cursor CLI 응답 시간이 초과되었습니다.');
      }
      
      // 명령어를 찾을 수 없는 경우
      if (error.code === 'ENOENT') {
        throw new Error('cursor-agent 명령어를 찾을 수 없습니다. Cursor가 설치되어 있는지 확인하세요.');
      }
      
      throw new Error(`Cursor CLI 실행 실패: ${error.message}`);
    }
  }

  /**
   * 프로젝트 컨텍스트 구축
   */
  async buildContext(files) {
    const context = {
      workingDirectory: config.cursor.workingDirectory,
      files: [],
      projectInfo: null
    };

    try {
      // 프로젝트 정보 수집
      const projectDetector = (await import('./projectDetector.js')).default;
      const detector = new projectDetector();
      context.projectInfo = await detector.detectProject();

      // 파일 정보 수집
      for (const file of files) {
        try {
          const stats = await fs.stat(file);
          const content = await fs.readFile(file, 'utf8');
          
          context.files.push({
            path: file,
            size: stats.size,
            modified: stats.mtime,
            content: content.substring(0, 10000) // 처음 10KB만
          });
        } catch (error) {
          logger.warn(`파일 읽기 실패: ${file}`, error.message);
        }
      }

    } catch (error) {
      logger.warn('컨텍스트 구축 중 오류:', error.message);
    }

    return context;
  }

  /**
   * Cursor CLI 상태 확인
   */
  async getStatus() {
    return {
      available: this.isAvailable,
      workingDirectory: config.cursor.workingDirectory,
      timeout: config.cursor.timeout
    };
  }

  /**
   * Cursor CLI 재시작
   */
  async restart() {
    await this.checkAvailability();
    return this.isAvailable;
  }

  /**
   * 코드 생성 요청
   */
  async generateCode(prompt, language = 'swift', context = {}) {
    const message = `다음 요구사항에 따라 ${language} 코드를 생성해주세요:\n\n${prompt}\n\n`;
    
    if (context.projectType) {
      message += `프로젝트 타입: ${context.projectType}\n`;
    }
    
    if (context.files && context.files.length > 0) {
      message += `관련 파일들: ${context.files.join(', ')}\n`;
    }

    return await this.chat(message, context.files || []);
  }

  /**
   * 코드 리뷰 요청
   */
  async reviewCode(filePath, reviewType = 'general') {
    const message = `다음 파일을 ${reviewType} 관점에서 리뷰해주세요:\n\n파일: ${filePath}`;
    return await this.chat(message, [filePath]);
  }

  /**
   * 버그 수정 요청
   */
  async fixBug(errorMessage, filePath, context = {}) {
    const message = `다음 에러를 수정해주세요:\n\n에러: ${errorMessage}\n파일: ${filePath}\n\n`;
    
    if (context.stackTrace) {
      message += `스택 트레이스:\n${context.stackTrace}\n\n`;
    }
    
    if (context.relatedFiles && context.relatedFiles.length > 0) {
      message += `관련 파일들: ${context.relatedFiles.join(', ')}\n`;
    }

    return await this.chat(message, [filePath, ...(context.relatedFiles || [])]);
  }

  /**
   * 테스트 코드 생성
   */
  async generateTests(filePath, testFramework = 'xctest') {
    const message = `${testFramework}를 사용하여 다음 파일에 대한 테스트 코드를 생성해주세요:\n\n파일: ${filePath}`;
    return await this.chat(message, [filePath]);
  }

  /**
   * 문서화 생성
   */
  async generateDocumentation(filePath, docType = 'api') {
    const message = `다음 파일에 대한 ${docType} 문서를 생성해주세요:\n\n파일: ${filePath}`;
    return await this.chat(message, [filePath]);
  }
}

export default CursorService;
