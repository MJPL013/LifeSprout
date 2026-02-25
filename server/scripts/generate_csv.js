const fs = require('fs');
const path = require('path');

const NUM_TICKS = 600;

function generateCsvForPlant(plantId, seedOffset) {
    const filePath = path.join(__dirname, `../plant_sim_${plantId}.csv`);
    let moisture = 80 + (seedOffset % 10);
    let sunlight = 40 + (seedOffset % 20);
    let temperature = 22 + (seedOffset % 4);

    const data = ['tick,moisture,sunlight,temperature,soil_health,event_marker'];

    for (let tick = 0; tick < NUM_TICKS; tick++) {
        let event_marker = 'none';

        // 1. Sunlight cycle (simulating a day curve)
        const progress = tick / NUM_TICKS;
        sunlight = 20 + Math.sin(progress * Math.PI) * 70;
        sunlight += (Math.random() * 6 - 3) + (seedOffset % 5); // noise + offset

        // 2. Temperature curve (follows sunlight loosely)
        temperature = 18 + Math.sin(progress * Math.PI) * 12;
        temperature += (Math.random() * 2 - 1) + (seedOffset % 2);

        // 3. Moisture gradually decreases, different rate per plant
        moisture -= (0.10 + (seedOffset % 5) * 0.02) + (Math.random() * 0.1);

        // Plant-specific script events
        if (plantId === 1 && tick === 100) { moisture -= 25; event_marker = 'moisture_drop_rapid'; }
        if (plantId === 2 && tick === 150) { temperature += 10; event_marker = 'heat_spike'; }
        if (plantId === 3 && tick === 200) { sunlight -= 40; event_marker = 'cloud_cover'; }

        // Universal water event
        if (tick === 300) { moisture = 95; event_marker = 'watered'; }

        // Clamping values
        moisture = Math.max(0, Math.min(100, moisture));
        sunlight = Math.max(0, Math.min(100, sunlight));
        temperature = Math.max(15, Math.min(35, temperature));

        // Calculate soil health
        let soil_health = (moisture * 0.4) + (sunlight * 0.3) + ((100 - Math.abs(temperature - 22) * 5) * 0.3);
        soil_health = Math.max(0, Math.min(100, soil_health));

        data.push(`${tick},${moisture.toFixed(1)},${sunlight.toFixed(1)},${temperature.toFixed(1)},${soil_health.toFixed(1)},${event_marker}`);
    }

    fs.writeFileSync(filePath, data.join('\n'));
    console.log(`Generated ${NUM_TICKS} ticks to ${filePath}`);
}

// Generate 3 distinct simulations
generateCsvForPlant(1, 4);
generateCsvForPlant(2, 9);
generateCsvForPlant(3, 14);
