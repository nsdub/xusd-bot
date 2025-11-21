/**
 * Test script to verify notification configuration
 * This checks if the notification setup is correct without sending actual notifications
 */

require('dotenv').config();

// Configuration from environment variables
const config = {
  contractAddresses: (process.env.CONTRACT_ADDRESSES || process.env.CONTRACT_ADDRESS || '0x4dc1ce9b9f9EF00c144BfAD305f16c62293dC0E8')
    .split(',')
    .map(addr => addr.trim().toLowerCase()),
  emailFrom: process.env.EMAIL_FROM,
  emailTo: process.env.EMAIL_TO,
  smtpHost: process.env.EMAIL_SMTP_HOST,
  smtpUser: process.env.EMAIL_SMTP_USER,
  smtpPassword: process.env.EMAIL_SMTP_PASSWORD,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  telegramChatId: process.env.TELEGRAM_CHAT_ID,
};

console.log('=== Configuration Test ===\n');

// Check contract addresses
console.log('✓ Contract Addresses:');
config.contractAddresses.forEach((addr, idx) => {
  console.log(`  ${idx + 1}. ${addr}`);
});
console.log();

// Check notification methods
const hasEmailConfig = config.emailFrom && config.emailTo && config.smtpHost && config.smtpUser && config.smtpPassword;
const hasTelegramConfig = config.telegramBotToken && config.telegramChatId;

console.log('Notification Methods:');

if (hasEmailConfig) {
  console.log('  ✓ Email configured');
  console.log(`    From: ${config.emailFrom}`);
  console.log(`    To: ${config.emailTo}`);
  console.log(`    SMTP: ${config.smtpHost}`);
} else {
  console.log('  ✗ Email NOT configured (optional)');
}
console.log();

if (hasTelegramConfig) {
  console.log('  ✓ Telegram configured');
  console.log(`    Chat ID: ${config.telegramChatId}`);
  console.log(`    Bot Token: ${config.telegramBotToken.substring(0, 10)}...`);
} else {
  console.log('  ✗ Telegram NOT configured (optional)');
}
console.log();

// Final validation
if (!hasEmailConfig && !hasTelegramConfig) {
  console.error('✗ ERROR: No notification method configured!');
  console.error('  Please configure at least Email or Telegram in your .env file');
  process.exit(1);
}

console.log('✓ Configuration is valid!');
console.log('\nYou can now run: npm start');
console.log('\nNote: If network test (npm test) fails due to RPC connectivity,');
console.log('the bot may still work fine in your production environment.');
