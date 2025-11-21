const ethers = require('ethers');
const nodemailer = require('nodemailer');
const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

// Configuration from environment variables
const config = {
  rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
  // Support multiple contract addresses separated by comma
  contractAddresses: (process.env.CONTRACT_ADDRESSES || process.env.CONTRACT_ADDRESS || '0x4dc1ce9b9f9EF00c144BfAD305f16c62293dC0E8')
    .split(',')
    .map(addr => addr.trim().toLowerCase()),
  emailFrom: process.env.EMAIL_FROM,
  emailTo: process.env.EMAIL_TO,
  smtpHost: process.env.EMAIL_SMTP_HOST,
  smtpPort: process.env.EMAIL_SMTP_PORT || 587,
  smtpUser: process.env.EMAIL_SMTP_USER,
  smtpPassword: process.env.EMAIL_SMTP_PASSWORD,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
  pollInterval: parseInt(process.env.POLL_INTERVAL || '60', 10) * 1000, // Convert to milliseconds
};

// Validate configuration - at least one notification method must be configured
const hasEmailConfig = config.emailFrom && config.emailTo && config.smtpHost && config.smtpUser && config.smtpPassword;
const hasTelegramConfig = config.telegramBotToken && config.telegramChatId;

if (!hasEmailConfig && !hasTelegramConfig) {
  console.error('Error: No notification method configured in .env file');
  console.error('Please configure either Email (EMAIL_*) or Telegram (TELEGRAM_*) settings');
  console.error('Copy .env.example to .env and fill in at least one notification method');
  process.exit(1);
}

// Initialize provider
const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);

// Initialize email transporter (only if configured)
let transporter = null;
if (hasEmailConfig) {
  transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPassword,
    },
  });
}

// Initialize Telegram bot (only if configured)
let telegramBot = null;
if (hasTelegramConfig) {
  telegramBot = new TelegramBot(config.telegramBotToken, { polling: false });
}

// Track last checked block
let lastCheckedBlock = null;
let isChecking = false; // Prevent concurrent executions

/**
 * Send email notification
 */
async function sendEmailNotification(subject, body) {
  if (!transporter) return;

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
 * Send Telegram notification
 */
async function sendTelegramNotification(message) {
  if (!telegramBot) return;

  try {
    await telegramBot.sendMessage(config.telegramChatId, message, {
      parse_mode: 'HTML',
      disable_web_page_preview: false
    });
    console.log('Telegram message sent');
  } catch (error) {
    console.error('Failed to send Telegram message:', error.message);
  }
}

/**
 * Send notification via all configured channels
 */
async function sendNotification(subject, body) {
  const promises = [];

  if (transporter) {
    promises.push(sendEmailNotification(subject, body));
  }

  if (telegramBot) {
    // Format message for Telegram with HTML
    const telegramMessage = `<b>${subject}</b>\n\n${body.replace(/\n/g, '\n')}`;
    promises.push(sendTelegramNotification(telegramMessage));
  }

  await Promise.all(promises);
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
      const contractList = config.contractAddresses.join('\n');
      await sendNotification(
        'Contract Monitor Started',
        `Started monitoring ${config.contractAddresses.length} contract(s) on Avalanche C-Chain:\n${contractList}\n\nStarting from block ${currentBlock}`
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
          // Check if transaction is to or from any of our monitored contracts
          const txTo = tx.to ? tx.to.toLowerCase() : null;
          const txFrom = tx.from.toLowerCase();

          for (const contractAddr of config.contractAddresses) {
            if (txTo === contractAddr || txFrom === contractAddr) {
              matchingTxs.push({ tx, contractAddr });
              break; // Don't add the same transaction twice
            }
          }
        }

        // Fetch receipts for matching transactions in parallel
        if (matchingTxs.length > 0) {
          const receiptPromises = matchingTxs.map(({ tx }) =>
            provider.getTransactionReceipt(tx.hash).catch(err => {
              console.error(`Error fetching receipt for ${tx.hash}:`, err.message);
              return null;
            })
          );

          const receipts = await Promise.all(receiptPromises);

          // Send notifications
          for (let j = 0; j < matchingTxs.length; j++) {
            const { tx, contractAddr } = matchingTxs[j];
            const receipt = receipts[j];

            if (receipt) {
              console.log(`Activity detected in block ${blockNum} for contract ${contractAddr}: ${tx.hash}`);
              const subject = `Contract Activity Detected - Block ${blockNum}`;
              const body = `Monitored Contract: ${contractAddr}\n\n${formatTransaction(tx, receipt)}`;
              await sendNotification(subject, body);
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
  console.log(`Monitoring ${config.contractAddresses.length} contract(s):`);
  config.contractAddresses.forEach((addr, idx) => {
    console.log(`  ${idx + 1}. ${addr}`);
  });
  console.log(`Network: Avalanche C-Chain`);
  console.log(`RPC URL: ${config.rpcUrl}`);
  console.log(`Poll interval: ${config.pollInterval / 1000} seconds`);

  const notificationMethods = [];
  if (transporter) notificationMethods.push(`Email (${config.emailTo})`);
  if (telegramBot) notificationMethods.push(`Telegram (Chat ID: ${config.telegramChatId})`);
  console.log(`Notifications: ${notificationMethods.join(', ')}`);
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
