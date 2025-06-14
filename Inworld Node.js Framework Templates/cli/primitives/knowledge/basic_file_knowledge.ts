import 'dotenv/config';

import { common, core, primitives } from '@inworld/framework-nodejs';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

const { History } = core;

import {
  DEFAULT_KNOWLEDGE_QUERY,
  DEFAULT_THRESHOLD,
  DEFAULT_TOP_K,
  KNOWLEDGE_COMPILE_CONFIG,
  KNOWLEDGE_RECORDS,
} from '../../constants';

const minimist = require('minimist');
const { KnowledgeFactory, FileType } = primitives.knowledge;
const { InworldError } = common;

const usage = `
Usage:
    yarn basic-file-knowledge "${DEFAULT_KNOWLEDGE_QUERY}" \n
    --topK=<number>[optional, default=${DEFAULT_TOP_K}, maximum number of results to return] \n
    --threshold=<number>[optional, default=${DEFAULT_THRESHOLD}, similarity threshold for results] \n
    
Note: INWORLD_API_KEY environment variable must be set`;

run().catch(handleError);

async function run() {
  const { apiKey, topK, threshold, query } = parseArgs();

  const tempDir = path.join(os.tmpdir(), `inworld-knowledge-${uuidv4()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  const tempFilePath = path.join(tempDir, 'temp-knowledge.txt');

  console.log('File-based Knowledge Example');
  console.log('----------------------------');
  console.log(`Temp directory: ${tempDir}`);

  // Create file first to ensure it exists
  fs.writeFileSync(tempFilePath, KNOWLEDGE_RECORDS.join('\n'));

  // Resources to clean up
  let knowledge = null;

  try {
    // Create remote knowledge configuration
    const config = {
      type: 'remote' as const,
      config: {
        knowledgeCompileConfig: KNOWLEDGE_COMPILE_CONFIG,
        knowledgeGetConfig: {
          retrievalConfig: {
            topK,
            threshold,
          },
        },
        apiKey,
      },
    };

    console.log('Creating remote knowledge instance...');
    knowledge = await KnowledgeFactory.create(config);

    // Process file knowledge
    await processFileKnowledge(knowledge, tempFilePath, query);
  } finally {
    // Clean up resources
    if (knowledge) knowledge.destroy();

    // Clean up temporary file
    cleanupTempDir(tempDir);
  }

  console.log('Example completed successfully.');
}

// Function to handle file-based knowledge operations
async function processFileKnowledge(
  knowledge: any,
  tempFilePath: string,
  query: string,
) {
  // ID for our knowledge collection
  const knowledgeId = 'knowledge/my-file-knowledge-collection';

  try {
    // Read the file into a Uint8Array
    const fileBuffer = fs.readFileSync(tempFilePath);
    const fileBytes = new Uint8Array(fileBuffer);

    // Create file object for knowledge compilation
    const file = {
      content: {
        bytes: fileBytes,
      },
      type: FileType.TXT,
    };

    console.log('Compiling knowledge from file...');
    try {
      const compiledRecords = await knowledge.compileKnowledge(
        knowledgeId,
        file,
      );
      console.log(
        `Successfully compiled ${compiledRecords.length} records from file.`,
      );
    } catch (error) {
      console.log('Knowledge removed during cleanup.');
      throw error;
    }

    // Create history with example events
    const history = new History([
      {
        name: 'User',
        utterance: query,
      },
    ]);

    console.log('Initial knowledge:');
    KNOWLEDGE_RECORDS.forEach((record: string, index: number) => {
      console.log(`[${index}]: ${record}`);
    });
    console.log('Retrieving knowledge...');
    const retrievedKnowledge = await knowledge.getKnowledge({
      ids: [knowledgeId],
      eventHistory: history,
    });

    console.log('Retrieved knowledge:');
    retrievedKnowledge.forEach((record: string, index: number) => {
      console.log(`[${index}]: ${record}`);
    });

    // Clean up knowledge
    console.log('Removing knowledge...');
    await knowledge.removeKnowledge(knowledgeId);
    console.log('Knowledge removed successfully.');
  } catch (error) {
    console.log('Knowledge removed during cleanup.');
    throw error;
  }
}

// Helper function to clean up the temporary directory
function cleanupTempDir(dirPath: string) {
  try {
    if (fs.existsSync(dirPath)) {
      // Remove all files in the directory
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        fs.unlinkSync(path.join(dirPath, file));
      }
      // Remove the directory itself
      fs.rmdirSync(dirPath);
      console.log('Temporary directory removed.');
    }
  } catch (error) {
    console.warn('Warning: Could not remove temporary directory:', error);
  }
}

// Parse command line arguments
function parseArgs(): {
  apiKey: string;
  topK: number;
  threshold: number;
  query: string;
} {
  const argv = minimist(process.argv.slice(2));

  if (argv.help) {
    console.log(usage);
    process.exit(0);
  }

  const apiKey = process.env.INWORLD_API_KEY || DEFAULT_KNOWLEDGE_QUERY;
  const topK = Number(argv.topK) || DEFAULT_TOP_K;
  const threshold = Number(argv.threshold) || DEFAULT_THRESHOLD;
  const query = argv._?.join(' ');

  if (!apiKey) {
    throw new Error(
      `You need to set INWORLD_API_KEY environment variable.\n${usage}`,
    );
  }

  return { apiKey, topK, threshold, query };
}

// Error handler
function handleError(err: Error) {
  if (err instanceof InworldError) {
    console.error('Inworld Error: ', {
      message: err.message,
      context: (err as any).context,
    });
  } else {
    console.error(err.message);
  }
  process.exit(1);
}

// Handle process events for clean shutdown
function done() {
  process.exit(0);
}

process.on('SIGINT', done);
process.on('SIGTERM', done);
process.on('SIGUSR2', done);
process.on('unhandledRejection', handleError);
