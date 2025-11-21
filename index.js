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

    // Check each block for transactions involving our contract
    for (let blockNum = lastCheckedBlock + 1; blockNum <= currentBlock; blockNum++) {
      const block = await provider.getBlockWithTransactions(blockNum);
      
      if (!block || !block.transactions) {
        console.log(`Block ${blockNum} has no transactions`);
        continue;
      }

      for (const tx of block.transactions) {
        // Check if transaction is to or from our contract
        const contractAddr = config.contractAddress.toLowerCase();
        const txTo = tx.to ? tx.to.toLowerCase() : null;
        const txFrom = tx.from.toLowerCase();

        if (txTo === contractAddr || txFrom === contractAddr) {
          console.log(`Activity detected in block ${blockNum}: ${tx.hash}`);
          
          // Get transaction receipt for more details
          const receipt = await provider.getTransactionReceipt(tx.hash);
          
          const subject = `Contract Activity Detected - Block ${blockNum}`;
          const body = formatTransaction(tx, receipt);
          
          await sendEmailNotification(subject, body);
        }
      }
    }

    lastCheckedBlock = currentBlock;
  } catch (error) {
    console.error('Error checking for activity:', error.message);
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

  // Set up polling interval
  setInterval(async () => {
    await checkForActivity();
  }, config.pollInterval);
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
