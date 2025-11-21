# xusd-bot

A smart contract monitoring bot for Avalanche C-Chain that sends email notifications whenever there is activity on a specified contract address.

## Features

- 🔍 Monitors smart contract activity on Avalanche C-Chain
- 📧 Sends email notifications for all contract interactions
- ⚡ Real-time monitoring with configurable polling interval
- 🔐 Secure configuration via environment variables
- 📊 Detailed transaction information in notifications

## Contract Being Monitored

**Contract Address:** `0x4dc1ce9b9f9EF00c144BfAD305f16c62293dC0E8`  
**Network:** Avalanche C-Chain

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Email account with SMTP access (e.g., Gmail)

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

# Contract address to monitor
CONTRACT_ADDRESS=0x4dc1ce9b9f9EF00c144BfAD305f16c62293dC0E8

# Email configuration
EMAIL_FROM=your-email@gmail.com
EMAIL_TO=recipient@example.com
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your-email@gmail.com
EMAIL_SMTP_PASSWORD=your-app-password

# Polling interval in seconds (default: 60)
POLL_INTERVAL=60
```

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

## Usage

Start the monitoring bot:

```bash
npm start
```

The bot will:
1. Connect to the Avalanche C-Chain
2. Start monitoring the configured contract address
3. Send an initial notification confirming the bot has started
4. Send email notifications whenever any activity occurs on the contract

To stop the bot, press `Ctrl+C`.

## What Gets Monitored

The bot monitors all transactions that involve the configured contract address:
- Transactions sent **to** the contract
- Transactions sent **from** the contract

Each notification includes:
- Transaction hash
- Block number
- Sender address
- Recipient address
- Value transferred (in AVAX)
- Gas used
- Transaction status (success/failed)
- Direct link to Snowtrace explorer

## Configuration Options

| Variable | Description | Default |
|----------|-------------|---------|
| `AVALANCHE_RPC_URL` | Avalanche C-Chain RPC endpoint | `https://api.avax.network/ext/bc/C/rpc` |
| `CONTRACT_ADDRESS` | Smart contract address to monitor | `0x4dc1ce9b9f9EF00c144BfAD305f16c62293dC0E8` |
| `EMAIL_FROM` | Sender email address | Required |
| `EMAIL_TO` | Recipient email address | Required |
| `EMAIL_SMTP_HOST` | SMTP server hostname | Required |
| `EMAIL_SMTP_PORT` | SMTP server port | `587` |
| `EMAIL_SMTP_USER` | SMTP username | Required |
| `EMAIL_SMTP_PASSWORD` | SMTP password or app password | Required |
| `POLL_INTERVAL` | Seconds between checks | `60` |

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
