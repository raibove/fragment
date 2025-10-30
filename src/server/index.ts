import express from 'express';
import { 
  InitResponse, 
  IncrementResponse, 
  DecrementResponse,
  NewGameResponse,
  SubmitWordRequest,
  SubmitWordResponse,
  GetGameStateResponse,
  GetLeaderboardResponse
} from '../shared/types/api';
import { redis, reddit, createServer, context, getServerPort } from '@devvit/web/server';
import { createPost } from './core/post';
import { createNewGame, getGameState, submitWord, endGame, getDailyFragment, getDailyLeaderboard } from './core/fragments-game';

const app = express();

// Middleware for JSON body parsing
app.use(express.json());
// Middleware for URL-encoded body parsing
app.use(express.urlencoded({ extended: true }));
// Middleware for plain text body parsing
app.use(express.text());

const router = express.Router();

router.get<{ postId: string }, InitResponse | { status: string; message: string }>(
  '/api/init',
  async (_req, res): Promise<void> => {
    const { postId } = context;

    if (!postId) {
      console.error('API Init Error: postId not found in devvit context');
      res.status(400).json({
        status: 'error',
        message: 'postId is required but missing from context',
      });
      return;
    }

    try {
      const [count, username] = await Promise.all([
        redis.get('count'),
        reddit.getCurrentUsername(),
      ]);

      res.json({
        type: 'init',
        postId: postId,
        count: count ? parseInt(count) : 0,
        username: username ?? 'anonymous',
      });
    } catch (error) {
      console.error(`API Init Error for post ${postId}:`, error);
      let errorMessage = 'Unknown error during initialization';
      if (error instanceof Error) {
        errorMessage = `Initialization failed: ${error.message}`;
      }
      res.status(400).json({ status: 'error', message: errorMessage });
    }
  }
);

router.post<{ postId: string }, IncrementResponse | { status: string; message: string }, unknown>(
  '/api/increment',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    res.json({
      count: await redis.incrBy('count', 1),
      postId,
      type: 'increment',
    });
  }
);

router.post<{ postId: string }, DecrementResponse | { status: string; message: string }, unknown>(
  '/api/decrement',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    res.json({
      count: await redis.incrBy('count', -1),
      postId,
      type: 'decrement',
    });
  }
);

router.post('/internal/on-app-install', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      status: 'success',
      message: `Post created in subreddit ${context.subredditName} with id ${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

router.post('/internal/menu/post-create', async (_req, res): Promise<void> => {
  try {
    const post = await createPost();

    res.json({
      navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}`,
    });
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    res.status(400).json({
      status: 'error',
      message: 'Failed to create post',
    });
  }
});

// Fragments Game Endpoints
router.post<{ postId: string }, NewGameResponse | { status: string; message: string }>(
  '/api/new-game',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    try {
      const username = await reddit.getCurrentUsername();
      if (!username) {
        res.status(400).json({
          status: 'error',
          message: 'User authentication required',
        });
        return;
      }

      const gameState = await createNewGame(postId, username);
      res.json({
        type: 'new-game',
        postId,
        gameState,
      });
    } catch (error) {
      console.error(`Error creating new game: ${error}`);
      res.status(400).json({
        status: 'error',
        message: 'Failed to create new game',
      });
    }
  }
);

router.get<{ postId: string }, GetGameStateResponse | { status: string; message: string }>(
  '/api/game-state',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    try {
      const username = await reddit.getCurrentUsername();
      if (!username) {
        res.status(400).json({
          status: 'error',
          message: 'User authentication required',
        });
        return;
      }

      const gameState = await getGameState(postId, username);
      if (!gameState) {
        res.status(404).json({
          status: 'error',
          message: 'Game not found',
        });
        return;
      }

      res.json({
        type: 'game-state',
        postId,
        gameState,
      });
    } catch (error) {
      console.error(`Error getting game state: ${error}`);
      res.status(400).json({
        status: 'error',
        message: 'Failed to get game state',
      });
    }
  }
);

router.post<{ postId: string }, SubmitWordResponse | { status: string; message: string }, SubmitWordRequest>(
  '/api/submit-word',
  async (req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    const { word } = req.body;
    if (!word || typeof word !== 'string') {
      res.status(400).json({
        status: 'error',
        message: 'Word is required',
      });
      return;
    }

    try {
      const username = await reddit.getCurrentUsername();
      if (!username) {
        res.status(400).json({
          status: 'error',
          message: 'User authentication required',
        });
        return;
      }

      const result = await submitWord(postId, username, word.trim());
      res.json({
        type: 'submit-word',
        postId,
        valid: result.valid,
        score: result.score,
        gameState: result.gameState,
        message: result.message,
      });
    } catch (error) {
      console.error(`Error submitting word: ${error}`);
      res.status(400).json({
        status: 'error',
        message: 'Failed to submit word',
      });
    }
  }
);

router.post<{ postId: string }, GetGameStateResponse | { status: string; message: string }>(
  '/api/end-game',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    try {
      const username = await reddit.getCurrentUsername();
      if (!username) {
        res.status(400).json({
          status: 'error',
          message: 'User authentication required',
        });
        return;
      }

      const gameState = await endGame(postId, username);
      if (!gameState) {
        res.status(404).json({
          status: 'error',
          message: 'Game not found',
        });
        return;
      }

      res.json({
        type: 'game-state',
        postId,
        gameState,
      });
    } catch (error) {
      console.error(`Error ending game: ${error}`);
      res.status(400).json({
        status: 'error',
        message: 'Failed to end game',
      });
    }
  }
);

router.get<{ postId: string }, GetLeaderboardResponse | { status: string; message: string }>(
  '/api/leaderboard',
  async (_req, res): Promise<void> => {
    const { postId } = context;
    if (!postId) {
      res.status(400).json({
        status: 'error',
        message: 'postId is required',
      });
      return;
    }

    try {
      const [leaderboard, dailyFragment] = await Promise.all([
        getDailyLeaderboard(),
        getDailyFragment()
      ]);

      res.json({
        type: 'leaderboard',
        postId,
        leaderboard,
        dailyFragment,
      });
    } catch (error) {
      console.error(`Error getting leaderboard: ${error}`);
      res.status(400).json({
        status: 'error',
        message: 'Failed to get leaderboard',
      });
    }
  }
);

// Use router middleware
app.use(router);

// Get port from environment variable with fallback
const port = getServerPort();

const server = createServer(app);
server.on('error', (err) => console.error(`server error; ${err.stack}`));
server.listen(port);
