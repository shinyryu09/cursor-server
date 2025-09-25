const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const logger = require('../utils/logger');

/**
 * Stdio 어댑터 - 프로세스 간 통신을 위한 표준 입출력 처리
 */
class StdioAdapter extends EventEmitter {
    constructor() {
        super();
        this.process = null;
        this.isRunning = false;
        this.buffer = '';
        this.requestId = 0;
        this.pendingRequests = new Map();
    }

    /**
     * Stdio 프로세스 시작
     */
    async start(command = 'node', args = ['src/server.js', 'stdio']) {
        return new Promise((resolve, reject) => {
            try {
                logger.info(`Stdio 프로세스 시작: ${command} ${args.join(' ')}`);
                
                this.process = spawn(command, args, {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    cwd: process.cwd()
                });

                this.isRunning = true;

                // 표준 출력 처리
                this.process.stdout.on('data', (data) => {
                    this.handleStdout(data);
                });

                // 표준 오류 처리
                this.process.stderr.on('data', (data) => {
                    logger.error('Stdio 프로세스 오류:', data.toString());
                });

                // 프로세스 종료 처리
                this.process.on('close', (code) => {
                    logger.info(`Stdio 프로세스 종료: 코드 ${code}`);
                    this.isRunning = false;
                    this.emit('processClosed', code);
                });

                // 프로세스 오류 처리
                this.process.on('error', (error) => {
                    logger.error('Stdio 프로세스 시작 오류:', error);
                    this.isRunning = false;
                    reject(error);
                });

                // 초기화 완료 대기
                setTimeout(() => {
                    if (this.isRunning) {
                        logger.info('Stdio 어댑터가 시작되었습니다');
                        resolve();
                    } else {
                        reject(new Error('Stdio 프로세스 시작 실패'));
                    }
                }, 1000);

            } catch (error) {
                logger.error('Stdio 어댑터 시작 실패:', error);
                reject(error);
            }
        });
    }

    /**
     * 표준 출력 데이터 처리
     */
    handleStdout(data) {
        this.buffer += data.toString();
        
        // 완전한 JSON 메시지들을 파싱
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || ''; // 마지막 불완전한 라인은 버퍼에 보관

        for (const line of lines) {
            if (line.trim()) {
                try {
                    const message = JSON.parse(line);
                    this.handleMessage(message);
                } catch (error) {
                    logger.error('Stdio 메시지 파싱 오류:', error, 'Line:', line);
                }
            }
        }
    }

    /**
     * 메시지 처리
     */
    handleMessage(message) {
        logger.debug('Stdio 메시지 수신:', message);

        // 응답 메시지인 경우
        if (message.id && this.pendingRequests.has(message.id)) {
            const { resolve, reject } = this.pendingRequests.get(message.id);
            this.pendingRequests.delete(message.id);

            if (message.error) {
                reject(new Error(message.error.message || 'Unknown error'));
            } else {
                resolve(message.result);
            }
            return;
        }

        // 알림 메시지인 경우
        if (message.method) {
            this.emit('notification', message);
            return;
        }

        // 기타 메시지
        this.emit('message', message);
    }

    /**
     * MCP 요청 전송
     */
    async sendRequest(method, params = {}, timeout = 30000) {
        return new Promise((resolve, reject) => {
            if (!this.isRunning || !this.process) {
                reject(new Error('Stdio 프로세스가 실행 중이 아닙니다'));
                return;
            }

            const id = ++this.requestId;
            const request = {
                jsonrpc: '2.0',
                method,
                params,
                id
            };

            // 타임아웃 설정
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`요청 타임아웃: ${method}`));
            }, timeout);

            // 요청 저장
            this.pendingRequests.set(id, {
                resolve: (result) => {
                    clearTimeout(timeoutId);
                    resolve(result);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });

            // 요청 전송
            try {
                const requestStr = JSON.stringify(request) + '\n';
                this.process.stdin.write(requestStr);
                logger.debug('Stdio 요청 전송:', request);
            } catch (error) {
                this.pendingRequests.delete(id);
                clearTimeout(timeoutId);
                reject(error);
            }
        });
    }

    /**
     * MCP 알림 전송
     */
    sendNotification(method, params = {}) {
        if (!this.isRunning || !this.process) {
            logger.warn('Stdio 프로세스가 실행 중이 아닙니다');
            return;
        }

        const notification = {
            jsonrpc: '2.0',
            method,
            params
        };

        try {
            const notificationStr = JSON.stringify(notification) + '\n';
            this.process.stdin.write(notificationStr);
            logger.debug('Stdio 알림 전송:', notification);
        } catch (error) {
            logger.error('Stdio 알림 전송 오류:', error);
        }
    }

    /**
     * 초기화 요청
     */
    async initialize(clientInfo = {}) {
        const params = {
            protocolVersion: '2024-11-05',
            capabilities: {
                tools: {},
                resources: {},
                prompts: {}
            },
            clientInfo: {
                name: 'stdio-client',
                version: '1.0.0',
                ...clientInfo
            }
        };

        return await this.sendRequest('initialize', params);
    }

    /**
     * 도구 목록 조회
     */
    async listTools() {
        return await this.sendRequest('tools/list');
    }

    /**
     * 도구 실행
     */
    async callTool(name, arguments_ = {}) {
        return await this.sendRequest('tools/call', {
            name,
            arguments: arguments_
        });
    }

    /**
     * 리소스 목록 조회
     */
    async listResources() {
        return await this.sendRequest('resources/list');
    }

    /**
     * 리소스 읽기
     */
    async readResource(uri) {
        return await this.sendRequest('resources/read', { uri });
    }

    /**
     * 프롬프트 목록 조회
     */
    async listPrompts() {
        return await this.sendRequest('prompts/list');
    }

    /**
     * 프롬프트 가져오기
     */
    async getPrompt(name, arguments_ = {}) {
        return await this.sendRequest('prompts/get', {
            name,
            arguments: arguments_
        });
    }

    /**
     * 프로세스 상태 확인
     */
    isProcessRunning() {
        return this.isRunning && this.process && !this.process.killed;
    }

    /**
     * 대기 중인 요청 수
     */
    getPendingRequestCount() {
        return this.pendingRequests.size;
    }

    /**
     * Stdio 어댑터 중지
     */
    async stop() {
        return new Promise((resolve) => {
            if (this.process) {
                // 대기 중인 모든 요청 취소
                for (const [id, { reject }] of this.pendingRequests) {
                    reject(new Error('프로세스 종료로 인한 요청 취소'));
                }
                this.pendingRequests.clear();

                // 프로세스 종료
                this.process.kill('SIGTERM');
                
                // 강제 종료 대기
                setTimeout(() => {
                    if (this.process && !this.process.killed) {
                        this.process.kill('SIGKILL');
                    }
                    this.isRunning = false;
                    logger.info('Stdio 어댑터가 중지되었습니다');
                    resolve();
                }, 5000);
            } else {
                resolve();
            }
        });
    }
}

module.exports = StdioAdapter;
