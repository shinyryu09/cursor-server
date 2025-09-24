package com.mcp.cursor.client.service

import com.google.gson.Gson
import com.google.gson.JsonObject
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.thisLogger
import com.intellij.openapi.project.Project
import com.mcp.cursor.client.settings.MCPSettings
import kotlinx.coroutines.*
import java.io.*
import java.nio.file.Paths

/**
 * MCP Cursor Server와의 통신을 담당하는 서비스
 * MCP 프로토콜을 사용하여 stdio로 통신
 */
@Service(Service.Level.PROJECT)
class MCPService {
    
    private val logger = thisLogger()
    private val gson = Gson()
    private val settings = MCPSettings.getInstance()
    
    // MCP 프로세스 관련
    private var mcpProcess: Process? = null
    private var processWriter: PrintWriter? = null
    private var processReader: BufferedReader? = null
    private var isConnected = false
    private var availableModels = mutableListOf<ModelInfo>()
    private var requestId = 0
    
    init {
        try {
            logger.info("MCPService 초기화 시작")
            logger.info("MCPService 초기화 완료")
        } catch (e: Exception) {
            logger.error("MCPService 초기화 실패", e)
        }
    }
    
    data class ModelInfo(
        val id: String,
        val name: String,
        val type: String,
        val available: Boolean,
        val description: String? = null
    )
    
    companion object {
        @JvmStatic
        fun getInstance(project: Project): MCPService {
            return project.getService(MCPService::class.java)
        }
    }
    
    /**
     * MCP 서버 프로세스 시작
     */
    private fun startMCPProcess(): Boolean {
        return try {
            val serverPath = settings.serverPath
            logger.info("서버 경로: $serverPath")
            
            if (serverPath.isBlank()) {
                logger.error("서버 경로가 설정되지 않았습니다")
                return false
            }
            
            val serverDir = File(serverPath)
            if (!serverDir.exists()) {
                logger.error("서버 디렉토리가 존재하지 않습니다: $serverPath")
                return false
            }
            
            val serverJsFile = File(serverDir, "src/server.js")
            if (!serverJsFile.exists()) {
                logger.error("서버 파일이 존재하지 않습니다: ${serverJsFile.absolutePath}")
                return false
            }
            
            // 기존 프로세스가 있으면 중지
            stopMCPProcess()
            
            logger.info("MCP 서버 프로세스 시작 시도: ${serverDir.absolutePath}")
            
            val processBuilder = ProcessBuilder("node", "src/server.js", "mcp")
                .directory(serverDir)
                .redirectErrorStream(true)
            
            mcpProcess = processBuilder.start()
            processWriter = PrintWriter(mcpProcess!!.outputStream, true)
            processReader = BufferedReader(InputStreamReader(mcpProcess!!.inputStream))
            
            // 프로세스가 정상적으로 시작되었는지 확인
            Thread.sleep(2000) // 2초 대기 (더 충분한 시간)
            
            if (mcpProcess?.isAlive == true) {
                logger.info("MCP 서버 프로세스 시작 성공: $serverPath (PID: ${mcpProcess!!.pid()})")
                
                // 프로세스 출력을 읽어서 초기화 완료 확인
                val startTime = System.currentTimeMillis()
                val timeout = 5000L // 5초 타임아웃
                
                while (System.currentTimeMillis() - startTime < timeout) {
                    if (processReader?.ready() == true) {
                        val line = processReader?.readLine()
                        if (line != null) {
                            logger.info("MCP Server Output: $line")
                            if (line.contains("MCP 서버가 stdio 모드로 시작되었습니다") || 
                                line.contains("MCP server started") ||
                                line.contains("ready")) {
                                logger.info("MCP 서버 초기화 완료 감지")
                                return true
                            }
                        }
                    }
                    Thread.sleep(100)
                }
                
                // 타임아웃이 발생해도 프로세스가 살아있으면 성공으로 간주
                if (mcpProcess?.isAlive == true) {
                    logger.info("MCP 서버 프로세스가 실행 중입니다 (타임아웃 후 확인)")
                    return true
                }
                
                return false
            } else {
                logger.error("MCP 서버 프로세스가 시작되지 않았습니다")
                return false
            }
        } catch (e: Exception) {
            logger.error("MCP 서버 프로세스 시작 실패", e)
            return false
        }
    }
    
    /**
     * MCP 서버 프로세스 중지
     */
    private fun stopMCPProcess() {
        try {
            processWriter?.close()
            processReader?.close()
            mcpProcess?.destroy()
            mcpProcess = null
            processWriter = null
            processReader = null
            isConnected = false
            logger.info("MCP 서버 프로세스 중지됨")
        } catch (e: Exception) {
            logger.error("MCP 서버 프로세스 중지 실패", e)
        }
    }
    
    /**
     * MCP JSON-RPC 요청 전송
     */
    private fun sendMCPRequest(method: String, params: JsonObject = JsonObject()): JsonObject? {
        return try {
            if (processWriter == null || processReader == null) {
                logger.error("MCP 프로세스가 시작되지 않았습니다")
                return null
            }
            
            if (mcpProcess?.isAlive != true) {
                logger.error("MCP 프로세스가 실행되지 않고 있습니다")
                return null
            }
            
            val request = JsonObject().apply {
                addProperty("jsonrpc", "2.0")
                addProperty("id", ++requestId)
                addProperty("method", method)
                add("params", params)
            }
            
            val requestJson = gson.toJson(request)
            logger.info("MCP 요청 전송 (ID: ${requestId}): $requestJson")
            
            processWriter?.println(requestJson)
            processWriter?.flush()
            
            // 응답 읽기 (타임아웃 적용)
            val startTime = System.currentTimeMillis()
            val timeout = 15000L // 15초 타임아웃 (더 긴 시간)
            
            while (System.currentTimeMillis() - startTime < timeout) {
                if (processReader?.ready() == true) {
                    val responseLine = processReader?.readLine()
                    if (responseLine != null && responseLine.isNotBlank()) {
                        logger.info("MCP 응답 수신 (ID: ${requestId}): $responseLine")
                        
                        try {
                            val response = gson.fromJson(responseLine, JsonObject::class.java)
                            
                            // 응답 ID 확인
                            if (response.has("id") && response.get("id").asInt == requestId) {
                                return response
                            } else if (response.has("method")) {
                                // 서버에서 보낸 알림인 경우 무시하고 계속 대기
                                logger.info("서버 알림 수신: ${response.get("method").asString}")
                                continue
                            }
                        } catch (e: Exception) {
                            logger.warn("JSON 파싱 오류: $responseLine", e)
                            continue
                        }
                    }
                }
                Thread.sleep(200) // 200ms 대기 (더 자주 체크)
            }
            
            logger.error("MCP 응답 타임아웃 (${timeout}ms) - 요청 ID: ${requestId}")
            null
        } catch (e: Exception) {
            logger.error("MCP 요청 전송 실패", e)
            null
        }
    }
    
    /**
     * MCP 서버 연결 테스트
     */
    suspend fun testConnection(): Boolean = withContext(Dispatchers.IO) {
        try {
            logger.info("MCP 서버 연결 테스트 시작")
            
            // 기존 프로세스가 있으면 중지
            stopMCPProcess()
            
            // 새 프로세스 시작
            if (!startMCPProcess()) {
                logger.error("MCP 프로세스 시작 실패")
                return@withContext false
            }
            
            // 프로세스가 완전히 시작될 때까지 대기
            Thread.sleep(3000) // 3초 대기
            
            // Initialize 요청 전송
            val initParams = JsonObject().apply {
                addProperty("protocolVersion", "2024-11-05")
                add("capabilities", JsonObject().apply {
                    add("resources", JsonObject().apply {
                        addProperty("subscribe", true)
                        addProperty("listChanged", true)
                    })
                    add("tools", JsonObject().apply {
                        addProperty("listChanged", true)
                    })
                    add("prompts", JsonObject().apply {
                        addProperty("listChanged", true)
                    })
                })
                add("clientInfo", JsonObject().apply {
                    addProperty("name", "mcp-cursor-plugin")
                    addProperty("version", "1.0.8")
                })
            }
            
            logger.info("MCP 초기화 요청 전송")
            val response = sendMCPRequest("initialize", initParams)
            
            if (response != null && response.has("result")) {
                val result = response.getAsJsonObject("result")
                logger.info("MCP 서버 초기화 성공: ${result.toString()}")
                
                isConnected = true
                logger.info("MCP 서버 연결 성공")
                
                // 모델 로드 시도
                try {
                    loadAvailableModels()
                } catch (e: Exception) {
                    logger.warn("모델 로드 실패 (연결은 성공): ${e.message}")
                }
                
                return@withContext true
            } else if (response != null && response.has("error")) {
                val error = response.getAsJsonObject("error")
                logger.error("MCP 서버 초기화 오류: ${error.get("message").asString}")
                stopMCPProcess()
                return@withContext false
            } else {
                logger.error("MCP 서버 초기화 실패 - 응답이 없음")
                stopMCPProcess()
                return@withContext false
            }
        } catch (e: Exception) {
            logger.error("MCP 서버 연결 테스트 실패", e)
            stopMCPProcess()
            return@withContext false
        }
    }
    
    /**
     * 사용 가능한 AI 모델 목록 로드
     */
    suspend fun loadAvailableModels() = withContext(Dispatchers.IO) {
        try {
            if (!isConnected) {
                logger.warn("MCP 서버에 연결되지 않음")
                return@withContext
            }
            
            // 리소스 목록 요청
            val response = sendMCPRequest("resources/list")
            if (response != null && response.has("result")) {
                val result = response.getAsJsonObject("result")
                val resources = result.getAsJsonArray("resources")
                
                availableModels.clear()
                
                // ai://models 리소스 찾기
                for (resource in resources) {
                    val resourceObj = resource.asJsonObject
                    val uri = resourceObj.get("uri").asString
                    
                    if (uri == "ai://models") {
                        // 모델 정보 읽기
                        val readResponse = sendMCPRequest("resources/read", JsonObject().apply {
                            addProperty("uri", "ai://models")
                        })
                        
                        if (readResponse != null && readResponse.has("result")) {
                            val readResult = readResponse.getAsJsonObject("result")
                            val contents = readResult.getAsJsonArray("contents")
                            
                            for (content in contents) {
                                val contentObj = content.asJsonObject
                                val text = contentObj.get("text").asString
                                
                                // JSON 파싱
                                val modelsJson = gson.fromJson(text, JsonObject::class.java)
                                val models = modelsJson.getAsJsonArray("models")
                                
                                for (model in models) {
                                    val modelObj = model.asJsonObject
                                    val modelInfo = ModelInfo(
                                        id = modelObj.get("id").asString,
                                        name = modelObj.get("name").asString,
                                        type = modelObj.get("type").asString,
                                        available = modelObj.get("available").asBoolean,
                                        description = if (modelObj.has("description")) modelObj.get("description").asString else null
                                    )
                                    availableModels.add(modelInfo)
                                }
                            }
                        }
                        break
                    }
                }
                
                logger.info("사용 가능한 모델 ${availableModels.size}개 로드됨")
            }
        } catch (e: Exception) {
            logger.error("모델 목록 로드 오류", e)
        }
    }
    
    /**
     * 사용 가능한 AI 모델 목록 반환
     */
    fun getAvailableModels(): List<ModelInfo> {
        return availableModels.toList()
    }
    
    /**
     * AI 채팅 요청
     */
    suspend fun sendChatMessage(message: String, model: String = "cursor-default"): String = withContext(Dispatchers.IO) {
        try {
            if (!isConnected) {
                return@withContext "MCP 서버에 연결되지 않았습니다."
            }
            
            // 도구 호출 요청
            val params = JsonObject().apply {
                addProperty("name", "chat")
                add("arguments", JsonObject().apply {
                    addProperty("message", message)
                    addProperty("model", model)
                })
            }
            
            val response = sendMCPRequest("tools/call", params)
            if (response != null && response.has("result")) {
                val result = response.getAsJsonObject("result")
                if (result.has("content")) {
                    val content = result.getAsJsonArray("content")
                    if (content.size() > 0) {
                        val firstContent = content.get(0).asJsonObject
                        if (firstContent.has("text")) {
                            return@withContext firstContent.get("text").asString
                        }
                    }
                }
            }
            
            return@withContext "응답을 받을 수 없습니다."
        } catch (e: Exception) {
            logger.error("채팅 메시지 전송 오류", e)
            return@withContext "오류가 발생했습니다: ${e.message}"
        }
    }
    
    /**
     * 연결 상태 확인
     */
    fun isConnected(): Boolean {
        return isConnected && mcpProcess?.isAlive == true
    }
    
    /**
     * 서버 URL 설정 (호환성을 위해 유지)
     */
    fun getServerUrl(): String {
        return settings.serverUrl
    }
    
    /**
     * 서버 경로 가져오기
     */
    fun getServerPath(): String {
        return settings.serverPath
    }
    
    /**
     * 서버 경로 설정
     */
    fun setServerPath(path: String) {
        settings.serverPath = path
        stopMCPProcess() // 경로 변경 시 기존 연결 끊기
    }
    
    /**
     * 리소스 정리
     */
    fun cleanup() {
        stopMCPProcess()
    }
    
    fun setServerUrl(url: String) {
        settings.serverUrl = url
    }
}