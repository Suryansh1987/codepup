import { Router, Request, Response } from 'express';
import messageService from '../services/messageService';

const router = Router();

// Create message
router.post('/', async (req: Request, res: Response) => {
  try {
    const message = await messageService.createMessage(req.body);
    res.json(message);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;