/**
 * MCP (Model Context Protocol) 타입 정의
 */

// MCP 메시지 타입
export const MCP_MESSAGE_TYPES = {
  REQUEST: 'request',
  RESPONSE: 'response',
  NOTIFICATION: 'notification'
};

// MCP 메서드 타입
export const MCP_METHODS = {
  // 핵심 메서드
  INITIALIZE: 'initialize',
  PING: 'ping',
  
  // 리소스 메서드
  RESOURCES_LIST: 'resources/list',
  RESOURCES_READ: 'resources/read',
  RESOURCES_SUBSCRIBE: 'resources/subscribe',
  RESOURCES_UNSUBSCRIBE: 'resources/unsubscribe',
  
  // 도구 메서드
  TOOLS_LIST: 'tools/list',
  TOOLS_CALL: 'tools/call',
  
  // 프롬프트 메서드
  PROMPTS_LIST: 'prompts/list',
  PROMPTS_GET: 'prompts/get',
  
  // 채팅 메서드
  CHAT_COMPLETION: 'chat/completion',
  CHAT_STREAM: 'chat/stream'
};

// MCP 에러 코드
export const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_ERROR: -32000
};

// MCP 메시지 구조
export class MCPMessage {
  constructor(id, method, params = null) {
    this.jsonrpc = '2.0';
    this.id = id;
    this.method = method;
    if (params !== null) {
      this.params = params;
    }
  }
}

export class MCPRequest extends MCPMessage {
  constructor(id, method, params = null) {
    super(id, method, params);
  }
}

export class MCPResponse {
  constructor(id, result = null, error = null) {
    this.jsonrpc = '2.0';
    this.id = id;
    if (error) {
      this.error = error;
    } else {
      this.result = result;
    }
  }
}

export class MCPNotification {
  constructor(method, params = null) {
    this.jsonrpc = '2.0';
    this.method = method;
    if (params !== null) {
      this.params = params;
    }
  }
}

// MCP 에러 클래스
export class MCPError extends Error {
  constructor(code, message, data = null) {
    super(message);
    this.code = code;
    this.data = data;
  }
  
  toJSON() {
    return {
      code: this.code,
      message: this.message,
      data: this.data
    };
  }
}

// 프로젝트 타입
export const PROJECT_TYPES = {
  XCODE: 'xcode',
  ANDROID: 'android',
  UNKNOWN: 'unknown'
};

// AI 모델 타입
export const AI_MODEL_TYPES = {
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GOOGLE: 'google',
  CURSOR: 'cursor'
};
