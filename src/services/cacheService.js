import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from '../utils/logger.js';
import config from '../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 캐시 서비스 - 토큰 사용량 최적화를 위한 다층 캐시 시스템
 */
export class CacheService {
  constructor() {
    this.memoryCache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      memoryHits: 0,
      diskHits: 0,
      redisHits: 0,
      totalRequests: 0
    };
    
    // 캐시 디렉토리 설정
    this.cacheDir = join(__dirname, '../../cache');
    this.maxMemorySize = config.cache?.maxMemorySize || 100; // 메모리 캐시 최대 항목 수
    this.defaultTTL = config.cache?.defaultTTL || 3600; // 기본 TTL (초)
    this.maxDiskSize = config.cache?.maxDiskSize || 1000; // 디스크 캐시 최대 항목 수
    
    this.initializeCache();
  }

  /**
   * 캐시 초기화
   */
  async initializeCache() {
    try {
      // 캐시 디렉토리 생성
      await fs.mkdir(this.cacheDir, { recursive: true });
      
      // 기존 디스크 캐시 로드
      await this.loadDiskCache();
      
      logger.info('캐시 서비스 초기화 완료');
    } catch (error) {
      logger.error('캐시 초기화 오류:', error);
    }
  }

  /**
   * 캐시 키 생성
   */
  generateCacheKey(request) {
    const { message, model, context, type = 'chat' } = request;
    
    // 요청 내용을 정규화하여 일관된 키 생성
    const normalizedRequest = {
      type,
      model,
      message: message.trim(),
      context: context ? context.trim() : ''
    };
    
    const keyString = JSON.stringify(normalizedRequest);
    return crypto.createHash('sha256').update(keyString).digest('hex');
  }

  /**
   * 캐시에서 데이터 조회
   */
  async get(key) {
    this.cacheStats.totalRequests++;
    
    try {
      // 1. 메모리 캐시에서 조회
      const memoryResult = this.getFromMemory(key);
      if (memoryResult) {
        this.cacheStats.hits++;
        this.cacheStats.memoryHits++;
        logger.debug(`메모리 캐시 히트: ${key.substring(0, 8)}...`);
        return memoryResult;
      }

      // 2. 디스크 캐시에서 조회
      const diskResult = await this.getFromDisk(key);
      if (diskResult) {
        this.cacheStats.hits++;
        this.cacheStats.diskHits++;
        
        // 메모리 캐시에도 저장 (LRU)
        this.setToMemory(key, diskResult);
        
        logger.debug(`디스크 캐시 히트: ${key.substring(0, 8)}...`);
        return diskResult;
      }

      // 3. Redis 캐시에서 조회 (설정된 경우)
      if (config.cache?.redis?.enabled) {
        const redisResult = await this.getFromRedis(key);
        if (redisResult) {
          this.cacheStats.hits++;
          this.cacheStats.redisHits++;
          
          // 메모리와 디스크 캐시에도 저장
          this.setToMemory(key, redisResult);
          await this.setToDisk(key, redisResult);
          
          logger.debug(`Redis 캐시 히트: ${key.substring(0, 8)}...`);
          return redisResult;
        }
      }

      this.cacheStats.misses++;
      logger.debug(`캐시 미스: ${key.substring(0, 8)}...`);
      return null;

    } catch (error) {
      logger.error('캐시 조회 오류:', error);
      this.cacheStats.misses++;
      return null;
    }
  }

  /**
   * 캐시에 데이터 저장
   */
  async set(key, data, ttl = null) {
    try {
      const cacheData = {
        data,
        timestamp: Date.now(),
        ttl: ttl || this.defaultTTL,
        accessCount: 0
      };

      // 메모리 캐시에 저장
      this.setToMemory(key, cacheData);

      // 디스크 캐시에 저장
      await this.setToDisk(key, cacheData);

      // Redis 캐시에 저장 (설정된 경우)
      if (config.cache?.redis?.enabled) {
        await this.setToRedis(key, cacheData);
      }

      logger.debug(`캐시 저장 완료: ${key.substring(0, 8)}...`);
    } catch (error) {
      logger.error('캐시 저장 오류:', error);
    }
  }

  /**
   * 메모리 캐시에서 조회
   */
  getFromMemory(key) {
    const item = this.memoryCache.get(key);
    if (!item) return null;

    // TTL 확인
    if (this.isExpired(item)) {
      this.memoryCache.delete(key);
      return null;
    }

    // 접근 횟수 증가
    item.accessCount++;
    return item;
  }

  /**
   * 메모리 캐시에 저장
   */
  setToMemory(key, data) {
    // LRU 정책으로 메모리 캐시 크기 관리
    if (this.memoryCache.size >= this.maxMemorySize) {
      const oldestKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(oldestKey);
    }

    this.memoryCache.set(key, data);
  }

  /**
   * 디스크 캐시에서 조회
   */
  async getFromDisk(key) {
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      const fileContent = await fs.readFile(filePath, 'utf8');
      const item = JSON.parse(fileContent);

      // TTL 확인
      if (this.isExpired(item)) {
        await fs.unlink(filePath);
        return null;
      }

      // 접근 횟수 증가
      item.accessCount++;
      
      // 파일 업데이트
      await fs.writeFile(filePath, JSON.stringify(item), 'utf8');
      
      return item;
    } catch (error) {
      // 파일이 없거나 읽기 오류
      return null;
    }
  }

  /**
   * 디스크 캐시에 저장
   */
  async setToDisk(key, data) {
    try {
      const filePath = path.join(this.cacheDir, `${key}.json`);
      await fs.writeFile(filePath, JSON.stringify(data), 'utf8');
      
      // 디스크 캐시 크기 관리
      await this.cleanupDiskCache();
    } catch (error) {
      logger.error('디스크 캐시 저장 오류:', error);
    }
  }

  /**
   * Redis 캐시에서 조회 (선택적)
   */
  async getFromRedis(key) {
    // Redis 구현은 필요시 추가
    // 현재는 기본 구현만 제공
    return null;
  }

  /**
   * Redis 캐시에 저장 (선택적)
   */
  async setToRedis(key, data) {
    // Redis 구현은 필요시 추가
    // 현재는 기본 구현만 제공
  }

  /**
   * TTL 만료 확인
   */
  isExpired(item) {
    const now = Date.now();
    const expirationTime = item.timestamp + (item.ttl * 1000);
    return now > expirationTime;
  }

  /**
   * 디스크 캐시 정리
   */
  async cleanupDiskCache() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const cacheFiles = files.filter(file => file.endsWith('.json'));
      
      if (cacheFiles.length <= this.maxDiskSize) return;

      // 파일 정보 수집
      const fileInfos = [];
      for (const file of cacheFiles) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        const content = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(content);
        
        fileInfos.push({
          file,
          path: filePath,
          accessCount: data.accessCount || 0,
          timestamp: data.timestamp,
          size: stats.size
        });
      }

      // 접근 횟수와 타임스탬프 기준으로 정렬
      fileInfos.sort((a, b) => {
        if (a.accessCount !== b.accessCount) {
          return a.accessCount - b.accessCount; // 접근 횟수 적은 것부터
        }
        return a.timestamp - b.timestamp; // 오래된 것부터
      });

      // 초과분 삭제
      const toDelete = fileInfos.slice(0, cacheFiles.length - this.maxDiskSize);
      for (const fileInfo of toDelete) {
        await fs.unlink(fileInfo.path);
        logger.debug(`디스크 캐시 정리: ${fileInfo.file} 삭제`);
      }

    } catch (error) {
      logger.error('디스크 캐시 정리 오류:', error);
    }
  }

  /**
   * 기존 디스크 캐시 로드
   */
  async loadDiskCache() {
    try {
      const files = await fs.readdir(this.cacheDir);
      const cacheFiles = files.filter(file => file.endsWith('.json'));
      
      logger.info(`${cacheFiles.length}개의 디스크 캐시 파일 로드됨`);
    } catch (error) {
      logger.error('디스크 캐시 로드 오류:', error);
    }
  }

  /**
   * 캐시 삭제
   */
  async delete(key) {
    try {
      // 메모리 캐시에서 삭제
      this.memoryCache.delete(key);

      // 디스크 캐시에서 삭제
      const filePath = path.join(this.cacheDir, `${key}.json`);
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // 파일이 없을 수 있음
      }

      // Redis 캐시에서 삭제 (설정된 경우)
      if (config.cache?.redis?.enabled) {
        await this.deleteFromRedis(key);
      }

      logger.debug(`캐시 삭제 완료: ${key.substring(0, 8)}...`);
    } catch (error) {
      logger.error('캐시 삭제 오류:', error);
    }
  }

  /**
   * Redis 캐시에서 삭제
   */
  async deleteFromRedis(key) {
    // Redis 구현은 필요시 추가
  }

  /**
   * 캐시 전체 삭제
   */
  async clear() {
    try {
      // 메모리 캐시 삭제
      this.memoryCache.clear();

      // 디스크 캐시 삭제
      const files = await fs.readdir(this.cacheDir);
      const cacheFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of cacheFiles) {
        await fs.unlink(path.join(this.cacheDir, file));
      }

      // Redis 캐시 삭제 (설정된 경우)
      if (config.cache?.redis?.enabled) {
        await this.clearRedis();
      }

      // 통계 초기화
      this.cacheStats = {
        hits: 0,
        misses: 0,
        memoryHits: 0,
        diskHits: 0,
        redisHits: 0,
        totalRequests: 0
      };

      logger.info('캐시 전체 삭제 완료');
    } catch (error) {
      logger.error('캐시 전체 삭제 오류:', error);
    }
  }

  /**
   * Redis 캐시 전체 삭제
   */
  async clearRedis() {
    // Redis 구현은 필요시 추가
  }

  /**
   * 캐시 통계 조회
   */
  getStats() {
    const hitRate = this.cacheStats.totalRequests > 0 
      ? (this.cacheStats.hits / this.cacheStats.totalRequests * 100).toFixed(2)
      : 0;

    return {
      ...this.cacheStats,
      hitRate: `${hitRate}%`,
      memorySize: this.memoryCache.size,
      maxMemorySize: this.maxMemorySize,
      maxDiskSize: this.maxDiskSize,
      defaultTTL: this.defaultTTL
    };
  }

  /**
   * 캐시 상태 확인
   */
  getStatus() {
    return {
      memory: {
        size: this.memoryCache.size,
        maxSize: this.maxMemorySize,
        utilization: `${((this.memoryCache.size / this.maxMemorySize) * 100).toFixed(1)}%`
      },
      disk: {
        enabled: true,
        directory: this.cacheDir,
        maxSize: this.maxDiskSize
      },
      redis: {
        enabled: config.cache?.redis?.enabled || false
      },
      stats: this.getStats()
    };
  }

  /**
   * 만료된 캐시 정리
   */
  async cleanupExpired() {
    try {
      let cleanedCount = 0;

      // 메모리 캐시 정리
      for (const [key, item] of this.memoryCache.entries()) {
        if (this.isExpired(item)) {
          this.memoryCache.delete(key);
          cleanedCount++;
        }
      }

      // 디스크 캐시 정리
      const files = await fs.readdir(this.cacheDir);
      const cacheFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of cacheFiles) {
        const filePath = path.join(this.cacheDir, file);
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const item = JSON.parse(content);
          
          if (this.isExpired(item)) {
            await fs.unlink(filePath);
            cleanedCount++;
          }
        } catch (error) {
          // 파일 읽기 오류시 삭제
          await fs.unlink(filePath);
          cleanedCount++;
        }
      }

      logger.info(`만료된 캐시 ${cleanedCount}개 정리 완료`);
      return cleanedCount;
    } catch (error) {
      logger.error('만료된 캐시 정리 오류:', error);
      return 0;
    }
  }
}

export default CacheService;
