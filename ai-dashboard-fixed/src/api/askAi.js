/**
 * Service for sending queries to AI models
 */

/**
 * Sends a query to an AI model through the backend
 * @param {string} prompt - The query for the model
 * @param {string} model - Type of model to use (gpt-4, claude-3.7, huggingface)
 * @returns {Promise<string>} - The model's response
 */
export const askAI = async (prompt, model = 'gpt-4') => {
  try {
    // Prepare the abort controller for timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    // Check if this is an agent-related question
    const isAgentQuestion = /\b(agent|agents|סוכן|סוכנים)\b/i.test(prompt);
    
    // For agent-related questions, direct to the main agent system
    if (isAgentQuestion) {
      clearTimeout(timeoutId);
      return "For agent-related questions, please contact the main agent system directly through the Agents tab. They will be able to provide you with more specific information.";
    }
    
    // Create meaningful responses in English for common questions
    if (/\b(hello|hi|hey)\b/i.test(prompt)) {
      clearTimeout(timeoutId);
      return "Hello! I'm here to help you with the Agent Management System. How can I assist you today?";
    }
    
    if (/\b(what do you do|what can you do|what is your role)\b/i.test(prompt)) {
      clearTimeout(timeoutId);
      return "I can help you with various tasks in the Agent Management System, including:\n\n- Information about different agent types\n- Explanations about creating and managing projects\n- Troubleshooting agent connections\n- Guidance on system features\n- Answering questions about AI and automation";
    }
    
    if (/\b(hebrew|english|language)\b/i.test(prompt)) {
      clearTimeout(timeoutId);
      return "I am communicating in English. The chat system is currently configured to show all text in English.";
    }
    
    if (/\b(thank you|thanks)\b/i.test(prompt)) {
      clearTimeout(timeoutId);
      return "You're welcome! I'm here to help. If you have any more questions, feel free to ask.";
    }
    
    if (/\b(project|projects)\b/i.test(prompt)) {
      clearTimeout(timeoutId);
      return "Projects in our system represent workspaces where agents can collaborate. Each project has its own file structure and can be configured with different agent settings. You can add a new project from the sidebar or view files in your existing projects.";
    }
    
    if (/\b(how)\b.+\b(add project|create project)\b/i.test(prompt)) {
      clearTimeout(timeoutId);
      return "To add a new project:\n1. Click the 'Add Project' button in the sidebar\n2. Enter the project name\n3. Specify the project path or browse to select it\n4. Click 'Add Project' to create it\n\nYour new project will appear in the projects list and be automatically selected.";
    }
    
    if (/\b(not working|issue|problem)\b/i.test(prompt)) {
      clearTimeout(timeoutId);
      return "I'm sorry to hear you're experiencing issues. Here are some troubleshooting steps:\n\n1. Check that the backend server is running (usually on port 3001)\n2. Ensure the agent system is active (port 5001)\n3. Try refreshing your browser\n4. Check for error messages in the console\n\nIf problems persist, try restarting the application.";
    }
    
    // Check if we need to make an API request, or already returned a response
    if (timeoutId) {
      // Still need to make the API request
      try {
        // Check for some more common queries in English
        if (/\b(what up|wassup|whats up|what's up)\b/i.test(prompt)) {
          clearTimeout(timeoutId);
          return "All good! How can I help you today?";
        }

        if (/\b(do you speak english|speak english)\b/i.test(prompt)) {
          clearTimeout(timeoutId);
          return "Yes, I do speak English fluently and I'm happy to help you in English.";
        }

        if (/\b(not working|not responding|bad|terrible|sucks|failed)\b/i.test(prompt)) {
          clearTimeout(timeoutId);
          return "I'm sorry to hear you're experiencing problems. I'd be happy to help resolve the issue. Could you please describe exactly what isn't working properly?";
        }

        // Add Hebrew to English responses for common Hebrew phrases
        if (/\b(שלום|היי|הי)\b/i.test(prompt)) {
          clearTimeout(timeoutId);
          return "Hello! I'm communicating in English. How can I help you today?";
        }
        
        if (/\b(מה שלומך|מה קורה|מה המצב)\b/i.test(prompt)) {
          clearTimeout(timeoutId);
          return "I'm doing well, thank you for asking! I'm responding in English as configured. How can I assist you?";
        }
        
        if (/\b(תודה|תודה רבה)\b/i.test(prompt)) {
          clearTimeout(timeoutId);
          return "You're welcome! I'm here to help. Feel free to ask if you need anything else.";
        }

        // Make API request to the backend
        const apiResponse = await fetch('http://localhost:3001/ask-ai', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            model
          }),
          signal: controller.signal
        });
        
        // Clear the timeout as we got a response
        clearTimeout(timeoutId);
        
        // Check if the request was successful
        if (!apiResponse.ok) {
          throw new Error(`Server responded with ${apiResponse.status}: ${apiResponse.statusText}`);
        }
        
        // Parse the response
        const data = await apiResponse.json();
        
        // Check if we have a valid response
        if (!data || !data.response) {
          throw new Error('No response data received from the server');
        }
        
        // Return the response 
        return data.response;
      } catch (error) {
        // Handle specific abort errors from timeout
        if (error.name === 'AbortError') {
          console.error('Request timed out after 30 seconds');
          return 'I apologize, but the request failed due to a timeout. Please try again with a shorter query or try later.';
        }
        
        // Log and handle general errors
        console.error('Error in askAI:', error);
        return 'I apologize, but I encountered an error processing your request. Please try again later.';
      }
    }
  } catch (error) {
    // Handle specific abort errors from timeout
    if (error.name === 'AbortError') {
      console.error('Request timed out after 30 seconds');
      return 'I apologize, but the request failed due to a timeout. Please try again with a shorter query or try later.';
    }
    
    // Log and handle general errors
    console.error('Error in askAI:', error);
    return 'I apologize, but I encountered an error processing your request. Please try again later.';
  }
}; 