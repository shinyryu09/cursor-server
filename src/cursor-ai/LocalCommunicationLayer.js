const { spawn, exec } = require('child_process');
const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

/**
 * 로컬 통신 레이어 - IPC, HTTP/gRPC API, Shared Memory
 */
class LocalCommunicationLayer extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            cursorPath: '/Applications/Cursor.app',
            enableIPC: true,
            enableHTTP: true,
            enableSharedMemory: false,
            httpPort: 3002,
            ...config
        };

        this.processes = new Map();
        this.httpServer = null;
        this.sharedMemory = new Map();
        this.isRunning = false;
    }

    /**
     * 로컬 통신 레이어 시작
     */
    async start() {
        try {
            logger.info('로컬 통신 레이어 시작 중...');

            // 1. Cursor AI 프로세스 확인
            await this.checkCursorAIProcess();

            // 2. IPC 통신 설정
            if (this.config.enableIPC) {
                await this.setupIPC();
                logger.info('IPC 통신 설정 완료');
            }

            // 3. HTTP API 서버 시작
            if (this.config.enableHTTP) {
                await this.setupHTTP();
                logger.info('HTTP API 서버 시작 완료');
            }

            // 4. Shared Memory 설정
            if (this.config.enableSharedMemory) {
                await this.setupSharedMemory();
                logger.info('Shared Memory 설정 완료');
            }

            this.isRunning = true;
            logger.info('로컬 통신 레이어가 성공적으로 시작되었습니다');

        } catch (error) {
            logger.error('로컬 통신 레이어 시작 실패:', error);
            throw error;
        }
    }

    /**
     * Cursor AI 프로세스 확인
     */
    async checkCursorAIProcess() {
        try {
            // Cursor AI 프로세스가 실행 중인지 확인
            const isRunning = await this.isCursorAIRunning();
            
            if (!isRunning) {
                logger.warn('Cursor AI 프로세스가 실행 중이 아닙니다');
                // 필요시 Cursor AI 프로세스 시작
                await this.startCursorAI();
            } else {
                logger.info('Cursor AI 프로세스가 실행 중입니다');
            }

        } catch (error) {
            logger.error('Cursor AI 프로세스 확인 오류:', error);
            throw error;
        }
    }

    /**
     * Cursor AI 프로세스 실행 상태 확인
     */
    async isCursorAIRunning() {
        return new Promise((resolve) => {
            exec('pgrep -f "Cursor"', (error, stdout) => {
                if (error) {
                    resolve(false);
                } else {
                    resolve(stdout.trim().length > 0);
                }
            });
        });
    }

    /**
     * Cursor AI 프로세스 시작
     */
    async startCursorAI() {
        return new Promise((resolve, reject) => {
            logger.info('Cursor AI 프로세스 시작 중...');
            
            const cursorProcess = spawn('open', [this.config.cursorPath], {
                detached: true,
                stdio: 'ignore'
            });

            cursorProcess.on('error', (error) => {
                logger.error('Cursor AI 프로세스 시작 오류:', error);
                reject(error);
            });

            cursorProcess.on('spawn', () => {
                logger.info('Cursor AI 프로세스가 시작되었습니다');
                resolve();
            });

            // 프로세스 ID 저장
            this.processes.set('cursor-ai', cursorProcess);
        });
    }

    /**
     * IPC 통신 설정
     */
    async setupIPC() {
        // Cursor AI와의 IPC 통신 설정
        // 실제 구현에서는 Cursor AI의 IPC API를 사용
        logger.info('IPC 통신 설정 완료');
    }

    /**
     * HTTP API 서버 설정
     */
    async setupHTTP() {
        const express = require('express');
        const app = express();
        
        app.use(express.json());
        app.use(express.urlencoded({ extended: true }));

        // Cursor AI API 엔드포인트들
        app.post('/api/refactor', this.handleRefactorRequest.bind(this));
        app.post('/api/complete', this.handleCompleteRequest.bind(this));
        app.post('/api/explain', this.handleExplainRequest.bind(this));
        app.post('/api/generate-test', this.handleGenerateTestRequest.bind(this));
        app.post('/api/analyze', this.handleAnalyzeRequest.bind(this));
        app.post('/api/review', this.handleReviewRequest.bind(this));

        // 상태 확인 엔드포인트
        app.get('/api/status', (req, res) => {
            res.json({
                status: 'running',
                timestamp: new Date(),
                processes: Array.from(this.processes.keys())
            });
        });

        // 서버 시작
        this.httpServer = app.listen(this.config.httpPort, () => {
            logger.info(`HTTP API 서버가 시작되었습니다: http://localhost:${this.config.httpPort}`);
        });

        this.httpServer.on('error', (error) => {
            logger.error('HTTP API 서버 오류:', error);
        });
    }

    /**
     * Shared Memory 설정
     */
    async setupSharedMemory() {
        // Shared Memory를 통한 고속 데이터 교환
        // 실제 구현에서는 Node.js의 SharedArrayBuffer나 다른 메커니즘 사용
        logger.info('Shared Memory 설정 완료');
    }

    /**
     * 리팩토링 요청 처리
     */
    async handleRefactorRequest(req, res) {
        try {
            const { language, code, refactorType, context } = req.body;
            
            const result = await this.requestCursorAI({
                action: 'refactor',
                language,
                code,
                refactorType,
                context
            });

            res.json({
                success: true,
                result
            });

        } catch (error) {
            logger.error('리팩토링 요청 처리 오류:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * 코드 완성 요청 처리
     */
    async handleCompleteRequest(req, res) {
        try {
            const { language, code, context } = req.body;
            
            const result = await this.requestCursorAI({
                action: 'complete',
                language,
                code,
                context
            });

            res.json({
                success: true,
                result
            });

        } catch (error) {
            logger.error('코드 완성 요청 처리 오류:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * 코드 설명 요청 처리
     */
    async handleExplainRequest(req, res) {
        try {
            const { language, code, context } = req.body;
            
            const result = await this.requestCursorAI({
                action: 'explain',
                language,
                code,
                context
            });

            res.json({
                success: true,
                result
            });

        } catch (error) {
            logger.error('코드 설명 요청 처리 오류:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * 테스트 생성 요청 처리
     */
    async handleGenerateTestRequest(req, res) {
        try {
            const { language, code, testType, context } = req.body;
            
            const result = await this.requestCursorAI({
                action: 'generate_test',
                language,
                code,
                testType,
                context
            });

            res.json({
                success: true,
                result
            });

        } catch (error) {
            logger.error('테스트 생성 요청 처리 오류:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * 코드 분석 요청 처리
     */
    async handleAnalyzeRequest(req, res) {
        try {
            const { language, code, analysisType, context } = req.body;
            
            const result = await this.requestCursorAI({
                action: 'analyze',
                language,
                code,
                analysisType,
                context
            });

            res.json({
                success: true,
                result
            });

        } catch (error) {
            logger.error('코드 분석 요청 처리 오류:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * 코드 리뷰 요청 처리
     */
    async handleReviewRequest(req, res) {
        try {
            const { language, code, context } = req.body;
            
            const result = await this.requestCursorAI({
                action: 'review',
                language,
                code,
                context
            });

            res.json({
                success: true,
                result
            });

        } catch (error) {
            logger.error('코드 리뷰 요청 처리 오류:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    /**
     * Cursor AI 요청
     */
    async requestCursorAI(request) {
        // Cursor AI Engine으로 요청 전달
        this.emit('cursorAIRequest', request);

        // 실제 구현에서는 Cursor AI의 실제 API를 호출
        // 여기서는 임시 응답 반환
        return this.generateMockResponse(request);
    }

    /**
     * 임시 응답 생성 (실제 구현에서는 Cursor AI 응답 사용)
     */
    generateMockResponse(request) {
        const { action, language, code } = request;

        switch (action) {
            case 'refactor':
                return {
                    code: `// 리팩토링된 ${language} 코드\n${code}`,
                    changes: [
                        { type: 'extract_method', description: '메서드 추출' }
                    ],
                    suggestions: ['추가 리팩토링 제안']
                };

            case 'complete':
                return {
                    completions: [
                        { text: 'completion1', type: 'method' },
                        { text: 'completion2', type: 'property' }
                    ],
                    suggestions: ['완성 제안']
                };

            case 'explain':
                return {
                    explanation: `${language} 코드 설명`,
                    examples: ['예제 코드'],
                    relatedConcepts: ['관련 개념']
                };

            case 'generate_test':
                return {
                    testCode: `// ${language} 테스트 코드`,
                    testCases: ['테스트 케이스'],
                    setupCode: '설정 코드'
                };

            case 'analyze':
                return {
                    analysis: '코드 분석 결과',
                    issues: ['발견된 문제'],
                    suggestions: ['개선 제안'],
                    complexity: { score: 5, level: 'medium' }
                };

            case 'review':
                return {
                    review: '코드 리뷰 결과',
                    issues: ['리뷰 이슈'],
                    suggestions: ['개선 제안'],
                    score: 8.5
                };

            default:
                return { result: '처리 완료' };
        }
    }

    /**
     * 프로세스 상태 조회
     */
    getProcessStatus() {
        const status = {};
        for (const [name, process] of this.processes) {
            status[name] = {
                pid: process.pid,
                killed: process.killed,
                connected: process.connected
            };
        }
        return status;
    }

    /**
     * HTTP 서버 상태 조회
     */
    getHTTPServerStatus() {
        if (!this.httpServer) {
            return { status: 'not_started' };
        }

        return {
            status: 'running',
            port: this.config.httpPort,
            address: this.httpServer.address()
        };
    }

    /**
     * 로컬 통신 레이어 통계 조회
     */
    getStats() {
        return {
            isRunning: this.isRunning,
            processes: this.getProcessStatus(),
            httpServer: this.getHTTPServerStatus(),
            sharedMemory: {
                enabled: this.config.enableSharedMemory,
                size: this.sharedMemory.size
            }
        };
    }

    /**
     * 로컬 통신 레이어 중지
     */
    async stop() {
        try {
            logger.info('로컬 통신 레이어 중지 중...');

            this.isRunning = false;

            // HTTP 서버 중지
            if (this.httpServer) {
                await new Promise((resolve) => {
                    this.httpServer.close(resolve);
                });
                logger.info('HTTP API 서버 중지 완료');
            }

            // 프로세스들 종료
            for (const [name, process] of this.processes) {
                if (!process.killed) {
                    process.kill('SIGTERM');
                }
            }

            logger.info('로컬 통신 레이어가 중지되었습니다');

        } catch (error) {
            logger.error('로컬 통신 레이어 중지 오류:', error);
            throw error;
        }
    }
}

module.exports = LocalCommunicationLayer;
