require("dotenv").config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActivityType, AttachmentBuilder, Collection } = require("discord.js");
const express = require("express");
const fs = require("fs").promises; // Sử dụng fs.promises cho xử lý bất đồng bộ

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel]
});

const prefix = "v";
const ownerId = process.env.OWNER_ID; // Get owner ID from .env
const DATA_FILE = "bot_data.json"; // Lưu marriages, loveCooldown, inventory
const USER_FILE = "user.json"; // Lưu lovePoints, coins, owo

// Khởi tạo state và tải dữ liệu từ file
let state = {
    marriages: new Map(),
    lovePoints: new Map(),
    coins: new Map(),
    loveCooldown: new Map(),
    inventory: new Map(),
    owo: new Map(),
    pendingTransfers: new Map(), // userId -> { targetId, amount }
    pendingMarriages: new Map(), // userId -> { proposerId, ringId }
    pendingDivorces: new Map() // userId -> { initiatorId }
};

const loadState = async () => {
    try {
        const data = await fs.readFile(DATA_FILE, "utf8");
        const parsedData = JSON.parse(data);
        state.marriages = new Map(Object.entries(parsedData.marriages));
        state.loveCooldown = new Map(Object.entries(parsedData.loveCooldown));
        state.inventory = new Map(Object.entries(parsedData.inventory).map(([key, value]) => [key, new Map(Object.entries(value))]));
        state.pendingDivorces = new Map(Object.entries(parsedData.pendingDivorces || {}));
        console.log("Dữ liệu bot đã được tải từ bot_data.json.");
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.log("Lỗi khi tải bot_data.json:", error);
        } else {
            console.log("Không tìm thấy file bot_data.json, khởi tạo mới.");
        }
    }

    try {
        const userData = await fs.readFile(USER_FILE, "utf8");
        const parsedUserData = JSON.parse(userData);
        state.lovePoints = new Map(Object.entries(parsedUserData.lovePoints));
        state.coins = new Map(Object.entries(parsedUserData.coins));
        state.owo = new Map(Object.entries(parsedUserData.owo));
        console.log("Dữ liệu người dùng đã được tải từ user.json.");
    } catch (error) {
        if (error.code !== 'ENOENT') {
            console.log("Lỗi khi tải user.json:", error);
        } else {
            console.log("Không tìm thấy file user.json, khởi tạo mới.");
        }
    }
};

const saveState = async () => {
    const botData = {
        marriages: Object.fromEntries(state.marriages),
        loveCooldown: Object.fromEntries(state.loveCooldown),
        inventory: Object.fromEntries(state.inventory),
        pendingDivorces: Object.fromEntries(state.pendingDivorces)
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(botData, null, 2));
    console.log("Dữ liệu bot đã được lưu vào bot_data.json.");

    const userData = {
        lovePoints: Object.fromEntries(state.lovePoints),
        coins: Object.fromEntries(state.coins),
        owo: Object.fromEntries(state.owo)
    };
    await fs.writeFile(USER_FILE, JSON.stringify(userData, null, 2));
    console.log("Dữ liệu người dùng đã được lưu vào user.json.");
};

loadState(); // Tải dữ liệu khi bot khởi động

const LOVE_COOLDOWN = 10 * 60 * 1000; // 10 minutes in ms
const LOVE_MESSAGES = [
    "thì thầm lời yêu ngọt ngào vào tai",
    "trao gửi ánh mắt đầy tình cảm đến",
    "ôm chặt và nói những lời yêu thương với",
    "dành tặng một nụ hôn gió cho",
    "viết một bức thư tình lãng mạn gửi tới"
];

const itemsShop1 = [
    { id: '001', name: '**Eternal Twist (ID:001)**', price: 200000, description: 'Eternal Twist đơn giản nhưng lấp lánh để cầu hôn, không có bonus.', emoji: '<:nhanvnd3:1408700110572884010>', currency: '<:mc_coin:1408468125984227360> (20K VNĐ)' },
    { id: '002', name: '**Eternal Blossom (ID: 002)**', price: 3500000, description: ' Eternal Blossom cường điệu hóa vẻ đẹp linh hồn, +1 điểm tình yêu mỗi lần love.', emoji: '<:nhanvnd2:1408700105091055656>', currency: '<:mc_coin:1408468125984227360> (35K VNĐ)' },
    { id: '003', name: '**Eternal Petal (ID: 003)**', price: 5000000, description: 'Eternal Petal sang trọng và quý phái, +2 điểm tình yêu mỗi lần love.', emoji: '<:nhanvnd1:1408700093317648424>', currency: '<:mc_coin:1408468125984227360> (50K VNĐ)' }
];

const itemsShop2 = [
    { id: '01', name: '**Ruby Thorn Crown (ID: 01)**', price: 3000000, description: 'Ruby Thorn Crown tôn nhẹ vẻ đẹp nhẹ nhàng, không có bonus.', emoji: '<:nhan1:1406990327298002986>', currency: 'OwO (3M <a:kt1_tienowo:1409437568122228787>)' },
    { id: '02', name: '**Midnight Ruby (ID: 02)**', price: 2000000, description: 'Midnight Ruby trông như một bậc mỹ nhân, +1 điểm tình yêu mỗi lần love.', emoji: '<:nhan2:1406990416842330182>', currency: 'OwO (2M <a:kt1_tienowo:1409437568122228787>)' },
    { id: '03', name: '**Dark Violet Charm (ID: 03)**', price: 1000000, description: 'Dark Violet Charm tỏa sáng vẻ đẹp trong bóng tối, +2 điểm tình yêu mỗi lần love.', emoji: '<:nhan3:1406990463365287955>', currency: 'OwO (1M <a:kt1_tienowo:1409437568122228787>)' },
    { id: '04', name: '**Dark Ruby Charm (ID: 04)**', price: 500000, description: 'Dark Ruby Charm là món quà xinh đẹp từ màn đêm, +3 điểm tình yêu.', emoji: '<:nhan4:1406990506663215134>', currency: 'OwO (500k <a:kt1_tienowo:1409437568122228787>)' }
];
// Cộng  chức năng tình yêu cho nhẫn
const ringBonuses = {
    '001': 0, '002': 1, '003': 2, '01': 0, '02': 1, '03': 2,
    '04': 3, 'stella_ring1': 2, 'serena_ring1': 1, 'nova_ring1': 3,
    'basic_ring2': 0, 'silver_ring2': 1, 'gold_ring2': 2, 'platinum_ring2': 3, 'diamond_ring2': 4, 'aurora_ring2': 5,
    'luna_ring2': 1, 'stella_ring2': 2, 'serena_ring2': 1, 'nova_ring2': 3
};

// Utility Functions
const addLovePoint = async (userId, amount = 1) => {
    const oldPoints = state.lovePoints.get(userId) || 0;
    const newPoints = oldPoints + amount;
    state.lovePoints.set(userId, newPoints);

    const coinAdd = Math.floor(newPoints / 10) - Math.floor(oldPoints / 10);
    if (coinAdd > 0) {
        const userCoins = state.coins.get(userId) || 0;
        state.coins.set(userId, userCoins + 5 * coinAdd);
        const userOwo = state.owo.get(userId) || 0;
        state.owo.set(userId, userOwo + 3 * coinAdd); // Thêm Owo khi kiếm điểm
    }
    await saveState(); // Lưu sau khi cập nhật điểm
    return newPoints;
};

const getRandomLoveMessage = () => {
    return LOVE_MESSAGES[Math.floor(Math.random() * LOVE_MESSAGES.length)];
};

const getItemById = (itemId, shopItems) => shopItems.find(item => item.id === itemId);

const consumeItem = async (userId, itemId) => {
    const userInv = state.inventory.get(userId);
    if (!userInv) return false;
    const count = userInv.get(itemId) || 0;
    if (count <= 0) return false;
    userInv.set(itemId, count - 1);
    if (userInv.get(itemId) === 0) userInv.delete(itemId);
    if (userInv.size === 0) state.inventory.delete(userId);
    await saveState(); // Lưu sau khi tiêu thụ item
    return true;
};

// Command Handler
const commands = {
    help: {
        description: "Xem danh sách lệnh",
        execute: async (message) => {
            const helpEmbed = new EmbedBuilder()
                .setTitle("<a:uk:1409448258182320140> Hướng Dẫn Mystvale Bot")
                .setColor(0x00aeff)
                .setThumbnail(client.user.displayAvatarURL())
                .setDescription(`Dùng prefix \`${prefix}\` trước các lệnh`)
                .addFields(
                    { name: "<a:kt1_pinkpresslove:1409512102145556704> vmry @user <ring_id>", value: "Cầu hôn một người đặc biệt với loại nhẫn chỉ định (xem vshop1/vshop2 để mua nhẫn)." },
                    { name: "<a:sf_greenheartbroken:1409508628074856478> vdc", value: "Đề nghị ly hôn với người bạn đã kết hôn (cần đối phương dùng vcf/vdf để xác nhận/từ chối)." },
                    { name: "<a:SR_TT_heart07:1409508810795778119> v love", value: "Gửi lời yêu ngọt ngào đến người bạn đã cưới (cooldown 10 phút)." },
                    { name: "<a:kt1_pinkheart:1409437166257307690> v lovepoints", value: "Xem số điểm tình yêu và MystCoin của bạn." },
                    { name: "<a:vbank:1409514900002439239> v bank", value: "Kiểm tra số dư MystCoin hoặc chuyển tiền (vbank <@user> <amount>)." },
                    { name: "<a:kt1_dmgolden:1409436496271769623> vshop1", value: "Xem cửa hàng nhẫn 1 với danh sách chi tiết, mua bằng MystCoin." },
                    { name: "<a:uk:1409436391489671261> vshop2", value: "Xem cửa hàng nhẫn 2 với danh sách chi tiết, mua bằng Owo." },
                    { name: "<:vbuy:1409517358489272472> vbuy <ring_id>", value: "Mua nhẫn với id chỉ định từ cửa hàng bằng MystCoin hoặc Owo." },
                    { name: "<a:kt1_tim5:1409437025467105404> vinv", value: "Xem kho đồ của bạn." },
                    { name: "<:uk:1409437606554501133> v help", value: "Hiển thị menu trợ giúp này." },
                    { name: "<a:uk:1409436119505833985> vowner <@user> <amount>", value: "Thêm tiền MystCoin (chỉ dành cho owner)." },
                    { name: "<a:tick:1409510831548268626> vcf", value: "Xác nhận giao dịch chuyển tiền, cầu hôn, hoặc đồng ý ly hôn." },
                    { name: "<a:vea__tickX:1409510763323723799> vdf", value: "Từ chối cầu hôn hoặc đề nghị ly hôn." },
                    { name: "<a:kt1_pinkpresslove:1409512102145556704> vmarry", value: "Xem thông tin hôn nhân của bạn, bao gồm người bạn đang cưới, nhẫn sử dụng và tổng điểm tình yêu của cả hai." },
                    { name: "🖼️ vsetphoto", value: "Đặt ảnh hôn nhân tùy chỉnh (chỉ dành cho người đã kết hôn, kèm ảnh đính kèm)." },
                    { name: "🖼️ vthumbnail", value: "Xem ảnh nhỏ và ảnh lớn của hôn nhân (chỉ dành cho người đã kết hôn)." },
                    { name: "🖼️ vsetanhnho", value: "Thay đổi ảnh nhỏ của hôn nhân (chỉ dành cho người đã kết hôn, kèm ảnh đính kèm)." },
                    { name: "🖼️ vsetanhlon", value: "Thay đổi ảnh lớn của hôn nhân (chỉ dành cho người đã kết hôn, kèm ảnh đính kèm)." }
                )
                .setFooter({ text: "Mystvale - Tình yêu vạn năm", iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            await message.channel.send({ embeds: [helpEmbed] });
        }
    },
    marry: {
        aliases: ["vmarry"],
        description: "Xem thông tin hôn nhân của bạn",
        execute: async (message) => {
            const marriage = state.marriages.get(message.author.id);
            if (!marriage) return message.reply({ embeds: [createErrorEmbed("Lêu lêu F.A, không có bạn đời bên cạnh chắc buồn lắm!")] });

            const partnerId = marriage.partnerId;
            const ringId = marriage.ringId;
            const item = getItemById(ringId, [...itemsShop1, ...itemsShop2]);
            const partner = await client.users.fetch(partnerId);
            const photoUrl = marriage.photoUrl || "https://images-ext-1.discordapp.net/external/Yq21BS_KQmsHNe1ZQ1XVT3f_bZ8DtLtjW2T36WCtN1Q/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1297913699918680074/ef3ecf5f251e7d5aba944adb2181edb6.png?format=webp&quality=lossless&width=945&height=945";
            const thumbnailUrl = marriage.thumbnailUrl || "https://images-ext-1.discordapp.net/external/Yq21BS_KQmsHNe1ZQ1XVT3f_bZ8DtLtjW2T36WCtN1Q/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1297913699918680074/ef3ecf5f251e7d5aba944adb2181edb6.png?format=webp&quality=lossless&width=945&height=945";
            const largeImageUrl = marriage.largeImageUrl || "https://images-ext-1.discordapp.net/external/Yq21BS_KQmsHNe1ZQ1XVT3f_bZ8DtLtjW2T36WCtN1Q/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1297913699918680074/ef3ecf5f251e7d5aba944adb2181edb6.png?format=webp&quality=lossless&width=945&height=945";

            const userLovePoints = state.lovePoints.get(message.author.id) || 0;
            const partnerLovePoints = state.lovePoints.get(partnerId) || 0;
            const totalLovePoints = userLovePoints + partnerLovePoints;

            const marryEmbed = new EmbedBuilder()
                .setTitle("<a:uk:1409436922048282636> Hồ Sơ Hôn Nhân")
                .setDescription(`<a:uk:1409434002057723935> **${message.author.username}**, bạn đang kết hôn với **${partner.username}**.\n\n 💍 Nhẫn sử dụng: **${item.name}** (${item.emoji})\n\n❤️ Tổng điểm tình yêu của cả hai: **${totalLovePoints}**`)
                .setColor(0xff99cc)
                .setThumbnail(thumbnailUrl)
                .setImage(largeImageUrl)
                .setTimestamp();
            const marriageDate = new Date(marriage.createdAt || Date.now()); // Giả sử createdAt là thời gian cưới, nếu không có thì dùng thời gian hiện tại
            const daysPassed = Math.floor((Date.now() - marriageDate) / (1000 * 60 * 60 * 24));
            marryEmbed.addFields({ name: "<a:SR_TT_bl01:1409433154149814273> Ngày Cưới", value: `Đã cưới từ ${marriageDate.toLocaleDateString('vi-VN')} (${daysPassed} ngày trôi qua)` });
            await message.reply({ embeds: [marryEmbed] });
        }
    },
    

    mry: {
        aliases: ["vmry"],
        description: "Cầu hôn người khác",
        execute: async (message, args) => {
            const target = message.mentions.users.first();
            if (!target) return message.reply({ embeds: [createErrorEmbed("Hãy tag người bạn muốn cầu hôn!")] });
            if (target.id === message.author.id) return message.reply({ embeds: [createErrorEmbed("Ế quá tự cưới chính minh hả ní?")] });
            if (target.bot) return message.reply({ embeds: [createErrorEmbed("Ế quá không có người yêu nên cưới con bot hả bro??")] });
            if (state.marriages.get(message.author.id)) return message.reply({ embeds: [createErrorEmbed("Bạn đã kết hôn rồi! Tính ngoại tình hay gì?")] });
            if (state.marriages.get(target.id)) return message.reply({ embeds: [createErrorEmbed("Người này đã kết hôn rồi! Đừng có đập chậu cướp hoa người ta")] });

            const ringId = args[1];
            if (!ringId) return message.reply({ embeds: [createErrorEmbed("Bạn cần chỉ định loại nhẫn (ring_id) để cầu hôn! Xem vshop1/vshop2 để biết các id.")] });
            const item = getItemById(ringId, [...itemsShop1, ...itemsShop2]);
            if (!item) return message.reply({ embeds: [createErrorEmbed("Loại nhẫn không hợp lệ!")] });

            const userInv = state.inventory.get(message.author.id);
            if (!userInv || (userInv.get(ringId) || 0) <= 0) return message.reply({ embeds: [createErrorEmbed("Bạn không có nhẫn này trong kho! Mua tại vshop1/vshop2.")] });

            state.pendingMarriages.set(target.id, { proposerId: message.author.id, ringId });

            const marryEmbed = new EmbedBuilder()
                .setTitle("<a:kt1_pinkheart:1409437166257307690> Lời Cầu Hôn Lãng Mạn")
                .setDescription(`<a:SR_TT_heart07:1409508810795778119> ${message.author} đã quỳ xuống cầu hôn ${target} với chiếc ${item.name}! Dùng \`vcf\` để chấp nhận hoặc \`vdf\` để từ chối.`)
                .setColor(0xff66cc)
                .setThumbnail("https://i.imgur.com/8W0Z3vZ.png");

            await message.channel.send({ embeds: [marryEmbed] });
        }
    },
    cf: {
        aliases: ["vcf"],
        description: "Xác nhận giao dịch, cầu hôn, hoặc ly hôn",
        execute: async (message) => {
            const userId = message.author.id;

            // Handle pending marriage
            const pendingMarriage = state.pendingMarriages.get(userId);
            if (pendingMarriage) {
                const { proposerId, ringId } = pendingMarriage;
                if (state.marriages.get(proposerId) || state.marriages.get(userId)) return message.reply({ embeds: [createErrorEmbed("Một trong hai người đã kết hôn rồi!")] });

                if (!await consumeItem(proposerId, ringId)) return message.reply({ embeds: [createErrorEmbed("Không thể tiêu thụ nhẫn! (Lỗi nội bộ)")] });

                const item = getItemById(ringId, [...itemsShop1, ...itemsShop2]);
                state.marriages.set(proposerId, { partnerId: userId, ringId, photoUrl: "https://images-ext-1.discordapp.net/external/Yq21BS_KQmsHNe1ZQ1XVT3f_bZ8DtLtjW2T36WCtN1Q/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1297913699918680074/ef3ecf5f251e7d5aba944adb2181edb6.png?format=webp&quality=lossless&width=945&height=945", thumbnailUrl: "https://images-ext-1.discordapp.net/external/Yq21BS_KQmsHNe1ZQ1XVT3f_bZ8DtLtjW2T36WCtN1Q/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1297913699918680074/ef3ecf5f251e7d5aba944adb2181edb6.png?format=webp&quality=lossless&width=945&height=945", largeImageUrl: "https://images-ext-1.discordapp.net/external/Yq21BS_KQmsHNe1ZQ1XVT3f_bZ8DtLtjW2T36WCtN1Q/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1297913699918680074/ef3ecf5f251e7d5aba944adb2181edb6.png?format=webp&quality=lossless&width=945&height=945" });
                state.marriages.set(userId, { partnerId: proposerId, ringId, photoUrl: "https://images-ext-1.discordapp.net/external/Yq21BS_KQmsHNe1ZQ1XVT3f_bZ8DtLtjW2T36WCtN1Q/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1297913699918680074/ef3ecf5f251e7d5aba944adb2181edb6.png?format=webp&quality=lossless&width=945&height=945", thumbnailUrl: "https://images-ext-1.discordapp.net/external/Yq21BS_KQmsHNe1ZQ1XVT3f_bZ8DtLtjW2T36WCtN1Q/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1297913699918680074/ef3ecf5f251e7d5aba944adb2181edb6.png?format=webp&quality=lossless&width=945&height=945", largeImageUrl: "https://images-ext-1.discordapp.net/external/Yq21BS_KQmsHNe1ZQ1XVT3f_bZ8DtLtjW2T36WCtN1Q/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1297913699918680074/ef3ecf5f251e7d5aba944adb2181edb6.png?format=webp&quality=lossless&width=945&height=945" });
                state.pendingMarriages.delete(userId);
                await saveState();

                const successEmbed = new EmbedBuilder()
                    .setTitle("<a:SR_TT_heart09:1409433326472921201> Hôn Lễ Thành Công")
                    .setDescription(`<a:kt1_pinkpresslove:1240376095514169535> Cả hai <@${proposerId}> và ${message.author} đã thành đôi với chiếc ${item.name}!`)
                    .setColor(0x00ff99)
                    .setThumbnail("https://images-ext-1.discordapp.net/external/Yq21BS_KQmsHNe1ZQ1XVT3f_bZ8DtLtjW2T36WCtN1Q/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1297913699918680074/ef3ecf5f251e7d5aba944adb2181edb6.png?format=webp&quality=lossless&width=945&height=945")
                    .setTimestamp();

                await message.channel.send({ embeds: [successEmbed] });
                return;
            }

            // Handle pending divorce
            const pendingDivorce = state.pendingDivorces.get(userId);
            if (pendingDivorce) {
                const { initiatorId } = pendingDivorce;
                if (!state.marriages.get(initiatorId) || !state.marriages.get(userId) || state.marriages.get(initiatorId).partnerId !== userId) {
                    state.pendingDivorces.delete(userId);
                    return message.reply({ embeds: [createErrorEmbed("Không có cuộc hôn nhân nào để ly hôn!")] });
                }

                state.marriages.delete(initiatorId);
                state.marriages.delete(userId);
                state.pendingDivorces.delete(userId);
                await saveState();

                const divorceEmbed = new EmbedBuilder()
                    .setTitle("<a:sf_greenheartbroken:1409508628074856478> Ly Hôn Thành Công")
                    .setDescription(`<a:sf_greenheartbroken:1409508628074856478> <@${initiatorId}> và ${message.author} đã chính thức ly hôn.`)
                    .setColor(0xff0000)
                    .setTimestamp();

                await message.channel.send({ embeds: [divorceEmbed] });
                return;
            }

            // Handle pending transfer
            const pendingTransfer = state.pendingTransfers.get(userId);
            if (pendingTransfer) {
                const { targetId, amount } = pendingTransfer;
                const senderCoins = state.coins.get(userId) || 0;
                if (senderCoins < amount) return message.reply({ embeds: [createErrorEmbed("Số dư không đủ để hoàn tất giao dịch!")] });

                state.coins.set(userId, senderCoins - amount);
                const receiverCoins = state.coins.get(targetId) || 0;
                state.coins.set(targetId, receiverCoins + amount);
                state.pendingTransfers.delete(userId);
                await saveState();

                const successEmbed = new EmbedBuilder()
                    .setTitle("<a:xanh:1409433411570892812> Giao Dịch Thành Công")
                    .setDescription(`<a:xanh:1409433411570892812> Đã chuyển tiền thành công! **${message.author.username}** đã gửi **${amount}<:mc_coin:1408468125984227360> ** đến **<@${targetId}>**.`)
                    .setColor(0x00ff99)
                    .setTimestamp();

                await message.channel.send({ embeds: [successEmbed] });
                return;
            }

            return message.reply({ embeds: [createErrorEmbed("Bạn không có giao dịch, lời cầu hôn, hoặc đề nghị ly hôn đang chờ xác nhận!")] });
        }
    },
    df: {
        aliases: ["vdf"],
        description: "Từ chối lời cầu hôn hoặc đề nghị ly hôn",
        execute: async (message) => {
            const userId = message.author.id;

            // Handle pending marriage
            const pendingMarriage = state.pendingMarriages.get(userId);
            if (pendingMarriage) {
                const { proposerId } = pendingMarriage;
                state.pendingMarriages.delete(userId);

                const declineEmbed = new EmbedBuilder()
                    .setTitle("<a:sf_greenheartbroken:1409508628074856478> Lời Từ Chối")
                    .setDescription(`${message.author} đã từ chối lời cầu hôn của <@${proposerId}>.`)
                    .setColor(0xff0000)
                    .setTimestamp();

                await message.channel.send({ embeds: [declineEmbed] });
                return;
            }

            // Handle pending divorce
            const pendingDivorce = state.pendingDivorces.get(userId);
            if (pendingDivorce) {
                const { initiatorId } = pendingDivorce;
                state.pendingDivorces.delete(userId);

                const declineEmbed = new EmbedBuilder()
                    .setTitle("<a:vea__tickX:1409510763323723799> Hủy Đề Nghị Ly Hôn")
                    .setDescription(`${message.author} đã từ chối đề nghị ly hôn từ <@${initiatorId}>.`)
                    .setColor(0xffff00)
                    .setTimestamp();

                await message.channel.send({ embeds: [declineEmbed] });
                return;
            }

            return message.reply({ embeds: [createErrorEmbed("Bạn không có lời cầu hôn hoặc đề nghị ly hôn đang chờ!")] });
        }
    },
    dc: {
        aliases: ["vdc"],
        description: "Ly hôn với người bạn đã kết hôn",
        execute: async (message) => {
            const marriage = state.marriages.get(message.author.id);
            if (!marriage) return message.reply({ embeds: [createErrorEmbed("Lêu lêu F.A, không có bạn đời bên cạnh chắc buồn lắm!")] });

            const partnerId = marriage.partnerId;
            state.pendingDivorces.set(partnerId, { initiatorId: message.author.id });

            const divorceEmbed = new EmbedBuilder()
                .setTitle("<a:sf_greenheartbroken:1409508628074856478> Đề Nghị Ly Hôn")
                .setDescription(`<a:sf_greenheartbroken:1409508628074856478> ${message.author} muốn ly hôn với <@${partnerId}>. Dùng \`vcf\` để đồng ý hoặc \`vdf\` để từ chối.`)
                .setColor(0xff0000)
                .setThumbnail("https://images-ext-1.discordapp.net/external/Yq21BS_KQmsHNe1ZQ1XVT3f_bZ8DtLtjW2T36WCtN1Q/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1297913699918680074/ef3ecf5f251e7d5aba944adb2181edb6.png?format=webp&quality=lossless&width=945&height=945")
                .setTimestamp();

            await message.channel.send({ content: `<@${partnerId}>`, embeds: [divorceEmbed] });
        }
    },
    love: {
        description: "Gửi lời yêu ngọt ngào",
        execute: async (message) => {
            const marriage = state.marriages.get(message.author.id);
            if (!marriage) return message.reply({ embeds: [createErrorEmbed("Lêu lêu F.A, không có bạn đời bên cạnh chắc buồn lắm!")] });

            const partnerId = marriage.partnerId;
            const now = Date.now();
            if (state.loveCooldown.has(message.author.id) && now - state.loveCooldown.get(message.author.id) < LOVE_COOLDOWN) {
                const remaining = Math.ceil((LOVE_COOLDOWN - (now - state.loveCooldown.get(message.author.id))) / 60000);
                return message.reply({ embeds: [createErrorEmbed(`⏳ Bạn phải chờ thêm ${remaining} phút nữa để nói lời yêu!`)] });
            }

            state.loveCooldown.set(message.author.id, now);
            const bonus = ringBonuses[marriage.ringId] || 0;
            const amount = 1 + bonus;
            const points = await addLovePoint(message.author.id, amount);
            const partner = await client.users.fetch(partnerId);

            const loveEmbed = new EmbedBuilder()
                .setTitle("<a:ppt_tim:1409509854636408946> Khoảnh Khắc Yêu Thương")
                .setDescription(`<a:uk:1409436922048282636> ${message.author} đã ${getRandomLoveMessage()} ${partner}! (+${amount} điểm, tổng: ${points})`)
                .setColor(0xff99cc)
                .setFooter({ text: "Tình yêu là ngọn lửa không bao giờ tắt!" })
                .setTimestamp();

            await message.channel.send({ embeds: [loveEmbed] });
        }
    },
    lovepoints: {
        description: "Xem điểm tình yêu và MystCoin",
        execute: async (message) => {
            const points = state.lovePoints.get(message.author.id) || 0;
            const userCoins = state.coins.get(message.author.id) || 0;
            const userOwo = state.owo.get(message.author.id) || 0;

            const pointsEmbed = new EmbedBuilder()
                .setTitle("<a:uk:1409437309035876392> Hồ Sơ Tình Yêu") 
                .setDescription(`<a:vmry:1409518953453060106> **${message.author.username}**, bạn hiện có:\n**${points} điểm tình yêu**\n**${userCoins} <:mc_coin:1408468125984227360> **\n**${userOwo} Owo**`)
                .setColor(0x66ff99)                
                .setThumbnail(message.author.displayAvatarURL())
                .setTimestamp();

            await message.reply({ embeds: [pointsEmbed] });
        }
    },
    bank: {
        description: "Kiểm tra số dư MystCoin hoặc khởi tạo chuyển tiền",
        execute: async (message, args) => {
            const userCoins = state.coins.get(message.author.id) || 0;

            if (args.length === 0) {
                // Hiển thị số dư nếu không có tham số
                const bankEmbed = new EmbedBuilder()
                    .setTitle("<a:vbank:1409514900002439239> Ngân Hàng Mystvale")
                    .setDescription(`<:vbuy:1409517358489272472> **${message.author.username}**, bạn hiện có **${userCoins} <:mc_coin:1408468125984227360>**.`)
                    .setColor(0xFFD700)
                    .setTimestamp();

                await message.reply({ embeds: [bankEmbed] });
                return;
            }

            const target = message.mentions.users.first();
            if (!target) return message.reply({ embeds: [createErrorEmbed("Hãy tag người bạn muốn chuyển tiền!")] });
            if (target.id === message.author.id) return message.reply({ embeds: [createErrorEmbed("Bạn không thể chuyển tiền cho chính mình!")] });
            if (target.bot) return message.reply({ embeds: [createErrorEmbed("Bạn không thể chuyển tiền cho bot!")] });

            const amount = parseInt(args[1]);
            if (isNaN(amount) || amount <= 0) return message.reply({ embeds: [createErrorEmbed("Vui lòng nhập một số tiền hợp lệ!")] });
            if (userCoins < amount) return message.reply({ embeds: [createErrorEmbed("Số dư không đủ để thực hiện giao dịch!")] });

            state.pendingTransfers.set(message.author.id, { targetId: target.id, amount });

            const transferEmbed = new EmbedBuilder()
                .setTitle("<:vbuy:1409517358489272472> Yêu Cầu Chuyển Tiền")
                .setDescription(`**${message.author.username}** muốn chuyển **${amount} <:mc_coin:1408468125984227360>** đến **${target.username}**. Dùng \`vcf\` để xác nhận.`)
                .setColor(0xFFD700)
                .setTimestamp();

            await message.channel.send({ embeds: [transferEmbed] });
        }
    },
    shop1: {
        aliases: ["vshop1"],
        description: "Xem cửa hàng nhẫn 1",
        execute: async (message) => {
            const shopEmbed = new EmbedBuilder()
                .setTitle("🛒 Mystvale Shop Rings 1!")
                .setColor(0x00ffcc)
                .setDescription("Chào mừng bạn đến với cửa hàng nhẫn 1 của Mystvale! Dùng `vbuy <ring_id>` để mua.\n\n")
                .setThumbnail(client.user.displayAvatarURL())
                .setFooter({ text: `Page 1/1 - ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` })
                .setTimestamp();

            let itemList = '';
            itemsShop1.forEach((item, index) => {
                itemList += `${(index + 1).toString().padStart(2, '0')}. ${item.emoji} ${item.name}\n• Giá: ${item.price} ${item.currency}\n\n`;
            });
            shopEmbed.setDescription(shopEmbed.data.description + itemList);

            await message.channel.send({ embeds: [shopEmbed] });
        }
    },
    shop2: {
        aliases: ["vshop2"],
        description: "Xem cửa hàng nhẫn 2",
        execute: async (message) => {
            const shopEmbed = new EmbedBuilder()
                .setTitle("🛒 Mystvale Shop Rings 2!")
                .setColor(0x00ffcc)
                .setDescription("Chào mừng bạn đến với cửa hàng nhẫn 2 của Mystvale! Dùng `vbuy <ring_id>` để mua.\n\n")
                .setThumbnail(client.user.displayAvatarURL())
                .setFooter({ text: `Page 1/1 - ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` })
                .setTimestamp();

            let itemList = '';
            itemsShop2.forEach((item, index) => {
                itemList += `${(index + 1).toString().padStart(2, '0')}. ${item.emoji} ${item.name}\n• Giá: ${item.price} ${item.currency}\n\n`;
            });
            shopEmbed.setDescription(shopEmbed.data.description + itemList);

            await message.channel.send({ embeds: [shopEmbed] });
        }
    },
    buy: {
        aliases: ["vbuy"],
        description: "Mua nhẫn từ cửa hàng",
        execute: async (message, args) => {
            const ringId = args[0];
            if (!ringId) return message.reply({ embeds: [createErrorEmbed("Hãy chỉ định ring_id để mua! Xem vshop1/vshop2.")] });

            let item = getItemById(ringId, itemsShop1);
            if (!item) item = getItemById(ringId, itemsShop2);
            if (!item) return message.reply({ embeds: [createErrorEmbed("Loại nhẫn không hợp lệ!")] });

            const userId = message.author.id;
            let userBalance = 0;
            if (item.currency === '<:mc_coin:1408468125984227360> (20K VNĐ)') {
                userBalance = state.coins.get(userId) || 0;
                if (userBalance < item.price) return message.reply({ embeds: [createErrorEmbed(`Bạn không đủ ${item.currency}! Cần ${item.price} ${item.currency}.`)] });
                state.coins.set(userId, userBalance - item.price);
            } else if (item.currency === 'OwO (3M <a:kt1_tienowo:1409437568122228787>)') {
                userBalance = state.owo.get(userId) || 0;
                if (userBalance < item.price) return message.reply({ embeds: [createErrorEmbed(`Bạn không đủ ${item.currency}! Cần ${item.price} ${item.currency}.`)] });
                state.owo.set(userId, userBalance - item.price);
            }

            let userInv = state.inventory.get(userId) || new Map();
            const count = userInv.get(ringId) || 0;
            userInv.set(ringId, count + 1);
            state.inventory.set(userId, userInv);
            await saveState(); // Lưu sau khi mua

            const buyEmbed = new EmbedBuilder()
                .setTitle("<a:xanh:1409433411570892812> Mua Hàng Thành Công")
                .setDescription(`Bạn đã mua **${item.name}** với giá ${item.price} ${item.currency}.`)
                .setColor(0x00ff99)
                .setTimestamp();

            await message.reply({ embeds: [buyEmbed] });
        }
    },
    inv: {
        aliases: ["vinv"],
        description: "Xem kho đồ",
        execute: async (message) => {
            const userId = message.author.id;
            const userInv = state.inventory.get(userId);
            if (!userInv || userInv.size === 0) return message.reply({ embeds: [createErrorEmbed("Bạn chưa có món đồ nào trong kho!")] });

            const invEmbed = new EmbedBuilder()
                .setTitle("<a:ppt_hopqua1:1409508383119114270> Kho Đồ Của Bạn")
                .setColor(0xffcc00)
                .setThumbnail(message.author.displayAvatarURL())
                .setTimestamp();

            userInv.forEach((count, itemId) => {
                const item = getItemById(itemId, [...itemsShop1, ...itemsShop2]);
                if (item) {
                    invEmbed.addFields({ name: `${item.name} (${itemId})`, value: `Số lượng: ${count}`, inline: true });
                }
            });

            await message.reply({ embeds: [invEmbed] });
        }
    },
    owner: {
        aliases: ["vowner"],
        description: "Thêm tiền MystCoin cho người dùng (chỉ dành cho owner)",
        execute: async (message, args) => {
            if (message.author.id !== ownerId) {
                return message.reply({ embeds: [createErrorEmbed("Bạn không có quyền sử dụng lệnh này!")] });
            }

            const target = message.mentions.users.first();
            if (!target) return message.reply({ embeds: [createErrorEmbed("Hãy tag người bạn muốn thêm tiền!")] });

            const amount = parseInt(args[1]);
            if (isNaN(amount) || amount <= 0) return message.reply({ embeds: [createErrorEmbed("Vui lòng nhập một số tiền hợp lệ!")] });

            const targetId = target.id;
            const currentCoins = state.coins.get(targetId) || 0;
            state.coins.set(targetId, currentCoins + amount);
            await saveState(); // Lưu sau khi thêm tiền

            const ownerEmbed = new EmbedBuilder()
                .setTitle("<a:vbank:1409514900002439239> Cập Nhật Tiền Thành Công")
                .setDescription(`Đã thêm **${amount} <:mc_coin:1408468125984227360> ** vào tài khoản của ${target}. Tổng: **${(currentCoins + amount)} <:mc_coin:1408468125984227360>**.`)
                .setColor(0xFFD700)
                .setTimestamp();

            await message.channel.send({ embeds: [ownerEmbed] });
        }
    },
    setphoto: {
        aliases: ["vsetphoto"],
        description: "Đặt ảnh hôn nhân tùy chỉnh",
        execute: async (message) => {
            const marriage = state.marriages.get(message.author.id);
            if (!marriage) return message.reply({ embeds: [createErrorEmbed("Lêu lêu F.A, không có bạn đời bên cạnh chắc buồn lắm!")] });

            if (!message.attachments.size) return message.reply({ embeds: [createErrorEmbed("Vui lòng đính kèm một ảnh để đặt làm ảnh hôn nhân!")] });

            const attachment = message.attachments.first();
            const photoUrl = attachment.url;

            marriage.photoUrl = photoUrl;
            state.marriages.set(message.author.id, marriage);
            state.marriages.set(marriage.partnerId, { ...state.marriages.get(marriage.partnerId), photoUrl });
            await saveState();

            const successEmbed = new EmbedBuilder()
                .setTitle("<a:xanh:1409433411570892812> Đặt Ảnh Hôn Nhân Thành Công")
                .setDescription(`Đã cập nhật ảnh hôn nhân của bạn và ${await client.users.fetch(marriage.partnerId)}!`)
                .setColor(0x00ff99)
                .setThumbnail(photoUrl)
                .setTimestamp();

            await message.reply({ embeds: [successEmbed] });
        }
    },
    thumbnail: {
        aliases: ["vthumbnail"],
        description: "Xem ảnh nhỏ và ảnh lớn của hôn nhân",
        execute: async (message) => {
            const marriage = state.marriages.get(message.author.id);
            if (!marriage) return message.reply({ embeds: [createErrorEmbed("Lêu lêu F.A, không có bạn đời bên cạnh chắc buồn lắm!")] });

            const thumbnailUrl = marriage.thumbnailUrl || "https://images-ext-1.discordapp.net/external/Yq21BS_KQmsHNe1ZQ1XVT3f_bZ8DtLtjW2T36WCtN1Q/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1297913699918680074/ef3ecf5f251e7d5aba944adb2181edb6.png?format=webp&quality=lossless&width=945&height=945";
            const largeImageUrl = marriage.largeImageUrl || "https://images-ext-1.discordapp.net/external/Yq21BS_KQmsHNe1ZQ1XVT3f_bZ8DtLtjW2T36WCtN1Q/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1297913699918680074/ef3ecf5f251e7d5aba944adb2181edb6.png?format=webp&quality=lossless&width=945&height=945";

            const thumbnailEmbed = new EmbedBuilder()
                .setTitle("📸 Ảnh Hôn Nhân")
                .setDescription(`<a:uk:1409437427369513040> Xem ảnh nhỏ và ảnh lớn của bạn và ${await client.users.fetch(marriage.partnerId)}!`)
                .setColor(0xff99cc)
                .setThumbnail(thumbnailUrl)
                .setImage(largeImageUrl)
                .setTimestamp();

            await message.reply({ embeds: [thumbnailEmbed] });
        }
    },
    setanhnho: {
        aliases: ["vsetanhnho"],
        description: "Thay đổi ảnh nhỏ của hôn nhân",
        execute: async (message) => {
            const marriage = state.marriages.get(message.author.id);
            if (!marriage) return message.reply({ embeds: [createErrorEmbed("Lêu lêu F.A, không có bạn đời bên cạnh chắc buồn lắm!")] });

            if (!message.attachments.size) return message.reply({ embeds: [createErrorEmbed("Vui lòng đính kèm một ảnh để đặt làm ảnh nhỏ!")] });

            const attachment = message.attachments.first();
            const thumbnailUrl = attachment.url;

            marriage.thumbnailUrl = thumbnailUrl;
            state.marriages.set(message.author.id, marriage);
            state.marriages.set(marriage.partnerId, { ...state.marriages.get(marriage.partnerId), thumbnailUrl });
            await saveState();

            const successEmbed = new EmbedBuilder()
                .setTitle("<a:kt1_canhxanh:1409436068469542944> Đặt Ảnh Nhỏ Thành Công")
                .setDescription(`Đã cập nhật ảnh nhỏ của bạn và ${await client.users.fetch(marriage.partnerId)}!`)
                .setColor(0x00ff99)
                .setThumbnail(thumbnailUrl)
                .setTimestamp();

            await message.reply({ embeds: [successEmbed] });
        }
    },
    setanhlon: {
        aliases: ["vsetanhlon"],
        description: "Thay đổi ảnh lớn của hôn nhân",
        execute: async (message) => {
            const marriage = state.marriages.get(message.author.id);
            if (!marriage) return message.reply({ embeds: [createErrorEmbed("Lêu lêu F.A, không có bạn đời bên cạnh chắc buồn lắm!")] });

            if (!message.attachments.size) return message.reply({ embeds: [createErrorEmbed("Vui lòng đính kèm một ảnh để đặt làm ảnh lớn!")] });

            const attachment = message.attachments.first();
            const largeImageUrl = attachment.url;

            marriage.largeImageUrl = largeImageUrl;
            state.marriages.set(message.author.id, marriage);
            state.marriages.set(marriage.partnerId, { ...state.marriages.get(marriage.partnerId), largeImageUrl });
            await saveState();

            const successEmbed = new EmbedBuilder()
                .setTitle("<a:xanh:1409433411570892812> Đặt Ảnh Lớn Thành Công")
                .setDescription(`Đã cập nhật ảnh lớn của bạn và ${await client.users.fetch(marriage.partnerId)}!`)
                .setColor(0x00ff99)
                .setImage(largeImageUrl)
                .setTimestamp();

            await message.reply({ embeds: [successEmbed] });
        }
    }
};



// Error Embed Helper
const createErrorEmbed = (message) => {
    return new EmbedBuilder()
        .setTitle("<a:vea__tickX:1409510763323723799> Lỗi")
        .setDescription(message)
        .setColor(0xff0000)
        .setTimestamp();
};

// Message Handler
client.on("messageCreate", async (message) => {
    if (message.author.bot || !message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    let commandKey = Object.keys(commands).find(key => key === commandName || commands[key].aliases?.includes(commandName));
    if (commandKey) {
        const command = commands[commandKey];
        try {
            await command.execute(message, args);
        } catch (error) {
            console.error(`Error executing command ${commandName}:`, error);
            await message.reply({ embeds: [createErrorEmbed("Đã có lỗi xảy ra khi thực thi lệnh!")] });
        }
    }
});



// Interaction Handler
client.on("interactionCreate", async (interaction) => {
    console.log("Interaction received:", interaction.customId); // Debug log
    if (!interaction.isButton()) return;

    const [action, ...params] = interaction.customId.split("_");

    try {
        if (action === "accept_marry") {
            const [proposerId, targetId, ringId] = params;
            console.log("Accept marry check:", { proposerId, targetId, interactionUser: interaction.user.id });
            if (interaction.user.id !== targetId) {
                await interaction.reply({ content: "Chỉ người được cầu hôn mới có thể chấp nhận!", ephemeral: true });
                return;
            }
            if (state.marriages.get(proposerId) || state.marriages.get(targetId)) {
                await interaction.reply({ content: "Một trong hai người đã kết hôn rồi!", ephemeral: true });
                return;
            }

            if (!await consumeItem(proposerId, ringId)) {
                await interaction.reply({ content: "Không thể tiêu thụ nhẫn! (Lỗi nội bộ)", ephemeral: true });
                return;
            }

            const item = getItemById(ringId, [...itemsShop1, ...itemsShop2]);
            state.marriages.set(proposerId, { partnerId: targetId, ringId, photoUrl: "https://images-ext-1.discordapp.net/external/Yq21BS_KQmsHNe1ZQ1XVT3f_bZ8DtLtjW2T36WCtN1Q/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1297913699918680074/ef3ecf5f251e7d5aba944adb2181edb6.png?format=webp&quality=lossless&width=945&height=945", thumbnailUrl: "https://images-ext-1.discordapp.net/external/Yq21BS_KQmsHNe1ZQ1XVT3f_bZ8DtLtjW2T36WCtN1Q/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1297913699918680074/ef3ecf5f251e7d5aba944adb2181edb6.png?format=webp&quality=lossless&width=945&height=945", largeImageUrl: "https://images-ext-1.discordapp.net/external/Yq21BS_KQmsHNe1ZQ1XVT3f_bZ8DtLtjW2T36WCtN1Q/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1297913699918680074/ef3ecf5f251e7d5aba944adb2181edb6.png?format=webp&quality=lossless&width=945&height=945" });
            state.marriages.set(targetId, { partnerId: proposerId, ringId, photoUrl: "https://images-ext-1.discordapp.net/external/Yq21BS_KQmsHNe1ZQ1XVT3f_bZ8DtLtjW2T36WCtN1Q/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1297913699918680074/ef3ecf5f251e7d5aba944adb2181edb6.png?format=webp&quality=lossless&width=945&height=945", thumbnailUrl: "https://images-ext-1.discordapp.net/external/Yq21BS_KQmsHNe1ZQ1XVT3f_bZ8DtLtjW2T36WCtN1Q/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1297913699918680074/ef3ecf5f251e7d5aba944adb2181edb6.png?format=webp&quality=lossless&width=945&height=945", largeImageUrl: "https://images-ext-1.discordapp.net/external/Yq21BS_KQmsHNe1ZQ1XVT3f_bZ8DtLtjW2T36WCtN1Q/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1297913699918680074/ef3ecf5f251e7d5aba944adb2181edb6.png?format=webp&quality=lossless&width=945&height=945" });
            await saveState();

            const successEmbed = new EmbedBuilder()
                .setTitle("<a:kt1_pinkheart:1409437166257307690> Hôn Lễ Thành Công")
                .setDescription(`<a:kt1_tim5:1409437025467105404> Cả hai <@${proposerId}> và ${interaction.user} đã thành đôi với chiếc ${item.name}!`)
                .setColor(0x00ff99)
                .setThumbnail("https://images-ext-1.discordapp.net/external/Yq21BS_KQmsHNe1ZQ1XVT3f_bZ8DtLtjW2T36WCtN1Q/%3Fsize%3D1024/https/cdn.discordapp.com/avatars/1297913699918680074/ef3ecf5f251e7d5aba944adb2181edb6.png?format=webp&quality=lossless&width=945&height=945")
                .setTimestamp();

            await interaction.deferUpdate();
            await interaction.message.edit({ embeds: [successEmbed], components: [] });
            await interaction.channel.send({ content: `<a:kt1_dmgolden:1409436496271769623> Cả hai <@${proposerId}> và <@${targetId}> đã thành đôi! Chúc mừng!` });
        } else if (action === "decline_marry") {
            const [proposerId, targetId] = params;
            console.log("Decline marry check:", { proposerId, targetId, interactionUser: interaction.user.id });
            if (interaction.user.id !== targetId) {
                await interaction.reply({ content: "Chỉ người được cầu hôn mới có thể từ chối!", ephemeral: true });
                return;
            }
            const declineEmbed = new EmbedBuilder()
                .setTitle("<a:sf_greenheartbroken:1409508628074856478> Lời Từ Chối")
                .setDescription(`${interaction.user} đã từ chối lời cầu hôn của <@${proposerId}>.`)
                .setColor(0xff0000)
                .setTimestamp();

            await interaction.deferUpdate();
            await interaction.message.edit({ embeds: [declineEmbed], components: [] });
        } else if (action === "confirm_transfer") {
            const [transactionId, amount] = params;
            const [senderId, receiverId] = transactionId.split("_").slice(0, 2);
            console.log("Confirm transfer check:", { senderId, receiverId, interactionUser: interaction.user.id });
            if (interaction.user.id !== senderId) {
                await interaction.reply({ content: "Chỉ người gửi mới có thể xác nhận giao dịch!", ephemeral: true });
                return;
            }

            const senderCoins = state.coins.get(senderId) || 0;
            if (senderCoins < parseInt(amount)) {
                await interaction.reply({ content: "Số dư không đủ để hoàn tất giao dịch!", ephemeral: true });
                return;
            }

            state.coins.set(senderId, senderCoins - parseInt(amount));
            const receiverCoins = state.coins.get(receiverId) || 0;
            state.coins.set(receiverId, receiverCoins + parseInt(amount));
            await saveState();

            const successEmbed = new EmbedBuilder()
                .setTitle("<a:xanh:1409433411570892812> Giao Dịch Thành Công")
                .setDescription(`<a:xanh:1409433411570892812> Đã chuyển tiền thành công! **${client.users.cache.get(senderId).username}** đã gửi **${amount} <:mc_coin:1408468125984227360>** đến **${client.users.cache.get(receiverId).username}**.`)
                .setColor(0x00ff99)
                .setTimestamp();

            await interaction.deferUpdate();
            await interaction.message.edit({ embeds: [successEmbed], components: [] });
            await interaction.channel.send({ content: `<a:xanh:1409433411570892812> Giao dịch thành công! <@${senderId}> đã chuyển **${amount} <:mc_coin:1408468125984227360> ** cho <@${receiverId}>.` });
        }
    } catch (error) {
        console.error("Interaction error:", error);
        await interaction.reply({ content: "Đã xảy ra lỗi khi xử lý tương tác! Kiểm tra log console.", ephemeral: true });
    }
});

// Client Ready
client.once("ready", () => {
    console.log(`✅ ${client.user.tag} đã sẵn sàng!`);
    client.user.setActivity('Mystvale', { type: ActivityType.Playing });
});

// Lưu dữ liệu khi bot tắt
process.on("beforeExit", async () => {
    await saveState();
});

// Code by Benjamin Lewis
client.login(process.env.TOKEN);

// Express Server
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("Mystvale Bot is running smoothly!");
});

app.listen(PORT, () => {
    console.log(`🌐 Web server running on port ${PORT}`);
});
