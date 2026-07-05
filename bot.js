require("dotenv").config();
const { ethers } = require("ethers");
const axios = require("axios");

const {
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  WSS_RPC_URL,
  NFT_CONTRACT,
} = process.env;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || !WSS_RPC_URL || !NFT_CONTRACT) {
  console.error("❌ Missing .env values");
  process.exit(1);
}

const provider = new ethers.WebSocketProvider(WSS_RPC_URL);

const nftAbi = [
  "event MembershipPurchased(address indexed user, uint256 indexed tokenId, uint8 tier, address referrer)",
];

const nftContract = new ethers.Contract(NFT_CONTRACT, nftAbi, provider);

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatNumber(value, decimals = 2) {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function getBscScanTxLink(txHash) {
  return `https://bscscan.com/tx/${txHash}`;
}

async function sendTelegram(message) {
  await axios.post(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }
  );
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
      thanks:
        "Every great journey begins with a first step. Thank you for joining NetGain DAO and becoming part of our long-term community vision.",
    };
  }

  if (tierNumber === 2) {
    return {
      name: "Silver",
      emoji: "🥈",
      price: 500,
      power: "2× Power",
      title: "🥈 NEW SILVER MEMBER",
      thanks:
        "Thank you for your strong confidence in NetGain DAO. Your participation helps strengthen the community and support ecosystem growth.",
    };
  }

  if (tierNumber === 3) {
    return {
      name: "Gold",
      emoji: "🥇",
      price: 1500,
      power: "3× Power",
      title: "🥇 NEW GOLD MEMBER",
      thanks:
        "Thank you for your outstanding commitment to NetGain DAO. Gold Members represent the highest level of participation in the ecosystem.",
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

async function handleMembershipPurchased(user, tokenId, tier, referrer, event) {
  try {
    const info = getMembershipInfo(tier);
    const txHash = event.log.transactionHash;
    const txLink = getBscScanTxLink(txHash);

    const hasReferrer =
      referrer &&
      referrer.toLowerCase() !== "0x0000000000000000000000000000000000000000";

    const message = `${info.title}

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
}

async function startBot() {
  const network = await provider.getNetwork();

  console.log("🚀 NetGain NFT WebSocket Alert Bot is running...");
  console.log(`🌐 Chain ID: ${network.chainId}`);
  console.log(`🎟 NFT Contract: ${NFT_CONTRACT}`);
  console.log("👂 Listening for MembershipPurchased events...");

  nftContract.on("MembershipPurchased", handleMembershipPurchased);
}

startBot();