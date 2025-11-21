# xusd-bot

A smart contract monitoring bot for Avalanche C-Chain that sends notifications via Email and/or Telegram whenever there is activity on specified contract addresses.

## Features

- 🔍 **Monitor multiple contracts** simultaneously on Avalanche C-Chain
- 📧 **Email notifications** via SMTP (Gmail, Outlook, etc.)
- 📱 **Telegram notifications** via Telegram Bot API
- ⚡ **Real-time monitoring** with configurable polling interval
- 🔐 **Secure configuration** via environment variables
- 📊 **Detailed transaction information** in all notifications
- 🧪 **Easy testing** with high-activity contracts like USDC

## Default Contract Being Monitored

**Contract Address:** `0x4dc1ce9b9f9EF00c144BfAD305f16c62293dC0E8`
**Network:** Avalanche C-Chain

> **Note:** You can monitor multiple contracts by listing them comma-separated in the configuration.

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- **At least one notification method:**
  - Email account with SMTP access (e.g., Gmail), OR
  - Telegram account and bot (see Telegram Setup below)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/nsdub/xusd-bot.git
cd xusd-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file from the example:
```bash
cp .env.example .env
```

4. Edit `.env` and configure your settings:
```env
# Avalanche C-Chain RPC URL
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc

# Contract addresses to monitor (comma-separated for multiple contracts)
# For testing, add USDC which has high activity:
CONTRACT_ADDRESSES=0x4dc1ce9b9f9EF00c144BfAD305f16c62293dC0E8,0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E

# Email configuration (OPTIONAL - configure at least one notification method)
EMAIL_FROM=your-email@gmail.com
EMAIL_TO=recipient@example.com
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your-email@gmail.com
EMAIL_SMTP_PASSWORD=your-app-password

# Telegram configuration (OPTIONAL - configure at least one notification method)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-chat-id

# Polling interval in seconds (default: 60)
POLL_INTERVAL=60
```

> **Note:** You must configure at least one notification method (Email or Telegram). You can also configure both to receive notifications through multiple channels.

## Email Setup

### Using Gmail

1. Enable 2-factor authentication on your Google account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate a new app password for "Mail"
3. Use the generated password in `EMAIL_SMTP_PASSWORD`

### Using Other Providers

Update the SMTP settings accordingly:
- **Outlook/Hotmail:** smtp-mail.outlook.com:587
- **Yahoo:** smtp.mail.yahoo.com:587
- **Custom SMTP:** Use your provider's settings

## Telegram Setup

To receive notifications via Telegram:

1. **Create a Telegram Bot:**
   - Open Telegram and search for `@BotFather`
   - Send `/newbot` and follow the prompts
   - Copy the bot token provided (looks like `123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ`)
   - Paste it into `TELEGRAM_BOT_TOKEN` in your `.env` file

2. **Get Your Chat ID:**
   - Start a chat with your new bot (search for it by username)
   - Send any message to the bot (e.g., "Hello")
   - Visit this URL in your browser (replace `YOUR_BOT_TOKEN` with your actual token):
     ```
     https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
     ```
   - Look for `"chat":{"id":123456789}` in the response
   - Copy the chat ID number and paste it into `TELEGRAM_CHAT_ID` in your `.env` file

3. **Test the Configuration:**
   - Run `npm start` and you should receive a startup notification in Telegram

> **Tip:** You can use both Email and Telegram notifications simultaneously for redundancy!

## Testing with High-Activity Contracts

The default contract may have infrequent activity, making it difficult to test. To quickly verify the bot works:

**Add USDC (Native) to your monitored contracts:**
```env
CONTRACT_ADDRESSES=0x4dc1ce9b9f9EF00c144BfAD305f16c62293dC0E8,0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E
```

USDC (`0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E`) is a highly active contract on Avalanche with thousands of transactions per day. This allows you to:
- Verify notifications are working correctly
- See real-time alerts within minutes
- Test both Email and Telegram delivery
- Confirm the bot is monitoring properly

**Once testing is complete,** you can remove the USDC contract and keep only your target contract(s).

## Usage

### Testing the Setup

Before running the bot, you can test your connection to the Avalanche network:

```bash
npm test
```

This will verify:
- Connection to Avalanche C-Chain RPC
- Contract address validity
- Recent blockchain activity
- Network status

### Running the Bot

Start the monitoring bot:

```bash
npm start
```

The bot will:
1. Connect to the Avalanche C-Chain
2. Start monitoring all configured contract addresses
3. Send an initial notification confirming the bot has started
4. Send notifications (Email/Telegram) whenever any activity occurs on any monitored contract

To stop the bot, press `Ctrl+C`.

## What Gets Monitored

The bot monitors all transactions that involve any of the configured contract addresses:
- Transactions sent **to** the contract
- Transactions sent **from** the contract

Each notification includes:
- **Monitored contract address** (which contract triggered the alert)
- Transaction hash
- Block number
- Sender address
- Recipient address
- Value transferred (in AVAX)
- Gas used
- Transaction status (success/failed)
- Direct link to Snowtrace explorer

## Configuration Options

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `AVALANCHE_RPC_URL` | Avalanche C-Chain RPC endpoint | `https://api.avax.network/ext/bc/C/rpc` | No |
| `CONTRACT_ADDRESSES` | Comma-separated list of contract addresses to monitor | `0x4dc1ce9b9f9EF00c144BfAD305f16c62293dC0E8` | No |
| `CONTRACT_ADDRESS` | Single contract address (backwards compatible) | See above | No |
| `EMAIL_FROM` | Sender email address | - | If using email |
| `EMAIL_TO` | Recipient email address | - | If using email |
| `EMAIL_SMTP_HOST` | SMTP server hostname | - | If using email |
| `EMAIL_SMTP_PORT` | SMTP server port | `587` | No |
| `EMAIL_SMTP_USER` | SMTP username | - | If using email |
| `EMAIL_SMTP_PASSWORD` | SMTP password or app password | - | If using email |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather | - | If using Telegram |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID | - | If using Telegram |
| `POLL_INTERVAL` | Seconds between blockchain checks | `60` | No |

> **Note:** You must configure at least one complete notification method (all Email variables OR all Telegram variables). You can configure both for redundancy.

## Running as a Service

### Using PM2 (Recommended)

```bash
npm install -g pm2
pm2 start index.js --name xusd-bot
pm2 save
pm2 startup
```

### Using systemd (Linux)

Create `/etc/systemd/system/xusd-bot.service`:

```ini
[Unit]
Description=XUSD Contract Monitor Bot
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/xusd-bot
ExecStart=/usr/bin/node index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable xusd-bot
sudo systemctl start xusd-bot
```

## Troubleshooting

### No emails being received

1. Check spam/junk folder
2. Verify SMTP credentials in `.env`
3. Check console logs for error messages
4. Test email settings with a simple test

### Connection issues

1. Verify RPC URL is accessible
2. Check internet connection
3. Try alternative RPC endpoints if needed

### Bot stops unexpectedly

1. Check logs for error messages
2. Ensure sufficient system resources
3. Consider using PM2 for automatic restarts

## Security Notes

- Never commit your `.env` file
- Use app-specific passwords, not your main email password
- Keep dependencies updated
- Review transaction details before acting on notifications

## License

ISC

## Contributing

Issues and pull requests are welcome!
