/**
 * Test script for the smart contract monitor bot
 * This simulates the bot's functionality without actually running the full monitoring loop
 */

const ethers = require('ethers');

// Configuration
const config = {
  rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
  contractAddress: '0x4dc1ce9b9f9EF00c144BfAD305f16c62293dC0E8',
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
    
    // Test 3: Check if contract address is valid
    const code = await provider.getCode(config.contractAddress);
    if (code === '0x') {
      console.log(`⚠ Warning: No contract code found at ${config.contractAddress}`);
      console.log('  This might be a regular address or the contract might not exist');
    } else {
      console.log(`✓ Contract found at ${config.contractAddress}`);
      console.log(`  Contract code size: ${(code.length - 2) / 2} bytes`);
    }
    
    // Test 4: Get a recent block with transactions
    console.log('\nFetching recent block to test transaction parsing...');
    const recentBlock = await provider.getBlockWithTransactions(blockNumber);
    console.log(`✓ Block ${blockNumber} has ${recentBlock.transactions.length} transactions`);
    
    // Test 5: Check for recent activity on the contract
    console.log(`\nScanning last 100 blocks for activity on ${config.contractAddress}...`);
    let activityFound = false;
    const startBlock = Math.max(0, blockNumber - 100);
    
    for (let i = blockNumber; i > startBlock && !activityFound; i--) {
      const block = await provider.getBlockWithTransactions(i);
      
      for (const tx of block.transactions) {
        const contractAddr = config.contractAddress.toLowerCase();
        const txTo = tx.to ? tx.to.toLowerCase() : null;
        const txFrom = tx.from.toLowerCase();
        
        if (txTo === contractAddr || txFrom === contractAddr) {
          console.log(`✓ Found activity in block ${i}:`);
          console.log(`  Transaction: ${tx.hash}`);
          console.log(`  From: ${tx.from}`);
          console.log(`  To: ${tx.to || 'Contract Creation'}`);
          console.log(`  Value: ${ethers.utils.formatEther(tx.value)} AVAX`);
          activityFound = true;
          break;
        }
      }
      
      // Show progress
      if ((blockNumber - i) % 10 === 0) {
        process.stdout.write(`  Scanned ${blockNumber - i} blocks...\r`);
      }
    }
    
    if (!activityFound) {
      console.log('  No activity found in the last 100 blocks');
      console.log('  The bot will notify you when activity occurs');
    }
    
    console.log('\n✓ All tests passed!');
    console.log('\nThe bot is ready to run. Configure your .env file and start with: npm start');
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

testConnection();
