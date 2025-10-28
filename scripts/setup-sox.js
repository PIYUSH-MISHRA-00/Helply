const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function setupSox() {
    const platform = process.platform;
    const soxBinPath = path.join(__dirname, '..', 'node_modules', 'sox-bin');
    const vendorPath = path.join(soxBinPath, 'vendor');
    
    // Create necessary directories
    if (!fs.existsSync(soxBinPath)) {
        fs.mkdirSync(soxBinPath, { recursive: true });
    }
    
    if (!fs.existsSync(vendorPath)) {
        fs.mkdirSync(vendorPath, { recursive: true });
    }
    
    // Platform-specific setup
    if (platform === 'darwin') {
        const macPath = path.join(vendorPath, 'mac');
        if (!fs.existsSync(macPath)) {
            fs.mkdirSync(macPath, { recursive: true });
        }
        
        // Install sox using homebrew if not already installed
        try {
            execSync('which sox');
        } catch (error) {
            console.log('Installing sox using homebrew...');
            try {
                execSync('brew install sox');
            } catch (brewError) {
                console.error('Failed to install sox:', brewError);
                process.exit(1);
            }
        }
        
        // Copy sox binary instead of creating symlink
        const soxPath = execSync('which sox').toString().trim();
        const destPath = path.join(macPath, 'sox');
        try {
            fs.copyFileSync(soxPath, destPath);
            fs.chmodSync(destPath, '755'); // Make it executable
        } catch (error) {
            console.error('Failed to copy sox binary:', error);
            process.exit(1);
        }
    } else if (platform === 'win32') {
        const winPath = path.join(vendorPath, 'windows');
        if (!fs.existsSync(winPath)) {
            fs.mkdirSync(winPath, { recursive: true });
        }
        
        // On Windows, we'll use the sox binary from sox-bin package
        // It should be automatically installed with npm install
    }
}

try {
    setupSox();
    console.log('Sox setup completed successfully');
} catch (error) {
    console.error('Error during sox setup:', error);
    process.exit(1);
} 