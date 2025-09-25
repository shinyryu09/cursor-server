const { EventEmitter } = require('events');
const logger = require('../utils/logger');

/**
 * 세션 매니저 - IDE별 사용자 세션 관리
 */
class SessionManager extends EventEmitter {
    constructor() {
        super();
        this.sessions = new Map(); // sessionId -> session
        this.clientSessions = new Map(); // clientId -> sessionId
        this.ideSessions = new Map(); // ide -> Set<sessionId>
        this.projectSessions = new Map(); // projectPath -> Set<sessionId>
        
        this.sessionTimeout = 30 * 60 * 1000; // 30분
        this.cleanupInterval = 5 * 60 * 1000; // 5분
        this.cleanupTimer = null;
        
        this.startCleanupTask();
    }

    /**
     * 새 세션 생성
     */
    createSession(sessionData) {
        const sessionId = this.generateSessionId();
        const session = {
            id: sessionId,
            clientId: sessionData.clientId,
            ide: sessionData.ide,
            version: sessionData.version,
            capabilities: sessionData.capabilities || {},
            context: {
                workingDirectory: sessionData.workingDirectory,
                projectPath: sessionData.projectPath,
                currentFile: sessionData.currentFile,
                cursorPosition: sessionData.cursorPosition,
                selectedText: sessionData.selectedText,
                openFiles: sessionData.openFiles || []
            },
            state: {
                isInitialized: false,
                lastActivity: new Date(),
                requestCount: 0,
                errorCount: 0
            },
            preferences: {
                language: sessionData.language || 'auto',
                theme: sessionData.theme || 'default',
                autoComplete: sessionData.autoComplete !== false,
                suggestions: sessionData.suggestions || 'smart'
            },
            createdAt: new Date(),
            lastActivity: new Date()
        };

        // 세션 저장
        this.sessions.set(sessionId, session);
        this.clientSessions.set(sessionData.clientId, sessionId);
        
        // IDE별 세션 그룹화
        if (!this.ideSessions.has(session.ide)) {
            this.ideSessions.set(session.ide, new Set());
        }
        this.ideSessions.get(session.ide).add(sessionId);
        
        // 프로젝트별 세션 그룹화
        if (session.context.projectPath) {
            if (!this.projectSessions.has(session.context.projectPath)) {
                this.projectSessions.set(session.context.projectPath, new Set());
            }
            this.projectSessions.get(session.context.projectPath).add(sessionId);
        }

        logger.info(`새 세션 생성: ${sessionId} (${session.ide})`);
        this.emit('sessionCreated', session);
        
        return session;
    }

    /**
     * 세션 조회
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    /**
     * 클라이언트 ID로 세션 조회
     */
    getSessionByClientId(clientId) {
        const sessionId = this.clientSessions.get(clientId);
        return sessionId ? this.sessions.get(sessionId) : null;
    }

    /**
     * 세션 업데이트
     */
    updateSession(sessionId, updates) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }

        // 컨텍스트 업데이트
        if (updates.context) {
            session.context = { ...session.context, ...updates.context };
        }

        // 상태 업데이트
        if (updates.state) {
            session.state = { ...session.state, ...updates.state };
        }

        // 환경설정 업데이트
        if (updates.preferences) {
            session.preferences = { ...session.preferences, ...updates.preferences };
        }

        // 활동 시간 업데이트
        session.lastActivity = new Date();
        session.state.lastActivity = new Date();

        this.sessions.set(sessionId, session);
        this.emit('sessionUpdated', session);
        
        return session;
    }

    /**
     * 세션 컨텍스트 업데이트
     */
    updateSessionContext(sessionId, contextUpdates) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return null;
        }

        const oldProjectPath = session.context.projectPath;
        const newProjectPath = contextUpdates.projectPath;

        // 프로젝트 경로가 변경된 경우
        if (oldProjectPath !== newProjectPath) {
            // 기존 프로젝트에서 세션 제거
            if (oldProjectPath && this.projectSessions.has(oldProjectPath)) {
                this.projectSessions.get(oldProjectPath).delete(sessionId);
                if (this.projectSessions.get(oldProjectPath).size === 0) {
                    this.projectSessions.delete(oldProjectPath);
                }
            }

            // 새 프로젝트에 세션 추가
            if (newProjectPath) {
                if (!this.projectSessions.has(newProjectPath)) {
                    this.projectSessions.set(newProjectPath, new Set());
                }
                this.projectSessions.get(newProjectPath).add(sessionId);
            }
        }

        return this.updateSession(sessionId, { context: contextUpdates });
    }

    /**
     * 세션 활동 기록
     */
    recordActivity(sessionId, activityType, data = {}) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        session.state.lastActivity = new Date();
        session.lastActivity = new Date();
        session.state.requestCount++;

        if (activityType === 'error') {
            session.state.errorCount++;
        }

        // 활동 로그
        const activity = {
            type: activityType,
            timestamp: new Date(),
            data
        };

        if (!session.activities) {
            session.activities = [];
        }
        session.activities.push(activity);

        // 최근 100개 활동만 보관
        if (session.activities.length > 100) {
            session.activities = session.activities.slice(-100);
        }

        this.sessions.set(sessionId, session);
        this.emit('sessionActivity', { sessionId, activity });
    }

    /**
     * 세션 종료
     */
    endSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }

        // 세션 제거
        this.sessions.delete(sessionId);
        this.clientSessions.delete(session.clientId);
        
        // IDE별 세션에서 제거
        if (this.ideSessions.has(session.ide)) {
            this.ideSessions.get(session.ide).delete(sessionId);
            if (this.ideSessions.get(session.ide).size === 0) {
                this.ideSessions.delete(session.ide);
            }
        }
        
        // 프로젝트별 세션에서 제거
        if (session.context.projectPath && this.projectSessions.has(session.context.projectPath)) {
            this.projectSessions.get(session.context.projectPath).delete(sessionId);
            if (this.projectSessions.get(session.context.projectPath).size === 0) {
                this.projectSessions.delete(session.context.projectPath);
            }
        }

        logger.info(`세션 종료: ${sessionId} (${session.ide})`);
        this.emit('sessionEnded', session);
        
        return true;
    }

    /**
     * 클라이언트 연결 해제 시 세션 정리
     */
    handleClientDisconnection(clientId) {
        const sessionId = this.clientSessions.get(clientId);
        if (sessionId) {
            this.endSession(sessionId);
        }
    }

    /**
     * IDE별 세션 조회
     */
    getSessionsByIDE(ide) {
        const sessionIds = this.ideSessions.get(ide) || new Set();
        return Array.from(sessionIds).map(id => this.sessions.get(id)).filter(Boolean);
    }

    /**
     * 프로젝트별 세션 조회
     */
    getSessionsByProject(projectPath) {
        const sessionIds = this.projectSessions.get(projectPath) || new Set();
        return Array.from(sessionIds).map(id => this.sessions.get(id)).filter(Boolean);
    }

    /**
     * 활성 세션 목록 조회
     */
    getActiveSessions() {
        return Array.from(this.sessions.values());
    }

    /**
     * 세션 통계 조회
     */
    getSessionStats() {
        const stats = {
            total: this.sessions.size,
            byIDE: {},
            byProject: {},
            averageRequestCount: 0,
            averageErrorRate: 0
        };

        let totalRequests = 0;
        let totalErrors = 0;

        for (const session of this.sessions.values()) {
            // IDE별 통계
            if (!stats.byIDE[session.ide]) {
                stats.byIDE[session.ide] = 0;
            }
            stats.byIDE[session.ide]++;

            // 프로젝트별 통계
            if (session.context.projectPath) {
                if (!stats.byProject[session.context.projectPath]) {
                    stats.byProject[session.context.projectPath] = 0;
                }
                stats.byProject[session.context.projectPath]++;
            }

            totalRequests += session.state.requestCount;
            totalErrors += session.state.errorCount;
        }

        if (this.sessions.size > 0) {
            stats.averageRequestCount = totalRequests / this.sessions.size;
            stats.averageErrorRate = totalErrors / totalRequests || 0;
        }

        return stats;
    }

    /**
     * 만료된 세션 정리
     */
    cleanupExpiredSessions() {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [sessionId, session] of this.sessions) {
            if (now - session.lastActivity.getTime() > this.sessionTimeout) {
                this.endSession(sessionId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            logger.info(`만료된 세션 ${cleanedCount}개 정리됨`);
        }
    }

    /**
     * 정리 작업 시작
     */
    startCleanupTask() {
        this.cleanupTimer = setInterval(() => {
            this.cleanupExpiredSessions();
        }, this.cleanupInterval);
        
        logger.info('세션 정리 작업이 시작되었습니다');
    }

    /**
     * 정리 작업 중지
     */
    stopCleanupTask() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
            logger.info('세션 정리 작업이 중지되었습니다');
        }
    }

    /**
     * 세션 ID 생성
     */
    generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 세션 매니저 중지
     */
    stop() {
        this.stopCleanupTask();
        
        // 모든 세션 종료
        for (const sessionId of this.sessions.keys()) {
            this.endSession(sessionId);
        }
        
        logger.info('세션 매니저가 중지되었습니다');
    }
}

module.exports = SessionManager;
