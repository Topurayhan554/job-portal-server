const express = require("express");
const router = express.Router();
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const Groq = require("groq-sdk");
const pdfParse = require("pdf-parse");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// POST /api/ai/analyze-cv
router.post(
  "/analyze-cv",
  protect,
  authorizeRoles("seeker"),
  async (req, res) => {
    try {
      const { cvBase64, jobTitle = "" } = req.body;

      if (!cvBase64)
        return res
          .status(400)
          .json({ success: false, message: "CV data required" });

      // base64 → Buffer → PDF text extract
      const pdfBuffer = Buffer.from(cvBase64, "base64");
      const pdfData = await pdfParse(pdfBuffer);
      const cvText = pdfData.text?.trim();

      if (!cvText || cvText.length < 50)
        return res.status(400).json({
          success: false,
          message:
            "Could not extract text from CV. Make sure it's not a scanned image PDF.",
        });

      const prompt = `You are an expert career counselor and HR professional. Analyze this CV/resume thoroughly.

${jobTitle ? `The candidate is targeting: **${jobTitle}** roles.` : ""}

CV CONTENT:
${cvText}

Provide a detailed analysis in the following exact JSON format (return ONLY valid JSON, no markdown, no backticks, no extra text):

{
  "overallScore": <number 0-100>,
  "scoreLabel": "<Excellent|Good|Average|Needs Work>",
  "summary": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>", "<weakness 3>"],
  "skills": {
    "found": ["<skill 1>", "<skill 2>", "<skill 3>"],
    "missing": ["<suggested skill 1>", "<suggested skill 2>", "<suggested skill 3>"]
  },
  "sections": {
    "contact":    { "score": <0-100>, "feedback": "<feedback>" },
    "summary":    { "score": <0-100>, "feedback": "<feedback>" },
    "experience": { "score": <0-100>, "feedback": "<feedback>" },
    "education":  { "score": <0-100>, "feedback": "<feedback>" },
    "skills":     { "score": <0-100>, "feedback": "<feedback>" }
  },
  "improvements": [
    { "priority": "high",   "title": "<title>", "detail": "<detail>" },
    { "priority": "medium", "title": "<title>", "detail": "<detail>" },
    { "priority": "low",    "title": "<title>", "detail": "<detail>" }
  ],
  "jobMatches": ["<job title 1>", "<job title 2>", "<job title 3>", "<job title 4>"],
  "atsScore": <number 0-100>,
  "atsTips": ["<tip 1>", "<tip 2>", "<tip 3>"]
}`;

      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2000,
      });

      const raw = completion.choices[0]?.message?.content || "";
      const clean = raw.replace(/```json|```/g, "").trim();
      const data = JSON.parse(clean);

      res.json({ success: true, analysis: data });
    } catch (err) {
      console.error("AI analyze error:", err);
      if (err instanceof SyntaxError) {
        res
          .status(500)
          .json({ success: false, message: "AI response parse error" });
      } else {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  },
);

module.exports = router;
