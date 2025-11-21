const ethers = require('ethers');
const nodemailer = require('nodemailer');
require('dotenv').config();

// Configuration from environment variables
const config = {
  rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
  contractAddress: process.env.CONTRACT_ADDRESS || '0x4dc1ce9b9f9EF00c144BfAD305f16c62293dC0E8',
  emailFrom: process.env.EMAIL_FROM,
  emailTo: process.env.EMAIL_TO,
  smtpHost: process.env.EMAIL_SMTP_HOST,
  smtpPort: process.env.EMAIL_SMTP_PORT || 587,
  smtpUser: process.env.EMAIL_SMTP_USER,
  smtpPassword: process.env.EMAIL_SMTP_PASSWORD,
  pollInterval: parseInt(process.env.POLL_INTERVAL || '60', 10) * 1000, // Convert to milliseconds
};

// Validate configuration
if (!config.emailFrom || !config.emailTo || !config.smtpHost || !config.smtpUser || !config.smtpPassword) {
  console.error('Error: Missing required email configuration in .env file');
  console.error('Please copy .env.example to .env and fill in your email settings');
  process.exit(1);
}

// Initialize provider
const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);

// Initialize email transporter
const transporter = nodemailer.createTransport({
  host: config.smtpHost,
  port: config.smtpPort,
  secure: config.smtpPort === 465,
  auth: {
    user: config.smtpUser,
    pass: config.smtpPassword,
  },
});

// Track last checked block
let lastCheckedBlock = null;
let isChecking = false; // Prevent concurrent executions

/**
 * Send email notification
 */
async function sendEmailNotification(subject, body) {
  try {
    const info = await transporter.sendMail({
      from: config.emailFrom,
      to: config.emailTo,
      subject: subject,
      text: body,
      html: body.replace(/\n/g, '<br>'),
    });
    console.log('Email sent:', info.messageId);
  } catch (error) {
    console.error('Failed to send email:', error.message);
  }
}

/**
 * Format transaction details for email
 */
function formatTransaction(tx, receipt) {
  let details = `Transaction Hash: ${tx.hash}\n`;
  details += `Block Number: ${tx.blockNumber}\n`;
  details += `From: ${tx.from}\n`;
  details += `To: ${tx.to}\n`;
  details += `Value: ${ethers.utils.formatEther(tx.value)} AVAX\n`;
  details += `Gas Used: ${receipt.gasUsed.toString()}\n`;
  details += `Status: ${receipt.status === 1 ? 'Success' : 'Failed'}\n`;
  details += `\nView on Explorer: https://snowtrace.io/tx/${tx.hash}`;
  return details;
}

/**
 * Check for new transactions involving the contract
 */
async function checkForActivity() {
  // Prevent concurrent executions
  if (isChecking) {
    console.log('Previous check still in progress, skipping...');
    return;
  }

  isChecking = true;
  try {
    const currentBlock = await provider.getBlockNumber();
    
    // Initialize lastCheckedBlock on first run
    if (lastCheckedBlock === null) {
      lastCheckedBlock = currentBlock;
      console.log(`Starting monitoring from block ${currentBlock}`);
      await sendEmailNotification(
        'Contract Monitor Started',
        `Started monitoring contract ${config.contractAddress} on Avalanche C-Chain\nStarting from block ${currentBlock}`
      );
      return;
    }

    // Check if there are new blocks
    if (currentBlock <= lastCheckedBlock) {
      console.log(`No new blocks. Current: ${currentBlock}, Last checked: ${lastCheckedBlock}`);
      return;
    }

    console.log(`Checking blocks ${lastCheckedBlock + 1} to ${currentBlock}`);

    // Limit the number of blocks to check in one go to prevent overwhelming the RPC
    const MAX_BLOCKS_PER_CHECK = 100;
    const blocksToCheck = Math.min(currentBlock - lastCheckedBlock, MAX_BLOCKS_PER_CHECK);
    const startBlock = lastCheckedBlock + 1;
    const endBlock = lastCheckedBlock + blocksToCheck;

    // Fetch blocks in parallel with batching
    const BATCH_SIZE = 10;
    for (let i = startBlock; i <= endBlock; i += BATCH_SIZE) {
      const batchEnd = Math.min(i + BATCH_SIZE - 1, endBlock);
      const blockPromises = [];
      
      for (let blockNum = i; blockNum <= batchEnd; blockNum++) {
        blockPromises.push(
          provider.getBlockWithTransactions(blockNum).catch(err => {
            console.error(`Error fetching block ${blockNum}:`, err.message);
            return null;
          })
        );
      }

      const blocks = await Promise.all(blockPromises);

      // Process blocks sequentially to maintain order
      for (let idx = 0; idx < blocks.length; idx++) {
        const block = blocks[idx];
        const blockNum = i + idx;

        if (!block || !block.transactions) {
          console.log(`Block ${blockNum} has no transactions`);
          continue;
        }

        // Collect matching transactions
        const matchingTxs = [];
        for (const tx of block.transactions) {
          // Check if transaction is to or from our contract
          const contractAddr = config.contractAddress.toLowerCase();
          const txTo = tx.to ? tx.to.toLowerCase() : null;
          const txFrom = tx.from.toLowerCase();

          if (txTo === contractAddr || txFrom === contractAddr) {
            matchingTxs.push(tx);
          }
        }

        // Fetch receipts for matching transactions in parallel
        if (matchingTxs.length > 0) {
          const receiptPromises = matchingTxs.map(tx =>
            provider.getTransactionReceipt(tx.hash).catch(err => {
              console.error(`Error fetching receipt for ${tx.hash}:`, err.message);
              return null;
            })
          );

          const receipts = await Promise.all(receiptPromises);

          // Send notifications
          for (let j = 0; j < matchingTxs.length; j++) {
            const tx = matchingTxs[j];
            const receipt = receipts[j];

            if (receipt) {
              console.log(`Activity detected in block ${blockNum}: ${tx.hash}`);
              const subject = `Contract Activity Detected - Block ${blockNum}`;
              const body = formatTransaction(tx, receipt);
              await sendEmailNotification(subject, body);
            }
          }
        }
      }
    }

    lastCheckedBlock = endBlock;
    
    // If we hit the limit, schedule an immediate check for remaining blocks
    if (endBlock < currentBlock) {
      console.log(`More blocks to check (${currentBlock - endBlock} remaining), scheduling immediate check...`);
      // Use a small delay to avoid tight loops
      setTimeout(() => checkForActivity(), 1000);
    }
  } catch (error) {
    console.error('Error checking for activity:', error.message);
  } finally {
    isChecking = false;
  }
}

/**
 * Main monitoring loop
 */
async function startMonitoring() {
  console.log('=== Smart Contract Monitor Started ===');
  console.log(`Monitoring contract: ${config.contractAddress}`);
  console.log(`Network: Avalanche C-Chain`);
  console.log(`RPC URL: ${config.rpcUrl}`);
  console.log(`Poll interval: ${config.pollInterval / 1000} seconds`);
  console.log(`Email notifications will be sent to: ${config.emailTo}`);
  console.log('=====================================\n');

  // Initial check
  await checkForActivity();

  // Set up polling with recursive setTimeout to prevent overlapping executions
  const scheduleNextCheck = () => {
    setTimeout(async () => {
      await checkForActivity();
      scheduleNextCheck();
    }, config.pollInterval);
  };

  scheduleNextCheck();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

// Start the bot
startMonitoring().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
