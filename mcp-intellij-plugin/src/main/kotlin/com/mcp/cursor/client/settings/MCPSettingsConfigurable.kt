package com.mcp.cursor.client.settings

import com.intellij.openapi.options.Configurable
import com.intellij.openapi.options.ConfigurationException
import com.intellij.openapi.project.ProjectManager
import com.intellij.ui.components.JBCheckBox
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.JBUI
import com.mcp.cursor.client.service.MCPService
import kotlinx.coroutines.*
import java.awt.BorderLayout
import java.awt.GridBagConstraints
import java.awt.GridBagLayout
import javax.swing.*

/**
 * MCP Cursor 설정 페이지
 */
class MCPSettingsConfigurable : Configurable {
    
    private val settings = MCPSettings.getInstance()
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    // 서버 설정을 IP와 포트로 분리
    private val serverIpField = JBTextField(settings.serverIp).apply {
        toolTipText = "서버 IP 주소 (예: localhost, 192.168.1.100)"
    }
    private val serverPortField = JBTextField(settings.serverPort.toString()).apply {
        toolTipText = "서버 포트 번호 (예: 3000, 8080)"
    }
    private val serverPathField = JBTextField(settings.serverPath).apply {
        toolTipText = "MCP 서버 경로 (예: /Users/username/cursor-server)"
    }
    private val autoConnectCheckBox = JBCheckBox("자동 연결", settings.autoConnect).apply {
        toolTipText = "플러그인 시작 시 자동으로 서버에 연결"
    }
    private val showNotificationsCheckBox = JBCheckBox("알림 표시", settings.showNotifications).apply {
        toolTipText = "연결 상태 변경 시 알림 표시"
    }
    private val maxTokensField = JBTextField(settings.maxTokens.toString()).apply {
        toolTipText = "AI 응답의 최대 토큰 수 (1-10000)"
    }
    private val temperatureField = JBTextField(settings.temperature.toString()).apply {
        toolTipText = "AI 응답의 창의성 수준 (0.0-2.0)"
    }
    
    private val testConnectionButton = JButton("연결 테스트")
    private val statusLabel = JLabel("상태: 확인되지 않음")
    
    override fun getDisplayName(): String = "MCP Cursor"
    
    override fun createComponent(): JComponent {
        val mainPanel = JPanel(BorderLayout())
        
        // 제목 패널
        val titlePanel = JPanel(BorderLayout()).apply {
            add(JLabel("MCP Cursor Server 설정").apply {
                font = font.deriveFont(16f)
            }, BorderLayout.WEST)
        }
        mainPanel.add(titlePanel, BorderLayout.NORTH)
        
        // 설정 패널
        val settingsPanel = createSettingsPanel()
        mainPanel.add(settingsPanel, BorderLayout.CENTER)
        
        // 하단 패널 (테스트 및 상태)
        val bottomPanel = createBottomPanel()
        mainPanel.add(bottomPanel, BorderLayout.SOUTH)
        
        return mainPanel
    }
    
    private fun createSettingsPanel(): JPanel {
        val panel = JPanel(GridBagLayout())
        val gbc = GridBagConstraints()
        
        // 서버 IP 설정
        gbc.gridx = 0
        gbc.gridy = 0
        gbc.anchor = GridBagConstraints.WEST
        gbc.insets = JBUI.insets(5)
        panel.add(JBLabel("서버 IP:"), gbc)
        
        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL
        gbc.weightx = 1.0
        panel.add(serverIpField, gbc)
        
        // 서버 포트 설정
        gbc.gridx = 0
        gbc.gridy = 1
        gbc.fill = GridBagConstraints.NONE
        gbc.weightx = 0.0
        panel.add(JBLabel("서버 포트:"), gbc)
        
        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL
        gbc.weightx = 1.0
        panel.add(serverPortField, gbc)
        
        // 서버 경로 설정
        gbc.gridx = 0
        gbc.gridy = 2
        gbc.fill = GridBagConstraints.NONE
        gbc.weightx = 0.0
        panel.add(JBLabel("서버 경로:"), gbc)
        
        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL
        gbc.weightx = 1.0
        panel.add(serverPathField, gbc)
        
        // 자동 연결 설정
        gbc.gridx = 0
        gbc.gridy = 3
        gbc.fill = GridBagConstraints.NONE
        gbc.weightx = 0.0
        panel.add(autoConnectCheckBox, gbc)
        
        // 알림 표시 설정
        gbc.gridx = 0
        gbc.gridy = 4
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
        panel.add(JBLabel("온도 (0.0-2.0):"), gbc)
        
        gbc.gridx = 1
        gbc.fill = GridBagConstraints.HORIZONTAL
        gbc.weightx = 1.0
        panel.add(temperatureField, gbc)
        
        return panel
    }
    
    private fun createBottomPanel(): JPanel {
        val panel = JPanel(BorderLayout())
        
        val buttonPanel = JPanel().apply {
            add(testConnectionButton)
        }
        
        panel.add(buttonPanel, BorderLayout.WEST)
        panel.add(statusLabel, BorderLayout.EAST)
        
        // 연결 테스트 버튼 이벤트
        testConnectionButton.addActionListener {
            testConnection()
        }
        
        return panel
    }
    
    private fun testConnection() {
        testConnectionButton.isEnabled = false
        testConnectionButton.text = "테스트 중..."
        statusLabel.text = "상태: 테스트 중..."
        
        scope.launch {
            try {
                val project = ProjectManager.getInstance().defaultProject
                val mcpservice = MCPService.getInstance(project)
                
                // IP와 포트로 서버 URL 구성
                val serverUrl = "http://${serverIpField.text.trim()}:${serverPortField.text.trim()}"
                mcpservice.setServerUrl(serverUrl)
                mcpservice.setServerPath(serverPathField.text.trim())
                
                // 연결 테스트
                val isConnected = mcpservice.testConnection()
                
                SwingUtilities.invokeLater {
                    if (isConnected) {
                        statusLabel.text = "상태: 연결됨 ✅"
                        statusLabel.foreground = java.awt.Color.GREEN.darker()
                    } else {
                        statusLabel.text = "상태: 연결 실패 ❌"
                        statusLabel.foreground = java.awt.Color.RED.darker()
                    }
                    
                    testConnectionButton.isEnabled = true
                    testConnectionButton.text = "연결 테스트"
                }
                
            } catch (e: Exception) {
                SwingUtilities.invokeLater {
                    statusLabel.text = "상태: 오류 발생 ❌"
                    statusLabel.foreground = java.awt.Color.RED.darker()
                    testConnectionButton.isEnabled = true
                    testConnectionButton.text = "연결 테스트"
                }
            }
        }
    }
    
    override fun isModified(): Boolean {
        return serverIpField.text != settings.serverIp ||
               serverPortField.text != settings.serverPort.toString() ||
               serverPathField.text != settings.serverPath ||
               autoConnectCheckBox.isSelected != settings.autoConnect ||
               showNotificationsCheckBox.isSelected != settings.showNotifications ||
               maxTokensField.text != settings.maxTokens.toString() ||
               temperatureField.text != settings.temperature.toString()
    }
    
    @Throws(ConfigurationException::class)
    override fun apply() {
        try {
            // IP와 포트 설정
            settings.serverIp = serverIpField.text.trim()
            settings.serverPort = serverPortField.text.toIntOrNull() ?: 3000
            settings.serverPath = serverPathField.text.trim()
            settings.updateServerUrl() // URL 자동 업데이트
            
            settings.autoConnect = autoConnectCheckBox.isSelected
            settings.showNotifications = showNotificationsCheckBox.isSelected
            settings.maxTokens = maxTokensField.text.toIntOrNull() ?: 1000
            settings.temperature = temperatureField.text.toDoubleOrNull() ?: 0.7
            
            // 포트 범위 검증
            if (settings.serverPort < 1 || settings.serverPort > 65535) {
                throw ConfigurationException("포트는 1과 65535 사이의 값이어야 합니다.")
            }
            
            // 온도 범위 검증
            if (settings.temperature < 0.0 || settings.temperature > 2.0) {
                throw ConfigurationException("온도는 0.0과 2.0 사이의 값이어야 합니다.")
            }
            
            // 최대 토큰 범위 검증
            if (settings.maxTokens < 1 || settings.maxTokens > 10000) {
                throw ConfigurationException("최대 토큰은 1과 10000 사이의 값이어야 합니다.")
            }
            
        } catch (e: NumberFormatException) {
            throw ConfigurationException("숫자 형식이 올바르지 않습니다.")
        }
    }
    
    override fun reset() {
        serverIpField.text = settings.serverIp
        serverPortField.text = settings.serverPort.toString()
        serverPathField.text = settings.serverPath
        autoConnectCheckBox.isSelected = settings.autoConnect
        showNotificationsCheckBox.isSelected = settings.showNotifications
        maxTokensField.text = settings.maxTokens.toString()
        temperatureField.text = settings.temperature.toString()
    }
    
    override fun disposeUIResources() {
        scope.cancel()
    }
}

