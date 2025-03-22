import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { askAI } from '../../api/askAi';

const MODELS = [
  { id: 'gpt-4', name: 'GPT-4' },
  { id: 'claude-3.7', name: 'Claude 3.7' },
  { id: 'huggingface', name: 'HuggingFace' }
];

// Modal chat popup that appears on the right side
const ChatPopup = ({ id, position, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const chatContainerRef = useRef(null);
  const popupRef = useRef(null);
  
  // Fixed position - always on the right 
  const popupSize = { width: 400, height: 500 };
  
  // Force RTL direction for document
  useLayoutEffect(() => {
    document.body.setAttribute('dir', 'ltr');
    
    // Apply direct styles to our popup element to ensure it's properly positioned
    if (popupRef.current) {
      const popupStyleFix = document.createElement('style');
      popupStyleFix.innerHTML = `
        [data-testid="chat-popup"],
        .ai-chat-popup,
        #ai-popup-${id} > div {
          position: fixed !important;
          right: 20px !important;
          left: auto !important;
          bottom: 80px !important;
          top: auto !important;
          z-index: 9999 !important;
          direction: ltr !important;
        }
      `;
      document.head.appendChild(popupStyleFix);
      
      Object.assign(popupRef.current.style, {
        position: 'fixed',
        right: '20px',
        left: 'auto',
        bottom: '80px',
        top: 'auto',
        zIndex: '9999',
        direction: 'ltr',
        width: `${popupSize.width}px`,
        height: `${popupSize.height}px`
      });
      
      // Return cleanup function
      return () => {
        if (document.head.contains(popupStyleFix)) {
          document.head.removeChild(popupStyleFix);
        }
      };
    }
  }, [id]);
  
  // Add welcome message on initial load
  useEffect(() => {
    setTimeout(() => {
      setMessages([
        {
          content: "Hello! I'm the AI Assistant for the Agent Management System. How can I help you today?",
          sender: 'ai',
          model: selectedModel,
          timestamp: new Date().toISOString()
        }
      ]);
    }, 500);
  }, [selectedModel]);
  
  // Animate window appearance and ensure correct positioning
  useEffect(() => {
    setTimeout(() => {
      setIsVisible(true);
      
      // Force correct positioning again after animation
      if (popupRef.current) {
        Object.assign(popupRef.current.style, {
          position: 'fixed',
          right: '20px',
          left: 'auto',
          bottom: '80px',
          zIndex: '9999'
        });
      }
    }, 50);
  }, []);
  
  // Scroll to bottom when new messages are added
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);
  
  // Handle message submission
  const handleSubmitMessage = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    // User message
    const userMessage = {
      id: Date.now(),
      content: input.trim(),
      sender: 'user',
      timestamp: new Date().toISOString()
    };
    
    // Clear input and update messages
    setInput('');
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    
    // Scroll to bottom
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }, 100);
    
    try {
      // Request AI response
      const responseText = await askAI(input.trim(), selectedModel);
      
      // Check if valid response was received
      if (!responseText || responseText.trim() === '') {
        throw new Error('No response received from the model.');
      }
      
      // AI response
      const aiMessage = {
        id: Date.now() + 1,
        content: responseText,
        sender: 'ai',
        model: selectedModel,
        timestamp: new Date().toISOString()
      };
      
      // Update chat with AI response
      setMessages(prev => [...prev, aiMessage]);
      
      // Scroll to bottom after receiving response
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 100);
    } catch (error) {
      console.error('Error receiving response from model:', error);
      
      // Error message
      const errorMessage = {
        id: Date.now() + 1,
        content: 'Could not get a response from the model.',
        sender: 'system',
        model: selectedModel,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleKeyDown = (e) => {
    // Send message when pressing Enter without Shift
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitMessage();
    }
  };
  
  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for animation to complete
  };
  
  return (
    <div 
      ref={popupRef}
      className="ai-chat-popup"
      data-testid="chat-popup"
      style={{
        position: 'fixed',
        right: '20px',
        bottom: '80px',
        left: 'auto',
        width: `${popupSize.width}px`,
        height: `${popupSize.height}px`,
        backgroundColor: '#1f2937', 
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
        border: '1px solid #374151',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 9999,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'scale(1)' : 'scale(0.95)',
        transition: 'opacity 0.3s, transform 0.3s'
      }}
    >
      {/* Header */}
      <div 
        style={{
          backgroundColor: '#111827',
          borderBottom: '1px solid #374151',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ fontWeight: 'bold', color: 'white' }}>AI Assistant</div>
        
        {/* Model Selector */}
        <div style={{ position: 'relative' }}>
          <div 
            onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
            style={{
              backgroundColor: '#374151',
              color: '#e5e7eb',
              padding: '4px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <span>{MODELS.find(m => m.id === selectedModel)?.name || 'Select Model'}</span>
            <svg 
              style={{
                marginLeft: '8px', 
                width: '16px', 
                height: '16px',
                transform: modelDropdownOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s'
              }}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          
          {modelDropdownOpen && (
            <div style={{
              position: 'absolute',
              top: '30px',
              right: 0,
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              borderRadius: '4px',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
              zIndex: 10,
              width: '100%'
            }}>
              {MODELS.map(model => (
                <div 
                  key={model.id}
                  onClick={() => {
                    setSelectedModel(model.id);
                    setModelDropdownOpen(false);
                  }}
                  style={{
                    padding: '8px 12px',
                    cursor: 'pointer',
                    backgroundColor: model.id === selectedModel ? '#374151' : 'transparent',
                    hover: {
                      backgroundColor: '#374151'
                    }
                  }}
                >
                  {model.name}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <button 
          onClick={handleClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#9CA3AF',
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Messages Container */}
      <div 
        ref={chatContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {messages.map((message) => (
          <div 
            key={message.id || message.timestamp}
            style={{
              display: 'flex',
              justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div 
              style={{
                maxWidth: '75%',
                padding: '12px',
                borderRadius: '8px',
                backgroundColor: message.sender === 'user' 
                  ? '#3B82F6' 
                  : message.sender === 'system'
                    ? '#EF4444'
                    : '#4B5563',
                color: 'white',
                borderTopRightRadius: message.sender === 'user' ? 0 : '8px',
                borderTopLeftRadius: message.sender === 'user' ? '8px' : 0
              }}
            >
              <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
              {message.sender === 'ai' && (
                <div style={{ fontSize: '12px', color: '#D1D5DB', marginTop: '4px', textAlign: 'right' }}>
                  {message.model}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ 
              backgroundColor: '#4B5563', 
              color: 'white', 
              padding: '12px', 
              borderRadius: '8px', 
              borderTopLeftRadius: 0,
              animation: 'pulse 1.5s infinite' 
            }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  backgroundColor: '#9CA3AF', 
                  borderRadius: '50%',
                  animation: 'bounce 1s infinite',
                  animationDelay: '0ms' 
                }}></div>
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  backgroundColor: '#9CA3AF', 
                  borderRadius: '50%',
                  animation: 'bounce 1s infinite',
                  animationDelay: '150ms' 
                }}></div>
                <div style={{ 
                  width: '8px', 
                  height: '8px', 
                  backgroundColor: '#9CA3AF', 
                  borderRadius: '50%',
                  animation: 'bounce 1s infinite',
                  animationDelay: '300ms' 
                }}></div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Input Form */}
      <form 
        onSubmit={handleSubmitMessage}
        style={{
          borderTop: '1px solid #374151',
          padding: '12px',
          backgroundColor: '#111827'
        }}
      >
        <div style={{ display: 'flex' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            style={{
              flex: 1,
              backgroundColor: '#1f2937',
              color: 'white',
              border: 'none',
              borderRadius: '4px 0 0 4px',
              padding: '8px 12px',
              outline: 'none',
              resize: 'none',
              height: '40px'
            }}
            rows={1}
          />
          <button 
            type="submit"
            disabled={isLoading || !input.trim()}
            style={{
              backgroundColor: '#3B82F6',
              color: 'white',
              padding: '0 16px',
              borderRadius: '0 4px 4px 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
              opacity: isLoading || !input.trim() ? 0.5 : 1
            }}
          >
            <svg style={{ width: '20px', height: '20px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatPopup; 