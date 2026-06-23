const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const ACCOUNTS_PATH = path.join(DATA_DIR, 'accounts.json');

function ensureStore() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(ACCOUNTS_PATH)) {
        fs.writeFileSync(ACCOUNTS_PATH, JSON.stringify({ accounts: {} }, null, 2));
    }
}

function readStore() {
    ensureStore();
    try {
        return JSON.parse(fs.readFileSync(ACCOUNTS_PATH, 'utf8'));
    } catch (error) {
        console.error('Could not read accounts store:', error.message);
        return { accounts: {} };
    }
}

function writeStore(store) {
    ensureStore();
    fs.writeFileSync(ACCOUNTS_PATH, JSON.stringify(store, null, 2));
}

function normalizeUsername(username) {
    return String(username || '').trim().toLowerCase();
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(String(password || '')).digest('hex');
}

function makeUserId(username) {
    return `acct_${crypto.createHash('sha1').update(username).digest('hex').slice(0, 12)}`;
}

function publicAccount(account) {
    if (!account) return null;

    return {
        username: account.username,
        userId: account.userId,
        name: account.name || account.username,
        plantProfile: account.plantProfile || null
    };
}

function toRuntimeUser(account) {
    if (!account?.plantProfile) return null;

    return {
        userId: account.userId,
        username: account.username,
        name: account.name || account.username,
        ...account.plantProfile
    };
}

function register(username, password) {
    const normalized = normalizeUsername(username);
    if (!normalized || !password) {
        return { error: 'Username and password are required.' };
    }

    const store = readStore();
    if (store.accounts[normalized]) {
        return { error: 'That access name is already provisioned.' };
    }

    const account = {
        username: normalized,
        passwordHash: hashPassword(password),
        userId: makeUserId(normalized),
        name: normalized,
        plantProfile: null,
        createdAt: new Date().toISOString()
    };

    store.accounts[normalized] = account;
    writeStore(store);

    return { account: publicAccount(account), user: null, needsPlantSetup: true };
}

function login(username, password) {
    const normalized = normalizeUsername(username);
    const store = readStore();
    const account = store.accounts[normalized];

    if (!account || account.passwordHash !== hashPassword(password)) {
        return { error: 'Access name or password is incorrect.' };
    }

    return {
        account: publicAccount(account),
        user: toRuntimeUser(account),
        needsPlantSetup: !account.plantProfile
    };
}

function getSession(username) {
    const normalized = normalizeUsername(username);
    const store = readStore();
    const account = store.accounts[normalized];

    if (!account) {
        return { error: 'Session not found.' };
    }

    return {
        account: publicAccount(account),
        user: toRuntimeUser(account),
        needsPlantSetup: !account.plantProfile
    };
}

function savePlant(username, plantProfile) {
    const normalized = normalizeUsername(username);
    const store = readStore();
    const account = store.accounts[normalized];

    if (!account) {
        return { error: 'Account not found.' };
    }

    const ownerName = String(plantProfile.ownerName || account.username).trim();
    const savedProfile = {
        name: ownerName || account.username,
        persona: String(plantProfile.persona || '').trim(),
        plantType: String(plantProfile.plantType || '').trim(),
        deviceName: String(plantProfile.deviceName || plantProfile.persona || 'Companion').trim(),
        emoji: plantProfile.emoji || '',
        imgUrl: plantProfile.imgUrl || ''
    };

    if (!savedProfile.persona || !savedProfile.plantType) {
        return { error: 'Choose a plant companion before continuing.' };
    }

    account.name = savedProfile.name;
    account.plantProfile = savedProfile;
    account.updatedAt = new Date().toISOString();
    writeStore(store);

    return {
        account: publicAccount(account),
        user: toRuntimeUser(account),
        needsPlantSetup: false
    };
}

module.exports = {
    getSession,
    login,
    register,
    savePlant
};
