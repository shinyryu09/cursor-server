import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ES modules에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// .env 파일 로드
dotenv.config({ path: join(__dirname, '../../.env') });

export const config = {
  // 서버 설정
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
    environment: process.env.NODE_ENV || 'development'
  },

  // MCP 설정
  mcp: {
    name: 'mcp-cursor-server',
    version: '2.0.0',
    description: 'MCP server for Xcode, Android Studio integration with Cursor CLI and multiple AI models'
  },

  // AI 모델 설정
  ai: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307']
    },
    google: {
      apiKey: process.env.GOOGLE_API_KEY,
      models: ['gemini-pro', 'gemini-pro-vision']
    },
    cursor: {
      apiKey: process.env.CURSOR_API_KEY,
      baseURL: process.env.CURSOR_BASE_URL || 'https://api.cursor.com/v1',
      models: ['cursor-small', 'gpt-4', 'claude-3-5-sonnet-20241022']
    }
  },

  // 프로젝트 감지 설정
  projects: {
    xcode: {
      extensions: ['.xcodeproj', '.xcworkspace'],
      searchPaths: [
        process.env.HOME + '/Documents',
        process.env.HOME + '/Desktop',
        process.env.HOME + '/Projects',
        process.env.HOME + '/Development'
      ]
    },
    android: {
      extensions: ['.gradle', 'build.gradle', 'settings.gradle'],
      searchPaths: [
        process.env.HOME + '/Documents',
        process.env.HOME + '/Desktop',
        process.env.HOME + '/Projects',
        process.env.HOME + '/Development',
        process.env.HOME + '/AndroidStudioProjects'
      ]
    },
    flutter: {
      extensions: ['pubspec.yaml', 'analysis_options.yaml'],
      searchPaths: [
        process.env.HOME + '/Documents',
        process.env.HOME + '/Desktop',
        process.env.HOME + '/Projects',
        process.env.HOME + '/Development',
        process.env.HOME + '/FlutterProjects',
        process.env.HOME + '/AndroidStudioProjects'
      ]
    }
  },

  // 로깅 설정
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined'
  },

  // Cursor CLI 설정
  cursor: {
    timeout: 30000,
    maxRetries: 3,
    workingDirectory: process.env.CURSOR_WORKING_DIR || process.cwd()
  },

  // 캐시 설정
  cache: {
    enabled: process.env.CACHE_ENABLED !== 'false', // 기본값: true
    maxMemorySize: parseInt(process.env.CACHE_MAX_MEMORY_SIZE) || 100, // 메모리 캐시 최대 항목 수
    maxDiskSize: parseInt(process.env.CACHE_MAX_DISK_SIZE) || 1000, // 디스크 캐시 최대 항목 수
    defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL) || 3600, // 기본 TTL (초)
    cleanupInterval: parseInt(process.env.CACHE_CLEANUP_INTERVAL) || 300, // 정리 간격 (초)
    
    // Redis 캐시 설정 (선택적)
    redis: {
      enabled: process.env.CACHE_REDIS_ENABLED === 'true',
      host: process.env.CACHE_REDIS_HOST || 'localhost',
      port: parseInt(process.env.CACHE_REDIS_PORT) || 6379,
      password: process.env.CACHE_REDIS_PASSWORD,
      db: parseInt(process.env.CACHE_REDIS_DB) || 0,
      ttl: parseInt(process.env.CACHE_REDIS_TTL) || 3600
    },

    // 캐시 전략 설정
    strategy: {
      // AI 응답 캐시 설정
      aiResponse: {
        enabled: process.env.CACHE_AI_RESPONSE !== 'false',
        ttl: parseInt(process.env.CACHE_AI_RESPONSE_TTL) || 3600,
        includeContext: process.env.CACHE_INCLUDE_CONTEXT !== 'false'
      },
      
      // 코드 생성 캐시 설정
      codeGeneration: {
        enabled: process.env.CACHE_CODE_GENERATION !== 'false',
        ttl: parseInt(process.env.CACHE_CODE_GENERATION_TTL) || 7200,
        includeLanguage: true,
        includeFramework: true
      },
      
      // 코드 리뷰 캐시 설정
      codeReview: {
        enabled: process.env.CACHE_CODE_REVIEW !== 'false',
        ttl: parseInt(process.env.CACHE_CODE_REVIEW_TTL) || 1800,
        includeCodeHash: true
      }
    }
  }
};

export default config;
