# AI Agent System - Full Documentation

This repository contains a complete AI agent system with a management dashboard.

## System Components

1. **AI Agent Server**: The core system that processes and manages AI agents
2. **Management Dashboard**: User interface for managing agents and workflows
3. **Agents**:
   - Development Agent: Code writing and development tasks
   - QA Agent: Testing and quality assurance
   - Executor Agent: Running and execution
   - Summary Agent: Documentation and summarization

## Installation

### Prerequisites

- Node.js (v16 or higher)
- Git
- API keys for:
  - OpenAI (GPT-4/GPT-4o)
  - Anthropic Claude
  - HuggingFace (optional)

### Setup Instructions

1. Clone the repository:
   ```
   git clone https://github.com/your-username/ai-agent-system.git
   cd ai-agent-system
   ```

2. Install dependencies for both systems:
   ```
   cd ai-agent-system
   npm install
   cd ../ai-dashboard-fixed
   npm install
   cd ..
   ```

3. Configure API keys:
   - Edit the `.env` file in the `ai-agent-system` directory
   - Add your API keys for OpenAI, Claude, and HuggingFace

## Running the System

### Quick Start

Simply run the start script:
```
.\start_system.bat
```

This will:
1. Start the agent server on port 5001
2. Start the dashboard on port 3001
3. Open the dashboard in your default browser

### Manual Start

If you prefer to start each component separately:

1. Start the agent server:
   ```
   cd ai-agent-system
   node server.js
   ```

2. In a separate terminal, start the dashboard:
   ```
   cd ai-dashboard-fixed
   node server.js
   ```

3. Open your browser and navigate to `http://localhost:3001`

### Stopping the System

Run the stop script:
```
.\stop_system.bat
```

Or manually terminate the Node.js processes.

## Using the System

1. **Dashboard Overview**: View agent status and system metrics
2. **Project Management**: Add and manage projects
3. **Workflows**: Create, run, and monitor workflows
4. **Agent Chat**: Communicate with AI agents

## Workflows

Pre-configured workflows:
- `feature_workflow.json`: Complete feature development pipeline
- `code_review_workflow.json`: Code review process
- `deployment_workflow.json`: Deployment process

## Configuration

- Main config: `ai-dashboard-fixed/config.json`
- Agent configuration: `ai-agent-system/.env`

## Troubleshooting

1. **Port conflicts**: If ports 3001 or 5001 are in use, terminate the processes:
   ```
   npx kill-port 3001 5001
   ```

2. **API connectivity issues**: Ensure your API keys are valid and have sufficient quota

3. **Agent server not responding**: Check the agent server logs for errors

## System Architecture

The system uses a microservice architecture with:
- RESTful APIs for communication
- JSON memory storage
- Event-driven agent coordination

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
