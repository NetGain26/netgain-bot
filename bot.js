require("dotenv").config();
const { ethers } = require("ethers");
const axios = require("axios");

const {
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  RPC_URL,
  BUY_STAKE_CONTRACT,
  NFT_CONTRACT,
  GOVERNANCE_CONTRACT,
  TREASURY_PROFIT_CONTRACT,
  MIN_ALERT_USDT = "100",
} = process.env;

if (
  !TELEGRAM_BOT_TOKEN ||
  !TELEGRAM_CHAT_ID ||
  !RPC_URL ||
  !BUY_STAKE_CONTRACT ||
  !NFT_CONTRACT ||
  !GOVERNANCE_CONTRACT ||
  !TREASURY_PROFIT_CONTRACT
) {
  console.error("❌ Missing .env values");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);

const buyStakeAbi = [
  "event BuyAndStaked(uint256 indexed tokenId, address indexed user, uint256 usdtAmount, uint256 ngAmount)",
];

const nftAbi = [
  "event MembershipPurchased(address indexed user, uint256 indexed tokenId, uint8 tier, address referrer)",
];

const governanceAbi = [
  "event ProposalCreated(uint256 indexed proposalId, string title, string category, bool executable, uint256 endTime)",
  "event ProposalFinalized(uint256 indexed proposalId, uint8 status, uint256 yesPower, uint256 noPower, uint256 executableAt)",
  "event ProposalExecuted(uint256 indexed proposalId)",
];

const treasuryProfitAbi = [
  "event DistributionCreated(uint256 indexed distributionId, uint256 amountUSDT, uint256 redemptionPrice, uint256 commitEnd, uint256 claimDeadline)",
];

const buyStakeContract = new ethers.Contract(BUY_STAKE_CONTRACT, buyStakeAbi, provider);
const nftContract = new ethers.Contract(NFT_CONTRACT, nftAbi, provider);
const governanceContract = new ethers.Contract(GOVERNANCE_CONTRACT, governanceAbi, provider);
const treasuryProfitContract = new ethers.Contract(TREASURY_PROFIT_CONTRACT, treasuryProfitAbi, provider);

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatNumber(value, decimals = 2) {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function formatDate(timestamp) {
  return new Date(Number(timestamp) * 1000).toUTCString();
}

function getBscScanTxLink(txHash) {
  return `https://testnet.bscscan.com/tx/${txHash}`;
}

async function sendTelegram(message) {
  await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

function getBuyStakeLevel(usdtAmount) {
  if (usdtAmount >= 5000) {
    return {
      title: "🐋🔥 MASSIVE BUY & STAKE 🔥🐋",
      badge: "WHALE ALERT",
      thanks: "A powerful move for the NetGain DAO ecosystem. Thank you for your strong confidence and long-term participation.",
      emoji: "🐋",
    };
  }

  if (usdtAmount >= 1000) {
    return {
      title: "🚀 BIG BUY & STAKE",
      badge: "MAJOR PARTICIPATION",
      thanks: "A strong contribution to the growth of NetGain DAO. Thank you for building with the community.",
      emoji: "🚀",
    };
  }

  if (usdtAmount >= 500) {
    return {
      title: "💎 NEW BUY & STAKE",
      badge: "STRONG ENTRY",
      thanks: "Another strong step forward for the NetGain DAO community.",
      emoji: "💎",
    };
  }

  return {
    title: "🚀 NEW BUY & STAKE",
    badge: "COMMUNITY GROWTH",
    thanks: "Every new participation helps the ecosystem grow.",
    emoji: "🚀",
  };
}

function getMembershipInfo(tier) {
  const tierNumber = Number(tier);

  if (tierNumber === 1) {
    return {
      name: "Bronze",
      emoji: "🥉",
      price: 100,
      power: "1× Power",
      title: "🥉 NEW BRONZE MEMBER",
      thanks: "Every great journey begins with a first step. Thank you for joining NetGain DAO and becoming part of our long-term community vision.",
    };
  }

  if (tierNumber === 2) {
    return {
      name: "Silver",
      emoji: "🥈",
      price: 500,
      power: "2× Power",
      title: "🥈 NEW SILVER MEMBER",
      thanks: "Thank you for your strong confidence in NetGain DAO. Your participation helps strengthen the community and support ecosystem growth.",
    };
  }

  if (tierNumber === 3) {
    return {
      name: "Gold",
      emoji: "🥇",
      price: 1500,
      power: "3× Power",
      title: "🥇 NEW GOLD MEMBER",
      thanks: "Thank you for your outstanding commitment to NetGain DAO. Gold Members represent the highest level of participation in the ecosystem.",
    };
  }

  return {
    name: "Unknown",
    emoji: "🎟",
    price: 0,
    power: "-",
    title: "🎟 NEW MEMBERSHIP",
    thanks: "Thank you for joining the NetGain DAO community.",
  };
}

console.log("🚀 NetGain Alert Bot is running...");
console.log(`📌 Minimum Buy & Stake alert: ${MIN_ALERT_USDT} USDT`);

// Buy & Stake Alerts
buyStakeContract.on("BuyAndStaked", async (tokenId, user, usdtAmount, ngAmount, event) => {
  try {
    const usdtNumber = Number(ethers.formatUnits(usdtAmount, 18));
    const ngNumber = Number(ethers.formatUnits(ngAmount, 18));

    if (usdtNumber < Number(MIN_ALERT_USDT)) return;

    const buyPrice = usdtNumber / ngNumber;
    const level = getBuyStakeLevel(usdtNumber);
    const txHash = event.log.transactionHash;
    const txLink = getBscScanTxLink(txHash);

    const message =
`${level.title}

🏷 <b>${level.badge}</b>

👤 <b>Wallet:</b> <code>${shortAddress(user)}</code>
🎟 <b>Membership NFT:</b> #${tokenId}

💵 <b>Investment:</b> ${formatNumber(usdtNumber)} USDT
🪙 <b>NG Staked:</b> ${formatNumber(ngNumber)} NG
📊 <b>Buy Price:</b> ${buyPrice.toFixed(6)} USDT / NG

🔗 <a href="${txLink}">View Transaction</a>

━━━━━━━━━━━━━━
${level.emoji} <b>${level.thanks}</b>

<b>NetGain DAO is growing.</b>`;

    await sendTelegram(message);
    console.log(`✅ Buy & Stake alert sent: ${txHash}`);
  } catch (err) {
    console.error("❌ Buy & Stake alert error:", err.message);
  }
});

// New Membership NFT Alerts
nftContract.on("MembershipPurchased", async (user, tokenId, tier, referrer, event) => {
  try {
    const info = getMembershipInfo(tier);
    const txHash = event.log.transactionHash;
    const txLink = getBscScanTxLink(txHash);

    const hasReferrer =
      referrer && referrer.toLowerCase() !== "0x0000000000000000000000000000000000000000";

    const message =
`${info.title}

🎉 <b>Welcome to NetGain DAO!</b>

👤 <b>Wallet:</b> <code>${shortAddress(user)}</code>
🎟 <b>Membership:</b> ${info.emoji} ${info.name}
⚡ <b>Power:</b> ${info.power}
💵 <b>Membership Price:</b> ${formatNumber(info.price)} USDT
🆔 <b>NFT ID:</b> #${tokenId}
${hasReferrer ? `🤝 <b>Referrer:</b> <code>${shortAddress(referrer)}</code>\n` : ""}
🔗 <a href="${txLink}">View Transaction</a>

━━━━━━━━━━━━━━
<b>${info.thanks}</b>

<b>One membership. One community. One long-term vision.</b>`;

    await sendTelegram(message);
    console.log(`✅ Membership alert sent: ${txHash}`);
  } catch (err) {
    console.error("❌ Membership alert error:", err.message);
  }
});

// New Proposal Alert
governanceContract.on(
  "ProposalCreated",
  async (proposalId, title, category, executable, endTime, event) => {
    try {
      const txHash = event.log.transactionHash;
      const txLink = getBscScanTxLink(txHash);

      const message =
`📝 <b>NEW GOVERNANCE PROPOSAL</b>

A new proposal has been submitted to the NetGain DAO community.

🆔 <b>Proposal ID:</b> #${proposalId}
📌 <b>Title:</b> ${title}
🏷 <b>Category:</b> ${category}
⚙️ <b>Executable:</b> ${executable ? "Yes" : "No"}
⏳ <b>Voting Ends:</b> ${formatDate(endTime)}

🔗 <a href="${txLink}">View Transaction</a>

━━━━━━━━━━━━━━
<b>Review the proposal and participate in governance.</b>

<b>NetGain DAO is community-driven.</b>`;

      await sendTelegram(message);
      console.log(`✅ New Proposal alert sent: ${proposalId}`);
    } catch (err) {
      console.error("❌ New Proposal alert error:", err.message);
    }
  }
);

// Proposal Passed Alert
governanceContract.on(
  "ProposalFinalized",
  async (proposalId, status, yesPower, noPower, executableAt, event) => {
    try {
      const txHash = event.log.transactionHash;
      const txLink = getBscScanTxLink(txHash);

      const statusNumber = Number(status);

      if (statusNumber !== 1) {
        console.log(`Ignored finalized proposal not passed: ${proposalId}`);
        return;
      }

      const yes = Number(ethers.formatUnits(yesPower, 18));
      const no = Number(ethers.formatUnits(noPower, 18));

      const message =
`✅ <b>PROPOSAL PASSED</b>

The NetGain DAO community has approved a governance proposal.

🆔 <b>Proposal ID:</b> #${proposalId}
🟢 <b>Yes Power:</b> ${formatNumber(yes)}
🔴 <b>No Power:</b> ${formatNumber(no)}
⏳ <b>Executable At:</b> ${formatDate(executableAt)}

🔗 <a href="${txLink}">View Transaction</a>

━━━━━━━━━━━━━━
<b>The proposal is now ready for the execution step.</b>`;

      await sendTelegram(message);
      console.log(`✅ Proposal Passed alert sent: ${proposalId}`);
    } catch (err) {
      console.error("❌ Proposal Finalized alert error:", err.message);
    }
  }
);

// Proposal Executed Alert
governanceContract.on("ProposalExecuted", async (proposalId, event) => {
  try {
    const txHash = event.log.transactionHash;
    const txLink = getBscScanTxLink(txHash);

    const message =
`🚀 <b>PROPOSAL EXECUTED</b>

A governance-approved proposal has been successfully executed.

🆔 <b>Proposal ID:</b> #${proposalId}

🔗 <a href="${txLink}">View Transaction</a>

━━━━━━━━━━━━━━
<b>Community governance is now reflected on-chain.</b>`;

    await sendTelegram(message);
    console.log(`✅ Proposal Executed alert sent: ${proposalId}`);
  } catch (err) {
    console.error("❌ Proposal Executed alert error:", err.message);
  }
});

// Treasury Distribution Available Alert
treasuryProfitContract.on(
  "DistributionCreated",
  async (distributionId, amountUSDT, redemptionPrice, commitEnd, claimDeadline, event) => {
    try {
      const amount = Number(ethers.formatUnits(amountUSDT, 18));
      const price = Number(ethers.formatUnits(redemptionPrice, 18));

      const txHash = event.log.transactionHash;
      const txLink = getBscScanTxLink(txHash);

      const message =
`💰 <b>TREASURY DISTRIBUTION AVAILABLE</b>

A new Treasury distribution is now available for eligible NetGain DAO members.

🆔 <b>Distribution ID:</b> #${distributionId}
💵 <b>Total Distribution:</b> ${formatNumber(amount)} USDT
📊 <b>Redemption Price:</b> ${price.toFixed(6)} USDT / NG

⏳ <b>Commit Ends:</b> ${formatDate(commitEnd)}
🏁 <b>Claim Deadline:</b> ${formatDate(claimDeadline)}

🔗 <a href="${txLink}">View Transaction</a>

━━━━━━━━━━━━━━
<b>Eligible members can now check their Treasury share.</b>`;

      await sendTelegram(message);
      console.log(`✅ Treasury Distribution alert sent: ${distributionId}`);
    } catch (err) {
      console.error("❌ Treasury Distribution alert error:", err.message);
    }
  }
);