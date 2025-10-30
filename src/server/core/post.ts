import { context, reddit } from '@devvit/web/server';

export const createPost = async () => {
  const { subredditName } = context;
  if (!subredditName) {
    throw new Error('subredditName is required');
  }

  return await reddit.submitCustomPost({
    splash: {
      // Splash Screen Configuration
      appDisplayName: 'Word Fragments',
      backgroundUri: 'splash.png',
      buttonLabel: '🎯 Start Playing',
      description: 'Daily vocabulary challenge! Create the longest words from letter fragments. Compete on global leaderboards and track your progress over time.',
      heading: '🧩 Word Fragments Challenge',
      appIconUri: 'default-icon.png',
    },
    postData: {
      gameType: 'fragments',
      version: '1.0',
    },
    subredditName: subredditName,
    title: '🧩 Word Fragments - Daily Vocabulary Challenge',
  });
};
