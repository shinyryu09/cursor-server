package com.mcp.cursor.client.ui

import com.intellij.openapi.project.Project
import com.intellij.ui.JBSplitter
import com.intellij.ui.components.JBScrollPane
import com.intellij.ui.components.JBTextArea
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.JBUI
import com.mcp.cursor.client.service.MCPService
import kotlinx.coroutines.*
import java.awt.BorderLayout
import java.awt.Dimension
import java.awt.event.KeyAdapter
import java.awt.event.KeyEvent
import javax.swing.*

/**
 * MCP Cursor 채팅 패널
 */
class ChatPanel(private val project: Project) : JPanel(BorderLayout()) {
    
    private val mcpservice by lazy { MCPService.getInstance(project) }
    private val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    private val chatArea = JBTextArea().apply {
        isEditable = false
        lineWrap = true
        wrapStyleWord = true
        font = font.deriveFont(14f)
    }
    
    private val inputField = JBTextField().apply {
        toolTipText = "AI에게 질문하세요... (Enter: 전송, Shift+Enter: 줄바꿈)"
    }
    
    private val sendButton = JButton("전송").apply {
        isEnabled = false
    }
    
    private val modelComboBox = JComboBox<String>().apply {
        addItem("모델 로딩 중...")
    }
    
    private val statusLabel = JLabel("연결 중...").apply {
        horizontalAlignment = SwingConstants.CENTER
    }
    
    init {
        try {
            setupUI()
            setupEventListeners()
            
            // 초기 메시지 표시
            appendToChat("시스템", "MCP Cursor AI 채팅에 오신 것을 환영합니다!", false)
            appendToChat("시스템", "서버 연결을 확인하고 있습니다...", false)
            
            // 비동기로 모델 로드 및 연결 테스트 (지연 실행)
            SwingUtilities.invokeLater {
                scope.launch {
                    try {
                        delay(1000) // 1초 지연으로 안정성 확보
                        loadModels()
                        testConnection()
                    } catch (e: Exception) {
                        SwingUtilities.invokeLater {
                            appendToChat("시스템", "초기화 중 오류가 발생했습니다: ${e.message}", false)
                        }
                    }
                }
            }
        } catch (e: Exception) {
            // 초기화 실패 시 기본 UI라도 표시
            SwingUtilities.invokeLater {
                removeAll()
                add(JLabel("플러그인 초기화 중 오류가 발생했습니다. IDE를 재시작해주세요.").apply {
                    horizontalAlignment = SwingConstants.CENTER
                }, BorderLayout.CENTER)
                revalidate()
                repaint()
            }
        }
    }
    
    private fun setupUI() {
        // 제목 패널
        val titlePanel = JPanel(BorderLayout()).apply {
            add(JLabel("MCP Cursor AI Chat").apply {
                font = font.deriveFont(16f)
            }, BorderLayout.WEST)
            add(statusLabel, BorderLayout.EAST)
            border = JBUI.Borders.empty(5)
        }
        
        // 상단 패널 (모델 선택)
        val topPanel = JPanel(BorderLayout()).apply {
            add(JLabel("모델:"), BorderLayout.WEST)
            add(modelComboBox, BorderLayout.CENTER)
            border = JBUI.Borders.empty(5)
        }
        
        // 채팅 영역
        val chatScrollPane = JBScrollPane(chatArea).apply {
            preferredSize = Dimension(400, 300)
            verticalScrollBarPolicy = JScrollPane.VERTICAL_SCROLLBAR_ALWAYS
        }
        
        // 입력 영역
        val inputPanel = JPanel(BorderLayout()).apply {
            add(inputField, BorderLayout.CENTER)
            add(sendButton, BorderLayout.EAST)
            border = JBUI.Borders.empty(5)
        }
        
        // 메인 레이아웃
        add(titlePanel, BorderLayout.NORTH)
        add(chatScrollPane, BorderLayout.CENTER)
        add(inputPanel, BorderLayout.SOUTH)
        
        border = JBUI.Borders.empty(5)
    }
    
    private fun setupEventListeners() {
        // 전송 버튼 클릭
        sendButton.addActionListener {
            sendMessage()
        }
        
        // Enter 키로 전송
        inputField.addKeyListener(object : KeyAdapter() {
            override fun keyPressed(e: KeyEvent) {
                if (e.keyCode == KeyEvent.VK_ENTER && !e.isShiftDown) {
                    e.consume()
                    sendMessage()
                }
            }
        })
        
        // 모델 변경
        modelComboBox.addActionListener {
            updateSendButtonState()
        }
    }
    
    private fun loadModels() {
        scope.launch {
            try {
                SwingUtilities.invokeLater {
                    modelComboBox.removeAllItems()
                    modelComboBox.addItem("모델 로딩 중...")
                }
                
                // 먼저 서버에서 모델 목록을 새로 로드
                mcpservice.loadAvailableModels()
                
                val models = mcpservice.getAvailableModels()
                SwingUtilities.invokeLater {
                    modelComboBox.removeAllItems()
                    if (models.isNotEmpty()) {
                        models.forEach { model ->
                            modelComboBox.addItem("${model.name} (${if (model.available) "사용 가능" else "사용 불가"})")
                        }
                        appendToChat("시스템", "사용 가능한 AI 모델 ${models.size}개를 로드했습니다.", false)
                    } else {
                        modelComboBox.addItem("사용 가능한 모델 없음")
                        appendToChat("시스템", "사용 가능한 AI 모델이 없습니다. 서버 설정을 확인해주세요.", false)
                    }
                    updateSendButtonState()
                }
            } catch (e: Exception) {
                SwingUtilities.invokeLater {
                    modelComboBox.removeAllItems()
                    modelComboBox.addItem("모델 로드 실패")
                    appendToChat("시스템", "모델 로드 실패: ${e.message}", false)
                }
            }
        }
    }
    
    private fun testConnection() {
        scope.launch {
            try {
                SwingUtilities.invokeLater {
                    statusLabel.text = "연결 확인 중..."
                    statusLabel.foreground = java.awt.Color.ORANGE.darker()
                }
                
                val isConnected = mcpservice.testConnection()
                SwingUtilities.invokeLater {
                    if (isConnected) {
                        statusLabel.text = "✅ 연결됨"
                        statusLabel.foreground = java.awt.Color.GREEN.darker()
                        appendToChat("시스템", "서버 연결이 성공했습니다!", false)
                    } else {
                        statusLabel.text = "❌ 연결 실패"
                        statusLabel.foreground = java.awt.Color.RED.darker()
                        appendToChat("시스템", "서버 연결에 실패했습니다. 설정을 확인해주세요.", false)
                    }
                    updateSendButtonState()
                }
            } catch (e: Exception) {
                SwingUtilities.invokeLater {
                    statusLabel.text = "❌ 연결 오류"
                    statusLabel.foreground = java.awt.Color.RED.darker()
                    appendToChat("시스템", "연결 오류: ${e.message}", false)
                }
            }
        }
    }
    
    private fun updateSendButtonState() {
        val hasText = inputField.text.isNotBlank()
        val hasModel = modelComboBox.selectedItem != null && 
                      !modelComboBox.selectedItem.toString().contains("사용 불가") &&
                      !modelComboBox.selectedItem.toString().contains("로딩")
        val isConnected = mcpservice.isConnected()
        
        sendButton.isEnabled = hasText && hasModel && isConnected
    }
    
    private fun sendMessage() {
        val message = inputField.text.trim()
        if (message.isEmpty()) return
        
        val selectedModel = getSelectedModel()
        if (selectedModel == null) {
            appendToChat("시스템", "사용 가능한 모델을 선택해주세요.", true)
            return
        }
        
        // 사용자 메시지 표시
        appendToChat("사용자", message, false)
        inputField.text = ""
        sendButton.isEnabled = false
        
        // AI 응답 요청
        scope.launch {
            try {
                val response = mcpservice.sendChatMessage(message, selectedModel)
                SwingUtilities.invokeLater {
                    appendToChat("AI", response, false)
                    sendButton.isEnabled = true
                    inputField.requestFocus()
                }
            } catch (e: Exception) {
                SwingUtilities.invokeLater {
                    appendToChat("시스템", "오류: ${e.message}", true)
                    sendButton.isEnabled = true
                }
            }
        }
    }
    
    private fun getSelectedModel(): String? {
        val selected = modelComboBox.selectedItem?.toString() ?: return null
        val models = mcpservice.getAvailableModels()
        return models.find { model ->
            selected.contains(model.name) && model.available
        }?.id
    }
    
    private fun appendToChat(sender: String, message: String, isStreaming: Boolean) {
        val timestamp = java.time.LocalTime.now().format(
            java.time.format.DateTimeFormatter.ofPattern("HH:mm:ss")
        )
        
        val prefix = when (sender) {
            "사용자" -> "👤"
            "AI" -> "🤖"
            "시스템" -> "⚙️"
            else -> "💬"
        }
        
        val formattedMessage = if (isStreaming && sender == "AI") {
            message
        } else {
            "$prefix [$timestamp] $sender: $message"
        }
        
        chatArea.append(formattedMessage)
        if (!isStreaming || sender != "AI") {
            chatArea.append("\n")
        }
        
        // 스크롤을 맨 아래로
        chatArea.caretPosition = chatArea.document.length
    }
    
    fun dispose() {
        scope.cancel()
    }
}

