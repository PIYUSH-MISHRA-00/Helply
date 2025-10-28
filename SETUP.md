# Helply Setup Instructions

## Getting a Groq API Key

1. Visit [Groq Cloud](https://console.groq.com) and sign up for an account
2. Navigate to the API Keys section
3. Create a new API key
4. Copy the API key for use in the next step

## Environment Variables

The Helply AI Meeting Assistant requires the following environment variable to be set:

### Groq API Key

You need to set your Groq API key as an environment variable:

**macOS/Linux**:
```bash
export GROQ_API_KEY='your-groq-api-key-here'
```

**Windows**:
```cmd
set GROQ_API_KEY=your-groq-api-key-here
```

Or add it to your `.env` file:
```
GROQ_API_KEY=your-actual-groq-api-key-here
```

## Initial Setup

1. Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```

2. Open the `.env` file and replace the placeholder with your actual Groq API key

## Running the Application

After setting up the environment variables:

1. Install dependencies:
```bash
npm install
```

2. Start the application:
```bash
npm start
```

Or use the provided script:
```bash
./start.sh
```

## Building for Production

To build the application for production:

1. Ensure you have electron-builder installed:
```bash
npm install -g electron-builder
```

2. Run the build script:
```bash
./build.sh
```

The built application will be available in the `dist/` directory.

## Development

To run the application in development mode:

```bash
npm start
```

To build for specific platforms, refer to the electron-builder documentation.