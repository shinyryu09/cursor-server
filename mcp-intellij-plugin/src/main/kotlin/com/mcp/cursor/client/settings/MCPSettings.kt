package com.mcp.cursor.client.settings

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.util.xmlb.XmlSerializerUtil

/**
 * MCP Cursor 설정 저장소
 */
@Service(Service.Level.PROJECT)
@State(
    name = "MCPSettings",
    storages = [Storage("mcp-cursor-settings.xml")]
)
class MCPSettings : PersistentStateComponent<MCPSettings> {
    
    // 서버 설정을 IP와 포트로 분리
    var serverIp: String = "localhost"
    var serverPort: Int = 3000
    var serverUrl: String = "http://localhost:3000" // 호환성을 위해 유지
    var serverPath: String = "" // MCP 서버 경로
    
    var autoConnect: Boolean = true
    var showNotifications: Boolean = true
    var maxTokens: Int = 1000
    var temperature: Double = 0.7
    var defaultModel: String = "gpt-4"
    var enableCodeGeneration: Boolean = true
    var enableCodeAnalysis: Boolean = true
    var enableChat: Boolean = true
    
    // IP와 포트가 변경될 때 URL 자동 업데이트
    fun updateServerUrl() {
        serverUrl = "http://$serverIp:$serverPort"
    }
    
    override fun getState(): MCPSettings = this
    
    override fun loadState(state: MCPSettings) {
        XmlSerializerUtil.copyBean(state, this)
    }
    
    companion object {
        fun getInstance(): MCPSettings {
            return ApplicationManager.getApplication().getService(MCPSettings::class.java)
        }
    }
}

