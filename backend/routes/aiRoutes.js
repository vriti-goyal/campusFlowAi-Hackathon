import express from 'express';
import { verifyFirebaseToken } from '../middleware/auth.js';
import { AIChatHistory } from '../models/AIChatHistory.js';
import { invokeTitan } from '../config/bedrock.js';

const router = express.Router();

router.use(verifyFirebaseToken);

// POST /api/ai/ask
router.post('/ask', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'Question is required' });

    // STUB: Real implementation will use AWS Bedrock
    // const bedrockResponse = await invokeTitan(question);
    
    const stubAnswer = `I found some information regarding "${question}". This is a placeholder AI response. In Phase 2, this will be powered by Amazon Titan via Bedrock.`;
    const stubSources = ['Syllabus_CS2024.pdf', 'Campus_Guidelines.docx'];

    const chat = await AIChatHistory.create({
      userId: req.user._id,
      question,
      answer: stubAnswer,
      sources: stubSources
    });

    res.json(chat);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process AI query' });
  }
});

// GET /api/ai/history
router.get('/history', async (req, res) => {
  try {
    const history = await AIChatHistory.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(20);
    res.json(history.reverse()); // Return oldest first for chat UI
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch AI history' });
  }
});

// POST /api/ai/daily-digest
router.post('/daily-digest', async (req, res) => {
  try {
    // STUB: Real implementation will query dashboard aggregation and summarize via LLM
    const digest = {
      greeting: `Good morning, ${req.user.name || 'Student'}!`,
      summaryLines: [
        "You have 1 high-priority assignment due in less than 24 hours.",
        "There's an upcoming exam next week for Database Management.",
        "A new placement opportunity from TechCorp is open for applications."
      ],
      recommendedAction: "Complete the 'DB Normalization' assignment first."
    };
    
    res.json(digest);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate daily digest' });
  }
});

export default router;
