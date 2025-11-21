/**
 * Test script for the smart contract monitor bot
 * This simulates the bot's functionality without actually running the full monitoring loop
 */

const ethers = require('ethers');

// Configuration
const config = {
  rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
  // Test with multiple contracts including high-activity USDC contract
  contractAddresses: [
    '0x4dc1ce9b9f9EF00c144BfAD305f16c62293dC0E8', // Original contract
    '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'  // USDC (Native) - High activity
  ],
};

async function testConnection() {
  console.log('Testing connection to Avalanche C-Chain...');
  
  try {
    const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    
    // Test 1: Get current block number with retry
    let blockNumber;
    let retries = 3;
    while (retries > 0) {
      try {
        blockNumber = await provider.getBlockNumber();
        break;
      } catch (error) {
        retries--;
        if (retries === 0) throw error;
        console.log(`  Retrying... (${3 - retries}/3)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('✓ Connected successfully');
    console.log(`  Current block: ${blockNumber}`);
    
    // Test 2: Get network info
    const network = await provider.getNetwork();
    console.log(`  Network: ${network.name} (chainId: ${network.chainId})`);
    
    // Test 3: Check if contract addresses are valid
    console.log(`\nChecking ${config.contractAddresses.length} contract(s)...`);
    for (let i = 0; i < config.contractAddresses.length; i++) {
      const contractAddr = config.contractAddresses[i];
      const code = await provider.getCode(contractAddr);
      if (code === '0x') {
        console.log(`⚠ Warning: No contract code found at ${contractAddr}`);
        console.log('  This might be a regular address or the contract might not exist');
      } else {
        console.log(`✓ Contract ${i + 1}: ${contractAddr}`);
        console.log(`  Contract code size: ${(code.length - 2) / 2} bytes`);
      }
    }
    
    // Test 4: Get a recent block with transactions
    console.log('\nFetching recent block to test transaction parsing...');
    const recentBlock = await provider.getBlockWithTransactions(blockNumber);
    console.log(`✓ Block ${blockNumber} has ${recentBlock.transactions.length} transactions`);
    
    // Test 5: Check for recent activity on the contracts
    console.log(`\nScanning last 100 blocks for activity on monitored contracts...`);
    const activityByContract = {};
    config.contractAddresses.forEach(addr => {
      activityByContract[addr.toLowerCase()] = [];
    });

    const startBlock = Math.max(0, blockNumber - 100);
    const contractAddrsLower = config.contractAddresses.map(addr => addr.toLowerCase());

    for (let i = blockNumber; i > startBlock; i--) {
      const block = await provider.getBlockWithTransactions(i);

      for (const tx of block.transactions) {
        const txTo = tx.to ? tx.to.toLowerCase() : null;
        const txFrom = tx.from.toLowerCase();

        for (const contractAddr of contractAddrsLower) {
          if (txTo === contractAddr || txFrom === contractAddr) {
            activityByContract[contractAddr].push({
              block: i,
              hash: tx.hash,
              from: tx.from,
              to: tx.to || 'Contract Creation',
              value: ethers.utils.formatEther(tx.value)
            });
          }
        }
      }

      // Show progress
      if ((blockNumber - i) % 10 === 0) {
        process.stdout.write(`  Scanned ${blockNumber - i} blocks...\r`);
      }
    }

    console.log(`\n\n=== Activity Summary ===`);
    let totalActivity = 0;
    for (let i = 0; i < config.contractAddresses.length; i++) {
      const addr = config.contractAddresses[i];
      const activities = activityByContract[addr.toLowerCase()];
      console.log(`\nContract ${i + 1}: ${addr}`);
      console.log(`  Transactions found: ${activities.length}`);

      if (activities.length > 0) {
        console.log(`  Most recent activity (block ${activities[0].block}):`);
        console.log(`    Tx: ${activities[0].hash}`);
        console.log(`    From: ${activities[0].from}`);
        console.log(`    To: ${activities[0].to}`);
        console.log(`    Value: ${activities[0].value} AVAX`);
      }

      totalActivity += activities.length;
    }

    console.log(`\nTotal transactions across all contracts: ${totalActivity}`);

    if (totalActivity === 0) {
      console.log('\n⚠ No activity found in the last 100 blocks on any contract');
      console.log('  Consider adding a high-activity contract like USDC for testing');
      console.log('  USDC (Native): 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E');
    } else {
      console.log('\n✓ Activity detected! The bot will send notifications for new transactions');
    }
    
    console.log('\n✓ All tests passed!');
    console.log('\nThe bot is ready to run. Configure your .env file and start with: npm start');
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

testConnection();
