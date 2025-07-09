require('dotenv').config(); // Load environment variables from .env file
require('web-streams-polyfill'); // Polyfill for ReadableStream

const fs = require('fs');
const { Client, GatewayIntentBits } = require('discord.js');

// In-memory object to store egg data
let eggs = {};
let marriages = {}; // Track marriages

// File paths for saving data
const eggsFilePath = './eggs.json';
const marriagesFilePath = './marriages.json';

// Function to save data to a file
function saveData(filePath, data) {
fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Function to load data from a file
function loadData(filePath) {
if (fs.existsSync(filePath)) {
return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
return {};
}

// Load previously saved eggs and marriages data
eggs = loadData(eggsFilePath);
marriages = loadData(marriagesFilePath);

// Check for missing eggCreationTime on existing eggs and set it if missing
for (const eggId in eggs) {
if (!eggs[eggId].eggCreationTime) {
eggs[eggId].eggCreationTime = new Date(); // Set current time if missing
}
}

// Save updated eggs data to file
saveData(eggsFilePath, eggs);

const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers,
],
});

client.once('ready', () => {
console.log('Baby Egg Bot is online!');
});

// Helper function to calculate egg's age in days, hours, and minutes
function getEggAgeMessage(egg) {
const now = new Date();
const ageInMilliseconds = now - new Date(egg.eggCreationTime);

const days = Math.floor(ageInMilliseconds / (1000 * 60 * 60 * 24));
const hours = Math.floor((ageInMilliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
const minutes = Math.floor((ageInMilliseconds % (1000 * 60 * 60)) / (1000 * 60));

return `**Egg-Age**: ${days} days, ${hours} hours, and ${minutes} minutes`;
}

// Handle messages
client.on('messageCreate', async (message) => {
if (message.author.bot) return;

const args = message.content.split(' ');
const command = args[0].toLowerCase();

// Create an egg with a follow-up interaction for gender and name
if (command === '!create-egg') {
if (eggs[message.author.id]) {
return message.reply("You already have an egg! Use !egg-status to check its status.");
}

const filter = (response) => response.author.id === message.author.id;

// Step 1: Ask for gender
message.reply("What is the gender of your egg? Please respond with 'male', 'female', or 'non-binary'.");

const genderResponse = await message.channel.awaitMessages({ filter, time: 15000, max: 1, errors: ['time'] });
const gender = genderResponse.first().content.toLowerCase();
if (!['male', 'female', 'non-binary'].includes(gender)) {
return message.reply("Invalid gender! Please respond with 'male', 'female', or 'non-binary'.");
}

// Step 2: Ask for egg's name
message.reply("What would you like to name your egg?");
const nameResponse = await message.channel.awaitMessages({ filter, time: 15000, max: 1, errors: ['time'] });
const eggName = nameResponse.first().content;

// Step 3: Save egg data in the in-memory object
eggs[message.author.id] = {
eggName: eggName,
gender: gender,
partnerId: null,
feedStatus: false,
hydrateStatus: false,
playStatus: false,
washStatus: false,
cuddleStatus: false,
lastFed: new Date(),
lastHydrated: new Date(),
lastPlayed: new Date(),
lastWashed: new Date(),
lastCuddled: new Date(),
isDead: false, // Track if the egg is dead
eggCreationTime: new Date() // Track when the egg was created
};

// Save updated eggs data to file immediately after creating the egg
saveData(eggsFilePath, eggs);

message.reply(`You have created a baby egg named ${eggName} (${gender})!`);
}

// Egg status command to check egg information and care timeline
if (command === '!egg-status') {
const userEgg = eggs[message.author.id];
const userPartnerId = marriages[message.author.id] ? marriages[message.author.id] : null;
const partnerEgg = userPartnerId ? eggs[userPartnerId] : null;

// If the user doesn't have an egg and is married, show that they're eggless, but show their partner's egg
if (!userEgg) {
if (partnerEgg) {
return message.reply(`
You currently don't have a baby egg.

**Partner's Egg:**
- Name: ${partnerEgg.eggName}
- Gender: ${partnerEgg.gender}
${getEggAgeMessage(partnerEgg)}
`);
} else {
return message.reply("You currently don't have a baby egg. You can create one now! Use !create-egg.");
}
}

// If the user has an egg, show their egg status
if (userEgg) {
if (userEgg.isDead) {
return message.reply(`Your egg named ${userEgg.eggName} has sadly passed away! RIP `);
}
}

// Construct the status message for the user
const userEggName = userEgg ? userEgg.eggName : 'No egg yet';
const userEggGender = userEgg ? userEgg.gender : 'Unknown';
const partnerEggName = partnerEgg ? partnerEgg.eggName : 'No egg yet';
const partnerEggGender = partnerEgg ? partnerEgg.gender : 'Unknown';

message.reply(`
**Your Egg:**
- Name: ${userEggName}
- Gender: ${userEggGender}
${userEgg && getEggAgeMessage(userEgg)}
${userEgg && getRemainingCareTimeMessage(userEgg)}

**Partner's Egg:**
- Name: ${partnerEggName}
- Gender: ${partnerEggGender}
${partnerEgg && getEggAgeMessage(partnerEgg)}
${partnerEgg && getRemainingCareTimeMessage(partnerEgg)}
`);
}

// Add a `hasRevived` flag to track if the user has revived their egg
eggs[message.author.id] = {
...eggs[message.author.id], // Spread the existing data
hasRevived: false, // Flag to check if the user has already revived their egg
};

// Implement the !revive command
if (command === '!revive') {
const userEgg = eggs[message.author.id];

if (!userEgg) {
return message.reply("You don't have an egg to revive! Create one first using !create-egg.");
}

if (!userEgg.isDead) {
return message.reply("Your egg is not dead, so there is no need to revive it!");
}

if (userEgg.hasRevived) {
return message.reply("You have already revived your egg! You cannot revive it again.");
}

// Revive the egg by resetting its creation time and setting isDead to false
userEgg.isDead = false;
userEgg.eggCreationTime = new Date(); // Reset the egg's creation time to 72 hours from now
userEgg.hasRevived = true; // Mark the egg as revived

// Save the updated eggs data to the file
saveData(eggsFilePath, eggs);

message.reply(`Your egg named ${userEgg.eggName} has been revived! It now has a full 72 hours to live.`);
}

// Helper function to get the remaining time message
function getRemainingCareTimeMessage(egg) {
const now = new Date();
const careActions = ['feed', 'hydrate', 'play', 'wash', 'cuddle'];
const lastCareDates = [
egg.lastFed, egg.lastHydrated, egg.lastPlayed, egg.lastWashed, egg.lastCuddled
];

let timeRemaining = [];

// Calculate time left for each action
for (let i = 0; i < careActions.length; i++) {
if (lastCareDates[i]) {
const lastCareDate = new Date(lastCareDates[i]);
if (isNaN(lastCareDate.getTime())) {
// Skip invalid date values
continue;
}

const diffInHours = (now - lastCareDate) / (1000 * 60 * 60); // Time in hours

if (diffInHours >= 72) {
egg.isDead = true; // Mark the egg as dead after 24 hours without care
saveData(eggsFilePath, eggs); // Save updated eggs data to the file immediately
break;
} else {
const remainingTime = 72 - diffInHours; // Time left in hours
const hoursLeft = Math.floor(remainingTime);
const minutesLeft = Math.floor((remainingTime - hoursLeft) * 60);

if (hoursLeft > 0) {
timeRemaining.push(`${hoursLeft} hours and ${minutesLeft} minutes until ${careActions[i]}`);
} else {
timeRemaining.push(`${minutesLeft} minutes until ${careActions[i]}`);
}
}
}
}

return timeRemaining.length > 0 ? '\n' + timeRemaining.join('\n') : '';
}

// Disown an egg (removes the user's egg data)
if (command === '!disown-egg') {
if (!eggs[message.author.id]) {
return message.reply("You don't have an egg to disown!");
}

// Remove the user's egg from the eggs object
delete eggs[message.author.id];

// Save the updated eggs data to the file
saveData(eggsFilePath, eggs);

// Notify the user that their egg has been disowned
message.reply("You have successfully disowned your egg. It is no longer yours.");
}

// Marry someone and take care of both eggs (even if one or both don't have eggs)
if (command === '!marry') {
const partner = message.mentions.users.first();
if (!partner) return message.reply('Please mention a user to marry.');

if (partner.id === message.author.id) {
return message.reply("You cannot marry yourself!");
}

// Check if the user is already married
if (marriages[message.author.id]) {
return message.reply("You are already married to someone else. You can't marry another user until you break up.");
}

// Ask the mentioned user if they want to marry
message.reply(`${partner.username}, do you want to marry ${message.author.username}? Please reply with 'yes' or 'no'.`);

// Filter for the response
const filter = (response) => response.author.id === partner.id && ['yes', 'no'].includes(response.content.toLowerCase());
const marriageResponse = await message.channel.awaitMessages({ filter, time: 15000, max: 1, errors: ['time'] });

if (marriageResponse.first().content.toLowerCase() === 'no') {
return message.reply(`${partner.username} said no to the marriage.`);
}

// If "yes", proceed with the marriage
marriages[message.author.id] = partner.id;
marriages[partner.id] = message.author.id;

// Save updated marriages data to file
saveData(marriagesFilePath, marriages);

message.reply(`${partner.username} accepted the marriage! You both take care of each other's eggs!`);
}

// Breakup command - User needs to ping the partner
if (command === '!breakup') {
const partner = message.mentions.users.first();
if (!partner) return message.reply("Please mention the user you want to break up with.");

if (marriages[message.author.id] !== partner.id) {
return message.reply("You are not married to this user!");
}

// Break up with the partner
delete marriages[message.author.id];
delete marriages[partner.id];

// Save updated marriages data to file
saveData(marriagesFilePath, marriages);

message.reply(`You have broken up with ${partner.username}. You are no longer married.`);
}

// Care commands (feed, hydrate, etc.) - Allow users to specify which egg they want to take care of
if (['!feed', '!hydrate', '!play', '!wash', '!cuddle'].includes(command)) {
const actionMap = {
'!feed': 'lastFed',
'!hydrate': 'lastHydrated',
'!play': 'lastPlayed',
'!wash': 'lastWashed',
'!cuddle': 'lastCuddled',
};

const action = actionMap[command];
const eggName = args.slice(1).join(' ');

if (!eggName) {
return message.reply("You need to specify the egg's name to care for it.");
}

const userEgg = eggs[message.author.id];
const partnerEgg = marriages[message.author.id] ? eggs[marriages[message.author.id]] : null;

// Find the target egg (user's egg or partner's egg)
const targetEgg = (userEgg && userEgg.eggName.toLowerCase() === eggName.toLowerCase())
? userEgg
: (partnerEgg && partnerEgg.eggName.toLowerCase() === eggName.toLowerCase())
? partnerEgg
: null;

if (!targetEgg) {
return message.reply("You don't have an egg with that name!");
}

// Check if egg is dead
if (targetEgg.isDead) {
targetEgg.isDead = false; // Reset isDead status
}

// Update egg care status
targetEgg[action] = new Date();

// Save updated eggs data to the file immediately
saveData(eggsFilePath, eggs);

message.reply(`You have successfully ${command.slice(1)} the egg named ${eggName}!`);
}

// Hug command - Users can give a hug to another user
if (command === '!hug') {
const mentionedUser = message.mentions.users.first();
if (!mentionedUser) {
return message.reply("You need to mention someone to give them a hug!");
}

message.reply(`${message.author.username} gives ${mentionedUser.username} a warm, cozy hug! 🤗💖`);
}

// List of accessories for the shop
const accessories = [
'🧢 Baseball Cap - 100 coins',
'👒 Wide-brimmed Hat - 150 coins',
'🧤 Gloves - 80 coins',
'🧣 Scarf - 120 coins',
'👓 Sunglasses - 90 coins',
'👚 T-shirt - 200 coins',
'👗 Dress - 250 coins',
'👖 Jeans - 220 coins',
'👔 Tie - 70 coins',
'👕 Hoodie - 180 coins',
'🧥 Jacket - 300 coins',
'🎩 Top Hat - 350 coins',
'👢 Boots - 160 coins',
'👠 High Heels - 180 coins',
'🥿 Flats - 130 coins',
'👡 Sandals - 100 coins',
'👟 Sneakers - 150 coins',
'🧢 Beanie - 110 coins',
'👜 Handbag - 210 coins',
'🎒 Backpack - 140 coins',
'🛍️ Shopping Bag - 90 coins',
'💍 Ring - 400 coins',
'📿 Necklace - 180 coins',
'📿 Bracelet - 110 coins',
'🎽 Tank Top - 130 coins',
'🧸 Teddy Bear - 70 coins',
'👙 Bikini - 120 coins',
'😈 Londons Game Worn Devils Jersey - 1000 coins **RARE ⭐**',
'😈 Emilys Game Worn Devils Jersey - 1000 coins **RARE ⭐**',
'🐒 Isabellas Monkey Costume - 1000 coins **RARE ⭐**',
'🧥 Brandons Leather Jacket - 1000 coins **RARE ⭐**'

];

// Handle the !shop command
if (command === '!shop') {
const shopMessage = `
**Welcome to the shop! Here are the items available for purchase:** \n${accessories.join('\n')}
`;
message.reply(shopMessage);
}
const fs = require('fs');

// In-memory object to track the last claim time for users
let lastClaim = {}; // Format: { userId: Date }
// In-memory object to store the user's coin balances
let coins = {}; // Format: { userId: balance }

// File paths to save data
const lastClaimFilePath = './lastClaim.json';
const coinsFilePath = './coins.json';

// Function to load data from a file
function loadData(filePath) {
if (fs.existsSync(filePath)) {
return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
return {};
}

// Load the saved data (if any)
lastClaim = loadData(lastClaimFilePath);
coins = loadData(coinsFilePath);

// Handle the !daily command
if (command === '!daily') {
const userId = message.author.id;
const now = new Date();

// Check if the user has already claimed their daily reward
if (lastClaim[userId]) {
const lastClaimTime = new Date(lastClaim[userId]);
const diffInHours = (now - lastClaimTime) / (1000 * 60 * 60); // Difference in hours

if (diffInHours < 24) {
const hoursLeft = Math.ceil(24 - diffInHours);
return message.reply(`You can claim your daily reward in ${hoursLeft} hours.`);
}
}

// Generate a random amount of coins between 50 and 200
const dailyCoins = Math.floor(Math.random() * (200 - 50 + 1)) + 50;

// Update the user's coin balance
if (!coins[userId]) {
coins[userId] = 0; // Initialize the user's balance if not set
}
coins[userId] += dailyCoins;

// Update the last claim time for the user
lastClaim[userId] = now;

// Save the updated data to files
saveData(lastClaimFilePath, lastClaim);
saveData(coinsFilePath, coins);

message.reply(`You have successfully claimed ${dailyCoins} coins!`);
}

// Handle the !balance command
if (command === '!balance') {
const userId = message.author.id;

// Check if the user has a balance
const userBalance = coins[userId] || 0; // Default to 0 if the user has no balance yet

message.reply(`Your current coin balance is: ${userBalance} coins.`);
}

// Marriage status command - Display current marriages
if (command === '!marriage-status') {
let statusMessage = "Current Marriages:\n";
for (const [userId, partnerId] of Object.entries(marriages)) {
statusMessage += `<@${userId}> is married to <@${partnerId}>\n`;
}
message.reply(statusMessage || "No one is married yet.");
}

// In-memory object to track the inventory of users
let inventory = {}; // Format: { userId: [item1, item2, ...] }
// File path to save the inventory data
const inventoryFilePath = './inventory.json';

// Function to load data from a file
function loadData(filePath) {
if (fs.existsSync(filePath)) {
return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
return {};
}

// Load the saved inventory data (if any)
inventory = loadData(inventoryFilePath);

// Items for sale (price and item name)
const itemsForSale = {
'baseball cap': 100,
'wide-brimmed hat': 150,
'gloves': 80,
'scarf': 120,
'sunglasses': 90,
't-shirt': 200,
'dress': 250,
'jeans': 220,
'tie': 70,
'hoodie': 180,
'jacket': 300,
'top hat': 350,
'boots': 160,
'high heels': 180,
'flats': 130,
'sandals': 100,
'sneakers': 150,
'beanie': 110,
'handbag': 210,
'backpack': 140,
'shopping bag': 90,
'ring': 400,
'necklace': 180,
'bracelet': 110,
'tank top': 130,
'teddy bear': 70,
'bikini': 120,
'londons game worn devils jersey' : 1000,
'emilys game worn devils jersey' : 1000,
'isabellas monkey costume' : 1000,
'brandons leather jacket' : 1000,
};

// Handle the !buy command
if (command === '!buy') {
const userId = message.author.id;
const itemName = args.slice(1).join(' ').toLowerCase(); // The item the user wants to buy

if (!itemName || !itemsForSale[itemName]) {
return message.reply("Please specify a valid item to buy. Available items: " + Object.keys(itemsForSale).join(', '));
}

const itemPrice = itemsForSale[itemName];
const userBalance = coins[userId] || 0;

if (userBalance < itemPrice) {
return message.reply(`You don't have enough coins to buy a ${itemName}. You need ${itemPrice} coins.`);
}

// Deduct the price from the user's balance
coins[userId] -= itemPrice;

// Add the item to the user's inventory (initialize inventory if not present)
if (!inventory[userId]) {
inventory[userId] = []; // Initialize the user's inventory if not set
}
inventory[userId].push(itemName);

// Save updated data to files
saveData(coinsFilePath, coins);
saveData(inventoryFilePath, inventory);

message.reply(`You have successfully bought a ${itemName}! Your remaining balance is ${coins[userId]} coins.`);
}

// Create a mapping of item names to their emojis
const itemEmojiMap = {
'baseball cap': '🧢 Baseball Cap',
'wide-brimmed hat': '👒 Wide-brimmed Hat',
'gloves': '🧤 Gloves',
'scarf': '🧣 Scarf',
'sunglasses': '👓 Sunglasses',
't-shirt': '👚 T-shirt',
'dress': '👗 Dress',
'jeans': '👖 Jeans',
'tie': '👔 Tie',
'hoodie': '👕 Hoodie',
'jacket': '🧥 Jacket',
'top hat': '🎩 Top Hat',
'boots': '👢 Boots',
'high heels': '👠 High Heels',
'flats': '🥿 Flats',
'sandals': '👡 Sandals',
'sneakers': '👟 Sneakers',
'beanie': '🧢 Beanie',
'handbag': '👜 Handbag',
'backpack': '🎒 Backpack',
'shopping bag': '🛍️ Shopping Bag',
'ring': '💍 Ring',
'necklace': '📿 Necklace',
'bracelet': '📿 Bracelet',
'tank top': '🎽 Tank Top',
'teddy bear': '🧸 Teddy Bear',
'bikini': '👙 Bikini',
};

// Pet shop with available pets and prices
const petsForSale = {
'dog': 500,
'cat': 400,
'parrot': 350,
'hamster': 150,
'rabbit': 200,
'turtle': 250,
'fish': 100,
'iguana': 600,
'ferret': 450,
'guinea pig': 300,
'chicken': 180,
'duck': 220,
'gecko': 350,
'tarantula': 500,
'chinchilla': 550,
'mini pig': 650,
'horse': 1200,
'alpaca': 800,
'emilys snake' : 2000,
'frank' : 2000,
'jackson' : 2000,


};

// Pet emoji mapping for display
const petEmojiMap = {
'dog': '🐶 Dog',
'cat': '🐱 Cat',
'parrot': '🦜 Parrot',
'hamster': '🐹 Hamster',
'rabbit': '🐰 Rabbit',
'turtle': '🐢 Turtle',
'fish': '🐟 Fish',
'iguana': '🦎 Iguana',
'ferret': '🦡 Ferret',
'guinea pig': '🐹 Guinea Pig',
'chicken': '🐔 Chicken',
'duck': '🦆 Duck',
'gecko': '🦎 Gecko',
'tarantula': '🕷 Tarantula',
'chinchilla': '🐾 Chinchilla',
'mini pig': '🐖 Mini Pig',
'horse': '🐎 Horse',
'alpaca': '🦙 Alpaca',
'emilys snake': '🐍 Emilys Snake **RARE ⭐**',
'frank' : '🐱 Frank **RARE ⭐**',
'jackson': '🐶 Jackson **RARE ⭐**',

};

// Handle the !pet-shop command
if (command === '!pet-shop') {
const userId = message.author.id;

// List available pets for sale
const petList = Object.keys(petsForSale).map(pet => `${petEmojiMap[pet] || pet}: ${petsForSale[pet]} coins`).join('\n');

if (!petList) {
return message.reply("There are no pets available in the shop right now.");
}

message.reply(`**Welcome to the Pet Shop!**\nHere are the pets you can buy:\n${petList}`);
}

// Handle the !buy-pet command for buying pets
if (command === '!buy-pet') {
const userId = message.author.id;
const petName = args.slice(1).join(' ').toLowerCase(); // The pet the user wants to buy

// Check if the pet exists in the pet shop
if (!petName || !petsForSale[petName]) {
return message.reply("Please specify a valid pet to buy. Available pets: " + Object.keys(petsForSale).join(', '));
}

const petPrice = petsForSale[petName];
const userBalance = coins[userId] || 0;

// Check if the user has enough coins to buy the pet
if (userBalance < petPrice) {
return message.reply(`You don't have enough coins to buy a ${petName}. You need ${petPrice} coins.`);
}

// Deduct the price of the pet from the user's balance
coins[userId] -= petPrice;

// Add the pet to the user's inventory (initialize inventory if not present)
if (!inventory[userId]) {
inventory[userId] = []; // Initialize the user's inventory if not set
}
inventory[userId].push(petName);

// Save updated data to files (coins and inventory)
saveData(coinsFilePath, coins);
saveData(inventoryFilePath, inventory);

// Reply to the user confirming the purchase
message.reply(`You have successfully bought a ${petName}! Your remaining balance is ${coins[userId]} coins.`);
}
// Define your bot owner's ID (replace with your actual Discord user ID)
const botOwnerId = '532707705002000386'; // Replace this with your actual Discord user ID

// Handle the !add-coins command
if (command === '!add-coins') {
// Check if the author of the command is the bot owner
if (message.author.id !== botOwnerId) {
return message.reply("You do not have permission to use this command.");
}

// Ensure the user provides a valid target user and the number of coins to add
const targetUserId = args[1]; // User ID of the target user
const amount = parseInt(args[2], 10); // Amount of coins to add

// Validate the input
if (!targetUserId || isNaN(amount) || amount <= 0) {
return message.reply("Please specify a valid user ID and a positive number of coins to add.");
}

// Check if the user has a coin balance already, otherwise initialize it
if (!coins[targetUserId]) {
coins[targetUserId] = 0; // Initialize the user's balance if not set
}

// Add the specified amount of coins to the target user's balance
coins[targetUserId] += amount;

// Save the updated data to the file
saveData(coinsFilePath, coins);

// Send a confirmation message
message.reply(`Successfully added ${amount} coins to <@${targetUserId}>'s balance! They now have ${coins[targetUserId]} coins.`);
}
// Handle the !share-coins command
if (command === '!share-coins') {
const senderId = message.author.id; // ID of the sender (author of the command)
const recipientId = args[1]; // The recipient's user ID
const amount = parseInt(args[2], 10); // The amount of coins to send

// Validate the input
if (!recipientId || isNaN(amount) || amount <= 0) {
return message.reply("Please specify a valid user ID and a positive number of coins to share.");
}

// Check if the sender has enough coins
const senderBalance = coins[senderId] || 0;
if (senderBalance < amount) {
return message.reply(`You don't have enough coins to share. You need ${amount} coins, but you only have ${senderBalance} coins.`);
}

// Ensure the recipient has a balance (initialize if necessary)
if (!coins[recipientId]) {
coins[recipientId] = 0; // Initialize the recipient's balance if not set
}

// Deduct coins from sender and add to recipient
coins[senderId] -= amount;
coins[recipientId] += amount;

// Save the updated coin balances
saveData(coinsFilePath, coins);

// Send a confirmation message
message.reply(`Successfully shared ${amount} coins with <@${recipientId}>! Your new balance is ${coins[senderId]} coins.`);
}
// Handle the !remove-coins command
if (command === '!remove-coins') {
// Check if the author of the command is the bot owner
if (message.author.id !== botOwnerId) {
return message.reply("You do not have permission to use this command.");
}

// Ensure the user provides a valid target user and the number of coins to remove
const targetUserId = args[1]; // User ID of the target user
const amount = parseInt(args[2], 10); // Amount of coins to remove

// Validate the input
if (!targetUserId || isNaN(amount) || amount <= 0) {
return message.reply("Please specify a valid user ID and a positive number of coins to remove.");
}

// Check if the user has enough coins
const currentBalance = coins[targetUserId] || 0;
if (currentBalance < amount) {
return message.reply(`The user doesn't have enough coins to remove. They currently have ${currentBalance} coins.`);
}

// Deduct the specified amount of coins from the user's balance
coins[targetUserId] -= amount;

// Save the updated data to the file
saveData(coinsFilePath, coins);

// Send a confirmation message
message.reply(`Successfully removed ${amount} coins from <@${targetUserId}>'s balance! They now have ${coins[targetUserId]} coins.`);
}
// Handle the !view-balance command
if (command === '!view-balance') {
const targetUser = message.mentions.users.first(); // Get the mentioned user

// Ensure a recipient is mentioned
if (!targetUser) {
return message.reply("Please mention the user whose balance you want to view.");
}

const targetUserId = targetUser.id; // Get the user ID from the mention

// Check if the target user exists in the coin data, default to 0 if not
const targetBalance = coins[targetUserId] || 0;

// Reply with the balance of the target user
message.reply(`<@${targetUserId}> currently has ${targetBalance} coins.`);
}
// Handle the !egg-status command to show both pets and accessories
if (command === '!egg-status') {
const userId = message.author.id;

// Check if the user has any items (pets or accessories) in their inventory
if (!inventory[userId] || inventory[userId].length === 0) {
return message.reply("You don't have any pets or accessories yet! Buy some from the shop!");
}

// Filter out only pets from the inventory
const ownedPets = inventory[userId].filter(item => petsForSale[item]); // Only keep items that are pets
const ownedAccessories = inventory[userId].filter(item => !petsForSale[item]); // Items that are accessories

let petList = '';
let accessoriesList = '';

// If the user has pets, list them
if (ownedPets.length > 0) {
petList = ownedPets.map(pet => {
return petEmojiMap[pet] || pet; // If no emoji is found, just return the pet name
}).join('\n');
} else {
petList = "You don't have any pets yet! Buy some from the pet shop!";
}

// If the user has accessories, list them
if (ownedAccessories.length > 0) {
accessoriesList = ownedAccessories.map(item => {
return itemEmojiMap[item] || item; // If no emoji is found, just return the item name
}).join('\n');
} else {
accessoriesList = "You don't have any accessories yet! Buy some from the shop!";
}

// Build the message to show both pets and accessories
message.reply(`**Your Pets**\n${petList}\n\n**Eggie Accessories**\n${accessoriesList}`);
}
// Handle the !bet command
if (command === '!bet') {
const userId = message.author.id;
const betAmount = parseInt(args[1], 10); // The amount the user wants to bet

// Check if the bet amount is valid
if (isNaN(betAmount) || betAmount <= 0) {
return message.reply("Please specify a valid bet amount.");
}

// Check if the user has enough coins to bet
const userBalance = coins[userId] || 0;
if (userBalance < betAmount) {
return message.reply(`You don't have enough coins to bet. You need ${betAmount} coins, but you only have ${userBalance} coins.`);
}

// Generate a random outcome: 0 for loss, 1 for double win, 2 for triple win
const outcome = Math.floor(Math.random() * 3); // 0, 1, or 2

let resultMessage = '';
let coinsWon = 0;

if (outcome === 0) {
// The user loses the bet
coins[userId] -= betAmount;
resultMessage = `You lost your bet of ${betAmount} coins. Better luck next time!`;
} else if (outcome === 1) {
// The user breaks even
resultMessage = `You broke even! You didn't win or lose any coins. Your balance remains ${coins[userId]} coins.`;
} else if (outcome === 2) {
// The user wins double
coinsWon = betAmount * 2;
coins[userId] += coinsWon;
resultMessage = `You won double! You gained ${coinsWon} coins. Your new balance is ${coins[userId]} coins.`;
} else {
// The user wins triple
coinsWon = betAmount * 3;
coins[userId] += coinsWon;
resultMessage = `You won triple! You gained ${coinsWon} coins. Your new balance is ${coins[userId]} coins.`;
}

// Save the updated data to the coins file
saveData(coinsFilePath, coins);

// Send the result message
message.reply(resultMessage);
}

// Handle the !help command
if (command === '!help') {
// Define the available commands and their descriptions
const helpText = `
Welcome to the Bot Help!** Here are the commands you can use:

**!create-egg**
Creates a new egg lifeform :)

**!marry [@user]**
Marry a user in the server and take care of eggs with them

**!breakup [@user]**
Breakup with a user in the server

**!disown-egg**
Disowns a current egg you have dead or alive

**!feed, !hydrate, !play, !wash, !cuddle**
General care commands when caring for your egg.

**!buy [item]**
Buy an item from the store. Available items: Baseball Cap, Hoodie, Dress, Jeans, T-shirt, and more.

**!pet-shop**
View the available pets you can buy in the pet shop. Pets like Dogs, Cats, Rabbits, and more!

**!buy-pet [pet]**
Buy a pet from the pet shop. Pets include Dog, Cat, Parrot, Hamster, and more.

**!add-coins [user ID] [amount]**
(Bot Owner Only) Add coins to a user's balance. Requires user ID and the amount of coins.

**!share-coins [user ID] [amount]**
Share coins with another user. You must have enough coins to send.

**!remove-coins [user ID] [amount]**
(Bot Owner Only) Remove coins from a user's balance. Requires user ID and the amount to remove.

**!view-balance [user ID]**
View the balance of a user (use your own ID to check your own balance).

**!egg-status**
Check your pets and accessories inventory. View what you've purchased so far.

**!bet [amount]**
Bet some of your coins. You can win double or triple the amount. Luck is on your side!

**For more information or help, feel free to ask!**
`;

// Send the help text to the user
message.reply(helpText);
}

// Handle the !rob command
if (command === '!rob') {
const userId = message.author.id;
const targetUser = message.mentions.users.first(); // Get the mentioned user

// Ensure a target user is mentioned
if (!targetUser) {
return message.reply("Please mention the user you want to rob.");
}

const targetUserId = targetUser.id; // Get the user ID from the mentioned user
const robAmount = parseInt(args[1], 10); // Amount of coins the user wants to rob

// Validate the input for rob amount
if (isNaN(robAmount) || robAmount <= 0) {
return message.reply("Please specify a valid amount of coins to rob.");
}

// Check if the target exists and has coins
const targetBalance = coins[targetUserId] || 0;
if (targetBalance <= 0) {
return message.reply(`<@${targetUserId}> doesn't have any coins to rob.`);
}

// Check if the user has enough coins to attempt the robbery
const userBalance = coins[userId] || 0;
if (userBalance <= 0) {
return message.reply("You don't have any coins to start a robbery. Try earning some first.");
}

// Generate a random outcome for the robbery (0 for failure, 1 for success)
const successChance = Math.random(); // Random number between 0 and 1

let resultMessage = '';
let stolenCoins = 0;

if (successChance < 0.5) {
// Robbery fails, user loses some coins (for attempting)
stolenCoins = Math.floor(robAmount / 2); // Lose half the intended rob amount as punishment
coins[userId] -= stolenCoins;
resultMessage = `The robbery failed! You lost ${stolenCoins} coins in the attempt. Better luck next time!`;
} else {
// Robbery is successful, user steals the coins
stolenCoins = Math.min(robAmount, targetBalance); // Steal only as much as the target has
coins[userId] += stolenCoins;
coins[targetUserId] -= stolenCoins;
resultMessage = `The robbery was successful! You stole ${stolenCoins} coins from <@${targetUserId}>. Your new balance is ${coins[userId]} coins.`;
}

// Save the updated data to the file
saveData(coinsFilePath, coins);

// Send the result message
message.reply(resultMessage);
}


});

// Log in to Discord using the bot token from .env
client.login(process.env.TOKEN); 
