import logger from '../utils/logger.js';
import config from '../config/config.js';

/**
 * 캐시 유지보수 서비스 - 백그라운드에서 캐시 정리 및 최적화
 */
export class CacheMaintenanceService {
  constructor(cacheService) {
    this.cacheService = cacheService;
    this.cleanupInterval = null;
    this.isRunning = false;
    this.cleanupIntervalMs = (config.cache?.cleanupInterval || 300) * 1000; // 기본 5분
  }

  /**
   * 서비스 시작
   */
  start() {
    if (this.isRunning) {
      logger.warn('캐시 유지보수 서비스가 이미 실행 중입니다.');
      return;
    }

    this.isRunning = true;
    this.cleanupInterval = setInterval(async () => {
      await this.performMaintenance();
    }, this.cleanupIntervalMs);

    logger.info(`캐시 유지보수 서비스가 시작되었습니다. (정리 간격: ${this.cleanupIntervalMs / 1000}초)`);
  }

  /**
   * 서비스 중지
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('캐시 유지보수 서비스가 실행 중이 아닙니다.');
      return;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.isRunning = false;
    logger.info('캐시 유지보수 서비스가 중지되었습니다.');
  }

  /**
   * 유지보수 작업 수행
   */
  async performMaintenance() {
    try {
      logger.debug('캐시 유지보수 작업 시작');

      // 1. 만료된 캐시 정리
      const expiredCount = await this.cacheService.cleanupExpired();
      if (expiredCount > 0) {
        logger.info(`만료된 캐시 ${expiredCount}개 정리 완료`);
      }

      // 2. 캐시 통계 로깅
      const stats = this.cacheService.getStats();
      if (stats.totalRequests > 0) {
        logger.debug(`캐시 통계 - 히트율: ${stats.hitRate}, 총 요청: ${stats.totalRequests}, 히트: ${stats.hits}, 미스: ${stats.misses}`);
      }

      // 3. 메모리 사용량 확인
      const memoryUsage = process.memoryUsage();
      const memoryUsageMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
      
      if (memoryUsageMB > 500) { // 500MB 이상 사용시 경고
        logger.warn(`높은 메모리 사용량 감지: ${memoryUsageMB}MB`);
        
        // 메모리 캐시 크기 줄이기
        const currentSize = this.cacheService.memoryCache.size;
        const targetSize = Math.floor(currentSize * 0.7); // 30% 줄이기
        
        if (currentSize > targetSize) {
          await this.reduceMemoryCacheSize(targetSize);
          logger.info(`메모리 캐시 크기 조정: ${currentSize} → ${this.cacheService.memoryCache.size}`);
        }
      }

      // 4. 디스크 캐시 크기 확인
      await this.checkDiskCacheSize();

      logger.debug('캐시 유지보수 작업 완료');

    } catch (error) {
      logger.error('캐시 유지보수 작업 오류:', error);
    }
  }

  /**
   * 메모리 캐시 크기 줄이기
   */
  async reduceMemoryCacheSize(targetSize) {
    const entries = Array.from(this.cacheService.memoryCache.entries());
    
    // 접근 횟수와 타임스탬프 기준으로 정렬 (LRU)
    entries.sort((a, b) => {
      const [, itemA] = a;
      const [, itemB] = b;
      
      if (itemA.accessCount !== itemB.accessCount) {
        return itemA.accessCount - itemB.accessCount; // 접근 횟수 적은 것부터
      }
      return itemA.timestamp - itemB.timestamp; // 오래된 것부터
    });

    // 초과분 삭제
    const toDelete = entries.slice(0, entries.length - targetSize);
    for (const [key] of toDelete) {
      this.cacheService.memoryCache.delete(key);
    }
  }

  /**
   * 디스크 캐시 크기 확인
   */
  async checkDiskCacheSize() {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const files = await fs.readdir(this.cacheService.cacheDir);
      const cacheFiles = files.filter(file => file.endsWith('.json'));
      
      if (cacheFiles.length > this.cacheService.maxDiskSize) {
        logger.warn(`디스크 캐시 크기 초과: ${cacheFiles.length}/${this.cacheService.maxDiskSize}`);
        
        // 디스크 캐시 정리 실행
        await this.cacheService.cleanupDiskCache();
      }
    } catch (error) {
      logger.error('디스크 캐시 크기 확인 오류:', error);
    }
  }

  /**
   * 수동 유지보수 실행
   */
  async runMaintenance() {
    logger.info('수동 캐시 유지보수 실행');
    await this.performMaintenance();
  }

  /**
   * 서비스 상태 조회
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      cleanupIntervalMs: this.cleanupIntervalMs,
      nextCleanupIn: this.cleanupInterval ? this.cleanupIntervalMs : null
    };
  }

  /**
   * 정리 간격 변경
   */
  setCleanupInterval(intervalMs) {
    if (intervalMs < 60000) { // 최소 1분
      throw new Error('정리 간격은 최소 1분(60000ms) 이상이어야 합니다.');
    }

    this.cleanupIntervalMs = intervalMs;

    if (this.isRunning) {
      // 서비스 재시작
      this.stop();
      this.start();
    }

    logger.info(`캐시 정리 간격이 ${intervalMs / 1000}초로 변경되었습니다.`);
  }
}

export default CacheMaintenanceService;
