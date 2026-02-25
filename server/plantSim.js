const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const NUM_CSV_FILES = 3;
// Map of simulation ID (1,2,3) to array of tick objects
const simulationDataMap = {};

// Current tick cursor per simulation ID
const currentIndexMap = {};

// Load CSVs into memory
function loadCsvs(callback) {
    let loadedCount = 0;

    for (let i = 1; i <= NUM_CSV_FILES; i++) {
        const filePath = path.join(__dirname, `plant_sim_${i}.csv`);
        simulationDataMap[i] = [];
        currentIndexMap[i] = 0;

        if (fs.existsSync(filePath)) {
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (data) => {
                    simulationDataMap[i].push({
                        tick: parseInt(data.tick, 10),
                        moisture: parseFloat(data.moisture),
                        sunlight: parseFloat(data.sunlight),
                        temperature: parseFloat(data.temperature),
                        soil_health: parseFloat(data.soil_health),
                        event_marker: data.event_marker
                    });
                })
                .on('end', () => {
                    console.log(`Loaded ${simulationDataMap[i].length} rows from CSV ${i}.`);
                    loadedCount++;
                    if (loadedCount === NUM_CSV_FILES && callback) {
                        callback();
                    }
                });
        } else {
            console.warn(`File ${filePath} not found. Skipped.`);
            loadedCount++;
            if (loadedCount === NUM_CSV_FILES && callback) callback();
        }
    }
}

// Map a user ID to a persistent simulation index (1 to NUM_CSV_FILES)
function assignSimulationId(userId) {
    // Simple deterministic hash based on userId string
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const id = (Math.abs(hash) % NUM_CSV_FILES) + 1;
    return id;
}

// Get the current row for a specific simulation stream
function getCurrentTick(simId) {
    const dataArray = simulationDataMap[simId];
    if (!dataArray || dataArray.length === 0) return null;

    const idx = currentIndexMap[simId];
    return dataArray[idx];
}

// Advance all global simulation cursors (called once per server tick interval)
function advanceAllCursors() {
    for (let i = 1; i <= NUM_CSV_FILES; i++) {
        const dataArray = simulationDataMap[i];
        if (dataArray && dataArray.length > 0) {
            currentIndexMap[i]++;
            if (currentIndexMap[i] >= dataArray.length) {
                currentIndexMap[i] = 0; // loop
            }
        }
    }
}

// Derive mood state
function deriveMood(metrics) {
    const { moisture, sunlight, soil_health, temperature } = metrics;
    const avg = (moisture + sunlight + soil_health) / 3;
    const hasCritical = moisture < 20 || sunlight < 10 || temperature > 32 || temperature < 16;

    if (hasCritical) return 'critical';
    if (avg >= 70) return 'thriving';
    if (avg >= 45) return 'stable';
    return 'struggling';
}

module.exports = {
    loadCsvs,
    assignSimulationId,
    getCurrentTick,
    advanceAllCursors,
    deriveMood
};
