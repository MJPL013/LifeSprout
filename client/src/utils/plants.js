export function getPlantImageSrc(user = {}) {
    const explicit = String(user.imgUrl || '').trim();
    if (explicit) return explicit;

    const identity = `${user.plantType || ''} ${user.persona || ''}`.toLowerCase();
    if (identity.includes('cactus') || identity.includes('spike')) return '/cactus.png';
    if (identity.includes('fern')) return '/fern.png';
    if (identity.includes('pothos') || identity.includes('vine')) return '/pothos.png';
    return '/monstera.png';
}