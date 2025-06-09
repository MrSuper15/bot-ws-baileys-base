import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const saveLog = (logDirName: string, runId: string, data: any) => {
    const date = new Date().toISOString().split('T')[0]; // Get current date (YYYY-MM-DD)
    const logDir = path.join(__dirname, logDirName, date); // Create a subdirectory for the date

    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `run_requires_action_${timestamp}_${runId}.json`;
    const filePath = path.join(logDir, filename);

    fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
        if (err) console.error('Error saving JSON:', err);
    });
};
