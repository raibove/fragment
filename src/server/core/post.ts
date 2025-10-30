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
      backgroundUri: 'default-splash.png',
      buttonLabel: 'Play Game',
      description: 'Test your vocabulary! Create the longest words from letter fragments.',
      entryUri: 'index.html',
      heading: '🧩 Word Fragments Challenge',
      appIconUri: 'default-icon.png',
    },
    postData: {
      gameType: 'fragments',
      version: '1.0',
    },
    subredditName: subredditName,
    title: '🧩 Word Fragments - Vocabulary Challenge Game',
  });
};
