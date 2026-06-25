import companionProfiles from '../../../shared/companionProfiles.json';

export const personas = companionProfiles.map(profile => ({
    id: profile.id,
    name: profile.persona,
    type: profile.type,
    description: profile.selectionDescription,
    character: profile.character,
    healthyVoice: profile.healthyVoice,
    unwellVoice: profile.unwellVoice,
    council: profile.council,
    helperLine: profile.helperLine,
    exampleLine: profile.exampleLine,
    statusMetaphor: profile.statusMetaphor,
    emoji: '',
    bgTheme: profile.bgTheme,
    textColor: profile.textColor,
    imgUrl: profile.imgUrl
}));
