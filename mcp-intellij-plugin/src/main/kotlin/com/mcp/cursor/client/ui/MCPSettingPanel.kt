package com.mcp.cursor.client.ui

import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBTextField
import com.intellij.ui.components.JBCheckBox
import com.intellij.util.ui.JBUI
import com.mcp.cursor.client.settings.MCPSettings
import com.mcp.cursor.client.service.MCPService
import kotlinx.coroutines.*
import java.awt.BorderLayout
import java.awt.GridBagConstraints
import java.awt.GridBagLayout
import javax.swing.*

/**
 * MCP 서버 설정 패널
 */
class MCPSettingPanel(private val project: Project) : JPanel() {
    
    private val settings = MCPSettings.getInstance()
    private val mcpservice = MCPService.getInstance(project)
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    // UI 컴포넌트
    private val serverPathField = JBTextField(settings.serverPath).apply {
        toolTipText = "MCP 서버 경로 (예: /Users/username/cursor-server)"
    }
    
    private val serverIpField = JBTextField(settings.serverIp).apply {
        toolTipText = "서버 IP 주소 (기본값: localhost)"
    }
    
    private val serverPortField = JBTextField(settings.serverPort.toString()).apply {
        toolTipText = "서버 포트 번호 (기본값: 3000)"
    }
    
    private val autoConnectCheckBox = JBCheckBox("자동 연결", settings.autoConnect).apply {
        toolTipText = "플러그인 시작 시 자동으로 서버에 연결"
    }
    
    private val showNotificationsCheckBox = JBCheckBox("알림 표시", settings.showNotifications).apply {
        toolTipText = "연결 상태 변경 시 알림 표시"
    }
    
    private val maxTokensField = JBTextField(settings.maxTokens.toString()).apply {
        toolTipText = "최대 토큰 수 (기본값: 4000)"
    }
    
    private val temperatureField = JBTextField(settings.temperature.toString()).apply {
        toolTipText = "응답 창의성 수준 (0.0-2.0, 기본값: 0.7)"
    }
    
    private val statusLabel = JBLabel("설정을 확인하세요").apply {
        foreground = JBUI.CurrentTheme.ContextHelp.FOREGROUND
    }
    
    private val testConnectionButton = JButton("연결 테스트").apply {
        addActionListener { testConnection() }
    }
    
    private val quickSetupButton = JButton("빠른 설정").apply {
        addActionListener { quickSetup() }
    }
    
    private val applyButton = JButton("적용").apply {
        addActionListener { applySettings() }
    }
    
    private val resetButton = JButton("초기화").apply {
        addActionListener { resetSettings() }
    }
    
    init {
        setupUI()
        loadCurrentSettings()
    }
    
    private fun setupUI() {
        layout = BorderLayout()
        
        // 제목 패널
        val titlePanel = JPanel(BorderLayout()).apply {
            add(JLabel("MCP Cursor 서버 설정").apply {
                font = font.deriveFont(16f)
            }, BorderLayout.WEST)
            add(statusLabel, BorderLayout.EAST)
            border = JBUI.Borders.empty(5)
        }
        
        // 설정 패널
        val settingsPanel = createSettingsPanel()
        
        // 버튼 패널
        val buttonPanel = JPanel().apply {
            add(testConnectionButton)
            add(quickSetupButton)
            add(Box.createHorizontalStrut(10))
            add(applyButton)
            add(resetButton)
            border = JBUI.Borders.empty(5)
        }
        
        add(titlePanel, BorderLayout.NORTH)
        add(settingsPanel, BorderLayout.CENTER)
        add(buttonPanel, BorderLayout.SOUTH)
    }
    
    private fun createSettingsPanel(): JPanel {
        val panel = JPanel(GridBagLayout())
        val gbc = GridBagConstraints()
        
        // 서버 경로 설정
        gbc.gridx = 0
        gbc.gridy = 0
        gbc.fill = GridBagConstraints.NONE
        gbc.weightx = 0.0
        panel.add(JBLabel("서버 경로:"), gbc)
        
        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL
        gbc.weightx = 1.0
        panel.add(serverPathField, gbc)
        
        // 서버 IP 설정
        gbc.gridx = 0
        gbc.gridy = 1
        gbc.fill = GridBagConstraints.NONE
        gbc.weightx = 0.0
        panel.add(JBLabel("서버 IP:"), gbc)
        
        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL
        gbc.weightx = 1.0
        panel.add(serverIpField, gbc)
        
        // 서버 포트 설정
        gbc.gridx = 0
        gbc.gridy = 2
        gbc.fill = GridBagConstraints.NONE
        gbc.weightx = 0.0
        panel.add(JBLabel("서버 포트:"), gbc)
        
        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL
        gbc.weightx = 1.0
        panel.add(serverPortField, gbc)
        
        // 자동 연결 설정
        gbc.gridx = 0
        gbc.gridy = 3
        gbc.fill = GridBagConstraints.NONE
        gbc.weightx = 0.0
        panel.add(JBLabel("연결 설정:"), gbc)
        
        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL
        gbc.weightx = 1.0
        panel.add(autoConnectCheckBox, gbc)
        
        // 알림 표시 설정
        gbc.gridx = 0
        gbc.gridy = 4
        gbc.fill = GridBagConstraints.NONE
        gbc.weightx = 0.0
        panel.add(JBLabel(""), gbc) // 빈 라벨
        
        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL
        gbc.weightx = 1.0
        panel.add(showNotificationsCheckBox, gbc)
        
        // 최대 토큰 설정
        gbc.gridx = 0
        gbc.gridy = 5
        gbc.fill = GridBagConstraints.NONE
        gbc.weightx = 0.0
        panel.add(JBLabel("최대 토큰:"), gbc)
        
        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL
        gbc.weightx = 1.0
        panel.add(maxTokensField, gbc)
        
        // 온도 설정
        gbc.gridx = 0
        gbc.gridy = 6
        gbc.fill = GridBagConstraints.NONE
        gbc.weightx = 0.0
        panel.add(JBLabel("온도:"), gbc)
        
        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL
        gbc.weightx = 1.0
        panel.add(temperatureField, gbc)
        
        panel.border = JBUI.Borders.empty(10)
        return panel
    }
    
    private fun loadCurrentSettings() {
        serverPathField.text = settings.serverPath
        serverIpField.text = settings.serverIp
        serverPortField.text = settings.serverPort.toString()
        autoConnectCheckBox.isSelected = settings.autoConnect
        showNotificationsCheckBox.isSelected = settings.showNotifications
        maxTokensField.text = settings.maxTokens.toString()
        temperatureField.text = settings.temperature.toString()
    }
    
    private fun testConnection() {
        scope.launch {
            try {
                statusLabel.text = "연결 테스트 중..."
                statusLabel.foreground = JBUI.CurrentTheme.ContextHelp.FOREGROUND
                
                // 임시 설정으로 연결 테스트
                val originalPath = settings.serverPath
                val originalIp = settings.serverIp
                val originalPort = settings.serverPort
                
                settings.serverPath = serverPathField.text.trim()
                settings.serverIp = serverIpField.text.trim()
                settings.serverPort = serverPortField.text.toIntOrNull() ?: 3000
                settings.updateServerUrl()
                
                mcpservice.setServerPath(settings.serverPath)
                val isConnected = mcpservice.testConnection()
                
                SwingUtilities.invokeLater {
                    if (isConnected) {
                        statusLabel.text = "✅ 연결 성공"
                        statusLabel.foreground = JBUI.CurrentTheme.ContextHelp.FOREGROUND
                        Messages.showInfoMessage(
                            project,
                            "MCP 서버 연결이 성공했습니다!",
                            "연결 테스트 성공"
                        )
                    } else {
                        statusLabel.text = "❌ 연결 실패"
                        statusLabel.foreground = JBUI.CurrentTheme.ContextHelp.FOREGROUND
                        Messages.showErrorDialog(
                            project,
                            "MCP 서버 연결에 실패했습니다.\n서버가 실행 중인지 확인해주세요.",
                            "연결 테스트 실패"
                        )
                    }
                }
                
                // 원래 설정으로 복원
                settings.serverPath = originalPath
                settings.serverIp = originalIp
                settings.serverPort = originalPort
                settings.updateServerUrl()
                
            } catch (e: Exception) {
                SwingUtilities.invokeLater {
                    statusLabel.text = "❌ 연결 오류"
                    statusLabel.foreground = JBUI.CurrentTheme.ContextHelp.FOREGROUND
                    Messages.showErrorDialog(
                        project,
                        "연결 테스트 중 오류가 발생했습니다: ${e.message}",
                        "연결 테스트 오류"
                    )
                }
            }
        }
    }
    
    private fun quickSetup() {
        scope.launch {
            try {
                statusLabel.text = "빠른 설정 중..."
                statusLabel.foreground = JBUI.CurrentTheme.ContextHelp.FOREGROUND
                
                // 가능한 서버 경로들 찾기
                val possibleServerPaths = mutableListOf<String>()
                
                // 현재 프로젝트 경로에서 서버 찾기
                val currentProjectPath = project.basePath
                if (currentProjectPath != null) {
                    val projectDir = java.io.File(currentProjectPath)
                    
                    // 현재 프로젝트가 서버 프로젝트인지 확인
                    if (java.io.File(projectDir, "src/server.js").exists()) {
                        possibleServerPaths.add(projectDir.absolutePath)
                    }
                    
                    // 상위 디렉토리들 확인
                    var parentDir = projectDir.parentFile
                    repeat(3) { // 최대 3단계 상위까지 확인
                        if (parentDir != null) {
                            if (java.io.File(parentDir, "src/server.js").exists()) {
                                possibleServerPaths.add(parentDir.absolutePath)
                            }
                            parentDir = parentDir.parentFile
                        }
                    }
                }
                
                // 기본 경로들 추가
                val defaultPaths = listOf(
                    "/Users/${System.getProperty("user.name")}/Documents/cursor-server",
                    "/Users/${System.getProperty("user.name")}/cursor-server",
                    System.getProperty("user.home") + "/cursor-server"
                )
                
                possibleServerPaths.addAll(defaultPaths)
                
                // 유효한 서버 경로 찾기
                val validServerPath = possibleServerPaths.find { path ->
                    java.io.File(path, "src/server.js").exists()
                }
                
                SwingUtilities.invokeLater {
                    if (validServerPath != null) {
                        // 자동 설정
                        serverPathField.text = validServerPath
                        serverIpField.text = "localhost"
                        serverPortField.text = "3000"
                        
                        statusLabel.text = "✅ 빠른 설정 완료"
                        statusLabel.foreground = JBUI.CurrentTheme.ContextHelp.FOREGROUND
                        
                        Messages.showInfoMessage(
                            project,
                            "✅ MCP 서버가 자동으로 설정되었습니다!\n\n" +
                            "📁 서버 경로: $validServerPath\n" +
                            "🌐 서버 IP: localhost\n" +
                            "🔌 서버 포트: 3000\n\n" +
                            "'연결 테스트' 버튼을 눌러 연결을 확인하세요.",
                            "빠른 설정 완료"
                        )
                    } else {
                        statusLabel.text = "❌ 서버 경로를 찾을 수 없음"
                        statusLabel.foreground = JBUI.CurrentTheme.ContextHelp.FOREGROUND
                        
                        val message = buildString {
                            appendLine("🔧 MCP 서버를 수동으로 설정해주세요.")
                            appendLine()
                            appendLine("📁 **서버 경로 설정 방법:**")
                            appendLine("'서버 경로' 필드에 다음 중 하나를 입력:")
                            appendLine()
                            possibleServerPaths.forEach { path ->
                                appendLine("   • $path")
                            }
                            appendLine()
                            appendLine("💡 **팁:** 서버가 설치된 디렉토리의 절대 경로를 입력하세요.")
                        }
                        
                        Messages.showInfoMessage(
                            project,
                            message,
                            "수동 설정 안내"
                        )
                    }
                }
                
            } catch (e: Exception) {
                SwingUtilities.invokeLater {
                    statusLabel.text = "❌ 빠른 설정 오류"
                    statusLabel.foreground = JBUI.CurrentTheme.ContextHelp.FOREGROUND
                    Messages.showErrorDialog(
                        project,
                        "빠른 설정 중 오류가 발생했습니다: ${e.message}",
                        "빠른 설정 오류"
                    )
                }
            }
        }
    }
    
    private fun applySettings() {
        try {
            // 입력 검증
            val serverPath = serverPathField.text.trim()
            val serverIp = serverIpField.text.trim()
            val serverPort = serverPortField.text.toIntOrNull()
            val maxTokens = maxTokensField.text.toIntOrNull()
            val temperature = temperatureField.text.toDoubleOrNull()
            
            if (serverPath.isEmpty()) {
                Messages.showErrorDialog(project, "서버 경로를 입력해주세요.", "입력 오류")
                return
            }
            
            if (serverIp.isEmpty()) {
                Messages.showErrorDialog(project, "서버 IP를 입력해주세요.", "입력 오류")
                return
            }
            
            if (serverPort == null || serverPort < 1 || serverPort > 65535) {
                Messages.showErrorDialog(project, "유효한 포트 번호를 입력해주세요 (1-65535).", "입력 오류")
                return
            }
            
            if (maxTokens == null || maxTokens < 1) {
                Messages.showErrorDialog(project, "유효한 최대 토큰 수를 입력해주세요.", "입력 오류")
                return
            }
            
            if (temperature == null || temperature < 0.0 || temperature > 2.0) {
                Messages.showErrorDialog(project, "유효한 온도 값을 입력해주세요 (0.0-2.0).", "입력 오류")
                return
            }
            
            // 설정 적용
            settings.serverPath = serverPath
            settings.serverIp = serverIp
            settings.serverPort = serverPort
            settings.autoConnect = autoConnectCheckBox.isSelected
            settings.showNotifications = showNotificationsCheckBox.isSelected
            settings.maxTokens = maxTokens
            settings.temperature = temperature
            settings.updateServerUrl()
            
            // 서버 경로 업데이트
            mcpservice.setServerPath(serverPath)
            
            statusLabel.text = "✅ 설정이 적용되었습니다"
            statusLabel.foreground = JBUI.CurrentTheme.ContextHelp.FOREGROUND
            
            Messages.showInfoMessage(
                project,
                "설정이 성공적으로 적용되었습니다!",
                "설정 적용 완료"
            )
            
        } catch (e: Exception) {
            Messages.showErrorDialog(
                project,
                "설정 적용 중 오류가 발생했습니다: ${e.message}",
                "설정 적용 오류"
            )
        }
    }
    
    private fun resetSettings() {
        val result = Messages.showYesNoDialog(
            project,
            "모든 설정을 기본값으로 초기화하시겠습니까?",
            "설정 초기화",
            "초기화",
            "취소",
            null
        )
        
        if (result == Messages.YES) {
            loadCurrentSettings()
            statusLabel.text = "설정이 초기화되었습니다"
            statusLabel.foreground = JBUI.CurrentTheme.ContextHelp.FOREGROUND
        }
    }
    
    fun dispose() {
        scope.cancel()
    }
}
