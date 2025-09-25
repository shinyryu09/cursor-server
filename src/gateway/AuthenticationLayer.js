const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * 인증 레이어 - 토큰 검증 및 로컬 인증
 */
class AuthenticationLayer {
    constructor() {
        this.tokens = new Map(); // token -> clientInfo
        this.sessions = new Map(); // sessionId -> sessionInfo
        this.tokenExpiry = new Map(); // token -> expiry time
        this.defaultTokenExpiry = 24 * 60 * 60 * 1000; // 24시간
    }

    /**
     * 토큰 생성
     */
    generateToken(clientInfo = {}) {
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = Date.now() + this.defaultTokenExpiry;
        
        this.tokens.set(token, {
            ...clientInfo,
            createdAt: new Date(),
            lastUsed: new Date()
        });
        
        this.tokenExpiry.set(token, expiry);
        
        logger.info(`새 토큰 생성: ${token.substring(0, 8)}... (${clientInfo.ide || 'unknown'})`);
        
        return {
            token,
            expiry: new Date(expiry),
            clientInfo
        };
    }

    /**
     * IDE별 기본 토큰 생성
     */
    generateIDETokens() {
        const tokens = {};
        
        // Xcode 토큰
        tokens.xcode = this.generateToken({
            ide: 'xcode',
            capabilities: ['swift', 'objectivec', 'ios'],
            permissions: ['read', 'write', 'execute']
        });

        // Android Studio 토큰
        tokens.androidStudio = this.generateToken({
            ide: 'android-studio',
            capabilities: ['kotlin', 'java', 'android'],
            permissions: ['read', 'write', 'execute']
        });

        // IntelliJ 토큰
        tokens.intellij = this.generateToken({
            ide: 'intellij',
            capabilities: ['java', 'kotlin', 'scala'],
            permissions: ['read', 'write', 'execute']
        });

        // VS Code 토큰
        tokens.vscode = this.generateToken({
            ide: 'vscode',
            capabilities: ['javascript', 'typescript', 'python'],
            permissions: ['read', 'write', 'execute']
        });

        logger.info('IDE별 기본 토큰 생성 완료');
        return tokens;
    }

    /**
     * 토큰 검증
     */
    validateToken(token) {
        if (!token) {
            return { valid: false, error: '토큰이 제공되지 않았습니다' };
        }

        // 토큰 존재 확인
        if (!this.tokens.has(token)) {
            return { valid: false, error: '유효하지 않은 토큰입니다' };
        }

        // 토큰 만료 확인
        const expiry = this.tokenExpiry.get(token);
        if (expiry && Date.now() > expiry) {
            this.revokeToken(token);
            return { valid: false, error: '토큰이 만료되었습니다' };
        }

        // 토큰 정보 업데이트
        const clientInfo = this.tokens.get(token);
        clientInfo.lastUsed = new Date();
        this.tokens.set(token, clientInfo);

        return {
            valid: true,
            clientInfo
        };
    }

    /**
     * 세션 생성
     */
    createSession(token, additionalInfo = {}) {
        const tokenValidation = this.validateToken(token);
        if (!tokenValidation.valid) {
            throw new Error(tokenValidation.error);
        }

        const sessionId = crypto.randomUUID();
        const session = {
            id: sessionId,
            token,
            clientInfo: tokenValidation.clientInfo,
            createdAt: new Date(),
            lastActivity: new Date(),
            ...additionalInfo
        };

        this.sessions.set(sessionId, session);
        
        logger.info(`새 세션 생성: ${sessionId} (${session.clientInfo.ide})`);
        
        return session;
    }

    /**
     * 세션 검증
     */
    validateSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return { valid: false, error: '유효하지 않은 세션입니다' };
        }

        // 토큰 재검증
        const tokenValidation = this.validateToken(session.token);
        if (!tokenValidation.valid) {
            this.sessions.delete(sessionId);
            return { valid: false, error: '세션 토큰이 유효하지 않습니다' };
        }

        // 세션 활동 시간 업데이트
        session.lastActivity = new Date();
        this.sessions.set(sessionId, session);

        return {
            valid: true,
            session
        };
    }

    /**
     * 권한 확인
     */
    checkPermission(sessionId, permission) {
        const sessionValidation = this.validateSession(sessionId);
        if (!sessionValidation.valid) {
            return { allowed: false, error: sessionValidation.error };
        }

        const session = sessionValidation.session;
        const permissions = session.clientInfo.permissions || [];

        if (!permissions.includes(permission)) {
            return { 
                allowed: false, 
                error: `권한이 없습니다: ${permission}` 
            };
        }

        return { allowed: true, session };
    }

    /**
     * IDE별 권한 확인
     */
    checkIDEPermission(sessionId, ide, action) {
        const sessionValidation = this.validateSession(sessionId);
        if (!sessionValidation.valid) {
            return { allowed: false, error: sessionValidation.error };
        }

        const session = sessionValidation.session;
        
        // IDE 일치 확인
        if (session.clientInfo.ide !== ide) {
            return { 
                allowed: false, 
                error: `IDE 불일치: ${session.clientInfo.ide} != ${ide}` 
            };
        }

        // 액션별 권한 확인
        const actionPermissions = {
            'read': ['read'],
            'write': ['read', 'write'],
            'execute': ['read', 'write', 'execute'],
            'refactor': ['read', 'write'],
            'complete': ['read'],
            'explain': ['read']
        };

        const requiredPermissions = actionPermissions[action] || ['read'];
        const userPermissions = session.clientInfo.permissions || [];

        for (const permission of requiredPermissions) {
            if (!userPermissions.includes(permission)) {
                return { 
                    allowed: false, 
                    error: `권한 부족: ${action}에 필요한 ${permission} 권한이 없습니다` 
                };
            }
        }

        return { allowed: true, session };
    }

    /**
     * 토큰 취소
     */
    revokeToken(token) {
        if (this.tokens.has(token)) {
            this.tokens.delete(token);
            this.tokenExpiry.delete(token);
            
            // 해당 토큰을 사용하는 세션들도 제거
            for (const [sessionId, session] of this.sessions) {
                if (session.token === token) {
                    this.sessions.delete(sessionId);
                }
            }
            
            logger.info(`토큰 취소됨: ${token.substring(0, 8)}...`);
        }
    }

    /**
     * 세션 종료
     */
    endSession(sessionId) {
        if (this.sessions.has(sessionId)) {
            this.sessions.delete(sessionId);
            logger.info(`세션 종료됨: ${sessionId}`);
        }
    }

    /**
     * 만료된 토큰 정리
     */
    cleanupExpiredTokens() {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [token, expiry] of this.tokenExpiry) {
            if (now > expiry) {
                this.revokeToken(token);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            logger.info(`만료된 토큰 ${cleanedCount}개 정리됨`);
        }
    }

    /**
     * 비활성 세션 정리
     */
    cleanupInactiveSessions(maxInactiveTime = 60 * 60 * 1000) { // 1시간
        const now = Date.now();
        let cleanedCount = 0;

        for (const [sessionId, session] of this.sessions) {
            if (now - session.lastActivity.getTime() > maxInactiveTime) {
                this.sessions.delete(sessionId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            logger.info(`비활성 세션 ${cleanedCount}개 정리됨`);
        }
    }

    /**
     * 활성 토큰 목록 조회
     */
    getActiveTokens() {
        const activeTokens = [];
        for (const [token, clientInfo] of this.tokens) {
            const expiry = this.tokenExpiry.get(token);
            activeTokens.push({
                token: token.substring(0, 8) + '...',
                clientInfo,
                expiry: expiry ? new Date(expiry) : null,
                isExpired: expiry ? Date.now() > expiry : false
            });
        }
        return activeTokens;
    }

    /**
     * 활성 세션 목록 조회
     */
    getActiveSessions() {
        return Array.from(this.sessions.values());
    }

    /**
     * 통계 정보 조회
     */
    getStats() {
        return {
            activeTokens: this.tokens.size,
            activeSessions: this.sessions.size,
            pendingRequests: 0 // TODO: 구현 필요
        };
    }

    /**
     * 정기 정리 작업 시작
     */
    startCleanupTask(interval = 5 * 60 * 1000) { // 5분마다
        setInterval(() => {
            this.cleanupExpiredTokens();
            this.cleanupInactiveSessions();
        }, interval);
        
        logger.info('인증 레이어 정리 작업이 시작되었습니다');
    }
}

module.exports = AuthenticationLayer;
