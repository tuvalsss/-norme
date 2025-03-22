import React, { useState, useRef, useEffect } from 'react';
import ChatPopup from './ChatPopup';
import ReactDOM from 'react-dom';

// Force left positioning with direct style manipulation
const AiAssistantButton = () => {
  const [popups, setPopups] = useState([]);
  const idCounter = useRef(0);
  const buttonRef = useRef(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  
  // Add a new chat popup
  const addPopup = () => {
    // Check if popup already exists
    const newId = idCounter.current++;
    if (document.getElementById(`ai-popup-${newId}`)) return;
    
    // Create popup container
    const popupContainer = document.createElement('div');
    popupContainer.id = `ai-popup-${newId}`;
    
    // Force left positioning for consistency
    Object.assign(popupContainer.style, {
      position: 'fixed',
      left: '20px',
      right: 'auto',
      bottom: '80px',
      zIndex: '9999'
    });
    
    // Render popup into the container
    ReactDOM.render(
      <ChatPopup 
        id={newId} 
        position={{ left: 20, bottom: 80 }}
        onClose={() => closePopup(newId)} 
      />,
      popupContainer
    );
    
    // Add to the DOM
    document.body.appendChild(popupContainer);
    
    // Update state
    setPopups(prev => [...prev, { id: newId }]);
    setIsPopupOpen(true);
  };
  
  // Remove popup by ID
  const closePopup = (id) => {
    const popupElement = document.getElementById(`ai-popup-${id}`);
    if (popupElement) {
      setTimeout(() => {
        ReactDOM.unmountComponentAtNode(popupElement);
        popupElement.remove();
        
        setPopups(prevPopups => prevPopups.filter(popup => popup.id !== id));
        if (popups.length <= 1) {
          setIsPopupOpen(false);
        }
      }, 300);
    }
  };

  // Force left positioning after render
  useEffect(() => {
    if (buttonRef.current) {
      const style = buttonRef.current.style;
      style.position = 'fixed';
      style.left = '20px';
      style.right = 'auto';
      style.bottom = '20px';
      style.zIndex = '9999';
    }
  }, []);
  
  return (
    <button
      ref={buttonRef}
      className="fixed bg-gray-800 hover:bg-gray-700 text-white rounded-full p-4 shadow-lg transition-all z-40"
      style={{
        position: 'fixed',
        left: '20px',
        right: 'auto',
        bottom: '20px',
        zIndex: 9999,
        transform: isPopupOpen ? 'scale(0.8)' : 'scale(1)',
        transition: 'all 0.3s ease'
      }}
      onClick={addPopup}
      aria-label="Open AI Assistant"
    >
      <div className="relative w-6 h-6">
        {/* Chat icon */}
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" 
          />
        </svg>
        
        {/* Number badge */}
        {!isPopupOpen && (
          <span className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 bg-indigo-600 rounded-full w-4 h-4 flex items-center justify-center text-xs">
            1
          </span>
        )}
      </div>
    </button>
  );
};

export default AiAssistantButton; 